<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class PerformanceController
{
    private string $dateExpr = "CASE WHEN tgl_doc LIKE '__.__.____' THEN STR_TO_DATE(tgl_doc, '%d.%m.%Y') ELSE STR_TO_DATE(tgl_doc, '%Y-%m-%d') END";

    /**
     * Render the main Marketing Performance page.
     */
    public function index(Request $request)
    {
        $filters = $this->extractFilters($request);
        $availableYears = $this->getAvailableYears();
        $customersList = $this->getCustomersList();

        return Inertia::render('marketing/performance/index', [
            'initialFilters' => $filters,
            'availableYears' => $availableYears,
            'customersList' => $customersList,
        ]);
    }

    /**
     * Return JSON data for KPI, chart, top 5, and customer tables.
     */
    public function data(Request $request)
    {
        $filters = $this->extractFilters($request);
        $data = $this->calculatePerformanceData($filters);

        return response()->json($data);
    }

    /**
     * Export data to CSV / Excel or print preview.
     */
    public function export(Request $request)
    {
        $filters = $this->extractFilters($request);
        $data = $this->calculatePerformanceData($filters);
        $format = $request->query('format', 'excel');

        if ($format === 'pdf' || $format === 'print') {
            return Inertia::render('marketing/performance/export', [
                'filters' => $filters,
                'periodInfo' => $data['periodInfo'],
                'kpi' => $data['kpi'],
                'topCustomers' => $data['topCustomers'],
                'lowestCustomers' => $data['lowestCustomers'],
                'prevTopCustomers' => $data['prevTopCustomers'],
                'prevLowestCustomers' => $data['prevLowestCustomers'],
                'customers' => $data['allCustomers'],
            ]);
        }

        // Generate Excel CSV with UTF-8 BOM
        $filename = 'marketing-performance-' . $filters['year'] . '-' . $filters['period_type'] . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($data, $filters) {
            $output = fopen('php://output', 'w');
            // Write UTF-8 BOM for Excel
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($output, ['KEY PERFORMANCE INDICATOR (KPI) PENJUALAN']);
            fputcsv($output, ['Periode', $data['periodInfo']['currentLabel']]);
            fputcsv($output, ['Periode Pembanding', $data['periodInfo']['previousLabel']]);
            fputcsv($output, []);

            // Summary KPI
            fputcsv($output, ['RINGKASAN KPI']);
            fputcsv($output, ['Total Penjualan', number_format($data['kpi']['total_sales'], 0, ',', '.')]);
            fputcsv($output, ['Customer Bertransaksi', $data['kpi']['total_customers']]);
            fputcsv($output, ['Rata-rata Penjualan / Customer', number_format($data['kpi']['avg_sales_per_customer'], 0, ',', '.')]);
            fputcsv($output, ['Pertumbuhan Penjualan (%)', round($data['kpi']['growth_percent'], 2) . '%']);
            fputcsv($output, ['Total Invoice', $data['kpi']['total_invoices']]);
            fputcsv($output, ['Customer Tertinggi', ($data['kpi']['top_customer']['name'] ?? '-') . ' (Rp ' . number_format($data['kpi']['top_customer']['sales'] ?? 0, 0, ',', '.') . ')']);
            fputcsv($output, []);

            // Top 5 Highest
            fputcsv($output, ['TOP 5 PENJUALAN TERTINGGI']);
            fputcsv($output, ['Rank', 'Kode Customer', 'Nama Customer', 'Total Penjualan (Rp)', 'Jumlah Invoice', 'Kontribusi (%)']);
            foreach ($data['topCustomers'] as $row) {
                fputcsv($output, [
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    $row['curr_invoices'],
                    round($row['contribution'], 2) . '%',
                ]);
            }
            fputcsv($output, []);

            // Top 5 Lowest
            fputcsv($output, ['TOP 5 PENJUALAN TERENDAH (> Rp 0)']);
            fputcsv($output, ['Rank', 'Kode Customer', 'Nama Customer', 'Total Penjualan (Rp)', 'Jumlah Invoice', 'Pertumbuhan (%)', 'Catatan']);
            foreach ($data['lowestCustomers'] as $row) {
                fputcsv($output, [
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    $row['curr_invoices'],
                    round($row['growth'], 2) . '%',
                    'Tidak termasuk customer Rp0',
                ]);
            }
            fputcsv($output, []);

            // All Customers
            fputcsv($output, ['PERFORMA SELURUH CUSTOMER']);
            fputcsv($output, [
                'Rank',
                'Kode Customer',
                'Nama Customer',
                'Penjualan Berjalan (Rp)',
                'Penjualan Sebelumnya (Rp)',
                'Pertumbuhan (%)',
                'Jumlah Invoice',
                'Rata-rata Nilai Invoice (Rp)',
                'Status Performa',
            ]);

            foreach ($data['allCustomers'] as $row) {
                fputcsv($output, [
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    number_format($row['prev_sales'], 0, ',', '.'),
                    round($row['growth'], 2) . '%',
                    $row['curr_invoices'],
                    number_format($row['avg_invoice_value'], 0, ',', '.'),
                    $row['status'],
                ]);
            }

            fclose($output);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Extract and sanitize request filters.
     */
    private function extractFilters(Request $request): array
    {
        $currentYear = (int) date('Y');
        // If data is from 2026, default to 2026
        $year = (int) $request->query('year', 2026);
        if ($year < 2000 || $year > 2100) {
            $year = 2026;
        }

        $periodType = $request->query('period_type', 'monthly');
        if (!in_array($periodType, ['monthly', 'quarterly', 'semester', 'yearly'], true)) {
            $periodType = 'monthly';
        }

        $month = (int) $request->query('month', 8);
        if ($month < 1 || $month > 12) {
            $month = 8;
        }

        $quarter = (int) $request->query('quarter', 3);
        if ($quarter < 1 || $quarter > 4) {
            $quarter = 3;
        }

        $semester = (int) $request->query('semester', 2);
        if ($semester < 1 || $semester > 2) {
            $semester = 2;
        }

        $customer = trim((string) $request->query('customer', 'all'));

        return [
            'year' => $year,
            'period_type' => $periodType,
            'month' => $month,
            'quarter' => $quarter,
            'semester' => $semester,
            'customer' => $customer,
        ];
    }

    /**
     * Get list of available years from database.
     */
    private function getAvailableYears(): array
    {
        try {
            $years = DB::table('tb_fakturpenjualan')
                ->whereNotNull('no_fakturpenjualan')
                ->whereRaw("trim(no_fakturpenjualan) <> ''")
                ->selectRaw("YEAR({$this->dateExpr}) as yr")
                ->whereRaw("YEAR({$this->dateExpr}) between 2000 and 2099")
                ->groupBy('yr')
                ->orderByDesc('yr')
                ->pluck('yr')
                ->map(fn($y) => (int) $y)
                ->values()
                ->toArray();

            if (empty($years)) {
                return [2026, 2025, 2024, 2023, 2022];
            }

            return $years;
        } catch (\Throwable) {
            return [2026, 2025, 2024, 2023, 2022];
        }
    }

    /**
     * Get list of active customers for filter dropdown.
     */
    private function getCustomersList(): array
    {
        try {
            return DB::table('tb_fakturpenjualan')
                ->whereNotNull('no_fakturpenjualan')
                ->whereRaw("trim(no_fakturpenjualan) <> ''")
                ->whereNotNull('kd_cs')
                ->whereRaw("trim(kd_cs) <> ''")
                ->select('kd_cs', 'nm_cs')
                ->groupBy('kd_cs', 'nm_cs')
                ->orderBy('nm_cs')
                ->get()
                ->toArray();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Core calculation logic for KPI, chart, top 5, and customer tables.
     */
    private function calculatePerformanceData(array $filters): array
    {
        $year = $filters['year'];
        $periodType = $filters['period_type'];
        $month = $filters['month'];
        $quarter = $filters['quarter'];
        $semester = $filters['semester'];
        $customerFilter = $filters['customer'];

        // Determine current & previous period date ranges and human labels
        $periodInfo = $this->resolveDateRanges($year, $periodType, $month, $quarter, $semester);

        $currStart = $periodInfo['currStart'];
        $currEnd = $periodInfo['currEnd'];
        $prevStart = $periodInfo['prevStart'];
        $prevEnd = $periodInfo['prevEnd'];

        // 1. Current Period Customer Breakdown Query
        $currCustomerQuery = DB::table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->whereRaw("{$this->dateExpr} between ? and ?", [$currStart, $currEnd]);

        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $currCustomerQuery->where('kd_cs', $customerFilter);
        }

        $currRows = $currCustomerQuery
            ->select('kd_cs', 'nm_cs')
            ->selectRaw("sum(ttl_price) as curr_sales")
            ->selectRaw("count(distinct no_fakturpenjualan) as curr_invoices")
            ->groupBy('kd_cs', 'nm_cs')
            ->get();

        // 2. Previous Period Customer Breakdown Query
        $prevCustomerQuery = DB::table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->whereRaw("{$this->dateExpr} between ? and ?", [$prevStart, $prevEnd]);

        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $prevCustomerQuery->where('kd_cs', $customerFilter);
        }

        $prevRows = $prevCustomerQuery
            ->select('kd_cs', 'nm_cs')
            ->selectRaw("sum(ttl_price) as prev_sales")
            ->selectRaw("count(distinct no_fakturpenjualan) as prev_invoices")
            ->groupBy('kd_cs', 'nm_cs')
            ->get()
            ->keyBy('kd_cs');

        // Combine into unified customer map
        $customerMap = [];

        foreach ($currRows as $row) {
            $kd = $row->kd_cs;
            $customerMap[$kd] = [
                'kd_cs' => $kd,
                'nm_cs' => $row->nm_cs,
                'curr_sales' => (float) ($row->curr_sales ?? 0),
                'curr_invoices' => (int) ($row->curr_invoices ?? 0),
                'prev_sales' => 0.0,
                'prev_invoices' => 0,
            ];
        }

        foreach ($prevRows as $kd => $row) {
            if (!isset($customerMap[$kd])) {
                $customerMap[$kd] = [
                    'kd_cs' => $kd,
                    'nm_cs' => $row->nm_cs,
                    'curr_sales' => 0.0,
                    'curr_invoices' => 0,
                    'prev_sales' => (float) ($row->prev_sales ?? 0),
                    'prev_invoices' => (int) ($row->prev_invoices ?? 0),
                ];
            } else {
                $customerMap[$kd]['prev_sales'] = (float) ($row->prev_sales ?? 0);
                $customerMap[$kd]['prev_invoices'] = (int) ($row->prev_invoices ?? 0);
            }
        }

        // Calculate Totals & KPI
        $totalSales = 0.0;
        $prevTotalSales = 0.0;
        $totalInvoices = 0;
        $prevTotalInvoices = 0;
        $transactingCustomersCount = 0;

        foreach ($customerMap as $item) {
            if ($item['curr_sales'] > 0) {
                $totalSales += $item['curr_sales'];
                $totalInvoices += $item['curr_invoices'];
                $transactingCustomersCount++;
            }
            $prevTotalSales += $item['prev_sales'];
            $prevTotalInvoices += $item['prev_invoices'];
        }

        $growthPercent = $prevTotalSales > 0
            ? (($totalSales - $prevTotalSales) / $prevTotalSales) * 100
            : ($totalSales > 0 ? 100.0 : 0.0);

        $avgSalesPerCustomer = $transactingCustomersCount > 0
            ? $totalSales / $transactingCustomersCount
            : 0.0;

        // Process customer performance list
        $allCustomersList = [];
        foreach ($customerMap as $item) {
            $currS = $item['curr_sales'];
            $prevS = $item['prev_sales'];
            $growth = $prevS > 0
                ? (($currS - $prevS) / $prevS) * 100
                : ($currS > 0 ? 100.0 : 0.0);

            $invCount = $item['curr_invoices'];
            $avgInvoice = $invCount > 0 ? $currS / $invCount : 0.0;
            $contribution = $totalSales > 0 ? ($currS / $totalSales) * 100 : 0.0;

            // Status performa:
            // Sangat Baik (> 20%), Baik (5%..20%), Stabil (-5%..5%), Menurun (< -5%), Tidak Ada Transaksi (curr = 0)
            if ($currS <= 0) {
                $status = 'Tidak Ada Transaksi';
            } elseif ($prevS <= 0) {
                $status = 'Sangat Baik';
            } elseif ($growth > 20) {
                $status = 'Sangat Baik';
            } elseif ($growth >= 5) {
                $status = 'Baik';
            } elseif ($growth >= -5) {
                $status = 'Stabil';
            } else {
                $status = 'Menurun';
            }

            $diffSales = $currS - $prevS;

            $allCustomersList[] = [
                'kd_cs' => $item['kd_cs'],
                'nm_cs' => $item['nm_cs'],
                'curr_sales' => $currS,
                'prev_sales' => $prevS,
                'diff_sales' => $diffSales,
                'growth' => $growth,
                'curr_invoices' => $invCount,
                'prev_invoices' => $item['prev_invoices'] ?? 0,
                'avg_invoice_value' => $avgInvoice,
                'contribution' => $contribution,
                'status' => $status,
            ];
        }

        // Sort all customers descending by curr_sales
        usort($allCustomersList, fn($a, $b) => $b['curr_sales'] <=> $a['curr_sales']);

        // Assign rankings
        $rank = 1;
        foreach ($allCustomersList as &$cust) {
            $cust['rank'] = $rank++;
        }
        unset($cust);

        // Top customer
        $topCustomer = !empty($allCustomersList) && $allCustomersList[0]['curr_sales'] > 0
            ? [
                'name' => $allCustomersList[0]['nm_cs'],
                'sales' => $allCustomersList[0]['curr_sales'],
                'invoices' => $allCustomersList[0]['curr_invoices'],
                'contribution' => $allCustomersList[0]['contribution'],
            ]
            : null;

        // Top 5 Highest Sales - Periode Berjalan (Fokus: Pertahankan)
        $topCustomers = array_slice(array_filter($allCustomersList, fn($c) => $c['curr_sales'] > 0), 0, 5);
        $tRank = 1;
        foreach ($topCustomers as &$tCust) {
            $tCust['rank'] = $tRank++;
            $tCust['marketing_action'] = 'Pertahankan';
        }
        unset($tCust);

        // Top 5 Lowest Sales - Periode Berjalan (> 0, strictly no Rp 0!) (Fokus: Perbanyak Penawaran)
        $positiveCustomers = array_filter($allCustomersList, fn($c) => $c['curr_sales'] > 0);
        usort($positiveCustomers, fn($a, $b) => $a['curr_sales'] <=> $b['curr_sales']);
        $lowestCustomers = array_slice($positiveCustomers, 0, 5);
        $lRank = 1;
        foreach ($lowestCustomers as &$lCust) {
            $lCust['rank'] = $lRank++;
            $lCust['marketing_action'] = 'Perbanyak Penawaran';
        }
        unset($lCust);

        // Top 5 Penurunan Penjualan Terbesar (Drop Sales - Prioritas Perbanyak Penawaran)
        $decliningList = array_filter($allCustomersList, fn($c) => $c['diff_sales'] < 0 && $c['prev_sales'] > 0);
        usort($decliningList, fn($a, $b) => $a['diff_sales'] <=> $b['diff_sales']);
        $decliningCustomers = array_slice($decliningList, 0, 5);
        $dRank = 1;
        foreach ($decliningCustomers as &$dCust) {
            $dCust['rank'] = $dRank++;
            $dCust['marketing_action'] = 'Perbanyak Penawaran';
        }
        unset($dCust);

        // Top 5 Highest Sales - Periode Sebelumnya
        $positivePrevCustomers = array_filter($allCustomersList, fn($c) => $c['prev_sales'] > 0);
        usort($positivePrevCustomers, fn($a, $b) => $b['prev_sales'] <=> $a['prev_sales']);
        $prevTopCustomers = array_slice($positivePrevCustomers, 0, 5);
        $ptRank = 1;
        foreach ($prevTopCustomers as &$ptCust) {
            $ptCust['rank'] = $ptRank++;
            $ptCust['contribution'] = $prevTotalSales > 0 ? ($ptCust['prev_sales'] / $prevTotalSales) * 100 : 0.0;
        }
        unset($ptCust);

        // Top 5 Lowest Sales - Periode Sebelumnya (> 0, strictly no Rp 0!)
        usort($positivePrevCustomers, fn($a, $b) => $a['prev_sales'] <=> $b['prev_sales']);
        $prevLowestCustomers = array_slice($positivePrevCustomers, 0, 5);
        $plRank = 1;
        foreach ($prevLowestCustomers as &$plCust) {
            $plCust['rank'] = $plRank++;
        }
        unset($plCust);

        // 3. Chart Data Generation
        $chartData = $this->generateChartData($year, $periodType, $month, $quarter, $semester, $customerFilter);

        return [
            'periodInfo' => $periodInfo,
            'kpi' => [
                'total_sales' => $totalSales,
                'prev_total_sales' => $prevTotalSales,
                'growth_percent' => $growthPercent,
                'growth_nominal' => $totalSales - $prevTotalSales,
                'total_customers' => $transactingCustomersCount,
                'prev_total_customers' => count($prevRows),
                'avg_sales_per_customer' => $avgSalesPerCustomer,
                'total_invoices' => $totalInvoices,
                'prev_total_invoices' => $prevTotalInvoices,
                'top_customer' => $topCustomer,
            ],
            'chartData' => $chartData,
            'topCustomers' => array_values($topCustomers),
            'lowestCustomers' => array_values($lowestCustomers),
            'decliningCustomers' => array_values($decliningCustomers),
            'prevTopCustomers' => array_values($prevTopCustomers),
            'prevLowestCustomers' => array_values($prevLowestCustomers),
            'allCustomers' => array_values($allCustomersList),
        ];
    }

    /**
     * Generate date ranges and human-readable labels.
     */
    private function resolveDateRanges(int $year, string $periodType, int $month, int $quarter, int $semester): array
    {
        $monthNames = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];

        if ($periodType === 'monthly') {
            $currStart = sprintf('%04d-%02d-01', $year, $month);
            $currEnd = date('Y-m-t', strtotime($currStart));

            if ($month === 1) {
                $prevYear = $year - 1;
                $prevMonth = 12;
            } else {
                $prevYear = $year;
                $prevMonth = $month - 1;
            }

            $prevStart = sprintf('%04d-%02d-01', $prevYear, $prevMonth);
            $prevEnd = date('Y-m-t', strtotime($prevStart));

            return [
                'currStart' => $currStart,
                'currEnd' => $currEnd,
                'prevStart' => $prevStart,
                'prevEnd' => $prevEnd,
                'currentLabel' => ($monthNames[$month] ?? "Bulan $month") . " $year",
                'previousLabel' => ($monthNames[$prevMonth] ?? "Bulan $prevMonth") . " $prevYear",
            ];
        }

        if ($periodType === 'quarterly') {
            $quarterRanges = [
                1 => ['start' => '01-01', 'end' => '03-31', 'name' => 'Triwulan 1 (Jan - Mar)'],
                2 => ['start' => '04-01', 'end' => '06-30', 'name' => 'Triwulan 2 (Apr - Jun)'],
                3 => ['start' => '07-01', 'end' => '09-30', 'name' => 'Triwulan 3 (Jul - Sep)'],
                4 => ['start' => '10-01', 'end' => '12-31', 'name' => 'Triwulan 4 (Okt - Des)'],
            ];

            $currInfo = $quarterRanges[$quarter] ?? $quarterRanges[1];
            $currStart = "$year-{$currInfo['start']}";
            $currEnd = "$year-{$currInfo['end']}";

            if ($quarter === 1) {
                $prevYear = $year - 1;
                $prevQuarter = 4;
            } else {
                $prevYear = $year;
                $prevQuarter = $quarter - 1;
            }

            $prevInfo = $quarterRanges[$prevQuarter];
            $prevStart = "$prevYear-{$prevInfo['start']}";
            $prevEnd = "$prevYear-{$prevInfo['end']}";

            return [
                'currStart' => $currStart,
                'currEnd' => $currEnd,
                'prevStart' => $prevStart,
                'prevEnd' => $prevEnd,
                'currentLabel' => "{$currInfo['name']} $year",
                'previousLabel' => "{$prevInfo['name']} $prevYear",
            ];
        }

        if ($periodType === 'semester') {
            $semesterRanges = [
                1 => ['start' => '01-01', 'end' => '06-30', 'name' => 'Semester 1 (Jan - Jun)'],
                2 => ['start' => '07-01', 'end' => '12-31', 'name' => 'Semester 2 (Jul - Des)'],
            ];

            $currInfo = $semesterRanges[$semester] ?? $semesterRanges[1];
            $currStart = "$year-{$currInfo['start']}";
            $currEnd = "$year-{$currInfo['end']}";

            if ($semester === 1) {
                $prevYear = $year - 1;
                $prevSemester = 2;
            } else {
                $prevYear = $year;
                $prevSemester = 1;
            }

            $prevInfo = $semesterRanges[$prevSemester];
            $prevStart = "$prevYear-{$prevInfo['start']}";
            $prevEnd = "$prevYear-{$prevInfo['end']}";

            return [
                'currStart' => $currStart,
                'currEnd' => $currEnd,
                'prevStart' => $prevStart,
                'prevEnd' => $prevEnd,
                'currentLabel' => "{$currInfo['name']} $year",
                'previousLabel' => "{$prevInfo['name']} $prevYear",
            ];
        }

        // Yearly
        $currStart = "$year-01-01";
        $currEnd = "$year-12-31";
        $prevYear = $year - 1;
        $prevStart = "$prevYear-01-01";
        $prevEnd = "$prevYear-12-31";

        return [
            'currStart' => $currStart,
            'currEnd' => $currEnd,
            'prevStart' => $prevStart,
            'prevEnd' => $prevEnd,
            'currentLabel' => "Tahun $year",
            'previousLabel' => "Tahun $prevYear",
        ];
    }

    /**
     * Generate trend series for charts.
     */
    private function generateChartData(int $year, string $periodType, int $activeMonth, int $activeQuarter, int $activeSemester, string $customerFilter): array
    {
        $baseQuery = DB::table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0");

        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $baseQuery->where('kd_cs', $customerFilter);
        }

        if ($periodType === 'monthly') {
            $monthLabels = [
                1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr',
                5 => 'Mei', 6 => 'Jun', 7 => 'Jul', 8 => 'Agu',
                9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des',
            ];

            $results = (clone $baseQuery)
                ->whereRaw("YEAR({$this->dateExpr}) = ?", [$year])
                ->selectRaw("MONTH({$this->dateExpr}) as period_key")
                ->selectRaw("sum(ttl_price) as total_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as invoice_count")
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($m = 1; $m <= 12; $m++) {
                $row = $results->get($m);
                $items[] = [
                    'key' => $m,
                    'label' => $monthLabels[$m],
                    'full_label' => $monthLabels[$m] . " $year",
                    'sales' => (float) ($row->total_sales ?? 0),
                    'invoices' => (int) ($row->invoice_count ?? 0),
                    'is_active' => ($m === $activeMonth),
                ];
            }

            return [
                'type' => 'monthly',
                'title' => "Grafik Penjualan Bulanan (Januari - Desember $year)",
                'items' => $items,
            ];
        }

        if ($periodType === 'quarterly') {
            $quarterLabels = [
                1 => 'Q1 (Jan-Mar)',
                2 => 'Q2 (Apr-Jun)',
                3 => 'Q3 (Jul-Sep)',
                4 => 'Q4 (Okt-Des)',
            ];

            $results = (clone $baseQuery)
                ->whereRaw("YEAR({$this->dateExpr}) = ?", [$year])
                ->selectRaw("QUARTER({$this->dateExpr}) as period_key")
                ->selectRaw("sum(ttl_price) as total_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as invoice_count")
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($q = 1; $q <= 4; $q++) {
                $row = $results->get($q);
                $items[] = [
                    'key' => $q,
                    'label' => "Q$q",
                    'full_label' => $quarterLabels[$q] . " $year",
                    'sales' => (float) ($row->total_sales ?? 0),
                    'invoices' => (int) ($row->invoice_count ?? 0),
                    'is_active' => ($q === $activeQuarter),
                ];
            }

            return [
                'type' => 'quarterly',
                'title' => "Grafik Penjualan Triwulan (Q1 - Q4 $year)",
                'items' => $items,
            ];
        }

        if ($periodType === 'semester') {
            $semesterLabels = [
                1 => 'Semester 1 (Jan-Jun)',
                2 => 'Semester 2 (Jul-Des)',
            ];

            $results = (clone $baseQuery)
                ->whereRaw("YEAR({$this->dateExpr}) = ?", [$year])
                ->selectRaw("CASE WHEN MONTH({$this->dateExpr}) <= 6 THEN 1 ELSE 2 END as period_key")
                ->selectRaw("sum(ttl_price) as total_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as invoice_count")
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($s = 1; $s <= 2; $s++) {
                $row = $results->get($s);
                $items[] = [
                    'key' => $s,
                    'label' => "Semester $s",
                    'full_label' => $semesterLabels[$s] . " $year",
                    'sales' => (float) ($row->total_sales ?? 0),
                    'invoices' => (int) ($row->invoice_count ?? 0),
                    'is_active' => ($s === $activeSemester),
                ];
            }

            return [
                'type' => 'semester',
                'title' => "Grafik Penjualan Semester (S1 - S2 $year)",
                'items' => $items,
            ];
        }

        // Yearly: 5-year trend ending in $year
        $startYear = max(2018, $year - 4);
        $results = (clone $baseQuery)
            ->whereRaw("YEAR({$this->dateExpr}) between ? and ?", [$startYear, $year])
            ->selectRaw("YEAR({$this->dateExpr}) as period_key")
            ->selectRaw("sum(ttl_price) as total_sales")
            ->selectRaw("count(distinct no_fakturpenjualan) as invoice_count")
            ->groupBy('period_key')
            ->get()
            ->keyBy('period_key');

        $items = [];
        for ($y = $startYear; $y <= $year; $y++) {
            $row = $results->get($y);
            $items[] = [
                'key' => $y,
                'label' => (string) $y,
                'full_label' => "Tahun $y",
                'sales' => (float) ($row->total_sales ?? 0),
                'invoices' => (int) ($row->invoice_count ?? 0),
                'is_active' => ($y === $year),
            ];
        }

        return [
            'type' => 'yearly',
            'title' => "Grafik Perkembangan Penjualan Tahunan ($startYear - $year)",
            'items' => $items,
        ];
    }
}
