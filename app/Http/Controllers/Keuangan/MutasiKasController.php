<?php

namespace App\Http\Controllers\Keuangan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use App\Services\Keuangan\KasDss\KasDss;

class MutasiKasController
{
    private function normalizeJenis(?string $jenis, string $default): string
    {
        $j = strtoupper(trim((string) $jenis));
        if ($j === 'DEBIT') return 'Debit';
        if ($j === 'KREDIT') return 'Kredit';
        return $default === 'Debit' ? 'Debit' : 'Kredit';
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

    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
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
            $bonus = isset($weights[$a]) ? 0.25 : 0.0;
            $scored[] = ['akun' => $a, 'score' => $base + $bonus];
        }
        usort($scored, fn ($x, $y) => ($y['score'] <=> $x['score']));
        return array_slice(array_map(fn ($r) => (string) $r['akun'], $scored), 0, $limit);
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

    private function getVoucherInfo(Request $request, string $kodeAkun): array
    {
        $dbCode = $this->getDatabaseCode($request);
        $kodeAkun = trim($kodeAkun);
        $type = (new KasDss())->voucherTypeForAkun($kodeAkun);

        return [
            'type' => $type,
            'prefix' => "{$dbCode}/{$type}/",
        ];
    }

    private function guessVoucherType(string $kodeAkun): string
    {
        return (new KasDss())->voucherTypeForAkun($kodeAkun);
    }

    private function getAccountOptions(): array
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Akun')) return [];

        $nabbName = $this->nabbNameAvailable();
        try {
            $codes = DB::table('tb_kas as k')
                ->selectRaw('DISTINCT TRIM(k.Kode_Akun) as Kode_Akun')
                ->whereNotNull('k.Kode_Akun')
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''")
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
            if (in_array($code, $values, true)) return $code;
        }
        return $opts[0]['value'] ?? null;
    }

    private function getGlAccountOptions(): array
    {
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            $hasName = Schema::hasColumn('tb_nabb', 'Nama_Akun');
            try {
                return DB::table('tb_nabb')
                    ->select([
                        'Kode_Akun',
                        $hasName ? 'Nama_Akun' : DB::raw("'' as Nama_Akun"),
                    ])
                    ->whereNotNull('Kode_Akun')
                    ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                    ->orderBy('Kode_Akun', 'asc')
                    ->limit(5000)
                    ->get()
                    ->map(function ($r) {
                        $code = trim((string) ($r->Kode_Akun ?? ''));
                        if ($code === '') return null;
                        $name = trim((string) ($r->Nama_Akun ?? ''));
                        return [
                            'value' => $code,
                            'label' => $name !== '' ? ($code . ' — ' . $name) : $code,
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();
            } catch (\Throwable) {
                // fallback below
            }
        }

        return $this->getAccountOptions();
    }

    private function parsePeriodToRange(?string $period): ?array
    {
        $period = trim((string) $period);
        if ($period === '') return null;
        if (preg_match('/^\\d{4}$/', $period)) {
            $y = Carbon::createFromFormat('Y', $period)->startOfYear();
            return ['start' => $y->copy()->startOfYear(), 'end' => $y->copy()->endOfYear()];
        }
        if (preg_match('/^\\d{6}$/', $period)) {
            $m = Carbon::createFromFormat('Ym', $period)->startOfMonth();
            return ['start' => $m->copy()->startOfMonth(), 'end' => $m->copy()->endOfMonth()];
        }
        return null;
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

    public function index(Request $request)
    {
        $accountOptions = $this->getAccountOptions();
        $defaultAccount = $this->getDefaultAccount();

        $filters = [
            'search' => (string) $request->query('search', ''),
            'account' => (string) $request->query('account', $defaultAccount ?: 'all'),
            'period' => (string) $request->query('period', Carbon::now()->format('Ym')),
            'pageSize' => (int) $request->query('pageSize', 10),
        ];

        return Inertia::render('Keuangan/mutasi-kas/index', [
            'filters' => $filters,
            'accountOptions' => $accountOptions,
            'defaultAccount' => $defaultAccount,
        ]);
    }

    public function create(Request $request)
    {
        $accountOptions = $this->getAccountOptions();
        $defaultAccount = $this->getDefaultAccount();
        $glAccountOptions = $this->getGlAccountOptions();

        $filters = [
            'search' => (string) $request->query('search', ''),
        ];

        return Inertia::render('Keuangan/mutasi-kas/create', [
            'filters' => $filters,
            'accountOptions' => $accountOptions,
            'defaultAccount' => $defaultAccount,
            'glAccountOptions' => $glAccountOptions,
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $account = trim((string) $request->query('account', ''));
            $period = trim((string) $request->query('period', ''));

            $q = DB::table('tb_kas as k');
            if ($account !== '' && $account !== 'all') {
                $q->whereRaw('TRIM(k.Kode_Akun) = ?', [$account]);
            }
            if ($period !== '') {
                $range = $this->parsePeriodToRange($period);
                if ($range) {
                    $q->whereBetween('k.Tgl_Voucher', [$range['start']->toDateString(), $range['end']->toDateString()]);
                }
            }
            if ($search !== '') {
                $q->where(function ($w) use ($search) {
                    $w->where('k.Kode_Voucher', 'like', '%' . $search . '%')
                        ->orWhere('k.Keterangan', 'like', '%' . $search . '%');
                });
            }

            $rows = $q->orderByDesc('k.Tgl_Voucher')
                ->orderByDesc('k.Kode_Voucher')
                ->limit(5000)
                ->get($this->buildKasSelect());

            $out = $rows->map(fn ($r) => [
                'Kode_Voucher' => (string) ($r->Kode_Voucher ?? ''),
                'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                'Tgl_Voucher' => (string) ($r->Tgl_Voucher ?? ''),
                'Tgl_Buat' => (string) ($r->Tgl_Buat ?? ''),
                'Keterangan' => (string) ($r->Keterangan ?? ''),
                'Mutasi_Kas' => (float) ($r->Mutasi_Kas ?? 0),
                'Saldo' => (float) ($r->Saldo ?? 0),
            ])->values()->all();

            return response()->json(['rows' => $out, 'total' => count($out)]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function bayarRows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_bayar')) {
                return response()->json(['rows' => [], 'total' => 0]);
            }

            $search = trim((string) $request->query('search', ''));

            $q = DB::table('tb_bayar');

            // Requirement: show only Payment Cost rows that are not yet booked to cash/bank.
            // In this DB, `beban_akun` is NOT NULL and when "already booked" it is stored as a single space.
            // So pending rows are: TRIM(beban_akun) <> ''.
            if (Schema::hasColumn('tb_bayar', 'beban_akun')) {
                $q->whereRaw("TRIM(COALESCE(beban_akun,'')) <> ''");
            }

            if ($search !== '') {
                $q->where(function ($w) use ($search) {
                    $w->where('Kode_Bayar', 'like', '%' . $search . '%')
                        ->orWhere('Keterangan', 'like', '%' . $search . '%')
                        ->orWhere('beban_akun', 'like', '%' . $search . '%')
                        ->orWhere('noduk_beban', 'like', '%' . $search . '%')
                        ->orWhere('Penanggung', 'like', '%' . $search . '%');
                });
            }

            $rows = $q->select([
                'Kode_Bayar',
                'No',
                'Tgl_Bayar',
                'Tgl_Posting',
                'Keterangan',
                'Penanggung',
                'Total',
                'Bayar',
                'Sisa',
                'beban_akun',
                'noduk_beban',
                'Status',
            ])
                ->orderByDesc('Kode_Bayar')
                ->orderByDesc('No')
                ->limit(1500)
                ->get();

            return response()->json([
                'rows' => $rows,
                'total' => $rows->count(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Tokenize with weights (simple "ML-lite" feature extraction).
     *
     * - Tokens inside parentheses (...) get higher weight.
     * - Adds light synonym expansion for common finance words.
     *
     * @return array<string,float> token => weight
     */
    private function tokenizeWeighted(string $text): array
    {
        $raw = trim((string) $text);
        if ($raw === '') return [];

        $rawLower = strtolower($raw);

        // Parentheses terms are strong signals (e.g., BPJS, JHT, Kesehatan).
        $strongText = '';
        if (preg_match_all('/\\(([^\\)]{1,120})\\)/', $rawLower, $m)) {
            $strongText = implode(' ', $m[1] ?? []);
        }

        $norm = preg_replace('/[^a-z0-9]+/i', ' ', $rawLower) ?? $rawLower;
        $strongNorm = preg_replace('/[^a-z0-9]+/i', ' ', $strongText) ?? $strongText;

        $stop = ['dan', 'atau', 'ke', 'dari', 'yang', 'untuk', 'the', 'a', 'an', 'of', 'to', 'in'];

        $build = function (string $s, float $w) use ($stop): array {
            $parts = array_values(array_filter(array_map('trim', explode(' ', $s))));
            $out = [];
            foreach ($parts as $p) {
                if (strlen($p) < 3) continue;
                if (in_array($p, $stop, true)) continue;
                $out[$p] = max($out[$p] ?? 0, $w);
            }
            return $out;
        };

        $tokens = $build($norm, 1.0);
        $strongTokens = $build($strongNorm, 2.0);
        foreach ($strongTokens as $t => $w) {
            $tokens[$t] = max($tokens[$t] ?? 0, $w);
        }

        // Light synonym expansion (keep small, deterministic).
        $expand = function (string $token): array {
            return match ($token) {
                'bpjs' => ['bpjs', 'asuransi'],
                'jht' => ['jht', 'bpjs', 'asuransi'],
                'kesehatan' => ['kesehatan', 'bpjs', 'asuransi'],
                'gaji' => ['gaji', 'upah'],
                'upah' => ['upah', 'gaji'],
                'asuransi' => ['asuransi', 'bpjs'],
                default => [$token],
            };
        };

        $expanded = [];
        foreach ($tokens as $t => $w) {
            foreach ($expand($t) as $e) {
                $expanded[$e] = max($expanded[$e] ?? 0, $w);
            }
        }

        // Cap to avoid too broad queries.
        arsort($expanded);
        return array_slice($expanded, 0, 12, true);
    }

    /**
     * @return string[] basic tokens (used for transfer pair heuristic)
     */
    private function tokenize(string $text): array
    {
        $raw = strtolower(trim((string) $text));
        if ($raw === '') return [];
        $raw = preg_replace('/[^a-z0-9]+/i', ' ', $raw) ?? $raw;
        $raw = preg_replace('/\\s+/', ' ', $raw) ?? $raw;
        $parts = array_values(array_filter(array_map('trim', explode(' ', $raw))));
        $out = [];
        foreach ($parts as $p) {
            if (strlen($p) < 3) continue;
            $out[] = $p;
        }
        return array_values(array_unique(array_slice($out, 0, 12)));
    }

    private function suggestFromKasHistory(
        string $mode,
        string $kodeAkun,
        string $keterangan,
        bool $hasPpn,
        float $ppnNominal,
        ?string $seedAkun = null
    ): array
    {
        $mode = in_array($mode, ['in', 'out', 'transfer'], true) ? $mode : 'out';
        $kodeAkun = trim($kodeAkun);
        $tokenWeights = $this->tokenizeWeighted($keterangan);
        $tokens = array_keys($tokenWeights);

        $q = DB::table('tb_kas as k');
        if ($kodeAkun !== '' && $kodeAkun !== 'all') {
            $q->whereRaw('TRIM(k.Kode_Akun) = ?', [$kodeAkun]);
        }
        if ($mode === 'in') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
        if ($mode === 'out') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');

        if (count($tokens)) {
            $q->where(function ($w) use ($tokens) {
                foreach (array_slice($tokens, 0, 6) as $t) {
                    $w->orWhereRaw('LOWER(k.Keterangan) like ?', ['%' . $t . '%']);
                }
            });
        }

        $cols = Schema::getColumnListing('tb_kas');
        $select = [
            'k.Kode_Voucher',
            'k.Kode_Akun',
            'k.Keterangan',
            'k.Mutasi_Kas',
            'k.Kode_Akun1', 'k.Nominal1', in_array('Jenis_Beban1', $cols, true) ? 'k.Jenis_Beban1' : DB::raw("'' as Jenis_Beban1"),
            'k.Kode_Akun2', 'k.Nominal2', in_array('Jenis_Beban2', $cols, true) ? 'k.Jenis_Beban2' : DB::raw("'' as Jenis_Beban2"),
            'k.Kode_Akun3', 'k.Nominal3', in_array('Jenis_Beban3', $cols, true) ? 'k.Jenis_Beban3' : DB::raw("'' as Jenis_Beban3"),
        ];

        $rows = $q->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(160)
            ->get($select);

        $nabbWeights = $this->getNaBBAccountWeights();

        $typeCounts = [];
        $ppnCounts = [];
        $lawanCounts = [];
        $jenisMap = [];
        $bestKet = '';
        $bestKetScore = -1.0;
        $seedAkun = trim((string) $seedAkun);

        foreach ($rows as $r) {
            $kv = trim((string) ($r->Kode_Voucher ?? ''));
            $ket = trim((string) ($r->Keterangan ?? ''));
            $ketLower = strtolower($ket);

            // Row match score based on weighted token hits.
            $rowScore = 0.0;
            foreach ($tokenWeights as $t => $w) {
                if ($t !== '' && $ketLower !== '' && str_contains($ketLower, $t)) {
                    $rowScore += (float) $w;
                }
            }
            // If no query tokens, still allow some learning with low score.
            if (count($tokenWeights) === 0) $rowScore = 0.5;

            if ($kv !== '') {
                if (str_contains($kv, '/GV/')) $typeCounts['GV'] = ($typeCounts['GV'] ?? 0) + $rowScore;
                if (str_contains($kv, '/BV/')) $typeCounts['BV'] = ($typeCounts['BV'] ?? 0) + $rowScore;
            }

            if ($ket !== '' && $rowScore > $bestKetScore) {
                $bestKet = $ket;
                $bestKetScore = $rowScore;
            }

            $nom2 = (float) ($r->Nominal2 ?? 0);
            $a2 = trim((string) ($r->Kode_Akun2 ?? ''));
            if ($nom2 > 0 && $a2 !== '') {
                $ppnCounts[$a2] = ($ppnCounts[$a2] ?? 0) + $rowScore;
            }

            $slots = ($hasPpn && $ppnNominal > 0) ? [1, 3] : [1, 2, 3];
            foreach ($slots as $slot) {
                $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                $jenis = trim((string) ($r->{'Jenis_Beban' . $slot} ?? ''));
                if ($akun === '' || $nom <= 0) continue;
                $lawanCounts[$akun] = ($lawanCounts[$akun] ?? 0) + $rowScore;
                if (!isset($jenisMap[$akun]) && $jenis !== '') {
                    $jenisMap[$akun] = $this->normalizeJenis($jenis, $mode === 'in' ? 'Kredit' : 'Debit');
                }
            }
        }

        $voucherType = '';
        if (count($typeCounts)) {
            arsort($typeCounts);
            $voucherType = (string) array_key_first($typeCounts);
        }

        $ppnAkun = '';
        if ($hasPpn && $ppnNominal > 0 && count($ppnCounts)) {
            $ranked = $this->rankAccountsWithNaBB($ppnCounts, $nabbWeights, 1);
            $ppnAkun = (string) ($ranked[0] ?? '');
        }

        $maxLines = ($hasPpn && $ppnNominal > 0) ? 2 : 3;
        $lines = [];
        if (count($lawanCounts)) {
            // Seed account from external source (e.g. tb_bayar.beban_akun) should be strongly preferred.
            if ($seedAkun !== '') {
                $lawanCounts[$seedAkun] = ($lawanCounts[$seedAkun] ?? 0) + 50;
            }

            $top = $this->rankAccountsWithNaBB($lawanCounts, $nabbWeights, $maxLines);
            foreach ($top as $akun) {
                $lines[] = [
                    'akun' => $akun,
                    'jenis' => (string) (($jenisMap[$akun] ?? '') ?: ($mode === 'in' ? 'Kredit' : 'Debit')),
                    'nominal' => 0,
                    'score' => (float) ($lawanCounts[$akun] ?? 0),
                ];
            }
        } elseif ($seedAkun !== '') {
            $lines[] = ['akun' => $seedAkun, 'jenis' => ($mode === 'in' ? 'Kredit' : 'Debit'), 'nominal' => 0, 'score' => 100.0];
        }

        return [
            'voucher_type' => $voucherType,
            'ppn_akun' => $ppnAkun,
            'keterangan' => $bestKet,
            'lines' => $lines,
        ];
    }

    private function suggestCashAccount(string $mode, string $keterangan): string
    {
        $mode = in_array($mode, ['in', 'out'], true) ? $mode : 'out';
        $tokenWeights = $this->tokenizeWeighted($keterangan);
        $tokens = array_keys($tokenWeights);
        if (count($tokens) === 0) return '';

        try {
            $q = DB::table('tb_kas as k')
                ->whereNotNull('k.Kode_Akun')
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''");

            if ($mode === 'in') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
            if ($mode === 'out') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');

            $q->where(function ($w) use ($tokens) {
                foreach (array_slice($tokens, 0, 6) as $t) {
                    $w->orWhereRaw('LOWER(k.Keterangan) like ?', ['%' . $t . '%']);
                }
            });

            $rows = $q->orderByDesc('k.Tgl_Voucher')
                ->orderByDesc('k.Kode_Voucher')
                ->limit(200)
                ->pluck('k.Kode_Akun')
                ->map(fn ($v) => trim((string) $v))
                ->filter()
                ->all();

            if (count($rows) === 0) return '';

            $counts = [];
            foreach ($rows as $a) $counts[$a] = ($counts[$a] ?? 0) + 1;

            $ranked = $this->rankAccountsWithNaBB($counts, $this->getNaBBAccountWeights(), 1);
            return (string) ($ranked[0] ?? '');
        } catch (\Throwable) {
            return '';
        }
    }

    private function suggestTransferPair(string $keterangan): array
    {
        if (!Schema::hasTable('tb_kas')) return ['source' => '', 'dest' => ''];
        if (!Schema::hasColumn('tb_kas', 'Kode_Akun') || !Schema::hasColumn('tb_kas', 'Kode_Akun1')) {
            return ['source' => '', 'dest' => ''];
        }

        $tokens = $this->tokenize($keterangan);
        if (count($tokens) === 0) return ['source' => '', 'dest' => ''];

        try {
            $q = DB::table('tb_kas as k')
                ->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0') // source row
                ->whereNotNull('k.Kode_Akun')
                ->whereNotNull('k.Kode_Akun1')
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''")
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun1,'')) <> ''");

            $q->where(function ($w) use ($tokens) {
                foreach (array_slice($tokens, 0, 6) as $t) {
                    $w->orWhereRaw('LOWER(k.Keterangan) like ?', ['%' . $t . '%']);
                }
            });

            $rows = $q->orderByDesc('k.Tgl_Voucher')
                ->orderByDesc('k.Kode_Voucher')
                ->limit(220)
                ->get(['k.Kode_Akun', 'k.Kode_Akun1']);

            $pairCounts = [];
            foreach ($rows as $r) {
                $src = trim((string) ($r->Kode_Akun ?? ''));
                $dst = trim((string) ($r->Kode_Akun1 ?? ''));
                if ($src === '' || $dst === '' || $src === $dst) continue;
                $key = $src . '|' . $dst;
                $pairCounts[$key] = ($pairCounts[$key] ?? 0) + 1;
            }
            if (count($pairCounts) === 0) return ['source' => '', 'dest' => ''];

            arsort($pairCounts);
            $best = (string) array_key_first($pairCounts);
            [$src, $dst] = array_pad(explode('|', $best, 2), 2, '');
            return ['source' => $src, 'dest' => $dst];
        } catch (\Throwable) {
            return ['source' => '', 'dest' => ''];
        }
    }

    private function suggestTransferKeterangan(string $source, string $dest): string
    {
        $source = trim($source);
        $dest = trim($dest);
        if ($source === '' || $dest === '') return '';

        $srcLabel = $source;
        $dstLabel = $dest;
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun') && Schema::hasColumn('tb_nabb', 'Nama_Akun')) {
            try {
                $names = DB::table('tb_nabb')
                    ->whereIn('Kode_Akun', [$source, $dest])
                    ->pluck('Nama_Akun', 'Kode_Akun');
                $srcName = trim((string) ($names[$source] ?? ''));
                $dstName = trim((string) ($names[$dest] ?? ''));
                if ($srcName !== '') $srcLabel = $srcName;
                if ($dstName !== '') $dstLabel = $dstName;
            } catch (\Throwable) {
                // ignore and fallback to codes
            }
        }

        return "PEMINDAHAN DANA DARI {$srcLabel} KE {$dstLabel}";
    }

    public function suggest(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $mode = (string) $request->query('mode', 'out');
            $mode = in_array($mode, ['in', 'out', 'transfer'], true) ? $mode : 'out';

            $account = trim((string) $request->query('account', ''));
            $source = trim((string) $request->query('source', ''));
            $dest = trim((string) $request->query('dest', ''));

            $nominal = (float) $request->query('nominal', 0);
            $nominal = max(0.0, $nominal);

            $keterangan = (string) $request->query('keterangan', '');
            $hasPpn = filter_var($request->query('hasPpn', false), FILTER_VALIDATE_BOOLEAN);
            $ppnNominal = (float) $request->query('ppnNominal', 0);
            $ppnNominal = max(0.0, $ppnNominal);
            $seedAkun = trim((string) $request->query('seedAkun', ''));

            $kodeAkun = $account !== '' ? $account : ($source !== '' ? $source : '');
            $ppnJenis = $mode === 'in' ? 'Kredit' : 'Debit';

            if ($mode === 'transfer') {
                $pair = $this->suggestTransferPair($keterangan);
                $suggestSource = $pair['source'] ?? '';
                $suggestDest = $pair['dest'] ?? '';
                $finalSource = (string) ($suggestSource ?: $source);
                $finalDest = (string) ($suggestDest ?: $dest);

                // If caller sent unrelated keterangan (e.g. from previous mode), replace with transfer redaction.
                $keteranganOut = trim((string) $keterangan);
                $looksTransfer = $keteranganOut !== '' && (
                    str_contains(strtolower($keteranganOut), 'transfer')
                    || str_contains(strtolower($keteranganOut), 'mutasi')
                    || str_contains($keteranganOut, '→')
                    || str_contains(strtolower($keteranganOut), 'pindah')
                );
                if (!$looksTransfer) {
                    $keteranganOut = $this->suggestTransferKeterangan($finalSource, $finalDest);
                }

                $infoS = $this->getVoucherInfo($request, $finalSource);

                return response()->json([
                    'voucher_type' => $infoS['type'],
                    'source' => $finalSource,
                    'dest' => $finalDest,
                    'keterangan' => $keteranganOut,
                    'lines' => [
                        ['akun' => $finalDest, 'jenis' => 'Debit', 'nominal' => $nominal],
                    ],
                    'ppn_akun' => '',
                    'ppn_jenis' => 'Debit',
                    'confidence' => ['overall' => 1.0],
                    'evidence' => [],
                ]);
            }

            $dss = new KasDss();
            $dssOut = $dss->suggest([
                'mode' => $mode,
                'keterangan' => $keterangan,
                'nominal' => $nominal,
                'hasPpn' => (bool) ($hasPpn && $ppnNominal > 0),
                'ppnNominal' => $ppnNominal,
                'seedAkun' => $seedAkun,
            ]);

            return response()->json([
                'kode_akun' => (string) ($dssOut['kode_akun'] ?? ''),
                'voucher_type' => (string) ($dssOut['voucher_type'] ?? $this->guessVoucherType($kodeAkun)),
                'keterangan' => (string) ($dssOut['keterangan'] ?? ''),
                'ppn_akun' => (string) ($dssOut['ppn_akun'] ?? ''),
                'ppn_jenis' => (string) ($dssOut['ppn_jenis'] ?? $ppnJenis),
                'lines' => $dssOut['lines'] ?? [],
                'confidence' => $dssOut['confidence'] ?? ['overall' => 0.0],
                'evidence' => $dssOut['evidence'] ?? [],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function nextVoucher(string $prefix): string
    {
        $last = (string) (DB::table('tb_kas')
            ->where('Kode_Voucher', 'like', $prefix . '%')
            ->orderByDesc('Kode_Voucher')
            ->value('Kode_Voucher') ?? '');

        $seq = 0;
        if ($last !== '' && str_starts_with($last, $prefix)) {
            $tail = substr($last, strlen($prefix));
            if (preg_match('/^\\d{8}$/', $tail)) $seq = (int) $tail;
        }
        $seq++;
        return $prefix . str_pad((string) $seq, 8, '0', STR_PAD_LEFT);
    }

    /**
     * @return array{0:string,1:string}
     */
    private function nextVoucherPair(string $prefix): array
    {
        $last = (string) (DB::table('tb_kas')
            ->where('Kode_Voucher', 'like', $prefix . '%')
            ->orderByDesc('Kode_Voucher')
            ->value('Kode_Voucher') ?? '');

        $seq = 0;
        if ($last !== '' && str_starts_with($last, $prefix)) {
            $tail = substr($last, strlen($prefix));
            if (preg_match('/^\\d{8}$/', $tail)) $seq = (int) $tail;
        }

        $out = $prefix . str_pad((string) ($seq + 1), 8, '0', STR_PAD_LEFT);
        $in = $prefix . str_pad((string) ($seq + 2), 8, '0', STR_PAD_LEFT);
        return [$out, $in];
    }

    private function getLastSaldo(string $kodeAkun): float
    {
        $row = DB::table('tb_kas')
            ->where('Kode_Akun', $kodeAkun)
            ->orderByDesc('Tgl_Voucher')
            ->orderByDesc('Kode_Voucher')
            ->select(['Saldo'])
            ->first();

        return (float) ($row->Saldo ?? 0);
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'mode' => ['required', 'string'], // in|out|transfer
            'kode_akun' => ['nullable', 'string'], // for in/out
            'source' => ['nullable', 'string'], // for transfer
            'dest' => ['nullable', 'string'], // for transfer
            'tgl_voucher' => ['required', 'date'],
            'voucher_type' => ['nullable', 'string'],
            'nominal' => ['required', 'numeric', 'min:0.01'],
            'keterangan' => ['nullable', 'string'],
            'has_ppn' => ['nullable', 'boolean'],
            'ppn_akun' => ['nullable', 'string'],
            'ppn_nominal' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['nullable', 'array', 'max:3'],
            'lines.*.akun' => ['required_with:lines', 'string'],
            'lines.*.jenis' => ['nullable', 'string'],
            'lines.*.nominal' => ['required_with:lines', 'numeric', 'min:0'],
        ]);

        try {
            if (!Schema::hasTable('tb_kas')) {
                return redirect()->back()->with('error', 'Tabel tb_kas tidak ditemukan.');
            }

            $kasCols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan.");
                }
            }
            if (!$this->kasBreakdownAvailable()) {
                return redirect()->back()->with('error', 'Kolom breakdown tb_kas (Kode_Akun1..3/Nominal1..3) tidak lengkap.');
            }

            $mode = strtolower(trim((string) ($payload['mode'] ?? '')));
            $mode = in_array($mode, ['in', 'out', 'transfer'], true) ? $mode : 'out';

            $tglVoucher = Carbon::parse($payload['tgl_voucher'])->toDateString();
            $nominal = max(0.0, (float) ($payload['nominal'] ?? 0));
            if ($nominal <= 0) return redirect()->back()->with('error', 'Nominal harus > 0.');

            $voucherType = ''; // Will be determined by getVoucherInfo based on account

            $hasPpn = (bool) ($payload['has_ppn'] ?? false);
            $ppnNominal = $hasPpn ? max(0.0, (float) ($payload['ppn_nominal'] ?? 0)) : 0.0;
            $ppnAkun = $hasPpn ? trim((string) ($payload['ppn_akun'] ?? '')) : '';

            if ($mode === 'transfer') {
                $hasPpn = false;
                $ppnNominal = 0.0;
                $ppnAkun = '';
            }

            if ($hasPpn && $ppnNominal > 0 && $ppnAkun === '') {
                return redirect()->back()->with('error', 'Akun PPN wajib diisi jika nominal PPN > 0.');
            }

            $keterangan = trim((string) ($payload['keterangan'] ?? ''));
            if ($keterangan === '') {
                $keterangan = $mode === 'in' ? 'Mutasi/Kas Masuk' : ($mode === 'transfer' ? 'Mutasi/Transfer' : 'Mutasi/Kas Keluar');
            }

            $hasJ1 = in_array('Jenis_Beban1', $kasCols, true);
            $hasJ2 = in_array('Jenis_Beban2', $kasCols, true);
            $hasJ3 = in_array('Jenis_Beban3', $kasCols, true);

            $assign = function (array &$row, int $slot, array $line, string $defaultJenis) use ($hasJ1, $hasJ2, $hasJ3) {
                $row['Kode_Akun' . $slot] = (string) ($line['akun'] ?? '');
                $row['Nominal' . $slot] = (float) ($line['nominal'] ?? 0);
                $hasJ = $slot === 1 ? $hasJ1 : ($slot === 2 ? $hasJ2 : $hasJ3);
                if ($hasJ) {
                    $row['Jenis_Beban' . $slot] = $this->normalizeJenis((string) ($line['jenis'] ?? ''), $defaultJenis);
                }
            };

            return DB::transaction(function () use (
                $request,
                $mode,
                $tglVoucher,
                $nominal,
                $voucherType,
                $hasPpn,
                $ppnNominal,
                $ppnAkun,
                $keterangan,
                $assign,
                $kasCols
            ) {
                $dbCode = $this->getDatabaseCode($request);

                if ($mode === 'transfer') {
                    $source = trim((string) ($request->input('source') ?? ''));
                    $dest = trim((string) ($request->input('dest') ?? ''));
                    if ($source === '' || $dest === '') {
                        return redirect()->back()->with('error', 'Akun sumber dan tujuan wajib diisi.');
                    }
                    if ($source === $dest) {
                        return redirect()->back()->with('error', 'Akun sumber dan tujuan tidak boleh sama.');
                    }

                    $infoS = $this->getVoucherInfo($request, $source);
                    $prefix = $infoS['prefix'];
                    [$voucherOut, $voucherIn] = $this->nextVoucherPair($prefix);

                    $ket = $keterangan;
                    if (!str_contains($ket, $voucherOut) && !str_contains($ket, $voucherIn)) {
                        $ket = trim($ket) . ' — ' . $voucherOut . ' / ' . $voucherIn;
                    }

                    // Out row (source)
                    $saldoSource = $this->getLastSaldo($source);
                    $mutOut = -1 * abs($nominal);
                    $rowOut = [
                        'Kode_Voucher' => $voucherOut,
                        'Kode_Akun' => $source,
                        'Tgl_Voucher' => $tglVoucher,
                        'Keterangan' => $ket,
                        'Mutasi_Kas' => $mutOut,
                        'Saldo' => $saldoSource + $mutOut,
                        'Kode_Akun1' => $dest,
                        'Nominal1' => abs($nominal),
                        'Kode_Akun2' => null,
                        'Nominal2' => null,
                        'Kode_Akun3' => null,
                        'Nominal3' => null,
                    ];
                    if (in_array('Tgl_Buat', $kasCols, true)) $rowOut['Tgl_Buat'] = Carbon::now()->toDateString();
                    if (in_array('Jenis_Beban1', $kasCols, true)) $rowOut['Jenis_Beban1'] = 'Debit';
                    if (in_array('Jenis_Beban2', $kasCols, true)) $rowOut['Jenis_Beban2'] = null;
                    if (in_array('Jenis_Beban3', $kasCols, true)) $rowOut['Jenis_Beban3'] = null;

                    // In row (dest)
                    $saldoDest = $this->getLastSaldo($dest);
                    $mutIn = abs($nominal);
                    $rowIn = [
                        'Kode_Voucher' => $voucherIn,
                        'Kode_Akun' => $dest,
                        'Tgl_Voucher' => $tglVoucher,
                        'Keterangan' => $ket,
                        'Mutasi_Kas' => $mutIn,
                        'Saldo' => $saldoDest + $mutIn,
                        'Kode_Akun1' => $source,
                        'Nominal1' => abs($nominal),
                        'Kode_Akun2' => null,
                        'Nominal2' => null,
                        'Kode_Akun3' => null,
                        'Nominal3' => null,
                    ];
                    if (in_array('Tgl_Buat', $kasCols, true)) $rowIn['Tgl_Buat'] = Carbon::now()->toDateString();
                    if (in_array('Jenis_Beban1', $kasCols, true)) $rowIn['Jenis_Beban1'] = 'Kredit';
                    if (in_array('Jenis_Beban2', $kasCols, true)) $rowIn['Jenis_Beban2'] = null;
                    if (in_array('Jenis_Beban3', $kasCols, true)) $rowIn['Jenis_Beban3'] = null;

                    DB::table('tb_kas')->insert($rowOut);
                    DB::table('tb_kas')->insert($rowIn);

                    return redirect()
                        ->route('keuangan.mutasi-kas.index', [
                            'account' => $source,
                            'period' => Carbon::parse($tglVoucher)->format('Ym'),
                            'search' => $voucherOut,
                        ])
                        ->with('success', 'Berhasil simpan transfer: ' . $voucherOut . ' / ' . $voucherIn);
                }

                $kodeAkun = trim((string) ($request->input('kode_akun') ?? ''));
                if ($kodeAkun === '') {
                    return redirect()->back()->with('error', 'Akun kas/bank wajib diisi.');
                }

                $infoK = $this->getVoucherInfo($request, $kodeAkun);
                $prefix = $infoK['prefix'];
                $kodeVoucher = $this->nextVoucher($prefix);

                $mutasi = $mode === 'in' ? abs($nominal) : (-1 * abs($nominal));
                $saldo = $this->getLastSaldo($kodeAkun) + $mutasi;

                $row = [
                    'Kode_Voucher' => $kodeVoucher,
                    'Kode_Akun' => $kodeAkun,
                    'Tgl_Voucher' => $tglVoucher,
                    'Keterangan' => $keterangan,
                    'Mutasi_Kas' => $mutasi,
                    'Saldo' => $saldo,
                ];
                if (in_array('Tgl_Buat', $kasCols, true)) $row['Tgl_Buat'] = Carbon::now()->toDateString();

                $lines = is_array($request->input('lines')) ? $request->input('lines') : [];
                $lines = array_values($lines);

                $dppTarget = max(0.0, $nominal - ($hasPpn ? $ppnNominal : 0.0));
                $sum = 0.0;
                $clean = [];
                foreach ($lines as $line) {
                    $akun = trim((string) ($line['akun'] ?? ''));
                    $jenisDefault = $mode === 'in' ? 'Kredit' : 'Debit';
                    $jenis = $this->normalizeJenis((string) ($line['jenis'] ?? ''), $jenisDefault);
                    $nom = (float) ($line['nominal'] ?? 0);
                    if ($akun === '') return redirect()->back()->with('error', 'Akun lawan wajib diisi.');
                    if ($nom < 0) return redirect()->back()->with('error', 'Nominal tidak boleh negatif.');
                    $sum += $nom;
                    $clean[] = ['akun' => $akun, 'jenis' => $jenis, 'nominal' => $nom];
                }

                if (count($clean) === 0) return redirect()->back()->with('error', 'Minimal 1 baris akun lawan (DPP) wajib diisi.');

                $sum = round($sum, 2);
                if (count($lines) > 0 && round($dppTarget, 2) !== $sum) {
                    return redirect()->back()->with('error', 'Total DPP harus sama dengan target DPP: ' . $dppTarget);
                }
                if ($hasPpn && $ppnNominal > 0 && count($clean) > 2) {
                    return redirect()->back()->with('error', 'Saat ada PPN, maksimal DPP adalah 2 baris (slot 2 dipakai PPN).');
                }

                if ($hasPpn && $ppnNominal > 0) {
                    if (isset($clean[0])) $assign($row, 1, $clean[0], $mode === 'in' ? 'Kredit' : 'Debit');
                    if (isset($clean[1])) $assign($row, 3, $clean[1], $mode === 'in' ? 'Kredit' : 'Debit');

                    $row['Kode_Akun2'] = $ppnAkun;
                    $row['Nominal2'] = (float) $ppnNominal;
                    if (in_array('Jenis_Beban2', $kasCols, true)) {
                        $row['Jenis_Beban2'] = $mode === 'in' ? 'Kredit' : 'Debit';
                    }
                } else {
                    if (isset($clean[0])) $assign($row, 1, $clean[0], $mode === 'in' ? 'Kredit' : 'Debit');
                    if (isset($clean[1])) $assign($row, 2, $clean[1], $mode === 'in' ? 'Kredit' : 'Debit');
                    if (isset($clean[2])) $assign($row, 3, $clean[2], $mode === 'in' ? 'Kredit' : 'Debit');
                }

                DB::table('tb_kas')->insert($row);

                return redirect()
                    ->route('keuangan.mutasi-kas.index', [
                        'account' => $kodeAkun,
                        'period' => Carbon::parse($tglVoucher)->format('Ym'),
                        'search' => $kodeVoucher,
                    ])
                    ->with('success', 'Berhasil simpan mutasi: ' . $kodeVoucher);
            });
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
