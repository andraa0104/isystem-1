<?php

namespace App\Http\Controllers\Marketing;

use App\Services\Marketing\CollectionAnalyticsService;
use Carbon\Carbon;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ReviewTagihanController
{
    /** @var \WeakMap<Connection, array<string, array<string, string>>> */
    private \WeakMap $columnTypes;

    public function __construct()
    {
        $this->columnTypes = new \WeakMap;
    }

    private function getDbConnection(): Connection
    {
        $name = config('tenants.connection', 'mysql');
        if (config("database.connections.$name.driver") !== 'mysql') {
            throw new \LogicException('Review Tagihan requires a MySQL tenant connection.');
        }
        $connection = DB::connection($name);
        if ($connection->getDriverName() !== 'mysql') {
            throw new \LogicException('Review Tagihan requires a MySQL tenant connection.');
        }

        return $connection;
    }

    private function columnType(string $column): string
    {
        $connection = $this->getDbConnection();
        $database = $connection->getDatabaseName();
        $types = $this->columnTypes[$connection] ?? [];
        if (! isset($types[$database])) {
            $types[$database] = [];
            foreach ($connection->getSchemaBuilder()->getColumns('tb_kdfakturpenjualan') as $definition) {
                $types[$database][strtolower($definition['name'])] = strtolower($definition['type_name']);
            }
            $this->columnTypes[$connection] = $types;
        }

        return $types[$database][strtolower($column)] ?? '';
    }

    private function dueRangeColumn(): string
    {
        return in_array($this->columnType('jth_tempo'), ['date', 'datetime', 'timestamp'], true)
            ? 'jth_tempo' : $this->dueDateExpr();
    }

    private function dueDateExpr(): string
    {
        return match ($this->columnType('jth_tempo')) {
            'date' => 'jth_tempo',
            'datetime', 'timestamp' => 'date(jth_tempo)',
            default => "coalesce(date(jth_tempo), str_to_date(jth_tempo, '%Y-%m-%d'), str_to_date(jth_tempo, '%Y/%m/%d'), str_to_date(jth_tempo, '%d/%m/%Y'), str_to_date(jth_tempo, '%d-%m-%Y'), str_to_date(jth_tempo, '%d.%m.%Y'))",
        };
    }

    private function balanceExpr(): string
    {
        return in_array($this->columnType('saldo_piutang'), ['decimal', 'numeric', 'float', 'double', 'real', 'int', 'bigint', 'smallint', 'mediumint', 'tinyint'], true)
            ? 'saldo_piutang' : 'coalesce(cast(saldo_piutang as decimal(18,4)), 0)';
    }

    private function baseInvoiceQuery(): Builder
    {
        return $this->getDbConnection()->table('tb_kdfakturpenjualan')
            ->whereRaw($this->balanceExpr().' > 0')
            ->whereRaw("trim(coalesce(nm_cs, '')) <> ''");
    }

    /** Shared date bounds for the cards, modal and AI dataset. */
    private function dueScopeCondition(string $scope, string $overdueRange = '30'): array
    {
        $today = Carbon::today();
        $lower = null;
        $upper = null;
        if ($scope === 'near_due') {
            $lower = $today->copy()->addDay()->toDateString();
            $upper = $today->copy()->addDays(8)->toDateString();
        } elseif ($scope === 'current_month') {
            $lower = $today->copy()->startOfMonth()->toDateString();
            $upper = $today->copy()->startOfMonth()->addMonth()->toDateString();
        } elseif ($scope === 'overdue') {
            $upper = $today->toDateString();
            if ($overdueRange === 'gt720') {
                $upper = $today->copy()->subDays(720)->toDateString();
            } elseif ($overdueRange !== 'all' && (int) $overdueRange > 0) {
                $lower = $today->copy()->subDays((int) $overdueRange)->toDateString();
            }
        }
        $conditions = [];
        $bindings = [];
        if ($lower !== null) {
            $conditions[] = $this->dueRangeColumn().' >= ?';
            $bindings[] = $lower;
        }
        if ($upper !== null) {
            $conditions[] = $this->dueRangeColumn().' < ?';
            $bindings[] = $upper;
        }
        if ($scope === 'overdue' && $overdueRange === 'gt720') {
            // Preserve exclusion of invalid MySQL zero dates when calculating ages.
            $conditions[] = 'datediff(?, '.$this->dueDateExpr().') > 720';
            $bindings[] = $today->toDateString();
        }

        return [$conditions === [] ? '1 = 1' : implode(' and ', $conditions), $bindings];
    }

    private function applyDueScope(Builder $query, string $scope, string $overdueRange = '30'): void
    {
        [$condition, $bindings] = $this->dueScopeCondition($scope, $overdueRange);
        $query->whereRaw($condition, $bindings);
    }

    public function index()
    {
        return Inertia::render('penjualan/review-tagihan/index');
    }

    public function summary(Request $request)
    {
        $range = (string) $request->query('overdue_range', '30');
        $query = $this->baseInvoiceQuery();
        $balance = $this->balanceExpr();
        foreach (['near_due', 'current_month', 'overdue'] as $scope) {
            [$condition, $bindings] = $this->dueScopeCondition($scope, $range);
            $query->selectRaw("COUNT(DISTINCT CASE WHEN {$condition} THEN nm_cs END) as {$scope}_customers", $bindings)
                ->selectRaw("COUNT(CASE WHEN {$condition} THEN 1 END) as {$scope}_invoices", $bindings)
                ->selectRaw("SUM(CASE WHEN {$condition} THEN {$balance} ELSE 0 END) as {$scope}_amount", $bindings);
        }
        $row = $query->first();
        $result = [];
        foreach (['near_due', 'current_month', 'overdue'] as $scope) {
            foreach (['customers', 'invoices', 'amount'] as $metric) {
                $key = $scope.'_'.$metric;
                $result[$key] = $metric === 'amount' ? (float) ($row->{$key} ?? 0) : (int) ($row->{$key} ?? 0);
            }
        }

        return response()->json($result);
    }

    public function customers(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $sort = (string) $request->query('sort', 'oldest_due');
        $perPageInput = $request->query('per_page', 5);
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $perPageInput);
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();

        $query = $this->baseInvoiceQuery()
            ->whereRaw($this->dueRangeColumn().' < ?', [$today]);

        if ($search !== '') {
            $query->whereRaw('lower(nm_cs) like ?', ['%'.Str::lower($search).'%']);
        }

        $rowsQuery = $query
            ->select(
                'nm_cs',
                $this->getDbConnection()->raw('count(*) as total_faktur'),
                $this->getDbConnection()->raw('sum('.$this->balanceExpr().') as total_saldo_piutang')
            )
            ->selectRaw("max(datediff(?, {$dueDateExpr})) as umur_tempo_terlama", [$today])
            ->groupBy('nm_cs');

        match ($sort) {
            'shortest_due' => $rowsQuery->orderBy('umur_tempo_terlama'),
            'largest_balance' => $rowsQuery->orderByDesc('total_saldo_piutang'),
            'smallest_balance' => $rowsQuery->orderBy('total_saldo_piutang'),
            'most_invoices' => $rowsQuery->orderByDesc('total_faktur'),
            'fewest_invoices' => $rowsQuery->orderBy('total_faktur'),
            default => $rowsQuery->orderByDesc('umur_tempo_terlama'),
        };

        $paginator = $rowsQuery->orderBy('nm_cs')->paginate($perPage, ['*'], 'page', $page);
        $rows = collect($paginator->items())->map(function ($row) {
            $maxAge = (int) ($row->umur_tempo_terlama ?? 0);
            $saldo = (float) ($row->total_saldo_piutang ?? 0);

            if ($maxAge > 90 || $saldo >= 50000000) {
                $priority = 'CRITICAL';
                $priorityLabel = 'Kritis';
                $badgeClass = 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
            } elseif ($maxAge > 45 || $saldo >= 25000000) {
                $priority = 'HIGH';
                $priorityLabel = 'Tinggi';
                $badgeClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
            } elseif ($maxAge > 20) {
                $priority = 'MEDIUM';
                $priorityLabel = 'Sedang';
                $badgeClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
            } else {
                $priority = 'LOW';
                $priorityLabel = 'Rendah';
                $badgeClass = 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30';
            }
            $row->priority_tier = $priority;
            $row->priority_label = $priorityLabel;
            $row->badge_class = $badgeClass;

            return $row;
        });

        $total = $paginator->total();

        return response()->json([
            'data' => $rows->values(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $paginator->lastPage(),
        ]);
    }

    public function overdueCustomerNames()
    {
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();
        $ageExpr = "datediff(?, {$dueDateExpr})";

        $customers = $this->baseInvoiceQuery()
            ->whereRaw($this->dueRangeColumn().' < ?', [$today])
            ->whereRaw("{$ageExpr} > 90", [$today])
            ->select('nm_cs')
            ->distinct()
            ->orderBy('nm_cs')
            ->pluck('nm_cs')
            ->values();

        return response()->json([
            'customers' => $customers,
        ]);
    }

    public function invoices(Request $request)
    {
        $scope = (string) $request->query('scope', 'overdue');
        $overdueRange = (string) $request->query('overdue_range', '30');
        $customer = trim((string) $request->query('customer', ''));
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();
        $ageSelectExpr = $scope === 'near_due'
            ? "datediff(?, {$dueDateExpr})"
            : "greatest(datediff(?, {$dueDateExpr}), 0)";

        $query = $this->baseInvoiceQuery()
            ->select(
                'no_fakturpenjualan',
                'tgl_doc',
                'ref_po',
                'harga',
                'h_ppn',
                'g_total',
                'tgl_terimainv',
                'tgl_bayar',
                'total_bayaran',
                'saldo_piutang',
                'jth_tempo',
                'nm_cs'
            )->selectRaw("{$ageSelectExpr} as umur_tempo", [$today]);

        if ($customer !== '') {
            $query->whereRaw('lower(trim(nm_cs)) = ?', [Str::lower(trim($customer))]);
        }

        $this->applyDueScope($query, $scope, $overdueRange);

        $rows = $query
            ->orderByDesc('umur_tempo')
            ->orderBy('jth_tempo')
            ->get();

        return response()->json([
            'customer' => $customer !== '' ? $customer : $this->scopeLabel($scope, $overdueRange),
            'total_overdue' => (float) $rows->sum(fn ($row) => (float) ($row->saldo_piutang ?? 0)),
            'oldest_overdue_days' => (int) ($rows->max('umur_tempo') ?? 0),
            'invoices' => $rows,
        ]);
    }

    public function aiAnalyze(Request $request, CollectionAnalyticsService $analyticsService)
    {
        @set_time_limit(360);
        @ini_set('max_execution_time', '360');

        $scope = (string) $request->input('scope', 'all');
        $overdueRange = (string) $request->input('overdue_range', 'all');
        $customer = trim((string) $request->input('customer', ''));

        try {
            $query = $this->baseInvoiceQuery()
                ->select(
                    'no_fakturpenjualan',
                    'nm_cs',
                    'kd_cs',
                    'tgl_doc',
                    'jth_tempo',
                    'tgl_terimainv',
                    'ref_po',
                    'g_total',
                    'total_bayaran',
                    'saldo_piutang'
                );

            if ($customer !== '') {
                $query->whereRaw('lower(trim(nm_cs)) = ?', [Str::lower(trim($customer))]);
            }

            if ($scope !== 'all') {
                $this->applyDueScope($query, $scope, $overdueRange);
            }

            $invoices = $query->orderBy('no_fakturpenjualan')->get()->map(fn ($row) => (array) $row)->toArray();
            $connection = $this->getDbConnection();
            $cacheKey = 'review-tagihan-ai:'.sha1(json_encode([
                'tenant' => [$connection->getName(), $connection->getDatabaseName()],
                'reference_date' => Carbon::today()->toDateString(),
                'scope' => $scope, 'overdue_range' => $overdueRange, 'customer' => $customer,
                'invoices' => $invoices,
            ], JSON_THROW_ON_ERROR));
            if (! $request->boolean('force')) {
                $cachedResult = Cache::get($cacheKey);
                if (is_array($cachedResult)) {
                    return response()->json(array_merge($cachedResult, ['cached' => true]));
                }
            }

            $result = $analyticsService->analyzeCollections($invoices, Carbon::today()->toDateString());

            if (! empty($result['success'])) {
                Cache::put($cacheKey, $result, now()->addMinutes(15));
            }

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error('ReviewTagihanController aiAnalyze failed: '.$e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'engine' => 'Error Handler Fallback',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analitik penagihan: '.$e->getMessage(),
                'data' => null,
            ], 500);
        }
    }

    private function scopeLabel(string $scope, string $overdueRange): string
    {
        return match ($scope) {
            'near_due' => 'Dekat Jatuh Tempo',
            'current_month' => 'Jatuh Tempo Bulan Sekarang',
            default => $overdueRange === 'all' ? 'Lewat Jatuh Tempo' : "Lewat Jatuh Tempo {$overdueRange} Hari",
        };
    }
}
