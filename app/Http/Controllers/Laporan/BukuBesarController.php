<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class BukuBesarController
{
    private function getPeriodOptions(): array
    {
        // Prefer tb_nabbrekap (periodic snapshot), fallback to tb_jurnal if needed.
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

    private function ensureRequiredForLedger(): ?string
    {
        // Strict: require tb_nabb for account options and labels.
        if (!Schema::hasTable('tb_nabb')) {
            return 'Tabel tb_nabb tidak ditemukan.';
        }
        foreach (['Kode_Akun', 'Nama_Akun'] as $c) {
            if (!Schema::hasColumn('tb_nabb', $c)) {
                return "Kolom tb_nabb.$c tidak ditemukan.";
            }
        }

        // For ledger we require both TRX and AJP tables; UI can filter but page is ledger.
        if (!Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnaldetail')) {
            return 'Tabel tb_jurnal/tb_jurnaldetail tidak ditemukan.';
        }
        foreach ([['tb_jurnal', 'Kode_Jurnal'], ['tb_jurnal', 'Tgl_Jurnal']] as [$t, $c]) {
            if (!Schema::hasColumn($t, $c)) {
                return "Kolom $t.$c tidak ditemukan.";
            }
        }
        foreach ([['tb_jurnaldetail', 'Kode_Jurnal'], ['tb_jurnaldetail', 'Kode_Akun'], ['tb_jurnaldetail', 'Debit'], ['tb_jurnaldetail', 'Kredit']] as [$t, $c]) {
            if (!Schema::hasColumn($t, $c)) {
                return "Kolom $t.$c tidak ditemukan.";
            }
        }

        if (!Schema::hasTable('tb_jurnalpenyesuaian')) {
            return 'Tabel tb_jurnalpenyesuaian tidak ditemukan.';
        }
        foreach (['Periode', 'Kode_Jurnal', 'Kode_Akun', 'Debit', 'Kredit'] as $c) {
            if (!Schema::hasColumn('tb_jurnalpenyesuaian', $c)) {
                return "Kolom tb_jurnalpenyesuaian.$c tidak ditemukan.";
            }
        }

        return null;
    }

    private function getAccountOptions(): array
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            return [];
        }

        return DB::table('tb_nabb')
            ->select(['Kode_Akun', 'Nama_Akun'])
            ->orderBy('Kode_Akun', 'asc')
            ->get()
            ->map(fn ($r) => [
                'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
            ])
            ->filter(fn ($r) => $r['Kode_Akun'] !== '')
            ->values()
            ->all();
    }

    public function index(Request $request)
    {
        $periodOptions = $this->getPeriodOptions();
        $defaultPeriod = $this->getDefaultPeriod();
        $yearOptions = $this->getYearOptions();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        $accounts = $this->getAccountOptions();
        $defaultAccount = $accounts[0]['Kode_Akun'] ?? '';

        return Inertia::render('laporan/buku-besar/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'account' => (string) $request->query('account', $defaultAccount),
                'source' => (string) $request->query('source', 'all'),
                'search' => (string) $request->query('search', ''),
                'pageSize' => $request->query('pageSize', 50),
            ],
            'periodOptions' => $periodOptions,
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $yearOptions,
            'defaultYear' => $defaultYear,
            'accountOptions' => $accounts,
        ]);
    }

    public function print(Request $request)
    {
        $periodOptions = $this->getPeriodOptions();
        $defaultPeriod = $this->getDefaultPeriod();
        $yearOptions = $this->getYearOptions();
        $defaultYear = $this->getDefaultYear();

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = $periodType === 'year'
            ? ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: ''))
            : ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: ''));

        $accounts = $this->getAccountOptions();
        $defaultAccount = $accounts[0]['Kode_Akun'] ?? '';

        return Inertia::render('laporan/buku-besar/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'account' => (string) $request->query('account', $defaultAccount),
                'source' => (string) $request->query('source', 'all'),
                'search' => (string) $request->query('search', ''),
            ],
            'periodOptions' => $periodOptions,
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $yearOptions,
            'defaultYear' => $defaultYear,
            'accountOptions' => $accounts,
        ]);
    }

    private function normalizeSnapshotSignedSaldo(string $kodeAkun, float $saldoRaw): float
    {
        $first = substr(trim($kodeAkun), 0, 1);
        // credit-normal: liabilitas (2), ekuitas (3), pendapatan (4)
        if (in_array($first, ['2', '3', '4'], true)) {
            return -abs($saldoRaw);
        }
        return abs($saldoRaw);
    }

    private function getOpeningBalanceSigned(string $periodType, string $period, string $kodeAkun): array
    {
        // Opening from tb_nabbrekap snapshot (prev period). If missing -> 0 with warning.
        $openingSigned = 0.0;
        $source = 'missing';
        $warning = true;
        $openingPeriod = null;

        if (!Schema::hasTable('tb_nabbrekap') || !Schema::hasColumn('tb_nabbrekap', 'Kode_NaBB') || !Schema::hasColumn('tb_nabbrekap', 'Kode_Akun') || !Schema::hasColumn('tb_nabbrekap', 'Saldo')) {
            return [
                'opening_balance_signed' => 0.0,
                'opening_warning' => true,
                'opening_source' => 'missing',
                'opening_period' => null,
            ];
        }

        if ($periodType === 'month') {
            $openingPeriod = $this->getPrevMonth($period);
        } else {
            $prevYear = (string) ((int) $period - 1);
            $openingPeriod = $this->getLatestMonthInYear($prevYear);
        }

        if (!$openingPeriod) {
            return [
                'opening_balance_signed' => 0.0,
                'opening_warning' => true,
                'opening_source' => 'missing',
                'opening_period' => null,
            ];
        }

        $row = DB::table('tb_nabbrekap as n')
            ->whereRaw('RIGHT(n.Kode_NaBB, 6) = ?', [$openingPeriod])
            ->where('n.Kode_Akun', '=', $kodeAkun)
            ->selectRaw('COALESCE(n.Saldo,0) as Saldo')
            ->first();

        if ($row) {
            $openingSigned = $this->normalizeSnapshotSignedSaldo($kodeAkun, (float) ($row->Saldo ?? 0));
            $source = 'nabbrekap';
            $warning = false;
        }

        return [
            'opening_balance_signed' => $openingSigned,
            'opening_warning' => $warning,
            'opening_source' => $source,
            'opening_period' => $openingPeriod,
        ];
    }

    public function rows(Request $request)
    {
        try {
            $err = $this->ensureRequiredForLedger();
            if ($err) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_balance_signed' => 0,
                        'opening_warning' => true,
                        'opening_source' => 'missing',
                        'opening_period' => null,
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'closing_balance_signed' => 0,
                        'line_count' => 0,
                    ],
                    'error' => $err,
                ], 500);
            }

            $periodType = (string) $request->query('periodType', 'month');
            $periodType = in_array($periodType, ['month', 'year'], true) ? $periodType : 'month';

            $period = (string) $request->query('period', '');
            if ($period === '') {
                $period = $periodType === 'year' ? ($this->getDefaultYear() ?: '') : ($this->getDefaultPeriod() ?: '');
            }

            $range = $this->parsePeriodToRange($periodType, $period);
            if (!$range) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_balance_signed' => 0,
                        'opening_warning' => true,
                        'opening_source' => 'missing',
                        'opening_period' => null,
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'closing_balance_signed' => 0,
                        'line_count' => 0,
                    ],
                    'error' => 'Periode tidak valid.',
                ], 500);
            }

            $account = trim((string) $request->query('account', ''));
            if ($account === '') {
                $opts = $this->getAccountOptions();
                $account = $opts[0]['Kode_Akun'] ?? '';
            }
            if ($account === '') {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'opening_balance_signed' => 0,
                        'opening_warning' => true,
                        'opening_source' => 'missing',
                        'opening_period' => null,
                        'total_debit' => 0,
                        'total_kredit' => 0,
                        'closing_balance_signed' => 0,
                        'line_count' => 0,
                    ],
                    'error' => 'Akun tidak valid.',
                ], 500);
            }

            $source = strtolower((string) $request->query('source', 'all'));
            $source = in_array($source, ['all', 'trx', 'ajp'], true) ? $source : 'all';

            $search = trim((string) $request->query('search', ''));

            $pageSizeRaw = $request->query('pageSize', 50);
            $pageSizeIsAll = is_string($pageSizeRaw) && strtolower($pageSizeRaw) === 'all';
            $pageSize = $pageSizeIsAll ? null : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $hasVoucher = Schema::hasColumn('tb_jurnal', 'Kode_Voucher');
            $hasRemark = Schema::hasColumn('tb_jurnal', 'Remark');

            $hasAjpPostingDate = Schema::hasColumn('tb_jurnalpenyesuaian', 'Posting_Date');
            $hasAjpRemark = Schema::hasColumn('tb_jurnalpenyesuaian', 'Remark');

            $trx = DB::table('tb_jurnal as j')
                ->join('tb_jurnaldetail as d', 'd.Kode_Jurnal', '=', 'j.Kode_Jurnal')
                ->whereBetween('j.Tgl_Jurnal', [$range['start']->toDateString(), $range['end']->toDateString()])
                ->where('d.Kode_Akun', '=', $account)
                ->selectRaw('j.Tgl_Jurnal as date')
                ->selectRaw("'TRX' as source")
                ->selectRaw('j.Kode_Jurnal as kode_jurnal')
                ->selectRaw(($hasVoucher ? 'j.Kode_Voucher' : "''") . ' as kode_voucher')
                ->selectRaw(($hasRemark ? 'j.Remark' : "''") . ' as remark')
                ->selectRaw('COALESCE(d.Debit,0) as debit')
                ->selectRaw('COALESCE(d.Kredit,0) as kredit');

            if ($search !== '') {
                $trx->where(function ($q) use ($search, $hasVoucher, $hasRemark) {
                    $q->where('j.Kode_Jurnal', 'like', '%' . $search . '%');
                    if ($hasVoucher) {
                        $q->orWhere('j.Kode_Voucher', 'like', '%' . $search . '%');
                    }
                    if ($hasRemark) {
                        $q->orWhere('j.Remark', 'like', '%' . $search . '%');
                    }
                });
            }

            $ajpDateExpr = $hasAjpPostingDate ? 'COALESCE(p.Posting_Date, p.Periode)' : 'p.Periode';
            $ajp = DB::table('tb_jurnalpenyesuaian as p')
                ->whereBetween('p.Periode', [$range['start']->toDateString(), $range['end']->toDateString()])
                ->where('p.Kode_Akun', '=', $account)
                ->selectRaw($ajpDateExpr . ' as date')
                ->selectRaw("'AJP' as source")
                ->selectRaw('p.Kode_Jurnal as kode_jurnal')
                ->selectRaw("'' as kode_voucher")
                ->selectRaw(($hasAjpRemark ? 'p.Remark' : "''") . ' as remark')
                ->selectRaw('COALESCE(p.Debit,0) as debit')
                ->selectRaw('COALESCE(p.Kredit,0) as kredit');

            if ($search !== '') {
                $ajp->where(function ($q) use ($search, $hasAjpRemark) {
                    $q->where('p.Kode_Jurnal', 'like', '%' . $search . '%');
                    if ($hasAjpRemark) {
                        $q->orWhere('p.Remark', 'like', '%' . $search . '%');
                    }
                });
            }

            $union = null;
            if ($source === 'trx') {
                $union = $trx;
            } elseif ($source === 'ajp') {
                $union = $ajp;
            } else {
                $union = $trx->unionAll($ajp);
            }

            $ordered = DB::query()
                ->fromSub($union, 'u')
                ->orderBy('u.date', 'asc')
                ->orderBy('u.kode_jurnal', 'asc')
                ->orderBy('u.source', 'asc');

            $all = $ordered->get();

            $opening = $this->getOpeningBalanceSigned($range['period_type'], $range['period'], $account);
            $running = (float) ($opening['opening_balance_signed'] ?? 0);

            $ledger = [];
            $totalDebit = 0.0;
            $totalKredit = 0.0;

            foreach ($all as $row) {
                $debit = (float) ($row->debit ?? 0);
                $kredit = (float) ($row->kredit ?? 0);
                $running += ($debit - $kredit);
                $totalDebit += $debit;
                $totalKredit += $kredit;

                $ledger[] = [
                    'date' => (string) ($row->date ?? ''),
                    'source' => (string) ($row->source ?? ''),
                    'kode_jurnal' => (string) ($row->kode_jurnal ?? ''),
                    'kode_voucher' => (string) ($row->kode_voucher ?? ''),
                    'remark' => (string) ($row->remark ?? ''),
                    'debit' => $debit,
                    'kredit' => $kredit,
                    'running_signed' => $running,
                    'saldo_display' => abs($running),
                    'saldo_side' => $running >= 0 ? 'D' : 'K',
                ];
            }

            $lineCount = count($ledger);
            $total = $lineCount;

            $slice = $ledger;
            if (!$pageSizeIsAll && $pageSize) {
                $offset = ($page - 1) * $pageSize;
                $slice = array_slice($ledger, $offset, $pageSize);
            }

            // Account label
            $accountRow = DB::table('tb_nabb')->where('Kode_Akun', $account)->first();
            $accountName = (string) ($accountRow->Nama_Akun ?? '');

            return response()->json([
                'rows' => $slice,
                'total' => $total,
                'period_type' => $range['period_type'],
                'period' => $range['period'],
                'period_label' => $range['label'],
                'account' => $account,
                'account_name' => $accountName,
                'source' => $source,
                'search' => $search,
                'summary' => [
                    'opening_balance_signed' => (float) ($opening['opening_balance_signed'] ?? 0),
                    'opening_warning' => (bool) ($opening['opening_warning'] ?? true),
                    'opening_source' => (string) ($opening['opening_source'] ?? 'missing'),
                    'opening_period' => $opening['opening_period'] ?? null,
                    'total_debit' => $totalDebit,
                    'total_kredit' => $totalKredit,
                    'closing_balance_signed' => (float) $running,
                    'line_count' => $lineCount,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'opening_balance_signed' => 0,
                    'opening_warning' => true,
                    'opening_source' => 'missing',
                    'opening_period' => null,
                    'total_debit' => 0,
                    'total_kredit' => 0,
                    'closing_balance_signed' => 0,
                    'line_count' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

