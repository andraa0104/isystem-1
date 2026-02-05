<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class AuditRekonsiliasiController
{
    private function getPeriodOptions(): array
    {
        // Prefer tb_nabbrekap (periodic snapshot), fallback to tb_jurnal.
        if (Schema::hasTable('tb_nabbrekap') && Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB')) {
            try {
                $p = DB::table('tb_nabbrekap')
                    ->selectRaw('DISTINCT RIGHT(Kode_NaBB, 6) as period')
                    ->whereNotNull('Kode_NaBB')
                    ->orderByDesc('period')
                    ->pluck('period')
                    ->filter(fn ($v) => is_string($v) && preg_match('/^\\d{6}$/', $v))
                    ->values()
                    ->all();
                if (count($p) > 0) {
                    return $p;
                }
            } catch (\Throwable) {
                // ignore and fallback
            }
        }

        if (Schema::hasTable('tb_jurnal') && Schema::hasColumn('tb_jurnal', 'Tgl_Jurnal')) {
            try {
                return DB::table('tb_jurnal')
                    ->selectRaw("DISTINCT DATE_FORMAT(Tgl_Jurnal, '%Y%m') as period")
                    ->whereNotNull('Tgl_Jurnal')
                    ->orderByDesc('period')
                    ->pluck('period')
                    ->filter(fn ($v) => is_string($v) && preg_match('/^\\d{6}$/', $v))
                    ->values()
                    ->all();
            } catch (\Throwable) {
                return [];
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

    private function emptyResponse(string $periodType, string $period, string $label, ?string $error = null, ?string $effectivePeriod = null, ?string $effectiveLabel = null, string $findingsMode = 'unbalanced')
    {
        $payload = [
            'period_type' => $periodType,
            'period' => $period,
            'period_label' => $label,
            'effective_period' => $effectivePeriod,
            'effective_period_label' => $effectiveLabel,
            'findings_mode' => $findingsMode,
            'kpis' => [
                'trx' => ['total' => 0, 'balanced' => 0, 'unbalanced' => 0, 'sum_selisih_abs' => 0],
                'ajp' => ['total' => 0, 'balanced' => 0, 'unbalanced' => 0, 'sum_selisih_abs' => 0],
                'neraca' => ['total_aset' => 0, 'total_liabilitas' => 0, 'total_ekuitas' => 0, 'selisih' => 0, 'tolerance' => 0, 'is_balanced' => false],
                'modal' => ['opening_equity' => 0, 'contributions' => 0, 'withdrawals' => 0, 'net_income' => 0, 'computed_ending_equity' => 0, 'snapshot_ending_equity' => 0, 'diff' => 0, 'tolerance' => 0, 'is_match' => false],
            ],
            'findings' => [
                'unbalanced_journals' => [],
                'unbalanced_ajp_docs' => [],
                'neraca_anomalies' => [],
                'equity_movements_top' => [],
            ],
        ];

        if ($error) {
            $payload['error'] = $error;
        }

        return $payload;
    }

    public function index(Request $request)
    {
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');
        $findingsMode = (string) $request->query('findingsMode', 'unbalanced');
        $findingsMode = in_array($findingsMode, ['unbalanced', 'all'], true) ? $findingsMode : 'unbalanced';

        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        return Inertia::render('laporan/audit-rekonsiliasi/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'findingsMode' => $findingsMode,
            ],
            'periodOptions' => $this->getPeriodOptions(),
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $this->getYearOptions(),
            'defaultYear' => $defaultYear,
        ]);
    }

    private function validateTables(): ?string
    {
        foreach ([['tb_jurnal', ['Kode_Jurnal', 'Tgl_Jurnal']], ['tb_jurnaldetail', ['Kode_Jurnal', 'Debit', 'Kredit']], ['tb_jurnalpenyesuaian', ['Kode_Jurnal', 'Periode', 'Debit', 'Kredit', 'Kode_Akun']], ['tb_nabbrekap', ['Kode_NaBB', 'Kode_Akun', 'Saldo']]] as [$table, $cols]) {
            if (!Schema::hasTable($table)) {
                return "Tabel $table tidak ditemukan.";
            }
            foreach ($cols as $c) {
                if (!Schema::hasColumn($table, $c)) {
                    return "Kolom $table.$c tidak ditemukan.";
                }
            }
        }

        return null;
    }

    public function rows(Request $request)
    {
        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $period = (string) $request->query('period', '');
        $findingsMode = (string) $request->query('findingsMode', 'unbalanced');
        $findingsMode = in_array($findingsMode, ['unbalanced', 'all'], true) ? $findingsMode : 'unbalanced';

        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();
        if ($period === '') {
            $period = $periodType === 'year' ? ($defaultYear ?: '') : ($defaultPeriod ?: '');
        }

        $range = $this->parsePeriodToRange($periodType, $period);
        if (!$range) {
            return response()->json($this->emptyResponse($periodType, $period, $periodType === 'year' ? ('FY ' . $period . ' (Jan–Des)') : $period, 'Periode tidak valid.', null, null, $findingsMode), 500);
        }

        $effectivePeriod = null;
        $effectiveLabel = null;
        if ($range['period_type'] === 'year') {
            $effectivePeriod = $this->getLatestMonthInYear($range['period']);
            if ($effectivePeriod) {
                try {
                    $effectiveLabel = Carbon::createFromFormat('Ym', $effectivePeriod)->locale('id')->translatedFormat('M Y') . ' (snapshot)';
                } catch (\Throwable) {
                    $effectiveLabel = $effectivePeriod . ' (snapshot)';
                }
            }
        } else {
            $effectivePeriod = $range['period'];
            $effectiveLabel = $range['label'];
        }

        try {
            $validationError = $this->validateTables();
            if ($validationError) {
                return response()->json($this->emptyResponse($range['period_type'], $range['period'], $range['label'], $validationError, $effectivePeriod, $effectiveLabel, $findingsMode), 500);
            }

            $hasTbNabb = Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
            $hasVoucher = Schema::hasColumn('tb_jurnal', 'Kode_Voucher');
            $hasRemark = Schema::hasColumn('tb_jurnal', 'Remark');
            $hasAjpPostingDate = Schema::hasColumn('tb_jurnalpenyesuaian', 'Posting_Date');
            $hasAjpRemark = Schema::hasColumn('tb_jurnalpenyesuaian', 'Remark');

            $start = $range['start']->toDateString();
            $end = $range['end']->toDateString();

            // --- KPI TRX (Jurnal Umum) ---
            $detailAgg = DB::table('tb_jurnaldetail as d')
                ->selectRaw('d.Kode_Jurnal as Kode_Jurnal')
                ->selectRaw('SUM(COALESCE(d.Debit,0)) as total_debit')
                ->selectRaw('SUM(COALESCE(d.Kredit,0)) as total_kredit')
                ->groupBy('d.Kode_Jurnal');

            $trxBase = DB::table('tb_jurnal as j')
                ->joinSub($detailAgg, 'a', 'a.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [$start, $end])
                ->selectRaw('j.Kode_Jurnal')
                ->selectRaw('j.Tgl_Jurnal as date')
                ->selectRaw(($hasVoucher ? 'j.Kode_Voucher' : "''") . ' as kode_voucher')
                ->selectRaw(($hasRemark ? 'j.Remark' : "''") . ' as remark')
                ->selectRaw('COALESCE(a.total_debit,0) as total_debit')
                ->selectRaw('COALESCE(a.total_kredit,0) as total_kredit')
                ->selectRaw('(COALESCE(a.total_debit,0) - COALESCE(a.total_kredit,0)) as selisih');

            $trxSummary = DB::query()
                ->fromSub($trxBase, 'x')
                ->selectRaw('COUNT(*) as total')
                ->selectRaw('SUM(CASE WHEN x.total_debit = x.total_kredit THEN 1 ELSE 0 END) as balanced')
                ->selectRaw('SUM(CASE WHEN x.total_debit <> x.total_kredit THEN 1 ELSE 0 END) as unbalanced')
                ->selectRaw('COALESCE(SUM(ABS(x.selisih)),0) as sum_selisih_abs')
                ->first();

            $trxFindingsQuery = DB::query()
                ->fromSub($trxBase, 'x')
                ->when(
                    $findingsMode === 'unbalanced',
                    fn ($q) => $q->whereRaw('x.total_debit <> x.total_kredit')->orderByRaw('ABS(x.selisih) desc'),
                    fn ($q) => $q->orderByDesc('x.date')->orderByRaw('ABS(x.selisih) desc'),
                )
                ->orderByDesc('x.date')
                ->limit(10)
                ->get([
                    'x.date',
                    'x.Kode_Jurnal as kode_jurnal',
                    'x.kode_voucher',
                    'x.remark',
                    'x.total_debit',
                    'x.total_kredit',
                    'x.selisih',
                ])
                ->map(fn ($r) => [
                    'date' => (string) ($r->date ?? ''),
                    'kode_jurnal' => (string) ($r->kode_jurnal ?? ''),
                    'kode_voucher' => (string) ($r->kode_voucher ?? ''),
                    'remark' => (string) ($r->remark ?? ''),
                    'total_debit' => (float) ($r->total_debit ?? 0),
                    'total_kredit' => (float) ($r->total_kredit ?? 0),
                    'selisih' => (float) ($r->selisih ?? 0),
                ])
                ->values()
                ->all();

            // --- KPI AJP ---
            $ajpLines = DB::table('tb_jurnalpenyesuaian as p')
                ->whereBetween('p.Periode', [$start, $end])
                ->selectRaw('p.Kode_Jurnal as kode_jurnal')
                ->selectRaw('DATE(p.Periode) as periode')
                ->selectRaw(($hasAjpPostingDate ? 'MAX(p.Posting_Date)' : 'MAX(p.Periode)') . ' as posting_date')
                ->selectRaw(($hasAjpRemark ? 'MAX(p.Remark)' : "''") . ' as remark')
                ->selectRaw('SUM(COALESCE(p.Debit,0)) as total_debit')
                ->selectRaw('SUM(COALESCE(p.Kredit,0)) as total_kredit')
                ->selectRaw('(SUM(COALESCE(p.Debit,0)) - SUM(COALESCE(p.Kredit,0))) as selisih')
                ->selectRaw('COUNT(*) as line_count')
                ->groupBy('p.Kode_Jurnal')
                ->groupBy(DB::raw('DATE(p.Periode)'));

            $ajpSummary = DB::query()
                ->fromSub($ajpLines, 'x')
                ->selectRaw('COUNT(*) as total')
                ->selectRaw('SUM(CASE WHEN x.total_debit = x.total_kredit THEN 1 ELSE 0 END) as balanced')
                ->selectRaw('SUM(CASE WHEN x.total_debit <> x.total_kredit THEN 1 ELSE 0 END) as unbalanced')
                ->selectRaw('COALESCE(SUM(ABS(x.selisih)),0) as sum_selisih_abs')
                ->first();

            $ajpFindingsQuery = DB::query()
                ->fromSub($ajpLines, 'x')
                ->when(
                    $findingsMode === 'unbalanced',
                    fn ($q) => $q->whereRaw('x.total_debit <> x.total_kredit')->orderByRaw('ABS(x.selisih) desc'),
                    fn ($q) => $q->orderByDesc('x.periode')->orderByRaw('ABS(x.selisih) desc'),
                )
                ->orderByDesc('x.periode')
                ->limit(10)
                ->get([
                    'x.periode',
                    'x.kode_jurnal',
                    'x.posting_date',
                    'x.remark',
                    'x.total_debit',
                    'x.total_kredit',
                    'x.selisih',
                ])
                ->map(fn ($r) => [
                    'periode' => (string) ($r->periode ?? ''),
                    'kode_jurnal' => (string) ($r->kode_jurnal ?? ''),
                    'posting_date' => (string) ($r->posting_date ?? ''),
                    'remark' => (string) ($r->remark ?? ''),
                    'total_debit' => (float) ($r->total_debit ?? 0),
                    'total_kredit' => (float) ($r->total_kredit ?? 0),
                    'selisih' => (float) ($r->selisih ?? 0),
                ])
                ->values()
                ->all();

            // --- KPI Neraca Akhir (snapshot via nabbrekap) ---
            $totalAset = 0.0;
            $totalLiabilitas = 0.0;
            $totalEkuitas = 0.0;
            $selisih = 0.0;
            $tolerance = 0.0;
            $isBalanced = false;

            if ($effectivePeriod) {
                $neracaAgg = DB::table('tb_nabbrekap as n')
                    ->whereRaw('RIGHT(n.Kode_NaBB, 6) = ?', [$effectivePeriod])
                    ->selectRaw("COALESCE(SUM(CASE WHEN LEFT(TRIM(n.Kode_Akun),1)='1' THEN ABS(COALESCE(n.Saldo,0)) ELSE 0 END),0) as total_aset")
                    ->selectRaw("COALESCE(SUM(CASE WHEN LEFT(TRIM(n.Kode_Akun),1)='2' THEN ABS(COALESCE(n.Saldo,0)) ELSE 0 END),0) as total_liabilitas")
                    ->selectRaw("COALESCE(SUM(CASE WHEN LEFT(TRIM(n.Kode_Akun),1)='3' THEN ABS(COALESCE(n.Saldo,0)) ELSE 0 END),0) as total_ekuitas")
                    ->first();

                $totalAset = (float) ($neracaAgg->total_aset ?? 0);
                $totalLiabilitas = (float) ($neracaAgg->total_liabilitas ?? 0);
                $totalEkuitas = (float) ($neracaAgg->total_ekuitas ?? 0);
                $selisih = $totalAset - ($totalLiabilitas + $totalEkuitas);
                $tolerance = max(1.0, $totalAset * 0.00001);
                $isBalanced = abs($selisih) <= $tolerance;
            }

            // Neraca anomalies
            $neracaAnomaliesQuery = DB::table('tb_nabbrekap as n')
                ->whereRaw('RIGHT(n.Kode_NaBB, 6) = ?', [$effectivePeriod ?: ''])
                ->where(function ($q) {
                    $q->where(function ($w) {
                        $w->where('n.Kode_Akun', 'like', '1%')->where('n.Saldo', '<', 0);
                    })->orWhere(function ($w) {
                        $w->where(function ($x) {
                            $x->where('n.Kode_Akun', 'like', '2%')->orWhere('n.Kode_Akun', 'like', '3%');
                        })->where('n.Saldo', '>', 0);
                    });
                })
                ->orderByRaw('ABS(COALESCE(n.Saldo,0)) desc')
                ->limit(10)
                ->selectRaw('n.Kode_Akun as kode_akun')
                ->selectRaw('COALESCE(n.Saldo,0) as saldo_raw');

            if ($hasTbNabb) {
                $neracaAnomaliesQuery->leftJoin('tb_nabb as b', 'b.Kode_Akun', '=', 'n.Kode_Akun')
                    ->addSelect(DB::raw('b.Nama_Akun as nama_akun'));
            } else {
                $neracaAnomaliesQuery->addSelect(DB::raw("'' as nama_akun"));
            }

            $neracaAnomalies = $effectivePeriod
                ? $neracaAnomaliesQuery->get()->map(fn ($r) => [
                    'kode_akun' => (string) ($r->kode_akun ?? ''),
                    'nama_akun' => (string) ($r->nama_akun ?? ''),
                    'saldo_raw' => (float) ($r->saldo_raw ?? 0),
                ])->values()->all()
                : [];

            // --- KPI Modal (rekonsiliasi) ---
            $openingEquity = 0.0;
            $contributions = 0.0;
            $withdrawals = 0.0;
            $netIncome = 0.0;
            $computedEnding = 0.0;
            $snapshotEnding = 0.0;
            $diff = 0.0;
            $modalTolerance = 0.0;
            $isMatch = false;

            // Opening snapshot period (prev month / prev year last month)
            $openingPeriod = null;
            if ($range['period_type'] === 'month') {
                $openingPeriod = $this->getPrevMonth($effectivePeriod ?: $range['period']);
            } else {
                $openingPeriod = $this->getLatestMonthInYear((string) ((int) $range['period'] - 1));
            }

            $sumEquitySnapshot = function (?string $p) {
                if (!$p) return 0.0;
                $s = DB::table('tb_nabbrekap as n')
                    ->whereRaw('RIGHT(n.Kode_NaBB, 6) = ?', [$p])
                    ->where('n.Kode_Akun', 'like', '3%')
                    ->selectRaw('COALESCE(SUM(ABS(COALESCE(n.Saldo,0))),0) as total')
                    ->value('total');
                return (float) ($s ?? 0);
            };

            $openingEquity = $sumEquitySnapshot($openingPeriod);
            $snapshotEnding = $sumEquitySnapshot($effectivePeriod);

            // Net income (prefix 4-7) from TRX + AJP
            $trxNominal = DB::table('tb_jurnal as j')
                ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [$start, $end])
                ->where(function ($q) {
                    $q->where('d.Kode_Akun', 'like', '4%')
                        ->orWhere('d.Kode_Akun', 'like', '5%')
                        ->orWhere('d.Kode_Akun', 'like', '6%')
                        ->orWhere('d.Kode_Akun', 'like', '7%');
                })
                ->selectRaw('d.Kode_Akun as kode_akun, COALESCE(d.Debit,0) as debit, COALESCE(d.Kredit,0) as kredit');

            $ajpNominal = DB::table('tb_jurnalpenyesuaian as p')
                ->whereBetween('p.Periode', [$start, $end])
                ->where(function ($q) {
                    $q->where('p.Kode_Akun', 'like', '4%')
                        ->orWhere('p.Kode_Akun', 'like', '5%')
                        ->orWhere('p.Kode_Akun', 'like', '6%')
                        ->orWhere('p.Kode_Akun', 'like', '7%');
                })
                ->selectRaw('p.Kode_Akun as kode_akun, COALESCE(p.Debit,0) as debit, COALESCE(p.Kredit,0) as kredit');

            $nomUnion = $trxNominal->unionAll($ajpNominal);
            $netIncome = (float) (DB::query()->fromSub($nomUnion, 'u')->selectRaw('COALESCE(SUM(u.kredit - u.debit),0) as n')->value('n') ?? 0);

            // Equity movements (prefix 3) from TRX + AJP
            $trxEq = DB::table('tb_jurnal as j')
                ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [$start, $end])
                ->where('d.Kode_Akun', 'like', '3%')
                ->selectRaw('d.Kode_Akun as kode_akun, COALESCE(d.Debit,0) as debit, COALESCE(d.Kredit,0) as kredit');
            $ajpEq = DB::table('tb_jurnalpenyesuaian as p')
                ->whereBetween('p.Periode', [$start, $end])
                ->where('p.Kode_Akun', 'like', '3%')
                ->selectRaw('p.Kode_Akun as kode_akun, COALESCE(p.Debit,0) as debit, COALESCE(p.Kredit,0) as kredit');

            $eqUnion = $trxEq->unionAll($ajpEq);
            $eqAgg = DB::query()
                ->fromSub($eqUnion, 'u')
                ->selectRaw('u.kode_akun as kode_akun')
                ->selectRaw('COALESCE(SUM(u.debit),0) as debit')
                ->selectRaw('COALESCE(SUM(u.kredit),0) as kredit')
                ->selectRaw('COALESCE(SUM(u.kredit - u.debit),0) as net')
                ->groupBy('u.kode_akun');

            $eqAggRows = $eqAgg->get();
            foreach ($eqAggRows as $r) {
                $net = (float) ($r->net ?? 0);
                if ($net > 0) $contributions += $net;
                if ($net < 0) $withdrawals += -$net;
            }

            $computedEnding = $openingEquity + $contributions + $netIncome - $withdrawals;
            $diff = $snapshotEnding - $computedEnding;
            $modalTolerance = max(1.0, abs($snapshotEnding) * 0.00001);
            $isMatch = abs($diff) <= $modalTolerance;

            // Equity movements top (abs net)
            $eqTop = $eqAgg
                ->orderByRaw('ABS(net) desc')
                ->limit(10);

            if ($hasTbNabb) {
                $eqTop->leftJoin('tb_nabb as b', 'b.Kode_Akun', '=', 'u.kode_akun')
                    ->addSelect(DB::raw('b.Nama_Akun as nama_akun'));
            } else {
                $eqTop->addSelect(DB::raw("'' as nama_akun"));
            }

            $equityMovementsTop = $eqTop->get()->map(fn ($r) => [
                'kode_akun' => (string) ($r->kode_akun ?? ''),
                'nama_akun' => (string) ($r->nama_akun ?? ''),
                'debit' => (float) ($r->debit ?? 0),
                'kredit' => (float) ($r->kredit ?? 0),
                'net' => (float) ($r->net ?? 0),
            ])->values()->all();

            return response()->json([
                'period_type' => $range['period_type'],
                'period' => $range['period'],
                'period_label' => $range['label'],
                'effective_period' => $effectivePeriod,
                'effective_period_label' => $effectiveLabel,
                'findings_mode' => $findingsMode,
                'kpis' => [
                    'trx' => [
                        'total' => (int) ($trxSummary->total ?? 0),
                        'balanced' => (int) ($trxSummary->balanced ?? 0),
                        'unbalanced' => (int) ($trxSummary->unbalanced ?? 0),
                        'sum_selisih_abs' => (float) ($trxSummary->sum_selisih_abs ?? 0),
                    ],
                    'ajp' => [
                        'total' => (int) ($ajpSummary->total ?? 0),
                        'balanced' => (int) ($ajpSummary->balanced ?? 0),
                        'unbalanced' => (int) ($ajpSummary->unbalanced ?? 0),
                        'sum_selisih_abs' => (float) ($ajpSummary->sum_selisih_abs ?? 0),
                    ],
                    'neraca' => [
                        'total_aset' => $totalAset,
                        'total_liabilitas' => $totalLiabilitas,
                        'total_ekuitas' => $totalEkuitas,
                        'selisih' => $selisih,
                        'tolerance' => $tolerance,
                        'is_balanced' => $isBalanced,
                    ],
                    'modal' => [
                        'opening_equity' => $openingEquity,
                        'contributions' => $contributions,
                        'withdrawals' => $withdrawals,
                        'net_income' => $netIncome,
                        'computed_ending_equity' => $computedEnding,
                        'snapshot_ending_equity' => $snapshotEnding,
                        'diff' => $diff,
                        'tolerance' => $modalTolerance,
                        'is_match' => $isMatch,
                    ],
                ],
                'findings' => [
                    'unbalanced_journals' => $trxFindingsQuery,
                    'unbalanced_ajp_docs' => $ajpFindingsQuery,
                    'neraca_anomalies' => $neracaAnomalies,
                    'equity_movements_top' => $equityMovementsTop,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json($this->emptyResponse($range['period_type'], $range['period'], $range['label'], $e->getMessage(), $effectivePeriod, $effectiveLabel, $findingsMode), 500);
        }
    }
}
