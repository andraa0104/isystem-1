<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class RugiLabaController
{
    private function getPeriodOptions(): array
    {
        if (Schema::hasTable('tb_nabbrekap') && Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')) {
            try {
                return DB::table('tb_nabbrekap')
                    ->selectRaw('DISTINCT RIGHT(Kode_NaBB, 6) as period')
                    ->whereNotNull('Kode_NaBB')
                    ->orderByDesc('period')
                    ->pluck('period')
                    ->filter(fn ($p) => is_string($p) && preg_match('/^\\d{6}$/', $p))
                    ->values()
                    ->all();
            } catch (\Throwable) {
                // fall through
            }
        }

        if (Schema::hasTable('tb_jurnal') && Schema::hasColumn('tb_jurnal', 'Tgl_Jurnal')) {
            try {
                return DB::table('tb_jurnal')
                    ->selectRaw("DISTINCT DATE_FORMAT(Tgl_Jurnal, '%Y%m') as period")
                    ->whereNotNull('Tgl_Jurnal')
                    ->orderByDesc('period')
                    ->limit(120)
                    ->pluck('period')
                    ->filter(fn ($p) => is_string($p) && preg_match('/^\\d{6}$/', $p))
                    ->values()
                    ->all();
            } catch (\Throwable) {
                // ignore
            }
        }

        return [];
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

    private function pickNameJoin(): array
    {
        // Prefer tb_nabb mapping.
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun')) {
            return [
                'join' => ['tb_nabb as n', 'n.Kode_Akun', '=', 'x.Kode_Akun'],
                'name_select' => 'n.Nama_Akun as Nama_Akun',
                'name_where' => 'n.Nama_Akun',
                'name_sort' => 'n.Nama_Akun',
            ];
        }

        // Fallback to tb_jurnalpenyesuaian.Nama_Akun if exists (max name per account).
        if (Schema::hasTable('tb_jurnalpenyesuaian') && Schema::hasColumn('tb_jurnalpenyesuaian', 'Nama_Akun')) {
            $nameSub = DB::table('tb_jurnalpenyesuaian')
                ->select('Kode_Akun', DB::raw('MAX(Nama_Akun) as Nama_Akun'))
                ->groupBy('Kode_Akun');

            return [
                'joinSub' => [$nameSub, 'n', function ($join) {
                    $join->on('n.Kode_Akun', '=', 'x.Kode_Akun');
                }],
                'name_select' => 'n.Nama_Akun as Nama_Akun',
                'name_where' => 'n.Nama_Akun',
                'name_sort' => 'n.Nama_Akun',
            ];
        }

        return [
            'join' => null,
            'name_select' => DB::raw("'' as Nama_Akun"),
            'name_where' => null,
            'name_sort' => null,
        ];
    }

    private function groupFromCode(string $code): string
    {
        $first = substr(trim($code), 0, 1);
        return match ($first) {
            '4' => 'pendapatan',
            '5' => 'hpp',
            '6' => 'beban_operasional',
            '7' => 'lain_lain',
            default => 'lainnya',
        };
    }

    public function index(Request $request)
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('laporan/rugi-laba/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
                'pageSize' => $request->query('pageSize', 10),
            ],
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
        ]);
    }

    public function print(Request $request)
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('laporan/rugi-laba/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
            ],
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
        ]);
    }

    public function rows(Request $request)
    {
        try {
            foreach (['tb_jurnal', 'tb_jurnaldetail', 'tb_jurnalpenyesuaian'] as $tbl) {
                if (!Schema::hasTable($tbl)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_pendapatan' => 0,
                            'total_hpp' => 0,
                            'laba_kotor' => 0,
                            'total_beban_operasional' => 0,
                            'laba_usaha' => 0,
                            'total_lain_lain_net' => 0,
                            'laba_bersih' => 0,
                        ],
                        'error' => "Tabel $tbl tidak ditemukan.",
                    ], 500);
                }
            }

            foreach (['Kode_Jurnal', 'Tgl_Jurnal'] as $col) {
                if (!Schema::hasColumn('tb_jurnal', $col)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_pendapatan' => 0,
                            'total_hpp' => 0,
                            'laba_kotor' => 0,
                            'total_beban_operasional' => 0,
                            'laba_usaha' => 0,
                            'total_lain_lain_net' => 0,
                            'laba_bersih' => 0,
                        ],
                        'error' => "Kolom tb_jurnal.$col tidak ditemukan.",
                    ], 500);
                }
            }

            foreach (['Kode_Jurnal', 'Kode_Akun', 'Debit', 'Kredit'] as $col) {
                if (!Schema::hasColumn('tb_jurnaldetail', $col)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_pendapatan' => 0,
                            'total_hpp' => 0,
                            'laba_kotor' => 0,
                            'total_beban_operasional' => 0,
                            'laba_usaha' => 0,
                            'total_lain_lain_net' => 0,
                            'laba_bersih' => 0,
                        ],
                        'error' => "Kolom tb_jurnaldetail.$col tidak ditemukan.",
                    ], 500);
                }
            }

            foreach (['Periode', 'Kode_Akun', 'Debit', 'Kredit'] as $col) {
                if (!Schema::hasColumn('tb_jurnalpenyesuaian', $col)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_pendapatan' => 0,
                            'total_hpp' => 0,
                            'laba_kotor' => 0,
                            'total_beban_operasional' => 0,
                            'laba_usaha' => 0,
                            'total_lain_lain_net' => 0,
                            'laba_bersih' => 0,
                        ],
                        'error' => "Kolom tb_jurnalpenyesuaian.$col tidak ditemukan.",
                    ], 500);
                }
            }

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
                        'total_pendapatan' => 0,
                        'total_hpp' => 0,
                        'laba_kotor' => 0,
                        'total_beban_operasional' => 0,
                        'laba_usaha' => 0,
                        'total_lain_lain_net' => 0,
                        'laba_bersih' => 0,
                    ],
                    'error' => $periodType === 'year'
                        ? 'Periode tidak valid. Gunakan format YYYY (contoh 2018).'
                        : 'Periode tidak valid. Gunakan format YYYYMM (contoh 201812).',
                ], 500);
            }

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $start = $periodRange['start']->toDateString();
            $end = $periodRange['end']->toDateString();

            $trx = DB::table('tb_jurnaldetail as d')
                ->join('tb_jurnal as j', 'j.Kode_Jurnal', '=', 'd.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [$start, $end])
                ->select([
                    'd.Kode_Akun as Kode_Akun',
                    DB::raw('SUM(COALESCE(d.Debit,0)) as Debit'),
                    DB::raw('SUM(COALESCE(d.Kredit,0)) as Kredit'),
                ])
                ->groupBy('d.Kode_Akun');

            $ajp = DB::table('tb_jurnalpenyesuaian as a')
                ->whereBetween('a.Periode', [$start, $end])
                ->select([
                    'a.Kode_Akun as Kode_Akun',
                    DB::raw('SUM(COALESCE(a.Debit,0)) as Debit'),
                    DB::raw('SUM(COALESCE(a.Kredit,0)) as Kredit'),
                ])
                ->groupBy('a.Kode_Akun');

            $union = $trx->unionAll($ajp);
            $baseAgg = DB::query()
                ->fromSub($union, 'u')
                ->select([
                    'Kode_Akun',
                    DB::raw('SUM(COALESCE(Debit,0)) as Debit'),
                    DB::raw('SUM(COALESCE(Kredit,0)) as Kredit'),
                ])
                ->groupBy('Kode_Akun')
                ->whereRaw("LEFT(Kode_Akun, 1) IN ('4','5','6','7')");

            $nameInfo = $this->pickNameJoin();

            $baseWithName = DB::query()->fromSub($baseAgg, 'x');
            if (isset($nameInfo['joinSub'])) {
                $baseWithName->leftJoinSub(...$nameInfo['joinSub']);
            } elseif (!empty($nameInfo['join'])) {
                $baseWithName->leftJoin(...$nameInfo['join']);
            }

            if ($search !== '') {
                $baseWithName->where(function ($q) use ($search, $nameInfo) {
                    $q->where('x.Kode_Akun', 'like', '%' . $search . '%');
                    if (!empty($nameInfo['name_where'])) {
                        $q->orWhere($nameInfo['name_where'], 'like', '%' . $search . '%');
                    }
                });
            }

            $total = (int) (clone $baseWithName)->count();

            $netExpr = '(COALESCE(x.Kredit,0) - COALESCE(x.Debit,0))';
            $allowedSortBy = [
                'Kode_Akun' => 'x.Kode_Akun',
                'Nama_Akun' => $nameInfo['name_sort'] ?: 'x.Kode_Akun',
                'Amount' => 'Amount',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'x.Kode_Akun';

            $sortedRowsQuery = (clone $baseWithName)->select([
                'x.Kode_Akun',
                $nameInfo['name_select'],
                'x.Debit',
                'x.Kredit',
                DB::raw($netExpr . ' as Net'),
            ]);

            if ($sortByRaw === 'Amount') {
                $sortedRowsQuery->orderByRaw($netExpr . ' ' . $sortDir);
            } else {
                $sortedRowsQuery->orderBy($sortBy, $sortDir);
            }

            $rowsQuery = (clone $sortedRowsQuery);
            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();
            $rawRowsForSummary = $pageSize === 'all'
                ? $rawRows
                : (clone $baseWithName)->select(['x.Kode_Akun', 'x.Debit', 'x.Kredit'])->get();

            $sumPendapatan = 0.0;
            $sumHpp = 0.0;
            $sumBebanOperasional = 0.0;
            $sumPendapatanLain = 0.0;
            $sumBebanLain = 0.0;

            $drivers = [
                'pendapatan' => [],
                'hpp' => [],
                'beban_operasional' => [],
                'pendapatan_lain' => [],
                'beban_lain' => [],
            ];

            $accumulate = function ($r) use (&$sumPendapatan, &$sumHpp, &$sumBebanOperasional, &$sumPendapatanLain, &$sumBebanLain) {
                $code = (string) ($r->Kode_Akun ?? '');
                $debit = (float) ($r->Debit ?? 0);
                $kredit = (float) ($r->Kredit ?? 0);
                $net = $kredit - $debit;
                $group = $this->groupFromCode($code);

                if ($group === 'pendapatan') {
                    $sumPendapatan += max($net, 0);
                    return;
                }

                if ($group === 'hpp') {
                    $sumHpp += max(-$net, 0);
                    return;
                }

                if ($group === 'beban_operasional') {
                    $sumBebanOperasional += max(-$net, 0);
                    return;
                }

                if ($net >= 0) {
                    $sumPendapatanLain += $net;
                    return;
                }

                $sumBebanLain += -$net;
            };

            foreach ($rawRowsForSummary as $r) {
                $accumulate($r);
            }

            // Drivers: compute from full filtered dataset (same base used for summary).
            $rawRowsForDrivers = $rawRowsForSummary;
            if ($pageSize !== 'all') {
                // Ensure Nama_Akun is included for drivers (use baseWithName).
                $rawRowsForDrivers = (clone $baseWithName)->select([
                    'x.Kode_Akun',
                    $nameInfo['name_select'],
                    'x.Debit',
                    'x.Kredit',
                ])->get();
            }

            foreach ($rawRowsForDrivers as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $name = (string) ($r->Nama_Akun ?? '');
                $debit = (float) ($r->Debit ?? 0);
                $kredit = (float) ($r->Kredit ?? 0);
                $net = $kredit - $debit;
                $group = $this->groupFromCode($code);

                $bucket = null;
                $amount = 0.0;

                if ($group === 'pendapatan') {
                    $bucket = 'pendapatan';
                    $amount = max($net, 0);
                } elseif ($group === 'hpp') {
                    $bucket = 'hpp';
                    $amount = max(-$net, 0);
                } elseif ($group === 'beban_operasional') {
                    $bucket = 'beban_operasional';
                    $amount = max(-$net, 0);
                } else {
                    if ($net >= 0) {
                        $bucket = 'pendapatan_lain';
                        $amount = $net;
                    } else {
                        $bucket = 'beban_lain';
                        $amount = -$net;
                    }
                }

                if ($amount <= 0) {
                    continue;
                }

                $drivers[$bucket][] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => $name,
                    'amount' => $amount,
                ];
            }

            foreach (array_keys($drivers) as $k) {
                usort($drivers[$k], fn ($a, $b) => ($b['amount'] <=> $a['amount']));
                $drivers[$k] = array_slice($drivers[$k], 0, 10);
            }

            $rows = [];
            foreach ($rawRows as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $name = (string) ($r->Nama_Akun ?? '');
                $debit = (float) ($r->Debit ?? 0);
                $kredit = (float) ($r->Kredit ?? 0);
                $net = (float) ($r->Net ?? ($kredit - $debit));
                $group = $this->groupFromCode($code);

                $subgroup = null;
                $amountDisplay = 0.0;
                $isAnomaly = false;

                if ($group === 'pendapatan') {
                    $amountDisplay = max($net, 0);
                    $isAnomaly = $net < 0;
                } elseif ($group === 'hpp' || $group === 'beban_operasional') {
                    $amountDisplay = max(-$net, 0);
                    $isAnomaly = $net > 0;
                } else {
                    if ($net >= 0) {
                        $subgroup = 'pendapatan_lain';
                        $amountDisplay = $net;
                    } else {
                        $subgroup = 'beban_lain';
                        $amountDisplay = -$net;
                    }
                }

                $rows[] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => $name,
                    'debit' => $debit,
                    'kredit' => $kredit,
                    'net' => $net,
                    'group' => $group,
                    'subgroup' => $subgroup,
                    'amount_display' => $amountDisplay,
                    'is_anomaly' => $isAnomaly,
                ];
            }

            $totalPendapatan = $sumPendapatan + $sumPendapatanLain;
            $labaKotor = $totalPendapatan - $sumHpp;
            $labaUsaha = $labaKotor - $sumBebanOperasional;
            $totalLainLainNet = $sumPendapatanLain - $sumBebanLain;
            $labaBersih = $labaUsaha + $totalLainLainNet;

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodType,
                'period' => $periodRange['period'],
                'period_label' => $periodRange['label'],
                'summary' => [
                    'total_pendapatan' => $totalPendapatan,
                    'total_hpp' => $sumHpp,
                    'laba_kotor' => $labaKotor,
                    'total_beban_operasional' => $sumBebanOperasional,
                    'laba_usaha' => $labaUsaha,
                    'total_lain_lain_net' => $totalLainLainNet,
                    'laba_bersih' => $labaBersih,
                    'drivers' => $drivers,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_pendapatan' => 0,
                    'total_hpp' => 0,
                    'laba_kotor' => 0,
                    'total_beban_operasional' => 0,
                    'laba_usaha' => 0,
                    'total_lain_lain_net' => 0,
                    'laba_bersih' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // Old implementation removed: previously sourced from tb_neracalajur RL_*
    /*
    public function rows(Request $request) { ... }
    */
}
