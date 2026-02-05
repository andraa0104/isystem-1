<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class JurnalUmumController
{
    private function getPeriodOptions(): array
    {
        if (!Schema::hasTable('tb_jurnal') || !Schema::hasColumn('tb_jurnal', 'Tgl_Jurnal')) {
            return [];
        }

        try {
            return DB::table('tb_jurnal')
                ->selectRaw("DISTINCT DATE_FORMAT(Tgl_Jurnal, '%Y%m') as period")
                ->whereNotNull('Tgl_Jurnal')
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

    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
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

        return Inertia::render('laporan/jurnal-umum/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'balance' => (string) $request->query('balance', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Tgl_Jurnal'),
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

        return Inertia::render('laporan/jurnal-umum/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'balance' => (string) $request->query('balance', 'all'),
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Tgl_Jurnal'),
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
            foreach (['tb_jurnal', 'tb_jurnaldetail'] as $tbl) {
                if (!Schema::hasTable($tbl)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_jurnal' => 0,
                            'sum_debit' => 0,
                            'sum_kredit' => 0,
                            'balanced_count' => 0,
                            'unbalanced_count' => 0,
                            'sum_selisih_abs' => 0,
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
                            'total_jurnal' => 0,
                            'sum_debit' => 0,
                            'sum_kredit' => 0,
                            'balanced_count' => 0,
                            'unbalanced_count' => 0,
                            'sum_selisih_abs' => 0,
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
                            'total_jurnal' => 0,
                            'sum_debit' => 0,
                            'sum_kredit' => 0,
                            'balanced_count' => 0,
                            'unbalanced_count' => 0,
                            'sum_selisih_abs' => 0,
                        ],
                        'error' => "Kolom tb_jurnaldetail.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $jCols = Schema::getColumnListing('tb_jurnal');
            $hasVoucher = in_array('Kode_Voucher', $jCols, true);
            $hasRemark = in_array('Remark', $jCols, true);

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
                        'total_jurnal' => 0,
                        'sum_debit' => 0,
                        'sum_kredit' => 0,
                        'balanced_count' => 0,
                        'unbalanced_count' => 0,
                        'sum_selisih_abs' => 0,
                    ],
                    'error' => $periodType === 'year'
                        ? 'Periode tidak valid. Gunakan format YYYY (contoh 2019).'
                        : 'Periode tidak valid. Gunakan format YYYYMM (contoh 201902).',
                ], 500);
            }

            $balance = strtolower((string) $request->query('balance', 'all'));
            $balance = in_array($balance, ['all', 'balanced', 'unbalanced'], true) ? $balance : 'all';

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Tgl_Jurnal');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'desc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'desc';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $includeDetails = (string) $request->query('includeDetails', '0') === '1';

            $start = $periodRange['start']->toDateString();
            $end = $periodRange['end']->toDateString();

            $detailAgg = DB::table('tb_jurnaldetail as d')
                ->select([
                    'd.Kode_Jurnal as Kode_Jurnal',
                    DB::raw('SUM(COALESCE(d.Debit,0)) as total_debit'),
                    DB::raw('SUM(COALESCE(d.Kredit,0)) as total_kredit'),
                    // Avoid reserved word issues (MySQL: LINES).
                    DB::raw('COUNT(*) as line_count'),
                ])
                ->groupBy('d.Kode_Jurnal');

            $base = DB::table('tb_jurnal as j')
                ->joinSub($detailAgg, 'a', function ($join) {
                    $join->on('a.Kode_Jurnal', '=', 'j.Kode_Jurnal');
                })
                ->whereBetween('j.Tgl_Jurnal', [$start, $end]);

            if ($balance === 'balanced') {
                $base->whereRaw('COALESCE(a.total_debit,0) = COALESCE(a.total_kredit,0)');
            } elseif ($balance === 'unbalanced') {
                $base->whereRaw('COALESCE(a.total_debit,0) <> COALESCE(a.total_kredit,0)');
            }

            $nabbName = $this->nabbNameAvailable();

            if ($search !== '') {
                $base->where(function ($q) use ($search, $hasVoucher, $hasRemark, $nabbName) {
                    $q->where('j.Kode_Jurnal', 'like', '%' . $search . '%');
                    if ($hasVoucher) {
                        $q->orWhere('j.Kode_Voucher', 'like', '%' . $search . '%');
                    }
                    if ($hasRemark) {
                        $q->orWhere('j.Remark', 'like', '%' . $search . '%');
                    }

                    $q->orWhereExists(function ($sq) use ($search, $nabbName) {
                        $sq->from('tb_jurnaldetail as d')
                            ->whereColumn('d.Kode_Jurnal', 'j.Kode_Jurnal')
                            ->where(function ($dq) use ($search, $nabbName) {
                                $dq->where('d.Kode_Akun', 'like', '%' . $search . '%');
                                if ($nabbName) {
                                    $dq->orWhereExists(function ($nq) use ($search) {
                                        $nq->from('tb_nabb as n')
                                            ->whereColumn('n.Kode_Akun', 'd.Kode_Akun')
                                            ->where('n.Nama_Akun', 'like', '%' . $search . '%');
                                    });
                                }
                            });
                    });
                });
            }

            $total = (int) (clone $base)->count();

            $summary = (clone $base)
                ->selectRaw('COUNT(*) as total_jurnal')
                ->selectRaw('COALESCE(SUM(COALESCE(a.total_debit,0)),0) as sum_debit')
                ->selectRaw('COALESCE(SUM(COALESCE(a.total_kredit,0)),0) as sum_kredit')
                ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(a.total_debit,0) = COALESCE(a.total_kredit,0) THEN 1 ELSE 0 END),0) as balanced_count")
                ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(a.total_debit,0) <> COALESCE(a.total_kredit,0) THEN 1 ELSE 0 END),0) as unbalanced_count")
                ->selectRaw('COALESCE(SUM(ABS(COALESCE(a.total_debit,0) - COALESCE(a.total_kredit,0))),0) as sum_selisih_abs')
                ->first();

            $allowedSortBy = [
                'Tgl_Jurnal' => 'j.Tgl_Jurnal',
                'Kode_Jurnal' => 'j.Kode_Jurnal',
                'Kode_Voucher' => $hasVoucher ? 'j.Kode_Voucher' : 'j.Kode_Jurnal',
                'Total_Debit' => 'a.total_debit',
                'Total_Kredit' => 'a.total_kredit',
                'Lines' => 'a.line_count',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'j.Tgl_Jurnal';

            $has00Expr = "EXISTS (
                SELECT 1 FROM tb_jurnaldetail d00
                WHERE d00.Kode_Jurnal = j.Kode_Jurnal
                  AND TRIM(COALESCE(d00.Kode_Akun,'')) LIKE '%00%'
            )";

            $rowsQuery = (clone $base)->select([
                'j.Kode_Jurnal',
                'j.Tgl_Jurnal',
                $hasVoucher ? 'j.Kode_Voucher' : DB::raw("'' as Kode_Voucher"),
                $hasRemark ? 'j.Remark' : DB::raw("'' as Remark"),
                DB::raw('COALESCE(a.total_debit,0) as total_debit'),
                DB::raw('COALESCE(a.total_kredit,0) as total_kredit'),
                DB::raw('COALESCE(a.line_count,0) as line_count'),
                DB::raw('(COALESCE(a.total_debit,0) = COALESCE(a.total_kredit,0)) as is_balanced'),
                DB::raw('(' . $has00Expr . ') as has_00'),
            ]);

            $rowsQuery->orderBy($sortBy, $sortDir)->orderBy('j.Kode_Jurnal', 'asc');

            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();

            $rows = [];
            foreach ($rawRows as $r) {
                $rows[] = [
                    'Kode_Jurnal' => (string) ($r->Kode_Jurnal ?? ''),
                    'Kode_Voucher' => (string) ($r->Kode_Voucher ?? ''),
                    'Tgl_Jurnal' => (string) ($r->Tgl_Jurnal ?? ''),
                    'Remark' => (string) ($r->Remark ?? ''),
                    'total_debit' => (float) ($r->total_debit ?? 0),
                    'total_kredit' => (float) ($r->total_kredit ?? 0),
                    'lines' => (int) ($r->line_count ?? 0),
                    'is_balanced' => (bool) ($r->is_balanced ?? false),
                    'has_00' => (bool) ($r->has_00 ?? false),
                ];
            }

            if ($includeDetails && count($rows) > 0) {
                $kodeList = collect($rows)->pluck('Kode_Jurnal')->filter()->values()->all();

                $detailsSelect = [
                    'd.Kode_Jurnal',
                    'd.Kode_Akun',
                    DB::raw('COALESCE(d.Debit,0) as Debit'),
                    DB::raw('COALESCE(d.Kredit,0) as Kredit'),
                ];

                $detailsQuery = DB::table('tb_jurnaldetail as d')
                    ->whereIn('d.Kode_Jurnal', $kodeList)
                    ->orderBy('d.Kode_Jurnal', 'asc')
                    ->orderBy('d.Kode_Akun', 'asc');

                if ($nabbName) {
                    $detailsQuery->leftJoin('tb_nabb as n', 'n.Kode_Akun', '=', 'd.Kode_Akun');
                    $detailsSelect[] = DB::raw('COALESCE(n.Nama_Akun, \'\') as Nama_Akun');
                } else {
                    $detailsSelect[] = DB::raw("'' as Nama_Akun");
                }

                $detailRows = $detailsQuery->select($detailsSelect)->get();

                $byJurnal = [];
                foreach ($detailRows as $d) {
                    $kj = (string) ($d->Kode_Jurnal ?? '');
                    if (!isset($byJurnal[$kj])) {
                        $byJurnal[$kj] = [];
                    }
                    $kodeAkun = (string) ($d->Kode_Akun ?? '');
                    $byJurnal[$kj][] = [
                        'Kode_Akun' => $kodeAkun,
                        'Nama_Akun' => (string) ($d->Nama_Akun ?? ''),
                        'Debit' => (float) ($d->Debit ?? 0),
                        'Kredit' => (float) ($d->Kredit ?? 0),
                        'has_00' => str_contains($kodeAkun, '00'),
                    ];
                }

                foreach ($rows as $i => $row) {
                    $rows[$i]['details'] = $byJurnal[$row['Kode_Jurnal']] ?? [];
                }
            }

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'period_type' => $periodRange['period_type'],
                'period' => $periodRange['period'],
                'period_label' => $periodRange['label'],
                'summary' => [
                    'total_jurnal' => (int) ($summary->total_jurnal ?? 0),
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
                    'total_jurnal' => 0,
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
            if (!Schema::hasTable('tb_jurnaldetail')) {
                return response()->json([
                    'kode_jurnal' => (string) $request->query('kodeJurnal', ''),
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => 'Tabel tb_jurnaldetail tidak ditemukan.',
                ], 500);
            }

            $kodeJurnal = trim((string) $request->query('kodeJurnal', ''));
            if ($kodeJurnal === '') {
                return response()->json([
                    'kode_jurnal' => '',
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => 'Parameter kodeJurnal wajib diisi.',
                ], 500);
            }

            foreach (['Kode_Jurnal', 'Kode_Akun', 'Debit', 'Kredit'] as $col) {
                if (!Schema::hasColumn('tb_jurnaldetail', $col)) {
                    return response()->json([
                        'kode_jurnal' => $kodeJurnal,
                        'details' => [],
                        'totals' => [
                            'total_debit' => 0,
                            'total_kredit' => 0,
                            'is_balanced' => false,
                        ],
                        'error' => "Kolom tb_jurnaldetail.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $nabbName = $this->nabbNameAvailable();

            $q = DB::table('tb_jurnaldetail as d')
                ->where('d.Kode_Jurnal', '=', $kodeJurnal)
                ->orderBy('d.Kode_Akun', 'asc');

            $select = [
                'd.Kode_Akun',
                DB::raw('COALESCE(d.Debit,0) as Debit'),
                DB::raw('COALESCE(d.Kredit,0) as Kredit'),
            ];

            if ($nabbName) {
                $q->leftJoin('tb_nabb as n', 'n.Kode_Akun', '=', 'd.Kode_Akun');
                $select[] = DB::raw('COALESCE(n.Nama_Akun, \'\') as Nama_Akun');
            } else {
                $select[] = DB::raw("'' as Nama_Akun");
            }

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
                    'has_00' => str_contains($kodeAkun, '00'),
                ];
            }

            return response()->json([
                'kode_jurnal' => $kodeJurnal,
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
