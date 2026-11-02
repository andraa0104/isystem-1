<?php

namespace App\Http\Controllers\Marketing;

use App\Services\Marketing\CollectionAnalyticsService;
use App\Services\Marketing\CollectionDetailQuery;
use Carbon\Carbon;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
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

    /** Match the Python aging matrix, including its legacy due-date fallback. */
    private function agingDateExpr(string $column): string
    {
        if (in_array($this->columnType($column), ['date', 'datetime', 'timestamp'], true)) {
            return "nullif(date({$column}), '0000-00-00')";
        }

        return "nullif(coalesce(str_to_date({$column}, '%Y-%m-%d'), str_to_date({$column}, '%Y/%m/%d'), str_to_date({$column}, '%d-%m-%Y'), str_to_date({$column}, '%d/%m/%Y'), str_to_date({$column}, '%d.%m.%Y')), '0000-00-00')";
    }

    public function agingInvoices(Request $request)
    {
        $filters = $request->validate([
            'bucket' => ['required', Rule::in(['current', 'near_due', 'overdue_1_90', 'overdue_91_180', 'overdue_181_year', 'overdue_year_720', 'overdue_gt_720'])],
            'reference_date' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in([5, 10, 25, 50, 100])],
            'search' => ['nullable', 'string', 'max:200'],
        ]);
        $reference = isset($filters['reference_date']) ? Carbon::createFromFormat('!Y-m-d', $filters['reference_date']) : Carbon::today();
        $yearDays = $reference->isLeapYear() ? 366 : 365;
        [$minAge, $maxAge] = match ($filters['bucket']) {
            'current' => [null, -8],
            'near_due' => [-7, 0],
            'overdue_1_90' => [1, 90],
            'overdue_91_180' => [91, 180],
            'overdue_181_year' => [181, $yearDays],
            'overdue_year_720' => [$yearDays + 1, 720],
            'overdue_gt_720' => [721, null],
        };
        // Age is reference - due date; reverse bounds to keep the upper date exclusive.
        $lower = $maxAge === null ? null : $reference->copy()->subDays($maxAge)->toDateString();
        $upper = $minAge === null ? null : $reference->copy()->subDays($minAge)->addDay()->toDateString();
        $due = $this->agingDateExpr('jth_tempo');
        $document = $this->agingDateExpr('tgl_doc');
        $fallback = "coalesce(date_add({$document}, interval 30 day), ?)";
        $effectiveDue = "coalesce({$due}, date_add({$document}, interval 30 day), ?)";
        $date = $reference->toDateString();
        $native = in_array($this->columnType('jth_tempo'), ['date', 'datetime', 'timestamp'], true);
        $query = $this->baseInvoiceQuery()->where(function (Builder $dates) use ($due, $fallback, $native, $lower, $upper, $date) {
            $applyRange = function (Builder $range, string $expression, array $bindings = []) use ($lower, $upper) {
                if ($lower !== null) {
                    $range->whereRaw("{$expression} >= ?", [...$bindings, $lower]);
                }
                if ($upper !== null) {
                    $range->whereRaw("{$expression} < ?", [...$bindings, $upper]);
                }
            };
            $dates->where(fn (Builder $valid) => $applyRange($valid->whereRaw("{$due} is not null"), $native ? 'jth_tempo' : $due));
            $dates->orWhere(function (Builder $missing) use ($applyRange, $due, $fallback, $date) {
                $missing->whereRaw("{$due} is null");
                $applyRange($missing, $fallback, [$date]);
            });
        });
        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], Str::lower($search)).'%';
            $query->where(function (Builder $matches) use ($pattern) {
                foreach (['no_fakturpenjualan', 'nm_cs', 'ref_po'] as $column) {
                    $matches->orWhereRaw("lower({$column}) like ? escape '!'", [$pattern]);
                }
            });
        }
        $paginator = $query->select(['no_fakturpenjualan', 'nm_cs', 'ref_po', 'tgl_doc', 'jth_tempo', 'g_total', 'total_bayaran', 'saldo_piutang'])
            ->selectRaw("{$effectiveDue} as effective_due_date", [$date])
            ->selectRaw("datediff(?, {$effectiveDue}) as umur_tempo", [$date, $date])
            ->orderBy('effective_due_date')->orderBy('no_fakturpenjualan')->orderBy('kd_cs')
            ->paginate((int) ($filters['per_page'] ?? 5), ['*'], 'page', (int) ($filters['page'] ?? 1));

        return response()->json($paginator)->header('Cache-Control', 'no-store');
    }

    private function analyticsInvoices(string $date): Builder
    {
        $due = $this->agingDateExpr('jth_tempo');
        $document = $this->agingDateExpr('tgl_doc');
        $effectiveDue = "coalesce({$due}, date_add({$document}, interval 30 day), ?)";

        return $this->baseInvoiceQuery()->select(['no_fakturpenjualan', 'nm_cs', 'ref_po', 'tgl_doc', 'jth_tempo'])
            ->selectRaw($this->balanceExpr().' as saldo_piutang')
            ->selectRaw('coalesce(cast(g_total as decimal(18,4)), 0) as g_total, coalesce(cast(total_bayaran as decimal(18,4)), 0) as total_bayaran')
            ->selectRaw("{$effectiveDue} as effective_due_date", [$date])
            ->selectRaw("datediff(?, {$effectiveDue}) as umur_tempo", [$date, $date]);
    }

    public function portfolioDetails(Request $request, CollectionDetailQuery $details)
    {
        $filters = $request->validate([
            'type' => ['required', Rule::in(['risk', 'cashflow'])],
            'tier' => ['required_if:type,risk', 'nullable', Rule::in(['critical_risk', 'high_risk', 'moderate_risk', 'low_risk'])],
            'horizon' => ['required_if:type,cashflow', 'nullable', 'integer', Rule::in([7, 14, 30])],
            'reference_date' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in([5, 10, 25, 50, 100])],
            'search' => ['nullable', 'string', 'max:200'],
        ]);
        $invoices = $this->analyticsInvoices($filters['reference_date'] ?? Carbon::today()->toDateString());
        $risk = $filters['type'] === 'risk';
        $query = $risk ? $details->risk($invoices, $filters['tier']) : $details->cashflow($invoices, (int) $filters['horizon']);
        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], Str::lower($search)).'%';
            $query->where(function (Builder $matches) use ($pattern, $risk) {
                foreach ($risk ? ['nm_cs'] : ['no_fakturpenjualan', 'nm_cs', 'ref_po'] as $column) {
                    $matches->orWhereRaw("lower(cast({$column} as char)) like ? escape '!'", [$pattern]);
                }
            });
        }
        $risk ? $query->orderByDesc('default_prob')->orderByDesc('total_saldo')->orderBy('nm_cs')
            : $query->orderByDesc('expected_recovery')->orderBy('effective_due_date')->orderBy('no_fakturpenjualan')->orderBy('nm_cs');

        return response()->json($query->paginate((int) ($filters['per_page'] ?? 5), ['*'], 'page', (int) ($filters['page'] ?? 1)))
            ->header('Cache-Control', 'no-store');
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
                'analysis_version' => CollectionAnalyticsService::ANALYSIS_VERSION,
                'tenant' => [$connection->getName(), $connection->getDatabaseName()],
                'reference_date' => Carbon::today()->toDateString(),
                'scope' => $scope, 'overdue_range' => $overdueRange, 'customer' => $customer,
                'invoices' => $invoices,
            ], JSON_THROW_ON_ERROR));
            if (! $request->boolean('force')) {
                try {
                    $cachedResult = Cache::get($cacheKey);
                    if (is_array($cachedResult)) {
                        return response()->json(array_merge($cachedResult, ['cached' => true]));
                    }
                } catch (\Throwable) {
                    // Ignore cache read failures if cache store unavailable
                }
            }

            $result = $analyticsService->analyzeCollections($invoices, Carbon::today()->toDateString());

            if (! empty($result['success'])) {
                try {
                    Cache::put($cacheKey, $result, now()->addMinutes(15));
                } catch (\Throwable) {
                    // Ignore cache write failures if cache store unavailable
                }
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
