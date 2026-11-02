<?php

namespace App\Http\Controllers\Marketing;

use App\Services\Marketing\MarketingAnalyticsService;
use Carbon\Carbon;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PerformanceController
{
    /** @var \WeakMap<Connection, array<string, string>> */
    private \WeakMap $dateTypes;

    public function __construct()
    {
        $this->dateTypes = new \WeakMap;
    }

    private function getDbConnection(): Connection
    {
        $name = config('tenants.connection', 'mysql');
        if (config("database.connections.$name.driver") !== 'mysql') {
            throw new \LogicException('Marketing Performance requires a MySQL tenant connection.');
        }
        $connection = DB::connection($name);
        if ($connection->getDriverName() !== 'mysql') {
            throw new \LogicException('Marketing Performance requires a MySQL tenant connection.');
        }

        return $connection;
    }

    private function invoiceDateType(): string
    {
        $connection = $this->getDbConnection();
        $database = $connection->getDatabaseName();
        $types = $this->dateTypes[$connection] ?? [];
        if (! isset($types[$database])) {
            $types[$database] = strtolower($connection->getSchemaBuilder()->getColumnType('tb_fakturpenjualan', 'tgl_doc'));
            $this->dateTypes[$connection] = $types;
        }

        return $types[$database];
    }

    private function applyDateRange(Builder $query, string $start, string $end, string $column = 'tgl_doc'): void
    {
        if (in_array($this->invoiceDateType(), ['date', 'datetime', 'timestamp'], true)) {
            $query->where($column, '>=', $start)->where($column, '<', Carbon::parse($end)->addDay()->toDateString());
        } else {
            $query->whereRaw($this->sqlDateExpr($column).' between ? and ?', [$start, $end]);
        }
    }

    /**
     * SQL expression to parse date column.
     */
    private function sqlDateExpr(string $col = 'tgl_doc'): string
    {
        if ($this->invoiceDateType() === 'date') {
            return $col;
        }
        if (in_array($this->invoiceDateType(), ['datetime', 'timestamp'], true)) {
            return "DATE({$col})";
        }

        return "CASE WHEN {$col} LIKE '__.__.____' THEN STR_TO_DATE({$col}, '%d.%m.%Y') ELSE STR_TO_DATE({$col}, '%Y-%m-%d') END";
    }

    /**
     * SQL expression to format date as 'YYYY-MM-DD' string.
     */
    private function sqlDateFormat(string $col = 'tgl_doc', string $format = '%Y-%m-%d'): string
    {
        return "DATE_FORMAT({$this->sqlDateExpr($col)}, '{$format}')";
    }

    /**
     * SQL expression for Year (e.g. 2025).
     */
    private function sqlYear(string $col = 'tgl_doc'): string
    {
        return "YEAR({$this->sqlDateExpr($col)})";
    }

    /**
     * SQL expression for Month (1 - 12).
     */
    private function sqlMonth(string $col = 'tgl_doc'): string
    {
        return "MONTH({$this->sqlDateExpr($col)})";
    }

    /**
     * SQL expression for Quarter (1 - 4).
     */
    private function sqlQuarter(string $col = 'tgl_doc'): string
    {
        return "QUARTER({$this->sqlDateExpr($col)})";
    }

    private function comparisonTotals(Builder $query, string $currStart, string $currEnd, string $prevStart, string $prevEnd): Builder
    {
        $query->where(function ($query) use ($currStart, $currEnd, $prevStart, $prevEnd) {
            $query->where(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd))
                ->orWhere(fn ($query) => $this->applyDateRange($query, $prevStart, $prevEnd));
        });
        $date = $this->sqlDateExpr();
        foreach (['curr' => [$currStart, $currEnd], 'prev' => [$prevStart, $prevEnd]] as $period => $bounds) {
            $condition = "{$date} between ? and ?";
            if (in_array($this->invoiceDateType(), ['date', 'datetime', 'timestamp'], true)) {
                $condition = 'tgl_doc >= ? and tgl_doc < ?';
                $bounds[1] = Carbon::parse($bounds[1])->addDay()->toDateString();
            }
            $query->selectRaw("SUM(CASE WHEN {$condition} THEN ttl_price ELSE 0 END) as {$period}_sales", $bounds)
                ->selectRaw("COUNT(DISTINCT CASE WHEN {$condition} THEN no_fakturpenjualan END) as {$period}_invoices", $bounds);
        }

        return $query;
    }

    private function customerBucketTotals(string $customer, string $start, string $end, string $bucket): Collection
    {
        $query = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $customer)->whereRaw('coalesce(ttl_price, 0) > 0');
        $this->applyDateRange($query, $start, $end);

        return $query->selectRaw($bucket.' as period_key')
            ->selectRaw('SUM(ttl_price) as total_sales, COUNT(DISTINCT no_fakturpenjualan) as total_invoices')
            ->groupBy('period_key')->get()->keyBy('period_key');
    }

    /**
     * Render the main Marketing Performance page.
     */
    public function index(Request $request)
    {
        $filters = $this->extractFilters($request);
        $defaultFilters = $this->defaultClosedPeriodFilters();
        $availableYears = $this->getAvailableYears();
        $customersList = $this->getCustomersList();

        return Inertia::render('marketing/performance/index', [
            'initialFilters' => $filters,
            'defaultFilters' => $defaultFilters,
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
     * Return AI-powered strategic analysis for KPI and sales recommendations.
     */
    public function aiAnalyze(Request $request)
    {
        @set_time_limit(360);
        @ini_set('max_execution_time', '360');

        $filters = $this->extractFilters($request);

        $perfData = $this->calculatePerformanceData($filters);

        // Reuse an analysis only when the underlying KPI dataset is unchanged.
        $cacheKey = 'marketing-performance-ai:'.sha1(json_encode([
            'tenant' => [$this->getDbConnection()->getName(), $this->getDbConnection()->getDatabaseName()],
            'filters' => $filters,
            'data' => $perfData,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        if (! $request->boolean('force')) {
            $cachedResult = Cache::get($cacheKey);
            if (is_array($cachedResult)) {
                return response()->json(array_merge($cachedResult, ['cached' => true]));
            }
        }

        try {
            $analyticsService = app(MarketingAnalyticsService::class);
            $result = $analyticsService->analyzeOverallPerformance($perfData, $filters);
        } catch (\Throwable $e) {
            Log::error('PerformanceController aiAnalyze failed: '.$e->getMessage(), [
                'exception' => get_class($e),
            ]);

            return response()->json([
                'success' => false,
                'engine' => 'AI Analytics Engine',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analisis AI: '.$e->getMessage(),
                'data' => null,
            ], 200);
        }

        if (($result['success'] ?? false) === true && ! empty($result['data'])) {
            Cache::put($cacheKey, $result, now()->addMinutes(10));
        }

        return response()->json($result);
    }

    /**
     * Render Customer KPI Detail page.
     */
    public function customerDetail(Request $request, string $customer)
    {
        $customerInfo = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $customer)
            ->select('kd_cs', 'nm_cs')
            ->first();

        if (! $customerInfo) {
            $customerInfo = (object) [
                'kd_cs' => $customer,
                'nm_cs' => $customer,
            ];
        }

        $filters = $this->extractCustomerFilters($request);

        return Inertia::render('marketing/performance/customer', [
            'customer' => $customerInfo,
            'initialFilters' => $filters,
            'defaultFilters' => $this->defaultClosedPeriodFilters(),
            'availableYears' => $this->getAvailableYears(),
        ]);
    }

    /**
     * Return JSON data for Customer KPI detail: summary, chart, top materials, and invoice history.
     */
    public function customerData(Request $request, string $customer)
    {
        $filters = $this->extractCustomerFilters($request);
        $data = $this->calculateCustomerPerformance($customer, $filters);

        return response()->json($data);
    }

    /**
     * Return AI-powered strategic analysis specifically for this customer account.
     */
    public function customerAiAnalyze(Request $request, string $customer)
    {
        @set_time_limit(360);
        @ini_set('max_execution_time', '360');

        $filters = $this->extractCustomerFilters($request);

        $perfData = $this->calculateCustomerPerformance($customer, $filters);

        try {
            $analyticsService = app(MarketingAnalyticsService::class);
            $result = $analyticsService->analyzeCustomerPerformance($perfData, $filters);
        } catch (\Throwable $e) {
            Log::error('PerformanceController customerAiAnalyze failed: '.$e->getMessage(), [
                'exception' => get_class($e),
            ]);

            return response()->json([
                'success' => false,
                'engine' => 'AI Analytics Engine',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analisis AI customer: '.$e->getMessage(),
                'data' => null,
            ], 200);
        }

        return response()->json($result);
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
        $filename = 'marketing-performance-'.$filters['year'].'-'.$filters['period_type'].'.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($data) {
            $output = fopen('php://output', 'w');
            $writeRow = static fn (array $row): int|false => fputcsv($output, $row, escape: '');
            // Write UTF-8 BOM for Excel
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            $writeRow(['KEY PERFORMANCE INDICATOR (KPI) PENJUALAN']);
            $writeRow(['Periode', $data['periodInfo']['currentLabel']]);
            $writeRow(['Periode Pembanding', $data['periodInfo']['previousLabel']]);
            $writeRow([]);

            // Summary KPI
            $writeRow(['RINGKASAN KPI']);
            $writeRow(['Total Penjualan', number_format($data['kpi']['total_sales'], 0, ',', '.')]);
            $writeRow(['Customer Bertransaksi', $data['kpi']['total_customers']]);
            $writeRow(['Pertumbuhan Penjualan (%)', round($data['kpi']['growth_percent'], 2).'%']);
            $writeRow(['Total Invoice', $data['kpi']['total_invoices']]);
            $writeRow(['Customer Tertinggi', ($data['kpi']['top_customer']['name'] ?? '-').' (Rp '.number_format($data['kpi']['top_customer']['sales'] ?? 0, 0, ',', '.').')']);
            $writeRow([]);

            // Top 5 Highest
            $writeRow(['TOP 5 PENJUALAN TERTINGGI']);
            $writeRow(['Rank', 'Kode Customer', 'Nama Customer', 'Total Penjualan (Rp)', 'Jumlah Invoice', 'Kontribusi (%)']);
            foreach ($data['topCustomers'] as $row) {
                $writeRow([
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    $row['curr_invoices'],
                    round($row['contribution'], 2).'%',
                ]);
            }
            $writeRow([]);

            // Top 5 Lowest
            $writeRow(['TOP 5 PENJUALAN TERENDAH (> Rp 0)']);
            $writeRow(['Rank', 'Kode Customer', 'Nama Customer', 'Total Penjualan (Rp)', 'Jumlah Invoice', 'Pertumbuhan (%)', 'Catatan']);
            foreach ($data['lowestCustomers'] as $row) {
                $writeRow([
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    $row['curr_invoices'],
                    round($row['growth'], 2).'%',
                    'Tidak termasuk customer Rp0',
                ]);
            }
            $writeRow([]);

            // All Customers
            $writeRow(['PERFORMA SELURUH CUSTOMER']);
            $writeRow([
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
                $writeRow([
                    $row['rank'],
                    $row['kd_cs'],
                    $row['nm_cs'],
                    number_format($row['curr_sales'], 0, ',', '.'),
                    number_format($row['prev_sales'], 0, ',', '.'),
                    round($row['growth'], 2).'%',
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
    private function defaultClosedPeriodFilters(): array
    {
        $closedMonth = now('Asia/Singapore')->subMonthNoOverflow();
        $month = (int) $closedMonth->month;

        return [
            'year' => (int) $closedMonth->year,
            'period_type' => 'monthly',
            'month' => $month,
            'quarter' => (int) ceil($month / 3),
            'semester' => $month <= 6 ? 1 : 2,
            'customer' => 'all',
        ];
    }

    private function extractFilters(Request $request): array
    {
        $defaults = $this->defaultClosedPeriodFilters();
        $year = (int) $request->input('year', $defaults['year']);
        if ($year < 2000 || $year > 2100) {
            $year = $defaults['year'];
        }

        $periodType = $request->input('period_type', 'monthly');
        if (! in_array($periodType, ['monthly', 'quarterly', 'semester', 'yearly'], true)) {
            $periodType = 'monthly';
        }

        $month = (int) $request->input('month', $defaults['month']);
        if ($month < 1 || $month > 12) {
            $month = $defaults['month'];
        }

        $quarter = (int) $request->input('quarter', $defaults['quarter']);
        if ($quarter < 1 || $quarter > 4) {
            $quarter = $defaults['quarter'];
        }

        $semester = (int) $request->input('semester', $defaults['semester']);
        if ($semester < 1 || $semester > 2) {
            $semester = $defaults['semester'];
        }

        $customer = trim((string) $request->input('customer', 'all'));

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
        $currentYear = $this->defaultClosedPeriodFilters()['year'];
        $fallbackYears = range($currentYear, $currentYear - 4);

        try {
            $years = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->whereNotNull('no_fakturpenjualan')
                ->whereRaw("trim(no_fakturpenjualan) <> ''")
                ->selectRaw("{$this->sqlYear('tgl_doc')} as yr")
                ->tap(fn ($query) => $this->applyDateRange($query, '2000-01-01', '2099-12-31'))
                ->groupBy('yr')
                ->orderByDesc('yr')
                ->pluck('yr')
                ->map(fn ($y) => (int) $y)
                ->values()
                ->toArray();

            if (empty($years)) {
                return $fallbackYears;
            }

            return $years;
        } catch (\Throwable) {
            return $fallbackYears;
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

        $query = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw('coalesce(ttl_price, 0) > 0')->select('kd_cs', 'nm_cs');
        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $query->where('kd_cs', $customerFilter);
        }
        $periodRows = $this->comparisonTotals($query, $currStart, $currEnd, $prevStart, $prevEnd)
            ->groupBy('kd_cs', 'nm_cs')->get();
        $currRows = $periodRows->filter(fn ($row) => (float) $row->curr_sales > 0);
        $prevRows = $periodRows->filter(fn ($row) => (float) $row->prev_sales > 0)->keyBy('kd_cs');

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
            if (! isset($customerMap[$kd])) {
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
        usort($allCustomersList, fn ($a, $b) => $b['curr_sales'] <=> $a['curr_sales']);

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
                $aiReason = 'Customer churn: pernah belanja Rp '.number_format($prevS, 0, ',', '.').' di periode lalu namun terhenti.';
            } elseif ($r <= 5 && $growth >= 0) {
                $aiStatus = 'VIP Growth Leader';
                $aiBadge = 'emerald';
                $aiAction = '🛡️ Kunci Kontrak Tahunan & Proteksi Alokasi Stok VIP';
                $aiReason = 'Penyumbang omset utama ('.round($contrib, 1).'%) dengan tren pertumbuhan positif ('.($growth > 0 ? '+' : '').round($growth, 1).'%).';
            } elseif ($r <= 5 && $growth < 0) {
                $aiStatus = 'VIP At-Risk';
                $aiBadge = 'rose';
                $aiAction = '🚨 Intervensi Langsung CCO: Re-Negosiasi & Mitigasi Churn';
                $aiReason = 'Customer VIP mengalami penurunan omset Rp '.number_format(abs($diffSales), 0, ',', '.').' ('.round($growth, 1).'%).';
            } elseif ($growth >= 25 && $currS > 0) {
                $aiStatus = 'Akselerasi Tinggi';
                $aiBadge = 'emerald';
                $aiAction = '🚀 Cross-Selling Kategori Baru & Kemitraan Strategis';
                $aiReason = 'Pertumbuhan volume sangat kuat (+ '.round($growth, 1).'%). Peluang besar untuk penetrasi item lain.';
            } elseif ($growth >= 0 && $growth < 25 && $currS > 0) {
                $aiStatus = 'Konsisten & Stabil';
                $aiBadge = 'blue';
                $aiAction = '📈 Kunci Jadwal Repeat Order Rutin & Lock Volume';
                $aiReason = 'Pola belanja stabil dan teratur ('.$cust['curr_invoices'].' invoice). Pertahankan kepuasan layanan.';
            } elseif ($growth < 0 && $growth >= -15) {
                $aiStatus = 'Penurunan Ringan';
                $aiBadge = 'amber';
                $aiAction = '🔍 Follow-up Purchasing & Cek Kendala Operasional';
                $aiReason = 'Penurunan omset wajar ('.round($growth, 1).'%), perlu pengingat jadwal order dan penawaran.';
            } elseif ($growth < -15 && $growth >= -40) {
                $aiStatus = 'Menurun Signifikan';
                $aiBadge = 'orange';
                $aiAction = '⚠️ Audit Penyebab Drop & Berikan Diskon Penyelamatan';
                $aiReason = 'Anomali penurunan tajam Rp '.number_format(abs($diffSales), 0, ',', '.').'. Perlu audit kebutuhan purchasing.';
            } else {
                $aiStatus = 'Kritis / Drop Drastis';
                $aiBadge = 'rose';
                $aiAction = '🚨 Audit Mendalam: Cek Sisa Stok & Negosiasi Ulang';
                $aiReason = 'Penurunan omset sangat drastis ('.round($growth, 1).'%). Risiko kehilangan akun permanen.';
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
        $topCustomer = ! empty($allCustomersList) && $allCustomersList[0]['curr_sales'] > 0
            ? [
                'name' => $allCustomersList[0]['nm_cs'],
                'sales' => $allCustomersList[0]['curr_sales'],
                'invoices' => $allCustomersList[0]['curr_invoices'],
                'contribution' => $allCustomersList[0]['contribution'],
            ]
            : null;

        // Top 5 Highest Sales - Periode Berjalan (Fokus: Aksi Tim AI)
        $topCustomers = array_slice(array_filter($allCustomersList, fn ($c) => $c['curr_sales'] > 0), 0, 5);
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
        $positiveCustomers = array_filter($allCustomersList, fn ($c) => $c['curr_sales'] > 0);
        usort($positiveCustomers, fn ($a, $b) => $a['curr_sales'] <=> $b['curr_sales']);
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
        $decliningList = array_filter($allCustomersList, fn ($c) => $c['diff_sales'] < 0 && $c['prev_sales'] > 0);
        usort($decliningList, fn ($a, $b) => $a['diff_sales'] <=> $b['diff_sales']);
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
        $positivePrevCustomers = array_filter($allCustomersList, fn ($c) => $c['prev_sales'] > 0);
        usort($positivePrevCustomers, fn ($a, $b) => $b['prev_sales'] <=> $a['prev_sales']);
        $prevTopCustomers = array_slice($positivePrevCustomers, 0, 5);
        $ptRank = 1;
        foreach ($prevTopCustomers as &$ptCust) {
            $ptCust['rank'] = $ptRank++;
            $ptCust['contribution'] = $prevTotalSales > 0 ? ($ptCust['prev_sales'] / $prevTotalSales) * 100 : 0.0;
        }
        unset($ptCust);

        // Top 5 Lowest Sales - Periode Sebelumnya (> 0, strictly no Rp 0!)
        usort($positivePrevCustomers, fn ($a, $b) => $a['prev_sales'] <=> $b['prev_sales']);
        $prevLowestCustomers = array_slice($positivePrevCustomers, 0, 5);
        $plRank = 1;
        foreach ($prevLowestCustomers as &$plCust) {
            $plCust['rank'] = $plRank++;
        }
        unset($plCust);

        // 3. Chart Data Generation
        $chartData = $this->generateChartData($year, $periodType, $month, $quarter, $semester, $customerFilter);

        // 4. Top 10 Ordered Materials from tb_do joined on tb_fakturpenjualan.no_do = tb_do.no_do
        $topMaterialsQuery = $this->getDbConnection()->table('tb_fakturpenjualan as f')
            ->join('tb_do as d', 'f.no_do', '=', 'd.no_do')
            ->whereRaw('coalesce(f.ttl_price, 0) > 0')
            ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'f.tgl_doc'))
            ->whereNotNull('d.mat')
            ->whereRaw("trim(d.mat) <> ''");

        if ($customerFilter !== 'all' && $customerFilter !== '') {
            $topMaterialsQuery->where('f.kd_cs', $customerFilter);
        }

        $topMaterials = $topMaterialsQuery
            ->select('d.kd_mat', 'd.mat as material', 'd.unit')
            ->selectRaw('sum(d.qty) as total_qty')
            ->selectRaw('sum(d.total) as total_val')
            ->selectRaw('count(distinct f.no_fakturpenjualan) as freq')
            ->selectRaw('avg(d.harga) as avg_price')
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
            'data_source' => 'mysql',
            'kpi' => [
                'total_sales' => $totalSales,
                'prev_total_sales' => $prevTotalSales,
                'growth_percent' => $growthPercent,
                'growth_nominal' => $totalSales - $prevTotalSales,
                'total_customers' => $transactingCustomersCount,
                'prev_total_customers' => count($prevRows),
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
                'currentLabel' => ($monthNames[$month] ?? "Bulan $month")." $year",
                'previousLabel' => ($monthNames[$prevMonth] ?? "Bulan $prevMonth")." $prevYear",
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
            ->whereRaw('coalesce(ttl_price, 0) > 0');

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
                ->tap(fn ($query) => $this->applyDateRange($query, sprintf('%04d-01-01', $year), sprintf('%04d-12-31', $year)))
                ->selectRaw("{$this->sqlMonth('tgl_doc')} as period_key")
                ->selectRaw('sum(ttl_price) as total_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as invoice_count')
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($m = 1; $m <= 12; $m++) {
                $row = $results->get($m);
                $items[] = [
                    'key' => $m,
                    'label' => $monthLabels[$m],
                    'full_label' => $monthLabels[$m]." $year",
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
                ->tap(fn ($query) => $this->applyDateRange($query, sprintf('%04d-01-01', $year), sprintf('%04d-12-31', $year)))
                ->selectRaw("{$this->sqlQuarter('tgl_doc')} as period_key")
                ->selectRaw('sum(ttl_price) as total_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as invoice_count')
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($q = 1; $q <= 4; $q++) {
                $row = $results->get($q);
                $items[] = [
                    'key' => $q,
                    'label' => "Q$q",
                    'full_label' => $quarterLabels[$q]." $year",
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
                ->tap(fn ($query) => $this->applyDateRange($query, sprintf('%04d-01-01', $year), sprintf('%04d-12-31', $year)))
                ->selectRaw("CASE WHEN {$this->sqlMonth('tgl_doc')} <= 6 THEN 1 ELSE 2 END as period_key")
                ->selectRaw('sum(ttl_price) as total_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as invoice_count')
                ->groupBy('period_key')
                ->get()
                ->keyBy('period_key');

            $items = [];
            for ($s = 1; $s <= 2; $s++) {
                $row = $results->get($s);
                $items[] = [
                    'key' => $s,
                    'label' => "Semester $s",
                    'full_label' => $semesterLabels[$s]." $year",
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
            ->tap(fn ($query) => $this->applyDateRange($query, sprintf('%04d-01-01', $startYear), sprintf('%04d-12-31', $year)))
            ->selectRaw("{$this->sqlYear('tgl_doc')} as period_key")
            ->selectRaw('sum(ttl_price) as total_sales')
            ->selectRaw('count(distinct no_fakturpenjualan) as invoice_count')
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

    private function extractCustomerFilters(Request $request): array
    {
        $defaults = $this->defaultClosedPeriodFilters();
        $periodType = $request->input('period_type', 'monthly');
        if (! in_array($periodType, ['weekly', 'monthly', 'quarterly', 'semester', 'yearly', 'year_range'], true)) {
            $periodType = 'monthly';
        }

        $year = (int) $request->input('year', $defaults['year']);
        if ($year < 2000 || $year > 2100) {
            $year = $defaults['year'];
        }

        $month = (int) $request->input('month', $defaults['month']);
        if ($month < 1 || $month > 12) {
            $month = $defaults['month'];
        }

        $week = (int) $request->input('week', 1);
        if ($week < 1 || $week > 5) {
            $week = 1;
        }

        $quarter = (int) $request->input('quarter', $defaults['quarter']);
        if ($quarter < 1 || $quarter > 4) {
            $quarter = $defaults['quarter'];
        }

        $semester = (int) $request->input('semester', $defaults['semester']);
        if ($semester < 1 || $semester > 2) {
            $semester = $defaults['semester'];
        }

        $startYear = (int) $request->input('start_year', max(2020, $year - 4));
        $endYear = (int) $request->input('end_year', $year);
        $startYear = max(2000, min(2100, $startYear));
        $endYear = max(2000, min(2100, $endYear));
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

            $currentLabel = "Minggu $week ".($monthNames[$month] ?? '')." $year (".date('d/m', strtotime($currStart)).' - '.date('d/m', strtotime($currEnd)).')';
            $previousLabel = '7 Hari Sebelumnya ('.date('d/m', strtotime($prevStart)).' - '.date('d/m', strtotime($prevEnd)).')';
            $chartTitle = "Grafik Penjualan Harian (Minggu $week)";
            $chartSubtitle = 'Rincian realisasi harian 7 hari transaksi';

            // Query daily sales for 7 days
            $dailyRows = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $kdCs)
                ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'tgl_doc'))
                ->whereRaw('coalesce(ttl_price, 0) > 0')
                ->selectRaw("{$this->sqlDateFormat('tgl_doc')} as doc_date")
                ->selectRaw('sum(ttl_price) as day_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as day_invs')
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
                    'label' => "$dId ".date('d/m', strtotime($curDate)),
                    'full_label' => "$dId, ".date('d F Y', strtotime($curDate)),
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

            $currentLabel = ($monthNames[$month] ?? "Bulan $month")." $year";
            $previousLabel = ($monthNames[$prevMonth] ?? "Bulan $prevMonth")." $prevYear";
            $chartTitle = "Grafik Penjualan Mingguan ($currentLabel)";
            $chartSubtitle = 'Rincian realisasi per minggu dalam bulan terpilih';

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

            $bucket = 'FLOOR((DAY('.$this->sqlDateExpr().') - 1) / 7) + 1';
            $weeklyRows = $this->customerBucketTotals($kdCs, $currStart, $currEnd, $bucket);
            foreach ($weekBuckets as $wNum => $range) {
                $wRow = $weeklyRows->get($wNum);

                $chartItems[] = [
                    'key' => $wNum,
                    'label' => "Minggu $wNum",
                    'full_label' => "Minggu $wNum (".sprintf('%02d - %02d %s', $range[0], $range[1], substr($monthNames[$month], 0, 3)).')',
                    'sales' => (float) ($wRow->total_sales ?? 0),
                    'invoices' => (int) ($wRow->total_invoices ?? 0),
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
            $chartSubtitle = 'Rincian realisasi 3 bulan dalam triwulan terpilih';

            $monthlyRows = $this->customerBucketTotals($kdCs, $currStart, $currEnd, $this->sqlMonth());
            for ($m = $startMonth; $m <= $endMonth; $m++) {
                $mRow = $monthlyRows->get($m);

                $chartItems[] = [
                    'key' => $m,
                    'label' => $monthNames[$m] ?? "Bulan $m",
                    'full_label' => ($monthNames[$m] ?? "Bulan $m")." $year",
                    'sales' => (float) ($mRow->total_sales ?? 0),
                    'invoices' => (int) ($mRow->total_invoices ?? 0),
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
            $chartSubtitle = 'Rincian realisasi 6 bulan dalam semester terpilih';

            $monthlyRows = $this->customerBucketTotals($kdCs, $currStart, $currEnd, $this->sqlMonth());
            for ($m = $startMonth; $m <= $endMonth; $m++) {
                $mRow = $monthlyRows->get($m);

                $chartItems[] = [
                    'key' => $m,
                    'label' => substr($monthNames[$m] ?? "B$m", 0, 3),
                    'full_label' => ($monthNames[$m] ?? "Bulan $m")." $year",
                    'sales' => (float) ($mRow->total_sales ?? 0),
                    'invoices' => (int) ($mRow->total_invoices ?? 0),
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
                ->tap(fn ($query) => $this->applyDateRange($query, sprintf('%04d-01-01', $year), sprintf('%04d-12-31', $year)))
                ->whereRaw('coalesce(ttl_price, 0) > 0')
                ->selectRaw("{$this->sqlMonth('tgl_doc')} as doc_month")
                ->selectRaw('sum(ttl_price) as m_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as m_invs')
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
            $chartSubtitle = 'Perbandingan realisasi tahun ke tahun sesuai rentang terpilih';

            $rangeRows = $this->getDbConnection()->table('tb_fakturpenjualan')
                ->where('kd_cs', $kdCs)
                ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd))
                ->whereRaw('coalesce(ttl_price, 0) > 0')
                ->selectRaw("{$this->sqlYear('tgl_doc')} as doc_year")
                ->selectRaw('sum(ttl_price) as y_sales')
                ->selectRaw('count(distinct no_fakturpenjualan) as y_invs')
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
        $totals = $this->comparisonTotals(
            $this->getDbConnection()->table('tb_fakturpenjualan')->where('kd_cs', $kdCs)
                ->whereRaw('coalesce(ttl_price, 0) > 0'),
            $currStart, $currEnd, $prevStart, $prevEnd,
        )->first();
        $totalSales = (float) ($totals->curr_sales ?? 0);
        $totalInvoices = (int) ($totals->curr_invoices ?? 0);
        $prevTotalSales = (float) ($totals->prev_sales ?? 0);
        $prevTotalInvoices = (int) ($totals->prev_invoices ?? 0);

        $growthPercent = $prevTotalSales > 0
            ? (($totalSales - $prevTotalSales) / $prevTotalSales) * 100
            : ($totalSales > 0 ? 100.0 : 0.0);

        $growthNominal = $totalSales - $prevTotalSales;
        $avgOrderValue = $totalInvoices > 0 ? $totalSales / $totalInvoices : 0.0;

        // Max single invoice
        $maxInvoiceRow = $this->getDbConnection()->table('tb_fakturpenjualan')
            ->where('kd_cs', $kdCs)
            ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'tgl_doc'))
            ->whereRaw('coalesce(ttl_price, 0) > 0')
            ->selectRaw('sum(ttl_price) as inv_total')
            ->groupBy('no_fakturpenjualan')
            ->orderByDesc('inv_total')
            ->first();
        $maxOrderValue = (float) ($maxInvoiceRow->inv_total ?? 0);

        // Overall company sales in current period
        $companyTotalSales = (float) $this->getDbConnection()->table('tb_fakturpenjualan')
            ->whereNotNull('no_fakturpenjualan')
            ->whereRaw("trim(no_fakturpenjualan) <> ''")
            ->whereRaw('coalesce(ttl_price, 0) > 0')
            ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'tgl_doc'))
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
            ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'f.tgl_doc'))
            ->whereNotNull('d.mat')
            ->whereRaw("trim(d.mat) <> ''")
            ->select('d.kd_mat', 'd.mat as material', 'd.unit')
            ->selectRaw('sum(d.qty) as total_qty')
            ->selectRaw('sum(d.total) as total_val')
            ->selectRaw('count(distinct f.no_fakturpenjualan) as freq')
            ->selectRaw('avg(d.harga) as avg_price')
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
                ->selectRaw('sum(d.qty) as total_qty')
                ->selectRaw('sum(d.total) as total_val')
                ->selectRaw('count(distinct f.no_fakturpenjualan) as freq')
                ->selectRaw('avg(d.harga) as avg_price')
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
            ->tap(fn ($query) => $this->applyDateRange($query, $currStart, $currEnd, 'tgl_doc'))
            ->whereRaw('coalesce(ttl_price, 0) > 0')
            ->select('no_fakturpenjualan', 'no_fakturpajak', 'ref_po')
            ->selectRaw('min(tgl_doc) as tgl_doc')
            ->selectRaw('sum(ttl_price) as total_amount')
            ->selectRaw('count(distinct kd_mat) as item_count')
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
            'data_source' => 'mysql',
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
}
