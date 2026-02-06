<?php

namespace App\Http\Controllers\Keuangan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class InputPembelianController
{
    private function normalizeJenisBeban(?string $jenis): string
    {
        $j = strtoupper(trim((string) $jenis));
        return $j === 'KREDIT' ? 'Kredit' : 'Debit';
    }

    private function nabbrekapAvailable(): bool
    {
        return Schema::hasTable('tb_nabbrekap')
            && Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')
            && Schema::hasColumn('tb_nabbrekap', 'Kode_Akun')
            && Schema::hasColumn('tb_nabbrekap', 'Saldo');
    }

    /**
     * @return array<string,float> akun => weight
     */
    private function getNaBBAccountWeights(int $maxPeriods = 24): array
    {
        $maxPeriods = max(1, min(60, $maxPeriods));
        if (!$this->nabbrekapAvailable()) return [];

        try {
            $periods = DB::table('tb_nabbrekap')
                ->selectRaw('DISTINCT RIGHT(Kode_NaBB, 6) as p')
                ->whereNotNull('Kode_NaBB')
                ->orderByDesc('p')
                ->limit($maxPeriods)
                ->pluck('p')
                ->map(fn ($v) => (string) $v)
                ->filter(fn ($v) => preg_match('/^\\d{6}$/', $v))
                ->values()
                ->all();

            if (count($periods) === 0) return [];

            $rows = DB::table('tb_nabbrekap as n')
                ->whereNotNull('n.Kode_Akun')
                ->whereRaw("TRIM(COALESCE(n.Kode_Akun,'')) <> ''")
                ->whereRaw('RIGHT(n.Kode_NaBB, 6) in (' . implode(',', array_fill(0, count($periods), '?')) . ')', $periods)
                ->selectRaw('TRIM(n.Kode_Akun) as akun')
                ->selectRaw('SUM(ABS(COALESCE(n.Saldo,0))) as w')
                ->groupBy('akun')
                ->get();

            $out = [];
            foreach ($rows as $r) {
                $akun = trim((string) ($r->akun ?? ''));
                $w = (float) ($r->w ?? 0);
                if ($akun === '' || $w <= 0) continue;
                $out[$akun] = $w;
            }
            return $out;
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param array<string,int|float> $counts
     * @param array<string,float> $weights
     * @return string[]
     */
    private function rankAccountsWithNaBB(array $counts, array $weights, int $limit): array
    {
        $limit = max(1, min(10, $limit));
        if (count($counts) === 0) return [];

        $scored = [];
        foreach ($counts as $akun => $cnt) {
            $a = trim((string) $akun);
            if ($a === '') continue;
            $base = (float) $cnt;
            $bonus = isset($weights[$a]) ? 0.25 : 0.0; // soft preference
            $scored[] = ['akun' => $a, 'score' => $base + $bonus];
        }
        usort($scored, fn ($x, $y) => ($y['score'] <=> $x['score']));
        return array_slice(array_map(fn ($r) => (string) $r['akun'], $scored), 0, $limit);
    }

    private function jurnalAvailable(): bool
    {
        return Schema::hasTable('tb_jurnal')
            && Schema::hasTable('tb_jurnaldetail')
            && Schema::hasColumn('tb_jurnal', 'Kode_Jurnal')
            && Schema::hasColumn('tb_jurnal', 'Tgl_Jurnal')
            && Schema::hasColumn('tb_jurnaldetail', 'Kode_Jurnal')
            && Schema::hasColumn('tb_jurnaldetail', 'Kode_Akun')
            && Schema::hasColumn('tb_jurnaldetail', 'Debit')
            && Schema::hasColumn('tb_jurnaldetail', 'Kredit');
    }

    private function getTopAccountsFromJurnal(string $vendorKey, string $flow, int $limit): array
    {
        // flow: 'debit' or 'kredit'
        $limit = max(1, min(10, $limit));
        if (!$this->jurnalAvailable()) return [];

        $flow = strtolower($flow) === 'kredit' ? 'kredit' : 'debit';
        $hasRemark = Schema::hasColumn('tb_jurnal', 'Remark');
        $hasVoucher = Schema::hasColumn('tb_jurnal', 'Kode_Voucher');

        try {
            $q = DB::table('tb_jurnal as j')
                ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [
                    Carbon::now()->subYears(3)->toDateString(),
                    Carbon::now()->toDateString(),
                ]);

            if ($vendorKey !== '' && $hasRemark) {
                $q->whereRaw('LOWER(j.Remark) like ?', ['%' . $vendorKey . '%']);
            }

            // If remark is not available, fall back to voucher search (FI usually appears there) when possible.
            if ($vendorKey !== '' && !$hasRemark && $hasVoucher) {
                $q->whereRaw('LOWER(j.Kode_Voucher) like ?', ['%' . $vendorKey . '%']);
            }

            $expr = $flow === 'kredit' ? 'COALESCE(d.Kredit,0)' : 'COALESCE(d.Debit,0)';
            $q->whereRaw($expr . ' > 0');

            $rows = $q->selectRaw('TRIM(d.Kode_Akun) as akun')
                ->selectRaw('SUM(' . $expr . ') as total')
                ->groupBy('akun')
                ->orderByDesc('total')
                ->limit($limit)
                ->get();

            return $rows->map(fn ($r) => (string) ($r->akun ?? ''))->filter()->values()->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function suggestFromInvoiceHistory(string $vendorKey, bool $hasPpn, float $dppTarget, float $taxTarget): ?array
    {
        if (!Schema::hasTable('tb_kdinvin') || !Schema::hasColumn('tb_kdinvin', 'jurnal')) {
            return null;
        }
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Voucher')) {
            return null;
        }
        if (!$this->kasBreakdownAvailable()) {
            return null;
        }

        $q = DB::table('tb_kdinvin as h')
            ->whereRaw("TRIM(COALESCE(h.jurnal,'')) <> ''");

        if ($vendorKey !== '' && Schema::hasColumn('tb_kdinvin', 'nm_vdr')) {
            $q->whereRaw('LOWER(h.nm_vdr) like ?', ['%' . $vendorKey . '%']);
        }

        $hist = $q->orderByDesc('h.no_doc')
            ->limit(160)
            ->get(['h.no_doc', 'h.jurnal', 'h.tax', 'h.total']);

        if ($hist->count() === 0) return null;

        $vouchers = $hist->pluck('jurnal')->map(fn ($v) => trim((string) $v))->filter()->unique()->values()->all();
        if (count($vouchers) === 0) return null;

        $kasRows = DB::table('tb_kas')
            ->whereIn('Kode_Voucher', $vouchers)
            ->get([
                'Kode_Voucher',
                'Kode_Akun',
                'Kode_Akun1', 'Nominal1', 'Jenis_Beban1',
                'Kode_Akun2', 'Nominal2', 'Jenis_Beban2',
                'Kode_Akun3', 'Nominal3', 'Jenis_Beban3',
                'Keterangan',
            ])
            ->keyBy('Kode_Voucher');

        if ($kasRows->count() === 0) return null;

        $cashCounts = [];
        $typeCounts = [];
        $ppnCounts = [];
        $dppCounts = [];
        $jenisMap = [];
        $nabbWeights = $this->getNaBBAccountWeights();

        foreach ($hist as $hrow) {
            $voucher = trim((string) ($hrow->jurnal ?? ''));
            if ($voucher === '') continue;
            $kas = $kasRows[$voucher] ?? null;
            if (!$kas) continue;

            $kodeKas = trim((string) ($kas->Kode_Akun ?? ''));
            if ($kodeKas !== '') $cashCounts[$kodeKas] = ($cashCounts[$kodeKas] ?? 0) + 1;
            if (str_contains($voucher, '/GV/')) $typeCounts['GV'] = ($typeCounts['GV'] ?? 0) + 1;
            if (str_contains($voucher, '/BV/')) $typeCounts['BV'] = ($typeCounts['BV'] ?? 0) + 1;

            $histTax = max(0.0, (float) ($hrow->tax ?? 0));
            $histHasPpn = $histTax > 0 || ((float) ($kas->Nominal2 ?? 0) > 0);

            if ($hasPpn && $taxTarget > 0 && $histHasPpn) {
                $kode2 = trim((string) ($kas->Kode_Akun2 ?? ''));
                if ($kode2 !== '' && (float) ($kas->Nominal2 ?? 0) > 0) {
                    $ppnCounts[$kode2] = ($ppnCounts[$kode2] ?? 0) + 1;
                }
            }

            $slots = $histHasPpn ? [1, 3] : [1, 2, 3];
            foreach ($slots as $slot) {
                $kode = trim((string) ($kas->{'Kode_Akun' . $slot} ?? ''));
                $nom = (float) ($kas->{'Nominal' . $slot} ?? 0);
                $jenis = trim((string) ($kas->{'Jenis_Beban' . $slot} ?? ''));
                if ($kode === '' || $nom <= 0) continue;
                $dppCounts[$kode] = ($dppCounts[$kode] ?? 0) + 1;
                if (!isset($jenisMap[$kode])) {
                    $jenisMap[$kode] = $this->normalizeJenisBeban($jenis);
                }
            }
        }

        if (count($dppCounts) === 0) return null;

        $limit = ($hasPpn && $taxTarget > 0) ? 2 : 3;
        $top = $this->rankAccountsWithNaBB($dppCounts, $nabbWeights, $limit);
        $running = 0.0;
        $lines = [];
        foreach ($top as $i => $akun) {
            $nom = $i === (count($top) - 1)
                ? round($dppTarget - $running, 2)
                : round($dppTarget / count($top), 2);
            $running += $nom;
            $lines[] = [
                'akun' => $akun,
                'jenis' => (string) (($jenisMap[$akun] ?? '') ?: 'Debit'),
                'nominal' => $nom,
            ];
        }

        $ppnAkun = '';
        if (count($ppnCounts)) {
            $ranked = $this->rankAccountsWithNaBB($ppnCounts, $nabbWeights, 1);
            $ppnAkun = (string) ($ranked[0] ?? '');
        }

        $kodeAkun = '';
        if (count($cashCounts)) {
            arsort($cashCounts);
            $kodeAkun = (string) array_key_first($cashCounts);
        }

        $voucherType = '';
        if (count($typeCounts)) {
            arsort($typeCounts);
            $voucherType = (string) array_key_first($typeCounts);
        }

        return [
            'kode_akun' => $kodeAkun,
            'voucher_type' => $voucherType,
            'ppn_akun' => $ppnAkun,
            'beban_lines' => $lines,
        ];
    }

    private function buildDefaultKeterangan(object $fi): string
    {
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        $vendor = trim((string) ($fi->nm_vdr ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        $ket = 'Pembelian/FI ' . $noDoc;
        if ($vendor !== '') $ket .= ' — ' . $vendor;
        if ($refPo !== '') $ket .= ' (PO ' . $refPo . ')';
        return $ket;
    }

    private function buildKeteranganTemplate(string $keterangan): string
    {
        $k = trim($keterangan);
        if ($k === '') return '';

        // Normalize whitespace
        $k = preg_replace('/\\s+/', ' ', $k) ?? $k;

        // Replace FI tokens with placeholder
        $k = preg_replace('/\\b(No\\.)?\\s*FI\\s*[-:]?\\s*[A-Z0-9]+\\b/i', '{FI}', $k) ?? $k;
        $k = preg_replace('/\\bFI\\s*[-:]?\\s*[A-Z0-9]+\\b/i', '{FI}', $k) ?? $k;

        // Replace PO tokens with placeholder
        $k = preg_replace('/\\bPO\\s*[-:]?\\s*[A-Z0-9\\.\\-\\/]+\\b/i', 'PO {PO}', $k) ?? $k;

        return trim($k);
    }

    private function renderKeteranganFromTemplate(string $template, object $fi): string
    {
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        $out = $template !== '' ? $template : $this->buildDefaultKeterangan($fi);
        $out = str_replace('{FI}', $noDoc !== '' ? $noDoc : '{FI}', $out);
        $out = str_replace('{PO}', $refPo !== '' ? $refPo : '{PO}', $out);
        $out = preg_replace('/\\s+/', ' ', $out) ?? $out;

        return trim($out);
    }

    private function suggestKeterangan(object $fi): string
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Keterangan')) {
            return $this->buildDefaultKeterangan($fi);
        }

        $vendorKey = $this->buildVendorKey((string) ($fi->nm_vdr ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        // Candidate from historical tb_kas.
        $q = DB::table('tb_kas as k')
            ->where('k.Keterangan', 'like', '%FI%')
            ->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(200)
            ->get(['k.Keterangan', 'k.Tgl_Voucher']);

        $bestTemplate = '';
        $bestScore = -1;

        foreach ($q as $r) {
            $ket = trim((string) ($r->Keterangan ?? ''));
            if ($ket === '') continue;

            $score = 0;
            $lower = strtolower($ket);
            if ($vendorKey !== '' && str_contains($lower, $vendorKey)) $score += 3;
            if ($refPo !== '' && str_contains($lower, strtolower($refPo))) $score += 3;
            if (str_contains($lower, 'pembelian')) $score += 1;

            $tpl = $this->buildKeteranganTemplate($ket);
            if ($tpl === '') continue;

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestTemplate = $tpl;
            }
        }

        $rendered = $this->renderKeteranganFromTemplate($bestTemplate, $fi);

        // Ensure FI number appears
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        if ($noDoc !== '' && !str_contains(strtoupper($rendered), strtoupper($noDoc))) {
            $rendered = $this->buildDefaultKeterangan($fi);
        }

        return $rendered;
    }

    private function getDatabaseCode(Request $request): string
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');

        $db = is_string($database) ? trim($database) : '';
        if ($db === '') return 'SJA';

        // Common patterns: "dbsja" => "SJA", "SJA" => "SJA"
        $db = preg_replace('/[^a-zA-Z0-9]/', '', $db);
        $db = preg_replace('/^db/i', '', $db);
        $db = strtoupper($db);

        return $db !== '' ? $db : 'SJA';
    }

    private function guessVoucherType(string $kodeAkun): string
    {
        // Heuristic: cash account -> GV, others -> BV
        $kodeAkun = strtoupper(trim($kodeAkun));
        if ($kodeAkun === '1101AD' || str_starts_with($kodeAkun, '1101')) {
            return 'GV';
        }
        return 'BV';
    }

    private function buildKasSelect(): array
    {
        $cols = Schema::getColumnListing('tb_kas');
        $hasTglBuat = in_array('Tgl_Buat', $cols, true);

        return [
            'k.Kode_Voucher',
            'k.Kode_Akun',
            'k.Tgl_Voucher',
            $hasTglBuat ? 'k.Tgl_Buat' : DB::raw("'' as Tgl_Buat"),
            'k.Keterangan',
            DB::raw('COALESCE(k.Mutasi_Kas,0) as Mutasi_Kas'),
            DB::raw('COALESCE(k.Saldo,0) as Saldo'),
        ];
    }

    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
    }

    private function getAccountOptions(): array
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Akun')) {
            return [];
        }

        $nabbName = $this->nabbNameAvailable();
        try {
            $codes = DB::table('tb_kas as k')
                ->selectRaw('DISTINCT k.Kode_Akun as Kode_Akun')
                ->whereNotNull('k.Kode_Akun')
                ->orderBy('Kode_Akun', 'asc')
                ->pluck('Kode_Akun')
                ->map(fn ($c) => (string) $c)
                ->filter()
                ->values()
                ->all();

            if (!$nabbName || count($codes) === 0) {
                return array_map(fn ($c) => ['value' => $c, 'label' => $c], $codes);
            }

            $names = DB::table('tb_nabb')
                ->whereIn('Kode_Akun', $codes)
                ->pluck('Nama_Akun', 'Kode_Akun');

            return array_map(function ($c) use ($names) {
                $name = (string) ($names[$c] ?? '');
                return [
                    'value' => $c,
                    'label' => $name !== '' ? ($c . ' — ' . $name) : $c,
                ];
            }, $codes);
        } catch (\Throwable) {
            return [];
        }
    }

    private function getDefaultAccount(): ?string
    {
        $preferred = ['1101AD', '1102AD', '1103AD', '1104AD'];
        $opts = $this->getAccountOptions();
        $values = collect($opts)->pluck('value')->map(fn ($v) => (string) $v)->all();

        foreach ($preferred as $code) {
            if (in_array($code, $values, true)) {
                return $code;
            }
        }

        return $opts[0]['value'] ?? null;
    }

    private function getExpenseAccountOptions(): array
    {
        // Prefer chart of accounts table if available.
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            $hasName = Schema::hasColumn('tb_nabb', 'Nama_Akun');
            try {
                $q = DB::table('tb_nabb')
                    ->select([
                        'Kode_Akun',
                        $hasName ? 'Nama_Akun' : DB::raw("'' as Nama_Akun"),
                    ])
                    ->whereNotNull('Kode_Akun')
                    ->orderBy('Kode_Akun', 'asc')
                    ->limit(5000);

                return $q->get()->map(function ($r) {
                    $code = trim((string) ($r->Kode_Akun ?? ''));
                    if ($code === '') return null;
                    $name = trim((string) ($r->Nama_Akun ?? ''));
                    return [
                        'value' => $code,
                        'label' => $name !== '' ? ($code . ' — ' . $name) : $code,
                    ];
                })->filter()->values()->all();
            } catch (\Throwable) {
                // fallback below
            }
        }

        // Fallback: reuse cash/bank options if NABB not present.
        return $this->getAccountOptions();
    }

    public function index(Request $request)
    {
        $defaultAccount = $this->getDefaultAccount();

        return Inertia::render('Keuangan/input-pembelian/index', [
            'filters' => [
                'search' => (string) $request->query('search', ''),
                // Default to 'all' so user can see historical data even if it was posted to bank accounts.
                'account' => (string) $request->query('account', 'all'),
                'period' => (string) $request->query('period', Carbon::now()->format('Ym')),
                'pageSize' => (int) $request->query('pageSize', 10),
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $defaultAccount,
        ]);
    }

    public function create()
    {
        return Inertia::render('Keuangan/input-pembelian/create', [
            'filters' => [
                'search' => '',
                'status' => 'belum_dijurnal',
                'pageSize' => 10,
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $this->getDefaultAccount(),
            'expenseAccountOptions' => $this->getExpenseAccountOptions(),
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['rows' => [], 'total' => 0, 'error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $account = (string) $request->query('account', 'all');
            $period = trim((string) $request->query('period', ''));
            $pageSizeRaw = $request->query('pageSize', 10);
            $pageRaw = $request->query('page', 1);

            $page = max(1, (int) $pageRaw);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

            $cols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json(['rows' => [], 'total' => 0, 'error' => "Kolom tb_kas.$col tidak ditemukan."], 500);
                }
            }

            $start = null;
            $end = null;
            if ($period !== '') {
                if (preg_match('/^\\d{6}$/', $period)) {
                    $month = Carbon::createFromFormat('Ym', $period)->startOfMonth();
                    $start = $month->copy()->startOfMonth()->toDateString();
                    $end = $month->copy()->endOfMonth()->toDateString();
                } elseif (preg_match('/^\\d{4}$/', $period)) {
                    $year = Carbon::createFromFormat('Y', $period)->startOfYear();
                    $start = $year->copy()->startOfYear()->toDateString();
                    $end = $year->copy()->endOfYear()->toDateString();
                }
            }

            $q = DB::table('tb_kas as k');

            if ($start && $end) {
                $q->whereBetween('k.Tgl_Voucher', [$start, $end]);
            }

            if ($account !== '' && $account !== 'all') {
                $q->where('k.Kode_Akun', '=', $account);
            }

            // "Input Pembelian" dikenali dari voucher type (GV/BV) + keterangan pembelian FI.
            // Catatan: data historis bisa memakai prefix berbeda (tanpa kode DB), jadi jangan dikunci ke $dbCode saja.
            $q->where(function ($qq) {
                $qq->where('k.Kode_Voucher', 'like', '%/GV/%')
                    ->orWhere('k.Kode_Voucher', 'like', '%/BV/%')
                    ->orWhere('k.Kode_Voucher', 'like', 'GV%')
                    ->orWhere('k.Kode_Voucher', 'like', 'BV%');
            });
            // Historical data sometimes uses "No.FIxxxx" instead of "Pembelian/FI ...".
            $q->where(function ($qq) {
                $qq->where('k.Keterangan', 'like', '%Pembelian/FI%')
                    ->orWhere('k.Keterangan', 'like', '%FI%');
            });

            if ($search !== '') {
                $term = '%' . $search . '%';
                $q->where(function ($qq) use ($term) {
                    $qq->where('k.Kode_Voucher', 'like', $term)
                        ->orWhere('k.Keterangan', 'like', $term);
                });
            }

            $total = (int) (clone $q)->count();

            $q->orderByDesc('k.Tgl_Voucher')->orderByDesc('k.Kode_Voucher');

            if ($pageSize !== 'all') {
                $q->forPage($page, $pageSize);
            }

            $rows = $q->get($this->buildKasSelect());

            return response()->json([
                'rows' => $rows,
                'total' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function fiRows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['rows' => [], 'total' => 0, 'error' => 'Tabel tb_kdinvin tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $status = (string) $request->query('status', 'belum_dijurnal');
            $pageSizeRaw = $request->query('pageSize', 10);
            $pageRaw = $request->query('page', 1);

            $page = max(1, (int) $pageRaw);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

            $q = DB::table('tb_kdinvin');

            if ($search !== '') {
                $term = '%' . $search . '%';
                $q->where(function ($qq) use ($term) {
                    $qq->where('no_doc', 'like', $term)
                        ->orWhere('ref_po', 'like', $term)
                        ->orWhere('nm_vdr', 'like', $term);
                });
            }

            if ($status === 'belum_dijurnal') {
                $q->where(function ($qq) {
                    $qq->whereNull('jurnal')
                        ->orWhereRaw("TRIM(COALESCE(jurnal,'')) = ''");
                });
            } elseif ($status === 'sudah_dijurnal') {
                $q->whereRaw("TRIM(COALESCE(jurnal,'')) <> ''");
            }

            $total = (int) (clone $q)->count();

            $q->orderByDesc('no_doc');

            if ($pageSize !== 'all') {
                $q->forPage($page, $pageSize);
            }

            $rows = $q->get([
                'no_doc',
                'doc_rec',
                'inv_d',
                'ref_po',
                'nm_vdr',
                'total',
                'pembayaran',
                'sisa_bayar',
                'tgl_bayar',
                'jurnal',
            ]);

            return response()->json([
                'rows' => $rows,
                'total' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function fiDetail(string $noDoc)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['header' => null, 'ppn_percent' => null, 'error' => 'Tabel tb_kdinvin tidak ditemukan.'], 404);
            }

            $header = DB::table('tb_kdinvin')
                ->where('no_doc', $noDoc)
                ->first();

            if (!$header) {
                return response()->json(['header' => null, 'ppn_percent' => null, 'error' => 'FI tidak ditemukan.'], 404);
            }

            $ppnPercent = null;
            $refPo = trim((string) ($header->ref_po ?? ''));
            if ($refPo !== '' && Schema::hasTable('tb_po') && Schema::hasColumn('tb_po', 'no_po') && Schema::hasColumn('tb_po', 'ppn')) {
                $val = DB::table('tb_po')->where('no_po', $refPo)->value('ppn');
                if ($val !== null && $val !== '') {
                    $ppnPercent = (float) $val;
                }
            }

            return response()->json([
                'header' => [
                    'no_doc' => (string) ($header->no_doc ?? ''),
                    'ref_po' => (string) ($header->ref_po ?? ''),
                    'nm_vdr' => (string) ($header->nm_vdr ?? ''),
                    'total' => (float) ($header->total ?? 0),
                    'tax' => (float) ($header->tax ?? 0),
                    'pembayaran' => (float) ($header->pembayaran ?? 0),
                    'tgl_bayar' => (string) ($header->tgl_bayar ?? ''),
                    'inv_d' => (string) ($header->inv_d ?? ''),
                    'jurnal' => (string) ($header->jurnal ?? ''),
                ],
                'ppn_percent' => $ppnPercent,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['header' => null, 'ppn_percent' => null, 'error' => $e->getMessage()], 500);
        }
    }

    private function kasBreakdownAvailable(): bool
    {
        if (!Schema::hasTable('tb_kas')) return false;
        $cols = Schema::getColumnListing('tb_kas');
        foreach (['Kode_Akun1', 'Nominal1', 'Kode_Akun2', 'Nominal2', 'Kode_Akun3', 'Nominal3'] as $c) {
            if (!in_array($c, $cols, true)) return false;
        }
        return true;
    }

    private function getDefaultPpnAccount(): string
    {
        if (!$this->kasBreakdownAvailable()) return '';

        try {
            $q = DB::table('tb_kas as k')
                ->whereNotNull('k.Kode_Akun2')
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun2,'')) <> ''")
                ->whereRaw('COALESCE(k.Nominal2,0) > 0')
                ->selectRaw('TRIM(k.Kode_Akun2) as akun, COUNT(*) as cnt')
                ->groupBy('akun')
                ->orderByDesc('cnt')
                ->limit(1)
                ->first();

            return $q ? (string) ($q->akun ?? '') : '';
        } catch (\Throwable) {
            return '';
        }
    }

    private function getDefaultDppAccounts(bool $hasPpn, int $limit): array
    {
        if (!$this->kasBreakdownAvailable()) return [];
        $limit = max(1, min(3, $limit));

        try {
            // Collect frequent DPP accounts from kas breakdown.
            // 1) Prefer purchase history (keterangan starts with "Pembelian/FI").
            // 2) Fallback to global breakdown history if none.
            $base = DB::table('tb_kas as k')
                ->orderByDesc('k.Tgl_Voucher')
                ->orderByDesc('k.Kode_Voucher')
                ->limit(800)
                ->get([
                    'k.Keterangan',
                    'k.Kode_Akun1', 'k.Nominal1', 'k.Jenis_Beban1',
                    'k.Kode_Akun2', 'k.Nominal2', 'k.Jenis_Beban2',
                    'k.Kode_Akun3', 'k.Nominal3', 'k.Jenis_Beban3',
                ]);

            $purchaseRows = $base->filter(function ($r) {
                $ket = trim((string) ($r->Keterangan ?? ''));
                return str_starts_with($ket, 'Pembelian/FI ');
            });
            $rows = $purchaseRows->count() ? $purchaseRows : $base;

            $counts = [];
            $slots = $hasPpn ? [1, 3] : [1, 2, 3];
            foreach ($rows as $r) {
                foreach ($slots as $slot) {
                    $kode = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    $jenis = strtoupper(trim((string) ($r->{'Jenis_Beban' . $slot} ?? '')));
                    if ($kode === '' || $nom <= 0) continue;
                    // Jenis_Beban di data ini umumnya "Debit/Kredit", jadi tidak ada marker "PPN".

                    $counts[$kode] = $counts[$kode] ?? ['count' => 0, 'jenis' => ''];
                    $counts[$kode]['count']++;
                    if ($counts[$kode]['jenis'] === '' && $jenis !== '') {
                        $counts[$kode]['jenis'] = $this->normalizeJenisBeban($jenis);
                    }
                }
            }

            if (!count($counts)) return [];

            // If history exists but too sparse, supplement from jurnal (debit side) for vendor-agnostic fallback.
            if (count($counts) < $limit) {
                $jurnalTop = $this->getTopAccountsFromJurnal('', 'debit', $limit);
                foreach ($jurnalTop as $akun) {
                    if (isset($counts[$akun])) continue;
                    $counts[$akun] = ['count' => 0, 'jenis' => 'Debit'];
                }
            }
            uasort($counts, fn ($a, $b) => ($b['count'] ?? 0) <=> ($a['count'] ?? 0));
            $top = array_slice(array_keys($counts), 0, $limit);

            $out = [];
            foreach ($top as $akun) {
                $out[] = [
                    'akun' => (string) $akun,
                    'jenis' => (string) ($counts[$akun]['jenis'] ?? ''),
                ];
            }
            return $out;
        } catch (\Throwable) {
            return [];
        }
    }

    private function getFallbackExpenseAccount(): string
    {
        // If no usable history, choose a reasonable default from chart of accounts.
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            // Fallback: try jurnal debit-heavy accounts.
            $top = $this->getTopAccountsFromJurnal('', 'debit', 1);
            return $top[0] ?? '';
        }

        try {
            // Prefer non-cash/bank accounts (avoid 11xx if possible).
            $first = (string) (DB::table('tb_nabb')
                ->whereNotNull('Kode_Akun')
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) NOT LIKE '11%'")
                ->orderBy('Kode_Akun', 'asc')
                ->value('Kode_Akun') ?? '');

            if (trim($first) !== '') return trim($first);

            $any = (string) (DB::table('tb_nabb')
                ->whereNotNull('Kode_Akun')
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                ->orderBy('Kode_Akun', 'asc')
                ->value('Kode_Akun') ?? '');

            return trim($any);
        } catch (\Throwable) {
            $top = $this->getTopAccountsFromJurnal('', 'debit', 1);
            return $top[0] ?? '';
        }
    }

    private function buildDefaultDppLines(bool $hasPpn, float $dppTarget, float $taxTarget): array
    {
        if ($dppTarget <= 0) {
            return [];
        }

        $limit = ($hasPpn && $taxTarget > 0) ? 2 : 3;
        $accounts = $this->getDefaultDppAccounts($hasPpn, $limit);
        if (count($accounts) === 0) {
            return [
                ['akun' => '', 'jenis' => 'Debit', 'nominal' => $dppTarget],
            ];
        }

        $lines = [];
        $running = 0.0;
        foreach ($accounts as $i => $a) {
            $nom = $i === (count($accounts) - 1)
                ? round($dppTarget - $running, 2)
                : round($dppTarget / count($accounts), 2);
            $running += $nom;
            $jenis = trim((string) ($a['jenis'] ?? ''));
            $lines[] = [
                'akun' => (string) ($a['akun'] ?? ''),
                'jenis' => $jenis !== '' ? $this->normalizeJenisBeban($jenis) : 'Debit',
                'nominal' => $nom,
            ];
        }
        return $lines;
    }

    private function computeAllocation(object $fiHeader, float $cashNominal): array
    {
        $headerTotal = (float) ($fiHeader->total ?? 0);
        $headerTax = max(0.0, (float) ($fiHeader->tax ?? 0));
        $headerDpp = max(0.0, $headerTotal - $headerTax);

        $cashNominal = max(0.0, $cashNominal);
        $ratio = ($headerTotal > 0) ? min(1.0, max(0.0, $cashNominal / $headerTotal)) : 1.0;

        return [
            'cash' => $cashNominal,
            'dpp' => round($headerDpp * $ratio, 2),
            'tax' => round($headerTax * $ratio, 2),
        ];
    }

    private function buildVendorKey(?string $vendor): string
    {
        $vendor = strtolower(trim((string) $vendor));
        $vendor = preg_replace('/\\s+/', ' ', $vendor);
        return $vendor;
    }

    private function suggestFromHistory(string $vendorKey, bool $hasPpn, float $dppTarget, float $taxTarget): array
    {
        $result = [
            'kode_akun' => '',
            'voucher_type' => '',
            'ppn_akun' => '',
            'beban_lines' => [],
        ];

        if (!$this->kasBreakdownAvailable()) {
            return $result;
        }

        // Prefer history where keterangan starts with "Pembelian/FI" and contains vendor text.
        $base = DB::table('tb_kas as k')
            ->where('k.Keterangan', 'like', 'Pembelian/FI %');

        if ($vendorKey !== '') {
            $base->whereRaw('LOWER(k.Keterangan) like ?', ['%' . $vendorKey . '%']);
        }

        $rows = (clone $base)
            ->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(60)
            ->get([
                'k.Kode_Akun',
                'k.Kode_Voucher',
                'k.Kode_Akun1',
                'k.Nominal1',
                'k.Jenis_Beban1',
                'k.Kode_Akun2',
                'k.Nominal2',
                'k.Jenis_Beban2',
                'k.Kode_Akun3',
                'k.Nominal3',
                'k.Jenis_Beban3',
            ]);

        // Cash/bank account & voucher type suggestion.
        $cashCounts = [];
        $typeCounts = [];
        foreach ($rows as $r) {
            $kodeKas = trim((string) ($r->Kode_Akun ?? ''));
            if ($kodeKas !== '') {
                $cashCounts[$kodeKas] = ($cashCounts[$kodeKas] ?? 0) + 1;
            }
            $kv = trim((string) ($r->Kode_Voucher ?? ''));
            if ($kv !== '') {
                if (str_contains($kv, '/GV/')) $typeCounts['GV'] = ($typeCounts['GV'] ?? 0) + 1;
                if (str_contains($kv, '/BV/')) $typeCounts['BV'] = ($typeCounts['BV'] ?? 0) + 1;
            }
        }
        if (count($cashCounts)) {
            arsort($cashCounts);
            $result['kode_akun'] = (string) array_key_first($cashCounts);
        }
        if (count($typeCounts)) {
            arsort($typeCounts);
            $result['voucher_type'] = (string) array_key_first($typeCounts);
        }

        $nabbWeights = $this->getNaBBAccountWeights();

        // PPN account suggestion: most frequent Kode_Akun2 where Nominal2 > 0.
        if ($hasPpn && $taxTarget > 0) {
            $ppnCounts = [];
            foreach ($rows as $r) {
                $kode2 = trim((string) ($r->Kode_Akun2 ?? ''));
                $nom2 = (float) ($r->Nominal2 ?? 0);
                if ($kode2 === '') continue;
                if ($nom2 > 0) {
                    $ppnCounts[$kode2] = ($ppnCounts[$kode2] ?? 0) + 1;
                }
            }
            if (count($ppnCounts)) {
                $ranked = $this->rankAccountsWithNaBB($ppnCounts, $nabbWeights, 1);
                $result['ppn_akun'] = (string) ($ranked[0] ?? '');
            }
        }

        // Beban suggestion:
        // - If has PPN: use patterns of (slot1 + slot3) from history where slot2 is PPN-like.
        // - Else: use most common up to 3 accounts across slots 1..3.
        if ($dppTarget <= 0) {
            return $result;
        }

        $patterns = [];
        foreach ($rows as $r) {
            $a1 = trim((string) ($r->Kode_Akun1 ?? ''));
            $a2 = trim((string) ($r->Kode_Akun2 ?? ''));
            $a3 = trim((string) ($r->Kode_Akun3 ?? ''));
            $n1 = (float) ($r->Nominal1 ?? 0);
            $n2 = (float) ($r->Nominal2 ?? 0);
            $n3 = (float) ($r->Nominal3 ?? 0);
            $j1 = trim((string) ($r->Jenis_Beban1 ?? ''));
            $j2 = trim((string) ($r->Jenis_Beban2 ?? ''));
            $j3 = trim((string) ($r->Jenis_Beban3 ?? ''));

            if ($hasPpn) {
                if ($a1 === '' || $a3 === '') continue;
                $isPpnLike = $n2 > 0;
                if (!$isPpnLike) continue;

                $sum = $n1 + $n3;
                if ($sum <= 0) continue;
                $key = $a1 . '|' . $a3;
                $patterns[$key] = $patterns[$key] ?? [
                    'count' => 0,
                    'a1' => $a1,
                    'a3' => $a3,
                    'r1' => 0,
                    'r3' => 0,
                    'j1' => $j1,
                    'j3' => $j3,
                    'bonus' => 0.0,
                ];
                $patterns[$key]['count']++;
                $patterns[$key]['r1'] += $n1 / $sum;
                $patterns[$key]['r3'] += $n3 / $sum;
                $patterns[$key]['bonus'] += (isset($nabbWeights[$a1]) ? 0.25 : 0.0) + (isset($nabbWeights[$a3]) ? 0.25 : 0.0);
            } else {
                $accounts = [];
                if ($a1 !== '' && $n1 > 0) $accounts[] = ['akun' => $a1, 'jenis' => $this->normalizeJenisBeban($j1), 'nom' => $n1];
                if ($a2 !== '' && $n2 > 0) $accounts[] = ['akun' => $a2, 'jenis' => $this->normalizeJenisBeban($j2), 'nom' => $n2];
                if ($a3 !== '' && $n3 > 0) $accounts[] = ['akun' => $a3, 'jenis' => $this->normalizeJenisBeban($j3), 'nom' => $n3];
                if (count($accounts) === 0) continue;

                // Normalize ratios across whatever lines exist
                $sum = array_sum(array_map(fn ($x) => (float) $x['nom'], $accounts));
                if ($sum <= 0) continue;
                $key = implode('|', array_map(fn ($x) => $x['akun'], $accounts));
                $patterns[$key] = $patterns[$key] ?? ['count' => 0, 'lines' => []];
                $patterns[$key]['count']++;
                foreach ($accounts as $idx => $a) {
                    $patterns[$key]['lines'][$idx] = $patterns[$key]['lines'][$idx] ?? [
                        'akun' => $a['akun'],
                        'jenis' => $a['jenis'],
                        'ratio' => 0,
                    ];
                    $patterns[$key]['lines'][$idx]['ratio'] += ((float) $a['nom']) / $sum;
                }
            }
        }

        if (count($patterns) === 0) {
            // Fallback: pick most frequent DPP account from history.
            $counts = [];
            foreach ($rows as $r) {
                $slots = $hasPpn ? [1, 3] : [1, 2, 3];
                foreach ($slots as $slot) {
                    $kode = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    $jenis = trim((string) ($r->{'Jenis_Beban' . $slot} ?? ''));
                    if ($kode === '' || $nom <= 0) continue;
                    $counts[$kode] = $counts[$kode] ?? ['count' => 0, 'jenis' => $jenis];
                    $counts[$kode]['count']++;
                    if ($counts[$kode]['jenis'] === '' && $jenis !== '') {
                        $counts[$kode]['jenis'] = $jenis;
                    }
                }
            }
            if (count($counts)) {
                $flat = [];
                foreach ($counts as $akun => $meta) {
                    $flat[(string) $akun] = (int) ($meta['count'] ?? 0);
                }
                $ranked = $this->rankAccountsWithNaBB($flat, $nabbWeights, 1);
                $akun = (string) ($ranked[0] ?? '');
                $jenis = $akun !== '' ? (string) ($counts[$akun]['jenis'] ?? '') : '';
                $result['beban_lines'] = [
                    ['akun' => $akun, 'jenis' => $jenis !== '' ? $this->normalizeJenisBeban($jenis) : 'Debit', 'nominal' => $dppTarget],
                ];
            } else {
                $result['beban_lines'] = [
                    ['akun' => '', 'jenis' => 'Debit', 'nominal' => $dppTarget],
                ];
            }
            return $result;
        }

        usort($patterns, function ($a, $b) {
            $sa = (float) (($a['count'] ?? 0) + ($a['bonus'] ?? 0));
            $sb = (float) (($b['count'] ?? 0) + ($b['bonus'] ?? 0));
            return $sb <=> $sa;
        });
        $best = array_values($patterns)[0];

        if ($hasPpn) {
            $r1 = ($best['count'] ?? 1) > 0 ? (($best['r1'] ?? 0) / ($best['count'] ?? 1)) : 0.7;
            $r3 = 1 - $r1;
            $n1 = round($dppTarget * $r1, 2);
            $n3 = round($dppTarget - $n1, 2);
            $result['beban_lines'] = [
                ['akun' => (string) ($best['a1'] ?? ''), 'jenis' => (string) ($best['j1'] ?? 'Debit'), 'nominal' => $n1],
                ['akun' => (string) ($best['a3'] ?? ''), 'jenis' => (string) ($best['j3'] ?? 'Debit'), 'nominal' => $n3],
            ];
            return $result;
        }

        $lines = [];
        $count = (int) ($best['count'] ?? 1);
        foreach (($best['lines'] ?? []) as $l) {
            $ratio = $count > 0 ? ((float) ($l['ratio'] ?? 0) / $count) : 0;
            $lines[] = [
                'akun' => (string) ($l['akun'] ?? ''),
                'jenis' => $this->normalizeJenisBeban((string) ($l['jenis'] ?? '')),
                'ratio' => $ratio,
            ];
        }
        if (count($lines) === 0) {
            $result['beban_lines'] = [
                ['akun' => '', 'jenis' => 'Debit', 'nominal' => $dppTarget],
            ];
            return $result;
        }

        // Allocate DPP by ratio, keep rounding consistent.
        $allocated = [];
        $running = 0.0;
        foreach ($lines as $i => $l) {
            $nom = $i === (count($lines) - 1)
                ? round($dppTarget - $running, 2)
                : round($dppTarget * (float) $l['ratio'], 2);
            $running += $nom;
            $allocated[] = [
                'akun' => $l['akun'],
                'jenis' => $this->normalizeJenisBeban((string) ($l['jenis'] ?? '')),
                'nominal' => $nom,
            ];
        }
        $result['beban_lines'] = $allocated;
        return $result;
    }

    private function getPoMaterialColumn(): ?string
    {
        if (!Schema::hasTable('tb_detailpo')) return null;
        if (Schema::hasColumn('tb_detailpo', 'kd_mat')) return 'kd_mat';
        if (Schema::hasColumn('tb_detailpo', 'no_material')) return 'no_material';
        if (Schema::hasColumn('tb_detailpo', 'material')) return 'material';
        return null;
    }

    private function fetchPoKeys(string $noPo): array
    {
        $col = $this->getPoMaterialColumn();
        if (!$col || trim($noPo) === '') return [];
        try {
            return DB::table('tb_detailpo')
                ->where('no_po', $noPo)
                ->whereNotNull($col)
                ->pluck($col)
                ->map(fn ($v) => strtolower(trim((string) $v)))
                ->filter()
                ->unique()
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function suggestFromPoDetail(string $vendorKey, string $refPo, bool $hasPpn, float $dppTarget, float $taxTarget): ?array
    {
        $poKeys = $this->fetchPoKeys($refPo);
        if (count($poKeys) === 0 || !$this->kasBreakdownAvailable()) {
            return null;
        }

        // Pull recent FI history (same vendor) that has been journaled.
        if (!Schema::hasTable('tb_kdinvin') || !Schema::hasColumn('tb_kdinvin', 'jurnal') || !Schema::hasColumn('tb_kdinvin', 'ref_po')) {
            return null;
        }

        $fiQ = DB::table('tb_kdinvin')
            ->whereRaw("TRIM(COALESCE(jurnal,'')) <> ''")
            ->whereNotNull('ref_po')
            ->whereRaw("TRIM(COALESCE(ref_po,'')) <> ''");

        if ($vendorKey !== '' && Schema::hasColumn('tb_kdinvin', 'nm_vdr')) {
            $fiQ->whereRaw('LOWER(nm_vdr) like ?', ['%' . $vendorKey . '%']);
        }

        $fiRows = $fiQ->orderByDesc('no_doc')->limit(120)->get(['ref_po', 'jurnal', 'tax', 'total']);
        if ($fiRows->count() === 0) return null;

        $voucherCodes = $fiRows->pluck('jurnal')->map(fn ($v) => trim((string) $v))->filter()->unique()->values()->all();
        $poNos = $fiRows->pluck('ref_po')->map(fn ($v) => trim((string) $v))->filter()->unique()->values()->all();
        if (count($voucherCodes) === 0 || count($poNos) === 0) return null;

        // Fetch kas breakdown by voucher.
        $kasByVoucher = DB::table('tb_kas')
            ->whereIn('Kode_Voucher', $voucherCodes)
            ->get([
                'Kode_Voucher',
                'Kode_Akun',
                'Kode_Akun1', 'Nominal1', 'Jenis_Beban1',
                'Kode_Akun2', 'Nominal2', 'Jenis_Beban2',
                'Kode_Akun3', 'Nominal3', 'Jenis_Beban3',
            ])
            ->keyBy('Kode_Voucher');

        if ($kasByVoucher->count() === 0) return null;

        // Fetch PO detail keys for those PO numbers and group by PO.
        $col = $this->getPoMaterialColumn();
        if (!$col) return null;

        $detailRows = DB::table('tb_detailpo')
            ->whereIn('no_po', $poNos)
            ->whereNotNull($col)
            ->get(['no_po', $col]);

        $poKeyMap = [];
        foreach ($detailRows as $dr) {
            $po = trim((string) ($dr->no_po ?? ''));
            $key = strtolower(trim((string) ($dr->{$col} ?? '')));
            if ($po === '' || $key === '') continue;
            $poKeyMap[$po] = $poKeyMap[$po] ?? [];
            $poKeyMap[$po][$key] = true;
        }

        // Vote accounts by overlapping material keys.
        $accountVotes = [];
        $ppnCounts = [];
        $cashCounts = [];
        $typeCounts = [];
        $nabbWeights = $this->getNaBBAccountWeights();

        foreach ($fiRows as $fi) {
            $po = trim((string) ($fi->ref_po ?? ''));
            $voucher = trim((string) ($fi->jurnal ?? ''));
            if ($po === '' || $voucher === '') continue;
            if (!isset($poKeyMap[$po])) continue;

            // overlap?
            $overlap = 0;
            foreach ($poKeys as $k) {
                if (isset($poKeyMap[$po][$k])) $overlap++;
            }
            if ($overlap === 0) continue;

            $kas = $kasByVoucher[$voucher] ?? null;
            if (!$kas) continue;

            // Determine whether that historical voucher likely had PPN.
            $histTax = max(0.0, (float) ($fi->tax ?? 0));
            $histHasPpn = $histTax > 0 || ((float) ($kas->Nominal2 ?? 0) > 0);

            $kodeKas = trim((string) ($kas->Kode_Akun ?? ''));
            if ($kodeKas !== '') {
                $cashCounts[$kodeKas] = ($cashCounts[$kodeKas] ?? 0) + $overlap;
            }
            if (str_contains($voucher, '/GV/')) $typeCounts['GV'] = ($typeCounts['GV'] ?? 0) + $overlap;
            if (str_contains($voucher, '/BV/')) $typeCounts['BV'] = ($typeCounts['BV'] ?? 0) + $overlap;

            // PPN account vote (slot2).
            if ($hasPpn && $histHasPpn) {
                $kode2 = trim((string) ($kas->Kode_Akun2 ?? ''));
                if ($kode2 !== '') {
                    $ppnCounts[$kode2] = ($ppnCounts[$kode2] ?? 0) + $overlap;
                }
            }

            // DPP accounts: follow company standard mapping (slot2 reserved for PPN when exists).
            $dppSlots = $histHasPpn ? [1, 3] : [1, 2, 3];
            foreach ($dppSlots as $slot) {
                $kode = trim((string) ($kas->{'Kode_Akun' . $slot} ?? ''));
                $nom = (float) ($kas->{'Nominal' . $slot} ?? 0);
                $jenis = trim((string) ($kas->{'Jenis_Beban' . $slot} ?? ''));
                if ($kode === '' || $nom <= 0) continue;
                $accountVotes[$kode] = $accountVotes[$kode] ?? [
                    'score' => 0,
                    'jenis' => $this->normalizeJenisBeban($jenis),
                ];
                $accountVotes[$kode]['score'] += $overlap;
                if ($accountVotes[$kode]['jenis'] === '' && $jenis !== '') {
                    $accountVotes[$kode]['jenis'] = $this->normalizeJenisBeban($jenis);
                }
            }
        }

        if (count($accountVotes) === 0) return null;

        $ranked = [];
        foreach ($accountVotes as $akun => $meta) {
            $bonus = isset($nabbWeights[(string) $akun]) ? 0.25 : 0.0;
            $ranked[] = [
                'akun' => (string) $akun,
                'score' => (float) ($meta['score'] ?? 0) + $bonus,
                'jenis' => (string) ($meta['jenis'] ?? ''),
            ];
        }
        usort($ranked, fn ($a, $b) => ($b['score'] <=> $a['score']));
        $maxLines = $hasPpn && $taxTarget > 0 ? 2 : 3;
        $top = array_slice($ranked, 0, $maxLines);

        // Even split DPP across selected accounts if we don't have ratios.
        $lines = [];
        $remaining = $dppTarget;
        foreach ($top as $i => $row) {
            $nom = $i === (count($top) - 1) ? round($remaining, 2) : round($dppTarget / count($top), 2);
            $remaining = round($remaining - $nom, 2);
            $jenis = (string) ($row['jenis'] ?? '');
            $lines[] = [
                'akun' => (string) ($row['akun'] ?? ''),
                'jenis' => $jenis !== '' ? $this->normalizeJenisBeban($jenis) : 'Debit',
                'nominal' => $nom,
            ];
        }

        $ppnAkun = '';
        if ($hasPpn && $taxTarget > 0 && count($ppnCounts)) {
            $rankedPpn = $this->rankAccountsWithNaBB($ppnCounts, $nabbWeights, 1);
            $ppnAkun = (string) ($rankedPpn[0] ?? '');
        }

        $kodeAkun = '';
        if (count($cashCounts)) {
            arsort($cashCounts);
            $kodeAkun = (string) array_key_first($cashCounts);
        }
        $voucherType = '';
        if (count($typeCounts)) {
            arsort($typeCounts);
            $voucherType = (string) array_key_first($typeCounts);
        }

        return [
            'kode_akun' => $kodeAkun,
            'voucher_type' => $voucherType,
            'ppn_akun' => $ppnAkun,
            'beban_lines' => $lines,
        ];
    }

    public function suggest(Request $request, string $noDoc)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['error' => 'Tabel tb_kdinvin tidak ditemukan.'], 500);
            }
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $fi = DB::table('tb_kdinvin')->where('no_doc', $noDoc)->first();
            if (!$fi) {
                return response()->json(['error' => 'FI tidak ditemukan.'], 404);
            }

            $cashNominal = $request->query('nominal');
            $cashNominal = $cashNominal === null || $cashNominal === '' ? null : (float) $cashNominal;
            if ($cashNominal === null) {
                $cashNominal = (float) (($fi->pembayaran ?? 0) > 0 ? $fi->pembayaran : ($fi->total ?? 0));
            }

            $alloc = $this->computeAllocation($fi, (float) $cashNominal);
            $vendorKey = $this->buildVendorKey((string) ($fi->nm_vdr ?? ''));

            $hasPpn = ($alloc['tax'] ?? 0) > 0;
            $refPo = trim((string) ($fi->ref_po ?? ''));
            $poSuggest = $refPo !== '' ? $this->suggestFromPoDetail($vendorKey, $refPo, $hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0)) : null;
            $invSuggest = $this->suggestFromInvoiceHistory($vendorKey, $hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));
            $suggest = $poSuggest
                ?? $invSuggest
                ?? $this->suggestFromHistory($vendorKey, $hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));

            if ($hasPpn && trim((string) ($suggest['ppn_akun'] ?? '')) === '') {
                $suggest['ppn_akun'] = $this->getDefaultPpnAccount();
            }

            $lines = is_array($suggest['beban_lines'] ?? null) ? $suggest['beban_lines'] : [];
            $needsDefaultLines = count($lines) === 0;
            if (!$needsDefaultLines) {
                foreach ($lines as $l) {
                    $akun = trim((string) ($l['akun'] ?? ''));
                    if ($akun === '') {
                        $needsDefaultLines = true;
                        break;
                    }
                }
            }
            if ($needsDefaultLines) {
                $suggest['beban_lines'] = $this->buildDefaultDppLines($hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));
            }

            // Final fallback: ensure akun beban tidak kosong agar user tidak perlu pilih manual.
            $fallbackExpense = $this->getFallbackExpenseAccount();
            if ($fallbackExpense !== '') {
                $filled = [];
                foreach (($suggest['beban_lines'] ?? []) as $l) {
                    $akun = trim((string) ($l['akun'] ?? ''));
                    $filled[] = [
                        'akun' => $akun !== '' ? $akun : $fallbackExpense,
                        'jenis' => $this->normalizeJenisBeban((string) ($l['jenis'] ?? '')),
                        'nominal' => (float) ($l['nominal'] ?? 0),
                    ];
                }
                $suggest['beban_lines'] = $filled;
            }

            return response()->json([
                'allocation' => $alloc,
                'kode_akun' => (string) ($suggest['kode_akun'] ?? ''),
                'voucher_type' => (string) ($suggest['voucher_type'] ?? ''),
                'ppn_akun' => (string) ($suggest['ppn_akun'] ?? ''),
                'beban_lines' => $suggest['beban_lines'] ?? [],
                'keterangan' => $this->suggestKeterangan($fi),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'no_doc' => ['required', 'string'],
            'kode_akun' => ['required', 'string'],
            'tgl_voucher' => ['required', 'date'],
            'voucher_type' => ['nullable', 'string'],
            'ppn_akun' => ['nullable', 'string'],
            'beban_lines' => ['required', 'array', 'min:1', 'max:3'],
            'beban_lines.*.akun' => ['required', 'string'],
            'beban_lines.*.jenis' => ['nullable', 'string'],
            'beban_lines.*.nominal' => ['required', 'numeric', 'min:0'],
            'keterangan' => ['nullable', 'string'],
            'nominal' => ['nullable', 'numeric'],
        ]);

        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return redirect()->back()->with('error', 'Tabel tb_kdinvin tidak ditemukan.');
            }
            if (!Schema::hasTable('tb_kas')) {
                return redirect()->back()->with('error', 'Tabel tb_kas tidak ditemukan.');
            }

            $kasCols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan.");
                }
            }
            // Breakdown wajib untuk standar akuntansi (beban + PPN).
            foreach (['Kode_Akun1', 'Nominal1', 'Kode_Akun2', 'Nominal2', 'Kode_Akun3', 'Nominal3'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan (dibutuhkan untuk Beban Akun).");
                }
            }

            $header = DB::table('tb_kdinvin')->where('no_doc', $payload['no_doc'])->first();
            if (!$header) {
                return redirect()->back()->with('error', 'Data pembelian (FI) tidak ditemukan.');
            }

            $existingJurnal = trim((string) ($header->jurnal ?? ''));
            if ($existingJurnal !== '') {
                return redirect()->back()->with('error', 'FI ini sudah dijurnal: ' . $existingJurnal);
            }

            $kodeAkun = (string) $payload['kode_akun'];
            $ppnAkun = trim((string) ($payload['ppn_akun'] ?? ''));
            $bebanLines = is_array($payload['beban_lines'] ?? null) ? $payload['beban_lines'] : [];
            $tglVoucher = Carbon::parse($payload['tgl_voucher'])->toDateString();

            $nominal = array_key_exists('nominal', $payload) && $payload['nominal'] !== null
                ? (float) $payload['nominal']
                : (float) (($header->pembayaran ?? 0) > 0 ? $header->pembayaran : ($header->total ?? 0));
            $nominal = max(0.0, $nominal);

            if ($nominal <= 0) {
                return redirect()->back()->with('error', 'Nominal harus > 0.');
            }

            $headerTotal = (float) ($header->total ?? 0);
            $headerTax = (float) ($header->tax ?? 0);
            $headerTax = max(0.0, $headerTax);
            $headerDpp = max(0.0, $headerTotal - $headerTax);

            // If payment is partial, allocate proportionally.
            $ratio = ($headerTotal > 0) ? min(1.0, max(0.0, $nominal / $headerTotal)) : 1.0;
            $dppNominal = round($headerDpp * $ratio, 2);
            $taxNominal = round($headerTax * $ratio, 2);

            if ($taxNominal > 0 && $ppnAkun === '') {
                return redirect()->back()->with('error', 'Akun PPN wajib diisi karena FI memiliki PPN.');
            }

            // Validasi beban lines: total beban harus sama dengan DPP (alokasi proporsional bila bayar parsial).
            $sumBeban = 0.0;
            $cleanBeban = [];
            foreach ($bebanLines as $line) {
                $akun = trim((string) ($line['akun'] ?? ''));
                $jenis = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                $nom = (float) ($line['nominal'] ?? 0);
                if ($akun === '') {
                    return redirect()->back()->with('error', 'Akun beban wajib dipilih.');
                }
                if ($nom < 0) {
                    return redirect()->back()->with('error', 'Nominal beban tidak boleh negatif.');
                }
                $sumBeban += $nom;
                $cleanBeban[] = ['akun' => $akun, 'jenis' => $jenis, 'nominal' => $nom];
            }

            $sumBeban = round($sumBeban, 2);
            if (round($dppNominal, 2) !== $sumBeban) {
                return redirect()->back()->with('error', 'Total beban (DPP) harus sama dengan DPP: ' . $dppNominal);
            }

            // Standar perusahaan: PPN selalu di Kode_Akun2.
            if ($taxNominal > 0 && count($cleanBeban) > 2) {
                return redirect()->back()->with('error', 'Saat ada PPN, maksimal beban DPP adalah 2 baris (karena Kode_Akun2 dipakai untuk PPN).');
            }

            $keterangan = trim((string) ($payload['keterangan'] ?? ''));
            if ($keterangan === '') {
                $vendor = trim((string) ($header->nm_vdr ?? ''));
                $refPo = trim((string) ($header->ref_po ?? ''));
                $keterangan = 'Pembelian/FI ' . (string) $header->no_doc
                    . ($vendor !== '' ? (' — ' . $vendor) : '')
                    . ($refPo !== '' ? (' (PO ' . $refPo . ')') : '');
            }

            return DB::transaction(function () use ($request, $kasCols, $kodeAkun, $ppnAkun, $cleanBeban, $tglVoucher, $nominal, $taxNominal, $keterangan, $header) {
                $dbCode = $this->getDatabaseCode($request);
                $voucherType = strtoupper(trim((string) $request->input('voucher_type', '')));
                $voucherType = in_array($voucherType, ['GV', 'BV'], true) ? $voucherType : $this->guessVoucherType($kodeAkun);

                $prefix = $dbCode . '/' . $voucherType . '/';
                $last = '';
                if (Schema::hasTable('tb_kas') && Schema::hasColumn('tb_kas', 'Kode_Voucher')) {
                    $last = (string) (DB::table('tb_kas')
                        ->where('Kode_Voucher', 'like', $prefix . '%')
                        ->orderByDesc('Kode_Voucher')
                        ->value('Kode_Voucher') ?? '');
                }

                $seq = 0;
                if ($last !== '' && str_starts_with($last, $prefix)) {
                    $tail = substr($last, strlen($prefix));
                    if (preg_match('/^\\d{8}$/', $tail)) {
                        $seq = (int) $tail;
                    }
                }

                $seq++;
                $kodeVoucher = $prefix . str_pad((string) $seq, 8, '0', STR_PAD_LEFT);

                $lastRow = DB::table('tb_kas')
                    ->where('Kode_Akun', $kodeAkun)
                    ->orderByDesc('Tgl_Voucher')
                    ->orderByDesc('Kode_Voucher')
                    ->select(['Saldo'])
                    ->first();

                $lastSaldo = (float) ($lastRow->Saldo ?? 0);
                $mutasi = -1 * abs($nominal);
                $saldo = $lastSaldo + $mutasi;

                $row = [
                    'Kode_Voucher' => $kodeVoucher,
                    'Kode_Akun' => $kodeAkun,
                    'Tgl_Voucher' => $tglVoucher,
                    'Keterangan' => $keterangan,
                    'Mutasi_Kas' => $mutasi,
                    'Saldo' => $saldo,
                ];

                if (in_array('Tgl_Buat', $kasCols, true)) {
                    $row['Tgl_Buat'] = Carbon::now()->toDateString();
                }

                // Breakdown mengikuti pola BukuKasController.
                // Standar perusahaan: PPN selalu di slot 2 (Kode_Akun2/Nominal2).
                // Beban DPP:
                // - Jika ada PPN: beban[0] -> slot1, beban[1] -> slot3
                // - Jika tidak ada PPN: beban[0] -> slot1, beban[1] -> slot2, beban[2] -> slot3
                $hasB1 = in_array('Kode_Akun1', $kasCols, true) && in_array('Nominal1', $kasCols, true);
                $hasB2 = in_array('Kode_Akun2', $kasCols, true) && in_array('Nominal2', $kasCols, true);
                $hasB3 = in_array('Kode_Akun3', $kasCols, true) && in_array('Nominal3', $kasCols, true);
                $hasJ1 = in_array('Jenis_Beban1', $kasCols, true);
                $hasJ2 = in_array('Jenis_Beban2', $kasCols, true);
                $hasJ3 = in_array('Jenis_Beban3', $kasCols, true);

                $assign = function (int $slot, array $line) use (&$row, $hasB1, $hasB2, $hasB3, $hasJ1, $hasJ2, $hasJ3) {
                    $kodeKey = 'Kode_Akun' . $slot;
                    $nomKey = 'Nominal' . $slot;
                    $jenisKey = 'Jenis_Beban' . $slot;
                    $hasB = $slot === 1 ? $hasB1 : ($slot === 2 ? $hasB2 : $hasB3);
                    $hasJ = $slot === 1 ? $hasJ1 : ($slot === 2 ? $hasJ2 : $hasJ3);
                    if ($hasB) {
                        $row[$kodeKey] = (string) $line['akun'];
                        $row[$nomKey] = (float) $line['nominal'];
                    }
                    if ($hasJ) {
                        $row[$jenisKey] = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                    }
                };

                if ($taxNominal > 0) {
                    if (isset($cleanBeban[0])) $assign(1, $cleanBeban[0]);
                    if (isset($cleanBeban[1])) $assign(3, $cleanBeban[1]);

                if ($ppnAkun !== '' && $hasB2) {
                    $row['Kode_Akun2'] = $ppnAkun;
                    $row['Nominal2'] = (float) $taxNominal;
                }
                if ($hasJ2) {
                    $row['Jenis_Beban2'] = 'Debit';
                }
                } else {
                    if (isset($cleanBeban[0])) $assign(1, $cleanBeban[0]);
                    if (isset($cleanBeban[1])) $assign(2, $cleanBeban[1]);
                    if (isset($cleanBeban[2])) $assign(3, $cleanBeban[2]);
                }

                DB::table('tb_kas')->insert($row);

                if (Schema::hasColumn('tb_kdinvin', 'jurnal')) {
                    DB::table('tb_kdinvin')
                        ->where('no_doc', (string) $header->no_doc)
                        ->update(['jurnal' => $kodeVoucher]);
                }

                return redirect()
                    ->route('keuangan.input-pembelian.index', [
                        'account' => $kodeAkun,
                        'period' => Carbon::parse($tglVoucher)->format('Ym'),
                        'search' => $kodeVoucher,
                    ])
                    ->with('success', 'Berhasil simpan ke Buku Kas: ' . $kodeVoucher);
            });
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
