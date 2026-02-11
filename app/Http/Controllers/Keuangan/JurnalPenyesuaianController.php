<?php

namespace App\Http\Controllers\Keuangan;

use App\Services\Keuangan\JurnalPenyesuaianDss\JpDss;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class JurnalPenyesuaianController
{
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

    private function ensureTable(): ?string
    {
        if (!Schema::hasTable('tb_jurnalpenyesuaian')) return 'Tabel tb_jurnalpenyesuaian tidak ditemukan.';
        foreach (['Kode_Jurnal', 'Periode', 'Kode_Akun', 'Debit', 'Kredit'] as $c) {
            if (!Schema::hasColumn('tb_jurnalpenyesuaian', $c)) {
                return "Kolom tb_jurnalpenyesuaian.$c tidak ditemukan.";
            }
        }
        return null;
    }

    private function getPeriodOptions(): array
    {
        if ($this->ensureTable()) return [];

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

    private function getActiveBookMonthYm(): string
    {
        $fallback = Carbon::now()->format('Ym');
        if ($this->ensureTable()) return $fallback;

        try {
            $ym = (string) (DB::table('tb_jurnalpenyesuaian')
                ->selectRaw("MAX(DATE_FORMAT(Periode,'%Y%m')) as ym")
                ->value('ym') ?? '');
            $ym = trim($ym);
            return preg_match('/^\\d{6}$/', $ym) ? $ym : $fallback;
        } catch (\Throwable) {
            return $fallback;
        }
    }

    private function getPeriodeDefault(string $activeYm): string
    {
        try {
            return Carbon::createFromFormat('Ym', $activeYm)->startOfMonth()->toDateString(); // YYYY-MM-01
        } catch (\Throwable) {
            return Carbon::now()->startOfMonth()->toDateString();
        }
    }

    private function getGlAccountOptions(): array
    {
        $hasNabb = Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun');
        if ($hasNabb) {
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
                    ->limit(8000)
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
                // ignore and fallback below
            }
        }

        if ($this->ensureTable()) return [];
        $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
        $hasNamaAkun = in_array('Nama_Akun', $cols, true);
        try {
            $rows = DB::table('tb_jurnalpenyesuaian')
                ->selectRaw('DISTINCT TRIM(Kode_Akun) as Kode_Akun')
                ->whereNotNull('Kode_Akun')
                ->whereRaw("TRIM(COALESCE(Kode_Akun,'')) <> ''")
                ->orderBy('Kode_Akun', 'asc')
                ->limit(8000)
                ->pluck('Kode_Akun')
                ->map(fn ($v) => trim((string) $v))
                ->filter()
                ->values()
                ->all();

            if (!$hasNamaAkun) {
                return array_map(fn ($a) => ['value' => $a, 'label' => $a], $rows);
            }

            $names = DB::table('tb_jurnalpenyesuaian')
                ->whereIn('Kode_Akun', $rows)
                ->pluck('Nama_Akun', 'Kode_Akun');

            return array_map(function ($a) use ($names) {
                $name = trim((string) ($names[$a] ?? ''));
                return ['value' => $a, 'label' => $name !== '' ? ($a . ' — ' . $name) : $a];
            }, $rows);
        } catch (\Throwable) {
            return [];
        }
    }

    private function nextKodeJurnal(string $dbCode): string
    {
        $prefix = strtoupper(trim($dbCode)) . '/JP/';
        $last = (string) (DB::table('tb_jurnalpenyesuaian')
            ->select('Kode_Jurnal')
            ->where('Kode_Jurnal', 'like', $prefix . '%')
            ->orderByDesc('Kode_Jurnal')
            ->lockForUpdate()
            ->value('Kode_Jurnal') ?? '');

        $seq = 0;
        if ($last !== '' && str_starts_with($last, $prefix)) {
            $tail = substr($last, strlen($prefix));
            if (preg_match('/^\\d{8}$/', $tail)) {
                $seq = (int) $tail;
            }
        }
        $seq++;
        return $prefix . str_pad((string) $seq, 8, '0', STR_PAD_LEFT);
    }

    public function index(Request $request)
    {
        $err = $this->ensureTable();
        if ($err) {
            return Inertia::render('Keuangan/penyesuaian/index', [
                'initialQuery' => [
                    'periodType' => 'month',
                    'period' => '',
                    'balance' => 'all',
                    'search' => '',
                    'sortBy' => 'Periode',
                    'sortDir' => 'desc',
                    'pageSize' => 10,
                ],
                'periodOptions' => [],
                'defaultPeriod' => '',
                'yearOptions' => [],
                'defaultYear' => '',
                'bootstrapError' => $err,
            ]);
        }

        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');
        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('Keuangan/penyesuaian/index', [
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
            'bootstrapError' => '',
        ]);
    }

    public function rows(Request $request)
    {
        try {
            $err = $this->ensureTable();
            if ($err) {
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
                    'error' => $err,
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
            $hasPosting = in_array('Posting_Date', $cols, true);
            $hasRemark = in_array('Remark', $cols, true);
            $hasNamaAkun = in_array('Nama_Akun', $cols, true);

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

            $start = $periodRange['start']->toDateString();
            $end = $periodRange['end']->toDateString();

            $baseLines = DB::table('tb_jurnalpenyesuaian as a')
                ->whereBetween('a.Periode', [$start, $end]);

            if ($search !== '') {
                $baseLines->where(function ($q) use ($search, $hasRemark, $hasNamaAkun) {
                    $q->where('a.Kode_Jurnal', 'like', '%' . $search . '%')
                        ->orWhere('a.Kode_Akun', 'like', '%' . $search . '%');
                    if ($hasRemark) $q->orWhere('a.Remark', 'like', '%' . $search . '%');
                    if ($hasNamaAkun) $q->orWhere('a.Nama_Akun', 'like', '%' . $search . '%');
                });
            }

            $aggSelect = [
                'a.Kode_Jurnal as Kode_Jurnal',
                DB::raw('DATE(a.Periode) as Periode'),
                DB::raw('SUM(COALESCE(a.Debit,0)) as total_debit'),
                DB::raw('SUM(COALESCE(a.Kredit,0)) as total_kredit'),
                DB::raw('COUNT(*) as line_count'),
            ];
            $aggSelect[] = $hasPosting ? DB::raw('MAX(a.Posting_Date) as Posting_Date') : DB::raw("'' as Posting_Date");
            $aggSelect[] = $hasRemark ? DB::raw('MAX(a.Remark) as Remark') : DB::raw("'' as Remark");

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
                ];
            }

            return response()->json([
                'rows' => $rows,
                'total' => $total,
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
            $err = $this->ensureTable();
            if ($err) {
                return response()->json([
                    'kode_jurnal' => (string) $request->query('kodeJurnal', ''),
                    'periode' => (string) $request->query('periode', ''),
                    'details' => [],
                    'totals' => [
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'is_balanced' => false,
                    ],
                    'error' => $err,
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
                    'error' => 'Format periode tidak valid. Gunakan YYYY-MM-DD.',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
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
                $debit = (float) ($r->Debit ?? 0);
                $kredit = (float) ($r->Kredit ?? 0);
                $sumDebit += $debit;
                $sumKredit += $kredit;
                $details[] = [
                    'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                    'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
                    'Debit' => $debit,
                    'Kredit' => $kredit,
                    'Remark' => (string) ($r->Remark ?? ''),
                    'Posting_Date' => (string) ($r->Posting_Date ?? ''),
                ];
            }

            return response()->json([
                'kode_jurnal' => $kodeJurnal,
                'periode' => $periode,
                'details' => $details,
                'totals' => [
                    'total_debit' => $sumDebit,
                    'total_kredit' => $sumKredit,
                    'is_balanced' => round($sumDebit, 2) === round($sumKredit, 2),
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

    public function create(Request $request)
    {
        $err = $this->ensureTable();
        $activeYm = $this->getActiveBookMonthYm();
        $periodeDefault = $this->getPeriodeDefault($activeYm);

        $cols = Schema::hasTable('tb_jurnalpenyesuaian') ? Schema::getColumnListing('tb_jurnalpenyesuaian') : [];
        $hasPosting = in_array('Posting_Date', $cols, true);

        return Inertia::render('Keuangan/penyesuaian/create', [
            'bootstrapError' => $err ?: '',
            'activeBookMonthYm' => $activeYm,
            'periodeDefault' => $periodeDefault,
            'postingDateDefault' => $hasPosting ? Carbon::now()->toDateString() : '',
            'hasPostingDate' => $hasPosting,
            'glAccountOptions' => $this->getGlAccountOptions(),
        ]);
    }

    public function suggest(Request $request)
    {
        try {
            $err = $this->ensureTable();
            if ($err) return response()->json(['error' => $err], 500);

            $remark = trim((string) $request->query('remark', ''));
            $kodeAkun = trim((string) $request->query('kodeAkun', ''));
            $nominal = (float) $request->query('nominal', 0);
            $nominal = max(0.0, $nominal);
            $jenis = trim((string) $request->query('jenis', ''));
            $jenis = strtolower($jenis) === 'kredit' ? 'Kredit' : (strtolower($jenis) === 'debit' ? 'Debit' : '');
            if ($remark === '') {
                return response()->json([
                    'lines' => [],
                    'remark_suggest' => '',
                    'confidence' => ['overall' => 0.0],
                    'evidence' => [],
                ]);
            }

            $out = (new JpDss())->suggest([
                'remark' => $remark,
                'seedAkun' => $kodeAkun,
                'nominal' => $nominal,
                'seedJenis' => $jenis,
            ]);

            return response()->json([
                'lines' => $out['lines'] ?? [],
                'remark_suggest' => (string) ($out['remark_suggest'] ?? ''),
                'confidence' => $out['confidence'] ?? ['overall' => 0.0],
                'evidence' => $out['evidence'] ?? [],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'periode' => ['required', 'date'],
            'posting_date' => ['nullable', 'date'],
            'remark' => ['required', 'string'],
            'lines' => ['required', 'array', 'min:2', 'max:4'],
            'lines.*.akun' => ['required', 'string'],
            'lines.*.jenis' => ['required', 'string'],
            'lines.*.nominal' => ['required', 'numeric', 'min:0.01'],
        ]);

        try {
            $err = $this->ensureTable();
            if ($err) return redirect()->back()->with('error', $err);

            $activeYm = $this->getActiveBookMonthYm();
            $periodeDefault = $this->getPeriodeDefault($activeYm);

            $periode = Carbon::parse((string) $payload['periode'])->toDateString();
            $day = (int) Carbon::parse($periode)->format('d');
            $ym = Carbon::parse($periode)->format('Ym');
            if ($ym !== $activeYm || $day !== 1) {
                return redirect()->back()->with('error', 'Periode harus mengikuti buku aktif dan wajib tanggal 1: ' . $periodeDefault);
            }

            $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
            $hasPosting = in_array('Posting_Date', $cols, true);
            $hasRemark = in_array('Remark', $cols, true);
            $hasNamaAkun = in_array('Nama_Akun', $cols, true);

            $postingDate = $hasPosting ? Carbon::parse((string) ($payload['posting_date'] ?? Carbon::now()->toDateString()))->toDateString() : null;
            $remark = trim((string) $payload['remark']);

            $sumDebit = 0.0;
            $sumKredit = 0.0;
            $clean = [];
            foreach ((array) $payload['lines'] as $line) {
                $akun = trim((string) ($line['akun'] ?? ''));
                $jenis = strtoupper(trim((string) ($line['jenis'] ?? '')));
                $nom = (float) ($line['nominal'] ?? 0);
                if ($akun === '') return redirect()->back()->with('error', 'Kode akun wajib diisi.');
                if (!in_array($jenis, ['DEBIT', 'KREDIT'], true)) return redirect()->back()->with('error', 'Jenis harus Debit/Kredit.');
                if ($nom <= 0) return redirect()->back()->with('error', 'Nominal harus > 0.');

                $debit = $jenis === 'DEBIT' ? $nom : 0.0;
                $kredit = $jenis === 'KREDIT' ? $nom : 0.0;
                $sumDebit += $debit;
                $sumKredit += $kredit;
                $clean[] = [
                    'akun' => $akun,
                    'debit' => $debit,
                    'kredit' => $kredit,
                ];
            }

            if (round($sumDebit, 2) !== round($sumKredit, 2)) {
                return redirect()->back()->with('error', 'Total Debit harus sama dengan Total Kredit.');
            }

            $dbCode = $this->getDatabaseCode($request);

            return DB::transaction(function () use ($dbCode, $periode, $postingDate, $remark, $clean, $hasPosting, $hasRemark, $hasNamaAkun) {
                $kodeJurnal = $this->nextKodeJurnal($dbCode);

                $names = [];
                if ($hasNamaAkun && Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun') && Schema::hasColumn('tb_nabb', 'Nama_Akun')) {
                    try {
                        $akunList = collect($clean)->pluck('akun')->unique()->values()->all();
                        $names = DB::table('tb_nabb')->whereIn('Kode_Akun', $akunList)->pluck('Nama_Akun', 'Kode_Akun')->all();
                    } catch (\Throwable) {
                        $names = [];
                    }
                }

                $rows = [];
                foreach ($clean as $c) {
                    $row = [
                        'Kode_Jurnal' => $kodeJurnal,
                        'Periode' => $periode,
                        'Kode_Akun' => $c['akun'],
                        'Debit' => $c['debit'],
                        'Kredit' => $c['kredit'],
                    ];
                    if ($hasPosting) $row['Posting_Date'] = $postingDate;
                    if ($hasRemark) $row['Remark'] = $remark;
                    if ($hasNamaAkun) $row['Nama_Akun'] = (string) ($names[$c['akun']] ?? '');
                    $rows[] = $row;
                }

                DB::table('tb_jurnalpenyesuaian')->insert($rows);

                return redirect()
                    ->route('keuangan.penyesuaian.index', [
                        'periodType' => 'month',
                        'period' => Carbon::parse($periode)->format('Ym'),
                        'search' => $kodeJurnal,
                    ])
                    ->with('success', 'Berhasil simpan jurnal penyesuaian: ' . $kodeJurnal);
            });
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
