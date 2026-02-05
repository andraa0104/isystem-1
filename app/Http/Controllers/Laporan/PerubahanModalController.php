<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class PerubahanModalController
{
    private function getPeriodOptions(): array
    {
        if (!Schema::hasTable('tb_nabbrekap') || !Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')) {
            return [];
        }

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

    private function pickNameSource(): array
    {
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun')) {
            return [
                'join' => ['tb_nabb', 'tb_nabb.Kode_Akun', '=', 'a.Kode_Akun'],
                'select' => 'tb_nabb.Nama_Akun as Nama_Akun',
                'where' => 'tb_nabb.Nama_Akun',
                'sort' => 'tb_nabb.Nama_Akun',
            ];
        }

        return [
            'join' => null,
            'select' => DB::raw("'' as Nama_Akun"),
            'where' => null,
            'sort' => null,
        ];
    }

    private function buildPeriodMeta(Request $request): array
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';

        $requestedPeriod = (string) $request->query('period', '');
        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return [
            'periodType' => $periodType,
            'period' => $initialPeriod,
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
        ];
    }

    public function index(Request $request)
    {
        $meta = $this->buildPeriodMeta($request);

        return Inertia::render('laporan/perubahan-modal/index', [
            'initialQuery' => [
                'periodType' => $meta['periodType'],
                'period' => $meta['period'],
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Net'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
                'pageSize' => $request->query('pageSize', 25),
            ],
            'periodOptions' => $meta['periodOptions'],
            'defaultPeriod' => $meta['defaultPeriod'],
            'yearOptions' => $meta['yearOptions'],
            'defaultYear' => $meta['defaultYear'],
        ]);
    }

    public function print(Request $request)
    {
        $meta = $this->buildPeriodMeta($request);

        return Inertia::render('laporan/perubahan-modal/print', [
            'initialQuery' => [
                'periodType' => $meta['periodType'],
                'period' => $meta['period'],
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Net'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
            ],
            'periodOptions' => $meta['periodOptions'],
            'defaultPeriod' => $meta['defaultPeriod'],
            'yearOptions' => $meta['yearOptions'],
            'defaultYear' => $meta['defaultYear'],
        ]);
    }

    private function getLatestMonthInYear(string $year): ?string
    {
        if (!Schema::hasTable('tb_nabbrekap') || !Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')) {
            return null;
        }

        try {
            $p = DB::table('tb_nabbrekap')
                ->selectRaw('MAX(RIGHT(Kode_NaBB, 6)) as p')
                ->whereRaw('RIGHT(Kode_NaBB, 6) LIKE ?', [$year . '%'])
                ->value('p');
            return is_string($p) && preg_match('/^\\d{6}$/', $p) ? $p : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function getPrevMonth(string $period): ?string
    {
        if (!preg_match('/^\\d{6}$/', $period)) {
            return null;
        }

        try {
            return Carbon::createFromFormat('Ym', $period)->subMonthNoOverflow()->format('Ym');
        } catch (\Throwable) {
            return null;
        }
    }

    private function sumEquitySnapshot(?string $period): float
    {
        if (!$period) {
            return 0.0;
        }

        if (!Schema::hasTable('tb_nabbrekap') || !Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB') || !Schema::hasColumn('tb_nabbrekap', 'Kode_Akun') || !Schema::hasColumn('tb_nabbrekap', 'Saldo')) {
            return 0.0;
        }

        $sum = DB::table('tb_nabbrekap as n')
            ->whereRaw('RIGHT(n.Kode_NaBB, 6) = ?', [$period])
            ->where('n.Kode_Akun', 'like', '3%')
            ->selectRaw('COALESCE(SUM(ABS(COALESCE(n.Saldo,0))),0) as total')
            ->value('total');

        return (float) ($sum ?? 0);
    }

    private function sumNetIncome(Carbon $start, Carbon $end): float
    {
        // Net income = sum(kredit - debit) for nominal accounts (prefix 4-7) from transaksi + AJP in period.
        if (!Schema::hasTable('tb_jurnaldetail') || !Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnalpenyesuaian')) {
            return 0.0;
        }

        foreach ([
            ['tb_jurnal', 'Kode_Jurnal'],
            ['tb_jurnal', 'Tgl_Jurnal'],
            ['tb_jurnaldetail', 'Kode_Jurnal'],
            ['tb_jurnaldetail', 'Kode_Akun'],
            ['tb_jurnaldetail', 'Debit'],
            ['tb_jurnaldetail', 'Kredit'],
            ['tb_jurnalpenyesuaian', 'Periode'],
            ['tb_jurnalpenyesuaian', 'Kode_Akun'],
            ['tb_jurnalpenyesuaian', 'Debit'],
            ['tb_jurnalpenyesuaian', 'Kredit'],
        ] as [$table, $col]) {
            if (!Schema::hasColumn($table, $col)) {
                return 0.0;
            }
        }

        $prefixFilter = function ($q, string $col) {
            $q->where(function ($w) use ($col) {
                $w->where($col, 'like', '4%')
                    ->orWhere($col, 'like', '5%')
                    ->orWhere($col, 'like', '6%')
                    ->orWhere($col, 'like', '7%');
            });
        };

        $trx = DB::table('tb_jurnal as j')
            ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
            ->whereBetween('j.Tgl_Jurnal', [$start->toDateString(), $end->toDateString()])
            ->tap(fn ($q) => $prefixFilter($q, 'd.Kode_Akun'))
            ->selectRaw('d.Kode_Akun as Kode_Akun, COALESCE(d.Debit,0) as debit, COALESCE(d.Kredit,0) as kredit');

        $ajp = DB::table('tb_jurnalpenyesuaian as p')
            ->whereBetween('p.Periode', [$start->toDateString(), $end->toDateString()])
            ->tap(fn ($q) => $prefixFilter($q, 'p.Kode_Akun'))
            ->selectRaw('p.Kode_Akun as Kode_Akun, COALESCE(p.Debit,0) as debit, COALESCE(p.Kredit,0) as kredit');

        $union = $trx->unionAll($ajp);

        $net = DB::query()
            ->fromSub($union, 'u')
            ->selectRaw('COALESCE(SUM(u.kredit - u.debit),0) as net_income')
            ->value('net_income');

        return (float) ($net ?? 0);
    }

    private function buildEquityMovementBase(Carbon $start, Carbon $end)
    {
        // Returns Query\Builder for aggregated movement per Kode_Akun (prefix 3) from transaksi + AJP.
        if (!Schema::hasTable('tb_jurnaldetail') || !Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnalpenyesuaian')) {
            return null;
        }

        foreach ([
            ['tb_jurnal', 'Kode_Jurnal'],
            ['tb_jurnal', 'Tgl_Jurnal'],
            ['tb_jurnaldetail', 'Kode_Jurnal'],
            ['tb_jurnaldetail', 'Kode_Akun'],
            ['tb_jurnaldetail', 'Debit'],
            ['tb_jurnaldetail', 'Kredit'],
            ['tb_jurnalpenyesuaian', 'Periode'],
            ['tb_jurnalpenyesuaian', 'Kode_Akun'],
            ['tb_jurnalpenyesuaian', 'Debit'],
            ['tb_jurnalpenyesuaian', 'Kredit'],
        ] as [$table, $col]) {
            if (!Schema::hasColumn($table, $col)) {
                return null;
            }
        }

        $trx = DB::table('tb_jurnal as j')
            ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
            ->whereBetween('j.Tgl_Jurnal', [$start->toDateString(), $end->toDateString()])
            ->where('d.Kode_Akun', 'like', '3%')
            ->selectRaw('d.Kode_Akun as Kode_Akun, COALESCE(d.Debit,0) as debit, COALESCE(d.Kredit,0) as kredit');

        $ajp = DB::table('tb_jurnalpenyesuaian as p')
            ->whereBetween('p.Periode', [$start->toDateString(), $end->toDateString()])
            ->where('p.Kode_Akun', 'like', '3%')
            ->selectRaw('p.Kode_Akun as Kode_Akun, COALESCE(p.Debit,0) as debit, COALESCE(p.Kredit,0) as kredit');

        $union = $trx->unionAll($ajp);

        return DB::query()
            ->fromSub($union, 'u')
            ->selectRaw('u.Kode_Akun as Kode_Akun')
            ->selectRaw('COALESCE(SUM(u.debit),0) as debit')
            ->selectRaw('COALESCE(SUM(u.kredit),0) as kredit')
            ->selectRaw('COALESCE(SUM(u.kredit - u.debit),0) as net')
            ->groupBy('u.Kode_Akun');
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_nabbrekap')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_equity' => 0,
                        'contributions' => 0,
                        'withdrawals' => 0,
                        'net_income' => 0,
                        'computed_ending_equity' => 0,
                        'snapshot_ending_equity' => 0,
                        'diff' => 0,
                    ],
                    'error' => 'Tabel tb_nabbrekap tidak ditemukan (dibutuhkan untuk snapshot modal).',
                ], 500);
            }

            $periodType = (string) $request->query('periodType', 'month');
            $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
            $period = (string) $request->query('period', '');

            $defaultPeriod = $this->getDefaultPeriod();
            $defaultYear = $this->getDefaultYear();

            if ($period === '') {
                $period = $periodType === 'year' ? ($defaultYear ?: '') : ($defaultPeriod ?: '');
            }

            $range = $this->parsePeriodToRange($periodType, $period);
            if (!$range) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_equity' => 0,
                        'contributions' => 0,
                        'withdrawals' => 0,
                        'net_income' => 0,
                        'computed_ending_equity' => 0,
                        'snapshot_ending_equity' => 0,
                        'diff' => 0,
                    ],
                    'error' => 'Periode tidak valid.',
                ], 500);
            }

            $effectivePeriod = null;
            $effectivePeriodLabel = null;
            if ($periodType === 'year') {
                $effectivePeriod = $this->getLatestMonthInYear($range['period']);
                if ($effectivePeriod) {
                    try {
                        $effectivePeriodLabel = Carbon::createFromFormat('Ym', $effectivePeriod)
                            ->locale('id')
                            ->translatedFormat('M Y') . ' (snapshot)';
                    } catch (\Throwable) {
                        $effectivePeriodLabel = $effectivePeriod . ' (snapshot)';
                    }
                }
            } else {
                $effectivePeriod = $range['period'];
                $effectivePeriodLabel = $range['label'];
            }

            $openingPeriod = null;
            if ($periodType === 'month') {
                $openingPeriod = $this->getPrevMonth($effectivePeriod ?: $range['period']);
            } else {
                $openingPeriod = $this->getLatestMonthInYear((string) ((int) $range['period'] - 1));
            }

            $openingEquity = $this->sumEquitySnapshot($openingPeriod);
            $snapshotEndingEquity = $this->sumEquitySnapshot($effectivePeriod);

            $netIncome = $this->sumNetIncome($range['start'], $range['end']);

            $movementBase = $this->buildEquityMovementBase($range['start'], $range['end']);
            $allMovements = $movementBase ? $movementBase->get() : collect();

            $contributions = 0.0;
            $withdrawals = 0.0;
            foreach ($allMovements as $m) {
                $net = (float) ($m->net ?? 0);
                if ($net > 0) {
                    $contributions += $net;
                } elseif ($net < 0) {
                    $withdrawals += -$net;
                }
            }

            $computedEnding = $openingEquity + $contributions + $netIncome - $withdrawals;
            $diff = $snapshotEndingEquity - $computedEnding;

            // Rows table: movements per equity account (prefix 3)
            $search = trim((string) $request->query('search', ''));
            $sortBy = (string) $request->query('sortBy', 'Net');
            $sortDir = (string) $request->query('sortDir', 'desc');
            $sortDir = in_array($sortDir, ['asc', 'desc'], true) ? $sortDir : 'desc';

            $pageSize = $request->query('pageSize', 25);
            $page = max(1, (int) $request->query('page', 1));

            $pageSizeIsAll = is_string($pageSize) && strtolower($pageSize) === 'all';
            $pageSizeInt = $pageSizeIsAll ? null : max(1, (int) $pageSize);

            $name = $this->pickNameSource();
            $base = $movementBase ?: DB::query()->fromRaw('(select 1) as a')->whereRaw('1=0');
            $base = DB::query()->fromSub($base, 'a')->select('a.Kode_Akun', 'a.debit', 'a.kredit', 'a.net');
            if ($name['join']) {
                $base->leftJoin(...$name['join']);
                $base->addSelect(DB::raw($name['select']));
            } else {
                $base->addSelect($name['select']);
            }

            if ($search !== '') {
                $base->where(function ($q) use ($search, $name) {
                    $q->where('a.Kode_Akun', 'like', '%' . $search . '%');
                    if ($name['where']) {
                        $q->orWhere($name['where'], 'like', '%' . $search . '%');
                    }
                });
            }

            $sortWhitelist = [
                'Kode_Akun' => 'a.Kode_Akun',
                'Nama_Akun' => $name['sort'] ?: 'a.Kode_Akun',
                'Net' => 'a.net',
                'Debit' => 'a.debit',
                'Kredit' => 'a.kredit',
            ];
            $sortCol = $sortWhitelist[$sortBy] ?? 'a.net';
            $base->orderBy($sortCol, $sortDir);
            if ($sortCol !== 'a.Kode_Akun') {
                $base->orderBy('a.Kode_Akun', 'asc');
            }

            $total = (int) (clone $base)->count();

            if (!$pageSizeIsAll && $pageSizeInt) {
                $base->forPage($page, $pageSizeInt);
            }

            $raw = $base->get();
            $rows = [];
            foreach ($raw as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $net = (float) ($r->net ?? 0);
                $rows[] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
                    'debit' => (float) ($r->debit ?? 0),
                    'kredit' => (float) ($r->kredit ?? 0),
                    'net' => $net,
                    'direction' => $net > 0 ? 'in' : ($net < 0 ? 'out' : 'neutral'),
                    'has_00' => str_contains($code, '00'),
                ];
            }

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodType,
                'period' => $range['period'],
                'period_label' => $range['label'],
                'effective_period' => $effectivePeriod,
                'effective_period_label' => $effectivePeriodLabel,
                'opening_period' => $openingPeriod,
                'summary' => [
                    'opening_equity' => $openingEquity,
                    'contributions' => $contributions,
                    'withdrawals' => $withdrawals,
                    'net_income' => $netIncome,
                    'computed_ending_equity' => $computedEnding,
                    'snapshot_ending_equity' => $snapshotEndingEquity,
                    'diff' => $diff,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'opening_equity' => 0,
                    'contributions' => 0,
                    'withdrawals' => 0,
                    'net_income' => 0,
                    'computed_ending_equity' => 0,
                    'snapshot_ending_equity' => 0,
                    'diff' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
