<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController
{
    private function hasKasBreakdownColumns(): array
    {
        if (!Schema::hasTable('tb_kas')) {
            return [
                'has_breakdown' => false,
                'has_b1' => false,
                'has_b2' => false,
                'has_b3' => false,
                'has_jenis1' => false,
                'has_jenis2' => false,
                'has_jenis3' => false,
            ];
        }

        $cols = Schema::getColumnListing('tb_kas');
        $hasB1 = in_array('Kode_Akun1', $cols, true) && in_array('Nominal1', $cols, true);
        $hasB2 = in_array('Kode_Akun2', $cols, true) && in_array('Nominal2', $cols, true);
        $hasB3 = in_array('Kode_Akun3', $cols, true) && in_array('Nominal3', $cols, true);
        $hasJenis1 = in_array('Jenis_Beban1', $cols, true);
        $hasJenis2 = in_array('Jenis_Beban2', $cols, true);
        $hasJenis3 = in_array('Jenis_Beban3', $cols, true);

        return [
            'has_breakdown' => $hasB1 || $hasB2 || $hasB3,
            'has_b1' => $hasB1,
            'has_b2' => $hasB2,
            'has_b3' => $hasB3,
            'has_jenis1' => $hasJenis1,
            'has_jenis2' => $hasJenis2,
            'has_jenis3' => $hasJenis3,
        ];
    }

    private function biayaSelectSumSql(array $flags): string
    {
        // Prefer breakdown columns (Kode_Akun1..3 + Nominal1..3). Fallback to tb_kas.Kode_Akun + Mutasi_Kas.
        $parts = [];

        if (!empty($flags['has_b1'])) {
            $parts[] = "CASE WHEN k.Kode_Akun1 LIKE '51%' THEN COALESCE(k.Nominal1,0) ELSE 0 END";
        }
        if (!empty($flags['has_b2'])) {
            $parts[] = "CASE WHEN k.Kode_Akun2 LIKE '51%' THEN COALESCE(k.Nominal2,0) ELSE 0 END";
        }
        if (!empty($flags['has_b3'])) {
            $parts[] = "CASE WHEN k.Kode_Akun3 LIKE '51%' THEN COALESCE(k.Nominal3,0) ELSE 0 END";
        }

        // Some datasets store expense "51" into Jenis_Beban* instead of Kode_Akun*.
        if (!empty($flags['has_jenis1']) && !empty($flags['has_b1'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban1 LIKE '51%' THEN COALESCE(k.Nominal1,0) ELSE 0 END";
        }
        if (!empty($flags['has_jenis2']) && !empty($flags['has_b2'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban2 LIKE '51%' THEN COALESCE(k.Nominal2,0) ELSE 0 END";
        }
        if (!empty($flags['has_jenis3']) && !empty($flags['has_b3'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban3 LIKE '51%' THEN COALESCE(k.Nominal3,0) ELSE 0 END";
        }

        if (count($parts) > 0) {
            return implode(' + ', $parts);
        }

        return "CASE WHEN k.Kode_Akun LIKE '51%' AND COALESCE(k.Mutasi_Kas,0) < 0 THEN -COALESCE(k.Mutasi_Kas,0) ELSE 0 END";
    }

    public function index()
    {
        // Initial props dikosongkan untuk mempercepat load. Data akan di-fetch per-card.
        return Inertia::render('dashboard', [
            'quotationStats' => [],
            'saldoStats' => [],
            'pdbStats' => (object) [],
            'pdoStats' => (object) [],
            'salesHppStats' => ['summary' => (object) [], 'series' => []],
        ]);
    }

    public function quotationStats(Request $request)
    {
        $range = strtolower((string) $request->query('range', ''));
        if (in_array($range, ['1_week', '1_month', '3_months', '5_months', '1_year'], true)) {
            return response()->json($this->buildQuotationStatsRange($range));
        }

        $months = (int) $request->query('months', 12);
        $months = max(1, min(24, $months));

        $group = strtolower((string) $request->query('group', 'week'));
        if (!in_array($group, ['week', 'month'], true)) {
            $group = 'week';
        }

        return response()->json($this->buildQuotationStats($months, $group));
    }

    public function saldoStats()
    {
        return response()->json($this->buildSaldoStats());
    }

    public function deliveryStats()
    {
        return response()->json($this->buildDeliveryStats());
    }

    private function buildQuotationStats(int $months = 12, string $group = 'week'): array
    {
        if (!Schema::hasTable('tb_penawaran')) {
            return [];
        }

        if ($group === 'month') {
            $end = Carbon::now()->startOfMonth();
            $start = $end->copy()->subMonths($months - 1);

            $rawStats = DB::table('tb_penawaran')
                ->selectRaw("DATE_FORMAT(Tgl_penawaran, '%Y-%m') as period, COUNT(*) as total")
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
                ->groupBy('period')
                ->orderBy('period')
                ->get()
                ->keyBy('period');

            $quotationStats = [];
            for ($i = 0; $i < $months; $i += 1) {
                $month = $start->copy()->addMonths($i);
                $period = $month->format('Y-m');
                $total = (int) ($rawStats[$period]->total ?? 0);
                $quotationStats[] = [
                    'period' => $period,
                    'label' => $month->locale('id')->translatedFormat('M Y'),
                    'total' => $total,
                ];
            }

            return $quotationStats;
        }

        // Week (ISO / Monday start)
        $endWeekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $startWeekStart = Carbon::now()
            ->startOfMonth()
            ->subMonths($months - 1)
            ->startOfWeek(Carbon::MONDAY);

        $rawStats = DB::table('tb_penawaran')
            ->selectRaw('YEARWEEK(Tgl_penawaran, 1) as week_key, COUNT(*) as total')
            ->whereNotNull('Tgl_penawaran')
            ->where('Tgl_penawaran', '>=', $startWeekStart->toDateString())
            ->where('Tgl_penawaran', '<=', Carbon::now()->toDateString())
            ->groupBy('week_key')
            ->orderBy('week_key')
            ->pluck('total', 'week_key');

        $quotationStats = [];
        $cursor = $startWeekStart->copy();
        while ($cursor->lte($endWeekStart)) {
            $isoYear = (int) $cursor->isoWeekYear();
            $isoWeek = (int) $cursor->isoWeek();
            $weekKey = ($isoYear * 100) + $isoWeek; // aligns with YEARWEEK(..., 1)
            $period = sprintf('%d-W%02d', $isoYear, $isoWeek);
            $total = (int) ($rawStats[$weekKey] ?? 0);
            $quotationStats[] = [
                'period' => $period,
                'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                'total' => $total,
            ];
            $cursor->addWeek();
        }

        return $quotationStats;
    }

    private function buildQuotationStatsRange(string $range): array
    {
        if (!Schema::hasTable('tb_penawaran')) {
            return [];
        }

        if ($range === '1_week') {
            $end = Carbon::now()->startOfDay();
            $start = $end->copy()->subDays(6);

            $raw = DB::table('tb_penawaran')
                ->selectRaw("DATE_FORMAT(Tgl_penawaran, '%Y-%m-%d') as period, COUNT(*) as total")
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
                ->where('Tgl_penawaran', '<=', $end->copy()->endOfDay()->toDateTimeString())
                ->groupBy('period')
                ->orderBy('period')
                ->pluck('total', 'period');

            $stats = [];
            for ($i = 0; $i < 7; $i += 1) {
                $day = $start->copy()->addDays($i);
                $key = $day->format('Y-m-d');
                $stats[] = [
                    'period' => $key,
                    'label' => $day->locale('id')->translatedFormat('d M'),
                    'total' => (int) ($raw[$key] ?? 0),
                ];
            }

            return $stats;
        }

        if ($range === '1_month') {
            // 4 minggu berjalan (termasuk minggu ini)
            $endWeek = Carbon::now()->startOfWeek(Carbon::MONDAY);
            $startWeek = $endWeek->copy()->subWeeks(3);

            $raw = DB::table('tb_penawaran')
                ->selectRaw('YEARWEEK(Tgl_penawaran, 1) as week_key, COUNT(*) as total')
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $startWeek->toDateString())
                ->where('Tgl_penawaran', '<=', Carbon::now()->endOfDay()->toDateTimeString())
                ->groupBy('week_key')
                ->orderBy('week_key')
                ->pluck('total', 'week_key');

            $stats = [];
            $cursor = $startWeek->copy();
            while ($cursor->lte($endWeek)) {
                $isoYear = (int) $cursor->isoWeekYear();
                $isoWeek = (int) $cursor->isoWeek();
                $weekKey = ($isoYear * 100) + $isoWeek;
                $stats[] = [
                    'period' => sprintf('%d-W%02d', $isoYear, $isoWeek),
                    'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                    'total' => (int) ($raw[$weekKey] ?? 0),
                ];
                $cursor->addWeek();
            }

            return $stats;
        }

        if ($range === '3_months') return $this->buildQuotationStats(3, 'month');
        if ($range === '5_months') return $this->buildQuotationStats(5, 'month');
        if ($range === '1_year') return $this->buildQuotationStats(12, 'month');

        return $this->buildQuotationStats(3, 'month');
    }

    private function buildSaldoStats(): array
    {
        $accountMap = [
            '1101AD' => 'Kas Tunai',
            '1102AD' => 'Kas Giro',
            '1103AD' => 'Kas Bank 1',
            '1104AD' => 'Kas Bank 2',
        ];

        $saldoByCode = collect();
        $lastVoucherByCode = collect();

        if (Schema::hasTable('tb_kas')
            && Schema::hasColumn('tb_kas', 'Saldo')
            && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
            && Schema::hasColumn('tb_kas', 'Kode_Voucher')
            && Schema::hasColumn('tb_kas', 'Kode_Akun')) {
            foreach (array_keys($accountMap) as $code) {
                $lastRow = DB::table('tb_kas')
                    ->where('Kode_Akun', $code)
                    ->orderByDesc('Tgl_Voucher')
                    ->orderByDesc('Kode_Voucher')
                    ->select(['Saldo', 'Tgl_Voucher'])
                    ->first();

                $saldoByCode[$code] = (float) ($lastRow->Saldo ?? 0);
                $lastVoucherByCode[$code] = $lastRow->Tgl_Voucher ?? null;
            }
        } else {
            foreach (array_keys($accountMap) as $code) {
                $saldoByCode[$code] = 0;
                $lastVoucherByCode[$code] = null;
            }
        }

        $saldoStats = [];
        foreach ($accountMap as $code => $label) {
            $saldoStats[] = [
                'code' => $code,
                'label' => $label,
                'saldo' => (float) ($saldoByCode[$code] ?? 0),
                'last_voucher' => $lastVoucherByCode[$code] ?? null,
            ];
        }

        return $saldoStats;
    }

    private function buildDeliveryStats(): array
    {
        return [
            'pdb' => $this->getPdbStats(),
            'pdo' => $this->getPdoStats(),
        ];
    }

    private function getPdbStats()
    {
        if (!Schema::hasTable('tb_kdpdb')) {
            return ['items' => [], 'total' => 0, 'count' => 0, 'last_update' => null];
        }

        // Note: As per request, we are not displaying items now, but keeping data structure compatible
        // just in case, or simplifying. Here we simplify to just stats.
        $total = DB::table('tb_kdpdb')->where('Sisa', '>', 0)->sum('Sisa');
        $count = DB::table('tb_kdpdb')->where('Sisa', '>', 0)->count();
        $lastUpdate = DB::table('tb_kdpdb')
            ->where('Sisa', '>', 0)
            ->orderByDesc('Tgl_Posting')
            ->value('Tgl_Posting');

        return [
            'total' => (float) $total,
            'count' => (int) $count,
            'last_update' => $lastUpdate,
        ];
    }

    private function getPdoStats()
    {
        if (!Schema::hasTable('tb_kdpdo')) {
            return ['items' => [], 'total' => 0, 'count' => 0, 'last_update' => null];
        }

        $total = DB::table('tb_kdpdo')->where('sisa_pdo', '>', 0)->sum('sisa_pdo');
        $count = DB::table('tb_kdpdo')->where('sisa_pdo', '>', 0)->count();
        $lastUpdate = DB::table('tb_kdpdo')
            ->where('sisa_pdo', '>', 0)
            ->orderByDesc('posting_date')
            ->value('posting_date');

        return [
            'total' => (float) $total,
            'count' => (int) $count,
            'last_update' => $lastUpdate,
        ];
    }

    public function getSalesHppStats(Request $request, $period = null) {
        // Prioritize route param -> query param -> default
        if (!$period) {
             $period = $request->input('period', '3_months');
        }

        $group = strtolower((string) $request->query('group', 'month'));
        if (!in_array($group, ['week', 'month'], true)) {
            $group = 'month';
        }

        $data = $this->getSalesHppStatsData($period, $group);
        return response()->json($data);
    }

    private function getSalesHppStatsData(string $period, string $group = 'week')
    {
        if ($period === '1_week') {
            return $this->getSalesHppDailyStats();
        }
        if ($period === '1_month') {
            return $this->getSalesHppWeeklyStatsForMonth();
        }

        $now = Carbon::now()->endOfMonth();
        $months = 3;

        if ($period === '5_months') {
            $months = 5;
        } elseif ($period === '1_year') {
            $months = 12;
        }

        // We want to go back $months - 1 from current month to include current month
        // e.g., 3 months: Current, Current-1, Current-2
        $start = $now->copy()->startOfMonth()->subMonths($months - 1);

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'debug' => [
                'received_period' => $period,
                'calculated_months' => $months,
            ],
            'series' => [],
        ];

        $salesLastUpdate = null;
        $hppLastUpdate = null;
        $biayaLastUpdate = null;
        $kasFlags = $this->hasKasBreakdownColumns();

        if ($group === 'week') {
            $endWeekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
            $startWeekStart = Carbon::now()
                ->startOfMonth()
                ->subMonths($months - 1)
                ->startOfWeek(Carbon::MONDAY);

            // Sales grouped by week
            $salesData = [];
            if (Schema::hasTable('tb_kdfakturpenjualan')) {
                $salesData = DB::table('tb_kdfakturpenjualan')
                    ->selectRaw('YEARWEEK(tgl_doc, 1) as week_key, SUM(harga) as total')
                    ->where('tgl_doc', '>=', $startWeekStart->toDateString())
                    ->where('tgl_doc', '<=', Carbon::now()->toDateString())
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                    ->selectRaw('MAX(tgl_doc) as last_update')
                    ->where('tgl_doc', '>=', $startWeekStart->toDateString())
                    ->value('last_update');
            }

            // HPP grouped by week
            $hppData = [];
            if (Schema::hasTable('tb_invin')) {
                $hppData = DB::table('tb_invin')
                    ->selectRaw("YEARWEEK(STR_TO_DATE(inv_d, '%d.%m.%Y'), 1) as week_key, SUM(ttl_harga) as total")
                    ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$startWeekStart->toDateString()])
                    ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') <= ?", [Carbon::now()->toDateString()])
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $hppLastUpdateRaw = DB::table('tb_invin')
                    ->selectRaw("MAX(STR_TO_DATE(inv_d, '%d.%m.%Y')) as last_update")
                    ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$startWeekStart->toDateString()])
                    ->value('last_update');
                $hppLastUpdate = $hppLastUpdateRaw;
            }

            // Biaya (Beban) grouped by week (Kode_Akun starts with 51, only outflow)
            $biayaData = [];
            if (Schema::hasTable('tb_kas')
                && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
                && (Schema::hasColumn('tb_kas', 'Kode_Akun') || $kasFlags['has_breakdown'])
                && (Schema::hasColumn('tb_kas', 'Mutasi_Kas') || $kasFlags['has_breakdown'])) {
                $sumSql = $this->biayaSelectSumSql($kasFlags);
                $biayaData = DB::table('tb_kas as k')
                    ->selectRaw("YEARWEEK(k.Tgl_Voucher, 1) as week_key, SUM($sumSql) as total")
                    ->where('k.Tgl_Voucher', '>=', $startWeekStart->toDateString())
                    ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $biayaLastUpdate = DB::table('tb_kas as k')
                    ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                    ->where('k.Tgl_Voucher', '>=', $startWeekStart->toDateString())
                    ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                    ->value('last_update');
            }

            // Build series by week
            $cursor = $startWeekStart->copy();
            while ($cursor->lte($endWeekStart)) {
                $isoYear = (int) $cursor->isoWeekYear();
                $isoWeek = (int) $cursor->isoWeek();
                $weekKey = ($isoYear * 100) + $isoWeek;
                $key = sprintf('%d-W%02d', $isoYear, $isoWeek);

                $sales = (float) ($salesData[$weekKey] ?? 0);
                $hpp = (float) ($hppData[$weekKey] ?? 0);
                $biaya = (float) ($biayaData[$weekKey] ?? 0);

                $result['series'][] = [
                    'period' => $key,
                    'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                    'sales' => $sales,
                    'hpp' => $hpp,
                    'biaya' => $biaya,
                ];

                $result['summary']['sales_total'] += $sales;
                $result['summary']['hpp_total'] += $hpp;
                $result['summary']['biaya_total'] += $biaya;

                $cursor->addWeek();
            }

            $lastUpdate = $salesLastUpdate;
            if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
                $lastUpdate = $hppLastUpdate;
            }
            if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
                $lastUpdate = $biayaLastUpdate;
            }
            $result['summary']['last_update'] = $lastUpdate;

            return $result;
        }

        // Pre-fetch all relevant data grouped by month to avoid N+1 queries in loop
        // Sales: tgl_doc is DATE type (YYYY-MM-DD)
        $salesData = [];
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("DATE_FORMAT(tgl_doc, '%Y-%m') as month_key, SUM(harga) as total")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->where('tgl_doc', '<=', $now->toDateString())
                ->groupBy('month_key')
                ->pluck('total', 'month_key');
            
             $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("MAX(tgl_doc) as last_update")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->value('last_update');
        }

        // HPP: inv_d (d.m.Y) -> Convert to YYYY-MM-DD first
        $hppData = [];
        if (Schema::hasTable('tb_invin')) {
            $hppData = DB::table('tb_invin')
                ->selectRaw("DATE_FORMAT(STR_TO_DATE(inv_d, '%d.%m.%Y'), '%Y-%m') as month_key, SUM(ttl_harga) as total")
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') <= ?", [$now->toDateString()])
                ->groupBy('month_key')
                ->pluck('total', 'month_key');

            $hppLastUpdateRaw = DB::table('tb_invin')
                 ->selectRaw("MAX(STR_TO_DATE(inv_d, '%d.%m.%Y')) as last_update")
                 ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$start->toDateString()])
                 ->value('last_update');
            $hppLastUpdate = $hppLastUpdateRaw;
        }

        // Biaya (Beban) grouped by month (Kode_Akun starts with 51, only outflow)
        $biayaData = [];
        if (Schema::hasTable('tb_kas')
            && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
            && (Schema::hasColumn('tb_kas', 'Kode_Akun') || $kasFlags['has_breakdown'])
            && (Schema::hasColumn('tb_kas', 'Mutasi_Kas') || $kasFlags['has_breakdown'])) {
            $sumSql = $this->biayaSelectSumSql($kasFlags);
            $biayaData = DB::table('tb_kas as k')
                ->selectRaw("DATE_FORMAT(k.Tgl_Voucher, '%Y-%m') as month_key, SUM($sumSql) as total")
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $now->toDateString())
                ->groupBy('month_key')
                ->pluck('total', 'month_key');

            $biayaLastUpdate = DB::table('tb_kas as k')
                ->selectRaw("MAX(k.Tgl_Voucher) as last_update")
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $now->toDateString())
                ->value('last_update');
        }

        // Build series
        for ($i = 0; $i < $months; $i++) {
            $currentMonth = $start->copy()->addMonths($i);
            $key = $currentMonth->format('Y-m');
            
            $sales = (float) ($salesData[$key] ?? 0);
            $hpp = (float) ($hppData[$key] ?? 0);
            $biaya = (float) ($biayaData[$key] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => $currentMonth->locale('id')->translatedFormat('M Y'),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];

            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;
        }

        // Determine overall last update
        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }

    private function getSalesHppDailyStats(): array
    {
        $end = Carbon::now()->startOfDay();
        $start = $end->copy()->subDays(6);
        $kasFlags = $this->hasKasBreakdownColumns();

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'series' => [],
        ];

        $salesData = [];
        $salesLastUpdate = null;
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("DATE_FORMAT(tgl_doc, '%Y-%m-%d') as day_key, SUM(harga) as total")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->where('tgl_doc', '<=', $end->toDateString())
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('MAX(tgl_doc) as last_update')
                ->where('tgl_doc', '>=', $start->toDateString())
                ->value('last_update');
        }

        $hppData = [];
        $hppLastUpdate = null;
        if (Schema::hasTable('tb_invin')) {
            $hppData = DB::table('tb_invin')
                ->selectRaw("DATE_FORMAT(STR_TO_DATE(inv_d, '%d.%m.%Y'), '%Y-%m-%d') as day_key, SUM(ttl_harga) as total")
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') <= ?", [$end->toDateString()])
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $hppLastUpdate = DB::table('tb_invin')
                ->selectRaw("MAX(STR_TO_DATE(inv_d, '%d.%m.%Y')) as last_update")
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->value('last_update');
        }

        $biayaData = [];
        $biayaLastUpdate = null;
        if (Schema::hasTable('tb_kas')
            && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
            && (Schema::hasColumn('tb_kas', 'Kode_Akun') || $kasFlags['has_breakdown'])
            && (Schema::hasColumn('tb_kas', 'Mutasi_Kas') || $kasFlags['has_breakdown'])) {
            $sumSql = $this->biayaSelectSumSql($kasFlags);
            $biayaData = DB::table('tb_kas as k')
                ->selectRaw("DATE_FORMAT(k.Tgl_Voucher, '%Y-%m-%d') as day_key, SUM($sumSql) as total")
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $end->toDateString())
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $biayaLastUpdate = DB::table('tb_kas as k')
                ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $end->toDateString())
                ->value('last_update');
        }

        for ($i = 0; $i < 7; $i += 1) {
            $day = $start->copy()->addDays($i);
            $key = $day->format('Y-m-d');
            $sales = (float) ($salesData[$key] ?? 0);
            $hpp = (float) ($hppData[$key] ?? 0);
            $biaya = (float) ($biayaData[$key] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => $day->locale('id')->translatedFormat('d M'),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];
            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;
        }

        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }

    private function getSalesHppWeeklyStatsForMonth(): array
    {
        // 4 minggu berjalan (termasuk minggu ini)
        $endWeek = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $startWeek = $endWeek->copy()->subWeeks(3);
        $kasFlags = $this->hasKasBreakdownColumns();

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'series' => [],
        ];

        $salesData = [];
        $salesLastUpdate = null;
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('YEARWEEK(tgl_doc, 1) as week_key, SUM(harga) as total')
                ->where('tgl_doc', '>=', $startWeek->toDateString())
                ->where('tgl_doc', '<=', Carbon::now()->toDateString())
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('MAX(tgl_doc) as last_update')
                ->where('tgl_doc', '>=', $startWeek->toDateString())
                ->value('last_update');
        }

        $hppData = [];
        $hppLastUpdate = null;
        if (Schema::hasTable('tb_invin')) {
            $hppData = DB::table('tb_invin')
                ->selectRaw("YEARWEEK(STR_TO_DATE(inv_d, '%d.%m.%Y'), 1) as week_key, SUM(ttl_harga) as total")
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$startWeek->toDateString()])
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') <= ?", [Carbon::now()->toDateString()])
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $hppLastUpdate = DB::table('tb_invin')
                ->selectRaw("MAX(STR_TO_DATE(inv_d, '%d.%m.%Y')) as last_update")
                ->whereRaw("STR_TO_DATE(inv_d, '%d.%m.%Y') >= ?", [$startWeek->toDateString()])
                ->value('last_update');
        }

        $biayaData = [];
        $biayaLastUpdate = null;
        if (Schema::hasTable('tb_kas')
            && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
            && (Schema::hasColumn('tb_kas', 'Kode_Akun') || $kasFlags['has_breakdown'])
            && (Schema::hasColumn('tb_kas', 'Mutasi_Kas') || $kasFlags['has_breakdown'])) {
            $sumSql = $this->biayaSelectSumSql($kasFlags);
            $biayaData = DB::table('tb_kas as k')
                ->selectRaw("YEARWEEK(k.Tgl_Voucher, 1) as week_key, SUM($sumSql) as total")
                ->where('k.Tgl_Voucher', '>=', $startWeek->toDateString())
                ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $biayaLastUpdate = DB::table('tb_kas as k')
                ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                ->where('k.Tgl_Voucher', '>=', $startWeek->toDateString())
                ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                ->value('last_update');
        }

        $cursor = $startWeek->copy();
        while ($cursor->lte($endWeek)) {
            $isoYear = (int) $cursor->isoWeekYear();
            $isoWeek = (int) $cursor->isoWeek();
            $weekKey = ($isoYear * 100) + $isoWeek;
            $key = sprintf('%d-W%02d', $isoYear, $isoWeek);

            $sales = (float) ($salesData[$weekKey] ?? 0);
            $hpp = (float) ($hppData[$weekKey] ?? 0);
            $biaya = (float) ($biayaData[$weekKey] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];

            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;

            $cursor->addWeek();
        }

        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }
}
