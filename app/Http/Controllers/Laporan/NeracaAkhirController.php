<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NeracaAkhirController
{
    private function pickNameColumn(): array
    {
        // Prefer tb_nabb.Nama_Akun if available.
        if (Schema::hasTable('tb_nabb')) {
            $cols = Schema::getColumnListing('tb_nabb');
            if (in_array('Nama_Akun', $cols, true)) {
                return [
                    'join' => ['tb_nabb', 'tb_nabb.Kode_Akun', '=', 'tb_nabbrekap.Kode_Akun'],
                    'name_select' => 'tb_nabb.Nama_Akun as Nama_Akun',
                    'name_where' => 'tb_nabb.Nama_Akun',
                    'name_sort' => 'tb_nabb.Nama_Akun',
                ];
            }
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
            '1' => 'aset',
            '2' => 'liabilitas',
            '3' => 'ekuitas',
            default => 'lainnya',
        };
    }

    private function getPeriodOptions(): array
    {
        if (!Schema::hasTable('tb_nabbrekap')) {
            return [];
        }

        if (!Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')) {
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

        return Inertia::render('laporan/neraca-akhir/index', [
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

        return Inertia::render('laporan/neraca-akhir/print', [
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
            if (!Schema::hasTable('tb_nabbrekap')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_aset' => 0,
                        'total_liabilitas' => 0,
                        'total_ekuitas' => 0,
                        'selisih' => 0,
                    ],
                    'error' => 'Tabel tb_nabbrekap tidak ditemukan.',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_nabbrekap');
            foreach (['Kode_NaBB', 'Kode_Akun'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_aset' => 0,
                            'total_liabilitas' => 0,
                            'total_ekuitas' => 0,
                            'selisih' => 0,
                        ],
                        'error' => "Kolom tb_nabbrekap.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $hasSaldoColumn = in_array('Saldo', $cols, true);

            $saldoSelect = null;
            $saldoExpr = null; // signed saldo expression
            $saldoOrderExpr = null;
            $extraSelects = [];

            // Signed saldo rules (Neraca Akhir):
            // - Use tb_nabbrekap.Saldo as end balance (periodic) whenever available.
            // - Normalize sign by account class: prefix 1 => + (aset), prefix 2/3 => - (credit-normal).
            // - Use ABS() to keep sign consistent even if Saldo happens to be stored negative.
            if ($hasSaldoColumn) {
                $saldoExpr = "CASE
                    WHEN LEFT(TRIM(tb_nabbrekap.Kode_Akun),1) IN ('2','3')
                        THEN -ABS(COALESCE(tb_nabbrekap.Saldo,0))
                    ELSE ABS(COALESCE(tb_nabbrekap.Saldo,0))
                END";
                $saldoSelect = DB::raw('(' . $saldoExpr . ') as Saldo');
                $saldoOrderExpr = $saldoExpr;
                $extraSelects[] = DB::raw('tb_nabbrekap.Saldo as Saldo_Raw');
            } elseif (in_array('NA_Debit', $cols, true) && in_array('NA_Kredit', $cols, true)) {
                // Fallback only when Saldo column doesn't exist.
                $saldoExpr = "(COALESCE(tb_nabbrekap.NA_Debit,0) - COALESCE(tb_nabbrekap.NA_Kredit,0))";
                $saldoSelect = DB::raw($saldoExpr . ' as Saldo');
                $saldoOrderExpr = $saldoExpr;
                $extraSelects[] = 'tb_nabbrekap.NA_Debit';
                $extraSelects[] = 'tb_nabbrekap.NA_Kredit';
            } else {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_aset' => 0,
                        'total_liabilitas' => 0,
                        'total_ekuitas' => 0,
                        'selisih' => 0,
                    ],
                    'error' => 'Kolom Saldo tidak ditemukan (butuh Saldo atau NA_Debit/NA_Kredit).',
                ], 500);
            }

            $periodType = (string) $request->query('periodType', 'month');
            $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';

            $period = (string) $request->query('period', '');
            if ($period === '') {
                $period = $periodType === 'year'
                    ? (string) ($this->getDefaultYear() ?? '')
                    : (string) ($this->getDefaultPeriod() ?? '');
            }

            $requestedRange = $this->parsePeriodToRange($periodType, $period);
            if (!$requestedRange) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_aset' => 0,
                        'total_liabilitas' => 0,
                        'total_ekuitas' => 0,
                        'selisih' => 0,
                    ],
                    'error' => $periodType === 'year'
                        ? 'Periode tidak valid. Gunakan format YYYY (contoh 2018).'
                        : 'Periode tidak valid. Gunakan format YYYYMM (contoh 201812).',
                ], 500);
            }

            $filterPeriod = $requestedRange['period'];
            $effectivePeriod = null;
            $effectivePeriodLabel = null;

            // For yearly view, take the latest available month within that year from tb_nabbrekap.
            if ($periodType === 'year') {
                $year = $requestedRange['period'];
                $effectivePeriod = (string) (DB::table('tb_nabbrekap')
                    ->selectRaw('MAX(RIGHT(Kode_NaBB, 6)) as period')
                    ->whereNotNull('Kode_NaBB')
                    ->whereRaw('RIGHT(Kode_NaBB, 6) LIKE ?', [$year . '%'])
                    ->value('period') ?? '');

                if (!preg_match('/^\\d{6}$/', $effectivePeriod)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_aset' => 0,
                            'total_liabilitas' => 0,
                            'total_ekuitas' => 0,
                            'selisih' => 0,
                        ],
                        'error' => "Tidak ada data tb_nabbrekap untuk tahun $year.",
                    ], 500);
                }

                $effectiveRange = $this->parsePeriodToRange('month', $effectivePeriod);
                $effectivePeriodLabel = $effectiveRange['label'] ?? $effectivePeriod;
                $filterPeriod = $effectivePeriod;
            }

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $nameInfo = $this->pickNameColumn();

            $allowedSortBy = [
                'Kode_Akun' => 'tb_nabbrekap.Kode_Akun',
                'Nama_Akun' => $nameInfo['name_sort'] ?: 'tb_nabbrekap.Kode_Akun',
                'Amount' => 'Amount',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'tb_nabbrekap.Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $filtered = DB::table('tb_nabbrekap')
                ->whereRaw('RIGHT(tb_nabbrekap.Kode_NaBB, 6) = ?', [$filterPeriod]);
            if ($nameInfo['join']) {
                $filtered->leftJoin(...$nameInfo['join']);
            }

            // Only show non-zero saldo by default.
            $filtered->whereRaw($saldoExpr . ' <> 0');

            if ($search !== '') {
                $filtered->where(function ($q) use ($search, $nameInfo) {
                    $q->where('tb_nabbrekap.Kode_Akun', 'like', '%' . $search . '%');
                    if ($nameInfo['name_where']) {
                        $q->orWhere($nameInfo['name_where'], 'like', '%' . $search . '%');
                    }
                });
            }

            $total = (int) ((clone $filtered)->count());

            $summaryQuery = (clone $filtered)->select([
                'tb_nabbrekap.Kode_Akun',
                $saldoSelect,
                ...$extraSelects,
            ]);

            $sortedRowsQuery = (clone $filtered)->select([
                'tb_nabbrekap.Kode_Akun',
                $nameInfo['name_select'],
                $saldoSelect,
                ...$extraSelects,
            ]);

            if ($sortByRaw === 'Amount') {
                $sortedRowsQuery->orderByRaw($saldoOrderExpr . ' ' . $sortDir);
            } else {
                $sortedRowsQuery->orderBy($sortBy, $sortDir);
            }

            $rowsQuery = (clone $sortedRowsQuery);
            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();
            $rawRowsForSummary = $pageSize === 'all' ? $rawRows : $summaryQuery->get();

            $sumAset = 0.0;
            $sumLiabilitas = 0.0;
            $sumEkuitas = 0.0;

            $accumulate = function ($r) use (&$sumAset, &$sumLiabilitas, &$sumEkuitas) {
                $code = (string) ($r->Kode_Akun ?? '');
                $saldo = (float) ($r->Saldo ?? 0);
                $group = $this->groupFromCode($code);

                if ($group === 'aset') {
                    $sumAset += max($saldo, 0);
                    return;
                }

                if ($group === 'liabilitas') {
                    $sumLiabilitas += max(-$saldo, 0);
                    return;
                }

                if ($group === 'ekuitas') {
                    $sumEkuitas += max(-$saldo, 0);
                    return;
                }

                // Unknown group: assign by sign to keep equation readable.
                if ($saldo >= 0) {
                    $sumAset += $saldo;
                    return;
                }

                $sumLiabilitas += -$saldo;
            };

            foreach ($rawRowsForSummary as $r) {
                $accumulate($r);
            }

            $rows = [];
            foreach ($rawRows as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $name = (string) ($r->Nama_Akun ?? '');
                $saldo = (float) ($r->Saldo ?? 0);
                $group = $this->groupFromCode($code);

                $side = $group;
                $amountDisplay = 0.0;
                $isAnomaly = false;
                $isOther = false;

                if ($group === 'aset') {
                    $amountDisplay = max($saldo, 0);
                    if ($saldo < 0) {
                        $isAnomaly = true;
                    }
                } elseif ($group === 'liabilitas' || $group === 'ekuitas') {
                    $amountDisplay = max(-$saldo, 0);
                    if ($saldo > 0) {
                        $isAnomaly = true;
                    }
                } else {
                    $isOther = true;
                    if ($saldo >= 0) {
                        $side = 'aset';
                        $amountDisplay = $saldo;
                    } else {
                        $side = 'liabilitas';
                        $amountDisplay = -$saldo;
                    }
                }

                $rows[] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => $name,
                    'saldo' => $saldo,
                    'group' => $group,
                    'side' => $side,
                    'amount_display' => $amountDisplay,
                    'is_anomaly' => $isAnomaly,
                    'is_other' => $isOther,
                ];
            }

            $selisih = $sumAset - ($sumLiabilitas + $sumEkuitas);

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodType,
                'period' => $requestedRange['period'],
                'period_label' => $requestedRange['label'],
                'effective_period' => $effectivePeriod,
                'effective_period_label' => $effectivePeriodLabel,
                'summary' => [
                    'total_aset' => $sumAset,
                    'total_liabilitas' => $sumLiabilitas,
                    'total_ekuitas' => $sumEkuitas,
                    'selisih' => $selisih,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_aset' => 0,
                    'total_liabilitas' => 0,
                    'total_ekuitas' => 0,
                    'selisih' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
