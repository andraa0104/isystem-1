<?php

namespace App\Http\Controllers\Keuangan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use App\Services\Keuangan\KasDss\KasDss;

class InputPenjualanController
{
    private function normalizeJenisBeban(?string $jenis): string
    {
        $j = strtoupper(trim((string) $jenis));
        return $j === 'DEBIT' ? 'Debit' : 'Kredit';
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
        // Updated requirement: do not use tb_nabbrekap weighting; DSS learns from tb_kas + tb_jurnal/tb_jurnaldetail.
        return [];

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
            $bonus = isset($weights[$a]) ? 0.25 : 0.0;
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

    private function getTopAccountsFromJurnal(string $customerKey, string $flow, int $limit): array
    {
        $limit = max(1, min(10, $limit));
        if (!$this->jurnalAvailable()) return [];

        $flow = strtolower($flow) === 'debit' ? 'debit' : 'kredit';
        $hasRemark = Schema::hasColumn('tb_jurnal', 'Remark');
        $hasVoucher = Schema::hasColumn('tb_jurnal', 'Kode_Voucher');

        try {
            $q = DB::table('tb_jurnal as j')
                ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [
                    Carbon::now()->subYears(3)->toDateString(),
                    Carbon::now()->toDateString(),
                ]);

            if ($customerKey !== '' && $hasRemark) {
                $q->whereRaw('LOWER(j.Remark) like ?', ['%' . $customerKey . '%']);
            }
            if ($customerKey !== '' && !$hasRemark && $hasVoucher) {
                $q->whereRaw('LOWER(j.Kode_Voucher) like ?', ['%' . $customerKey . '%']);
            }

            $expr = $flow === 'debit' ? 'COALESCE(d.Debit,0)' : 'COALESCE(d.Kredit,0)';
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

    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
    }

    private function getDatabaseCode(Request $request): string
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');

        $db = is_string($database) ? trim($database) : '';
        if ($db === '') return 'SJA';

        $db = preg_replace('/[^a-zA-Z0-9]/', '', $db);
        $db = preg_replace('/^db/i', '', $db);
        $db = strtoupper($db);

        return $db !== '' ? $db : 'SJA';
    }

    private function guessVoucherType(string $kodeAkun): string
    {
        return (new KasDss())->voucherTypeForAkun($kodeAkun);
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

    private function getFallbackRevenueAccount(): string
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            $top = $this->getTopAccountsFromJurnal('', 'kredit', 1);
            return $top[0] ?? '';
        }

        try {
            $rev = (string) (DB::table('tb_nabb')
                ->whereNotNull('Kode_Akun')
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) LIKE '41%'")
                ->orderBy('Kode_Akun', 'asc')
                ->value('Kode_Akun') ?? '');
            $rev = trim($rev);
            if ($rev !== '') return $rev;

            $any = (string) (DB::table('tb_nabb')
                ->whereNotNull('Kode_Akun')
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) NOT LIKE '11%'")
                ->orderBy('Kode_Akun', 'asc')
                ->value('Kode_Akun') ?? '');

            return trim($any);
        } catch (\Throwable) {
            $top = $this->getTopAccountsFromJurnal('', 'kredit', 1);
            return $top[0] ?? '';
        }
    }

    private function buildDefaultRevenueLines(bool $hasPpn, float $dppTarget, float $taxTarget): array
    {
        if ($dppTarget <= 0) {
            return [];
        }
        $akun = $this->getFallbackRevenueAccount();
        if ($akun === '') {
            return [
                ['akun' => '', 'jenis' => 'Kredit', 'nominal' => $dppTarget],
            ];
        }

        // Default: use single revenue line (avoid duplicate akun across slot 1/3).
        return [
            ['akun' => $akun, 'jenis' => 'Kredit', 'nominal' => $dppTarget],
        ];
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

    private function getGlAccountOptions(): array
    {
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

        return $this->getAccountOptions();
    }

    public function index(Request $request)
    {
        return Inertia::render('Keuangan/input-penjualan/index', [
            'filters' => [
                'search' => (string) $request->query('search', ''),
                'account' => (string) $request->query('account', 'all'),
                'period' => (string) $request->query('period', Carbon::now()->format('Ym')),
                'pageSize' => (int) $request->query('pageSize', 10),
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $this->getDefaultAccount(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Keuangan/input-penjualan/create', [
            'filters' => [
                'search' => '',
                'status' => 'all',
                'pageSize' => 10,
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $this->getDefaultAccount(),
            'glAccountOptions' => $this->getGlAccountOptions(),
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

            // Penjualan: voucher type GV/BV + keterangan terkait faktur.
            $q->where(function ($qq) {
                $qq->where('k.Kode_Voucher', 'like', '%/CV/%')
                    ->orWhere('k.Kode_Voucher', 'like', '%/GV/%')
                    ->orWhere('k.Kode_Voucher', 'like', '%/BV/%')
                    ->orWhere('k.Kode_Voucher', 'like', 'CV%')
                    ->orWhere('k.Kode_Voucher', 'like', 'GV%')
                    ->orWhere('k.Kode_Voucher', 'like', 'BV%');
            });
            $q->where(function ($qq) {
                $qq->where('k.Keterangan', 'like', '%Penjualan%')
                    ->orWhere('k.Keterangan', 'like', '%INV-%');
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

            $rows = $q->limit(2000)->get($this->buildKasSelect());

            return response()->json(['rows' => $rows, 'total' => $total]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function invoiceRows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kdfakturpenjualan')) {
                return response()->json(['rows' => [], 'total' => 0, 'error' => 'Tabel tb_kdfakturpenjualan tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $pageSizeRaw = $request->query('pageSize', 10);
            $pageRaw = $request->query('page', 1);
            $page = max(1, (int) $pageRaw);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

            $q = DB::table('tb_kdfakturpenjualan');
            if ($search !== '') {
                $term = '%' . $search . '%';
                $q->where(function ($qq) use ($term) {
                    $qq->where('no_fakturpenjualan', 'like', $term)
                        ->orWhere('nm_cs', 'like', $term)
                        ->orWhere('ref_po', 'like', $term);
                });
            }

            $total = (int) (clone $q)->count();
            $q->orderByDesc('no_fakturpenjualan');
            if ($pageSize !== 'all') {
                $q->forPage($page, $pageSize);
            }

            $cols = Schema::getColumnListing('tb_kdfakturpenjualan');
            $select = array_values(array_filter([
                in_array('no_fakturpenjualan', $cols, true) ? 'no_fakturpenjualan' : null,
                in_array('tgl_doc', $cols, true) ? 'tgl_doc' : null,
                in_array('nm_cs', $cols, true) ? 'nm_cs' : null,
                in_array('ref_po', $cols, true) ? 'ref_po' : null,
                in_array('ppn', $cols, true) ? 'ppn' : null,
                in_array('harga', $cols, true) ? 'harga' : null,
                in_array('h_ppn', $cols, true) ? 'h_ppn' : null,
                in_array('g_total', $cols, true) ? 'g_total' : null,
                in_array('saldo_piutang', $cols, true) ? 'saldo_piutang' : null,
                in_array('total_bayaran', $cols, true) ? 'total_bayaran' : null,
            ]));

            if (count($select) === 0) {
                // fallback: select all
                $select = ['*'];
            }

            return response()->json(['rows' => $q->get($select), 'total' => $total]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function invoiceDetail(string $noFaktur)
    {
        try {
            if (!Schema::hasTable('tb_kdfakturpenjualan')) {
                return response()->json(['header' => null, 'items' => [], 'error' => 'Tabel tb_kdfakturpenjualan tidak ditemukan.'], 404);
            }

            $header = DB::table('tb_kdfakturpenjualan')->where('no_fakturpenjualan', $noFaktur)->first();
            if (!$header) {
                return response()->json(['header' => null, 'items' => [], 'error' => 'Faktur tidak ditemukan.'], 404);
            }

            $items = [];
            if (Schema::hasTable('tb_fakturpenjualan') && Schema::hasColumn('tb_fakturpenjualan', 'no_fakturpenjualan')) {
                $items = DB::table('tb_fakturpenjualan')
                    ->where('no_fakturpenjualan', $noFaktur)
                    ->orderBy('no')
                    ->limit(2000)
                    ->get();
            }

            return response()->json([
                'header' => [
                    'no_fakturpenjualan' => (string) ($header->no_fakturpenjualan ?? ''),
                    'tgl_doc' => (string) ($header->tgl_doc ?? ''),
                    'nm_cs' => (string) ($header->nm_cs ?? ''),
                    'ref_po' => (string) ($header->ref_po ?? ''),
                    'ppn' => (string) ($header->ppn ?? ''),
                    'harga' => (float) ($header->harga ?? 0),
                    'h_ppn' => (float) ($header->h_ppn ?? 0),
                    'g_total' => (float) ($header->g_total ?? 0),
                    'saldo_piutang' => (float) ($header->saldo_piutang ?? 0),
                    'total_bayaran' => (float) ($header->total_bayaran ?? 0),
                ],
                'items' => $items,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['header' => null, 'items' => [], 'error' => $e->getMessage()], 500);
        }
    }

    private function computeAllocation(object $header, float $cashNominal): array
    {
        $total = (float) ($header->g_total ?? 0);
        $tax = max(0.0, (float) ($header->h_ppn ?? 0));
        $dpp = max(0.0, $total - $tax);

        $cashNominal = max(0.0, $cashNominal);
        $ratio = ($total > 0) ? min(1.0, max(0.0, $cashNominal / $total)) : 1.0;

        return [
            'cash' => $cashNominal,
            'dpp' => round($dpp * $ratio, 2),
            'tax' => round($tax * $ratio, 2),
        ];
    }

    private function getDefaultPpnKeluaranAccount(): string
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

    private function suggestFromHistory(string $customerKey, bool $hasPpn, float $dppTarget, float $taxTarget): array
    {
        $result = [
            'kode_akun' => '',
            'voucher_type' => '',
            'ppn_akun' => '',
            'beban_lines' => [],
            'keterangan' => '',
        ];

        if (!$this->kasBreakdownAvailable()) {
            return $result;
        }

        $base = DB::table('tb_kas as k')
            ->where('k.Keterangan', 'like', '%Penjualan%');

        if ($customerKey !== '') {
            $base->whereRaw('LOWER(k.Keterangan) like ?', ['%' . $customerKey . '%']);
        }

        $rows = (clone $base)
            ->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(60)
            ->get([
                'k.Kode_Akun',
                'k.Kode_Voucher',
                'k.Keterangan',
                'k.Kode_Akun1', 'k.Nominal1', 'k.Jenis_Beban1',
                'k.Kode_Akun2', 'k.Nominal2', 'k.Jenis_Beban2',
                'k.Kode_Akun3', 'k.Nominal3', 'k.Jenis_Beban3',
            ]);

        $cashCounts = [];
        $typeCounts = [];
        foreach ($rows as $r) {
            $kodeKas = trim((string) ($r->Kode_Akun ?? ''));
            if ($kodeKas !== '') $cashCounts[$kodeKas] = ($cashCounts[$kodeKas] ?? 0) + 1;

            $kv = trim((string) ($r->Kode_Voucher ?? ''));
            if ($kv !== '') {
                if (str_contains($kv, '/CV/')) $typeCounts['CV'] = ($typeCounts['CV'] ?? 0) + 1;
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

        if ($hasPpn && $taxTarget > 0) {
            $ppnCounts = [];
            foreach ($rows as $r) {
                $kode2 = trim((string) ($r->Kode_Akun2 ?? ''));
                $nom2 = (float) ($r->Nominal2 ?? 0);
                if ($kode2 === '') continue;
                if ($nom2 > 0) $ppnCounts[$kode2] = ($ppnCounts[$kode2] ?? 0) + 1;
            }
            if (count($ppnCounts)) {
                $ranked = $this->rankAccountsWithNaBB($ppnCounts, $nabbWeights, 1);
                $result['ppn_akun'] = (string) ($ranked[0] ?? '');
            }
        }

        // Revenue breakdown suggestion: if has PPN, use slot1 + slot3; else slot1..3
        if ($dppTarget > 0) {
            $counts = [];
            $slots = $hasPpn ? [1, 3] : [1, 2, 3];
            foreach ($rows as $r) {
                foreach ($slots as $slot) {
                    $kode = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    $jenis = trim((string) ($r->{'Jenis_Beban' . $slot} ?? ''));
                    if ($kode === '' || $nom <= 0) continue;
                    $counts[$kode] = ($counts[$kode] ?? 0) + 1;
                    if (!isset($result['jenis_map'])) {
                        $result['jenis_map'] = [];
                    }
                    if (!isset($result['jenis_map'][$kode])) {
                        $result['jenis_map'][$kode] = $this->normalizeJenisBeban($jenis);
                    }
                }
            }

            if (count($counts)) {
                $limit = $hasPpn && $taxTarget > 0 ? 2 : 3;
                $top = $this->rankAccountsWithNaBB($counts, $nabbWeights, $limit);
                $running = 0.0;
                foreach ($top as $i => $akun) {
                    $nom = $i === (count($top) - 1)
                        ? round($dppTarget - $running, 2)
                        : round($dppTarget / count($top), 2);
                    $running += $nom;
                    $jenis = (string) (($result['jenis_map'][$akun] ?? '') ?: 'Kredit');
                    $result['beban_lines'][] = ['akun' => $akun, 'jenis' => $jenis, 'nominal' => $nom];
                }
            } else {
                $result['beban_lines'] = $this->buildDefaultRevenueLines($hasPpn, $dppTarget, $taxTarget);
            }
        }

        $bestKet = '';
        foreach ($rows as $r) {
            $ket = trim((string) ($r->Keterangan ?? ''));
            if ($ket === '') continue;
            $bestKet = $ket;
            break;
        }
        $result['keterangan'] = $bestKet;

        return $result;
    }

    private function suggestFromFakturHistory(string $customerKey, bool $hasPpn, float $dppTarget, float $taxTarget): ?array
    {
        if (!Schema::hasTable('tb_kdfakturpenjualan') || !Schema::hasColumn('tb_kdfakturpenjualan', 'trx_jurnal')) {
            return null;
        }
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Voucher')) {
            return null;
        }

        $q = DB::table('tb_kdfakturpenjualan as h')
            ->whereRaw("TRIM(COALESCE(h.trx_jurnal,'')) <> ''");

        if ($customerKey !== '' && Schema::hasColumn('tb_kdfakturpenjualan', 'nm_cs')) {
            $q->whereRaw('LOWER(h.nm_cs) like ?', ['%' . $customerKey . '%']);
        }

        $hist = $q->orderByDesc('h.no_fakturpenjualan')
            ->limit(120)
            ->get(['h.trx_jurnal', 'h.h_ppn', 'h.g_total']);

        if ($hist->count() === 0) return null;

        $vouchers = $hist->pluck('trx_jurnal')->map(fn ($v) => trim((string) $v))->filter()->unique()->values()->all();
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
        $revCounts = [];
        $jenisMap = [];

        foreach ($hist as $hrow) {
            $voucher = trim((string) ($hrow->trx_jurnal ?? ''));
            if ($voucher === '') continue;
            $kas = $kasRows[$voucher] ?? null;
            if (!$kas) continue;

            $kodeKas = trim((string) ($kas->Kode_Akun ?? ''));
            if ($kodeKas !== '') $cashCounts[$kodeKas] = ($cashCounts[$kodeKas] ?? 0) + 1;

            if (str_contains($voucher, '/CV/')) $typeCounts['CV'] = ($typeCounts['CV'] ?? 0) + 1;
            if (str_contains($voucher, '/GV/')) $typeCounts['GV'] = ($typeCounts['GV'] ?? 0) + 1;
            if (str_contains($voucher, '/BV/')) $typeCounts['BV'] = ($typeCounts['BV'] ?? 0) + 1;

            $histTax = max(0.0, (float) ($hrow->h_ppn ?? 0));
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
                $revCounts[$kode] = ($revCounts[$kode] ?? 0) + 1;
                if (!isset($jenisMap[$kode])) {
                    $jenisMap[$kode] = $this->normalizeJenisBeban($jenis);
                }
            }
        }

        if (count($revCounts) === 0) return null;

        $nabbWeights = $this->getNaBBAccountWeights();
        $limit = ($hasPpn && $taxTarget > 0) ? 2 : 3;
        $top = $this->rankAccountsWithNaBB($revCounts, $nabbWeights, $limit);
        $running = 0.0;
        $lines = [];
        foreach ($top as $i => $akun) {
            $nom = $i === (count($top) - 1)
                ? round($dppTarget - $running, 2)
                : round($dppTarget / count($top), 2);
            $running += $nom;
            $lines[] = [
                'akun' => $akun,
                'jenis' => (string) (($jenisMap[$akun] ?? '') ?: 'Kredit'),
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
            'keterangan' => '',
        ];
    }

    private function buildDefaultKeterangan(object $header): string
    {
        $no = trim((string) ($header->no_fakturpenjualan ?? ''));
        $cs = trim((string) ($header->nm_cs ?? ''));
        $ref = trim((string) ($header->ref_po ?? ''));
        $ket = 'Penjualan/INV ' . $no;
        if ($cs !== '') $ket .= ' — ' . $cs;
        if ($ref !== '') $ket .= ' (PO ' . $ref . ')';
        return $ket;
    }

    private function buildKeteranganTemplate(string $keterangan, object $header): string
    {
        $k = trim((string) $keterangan);
        if ($k === '') return '';

        $k = preg_replace('/\\s+/', ' ', $k) ?? $k;

        $no = trim((string) ($header->no_fakturpenjualan ?? ''));
        if ($no !== '') {
            $k = str_ireplace($no, '{INV}', $k);
        }

        // Generic invoice patterns (examples: SJA.INV-0016414, INV-0016414, SJA/INV/00001234)
        $k = preg_replace('/\\b[A-Z0-9]{2,8}[\\.\\/]INV[-\\/ ]?\\d{4,}\\b/i', '{INV}', $k) ?? $k;
        $k = preg_replace('/\\bINV[-\\/ ]?\\d{4,}\\b/i', '{INV}', $k) ?? $k;

        // PO placeholder
        $k = preg_replace('/\\bPO\\s*[-:]?\\s*[A-Z0-9\\.\\-\\/]+\\b/i', 'PO {PO}', $k) ?? $k;

        // Long numbers noise
        $k = preg_replace('/\\b\\d{5,}\\b/', '{#}', $k) ?? $k;

        return trim($k);
    }

    private function renderKeteranganFromTemplate(string $template, object $header): string
    {
        $no = trim((string) ($header->no_fakturpenjualan ?? ''));
        $cs = trim((string) ($header->nm_cs ?? ''));
        $ref = trim((string) ($header->ref_po ?? ''));

        $out = $template !== '' ? $template : $this->buildDefaultKeterangan($header);
        $out = str_replace('{INV}', $no !== '' ? $no : '{INV}', $out);
        $out = str_replace('{PO}', $ref !== '' ? $ref : '{PO}', $out);
        $out = preg_replace('/\\s+/', ' ', $out) ?? $out;

        // If template doesn't include customer but we have it, add to keep clarity.
        $low = strtolower($out);
        if ($cs !== '' && !str_contains($low, strtolower($cs)) && str_contains($low, 'penjualan')) {
            // Insert " — {CS}" after invoice number if possible.
            $out = preg_replace('/(Penjualan\\/INV\\s+[^\\s\\)]+)(.*)$/i', '$1 — ' . $cs . '$2', $out, 1) ?? $out;
        }

        return trim($out);
    }

    private function pickEvidenceText(array $evidence): string
    {
        foreach ($evidence as $ev) {
            if (!is_array($ev)) continue;
            $ket = trim((string) ($ev['Keterangan'] ?? ''));
            if ($ket !== '') return $ket;
            $remark = trim((string) ($ev['Remark'] ?? ''));
            if ($remark !== '') return $remark;
        }
        return '';
    }

    private function suggestKeteranganFromDss(object $header, array $dss, string $fallback): string
    {
        $no = trim((string) ($header->no_fakturpenjualan ?? ''));

        $evidence = is_array($dss['evidence'] ?? null) ? $dss['evidence'] : [];
        $bestText = $this->pickEvidenceText($evidence);

        // If faktur has an existing journal number (trx_jurnal), prefer its wording:
        // - If tb_jurnal has Kode_Voucher, try to pick tb_kas.Keterangan from that voucher.
        // - Otherwise, use tb_jurnal.Remark as evidence.
        $trxJurnal = trim((string) ($header->trx_jurnal ?? ''));
        if ($trxJurnal !== '' && Schema::hasTable('tb_jurnal') && Schema::hasColumn('tb_jurnal', 'Kode_Jurnal')) {
            $jCols = Schema::getColumnListing('tb_jurnal');
            $hasVoucher = in_array('Kode_Voucher', $jCols, true);
            $hasRemark = in_array('Remark', $jCols, true);

            try {
                $jr = DB::table('tb_jurnal')
                    ->where('Kode_Jurnal', $trxJurnal)
                    ->first([
                        $hasVoucher ? 'Kode_Voucher' : DB::raw("'' as Kode_Voucher"),
                        $hasRemark ? 'Remark' : DB::raw("'' as Remark"),
                    ]);

                if ($jr) {
                    $jVoucher = trim((string) ($jr->Kode_Voucher ?? ''));
                    $jRemark = trim((string) ($jr->Remark ?? ''));

                    if (
                        $jVoucher !== ''
                        && Schema::hasTable('tb_kas')
                        && Schema::hasColumn('tb_kas', 'Kode_Voucher')
                        && Schema::hasColumn('tb_kas', 'Keterangan')
                    ) {
                        try {
                            $ket = trim((string) (DB::table('tb_kas')->where('Kode_Voucher', $jVoucher)->value('Keterangan') ?? ''));
                            if ($ket !== '') {
                                $bestText = $ket;
                            }
                        } catch (\Throwable) {
                            // ignore
                        }
                    }

                    if ($bestText === '' && $jRemark !== '') {
                        $bestText = $jRemark;
                    }
                }
            } catch (\Throwable) {
                // ignore
            }
        }

        // Also accept DSS top keterangan if present.
        if ($bestText === '') {
            $bestText = trim((string) ($dss['keterangan'] ?? ''));
        }

        $tpl = $bestText !== '' ? $this->buildKeteranganTemplate($bestText, $header) : '';
        if ($tpl === '') {
            $tpl = $fallback !== '' ? $this->buildKeteranganTemplate($fallback, $header) : '';
        }

        $out = $this->renderKeteranganFromTemplate($tpl, $header);
        if ($out === '') $out = $fallback !== '' ? $fallback : $this->buildDefaultKeterangan($header);

        // Ensure invoice number is present for traceability, but do not discard DSS wording.
        if ($no !== '' && !str_contains(strtoupper($out), strtoupper($no))) {
            $out = trim($out);
            $out = $out !== '' ? ($out . ' — ' . $no) : $no;
        }
        return $out;
    }

    public function suggest(Request $request, string $noFaktur)
    {
        try {
            if (!Schema::hasTable('tb_kdfakturpenjualan')) {
                return response()->json(['error' => 'Tabel tb_kdfakturpenjualan tidak ditemukan.'], 500);
            }

            $header = DB::table('tb_kdfakturpenjualan')->where('no_fakturpenjualan', $noFaktur)->first();
            if (!$header) {
                return response()->json(['error' => 'Faktur tidak ditemukan.'], 404);
            }

            $cashNominal = $request->query('nominal');
            $cashNominal = $cashNominal === null || $cashNominal === '' ? null : (float) $cashNominal;
            if ($cashNominal === null) {
                $cashNominal = (float) (($header->total_bayaran ?? 0) > 0 ? $header->total_bayaran : ($header->g_total ?? 0));
            }

            $alloc = $this->computeAllocation($header, (float) $cashNominal);
            $customerKey = strtolower(trim((string) ($header->nm_cs ?? '')));
            $customerKey = preg_replace('/\\s+/', ' ', $customerKey);

            $hasPpn = ($alloc['tax'] ?? 0) > 0;
            $fakturSuggest = $this->suggestFromFakturHistory($customerKey, $hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));
            $suggest = $fakturSuggest
                ?? $this->suggestFromHistory($customerKey, $hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));
            $suggestSource = $fakturSuggest ? 'faktur' : 'kas';

            if ($hasPpn && trim((string) ($suggest['ppn_akun'] ?? '')) === '') {
                $suggest['ppn_akun'] = $this->getDefaultPpnKeluaranAccount();
            }

            $lines = is_array($suggest['beban_lines'] ?? null) ? $suggest['beban_lines'] : [];
            $needsDefaultLines = count($lines) === 0;
            if (!$needsDefaultLines) {
                foreach ($lines as $l) {
                    if (trim((string) ($l['akun'] ?? '')) === '') {
                        $needsDefaultLines = true;
                        break;
                    }
                }
            }
            if ($needsDefaultLines) {
                // Use journal (credit side) to find top revenue accounts if possible; fallback to tb_nabb.
                $top = $this->getTopAccountsFromJurnal($customerKey, 'kredit', $hasPpn && (float) ($alloc['tax'] ?? 0) > 0 ? 2 : 3);
                if (count($top)) {
                    $running = 0.0;
                    $linesOut = [];
                    foreach ($top as $i => $akun) {
                        $nom = $i === (count($top) - 1)
                            ? round((float) ($alloc['dpp'] ?? 0) - $running, 2)
                            : round(((float) ($alloc['dpp'] ?? 0)) / count($top), 2);
                        $running += $nom;
                        $linesOut[] = ['akun' => $akun, 'jenis' => 'Kredit', 'nominal' => $nom];
                    }
                    $suggest['beban_lines'] = $linesOut;
                } else {
                    $suggest['beban_lines'] = $this->buildDefaultRevenueLines($hasPpn, (float) ($alloc['dpp'] ?? 0), (float) ($alloc['tax'] ?? 0));
                }
            }

            if (trim((string) ($suggest['keterangan'] ?? '')) === '') {
                $suggest['keterangan'] = $this->buildDefaultKeterangan($header);
            }

            // DSS (generic) based on similarity of keterangan:
            // - learns from tb_kas (kNN) + tb_jurnal/tb_jurnaldetail fallback.
            $seedAkun = '';
            $seedFrom = is_array($suggest['beban_lines'] ?? null) ? $suggest['beban_lines'] : [];
            if (is_array($seedFrom) && count($seedFrom) > 0) {
                $seedAkun = trim((string) ($seedFrom[0]['akun'] ?? ''));
            }

            // Enrich internal DSS query using tb_kdfakturpenjualan fields (aligned with FakturPenjualanController).
            // IMPORTANT: keep it neutral (do not force "Penjualan/INV ..."), so DSS can pick the best wording for paid/lunas cases too.
            $ppnPct = '';
            if (Schema::hasColumn('tb_kdfakturpenjualan', 'ppn')) {
                $ppnPct = (string) ($header->ppn ?? '');
            }
            $keteranganForDss = trim(
                (string) ($header->no_fakturpenjualan ?? '') . ' '
                    . (string) ($header->nm_cs ?? '') . ' '
                    . (string) ($header->ref_po ?? '') . ' '
                    . (string) ($header->no_fakturpenjualan ?? '') . ' '
                    . (string) ($header->trx_jurnal ?? '') . ' '
                    . (string) ($header->no_kwitansi ?? '') . ' '
                    . $ppnPct
            );

            $dss = (new KasDss())->suggest([
                'mode' => 'in',
                'keterangan' => $keteranganForDss,
                'nominal' => (float) ($alloc['cash'] ?? 0),
                'hasPpn' => $hasPpn,
                'ppnNominal' => (float) ($alloc['tax'] ?? 0),
                'seedAkun' => $seedAkun,
            ]);

            if (is_array($dss) && count($dss)) {
                $confOverall = (float) ($dss['confidence']['overall'] ?? 0);
                $allowOverride = $suggestSource === 'kas' || $confOverall >= 0.35;

                if ($allowOverride) {
                    $dssKas = trim((string) ($dss['kode_akun'] ?? ''));
                    if ($dssKas !== '') $suggest['kode_akun'] = $dssKas;

                    $dssVoucher = trim((string) ($dss['voucher_type'] ?? ''));
                    if ($dssVoucher !== '') $suggest['voucher_type'] = $dssVoucher;

                    if ($hasPpn && trim((string) ($suggest['ppn_akun'] ?? '')) === '') {
                        $dssPpn = trim((string) ($dss['ppn_akun'] ?? ''));
                        if ($dssPpn !== '') $suggest['ppn_akun'] = $dssPpn;
                    }

                    $dssLines = is_array($dss['lines'] ?? null) ? $dss['lines'] : [];
                    if (count($dssLines) > 0) {
                        $limit = $hasPpn ? 2 : 3;
                        $suggest['beban_lines'] = collect(array_slice($dssLines, 0, $limit))
                            ->map(fn ($l) => [
                                'akun' => trim((string) ($l['akun'] ?? '')),
                                'jenis' => $this->normalizeJenisBeban((string) ($l['jenis'] ?? 'Kredit')),
                                'nominal' => (float) ($l['nominal'] ?? 0),
                            ])
                            ->values()
                            ->all();
                    }
                }
            }

            // Keterangan uses DSS evidence (most similar) so wording follows history.
            $suggest['keterangan'] = $this->suggestKeteranganFromDss(
                $header,
                is_array($dss) ? $dss : [],
                (string) ($suggest['keterangan'] ?? '')
            );

            return response()->json([
                'allocation' => $alloc,
                'kode_akun' => (string) ($suggest['kode_akun'] ?? ''),
                'voucher_type' => (string) ($suggest['voucher_type'] ?? ''),
                'ppn_akun' => (string) ($suggest['ppn_akun'] ?? ''),
                'beban_lines' => $suggest['beban_lines'] ?? [],
                'keterangan' => (string) ($suggest['keterangan'] ?? ''),
                'confidence' => $dss['confidence'] ?? null,
                'evidence' => $dss['evidence'] ?? [],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'no_fakturpenjualan' => ['required', 'string'],
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
            if (!Schema::hasTable('tb_kdfakturpenjualan')) {
                return redirect()->back()->with('error', 'Tabel tb_kdfakturpenjualan tidak ditemukan.');
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
            foreach (['Kode_Akun1', 'Nominal1', 'Kode_Akun2', 'Nominal2', 'Kode_Akun3', 'Nominal3'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan (dibutuhkan untuk Beban/Pendapatan).");
                }
            }

            $header = DB::table('tb_kdfakturpenjualan')->where('no_fakturpenjualan', $payload['no_fakturpenjualan'])->first();
            if (!$header) {
                return redirect()->back()->with('error', 'Data faktur penjualan tidak ditemukan.');
            }

            $kodeAkun = (string) $payload['kode_akun'];
            $ppnAkun = trim((string) ($payload['ppn_akun'] ?? ''));
            $tglVoucher = Carbon::parse($payload['tgl_voucher'])->toDateString();

            $nominal = array_key_exists('nominal', $payload) && $payload['nominal'] !== null
                ? (float) $payload['nominal']
                : (float) (($header->total_bayaran ?? 0) > 0 ? $header->total_bayaran : ($header->g_total ?? 0));
            $nominal = max(0.0, $nominal);
            if ($nominal <= 0) {
                return redirect()->back()->with('error', 'Nominal harus > 0.');
            }

            $alloc = $this->computeAllocation($header, $nominal);
            $dppNominal = (float) ($alloc['dpp'] ?? 0);
            $taxNominal = (float) ($alloc['tax'] ?? 0);
            if ($taxNominal > 0 && $ppnAkun === '') {
                return redirect()->back()->with('error', 'Akun PPN Keluaran wajib diisi karena faktur memiliki PPN.');
            }

            $sum = 0.0;
            $clean = [];
            foreach (($payload['beban_lines'] ?? []) as $line) {
                $akun = trim((string) ($line['akun'] ?? ''));
                $jenis = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                $nom = (float) ($line['nominal'] ?? 0);
                if ($akun === '') return redirect()->back()->with('error', 'Akun pendapatan wajib dipilih.');
                if ($nom < 0) return redirect()->back()->with('error', 'Nominal tidak boleh negatif.');
                $sum += $nom;
                $clean[] = ['akun' => $akun, 'jenis' => $jenis, 'nominal' => $nom];
            }

            $sum = round($sum, 2);
            if (round($dppNominal, 2) !== $sum) {
                return redirect()->back()->with('error', 'Total pendapatan (DPP) harus sama dengan DPP: ' . $dppNominal);
            }
            if ($taxNominal > 0 && count($clean) > 2) {
                return redirect()->back()->with('error', 'Saat ada PPN, maksimal pendapatan DPP adalah 2 baris (karena Kode_Akun2 dipakai untuk PPN).');
            }

            $keterangan = trim((string) ($payload['keterangan'] ?? ''));
            if ($keterangan === '') {
                $keterangan = $this->buildDefaultKeterangan($header);
            }

            return DB::transaction(function () use ($request, $kasCols, $kodeAkun, $ppnAkun, $tglVoucher, $nominal, $taxNominal, $keterangan, $header, $clean) {
                $dbCode = $this->getDatabaseCode($request);
                $voucherType = strtoupper(trim((string) $request->input('voucher_type', '')));
                $voucherType = in_array($voucherType, ['CV', 'GV', 'BV'], true) ? $voucherType : $this->guessVoucherType($kodeAkun);

                $prefix = $dbCode . '/' . $voucherType . '/';
                $last = (string) (DB::table('tb_kas')
                    ->where('Kode_Voucher', 'like', $prefix . '%')
                    ->orderByDesc('Kode_Voucher')
                    ->value('Kode_Voucher') ?? '');

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
                $mutasi = abs($nominal);
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

                $hasJ1 = in_array('Jenis_Beban1', $kasCols, true);
                $hasJ2 = in_array('Jenis_Beban2', $kasCols, true);
                $hasJ3 = in_array('Jenis_Beban3', $kasCols, true);

                $assign = function (int $slot, array $line) use (&$row, $hasJ1, $hasJ2, $hasJ3) {
                    $row['Kode_Akun' . $slot] = (string) $line['akun'];
                    $row['Nominal' . $slot] = (float) $line['nominal'];
                    $hasJ = $slot === 1 ? $hasJ1 : ($slot === 2 ? $hasJ2 : $hasJ3);
                    if ($hasJ) {
                        $row['Jenis_Beban' . $slot] = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                    }
                };

                if ($taxNominal > 0) {
                    if (isset($clean[0])) $assign(1, $clean[0]);
                    if (isset($clean[1])) $assign(3, $clean[1]);

                    $row['Kode_Akun2'] = $ppnAkun;
                    $row['Nominal2'] = (float) $taxNominal;
                    if ($hasJ2) $row['Jenis_Beban2'] = 'Kredit';
                } else {
                    if (isset($clean[0])) $assign(1, $clean[0]);
                    if (isset($clean[1])) $assign(2, $clean[1]);
                    if (isset($clean[2])) $assign(3, $clean[2]);
                }

                DB::table('tb_kas')->insert($row);

                // Standar perusahaan: update tb_kdfakturpenjualan.trx_jurnal dengan nomor jurnal/voucher kas.
                if (Schema::hasColumn('tb_kdfakturpenjualan', 'trx_jurnal')) {
                    DB::table('tb_kdfakturpenjualan')
                        ->where('no_fakturpenjualan', (string) $header->no_fakturpenjualan)
                        ->update(['trx_jurnal' => $kodeVoucher]);
                }

                return redirect()
                    ->route('keuangan.input-penjualan.index', [
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
