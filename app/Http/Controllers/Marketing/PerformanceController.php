<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Carbon\Carbon;

class PerformanceController
{
    private ?\Illuminate\Database\ConnectionInterface $activeConnection = null;
    private ?bool $isClickhouse = null;

    /**
     * Resolve database connection:
     * - Uses ClickHouse by default if available and operational.
     * - Seamlessly falls back to MySQL if ClickHouse is not configured, unreachable, or throws error.
     * - Can be overridden manually via query param ?driver=mysql or ?source=mysql, or PERFORMANCE_DB_DRIVER=mysql in .env.
     */
    private function getDbConnection(): \Illuminate\Database\ConnectionInterface
    {
        if ($this->activeConnection !== null) {
            return $this->activeConnection;
        }

        $requestedDriver = strtolower((string) request()->query('driver', request()->query('source', env('PERFORMANCE_DB_DRIVER', 'clickhouse'))));
        if ($requestedDriver === 'mysql') {
            $this->activeConnection = DB::connection();
            $this->isClickhouse = false;
            return $this->activeConnection;
        }

        try {
            $connection = DB::connection('clickhouse');
            if ($connection && $connection->getConfig('driver') === 'clickhouse') {
                $connection->select('SELECT 1');
                $this->activeConnection = $connection;
                $this->isClickhouse = true;
                return $this->activeConnection;
            }
        } catch (\Throwable $e) {
            Log::info("PerformanceController: ClickHouse connection unavailable, falling back to MySQL: " . $e->getMessage());
        }

        $this->activeConnection = DB::connection();
        $this->isClickhouse = false;
        return $this->activeConnection;
    }

    private function isClickhouse(): bool
    {
        if ($this->isClickhouse === null) {
            $this->getDbConnection();
        }
        return (bool) $this->isClickhouse;
    }

    /**
     * Execute database callback with automatic failover to MySQL if ClickHouse throws any exception.
     */
    private function safeQuery(callable $callback)
    {
        try {
            return $callback();
        } catch (\Throwable $e) {
            if ($this->isClickhouse()) {
                Log::warning("PerformanceController ClickHouse query failed, falling back to MySQL: " . $e->getMessage());
                $this->activeConnection = DB::connection();
                $this->isClickhouse = false;
                return $callback();
            }
            throw $e;
        }
    }

    /**
     * SQL expression to parse date column.
     */
    private function sqlDateExpr(string $col = 'tgl_doc'): string
    {
        if ($this->isClickhouse()) {
            return "toDateOrNull(parseDateTimeBestEffortOrNull(toString({$col})))";
        }
        return "CASE WHEN {$col} LIKE '__.__.____' THEN STR_TO_DATE({$col}, '%d.%m.%Y') ELSE STR_TO_DATE({$col}, '%Y-%m-%d') END";
    }

    /**
     * SQL expression to format date as 'YYYY-MM-DD' string.
     */
    private function sqlDateFormat(string $col = 'tgl_doc', string $format = '%Y-%m-%d'): string
    {
        if ($this->isClickhouse()) {
            return "formatDateTime(parseDateTimeBestEffortOrNull(toString({$col})), '{$format}')";
        }
        return "DATE_FORMAT({$this->sqlDateExpr($col)}, '{$format}')";
    }

    /**
     * SQL expression for Year (e.g. 2025).
     */
    private function sqlYear(string $col = 'tgl_doc'): string
    {
        if ($this->isClickhouse()) {
            return "toYear({$this->sqlDateExpr($col)})";
        }
        return "YEAR({$this->sqlDateExpr($col)})";
    }

    /**
     * SQL expression for Month (1 - 12).
     */
    private function sqlMonth(string $col = 'tgl_doc'): string
    {
        if ($this->isClickhouse()) {
            return "toMonth({$this->sqlDateExpr($col)})";
        }
        return "MONTH({$this->sqlDateExpr($col)})";
    }

    /**
     * SQL expression for Quarter (1 - 4).
     */
    private function sqlQuarter(string $col = 'tgl_doc'): string
    {
        if ($this->isClickhouse()) {
            return "toQuarter({$this->sqlDateExpr($col)})";
        }
        return "QUARTER({$this->sqlDateExpr($col)})";
    }

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
        $data = $this->safeQuery(function () use ($filters) {
            return $this->calculatePerformanceData($filters);
        });

        return response()->json($data);
    }

    /**
     * Return AI-powered strategic analysis for KPI and sales recommendations.
     */
    public function aiAnalyze(Request $request)
    {
        @set_time_limit(180);
        @ini_set('max_execution_time', '180');

        $filters = $this->extractFilters($request);
        $force = $request->boolean('force', false);
        
        $cacheKey = 'marketing_kpi_ai_' . md5(json_encode($filters) . '_' . date('YmdH'));

        if (!$force) {
            try {
                if (Cache::has($cacheKey)) {
                    $cached = Cache::get($cacheKey);
                    return response()->json([
                        'success' => true,
                        'cached' => true,
                        'engine' => $cached['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                        'is_fallback' => $cached['is_fallback'] ?? false,
                        'data' => $cached['analysis'] ?? $cached,
                    ]);
                }
            } catch (\Throwable) {
                // If database cache table doesn't exist, try file cache
                try {
                    if (Cache::store('file')->has($cacheKey)) {
                        $cached = Cache::store('file')->get($cacheKey);
                        return response()->json([
                            'success' => true,
                            'cached' => true,
                            'engine' => $cached['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                            'is_fallback' => $cached['is_fallback'] ?? false,
                            'data' => $cached['analysis'] ?? $cached,
                        ]);
                    }
                } catch (\Throwable) {
                    // Ignore cache read failures
                }
            }
        }

        $perfData = $this->safeQuery(function () use ($filters) {
            return $this->calculatePerformanceData($filters);
        });
        $summary = $this->buildKpiSummaryForPrompt($perfData, $filters);

        // Try calling Ollama AI model (qwen2.5:7b)
        $aiResult = $this->callOllama($summary);

        if ($aiResult && !empty($aiResult['data'])) {
            $payload = [
                'engine' => $aiResult['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                'is_fallback' => false,
                'analysis' => $aiResult['data'],
            ];

            try {
                Cache::put($cacheKey, $payload, now()->addHour());
            } catch (\Throwable) {
                try {
                    Cache::store('file')->put($cacheKey, $payload, now()->addHour());
                } catch (\Throwable) {
                    // Ignore cache write failures
                }
            }

            return response()->json([
                'success' => true,
                'cached' => false,
                'engine' => $payload['engine'],
                'is_fallback' => false,
                'data' => $aiResult['data'],
            ]);
        }

        // Graceful fallback to rule-based analytical engine
        $fallbackData = $this->generateHeuristicAnalysis($summary);
        $fallbackPayload = [
            'engine' => 'Heuristic Analytical Engine (Ollama Standby)',
            'is_fallback' => true,
            'notice' => $aiResult['error'] ?? 'Ollama AI engine belum terhubung di server.',
            'analysis' => $fallbackData,
        ];

        try {
            Cache::put($cacheKey, $fallbackPayload, now()->addMinutes(10));
        } catch (\Throwable) {
            try {
                Cache::store('file')->put($cacheKey, $fallbackPayload, now()->addMinutes(10));
            } catch (\Throwable) {
                // Ignore cache write failures
            }
        }

        return response()->json([
            'success' => true,
            'cached' => false,
            'engine' => $fallbackPayload['engine'],
            'is_fallback' => true,
            'notice' => $fallbackPayload['notice'],
            'data' => $fallbackData,
        ]);
    }

    /**
     * Render Customer KPI Detail page.
     */
    public function customerDetail(Request $request, string $customer)
    {
        $customerInfo = $this->safeQuery(function () use ($customer) {
            return $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $customer)
                ->select('kd_cs', 'nm_cs')
                ->first();
        });

        if (!$customerInfo) {
            $customerInfo = (object) [
                'kd_cs' => $customer,
                'nm_cs' => $customer,
            ];
        }

        $filters = $this->extractCustomerFilters($request);
        $availableYears = $this->getAvailableYears();

        return Inertia::render('marketing/performance/customer', [
            'customer' => $customerInfo,
            'initialFilters' => $filters,
            'availableYears' => $availableYears,
        ]);
    }

    /**
     * Return JSON data for Customer KPI detail: summary, chart, top materials, and invoice history.
     */
    public function customerData(Request $request, string $customer)
    {
        $filters = $this->extractCustomerFilters($request);
        $data = $this->safeQuery(function () use ($customer, $filters) {
            return $this->calculateCustomerPerformance($customer, $filters);
        });

        return response()->json($data);
    }

    /**
     * Return AI-powered strategic analysis specifically for this customer account.
     */
    public function customerAiAnalyze(Request $request, string $customer)
    {
        @set_time_limit(180);
        @ini_set('max_execution_time', '180');

        $filters = $this->extractCustomerFilters($request);
        $force = $request->boolean('force', false);

        $cacheKey = 'marketing_cust_kpi_ai_' . md5($customer . '_' . json_encode($filters) . '_' . date('YmdH'));

        if (!$force) {
            try {
                if (Cache::has($cacheKey)) {
                    $cached = Cache::get($cacheKey);
                    return response()->json([
                        'success' => true,
                        'cached' => true,
                        'engine' => $cached['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                        'is_fallback' => $cached['is_fallback'] ?? false,
                        'data' => $cached['analysis'] ?? $cached,
                    ]);
                }
            } catch (\Throwable) {
                try {
                    if (Cache::store('file')->has($cacheKey)) {
                        $cached = Cache::store('file')->get($cacheKey);
                        return response()->json([
                            'success' => true,
                            'cached' => true,
                            'engine' => $cached['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                            'is_fallback' => $cached['is_fallback'] ?? false,
                            'data' => $cached['analysis'] ?? $cached,
                        ]);
                    }
                } catch (\Throwable) {}
            }
        }

        $perfData = $this->safeQuery(function () use ($customer, $filters) {
            return $this->calculateCustomerPerformance($customer, $filters);
        });
        $summary = $this->buildCustomerAiSummary($perfData, $filters);

        $aiResult = $this->callOllamaForCustomer($summary);

        if ($aiResult && !empty($aiResult['data'])) {
            $payload = [
                'engine' => $aiResult['engine'] ?? (config('services.ollama.model', 'qwen2.5:7b') . ' (Ollama)'),
                'is_fallback' => false,
                'analysis' => $aiResult['data'],
            ];

            try {
                Cache::put($cacheKey, $payload, now()->addHour());
            } catch (\Throwable) {
                try {
                    Cache::store('file')->put($cacheKey, $payload, now()->addHour());
                } catch (\Throwable) {}
            }

            return response()->json([
                'success' => true,
                'cached' => false,
                'engine' => $payload['engine'],
                'is_fallback' => false,
                'data' => $aiResult['data'],
            ]);
        }

        $fallbackData = $this->generateCustomerHeuristicAnalysis($summary);
        $fallbackPayload = [
            'engine' => 'Heuristic Analytical Engine (Ollama Standby)',
            'is_fallback' => true,
            'notice' => $aiResult['error'] ?? 'Ollama AI engine belum terhubung di server.',
            'analysis' => $fallbackData,
        ];

        try {
            Cache::put($cacheKey, $fallbackPayload, now()->addMinutes(10));
        } catch (\Throwable) {
            try {
                Cache::store('file')->put($cacheKey, $fallbackPayload, now()->addMinutes(10));
            } catch (\Throwable) {}
        }

        return response()->json([
            'success' => true,
            'cached' => false,
            'engine' => $fallbackPayload['engine'],
            'is_fallback' => true,
            'notice' => $fallbackPayload['notice'],
            'data' => $fallbackData,
        ]);
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
            $years = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->whereNotNull('no_fakturpenjualan')
                ->whereRaw("trim(no_fakturpenjualan) <> ''")
                ->selectRaw("{$this->sqlYear('tgl_doc')} as yr")
                ->whereRaw("{$this->sqlYear('tgl_doc')} between 2000 and 2099")
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
            return $this->getDbConnection()->table('tb_fakturpenjualan')
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
        $currCustomerQuery = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd]);

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
        $prevCustomerQuery = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$prevStart, $prevEnd]);

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

        // Assign rankings and AI Intelligence diagnostic metrics
        $rank = 1;
        foreach ($allCustomersList as &$cust) {
            $cust['rank'] = $rank++;
            $currS = (float) $cust['curr_sales'];
            $prevS = (float) $cust['prev_sales'];
            $growth = (float) $cust['growth'];
            $diffSales = (float) $cust['diff_sales'];
            $r = $cust['rank'];
            $contrib = (float) $cust['contribution'];

            // AI Status & Strategic Action Matrix
            if ($currS <= 0 && $prevS <= 0) {
                $aiStatus = 'Non-Aktif';
                $aiBadge = 'gray';
                $aiAction = '📋 Kirimkan Brosur & Katalog Material Baru';
                $aiReason = 'Belum ada riwayat transaksi pada periode berjalan maupun pembanding.';
            } elseif ($currS <= 0 && $prevS > 0) {
                $aiStatus = 'Dormant (Macet)';
                $aiBadge = 'red';
                $aiAction = '🔄 Kunjungan Re-Aktivasi Sales & Penawaran Re-Entry';
                $aiReason = 'Customer churn: pernah belanja Rp ' . number_format($prevS, 0, ',', '.') . ' di periode lalu namun terhenti.';
            } elseif ($r <= 5 && $growth >= 0) {
                $aiStatus = 'VIP Growth Leader';
                $aiBadge = 'emerald';
                $aiAction = '🛡️ Kunci Kontrak Tahunan & Proteksi Alokasi Stok VIP';
                $aiReason = 'Penyumbang omset utama (' . round($contrib, 1) . '%) dengan tren pertumbuhan positif (' . ($growth > 0 ? '+' : '') . round($growth, 1) . '%).';
            } elseif ($r <= 5 && $growth < 0) {
                $aiStatus = 'VIP At-Risk';
                $aiBadge = 'rose';
                $aiAction = '🚨 Intervensi Langsung CCO: Re-Negosiasi & Mitigasi Churn';
                $aiReason = 'Customer VIP mengalami penurunan omset Rp ' . number_format(abs($diffSales), 0, ',', '.') . ' (' . round($growth, 1) . '%).';
            } elseif ($growth >= 25 && $currS > 0) {
                $aiStatus = 'Akselerasi Tinggi';
                $aiBadge = 'emerald';
                $aiAction = '🚀 Cross-Selling Kategori Baru & Kemitraan Strategis';
                $aiReason = 'Pertumbuhan volume sangat kuat (+ ' . round($growth, 1) . '%). Peluang besar untuk penetrasi item lain.';
            } elseif ($growth >= 0 && $growth < 25 && $currS > 0) {
                $aiStatus = 'Konsisten & Stabil';
                $aiBadge = 'blue';
                $aiAction = '📈 Kunci Jadwal Repeat Order Rutin & Lock Volume';
                $aiReason = 'Pola belanja stabil dan teratur (' . $cust['curr_invoices'] . ' invoice). Pertahankan kepuasan layanan.';
            } elseif ($growth < 0 && $growth >= -15) {
                $aiStatus = 'Penurunan Ringan';
                $aiBadge = 'amber';
                $aiAction = '🔍 Follow-up Purchasing & Cek Kendala Operasional';
                $aiReason = 'Penurunan omset wajar (' . round($growth, 1) . '%), perlu pengingat jadwal order dan penawaran.';
            } elseif ($growth < -15 && $growth >= -40) {
                $aiStatus = 'Menurun Signifikan';
                $aiBadge = 'orange';
                $aiAction = '⚠️ Audit Penyebab Drop & Berikan Diskon Penyelamatan';
                $aiReason = 'Anomali penurunan tajam Rp ' . number_format(abs($diffSales), 0, ',', '.') . '. Perlu audit kebutuhan purchasing.';
            } else {
                $aiStatus = 'Kritis / Drop Drastis';
                $aiBadge = 'rose';
                $aiAction = '🚨 Audit Mendalam: Cek Sisa Stok & Negosiasi Ulang';
                $aiReason = 'Penurunan omset sangat drastis (' . round($growth, 1) . '%). Risiko kehilangan akun permanen.';
            }

            // If small ticket but active
            if ($currS > 0 && $currS < 10000000 && $r > 5 && $growth >= 0) {
                $aiStatus = 'Potensial Penetrasi';
                $aiBadge = 'cyan';
                $aiAction = '📦 Tawarkan Paket Bundle & Diskon Kuantiti (Qty)';
                $aiReason = 'Nominal order masih di bawah Rp 10 Juta namun aktif belanja. Potensi upselling volume.';
            }

            $cust['ai_status'] = $aiStatus;
            $cust['ai_badge'] = $aiBadge;
            $cust['ai_action'] = $aiAction;
            $cust['ai_reason'] = $aiReason;
            $cust['status'] = $aiStatus;
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

        // Top 5 Highest Sales - Periode Berjalan (Fokus: Aksi Tim AI)
        $topCustomers = array_slice(array_filter($allCustomersList, fn($c) => $c['curr_sales'] > 0), 0, 5);
        $tRank = 1;
        foreach ($topCustomers as &$tCust) {
            $tCust['rank'] = $tRank++;
            if ($tCust['rank'] === 1) {
                $tCust['marketing_action'] = '👑 Kunci Kontrak Tahunan & Akun Prioritas';
                $tCust['ai_team_action'] = '👑 Kunci Kontrak Tahunan & Akun Prioritas';
            } elseif ($tCust['growth'] >= 15) {
                $tCust['marketing_action'] = '⭐ Loyalitas & Prioritas Alokasi Stok VIP';
                $tCust['ai_team_action'] = '⭐ Loyalitas & Prioritas Alokasi Stok VIP';
            } elseif ($tCust['growth'] >= 0) {
                $tCust['marketing_action'] = '🤝 Kunjungan Manajemen & Evaluasi PO';
                $tCust['ai_team_action'] = '🤝 Kunjungan Manajemen & Evaluasi PO';
            } else {
                $tCust['marketing_action'] = '🚨 Mitigasi Churn: Intervensi CCO Segera';
                $tCust['ai_team_action'] = '🚨 Mitigasi Churn: Intervensi CCO Segera';
            }
        }
        unset($tCust);

        // Top 5 Lowest Sales - Periode Berjalan (> 0, strictly no Rp 0!) (Fokus: Aksi Tim AI)
        $positiveCustomers = array_filter($allCustomersList, fn($c) => $c['curr_sales'] > 0);
        usort($positiveCustomers, fn($a, $b) => $a['curr_sales'] <=> $b['curr_sales']);
        $lowestCustomers = array_slice($positiveCustomers, 0, 5);
        $lRank = 1;
        foreach ($lowestCustomers as &$lCust) {
            $lCust['rank'] = $lRank++;
            if ($lCust['curr_sales'] < 5000000) {
                $lCust['marketing_action'] = '🎯 Presentasi Material & Paket Sampel';
                $lCust['ai_team_action'] = '🎯 Presentasi Material & Paket Sampel';
            } else {
                $lCust['marketing_action'] = '📦 Tawarkan Skema Diskon Qty & Volume';
                $lCust['ai_team_action'] = '📦 Tawarkan Skema Diskon Qty & Volume';
            }
        }
        unset($lCust);

        // Top 5 Penurunan Penjualan Terbesar (Drop Sales - Prioritas Aksi Tim AI)
        $decliningList = array_filter($allCustomersList, fn($c) => $c['diff_sales'] < 0 && $c['prev_sales'] > 0);
        usort($decliningList, fn($a, $b) => $a['diff_sales'] <=> $b['diff_sales']);
        $decliningCustomers = array_slice($decliningList, 0, 5);
        $dRank = 1;
        foreach ($decliningCustomers as &$dCust) {
            $dCust['rank'] = $dRank++;
            if ($dCust['growth'] < -40) {
                $dCust['marketing_action'] = '🔍 Audit Purchasing: Cek Stok Sisa & Alasan Drop';
                $dCust['ai_team_action'] = '🔍 Audit Purchasing: Cek Stok Sisa & Alasan Drop';
            } else {
                $dCust['marketing_action'] = '📞 Follow-up Purchasing & Diskon Penyelamatan';
                $dCust['ai_team_action'] = '📞 Follow-up Purchasing & Diskon Penyelamatan';
            }
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

        // 4. Top 10 Ordered Materials from tb_do joined on tb_fakturpenjualan.no_do = tb_do.no_do
        $dateExprWithTable = $this->sqlDateExpr('f.tgl_doc');
        $topMaterialsQuery = $this->getDbConnection()->table('tb_fakturpenjualan as f')
            ->join('tb_do as d', 'f.no_do', '=', 'd.no_do')
            ->whereRaw("coalesce(f.ttl_price, 0) > 0")
            ->whereRaw("{$dateExprWithTable} between ? and ?", [$currStart, $currEnd])
            ->whereNotNull('d.mat')
            ->whereRaw("trim(d.mat) <> ''");

        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $topMaterialsQuery->where('f.kd_cs', $customerFilter);
        }

        $topMaterials = $topMaterialsQuery
            ->select('d.kd_mat', 'd.mat as material', 'd.unit')
            ->selectRaw("sum(d.qty) as total_qty")
            ->selectRaw("sum(d.total) as total_val")
            ->selectRaw("count(distinct f.no_fakturpenjualan) as freq")
            ->selectRaw("avg(d.harga) as avg_price")
            ->groupBy('d.kd_mat', 'd.mat', 'd.unit')
            ->orderByDesc('total_val')
            ->limit(10)
            ->get()
            ->map(function ($row) {
                return [
                    'kd_mat' => $row->kd_mat,
                    'material' => $row->material,
                    'unit' => $row->unit,
                    'total_qty' => (float) $row->total_qty,
                    'total_val' => (float) $row->total_val,
                    'freq' => (int) $row->freq,
                    'avg_price' => (float) $row->avg_price,
                ];
            })
            ->toArray();

        return [
            'periodInfo' => $periodInfo,
            'data_source' => $this->isClickhouse() ? 'clickhouse' : 'mysql',
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
            'topMaterials' => $topMaterials,
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
        $baseQuery = $this->getDbConnection()->table('tb_fakturpenjualan')
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
                ->whereRaw("{$this->sqlYear('tgl_doc')} = ?", [$year])
                ->selectRaw("{$this->sqlMonth('tgl_doc')} as period_key")
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
                ->whereRaw("{$this->sqlYear('tgl_doc')} = ?", [$year])
                ->selectRaw("{$this->sqlQuarter('tgl_doc')} as period_key")
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
                ->whereRaw("{$this->sqlYear('tgl_doc')} = ?", [$year])
                ->selectRaw("CASE WHEN {$this->sqlMonth('tgl_doc')} <= 6 THEN 1 ELSE 2 END as period_key")
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
            ->whereRaw("{$this->sqlYear('tgl_doc')} between ? and ?", [$startYear, $year])
            ->selectRaw("{$this->sqlYear('tgl_doc')} as period_key")
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

    /**
     * Build aggregated numerical KPI summary for LLM prompt.
     */
    private function buildKpiSummaryForPrompt(array $data, array $filters): array
    {
        $periodInfo = $data['periodInfo'] ?? [];
        $kpi = $data['kpi'] ?? [];
        $top5 = $data['topCustomers'] ?? [];
        $declining = $data['decliningCustomers'] ?? [];
        $all = $data['allCustomers'] ?? [];

        $totalSales = (float) ($kpi['total_sales'] ?? 0);
        $prevSales = (float) ($kpi['prev_total_sales'] ?? 0);
        $growthPct = (float) ($kpi['growth_percent'] ?? 0);
        $growthNom = (float) ($kpi['growth_nominal'] ?? 0);

        // Pareto calculation
        $top5Sales = array_sum(array_column($top5, 'curr_sales'));
        $paretoPct = $totalSales > 0 ? round(($top5Sales / $totalSales) * 100, 1) : 0.0;

        // Customer dynamics
        $newCount = 0;
        $churnCount = 0;
        $growingCount = 0;
        $droppingCount = 0;

        foreach ($all as $c) {
            $cs = (float) ($c['curr_sales'] ?? 0);
            $ps = (float) ($c['prev_sales'] ?? 0);
            if ($ps <= 0 && $cs > 0) $newCount++;
            elseif ($ps > 0 && $cs <= 0) $churnCount++;
            elseif ($cs > $ps && $cs > 0) $growingCount++;
            elseif ($cs < $ps && $cs > 0) $droppingCount++;
        }

        // Top 5 text
        $top5Lines = [];
        foreach ($top5 as $t) {
            $salesFormatted = number_format($t['curr_sales'], 0, ',', '.');
            $contrib = round($t['contribution'] ?? 0, 1);
            $top5Lines[] = "- {$t['nm_cs']}: Rp {$salesFormatted} (Kontribusi: {$contrib}%, {$t['curr_invoices']} invoice)";
        }

        // Declining text
        $decliningLines = [];
        foreach ($declining as $d) {
            $prevFormatted = number_format($d['prev_sales'], 0, ',', '.');
            $currFormatted = number_format($d['curr_sales'], 0, ',', '.');
            $diffFormatted = number_format(abs($d['diff_sales']), 0, ',', '.');
            $pct = round($d['growth'], 1);
            $decliningLines[] = "- {$d['nm_cs']}: Turun Rp {$diffFormatted} ({$pct}%) dari Rp {$prevFormatted} menjadi Rp {$currFormatted}";
        }

        // Top materials lines
        $topMaterials = $data['topMaterials'] ?? [];
        $topMatLines = [];
        foreach ($topMaterials as $m) {
            $valFmt = number_format($m['total_val'], 0, ',', '.');
            $qtyFmt = number_format($m['total_qty'], 0, ',', '.');
            $topMatLines[] = "- {$m['material']} ({$m['kd_mat']}): {$qtyFmt} {$m['unit']} senilai Rp {$valFmt} ({$m['freq']}x DO)";
        }

        return [
            'period_current' => $periodInfo['currentLabel'] ?? 'Periode Ini',
            'period_previous' => $periodInfo['previousLabel'] ?? 'Periode Lalu',
            'total_sales' => $totalSales,
            'total_sales_formatted' => number_format($totalSales, 0, ',', '.'),
            'prev_total_sales' => $prevSales,
            'prev_total_sales_formatted' => number_format($prevSales, 0, ',', '.'),
            'growth_percent' => $growthPct,
            'growth_percent_formatted' => ($growthPct > 0 ? '+' : '') . round($growthPct, 2) . '%',
            'growth_nominal' => $growthNom,
            'growth_nominal_formatted' => number_format($growthNom, 0, ',', '.'),
            'total_customers' => (int) ($kpi['total_customers'] ?? 0),
            'prev_total_customers' => (int) ($kpi['prev_total_customers'] ?? 0),
            'new_customers' => $newCount,
            'churned_customers' => $churnCount,
            'growing_customers' => $growingCount,
            'dropping_customers' => $droppingCount,
            'avg_sales_per_customer' => (float) ($kpi['avg_sales_per_customer'] ?? 0),
            'avg_sales_per_customer_formatted' => number_format((float) ($kpi['avg_sales_per_customer'] ?? 0), 0, ',', '.'),
            'total_invoices' => (int) ($kpi['total_invoices'] ?? 0),
            'prev_total_invoices' => (int) ($kpi['prev_total_invoices'] ?? 0),
            'pareto_top5_percent' => $paretoPct,
            'top5_items' => $top5,
            'top5_text' => !empty($top5Lines) ? implode("\n", $top5Lines) : "- Tidak ada data customer transaksi",
            'declining_items' => $declining,
            'declining_text' => !empty($decliningLines) ? implode("\n", $decliningLines) : "- Tidak ada customer dengan penurunan signifikan",
            'top_materials' => $topMaterials,
            'top_materials_text' => !empty($topMatLines) ? implode("\n", $topMatLines) : "- Tidak ada data DO material pada periode ini",
        ];
    }

    /**
     * Call Ollama Chat API with Qwen 2.5 7B model.
     */
    private function callOllama(array $summary): ?array
    {
        $baseUrl = rtrim(config('services.ollama.base_url', 'http://127.0.0.1:11434'), '/');
        $model = config('services.ollama.model', 'qwen2.5:7b');
        $configuredTimeout = (int) config('services.ollama.timeout', 90);
        $timeout = $configuredTimeout > 0 ? $configuredTimeout : 90;

        $systemPrompt = <<<PROMPT
Anda adalah Chief Commercial Officer (CCO) & Senior Sales Performance Analyst B2B.
Tugas Anda: Menganalisis laporan KPI Penjualan secara objektif, tajam, dan berbasis data numerik riil.

Format Output:
- WAJIB berupa JSON valid MURNI tanpa teks pengantar, tanpa penutup, tanpa format markdown ```json.
- Bahasa: Bahasa Indonesia bisnis profesional, padat, dan solutif.
- PENTING: Tuliskan setiap analisis secara SINGKAT, PADAT, dan LANGSUNG PADA SOLUSI (maksimal 1-2 kalimat per poin). Hindari teks bertele-tele agar efisien.

Struktur JSON:
{
  "health_score": <angka integer 0-100>,
  "status_label": <"Sangat Baik" | "Baik" | "Waspada" | "Kritis">,
  "executive_summary": "<1 paragraf padat (2-3 kalimat) ringkasan eksekutif pencapaian penjualan periode ini vs periode lalu>",
  "pareto_risk_analysis": {
    "top5_share_percent": <float persentase>,
    "risk_level": <"Tinggi" | "Sedang" | "Rendah">,
    "evaluation": "<1-2 kalimat evaluasi ketergantungan omset pada top 5 customer dan mitigasinya>"
  },
  "critical_areas_to_fix": [
    {
      "issue": "<judul anomali singkat>",
      "customer_affected": "<nama customer atau 'Umum'>",
      "nominal_impact": "<dampak nominal penurunan>",
      "root_cause": "<1 kalimat akar masalah>",
      "action_to_fix": "<1 kalimat tindakan korektif tim marketing>"
    }
  ],
  "tactical_recommendations": [
    {
      "category": "<Customer VIP / Top Performers | Customer Menurun / At-Risk | Penetrasi & Upselling>",
      "focus": "<fokus utama>",
      "action": "<1-2 kalimat langkah taktis tim sales>"
    }
  ],
  "quick_wins": [
    "<aksi taktis 1 dalam 7 hari>",
    "<aksi taktis 2 dalam 7 hari>",
    "<aksi taktis 3 dalam 7 hari>"
  ]
}
PROMPT;

        $userPrompt = <<<USER_PROMPT
Berikut adalah data kinerja penjualan perusahaan:
- Periode Berjalan: {$summary['period_current']}
- Periode Pembanding: {$summary['period_previous']}
- Total Penjualan Berjalan: Rp {$summary['total_sales_formatted']}
- Total Penjualan Sebelumnya: Rp {$summary['prev_total_sales_formatted']}
- Pertumbuhan Penjualan: {$summary['growth_percent_formatted']} (Nominal: Rp {$summary['growth_nominal_formatted']})
- Jumlah Customer Aktif: {$summary['total_customers']} (Sebelumnya: {$summary['prev_total_customers']})
- Customer Baru: {$summary['new_customers']}, Customer Churn/Macet: {$summary['churned_customers']}
- Rata-rata Penjualan / Customer: Rp {$summary['avg_sales_per_customer_formatted']}
- Total Invoice: {$summary['total_invoices']} (Sebelumnya: {$summary['prev_total_invoices']})
- Pangsa Top 5 Customer: {$summary['pareto_top5_percent']}% dari total omset

Top 5 Customer Terbesar:
{$summary['top5_text']}

Top 5 Penurunan Omset Terbesar (Drop Sales):
{$summary['declining_text']}

Top Material / Barang Paling Banyak Dipesan (Berdasarkan Surat Jalan DO):
{$summary['top_materials_text']}

Buat analisis KPI singkat dan padat sesuai format JSON di atas.
USER_PROMPT;

        try {
            // Quick connect timeout (2.5s) to detect immediately if Ollama is not reachable on local
            $res = Http::connectTimeout(2.5)
                ->timeout($timeout)
                ->post("{$baseUrl}/api/chat", [
                    'model' => $model,
                    'keep_alive' => -1,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'stream' => false,
                    'format' => 'json',
                    'options' => [
                        'temperature' => 0.15,
                        'top_p' => 0.85,
                        'num_predict' => 380,
                    ],
                ]);

            if (!$res->successful()) {
                Log::warning('Ollama API error response', ['status' => $res->status(), 'body' => $res->body()]);
                return ['error' => 'Ollama API error: status ' . $res->status()];
            }

            $body = $res->json();
            $content = $body['message']['content'] ?? '';

            // Clean content if wrapped in markdown code blocks
            $cleaned = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
            $cleaned = preg_replace('/\s*```$/', '', $cleaned);

            $parsed = json_decode($cleaned, true);
            if (is_array($parsed) && isset($parsed['health_score'])) {
                return [
                    'engine' => "{$model} (Ollama Production)",
                    'data' => $parsed,
                ];
            }

            // If JSON was embedded inside text, try regex extraction
            if (preg_match('/\{[\s\S]*\}/', $cleaned, $match)) {
                $matchedJson = json_decode($match[0], true);
                if (is_array($matchedJson) && isset($matchedJson['health_score'])) {
                    return [
                        'engine' => "{$model} (Ollama Production)",
                        'data' => $matchedJson,
                    ];
                }
            }

            Log::warning('Ollama returned non-JSON output', ['raw' => $content]);
            return ['error' => 'Gagal membaca format JSON dari Ollama'];
        } catch (\Throwable $e) {
            Log::info('Ollama offline or unreachable on this host: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Fallback heuristic intelligence engine if Ollama is unreachable.
     */
    private function generateHeuristicAnalysis(array $summary): array
    {
        $growth = $summary['growth_percent'];
        $pareto = $summary['pareto_top5_percent'];
        $totalSalesFmt = $summary['total_sales_formatted'];
        $currPeriod = $summary['period_current'];
        $prevPeriod = $summary['period_previous'];
        $churn = $summary['churned_customers'];
        $newCust = $summary['new_customers'];

        // Compute health score
        $score = 70;
        if ($growth >= 20) $score += 20;
        elseif ($growth >= 5) $score += 10;
        elseif ($growth < -15) $score -= 25;
        elseif ($growth < 0) $score -= 15;

        if ($pareto > 75) $score -= 10;
        elseif ($pareto < 50) $score += 5;

        if ($churn > $newCust) $score -= 5;
        $score = max(20, min(98, $score));

        $statusLabel = $score >= 80 ? 'Sangat Baik' : ($score >= 65 ? 'Baik' : ($score >= 50 ? 'Waspada' : 'Kritis'));

        $trendWord = $growth >= 0 
            ? "mengalami pertumbuhan positif sebesar {$summary['growth_percent_formatted']}" 
            : "mengalami kontraksi sebesar {$summary['growth_percent_formatted']}";
        $nominalWord = $summary['growth_nominal'] >= 0 
            ? "peningkatan nominal sebesar Rp " . $summary['growth_nominal_formatted'] 
            : "penurunan nominal sebesar Rp " . number_format(abs($summary['growth_nominal']), 0, ',', '.');

        $paretoRisk = $pareto > 70 ? 'Tinggi' : ($pareto > 50 ? 'Sedang' : 'Rendah');
        $paretoDesc = $pareto > 70
            ? "Tingkat ketergantungan pendapatan tergolong tinggi ({$pareto}% omset disumbang oleh Top 5 customer). Perusahaan rentan terhadap volatilitas jika salah satu customer utama mengurangi pesanan."
            : "Distribusi penjualan relatif berimbang dengan kontribusi Top 5 sebesar {$pareto}%. Risiko konsentrasi pelanggan berada dalam batas wajar.";

        // Critical fixes based on real data
        $critical = [];
        $decliningList = $summary['declining_items'] ?? [];
        if (!empty($decliningList)) {
            $worst = $decliningList[0];
            $diffFmt = number_format(abs($worst['diff_sales']), 0, ',', '.');
            $critical[] = [
                'issue' => "Penurunan Omset Signifikan",
                'customer_affected' => $worst['nm_cs'] ?? 'Customer Utama',
                'nominal_impact' => "Turun Rp {$diffFmt} (" . round($worst['growth'] ?? 0, 1) . "%)",
                'root_cause' => "Frekuensi invoice berkurang atau penundaan PO proyek dari periode sebelumnya.",
                'action_to_fix' => "Jadwalkan kunjungan komersial segera dengan Account Executive, audit kebutuhan restock customer, dan tawarkan paket harga khusus.",
            ];
        }

        if ($churn > 0) {
            $critical[] = [
                'issue' => "Customer Inaktif / Risiko Churn",
                'customer_affected' => "{$churn} Customer Tidak Bertransaksi",
                'nominal_impact' => "Kehilangan peluang repeat order reguler",
                'root_cause' => "Pernah bertransaksi di {$prevPeriod} namun belum ada order masuk di {$currPeriod}.",
                'action_to_fix' => "Lakukan kampanye re-engagement via tim sales dan telemarketing untuk mengonfirmasi status restock barang.",
            ];
        }

        if ($pareto > 65) {
            $critical[] = [
                'issue' => "Konsentrasi Risiko Pendapatan",
                'customer_affected' => "Top 5 Pelanggan Inti",
                'nominal_impact' => "Mencakup {$pareto}% dari total omset perusahaan",
                'root_cause' => "Portofolio penjualan masih terkonsentrasi kuat pada segmen pembeli besar.",
                'action_to_fix' => "Akselerasi akuisisi customer tier-2 dan aktifkan penawaran baru ke customer skala menengah untuk pemerataan omset.",
            ];
        }

        $tactical = [
            [
                'category' => 'Customer VIP / Top Performers',
                'focus' => 'Retensi & Proteksi Akun Kunci',
                'action' => 'Berikan prioritas alokasi barang, percepat lead time pengiriman, dan amankan blanket order jangka menengah.',
            ],
            [
                'category' => 'Customer Menurun / At-Risk',
                'focus' => 'Penyelamatan Omset & Re-engagement',
                'action' => 'Identifikasi keluhan atau kendala harga pada customer yang mengalami penurunan, lakukan negosiasi ulang skema pembayaran/diskon.',
            ],
            [
                'category' => 'Penetrasi & Upselling',
                'focus' => 'Peningkatan Nilai Order & Frekuensi',
                'action' => 'Tawarkan produk komplementer (cross-selling) ke customer aktif dengan nilai invoice di bawah rata-rata.',
            ],
        ];

        $quickWins = [
            "Segera kontak customer dengan drop penjualan terbesar ({$summary['declining_text']}) dalam 48 jam ke depan.",
            "Follow-up penawaran ke {$churn} akun customer yang belum melakukan repeat order di {$currPeriod}.",
            "Lakukan evaluasi kepuasan layanan dengan perwakilan Top 3 pelanggan utama untuk mengamankan pesanan bulan depan.",
        ];

        return [
            'health_score' => $score,
            'status_label' => $statusLabel,
            'executive_summary' => "Pada periode {$currPeriod}, total realisasi penjualan mencapai Rp {$totalSalesFmt}. Kinerja penjualan {$trendWord} dengan {$nominalWord} dibandingkan {$prevPeriod}. Tercatat sebanyak {$summary['total_customers']} customer aktif bertransaksi dengan porsi kontribusi Top 5 pelanggan sebesar {$pareto}%.",
            'pareto_risk_analysis' => [
                'top5_share_percent' => $pareto,
                'risk_level' => $paretoRisk,
                'evaluation' => $paretoDesc,
            ],
            'critical_areas_to_fix' => $critical,
            'tactical_recommendations' => $tactical,
            'quick_wins' => $quickWins,
        ];
    }

    /**
     * Extract sanitized filters for Customer KPI page.
     */
    private function extractCustomerFilters(Request $request): array
    {
        $periodType = $request->query('period_type', 'monthly');
        if (!in_array($periodType, ['weekly', 'monthly', 'quarterly', 'semester', 'yearly', 'year_range'], true)) {
            $periodType = 'monthly';
        }

        $year = (int) $request->query('year', 2026);
        if ($year < 2000 || $year > 2100) $year = 2026;

        $month = (int) $request->query('month', 8);
        if ($month < 1 || $month > 12) $month = 8;

        $week = (int) $request->query('week', 1);
        if ($week < 1 || $week > 5) $week = 1;

        $quarter = (int) $request->query('quarter', 3);
        if ($quarter < 1 || $quarter > 4) $quarter = 3;

        $semester = (int) $request->query('semester', 2);
        if ($semester < 1 || $semester > 2) $semester = 2;

        $startYear = (int) $request->query('start_year', max(2020, $year - 4));
        $endYear = (int) $request->query('end_year', $year);
        if ($startYear > $endYear) {
            $temp = $startYear;
            $startYear = $endYear;
            $endYear = $temp;
        }

        return [
            'period_type' => $periodType,
            'year' => $year,
            'month' => $month,
            'week' => $week,
            'quarter' => $quarter,
            'semester' => $semester,
            'start_year' => $startYear,
            'end_year' => $endYear,
        ];
    }

    /**
     * Calculate comprehensive performance data for a single customer.
     */
    private function calculateCustomerPerformance(string $kdCs, array $filters): array
    {
        $periodType = $filters['period_type'];
        $year = $filters['year'];
        $month = $filters['month'];
        $week = $filters['week'];
        $quarter = $filters['quarter'];
        $semester = $filters['semester'];
        $startYear = $filters['start_year'];
        $endYear = $filters['end_year'];

        $monthNames = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];

        $dayNames = [
            'Mon' => 'Senin', 'Tue' => 'Selasa', 'Wed' => 'Rabu',
            'Thu' => 'Kamis', 'Fri' => 'Jumat', 'Sat' => 'Sabtu', 'Sun' => 'Minggu',
        ];

        // 1. Resolve date ranges and chart buckets
        $chartItems = [];
        $chartTitle = '';
        $chartSubtitle = '';

        if ($periodType === 'weekly') {
            // Weekly: 7 days
            $startDay = ($week - 1) * 7 + 1;
            $currStart = sprintf('%04d-%02d-%02d', $year, $month, $startDay);
            $currEnd = date('Y-m-d', strtotime("$currStart +6 days"));

            $prevStart = date('Y-m-d', strtotime("$currStart -7 days"));
            $prevEnd = date('Y-m-d', strtotime("$currEnd -7 days"));

            $currentLabel = "Minggu $week " . ($monthNames[$month] ?? "") . " $year (" . date('d/m', strtotime($currStart)) . " - " . date('d/m', strtotime($currEnd)) . ")";
            $previousLabel = "7 Hari Sebelumnya (" . date('d/m', strtotime($prevStart)) . " - " . date('d/m', strtotime($prevEnd)) . ")";
            $chartTitle = "Grafik Penjualan Harian (Minggu $week)";
            $chartSubtitle = "Rincian realisasi harian 7 hari transaksi";

            // Query daily sales for 7 days
            $dailyRows = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $kdCs)
                ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd])
                ->whereRaw("coalesce(ttl_price, 0) > 0")
                ->selectRaw("{$this->sqlDateFormat('tgl_doc')} as doc_date")
                ->selectRaw("sum(ttl_price) as day_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as day_invs")
                ->groupBy('doc_date')
                ->get()
                ->keyBy('doc_date');

            for ($d = 0; $d < 7; $d++) {
                $curDate = date('Y-m-d', strtotime("$currStart +$d days"));
                $dEn = date('D', strtotime($curDate));
                $dId = $dayNames[$dEn] ?? $dEn;
                $row = $dailyRows->get($curDate);

                $chartItems[] = [
                    'key' => $curDate,
                    'label' => "$dId " . date('d/m', strtotime($curDate)),
                    'full_label' => "$dId, " . date('d F Y', strtotime($curDate)),
                    'sales' => (float) ($row->day_sales ?? 0),
                    'invoices' => (int) ($row->day_invs ?? 0),
                    'is_active' => false,
                ];
            }
        } elseif ($periodType === 'monthly') {
            // Monthly: 4-5 weeks
            $daysInMonth = (int) date('t', strtotime("$year-$month-01"));
            $currStart = sprintf('%04d-%02d-01', $year, $month);
            $currEnd = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

            if ($month === 1) {
                $prevYear = $year - 1;
                $prevMonth = 12;
            } else {
                $prevYear = $year;
                $prevMonth = $month - 1;
            }
            $prevDays = (int) date('t', strtotime("$prevYear-$prevMonth-01"));
            $prevStart = sprintf('%04d-%02d-01', $prevYear, $prevMonth);
            $prevEnd = sprintf('%04d-%02d-%02d', $prevYear, $prevMonth, $prevDays);

            $currentLabel = ($monthNames[$month] ?? "Bulan $month") . " $year";
            $previousLabel = ($monthNames[$prevMonth] ?? "Bulan $prevMonth") . " $prevYear";
            $chartTitle = "Grafik Penjualan Mingguan ($currentLabel)";
            $chartSubtitle = "Rincian realisasi per minggu dalam bulan terpilih";

            // Define weekly buckets
            $weekBuckets = [
                1 => [1, 7],
                2 => [8, 14],
                3 => [15, 21],
                4 => [22, 28],
            ];
            if ($daysInMonth > 28) {
                $weekBuckets[5] = [29, $daysInMonth];
            }

            foreach ($weekBuckets as $wNum => $range) {
                $wStartStr = sprintf('%04d-%02d-%02d', $year, $month, $range[0]);
                $wEndStr = sprintf('%04d-%02d-%02d', $year, $month, $range[1]);

                $wRow = $this->getDbConnection()->table('tb_fakturpenjualan')
                    ->where('kd_cs', $kdCs)
                    ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$wStartStr, $wEndStr])
                    ->whereRaw("coalesce(ttl_price, 0) > 0")
                    ->selectRaw("sum(ttl_price) as w_sales")
                    ->selectRaw("count(distinct no_fakturpenjualan) as w_invs")
                    ->first();

                $chartItems[] = [
                    'key' => $wNum,
                    'label' => "Minggu $wNum",
                    'full_label' => "Minggu $wNum (" . sprintf('%02d - %02d %s', $range[0], $range[1], substr($monthNames[$month], 0, 3)) . ")",
                    'sales' => (float) ($wRow->w_sales ?? 0),
                    'invoices' => (int) ($wRow->w_invs ?? 0),
                    'is_active' => false,
                ];
            }
        } elseif ($periodType === 'quarterly') {
            // Quarterly: 3 months
            $startMonth = ($quarter - 1) * 3 + 1;
            $endMonth = $startMonth + 2;
            $endMonthDays = (int) date('t', strtotime("$year-$endMonth-01"));

            $currStart = sprintf('%04d-%02d-01', $year, $startMonth);
            $currEnd = sprintf('%04d-%02d-%02d', $year, $endMonth, $endMonthDays);

            if ($quarter === 1) {
                $prevYear = $year - 1;
                $prevQuarter = 4;
            } else {
                $prevYear = $year;
                $prevQuarter = $quarter - 1;
            }
            $pStartM = ($prevQuarter - 1) * 3 + 1;
            $pEndM = $pStartM + 2;
            $pEndDays = (int) date('t', strtotime("$prevYear-$pEndM-01"));
            $prevStart = sprintf('%04d-%02d-01', $prevYear, $pStartM);
            $prevEnd = sprintf('%04d-%02d-%02d', $prevYear, $pEndM, $pEndDays);

            $currentLabel = "Triwulan $quarter ($monthNames[$startMonth] - $monthNames[$endMonth] $year)";
            $previousLabel = "Triwulan $prevQuarter $prevYear";
            $chartTitle = "Grafik Penjualan Bulanan (Triwulan $quarter $year)";
            $chartSubtitle = "Rincian realisasi 3 bulan dalam triwulan terpilih";

            for ($m = $startMonth; $m <= $endMonth; $m++) {
                $mDays = (int) date('t', strtotime("$year-$m-01"));
                $mStart = sprintf('%04d-%02d-01', $year, $m);
                $mEnd = sprintf('%04d-%02d-%02d', $year, $m, $mDays);

                $mRow = $this->getDbConnection()->table('tb_fakturpenjualan')
                    ->where('kd_cs', $kdCs)
                    ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$mStart, $mEnd])
                    ->whereRaw("coalesce(ttl_price, 0) > 0")
                    ->selectRaw("sum(ttl_price) as m_sales")
                    ->selectRaw("count(distinct no_fakturpenjualan) as m_invs")
                    ->first();

                $chartItems[] = [
                    'key' => $m,
                    'label' => $monthNames[$m] ?? "Bulan $m",
                    'full_label' => ($monthNames[$m] ?? "Bulan $m") . " $year",
                    'sales' => (float) ($mRow->m_sales ?? 0),
                    'invoices' => (int) ($mRow->m_invs ?? 0),
                    'is_active' => false,
                ];
            }
        } elseif ($periodType === 'semester') {
            // Semester: 6 months
            $startMonth = ($semester === 1) ? 1 : 7;
            $endMonth = ($semester === 1) ? 6 : 12;
            $endDays = (int) date('t', strtotime("$year-$endMonth-01"));

            $currStart = sprintf('%04d-%02d-01', $year, $startMonth);
            $currEnd = sprintf('%04d-%02d-%02d', $year, $endMonth, $endDays);

            if ($semester === 1) {
                $prevYear = $year - 1;
                $prevSem = 2;
                $pStart = 7;
                $pEnd = 12;
            } else {
                $prevYear = $year;
                $prevSem = 1;
                $pStart = 1;
                $pEnd = 6;
            }
            $pEndDays = (int) date('t', strtotime("$prevYear-$pEnd-01"));
            $prevStart = sprintf('%04d-%02d-01', $prevYear, $pStart);
            $prevEnd = sprintf('%04d-%02d-%02d', $prevYear, $pEnd, $pEndDays);

            $currentLabel = "Semester $semester ($monthNames[$startMonth] - $monthNames[$endMonth] $year)";
            $previousLabel = "Semester $prevSem $prevYear";
            $chartTitle = "Grafik Penjualan Bulanan (Semester $semester $year)";
            $chartSubtitle = "Rincian realisasi 6 bulan dalam semester terpilih";

            for ($m = $startMonth; $m <= $endMonth; $m++) {
                $mDays = (int) date('t', strtotime("$year-$m-01"));
                $mStart = sprintf('%04d-%02d-01', $year, $m);
                $mEnd = sprintf('%04d-%02d-%02d', $year, $m, $mDays);

                $mRow = $this->getDbConnection()->table('tb_fakturpenjualan')
                    ->where('kd_cs', $kdCs)
                    ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$mStart, $mEnd])
                    ->whereRaw("coalesce(ttl_price, 0) > 0")
                    ->selectRaw("sum(ttl_price) as m_sales")
                    ->selectRaw("count(distinct no_fakturpenjualan) as m_invs")
                    ->first();

                $chartItems[] = [
                    'key' => $m,
                    'label' => substr($monthNames[$m] ?? "B$m", 0, 3),
                    'full_label' => ($monthNames[$m] ?? "Bulan $m") . " $year",
                    'sales' => (float) ($mRow->m_sales ?? 0),
                    'invoices' => (int) ($mRow->m_invs ?? 0),
                    'is_active' => false,
                ];
            }
        } elseif ($periodType === 'yearly') {
            // Yearly: 12 months
            $currStart = sprintf('%04d-01-01', $year);
            $currEnd = sprintf('%04d-12-31', $year);

            $prevYear = $year - 1;
            $prevStart = sprintf('%04d-01-01', $prevYear);
            $prevEnd = sprintf('%04d-12-31', $prevYear);

            $currentLabel = "Tahun $year (12 Bulan)";
            $previousLabel = "Tahun $prevYear";
            $chartTitle = "Grafik Penjualan 12 Bulan (Tahun $year)";
            $chartSubtitle = "Rincian realisasi per bulan sepanjang tahun $year";

            $yearRows = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $kdCs)
                ->whereRaw("{$this->sqlYear('tgl_doc')} = ?", [$year])
                ->whereRaw("coalesce(ttl_price, 0) > 0")
                ->selectRaw("{$this->sqlMonth('tgl_doc')} as doc_month")
                ->selectRaw("sum(ttl_price) as m_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as m_invs")
                ->groupBy('doc_month')
                ->get()
                ->keyBy('doc_month');

            for ($m = 1; $m <= 12; $m++) {
                $row = $yearRows->get($m);
                $chartItems[] = [
                    'key' => $m,
                    'label' => substr($monthNames[$m], 0, 3),
                    'full_label' => "$monthNames[$m] $year",
                    'sales' => (float) ($row->m_sales ?? 0),
                    'invoices' => (int) ($row->m_invs ?? 0),
                    'is_active' => false,
                ];
            }
        } else {
            // year_range: Range tahun
            $currStart = sprintf('%04d-01-01', $startYear);
            $currEnd = sprintf('%04d-12-31', $endYear);

            $yearSpan = $endYear - $startYear + 1;
            $prevEndYear = $startYear - 1;
            $prevStartYear = max(2000, $prevEndYear - $yearSpan + 1);
            $prevStart = sprintf('%04d-01-01', $prevStartYear);
            $prevEnd = sprintf('%04d-12-31', $prevEndYear);

            $currentLabel = "Rentang Tahun $startYear - $endYear";
            $previousLabel = "Rentang Sebelumnya ($prevStartYear - $prevEndYear)";
            $chartTitle = "Grafik Penjualan Tahunan ($startYear - $endYear)";
            $chartSubtitle = "Perbandingan realisasi tahun ke tahun sesuai rentang terpilih";

            $rangeRows = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $kdCs)
                ->whereRaw("{$this->sqlYear('tgl_doc')} between ? and ?", [$startYear, $endYear])
                ->whereRaw("coalesce(ttl_price, 0) > 0")
                ->selectRaw("{$this->sqlYear('tgl_doc')} as doc_year")
                ->selectRaw("sum(ttl_price) as y_sales")
                ->selectRaw("count(distinct no_fakturpenjualan) as y_invs")
                ->groupBy('doc_year')
                ->get()
                ->keyBy('doc_year');

            for ($y = $startYear; $y <= $endYear; $y++) {
                $row = $rangeRows->get($y);
                $chartItems[] = [
                    'key' => $y,
                    'label' => (string) $y,
                    'full_label' => "Tahun $y",
                    'sales' => (float) ($row->y_sales ?? 0),
                    'invoices' => (int) ($row->y_invs ?? 0),
                    'is_active' => ($y === $endYear),
                ];
            }
        }

        // 2. Query KPI Totals for this customer
        $currStats = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd])
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->selectRaw("sum(ttl_price) as total_sales")
            ->selectRaw("count(distinct no_fakturpenjualan) as total_invoices")
            ->first();

        $prevStats = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$prevStart, $prevEnd])
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->selectRaw("sum(ttl_price) as total_sales")
            ->selectRaw("count(distinct no_fakturpenjualan) as total_invoices")
            ->first();

        $totalSales = (float) ($currStats->total_sales ?? 0);
        $totalInvoices = (int) ($currStats->total_invoices ?? 0);
        $prevTotalSales = (float) ($prevStats->total_sales ?? 0);
        $prevTotalInvoices = (int) ($prevStats->total_invoices ?? 0);

        $growthPercent = $prevTotalSales > 0
            ? (($totalSales - $prevTotalSales) / $prevTotalSales) * 100
            : ($totalSales > 0 ? 100.0 : 0.0);

        $growthNominal = $totalSales - $prevTotalSales;
        $avgOrderValue = $totalInvoices > 0 ? $totalSales / $totalInvoices : 0.0;

        // Max single invoice
        $maxInvoiceRow = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd])
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->selectRaw("sum(ttl_price) as inv_total")
            ->groupBy('no_fakturpenjualan')
            ->orderByDesc('inv_total')
            ->first();
        $maxOrderValue = (float) ($maxInvoiceRow->inv_total ?? 0);

        // Overall company sales in current period
        $companyTotalSales = (float) $this->getDbConnection()->table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd])
            ->sum('ttl_price');

        $companyShare = $companyTotalSales > 0 ? ($totalSales / $companyTotalSales) * 100 : 0.0;

        // Customer Status
        if ($totalSales <= 0) {
            $status = 'Tidak Ada Transaksi';
        } elseif ($prevTotalSales <= 0) {
            $status = 'Sangat Baik (Akun Baru)';
        } elseif ($growthPercent > 20) {
            $status = 'Sangat Baik';
        } elseif ($growthPercent >= 5) {
            $status = 'Baik';
        } elseif ($growthPercent >= -5) {
            $status = 'Stabil';
        } else {
            $status = 'Menurun';
        }

        // 3. Top 10 Purchased Products/Materials from tb_do joined on f.no_do = d.no_do
        $dateExprWithTable = $this->sqlDateExpr('f.tgl_doc');
        $topMaterialsQuery = $this->getDbConnection()->table('tb_fakturpenjualan as f')
            ->join('tb_do as d', 'f.no_do', '=', 'd.no_do')
            ->where('f.kd_cs', $kdCs)
            ->whereRaw("{$dateExprWithTable} between ? and ?", [$currStart, $currEnd])
            ->whereNotNull('d.mat')
            ->whereRaw("trim(d.mat) <> ''")
            ->select('d.kd_mat', 'd.mat as material', 'd.unit')
            ->selectRaw("sum(d.qty) as total_qty")
            ->selectRaw("sum(d.total) as total_val")
            ->selectRaw("count(distinct f.no_fakturpenjualan) as freq")
            ->selectRaw("avg(d.harga) as avg_price")
            ->selectRaw("max({$dateExprWithTable}) as last_date")
            ->groupBy('d.kd_mat', 'd.mat', 'd.unit')
            ->orderByDesc('total_val')
            ->limit(10)
            ->get();

        $isAllTimeMaterials = false;
        if ($topMaterialsQuery->isEmpty()) {
            // Fallback to all-time materials from tb_do so sales team sees historical profile
            $topMaterialsQuery = $this->getDbConnection()->table('tb_fakturpenjualan as f')
                ->join('tb_do as d', 'f.no_do', '=', 'd.no_do')
                ->where('f.kd_cs', $kdCs)
                ->whereNotNull('d.mat')
                ->whereRaw("trim(d.mat) <> ''")
                ->select('d.kd_mat', 'd.mat as material', 'd.unit')
                ->selectRaw("sum(d.qty) as total_qty")
                ->selectRaw("sum(d.total) as total_val")
                ->selectRaw("count(distinct f.no_fakturpenjualan) as freq")
                ->selectRaw("avg(d.harga) as avg_price")
                ->selectRaw("max({$dateExprWithTable}) as last_date")
                ->groupBy('d.kd_mat', 'd.mat', 'd.unit')
                ->orderByDesc('total_val')
                ->limit(10)
                ->get();
            $isAllTimeMaterials = true;
        }

        $topMaterials = $topMaterialsQuery->map(function ($row) {
            return [
                'kd_mat' => $row->kd_mat,
                'material' => $row->material,
                'unit' => $row->unit,
                'total_qty' => (float) $row->total_qty,
                'total_val' => (float) $row->total_val,
                'freq' => (int) $row->freq,
                'avg_price' => (float) $row->avg_price,
                'last_date' => $row->last_date,
            ];
        })->toArray();

        // 4. Invoices List for this period
        $invoices = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->whereRaw("{$this->sqlDateExpr('tgl_doc')} between ? and ?", [$currStart, $currEnd])
            ->whereRaw("coalesce(ttl_price, 0) > 0")
            ->select('no_fakturpenjualan', 'no_fakturpajak', 'ref_po')
            ->selectRaw("min(tgl_doc) as tgl_doc")
            ->selectRaw("sum(ttl_price) as total_amount")
            ->selectRaw("count(distinct kd_mat) as item_count")
            ->groupBy('no_fakturpenjualan', 'no_fakturpajak', 'ref_po')
            ->orderByRaw("min({$this->sqlDateExpr('tgl_doc')}) desc")
            ->limit(50)
            ->get()
            ->map(function ($row) {
                return [
                    'no_fakturpenjualan' => $row->no_fakturpenjualan,
                    'no_fakturpajak' => $row->no_fakturpajak,
                    'ref_po' => $row->ref_po,
                    'tgl_doc' => $row->tgl_doc,
                    'total_amount' => (float) $row->total_amount,
                    'item_count' => (int) $row->item_count,
                ];
            })
            ->toArray();

        // Customer info
        $custRow = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->select('kd_cs', 'nm_cs')
            ->first();

        return [
            'customer' => [
                'kd_cs' => $kdCs,
                'nm_cs' => $custRow->nm_cs ?? $kdCs,
            ],
            'data_source' => $this->isClickhouse() ? 'clickhouse' : 'mysql',
            'periodInfo' => [
                'period_type' => $periodType,
                'currentLabel' => $currentLabel,
                'previousLabel' => $previousLabel,
                'currStart' => $currStart,
                'currEnd' => $currEnd,
                'prevStart' => $prevStart,
                'prevEnd' => $prevEnd,
            ],
            'kpi' => [
                'total_sales' => $totalSales,
                'prev_total_sales' => $prevTotalSales,
                'growth_percent' => $growthPercent,
                'growth_nominal' => $growthNominal,
                'total_invoices' => $totalInvoices,
                'prev_total_invoices' => $prevTotalInvoices,
                'avg_order_value' => $avgOrderValue,
                'max_order_value' => $maxOrderValue,
                'company_total_sales' => $companyTotalSales,
                'company_share_percent' => $companyShare,
                'status' => $status,
            ],
            'chartData' => [
                'title' => $chartTitle,
                'subtitle' => $chartSubtitle,
                'items' => $chartItems,
            ],
            'topMaterials' => $topMaterials,
            'isAllTimeMaterials' => $isAllTimeMaterials,
            'recentInvoices' => $invoices,
        ];
    }

    /**
     * Build summary data for customer-specific AI prompt.
     */
    private function buildCustomerAiSummary(array $data, array $filters): array
    {
        $cust = $data['customer'] ?? [];
        $kpi = $data['kpi'] ?? [];
        $period = $data['periodInfo'] ?? [];
        $topMat = $data['topMaterials'] ?? [];
        $invs = $data['recentInvoices'] ?? [];

        $matLines = [];
        foreach ($topMat as $m) {
            $valFmt = number_format($m['total_val'], 0, ',', '.');
            $qtyFmt = number_format($m['total_qty'], 0, ',', '.');
            $matLines[] = "- {$m['material']} ({$m['kd_mat']}): {$qtyFmt} {$m['unit']} senilai Rp {$valFmt} ({$m['freq']}x order)";
        }

        return [
            'kd_cs' => $cust['kd_cs'] ?? '',
            'nm_cs' => $cust['nm_cs'] ?? '',
            'period_label' => $period['currentLabel'] ?? '',
            'prev_period_label' => $period['previousLabel'] ?? '',
            'total_sales_fmt' => number_format($kpi['total_sales'] ?? 0, 0, ',', '.'),
            'prev_total_sales_fmt' => number_format($kpi['prev_total_sales'] ?? 0, 0, ',', '.'),
            'growth_percent' => (float) ($kpi['growth_percent'] ?? 0),
            'growth_percent_fmt' => (($kpi['growth_percent'] ?? 0) > 0 ? '+' : '') . round($kpi['growth_percent'] ?? 0, 2) . '%',
            'growth_nominal_fmt' => number_format($kpi['growth_nominal'] ?? 0, 0, ',', '.'),
            'total_invoices' => (int) ($kpi['total_invoices'] ?? 0),
            'prev_total_invoices' => (int) ($kpi['prev_total_invoices'] ?? 0),
            'avg_order_value_fmt' => number_format($kpi['avg_order_value'] ?? 0, 0, ',', '.'),
            'max_order_value_fmt' => number_format($kpi['max_order_value'] ?? 0, 0, ',', '.'),
            'company_share_percent' => round($kpi['company_share_percent'] ?? 0, 2),
            'status' => $kpi['status'] ?? 'Stabil',
            'top_materials_text' => !empty($matLines) ? implode("\n", $matLines) : "- Belum ada riwayat produk pada periode ini",
            'top_materials' => $topMat,
            'recent_invoices_count' => count($invs),
        ];
    }

    /**
     * Call Ollama for Customer-specific account analysis.
     */
    private function callOllamaForCustomer(array $summary): ?array
    {
        $baseUrl = rtrim(config('services.ollama.base_url', 'http://127.0.0.1:11434'), '/');
        $model = config('services.ollama.model', 'qwen2.5:7b');
        $configuredTimeout = (int) config('services.ollama.timeout', 90);
        $timeout = $configuredTimeout > 0 ? $configuredTimeout : 90;

        $systemPrompt = <<<PROMPT
Anda adalah Senior Key Account Commercial Manager & B2B Sales Intelligence Analyst.
Tugas Anda: Menganalisis profil transaksi dan KPI satu akun pelanggan (Key Account) ini secara tajam untuk membantu tim marketing & sales meningkatkan omset, frekuensi penawaran, cross-selling, dan loyalitas customer.

Format Output:
- WAJIB berupa JSON valid MURNI tanpa teks pembuka, penutup, atau markdown backticks.
- Bahasa: Bahasa Indonesia bisnis profesional, taktis, dan aplikatif.
- PENTING: Setiap butir analisis dan rekomendasi WAJIB SINGKAT, PADAT, dan LANGSUNG PADA SOLUSI (1-2 kalimat per poin).

Struktur JSON WAJIB:
{
  "account_health_score": <angka integer 0-100>,
  "loyalty_status": <"VIP / Sangat Loyal" | "Aktif Reguler" | "At-Risk / Menurun" | "Dormant / Pasif">,
  "executive_summary": "<1 paragraf ringkas (2-3 kalimat) profil pembelian dan potensi komersial akun ini>",
  "buying_habits": {
    "pattern": "<deskripsi singkat pola belanja>",
    "favorite_categories": "<kategori atau material utama yang paling sering dibeli>",
    "order_characteristics": "<analisis ringkas ukuran order dan frekuensi faktur>"
  },
  "risk_and_drop_alerts": [
    {
      "alert": "<judul isu risiko singkat>",
      "impact": "<dampak nominal atau penurunan volume>",
      "mitigation": "<1 kalimat tindakan mitigasi segera>"
    }
  ],
  "sales_growth_opportunities": [
    {
      "category": "<Cross-Selling / Produk Komplementer | Upselling Volume | Paket Penawaran>",
      "suggested_product": "<rekomendasi produk atau barang>",
      "rationale": "<1 kalimat alasan penawaran>",
      "pitching_strategy": "<1 kalimat strategi penawaran atau diskon kuantiti>"
    }
  ],
  "quick_wins": [
    "<aksi taktis sales 1 dalam 7 hari>",
    "<aksi taktis sales 2 dalam 7 hari>",
    "<aksi taktis sales 3 dalam 7 hari>"
  ]
}
PROMPT;

        $userPrompt = <<<USER_PROMPT
Profil Pembelian Customer:
- Nama Customer: {$summary['nm_cs']} ({$summary['kd_cs']})
- Periode Evaluasi: {$summary['period_label']}
- Periode Pembanding: {$summary['prev_period_label']}
- Realisasi Pembelian: Rp {$summary['total_sales_fmt']} (Sebelumnya: Rp {$summary['prev_total_sales_fmt']})
- Pertumbuhan: {$summary['growth_percent_fmt']} (Nominal: Rp {$summary['growth_nominal_fmt']})
- Jumlah Faktur: {$summary['total_invoices']} (Sebelumnya: {$summary['prev_total_invoices']})
- Rata-rata Nilai Order (AOV): Rp {$summary['avg_order_value_fmt']}
- Nilai Faktur Tertinggi: Rp {$summary['max_order_value_fmt']}
- Kontribusi terhadap Total Omset Perusahaan: {$summary['company_share_percent']}%
- Status Akun: {$summary['status']}

Produk / Material yang Paling Banyak Dibeli:
{$summary['top_materials_text']}

Buat analisis profil akun customer, rekomendasi penawaran produk, dan strategi sales ringkas sesuai format JSON.
USER_PROMPT;

        try {
            $res = Http::connectTimeout(2.5)
                ->timeout($timeout)
                ->post("{$baseUrl}/api/chat", [
                    'model' => $model,
                    'keep_alive' => -1,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'stream' => false,
                    'format' => 'json',
                    'options' => [
                        'temperature' => 0.15,
                        'top_p' => 0.85,
                        'num_predict' => 380,
                    ],
                ]);

            if (!$res->successful()) {
                Log::warning('Ollama API customer analysis error', ['status' => $res->status(), 'body' => $res->body()]);
                return ['error' => 'Ollama API error: status ' . $res->status()];
            }

            $body = $res->json();
            $content = $body['message']['content'] ?? '';

            $cleaned = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
            $cleaned = preg_replace('/\s*```$/', '', $cleaned);

            $parsed = json_decode($cleaned, true);
            if (is_array($parsed) && isset($parsed['account_health_score'])) {
                return [
                    'engine' => "{$model} (Ollama Production)",
                    'data' => $parsed,
                ];
            }

            if (preg_match('/\{[\s\S]*\}/', $cleaned, $match)) {
                $matchedJson = json_decode($match[0], true);
                if (is_array($matchedJson) && isset($matchedJson['account_health_score'])) {
                    return [
                        'engine' => "{$model} (Ollama Production)",
                        'data' => $matchedJson,
                    ];
                }
            }

            return ['error' => 'Gagal membaca format JSON dari Ollama'];
        } catch (\Throwable $e) {
            Log::info('Ollama offline for customer analysis: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Fallback heuristic intelligence engine for single customer.
     */
    private function generateCustomerHeuristicAnalysis(array $summary): array
    {
        $growth = $summary['growth_percent'];
        $invCount = $summary['total_invoices'];
        $share = $summary['company_share_percent'];
        $nmCs = $summary['nm_cs'];
        $period = $summary['period_label'];
        $prevPeriod = $summary['prev_period_label'];
        $salesFmt = $summary['total_sales_fmt'];
        $topMat = $summary['top_materials'] ?? [];

        // Account health score
        $score = 70;
        if ($growth >= 20) $score += 20;
        elseif ($growth >= 5) $score += 10;
        elseif ($growth < -20) $score -= 25;
        elseif ($growth < 0) $score -= 15;

        if ($invCount >= 10) $score += 10;
        elseif ($invCount >= 3) $score += 5;
        elseif ($invCount === 0) $score = 25;

        if ($share >= 5.0) $score += 5; // Key VIP account
        $score = max(20, min(98, $score));

        $loyaltyStatus = $score >= 80 
            ? 'VIP / Sangat Loyal' 
            : ($score >= 65 ? 'Aktif Reguler' : ($score >= 45 ? 'At-Risk / Menurun' : 'Dormant / Pasif'));

        $trendWord = $growth >= 0 
            ? "tumbuh positif sebesar {$summary['growth_percent_fmt']}" 
            : "mengalami kontraksi sebesar {$summary['growth_percent_fmt']}";

        $topItemName = !empty($topMat) ? $topMat[0]['material'] : 'produk reguler';

        $riskAlerts = [];
        if ($growth < 0 && $summary['total_sales_fmt'] !== '0') {
            $riskAlerts[] = [
                'alert' => 'Penurunan Volume Pembelian',
                'impact' => "Turun nominal Rp {$summary['growth_nominal_fmt']} dibandingkan {$prevPeriod}",
                'mitigation' => "Segera hubungi tim purchasing {$nmCs} untuk mengecek kebutuhan proyek berjalan dan periksa apakah ada kendala harga/katalog.",
            ];
        }

        if ($invCount === 0) {
            $riskAlerts[] = [
                'alert' => 'Tidak Ada Transaksi di Periode Ini',
                'impact' => 'Potensi churn atau peralihan pesanan ke supplier kompetitor',
                'mitigation' => 'Lakukan re-engagement call dalam 24 jam dengan menawarkan promo restock dan katalog item terbaru.',
            ];
        }

        if (count($topMat) <= 2 && count($topMat) > 0) {
            $riskAlerts[] = [
                'alert' => 'Keragaman Produk Rendah',
                'impact' => 'Customer hanya membeli 1-2 jenis material utama, rentan hilang jika proyek terkait usai',
                'mitigation' => 'Perkenalkan katalog produk komplementer untuk memperluas basket size belanja customer.',
            ];
        }

        $opportunities = [
            [
                'category' => 'Cross-Selling & Ekspansi Portofolio',
                'suggested_product' => "Produk Komplementer untuk {$topItemName}",
                'rationale' => "Akun ini memiliki frekuensi belanja rutin untuk {$topItemName}. Menawarkan produk pendukung akan meningkatkan nilai faktur per transaksi.",
                'pitching_strategy' => 'Kirimkan sampel dan penawaran bundling harga spesial untuk pembelian paket gabungan.',
            ],
            [
                'category' => 'Upselling Volume (Blanket Order)',
                'suggested_product' => "Pembelian Skala Lebih Besar untuk {$topItemName}",
                'rationale' => "Dengan rata-rata nilai order Rp {$summary['avg_order_value_fmt']}, kontrak pemesanan berkala (blanket PO) akan mengunci volume penjualan jangka panjang.",
                'pitching_strategy' => 'Tawarkan diskon volume bertingkat (tier pricing) dengan komitmen pengambilan barang dalam 3-6 bulan.',
            ],
        ];

        $quickWins = [
            "Jadwalkan kontak dengan PIC Purchasing {$nmCs} untuk mengonfirmasi rencana kebutuhan order bulan depan.",
            "Kirimkan penawaran katalog resmi untuk item pelengkap yang belum pernah dipesan oleh {$nmCs}.",
            "Tinjau status jatuh tempo dan riwayat pembayaran faktur terakhir guna memastikan kelancaran limit kredit penjualan.",
        ];

        return [
            'account_health_score' => $score,
            'loyalty_status' => $loyaltyStatus,
            'executive_summary' => "Pada periode {$period}, akun {$nmCs} mencatatkan total realisasi pembelian sebesar Rp {$salesFmt} ({$trendWord} dibanding {$prevPeriod}) dengan total {$invCount} invoice. Akun ini menyumbang {$share}% terhadap total omset perusahaan, dengan produk tumpuan utama berupa {$topItemName}.",
            'buying_habits' => [
                'pattern' => $invCount >= 5 ? 'Frekuensi transaksi sangat aktif dan rutin' : ($invCount > 0 ? 'Pola belanja berkala sesuai kebutuhan PO proyek' : 'Akun pasif pada periode berjalan'),
                'favorite_categories' => "Didominasi oleh pembelian {$topItemName} dengan kontribusi dominan terhadap total belanja akun.",
                'order_characteristics' => "Rata-rata nilai order per faktur (AOV) sebesar Rp {$summary['avg_order_value_fmt']} dengan pembelian terbesar mencapai Rp {$summary['max_order_value_fmt']}.",
            ],
            'risk_and_drop_alerts' => $riskAlerts,
            'sales_growth_opportunities' => $opportunities,
            'quick_wins' => $quickWins,
        ];
    }
}

