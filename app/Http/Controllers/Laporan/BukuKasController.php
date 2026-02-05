<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class BukuKasController
{
    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
    }

    private function getPeriodOptions(): array
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Tgl_Voucher')) {
            return [];
        }

        try {
            return DB::table('tb_kas')
                ->selectRaw("DISTINCT DATE_FORMAT(Tgl_Voucher, '%Y%m') as period")
                ->whereNotNull('Tgl_Voucher')
                ->orderByDesc('period')
                ->limit(240)
                ->pluck('period')
                ->filter(fn ($p) => is_string($p) && preg_match('/^\\d{6}$/', $p))
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function getDefaultPeriod(): ?string
    {
        $opts = $this->getPeriodOptions();
        return $opts[0] ?? null;
    }

    private function getYearOptions(): array
    {
        return collect($this->getPeriodOptions())
            ->map(fn ($p) => substr((string) $p, 0, 4))
            ->filter(fn ($y) => is_string($y) && preg_match('/^\\d{4}$/', $y))
            ->unique()
            ->values()
            ->all();
    }

    private function getDefaultYear(): ?string
    {
        $defaultPeriod = $this->getDefaultPeriod();
        if ($defaultPeriod && preg_match('/^\\d{6}$/', $defaultPeriod)) {
            return substr($defaultPeriod, 0, 4);
        }

        $years = $this->getYearOptions();
        return $years[0] ?? null;
    }

    private function parsePeriodToRange(string $periodType, ?string $period): ?array
    {
        if ($periodType === 'year') {
            if (!$period || !preg_match('/^\\d{4}$/', $period)) {
                return null;
            }

            $year = Carbon::createFromFormat('Y', $period)->startOfYear();
            return [
                'period_type' => 'year',
                'period' => $period,
                'start' => $year->copy()->startOfYear(),
                'end' => $year->copy()->endOfYear(),
                'label' => 'FY ' . $period . ' (Jan–Des)',
            ];
        }

        if (!$period || !preg_match('/^\\d{6}$/', $period)) {
            return null;
        }

        $month = Carbon::createFromFormat('Ym', $period)->startOfMonth();
        return [
            'period_type' => 'month',
            'period' => $period,
            'start' => $month->copy()->startOfMonth(),
            'end' => $month->copy()->endOfMonth(),
            'label' => $month->locale('id')->translatedFormat('M Y'),
        ];
    }

    private function getAccountOptions(): array
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Akun')) {
            return [];
        }

        $nabbName = $this->nabbNameAvailable();
        try {
            $q = DB::table('tb_kas as k')
                ->selectRaw('DISTINCT k.Kode_Akun as Kode_Akun')
                ->whereNotNull('k.Kode_Akun')
                ->orderBy('Kode_Akun', 'asc');

            $codes = $q->pluck('Kode_Akun')->map(fn ($c) => (string) $c)->filter()->values()->all();
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
        $opts = $this->getAccountOptions();
        return $opts[0]['value'] ?? null;
    }

    public function index(Request $request)
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();
        $defaultAccount = $this->getDefaultAccount();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');
        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('laporan/buku-kas/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'account' => (string) $request->query('account', $defaultAccount ?: 'all'),
                'flow' => (string) $request->query('flow', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Tgl_Voucher'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
                'pageSize' => $request->query('pageSize', 10),
            ],
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $defaultAccount,
        ]);
    }

    public function print(Request $request)
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();
        $defaultAccount = $this->getDefaultAccount();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');
        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('laporan/buku-kas/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'account' => (string) $request->query('account', $defaultAccount ?: 'all'),
                'flow' => (string) $request->query('flow', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Tgl_Voucher'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
            ],
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $defaultAccount,
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kas')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_balance' => null,
                        'closing_balance' => null,
                        'total_in' => 0,
                        'total_out' => 0,
                        'net_change' => 0,
                        'count_voucher' => 0,
                    ],
                    'error' => 'Tabel tb_kas tidak ditemukan.',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'opening_balance' => null,
                            'closing_balance' => null,
                            'total_in' => 0,
                            'total_out' => 0,
                            'net_change' => 0,
                            'count_voucher' => 0,
                        ],
                        'error' => "Kolom tb_kas.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $hasTglBuat = in_array('Tgl_Buat', $cols, true);
            $hasB1 = in_array('Kode_Akun1', $cols, true) && in_array('Nominal1', $cols, true);
            $hasB2 = in_array('Kode_Akun2', $cols, true) && in_array('Nominal2', $cols, true);
            $hasB3 = in_array('Kode_Akun3', $cols, true) && in_array('Nominal3', $cols, true);
            $hasJenis1 = in_array('Jenis_Beban1', $cols, true);
            $hasJenis2 = in_array('Jenis_Beban2', $cols, true);
            $hasJenis3 = in_array('Jenis_Beban3', $cols, true);

            $periodType = (string) $request->query('periodType', 'month');
            $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';

            $period = (string) $request->query('period', '');
            if ($period === '') {
                $period = $periodType === 'year'
                    ? (string) ($this->getDefaultYear() ?? '')
                    : (string) ($this->getDefaultPeriod() ?? '');
            }

            $periodRange = $this->parsePeriodToRange($periodType, $period);
            if (!$periodRange) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_balance' => null,
                        'closing_balance' => null,
                        'total_in' => 0,
                        'total_out' => 0,
                        'net_change' => 0,
                        'count_voucher' => 0,
                    ],
                    'error' => $periodType === 'year'
                        ? 'Periode tidak valid. Gunakan format YYYY (contoh 2026).'
                        : 'Periode tidak valid. Gunakan format YYYYMM (contoh 202601).',
                ], 500);
            }

            $account = (string) $request->query('account', '');
            if ($account === '') {
                $account = (string) ($this->getDefaultAccount() ?? 'all');
            }

            $flow = strtolower((string) $request->query('flow', 'all'));
            $flow = in_array($flow, ['all', 'in', 'out'], true) ? $flow : 'all';

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Tgl_Voucher');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'desc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'desc';

            $allowedSortBy = [
                'Tgl_Voucher' => 'k.Tgl_Voucher',
                'Kode_Voucher' => 'k.Kode_Voucher',
                'Mutasi' => 'k.Mutasi_Kas',
                'Saldo' => 'k.Saldo',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'k.Tgl_Voucher';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $start = $periodRange['start']->toDateString();
            $end = $periodRange['end']->toDateString();

            $filtered = DB::table('tb_kas as k')
                ->whereBetween('k.Tgl_Voucher', [$start, $end]);

            if ($account !== 'all') {
                $filtered->where('k.Kode_Akun', '=', $account);
            }

            if ($flow === 'in') {
                $filtered->where('k.Mutasi_Kas', '>', 0);
            } elseif ($flow === 'out') {
                $filtered->where('k.Mutasi_Kas', '<', 0);
            }

            if ($search !== '') {
                $filtered->where(function ($q) use ($search, $hasB1, $hasB2, $hasB3, $hasJenis1, $hasJenis2, $hasJenis3) {
                    $q->where('k.Kode_Voucher', 'like', '%' . $search . '%')
                        ->orWhere('k.Keterangan', 'like', '%' . $search . '%');
                    if ($hasB1) {
                        $q->orWhere('k.Kode_Akun1', 'like', '%' . $search . '%');
                    }
                    if ($hasB2) {
                        $q->orWhere('k.Kode_Akun2', 'like', '%' . $search . '%');
                    }
                    if ($hasB3) {
                        $q->orWhere('k.Kode_Akun3', 'like', '%' . $search . '%');
                    }
                    if ($hasJenis1) {
                        $q->orWhere('k.Jenis_Beban1', 'like', '%' . $search . '%');
                    }
                    if ($hasJenis2) {
                        $q->orWhere('k.Jenis_Beban2', 'like', '%' . $search . '%');
                    }
                    if ($hasJenis3) {
                        $q->orWhere('k.Jenis_Beban3', 'like', '%' . $search . '%');
                    }
                });
            }

            $total = (int) (clone $filtered)->count();

            $summaryTotals = (clone $filtered)
                ->selectRaw('COUNT(*) as count_voucher')
                ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(k.Mutasi_Kas,0) > 0 THEN COALESCE(k.Mutasi_Kas,0) ELSE 0 END),0) as total_in')
                ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(k.Mutasi_Kas,0) < 0 THEN -COALESCE(k.Mutasi_Kas,0) ELSE 0 END),0) as total_out')
                ->selectRaw('COALESCE(SUM(COALESCE(k.Mutasi_Kas,0)),0) as net_change')
                ->first();

            $opening = null;
            $closing = null;
            if ($account !== 'all') {
                $openingRow = DB::table('tb_kas as k')
                    ->where('k.Kode_Akun', '=', $account)
                    ->where('k.Tgl_Voucher', '<', $start)
                    ->orderBy('k.Tgl_Voucher', 'desc')
                    ->orderBy('k.Kode_Voucher', 'desc')
                    ->select([DB::raw('COALESCE(k.Saldo,0) as Saldo')])
                    ->first();

                if ($openingRow) {
                    $opening = (float) ($openingRow->Saldo ?? 0);
                } else {
                    $firstInRange = DB::table('tb_kas as k')
                        ->where('k.Kode_Akun', '=', $account)
                        ->whereBetween('k.Tgl_Voucher', [$start, $end])
                        ->orderBy('k.Tgl_Voucher', 'asc')
                        ->orderBy('k.Kode_Voucher', 'asc')
                        ->select([
                            DB::raw('COALESCE(k.Saldo,0) as Saldo'),
                            DB::raw('COALESCE(k.Mutasi_Kas,0) as Mutasi_Kas'),
                        ])
                        ->first();

                    if ($firstInRange) {
                        $opening = (float) ($firstInRange->Saldo ?? 0) - (float) ($firstInRange->Mutasi_Kas ?? 0);
                    } else {
                        $opening = 0.0;
                    }
                }

                $closingRow = DB::table('tb_kas as k')
                    ->where('k.Kode_Akun', '=', $account)
                    ->where('k.Tgl_Voucher', '<=', $end)
                    ->orderBy('k.Tgl_Voucher', 'desc')
                    ->orderBy('k.Kode_Voucher', 'desc')
                    ->select([DB::raw('COALESCE(k.Saldo,0) as Saldo')])
                    ->first();
                $closing = $closingRow ? (float) ($closingRow->Saldo ?? 0) : (float) ($opening ?? 0);
            }

            $select = [
                'k.Kode_Voucher',
                'k.Kode_Akun',
                'k.Tgl_Voucher',
                $hasTglBuat ? 'k.Tgl_Buat' : DB::raw("'' as Tgl_Buat"),
                'k.Keterangan',
                DB::raw('COALESCE(k.Mutasi_Kas,0) as Mutasi_Kas'),
                DB::raw('COALESCE(k.Saldo,0) as Saldo'),
                $hasB1 ? 'k.Kode_Akun1' : DB::raw("'' as Kode_Akun1"),
                $hasJenis1 ? 'k.Jenis_Beban1' : DB::raw("'' as Jenis_Beban1"),
                $hasB1 ? DB::raw('COALESCE(k.Nominal1,0) as Nominal1') : DB::raw('0 as Nominal1'),
                $hasB2 ? 'k.Kode_Akun2' : DB::raw("'' as Kode_Akun2"),
                $hasJenis2 ? 'k.Jenis_Beban2' : DB::raw("'' as Jenis_Beban2"),
                $hasB2 ? DB::raw('COALESCE(k.Nominal2,0) as Nominal2') : DB::raw('0 as Nominal2'),
                $hasB3 ? 'k.Kode_Akun3' : DB::raw("'' as Kode_Akun3"),
                $hasJenis3 ? 'k.Jenis_Beban3' : DB::raw("'' as Jenis_Beban3"),
                $hasB3 ? DB::raw('COALESCE(k.Nominal3,0) as Nominal3') : DB::raw('0 as Nominal3'),
            ];

            $rowsQuery = (clone $filtered)->select($select)
                ->orderBy($sortBy, $sortDir)
                ->orderBy('k.Kode_Voucher', 'desc');

            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();
            $rows = [];
            foreach ($rawRows as $r) {
                $mutasi = (float) ($r->Mutasi_Kas ?? 0);
                $direction = $mutasi > 0 ? 'in' : ($mutasi < 0 ? 'out' : 'neutral');

                $breakdowns = [];
                foreach ([1, 2, 3] as $i) {
                    $kode = (string) ($r->{'Kode_Akun' . $i} ?? '');
                    $nominal = (float) ($r->{'Nominal' . $i} ?? 0);
                    $jenis = (string) ($r->{'Jenis_Beban' . $i} ?? '');
                    if (trim($kode) === '' && trim($jenis) === '' && $nominal == 0.0) {
                        continue;
                    }
                    $breakdowns[] = [
                        'kode_akun' => $kode,
                        'jenis_beban' => $jenis,
                        'nominal' => $nominal,
                    ];
                }

                $rows[] = [
                    'Kode_Voucher' => (string) ($r->Kode_Voucher ?? ''),
                    'Tgl_Voucher' => (string) ($r->Tgl_Voucher ?? ''),
                    'Tgl_Buat' => (string) ($r->Tgl_Buat ?? ''),
                    'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                    'Keterangan' => (string) ($r->Keterangan ?? ''),
                    'Mutasi_Kas' => $mutasi,
                    'Saldo' => (float) ($r->Saldo ?? 0),
                    'direction' => $direction,
                    'breakdowns' => $breakdowns,
                ];
            }

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodRange['period_type'],
                'period' => $periodRange['period'],
                'period_label' => $periodRange['label'],
                'summary' => [
                    'opening_balance' => $opening,
                    'closing_balance' => $closing,
                    'total_in' => (float) ($summaryTotals->total_in ?? 0),
                    'total_out' => (float) ($summaryTotals->total_out ?? 0),
                    'net_change' => (float) ($summaryTotals->net_change ?? 0),
                    'count_voucher' => (int) ($summaryTotals->count_voucher ?? 0),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'opening_balance' => null,
                    'closing_balance' => null,
                    'total_in' => 0,
                    'total_out' => 0,
                    'net_change' => 0,
                    'count_voucher' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

