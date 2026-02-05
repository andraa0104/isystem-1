<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class JurnalPenyesuaianController
{
    private function getPeriodOptions(): array
    {
        if (!Schema::hasTable('tb_jurnalpenyesuaian') || !Schema::hasColumn('tb_jurnalpenyesuaian', 'Periode')) {
            return [];
        }

        try {
            return DB::table('tb_jurnalpenyesuaian')
                ->selectRaw("DISTINCT DATE_FORMAT(Periode, '%Y%m') as period")
                ->whereNotNull('Periode')
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

        return Inertia::render('laporan/jurnal-penyesuaian/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'balance' => (string) $request->query('balance', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Periode'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
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

        return Inertia::render('laporan/jurnal-penyesuaian/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'balance' => (string) $request->query('balance', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Periode'),
                'sortDir' => (string) $request->query('sortDir', 'desc'),
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
            if (!Schema::hasTable('tb_jurnalpenyesuaian')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_dokumen' => 0,
                        'sum_debit' => 0,
                        'sum_kredit' => 0,
                        'balanced_count' => 0,
                        'unbalanced_count' => 0,
                        'sum_selisih_abs' => 0,
                    ],
                    'error' => 'Tabel tb_jurnalpenyesuaian tidak ditemukan.',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
            foreach (['Kode_Jurnal', 'Periode', 'Kode_Akun', 'Debit', 'Kredit'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_dokumen' => 0,
                            'sum_debit' => 0,
                            'sum_kredit' => 0,
                            'balanced_count' => 0,
                            'unbalanced_count' => 0,
                            'sum_selisih_abs' => 0,
                        ],
                        'error' => "Kolom tb_jurnalpenyesuaian.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $hasPosting = in_array('Posting_Date', $cols, true);
            $hasRemark = in_array('Remark', $cols, true);
            $hasNamaAkun = in_array('Nama_Akun', $cols, true);
            $hasId = in_array('IDJurnal', $cols, true);

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
                        'total_dokumen' => 0,
                        'sum_debit' => 0,
                        'sum_kredit' => 0,
                        'balanced_count' => 0,
                        'unbalanced_count' => 0,
                        'sum_selisih_abs' => 0,
                    ],
                    'error' => $periodType === 'year'
                        ? 'Periode tidak valid. Gunakan format YYYY (contoh 2018).'
                        : 'Periode tidak valid. Gunakan format YYYYMM (contoh 201812).',
                ], 500);
            }

            $balance = strtolower((string) $request->query('balance', 'all'));
            $balance = in_array($balance, ['all', 'balanced', 'unbalanced'], true) ? $balance : 'all';

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Periode');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'desc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'desc';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $includeDetails = (string) $request->query('includeDetails', '0') === '1';

            $start = $periodRange['start']->toDateString();
            $end = $periodRange['end']->toDateString();

            $baseLines = DB::table('tb_jurnalpenyesuaian as a')
                ->whereBetween('a.Periode', [$start, $end]);

            if ($search !== '') {
                $baseLines->where(function ($q) use ($search, $hasRemark, $hasNamaAkun) {
                    $q->where('a.Kode_Jurnal', 'like', '%' . $search . '%')
                        ->orWhere('a.Kode_Akun', 'like', '%' . $search . '%');

                    if ($hasRemark) {
                        $q->orWhere('a.Remark', 'like', '%' . $search . '%');
                    }
                    if ($hasNamaAkun) {
                        $q->orWhere('a.Nama_Akun', 'like', '%' . $search . '%');
                    }
                });
            }

            $aggSelect = [
                'a.Kode_Jurnal as Kode_Jurnal',
                DB::raw('DATE(a.Periode) as Periode'),
                DB::raw('SUM(COALESCE(a.Debit,0)) as total_debit'),
                DB::raw('SUM(COALESCE(a.Kredit,0)) as total_kredit'),
                // Avoid reserved word issues (MySQL: LINES).
                DB::raw('COUNT(*) as line_count'),
                DB::raw("MAX(CASE WHEN TRIM(COALESCE(a.Kode_Akun,'')) LIKE '%00%' THEN 1 ELSE 0 END) as has_00"),
            ];

            $aggSelect[] = $hasPosting
                ? DB::raw('MAX(a.Posting_Date) as Posting_Date')
                : DB::raw("'' as Posting_Date");
            $aggSelect[] = $hasRemark
                ? DB::raw('MAX(a.Remark) as Remark')
                : DB::raw("'' as Remark");

            $agg = (clone $baseLines)
                ->select($aggSelect)
                ->groupBy('a.Kode_Jurnal')
                ->groupBy(DB::raw('DATE(a.Periode)'));

            $docs = DB::query()->fromSub($agg, 'x');

            if ($balance === 'balanced') {
                $docs->whereRaw('COALESCE(x.total_debit,0) = COALESCE(x.total_kredit,0)');
            } elseif ($balance === 'unbalanced') {
                $docs->whereRaw('COALESCE(x.total_debit,0) <> COALESCE(x.total_kredit,0)');
            }

            $total = (int) (clone $docs)->count();

            $summary = (clone $docs)
                ->selectRaw('COUNT(*) as total_dokumen')
                ->selectRaw('COALESCE(SUM(COALESCE(x.total_debit,0)),0) as sum_debit')
                ->selectRaw('COALESCE(SUM(COALESCE(x.total_kredit,0)),0) as sum_kredit')
                ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(x.total_debit,0) = COALESCE(x.total_kredit,0) THEN 1 ELSE 0 END),0) as balanced_count")
                ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(x.total_debit,0) <> COALESCE(x.total_kredit,0) THEN 1 ELSE 0 END),0) as unbalanced_count")
                ->selectRaw('COALESCE(SUM(ABS(COALESCE(x.total_debit,0) - COALESCE(x.total_kredit,0))),0) as sum_selisih_abs')
                ->first();

            $allowedSortBy = [
                'Periode' => 'x.Periode',
                'Posting_Date' => 'x.Posting_Date',
                'Kode_Jurnal' => 'x.Kode_Jurnal',
                'Total_Debit' => 'x.total_debit',
                'Total_Kredit' => 'x.total_kredit',
                'Lines' => 'x.line_count',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'x.Periode';

            $rowsQuery = (clone $docs)->select([
                'x.Kode_Jurnal',
                'x.Periode',
                'x.Posting_Date',
                'x.Remark',
                DB::raw('COALESCE(x.total_debit,0) as total_debit'),
                DB::raw('COALESCE(x.total_kredit,0) as total_kredit'),
                DB::raw('COALESCE(x.line_count,0) as line_count'),
                DB::raw('(COALESCE(x.total_debit,0) = COALESCE(x.total_kredit,0)) as is_balanced'),
                DB::raw('(COALESCE(x.has_00,0) = 1) as has_00'),
            ]);

            $rowsQuery->orderBy($sortBy, $sortDir)
                ->orderBy('x.Kode_Jurnal', 'asc')
                ->orderBy('x.Periode', 'asc');

            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();

            $rows = [];
            foreach ($rawRows as $r) {
                $rows[] = [
                    'Kode_Jurnal' => (string) ($r->Kode_Jurnal ?? ''),
                    'Periode' => (string) ($r->Periode ?? ''),
                    'Posting_Date' => (string) ($r->Posting_Date ?? ''),
                    'Remark' => (string) ($r->Remark ?? ''),
                    'total_debit' => (float) ($r->total_debit ?? 0),
                    'total_kredit' => (float) ($r->total_kredit ?? 0),
                    'lines' => (int) ($r->line_count ?? 0),
                    'is_balanced' => (bool) ($r->is_balanced ?? false),
                    'has_00' => (bool) ($r->has_00 ?? false),
                ];
            }

            if ($includeDetails && count($rows) > 0) {
                $kodeList = collect($rows)->pluck('Kode_Jurnal')->filter()->unique()->values()->all();

                $detailSelect = [
                    'a.Kode_Jurnal',
                    DB::raw('DATE(a.Periode) as Periode'),
                    'a.Kode_Akun',
                    DB::raw('COALESCE(a.Debit,0) as Debit'),
                    DB::raw('COALESCE(a.Kredit,0) as Kredit'),
                ];

                if ($hasNamaAkun) {
                    $detailSelect[] = DB::raw('COALESCE(a.Nama_Akun, \'\') as Nama_Akun');
                } else {
                    $detailSelect[] = DB::raw("'' as Nama_Akun");
                }
                if ($hasRemark) {
                    $detailSelect[] = DB::raw('COALESCE(a.Remark, \'\') as Remark');
                } else {
                    $detailSelect[] = DB::raw("'' as Remark");
                }
                if ($hasPosting) {
                    $detailSelect[] = DB::raw('COALESCE(a.Posting_Date, \'\') as Posting_Date');
                } else {
                    $detailSelect[] = DB::raw("'' as Posting_Date");
                }

                $detailQuery = DB::table('tb_jurnalpenyesuaian as a')
                    ->whereBetween('a.Periode', [$start, $end])
                    ->whereIn('a.Kode_Jurnal', $kodeList);

                if ($hasId) {
                    $detailQuery->orderBy('a.IDJurnal', 'asc');
                } else {
                    $detailQuery->orderBy('a.Kode_Jurnal', 'asc')->orderBy('a.Kode_Akun', 'asc');
                }

                $detailRows = $detailQuery->select($detailSelect)->get();

                $byDoc = [];
                foreach ($detailRows as $d) {
                    $kj = (string) ($d->Kode_Jurnal ?? '');
                    $periodeDoc = (string) ($d->Periode ?? '');
                    $docKey = $kj . '|' . $periodeDoc;

                    if (!isset($byDoc[$docKey])) {
                        $byDoc[$docKey] = [];
                    }

                    $kodeAkun = (string) ($d->Kode_Akun ?? '');
                    $byDoc[$docKey][] = [
                        'Kode_Akun' => $kodeAkun,
                        'Nama_Akun' => (string) ($d->Nama_Akun ?? ''),
                        'Debit' => (float) ($d->Debit ?? 0),
                        'Kredit' => (float) ($d->Kredit ?? 0),
                        'Remark' => (string) ($d->Remark ?? ''),
                        'Posting_Date' => (string) ($d->Posting_Date ?? ''),
                        'has_00' => str_contains($kodeAkun, '00'),
                    ];
                }

                foreach ($rows as $i => $row) {
                    $docKey = $row['Kode_Jurnal'] . '|' . $row['Periode'];
                    $rows[$i]['details'] = $byDoc[$docKey] ?? [];
                }
            }

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodRange['period_type'],
                'period' => $periodRange['period'],
                'period_label' => $periodRange['label'],
                'summary' => [
                    'total_dokumen' => (int) ($summary->total_dokumen ?? 0),
                    'sum_debit' => (float) ($summary->sum_debit ?? 0),
                    'sum_kredit' => (float) ($summary->sum_kredit ?? 0),
                    'balanced_count' => (int) ($summary->balanced_count ?? 0),
                    'unbalanced_count' => (int) ($summary->unbalanced_count ?? 0),
                    'sum_selisih_abs' => (float) ($summary->sum_selisih_abs ?? 0),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_dokumen' => 0,
                    'sum_debit' => 0,
                    'sum_kredit' => 0,
                    'balanced_count' => 0,
                    'unbalanced_count' => 0,
                    'sum_selisih_abs' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function details(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_jurnalpenyesuaian')) {
                return response()->json([
                    'kode_jurnal' => (string) $request->query('kodeJurnal', ''),
                    'periode' => (string) $request->query('periode', ''),
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => 'Tabel tb_jurnalpenyesuaian tidak ditemukan.',
                ], 500);
            }

            $kodeJurnal = trim((string) $request->query('kodeJurnal', ''));
            $periode = trim((string) $request->query('periode', ''));
            if ($kodeJurnal === '' || $periode === '') {
                return response()->json([
                    'kode_jurnal' => $kodeJurnal,
                    'periode' => $periode,
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => 'Parameter kodeJurnal dan periode wajib diisi.',
                ], 500);
            }

            if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $periode)) {
                return response()->json([
                    'kode_jurnal' => $kodeJurnal,
                    'periode' => $periode,
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => 'Format periode tidak valid. Gunakan YYYY-MM-DD (contoh 2018-12-31).',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
            foreach (['Kode_Jurnal', 'Periode', 'Kode_Akun', 'Debit', 'Kredit'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json([
                        'kode_jurnal' => $kodeJurnal,
                        'periode' => $periode,
                        'details' => [],
                        'totals' => [
                            'total_debit' => 0,
                            'total_kredit' => 0,
                            'is_balanced' => false,
                        ],
                        'error' => "Kolom tb_jurnalpenyesuaian.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $hasNamaAkun = in_array('Nama_Akun', $cols, true);
            $hasRemark = in_array('Remark', $cols, true);
            $hasPosting = in_array('Posting_Date', $cols, true);
            $hasId = in_array('IDJurnal', $cols, true);

            $q = DB::table('tb_jurnalpenyesuaian as a')
                ->where('a.Kode_Jurnal', '=', $kodeJurnal)
                ->whereRaw('DATE(a.Periode) = ?', [$periode]);

            if ($hasId) {
                $q->orderBy('a.IDJurnal', 'asc');
            } else {
                $q->orderBy('a.Kode_Akun', 'asc');
            }

            $select = [
                'a.Kode_Akun',
                DB::raw('COALESCE(a.Debit,0) as Debit'),
                DB::raw('COALESCE(a.Kredit,0) as Kredit'),
            ];
            $select[] = $hasNamaAkun ? 'a.Nama_Akun' : DB::raw("'' as Nama_Akun");
            $select[] = $hasRemark ? 'a.Remark' : DB::raw("'' as Remark");
            $select[] = $hasPosting ? 'a.Posting_Date' : DB::raw("'' as Posting_Date");

            $raw = $q->select($select)->get();

            $details = [];
            $sumDebit = 0.0;
            $sumKredit = 0.0;
            foreach ($raw as $r) {
                $kodeAkun = (string) ($r->Kode_Akun ?? '');
                $debit = (float) ($r->Debit ?? 0);
                $kredit = (float) ($r->Kredit ?? 0);
                $sumDebit += $debit;
                $sumKredit += $kredit;

                $details[] = [
                    'Kode_Akun' => $kodeAkun,
                    'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
                    'Debit' => $debit,
                    'Kredit' => $kredit,
                    'Remark' => (string) ($r->Remark ?? ''),
                    'Posting_Date' => (string) ($r->Posting_Date ?? ''),
                    'has_00' => str_contains($kodeAkun, '00'),
                ];
            }

            return response()->json([
                'kode_jurnal' => $kodeJurnal,
                'periode' => $periode,
                'details' => $details,
                'totals' => [
                    'total_debit' => $sumDebit,
                    'total_kredit' => $sumKredit,
                    'is_balanced' => $sumDebit === $sumKredit,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'kode_jurnal' => (string) $request->query('kodeJurnal', ''),
                'periode' => (string) $request->query('periode', ''),
                'details' => [],
                'totals' => [
                    'total_debit' => 0,
                    'total_kredit' => 0,
                    'is_balanced' => false,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

