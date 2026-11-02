<?php

namespace App\Http\Controllers\Marketing;

use App\Events\PurchaseOrderInChanged;
use App\Services\Marketing\PurchaseOrderInService;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Throwable;

class PurchaseOrderInController
{
    /** @var \WeakMap<Connection, array<string, array<string, array<string, string>>>> */
    private \WeakMap $columnCache;

    public function __construct(
        private PurchaseOrderInService $purchaseOrderInService
    ) {
        $this->columnCache = new \WeakMap;
    }

    private function broadcastPoInChanged(): void
    {
        try {
            event(new PurchaseOrderInChanged(PurchaseOrderInChanged::currentChannel()));
        } catch (Throwable $exception) {
            // A socket outage must not report an already committed write as failed.
            report($exception);
        }
    }

    public function export(Request $request)
    {
        $statusFilter = $request->query('status', 'outstanding_do');
        $dateFilter = $request->query('date_filter', 'all');
        $deadlineFilter = $request->query('deadline_filter', 'all');
        $startDate = $request->query('start_date', '');
        $endDate = $request->query('end_date', '');

        $prefix = $this->resolveDatabasePrefix($request);

        $data = $this->getPurchaseOrderInData(
            '',           // search
            null,         // perPage
            $statusFilter,
            1,            // page
            false,        // isPartial
            false,        // summaryOnly
            'all',        // summaryScope
            true,         // rowsOnly
            false,        // paginationOnly
            $dateFilter,
            $startDate,
            $endDate,
            $prefix,
            $deadlineFilter
        );

        $kodePoins = collect($data['purchaseOrderIns'] ?? [])->pluck('kode_poin')->filter()->values();

        $purchaseOrders = collect();
        $detailsByDocument = collect();

        if ($kodePoins->isNotEmpty()) {
            $purchaseOrders = $this->readMysql(function ($conn) use ($kodePoins) {
                return $conn->table('tb_poin')
                    ->whereIn('kode_poin', $kodePoins->all())
                    ->orderByDesc('created_at')
                    ->orderByDesc('kode_poin')
                    ->get();
            });

            $orderKodePoins = collect($purchaseOrders)->pluck('kode_poin')->filter()->values();

            if ($orderKodePoins->isNotEmpty()) {
                $detailsByDocument = $this->readMysql(function ($conn) use ($orderKodePoins) {
                    return $conn->table('tb_detailpoin')
                        ->whereIn('kode_poin', $orderKodePoins->all())
                        ->orderBy('id')
                        ->get()
                        ->groupBy('kode_poin');
                });
            }
        }

        $exportRows = collect($purchaseOrders)->map(function ($purchaseOrder) use ($detailsByDocument) {
            $purchaseOrder = (object) $purchaseOrder;

            foreach (['ppn_input_percent', 'total_price', 'ppn_amount', 'grand_total'] as $column) {
                $purchaseOrder->{$column} = (float) ($purchaseOrder->{$column} ?? 0);
            }

            $details = collect($detailsByDocument->get($purchaseOrder->kode_poin, collect()));

            $purchaseOrder->details = $details
                ->map(function ($detail) {
                    $detail = (object) $detail;

                    foreach (['qty', 'price_po_in', 'total_price_po_in', 'sisa_qtypr', 'sisa_qtydo'] as $column) {
                        $detail->{$column} = (float) ($detail->{$column} ?? 0);
                    }

                    if ($detail->price_po_in <= 0 && $detail->qty > 0 && $detail->total_price_po_in > 0) {
                        $detail->price_po_in = $detail->total_price_po_in / $detail->qty;
                    } elseif ($detail->total_price_po_in <= 0 && $detail->qty > 0 && $detail->price_po_in > 0) {
                        $detail->total_price_po_in = $detail->qty * $detail->price_po_in;
                    }

                    return $detail;
                })
                ->values();

            if ($purchaseOrder->total_price <= 0 && $purchaseOrder->details->isNotEmpty()) {
                $purchaseOrder->total_price = (float) $purchaseOrder->details->sum('total_price_po_in');
                if ($purchaseOrder->grand_total <= 0) {
                    $ppnPercent = (float) ($purchaseOrder->ppn_input_percent ?? 0);
                    $ppnValue = round($purchaseOrder->total_price * (min(11.0, max(0.0, $ppnPercent)) / 100), 2);
                    $purchaseOrder->ppn_amount = $ppnValue;
                    $purchaseOrder->grand_total = $purchaseOrder->total_price + $ppnValue;
                }
            }

            return $purchaseOrder;
        });

        return Inertia::render('marketing/purchase-order-in/export', [
            'purchaseOrders' => $exportRows,
            'startDate' => $startDate ?: now()->toDateString(),
            'endDate' => $endDate ?: now()->toDateString(),
        ]);
    }

    private string $readSource = 'mysql';

    private function readMysql(callable $callback)
    {
        return $callback(DB::connection());
    }

    private function formatFailureMessage(string $action, Throwable $e): string
    {
        $type = $e instanceof QueryException ? 'Error SQL/database' : 'Error sistem';
        $detail = trim($e->getMessage());

        return "Gagal {$action} data PO In. {$type}: ".($detail !== '' ? $detail : 'Tidak ada detail error dari server.');
    }

    private function exceptionStatus(Throwable $exception): int
    {
        $code = (int) $exception->getCode();

        return in_array($code, [400, 404, 409, 422], true) ? $code : 500;
    }

    private function activeTenantDatabase(?Request $request = null): string
    {
        $request ??= request();
        $connection = config('tenants.connection', config('database.default'));

        $database = (string) (
            DB::connection($connection)->getDatabaseName()
            ?: $request->session()->get('tenant.database')
            ?: $request->cookie('tenant_database')
            ?: ''
        );

        $allowed = config('tenants.databases', []);
        if ($database !== '' && in_array($database, $allowed, true)) {
            return $database;
        }

        $fallback = (string) config("database.connections.$connection.database", '');

        return in_array($fallback, $allowed, true) ? $fallback : $database;
    }

    private function resolveDatabasePrefix(Request $request): string
    {
        $database = $this->activeTenantDatabase($request);
        $configuredPrefix = config("tenants.company_codes.$database");

        if (is_string($configuredPrefix) && trim($configuredPrefix) !== '') {
            return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $configuredPrefix));
        }

        $prefix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', preg_replace('/^db/i', '', $database)));

        if ($prefix === 'B3S') {
            $prefix = 'BBBS';
        }

        return $prefix !== '' ? $prefix : 'SYS';
    }

    private function firstExistingColumn(string $table, array $columns, string $fallback): string
    {
        $available = $this->columnsForTable($table);
        foreach ($columns as $column) {
            if (isset($available[strtolower($column)])) {
                return $available[strtolower($column)];
            }
        }

        return $fallback;
    }

    private function columnsForTable(string $table): array
    {
        $connection = DB::connection();
        $databases = $this->columnCache[$connection] ?? [];
        $database = $connection->getDatabaseName();
        if (! isset($databases[$database][$table])) {
            $columns = $connection->getSchemaBuilder()->getColumnListing($table);
            $databases[$database][$table] = array_change_key_case(array_combine($columns, $columns), CASE_LOWER);
            $this->columnCache[$connection] = $databases;
        }

        return $databases[$database][$table];
    }

    private function barangStockTotalExpression(string $alias = ''): string
    {
        $prefix = $alias !== '' ? $alias.'.' : '';

        return "(
            coalesce(cast({$prefix}stok_g1 as decimal(65,4)), 0) +
            coalesce(cast({$prefix}stok_g2 as decimal(65,4)), 0) +
            coalesce(cast({$prefix}stok_g3 as decimal(65,4)), 0) +
            coalesce(cast({$prefix}stok_g4 as decimal(65,4)), 0)
        )";
    }

    public function ocrUpload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg|max:5120',
        ]);

        try {
            $file = $request->file('file');

            $cfile = new \CURLFile(
                $file->getPathname(),
                $file->getClientMimeType(),
                $file->getClientOriginalName()
            );

            set_time_limit(180);
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'http://127.0.0.1:8020/scan-po');
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 180);

            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($curlErr) {
                Log::error('OCR cURL error: '.$curlErr);

                return response()->json(['error' => 'Gagal menghubungi ML service: '.$curlErr], 500);
            }

            if ($httpCode === 200 && $result) {
                return response()->json(json_decode($result, true));
            }

            $errorMsg = 'ML API error (Status '.$httpCode.')';
            if ($result) {
                $parsed = json_decode($result, true);
                if (is_array($parsed) && isset($parsed['detail'])) {
                    $errorMsg = $parsed['detail'];
                }
            }

            Log::error('OCR ML API error: status='.$httpCode.' body='.$result);

            return response()->json(['error' => $errorMsg], 500);

        } catch (Throwable $e) {
            Log::error('OCR Error: '.$e->getMessage());

            return response()->json(['error' => 'Error: '.$e->getMessage()], 500);
        }
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all' ? null : (is_numeric($perPageInput) ? max(1, (int) $perPageInput) : 5);
        $statusFilter = $request->query('status', 'outstanding_do');
        $dateFilter = $request->query('date_filter', 'all');
        $deadlineFilter = $request->query('deadline_filter', 'all');
        $page = max(1, (int) $request->query('page', 1));

        return Inertia::render('marketing/purchase-order-in/index', [
            'realtimeChannel' => PurchaseOrderInChanged::currentChannel(),
            'purchaseOrderIns' => [],
            'summary' => [
                'total' => 0,
                'total_amount' => 0,
                'outstanding' => 0,
                'belum_pr' => 0,
                'realized' => 0,
                'data_counts' => [
                    'today' => 0, 'week' => 0, 'month' => 0, 'year' => 0,
                ],
                'data_amounts' => [
                    'today' => 0, 'week' => 0, 'month' => 0, 'year' => 0, 'all' => 0,
                ],
            ],
            'outstandingPurchaseOrderIns' => [],
            'belumPrPurchaseOrderIns' => [],
            'realizedPurchaseOrderIns' => [],
            'filters' => [
                'search' => $search,
                'per_page' => $perPage === null ? 'all' : (string) $perPage,
                'page' => $page,
                'status' => $statusFilter,
                'date_filter' => $dateFilter,
                'deadline_filter' => $deadlineFilter,
            ],
            'pagination' => [
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage === null ? 'all' : $perPage,
                'total_pages' => 1,
            ],
        ]);
    }

    public function data(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all' ? null : (is_numeric($perPageInput) ? max(1, (int) $perPageInput) : 5);
        $statusFilter = $request->query('status', 'all');
        $page = max(1, (int) $request->query('page', 1));
        $isPartial = $request->boolean('is_partial', false);
        $summaryOnly = $request->boolean('summary_only', false);
        $summaryScope = (string) $request->query('summary_scope', 'all');
        $rowsOnly = $request->boolean('rows_only', false);
        $paginationOnly = $request->boolean('pagination_only', false);
        $dateFilter = (string) $request->query('date_filter', 'all');
        $startDate = (string) $request->query('start_date', '');
        $endDate = (string) $request->query('end_date', '');
        $deadlineFilter = (string) $request->query('deadline_filter', 'all');

        $prefix = $this->resolveDatabasePrefix($request);
        $data = $this->getPurchaseOrderInData(
            $search,
            $perPage,
            $statusFilter,
            $page,
            $isPartial,
            $summaryOnly,
            $summaryScope,
            $rowsOnly,
            $paginationOnly,
            $dateFilter,
            $startDate,
            $endDate,
            $prefix,
            $deadlineFilter
        );
        $data['applied_filters'] = [
            'search' => $search,
            'status' => $statusFilter,
            'date_filter' => $dateFilter,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'deadline_filter' => $deadlineFilter,
            'page' => $page,
            'per_page' => $perPageInput,
        ];

        return response()->json($data)->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'X-Data-Source' => $this->readSource,
        ]);
    }

    public function materialData(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all' ? null : (is_numeric($perPageInput) ? max(1, (int) $perPageInput) : 5);
        $statusFilter = (string) $request->query('status', 'all');
        $dateFilter = (string) $request->query('date_filter', 'all');
        $startDate = (string) $request->query('start_date', '');
        $endDate = (string) $request->query('end_date', '');
        $deadlineFilter = (string) $request->query('deadline_filter', 'all');
        $page = max(1, (int) $request->query('page', 1));

        $data = $this->getPurchaseOrderInMaterialData(
            $search,
            $perPage,
            $statusFilter,
            $page,
            $dateFilter,
            $startDate,
            $endDate,
            $this->resolveDatabasePrefix($request),
            $deadlineFilter,
        );
        $data['applied_filters'] = [
            'search' => $search,
            'status' => $statusFilter,
            'date_filter' => $dateFilter,
            'deadline_filter' => $deadlineFilter,
        ];

        return response()->json($data)->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'X-Data-Source' => $this->readSource,
        ]);
    }

    private function poinNumericSql($connection, string $column): string
    {
        return "cast(nullif(trim({$column}), '') as decimal(18,4))";
    }

    private function applyCreatedDateFilter($query, string $filter, string $startDate, string $endDate): void
    {
        $now = now();
        $bounds = match ($filter) {
            'today' => [$now->copy()->startOfDay(), $now->copy()->addDay()->startOfDay()],
            'this_week' => [$now->copy()->startOfWeek(), $now->copy()->startOfWeek()->addWeek()],
            'this_month' => [$now->copy()->startOfMonth(), $now->copy()->startOfMonth()->addMonth()],
            'this_year' => [$now->copy()->startOfYear(), $now->copy()->startOfYear()->addYear()],
            'range' => $startDate !== '' && $endDate !== ''
                ? [Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->addDay()->startOfDay()]
                : null,
            default => null,
        };

        if ($bounds !== null) {
            $query->where('p.created_at', '>=', $bounds[0])
                ->where('p.created_at', '<', $bounds[1]);
        } elseif ($filter === 'range') {
            $query->whereRaw('1 = 0');
        }
    }

    private function applyDeliveryDeadlineOrder($query, string $tieBreaker = 'p.id')
    {
        return $query
            // Deadline yang terlewat diletakkan lebih dahulu, lalu diurutkan
            // berdasarkan jumlah hari keterlambatan terbesar. Deadline mendatang
            // tetap dimulai dari yang terdekat dan tanggal kosong selalu terakhir.
            ->orderByRaw('case when p.delivery_date is null then 2 when p.delivery_date <= current_date() then 0 else 1 end')
            ->orderByRaw('case when p.delivery_date <= current_date() then datediff(current_date(), p.delivery_date) else null end desc')
            ->orderBy('p.delivery_date')
            ->orderByDesc($tieBreaker);
    }

    private function applyNewestInputOrder(
        $query,
        string $createdAtColumn = 'p.created_at',
        string $idColumn = 'p.id',
    ) {
        return $query
            ->orderByDesc($createdAtColumn)
            ->orderByDesc($idColumn);
    }

    private function poinDateSql($connection, string $column): string
    {
        return "coalesce(date({$column}), str_to_date({$column}, '%Y-%m-%d'), str_to_date({$column}, '%Y/%m/%d'), str_to_date({$column}, '%d/%m/%Y'), str_to_date({$column}, '%d-%m-%Y'), str_to_date({$column}, '%d.%m.%Y'))";
    }

    private function applyRealizedDateFilter($query, string $dateExpression, string $filter, string $startDate, string $endDate): void
    {
        $now = now();
        $bounds = match ($filter) {
            'today' => [$now->copy()->toDateString(), $now->copy()->toDateString()],
            'this_week' => [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()],
            'this_month' => [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()],
            'this_year' => [$now->copy()->startOfYear()->toDateString(), $now->copy()->endOfYear()->toDateString()],
            'range' => $startDate !== '' && $endDate !== '' ? [$startDate, $endDate] : null,
            default => null,
        };

        if ($bounds !== null) {
            $query->whereRaw("{$dateExpression} between ? and ?", $bounds);
        } elseif ($filter === 'range') {
            $query->whereRaw('1 = 0');
        }
    }

    private function getRealizedSummaryFromConnection(
        $connection,
        string $summaryScope,
        string $dateFilter,
        string $startDate,
        string $endDate,
        string $prefix,
    ): array {
        $qty = $this->poinNumericSql($connection, 'qty');
        $sisaPr = $this->poinNumericSql($connection, 'sisa_qtypr');
        $sisaDo = $this->poinNumericSql($connection, 'sisa_qtydo');
        $detailStats = $connection->table('tb_detailpoin')
            ->where('kode_poin', 'like', $prefix.'.POIN-%')
            ->select('kode_poin')
            ->selectRaw('count(*) as total_items')
            ->selectRaw("sum(case when coalesce({$sisaPr}, {$qty}, 0) > 0 then 1 else 0 end) as unrealized_items")
            ->selectRaw("sum(case when coalesce({$sisaDo}, {$qty}, 0) > 0 then 1 else 0 end) as do_unrealized_items")
            ->groupBy('kode_poin');
        $poinNumber = 'CONVERT(p.no_poin USING latin1)';
        $summary = [];

        if (in_array($summaryScope, ['realized', 'realized_do'], true)) {
            // Hitung penyelesaian dari qty pengiriman per referensi dan material.
            $requiredMaterial = 'required_line.kd_material';
            $requiredQty = $this->poinNumericSql($connection, 'required_line.qty');
            $requiredLines = $connection->table('tb_detailpoin as required_line')
                ->where('required_line.kode_poin', 'like', $prefix.'.POIN-%')
                ->select('required_line.kode_poin')
                ->selectRaw("{$requiredMaterial} as material_key")
                ->selectRaw("sum(coalesce({$requiredQty}, 0)) as required_qty")
                ->groupBy('required_line.kode_poin')
                ->groupByRaw($requiredMaterial);

            $deliveredReference = 'delivered_line.ref_po';
            $deliveredMaterial = 'delivered_line.kd_mat';
            $deliveredQty = $this->poinNumericSql($connection, 'delivered_line.qty');
            $deliveredLines = $connection->table('tb_do as delivered_line')
                ->where('delivered_line.ref_po', '<>', '')
                ->selectRaw("{$deliveredReference} as ref_po_key")
                ->selectRaw("{$deliveredMaterial} as material_key")
                ->selectRaw("sum(coalesce({$deliveredQty}, 0)) as delivered_qty")
                ->groupByRaw($deliveredReference)
                ->groupByRaw($deliveredMaterial);

            $doCompletionStats = $connection->query()->fromSub($requiredLines, 'required')
                ->join('tb_poin as completion_poin', 'completion_poin.kode_poin', '=', 'required.kode_poin')
                ->leftJoinSub($deliveredLines, 'delivered', function ($join) {
                    $join->on('delivered.ref_po_key', '=', DB::raw('CONVERT(completion_poin.no_poin USING latin1)'));
                    $join->on('delivered.material_key', '=', DB::raw('CONVERT(required.material_key USING latin1)'));
                })
                ->select('required.kode_poin')
                ->selectRaw('count(*) as total_items')
                ->selectRaw('sum(case when coalesce(delivered.delivered_qty, 0) < required.required_qty then 1 else 0 end) as do_unrealized_items')
                ->groupBy('required.kode_poin');

            $doDate = $this->poinDateSql($connection, 'kdo.pos_tgl');
            $doReferences = $connection->table('tb_kddo')
                ->where('ref_po', '<>', '')
                ->whereRaw("trim(coalesce(no_do, '')) <> ''")
                ->selectRaw('ref_po as ref_po_key, lower(trim(no_do)) as no_do, pos_tgl')
                ->distinct();
            $query = $connection->query()->fromSub($doReferences, 'kdo')
                ->join('tb_poin as p', function ($join) use ($prefix, $poinNumber) {
                    $join->where('p.kode_poin', 'like', $prefix.'.POIN-%');
                    $join->whereRaw("kdo.ref_po_key = {$poinNumber}");
                })
                ->joinSub($doCompletionStats, 'do_ds', 'do_ds.kode_poin', '=', 'p.kode_poin')
                ->whereRaw('coalesce(do_ds.total_items, 0) > 0')
                ->whereRaw('coalesce(do_ds.do_unrealized_items, 0) = 0');
            $this->applyRealizedDateFilter($query, $doDate, $dateFilter, $startDate, $endDate);
            $row = $query->selectRaw('count(distinct lower(trim(kdo.no_do))) as realized_do')->first();
            $summary['realized_do'] = (int) ($row->realized_do ?? 0);
        }

        if (in_array($summaryScope, ['realized', 'realized_pr'], true)) {
            $prDate = $this->poinDateSql($connection, 'dpr.date');
            $prReferences = $connection->table('tb_detailpr')
                ->where('ref_po', '<>', '')
                ->where('no_pr', '<>', '')
                ->selectRaw('ref_po as ref_po_key, date')
                ->distinct();
            $query = $connection->query()->fromSub($prReferences, 'dpr')
                ->join('tb_poin as p', function ($join) use ($prefix) {
                    $join->where('p.kode_poin', 'like', $prefix.'.POIN-%');
                    $join->whereRaw('dpr.ref_po_key = CONVERT(p.no_poin USING latin1)');
                })
                ->joinSub($detailStats, 'pr_ds', 'pr_ds.kode_poin', '=', 'p.kode_poin')
                ->whereRaw('coalesce(pr_ds.total_items, 0) > 0')
                ->whereRaw('coalesce(pr_ds.unrealized_items, 0) = 0');
            $this->applyRealizedDateFilter($query, $prDate, $dateFilter, $startDate, $endDate);
            $row = $query->selectRaw('count(distinct lower(trim(p.kode_poin))) as realized_pr')->first();
            $summary['realized_pr'] = (int) ($row->realized_pr ?? 0);
        }

        return ['summary' => $summary];
    }

    private function getPurchaseOrderInMaterialData(
        string $search,
        ?int $perPage,
        string $statusFilter,
        int $page,
        string $dateFilter,
        string $startDate,
        string $endDate,
        string $prefix,
        string $deadlineFilter,
        $readConnection = null,
    ): array {
        $readConnection ??= DB::connection();
        $todaySql = 'current_date()';
        $soonSql = 'date_add(current_date(), interval 5 day)';
        $qtyValue = $this->poinNumericSql($readConnection, 'd.qty');
        $prValue = $this->poinNumericSql($readConnection, 'd.sisa_qtypr');
        $doValue = $this->poinNumericSql($readConnection, 'd.sisa_qtydo');
        $qty = "coalesce({$qtyValue}, 0)";
        $sisaPr = "coalesce({$prValue}, {$qty})";
        $sisaDo = "coalesce({$doValue}, {$qty})";
        $query = $readConnection->table('tb_detailpoin as d')
            ->join('tb_poin as p', 'p.kode_poin', '=', 'd.kode_poin')
            ->where(function ($q) use ($prefix) {
                $q->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                    ->orWhere('p.kode_poin', 'like', '%.POIN-%')
                    ->orWhere('p.kode_poin', 'like', 'POIN-%');
            })
            ->select(
                'd.id',
                'd.kode_poin',
                'd.no_poin',
                'p.customer_name',
                'd.material',
                'd.qty',
                'd.sisa_qtypr',
                'd.sisa_qtydo',
                'p.created_at',
                'p.delivery_date',
            );

        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('lower(d.no_poin) like ?', [$like])
                    ->orWhereRaw('lower(d.material) like ?', [$like]);
            });
        }

        if ($statusFilter === 'outstanding_pr') {
            $query->whereRaw("{$sisaPr} = {$qty}");
        } elseif ($statusFilter === 'outstanding_do') {
            $query->whereRaw("{$sisaDo} = {$qty}");
        } elseif ($statusFilter === 'sisa_pr') {
            $query->whereRaw("{$sisaPr} > 0 and {$sisaPr} <> {$qty}");
        } elseif ($statusFilter === 'sisa_do') {
            $query->whereRaw("{$sisaDo} > 0 and {$sisaDo} <> {$qty}");
        } elseif ($statusFilter === 'realized_pr') {
            $query->whereRaw("{$sisaPr} = 0");
        } elseif ($statusFilter === 'realized_do') {
            $query->whereRaw("{$sisaDo} = 0");
        }

        $now = now();
        if ($statusFilter === 'realized_do') {
            $doDateExpression = "str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')";
            $query->join('tb_kddo as kdo', function ($join) {
                $join->on('kdo.ref_po', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
            })
                ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                ->distinct();

            if ($dateFilter === 'today') {
                $query->whereRaw("{$doDateExpression} between ? and ?", [$now->copy()->toDateString(), $now->copy()->toDateString()]);
            } elseif ($dateFilter === 'this_week') {
                $query->whereRaw("{$doDateExpression} between ? and ?", [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()]);
            } elseif ($dateFilter === 'this_month') {
                $query->whereRaw("{$doDateExpression} between ? and ?", [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()]);
            } elseif ($dateFilter === 'this_year') {
                $query->whereRaw("{$doDateExpression} between ? and ?", [$now->copy()->startOfYear()->toDateString(), $now->copy()->endOfYear()->toDateString()]);
            } elseif ($dateFilter === 'range') {
                if ($startDate !== '' && $endDate !== '') {
                    $query->whereRaw("date({$doDateExpression}) between ? and ?", [$startDate, $endDate]);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        } elseif ($statusFilter === 'realized_pr') {
            $prDateExpression = "case when trim(dpr.date) like '__.__.____' then str_to_date(trim(dpr.date), '%d.%m.%Y') else str_to_date(trim(dpr.date), '%Y-%m-%d') end";
            $query->join('tb_detailpr as dpr', function ($join) {
                $join->on('dpr.ref_po', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
            })
                ->where('dpr.no_pr', '<>', '')
                ->distinct();

            if ($dateFilter === 'today') {
                $query->whereRaw("{$prDateExpression} between ? and ?", [$now->copy()->toDateString(), $now->copy()->toDateString()]);
            } elseif ($dateFilter === 'this_week') {
                $query->whereRaw("{$prDateExpression} between ? and ?", [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()]);
            } elseif ($dateFilter === 'this_month') {
                $query->whereRaw("{$prDateExpression} between ? and ?", [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()]);
            } elseif ($dateFilter === 'this_year') {
                $query->whereRaw("{$prDateExpression} between ? and ?", [$now->copy()->startOfYear()->toDateString(), $now->copy()->endOfYear()->toDateString()]);
            } elseif ($dateFilter === 'range') {
                if ($startDate !== '' && $endDate !== '') {
                    $query->whereRaw("date({$prDateExpression}) between ? and ?", [$startDate, $endDate]);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        } else {
            $this->applyCreatedDateFilter($query, $dateFilter, $startDate, $endDate);
        }

        $deadline = 'p.delivery_date';
        if ($deadlineFilter === 'overdue') {
            $query->whereRaw("{$deadline} <= {$todaySql}");
        } elseif ($deadlineFilter === 'soon') {
            $query->whereRaw("{$deadline} > {$todaySql} and {$deadline} <= {$soonSql}");
        }

        // DISTINCT material rows must also be counted distinctly when PR/DO joins multiply them.
        $total = $perPage === null ? null : (clone $query)->count('d.id');

        if (in_array($statusFilter, ['outstanding_pr', 'outstanding_do', 'sisa_pr', 'sisa_do'])) {
            $this->applyDeliveryDeadlineOrder($query, 'd.id');
        } else {
            $query->orderByDesc('d.id');
        }

        $rows = $perPage === null
            ? $query->get()
            : $query->forPage($page, $perPage)->get();
        $total ??= $rows->count();

        return [
            'materials' => $rows,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage === null ? 'all' : $perPage,
                'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    private function getPurchaseOrderInData(
        $search,
        $perPage,
        $statusFilter,
        $page,
        $isPartial = false,
        $summaryOnly = false,
        $summaryScope = 'all',
        $rowsOnly = false,
        $paginationOnly = false,
        $dateFilter = 'today',
        $startDate = '',
        $endDate = '',
        $prefix = '',
        $deadlineFilter = 'all',
        $readConnection = null
    ) {
        $readConnection ??= DB::connection();

        return (function () use ($search, $perPage, $statusFilter, $page, $isPartial, $summaryOnly, $summaryScope, $rowsOnly, $paginationOnly, $dateFilter, $startDate, $endDate, $prefix, $deadlineFilter, $readConnection) {
            $todaySql = 'current_date()';
            $soonSql = 'date_add(current_date(), interval 5 day)';
            // Kartu Total PO In hanya menghitung dokumen header dan grand total. Jalankan
            // sebelum statistik status dibuat agar query ini murni ke tb_poin memakai index.
            if ($summaryOnly && $summaryScope === 'total') {
                $now = now();
                $startToday = $now->copy()->startOfDay()->toDateTimeString();
                $startWeek = $now->copy()->startOfWeek()->toDateTimeString();
                $startMonth = $now->copy()->startOfMonth()->toDateTimeString();
                $startYear = $now->copy()->startOfYear()->toDateTimeString();

                return $this->readMysql(function ($conn) use ($prefix, $dateFilter, $startDate, $endDate, $startToday, $startWeek, $startMonth, $startYear) {
                    $query = $conn->table('tb_poin')
                        ->where('kode_poin', 'like', $prefix.'.POIN-%');

                    if ($dateFilter === 'range' && $startDate !== '' && $endDate !== '') {
                        $periodCounts = (clone $query)
                            ->where('created_at', '>=', $startDate.' 00:00:00')
                            ->where('created_at', '<', Carbon::parse($endDate)->addDay()->startOfDay())
                            ->selectRaw('count(*) as count, coalesce(sum(grand_total), 0) as total_amount')
                            ->first();

                        return [
                            'summary' => [
                                'total' => (int) ($periodCounts->count ?? 0),
                                'total_amount' => (float) ($periodCounts->total_amount ?? 0),
                                'data_counts' => [
                                    'today' => 0,
                                    'week' => 0,
                                    'month' => 0,
                                    'year' => 0,
                                    'range' => (int) ($periodCounts->count ?? 0),
                                ],
                                'data_amounts' => [
                                    'today' => 0,
                                    'week' => 0,
                                    'month' => 0,
                                    'year' => 0,
                                    'range' => (float) ($periodCounts->total_amount ?? 0),
                                    'all' => (float) ($periodCounts->total_amount ?? 0),
                                ],
                            ],
                        ];
                    }

                    $periodCounts = (clone $query)
                        ->selectRaw('count(*) as total')
                        ->selectRaw('coalesce(sum(grand_total), 0) as total_amount')
                        ->selectRaw('count(case when created_at >= ? then 1 end) as today', [$startToday])
                        ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_today', [$startToday])
                        ->selectRaw('count(case when created_at >= ? then 1 end) as week', [$startWeek])
                        ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_week', [$startWeek])
                        ->selectRaw('count(case when created_at >= ? then 1 end) as month', [$startMonth])
                        ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_month', [$startMonth])
                        ->selectRaw('count(case when created_at >= ? then 1 end) as year', [$startYear])
                        ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_year', [$startYear])
                        ->first();

                    return [
                        'summary' => [
                            'total' => (int) ($periodCounts->total ?? 0),
                            'total_amount' => (float) ($periodCounts->total_amount ?? 0),
                            'data_counts' => [
                                'today' => (int) ($periodCounts->today ?? 0),
                                'week' => (int) ($periodCounts->week ?? 0),
                                'month' => (int) ($periodCounts->month ?? 0),
                                'year' => (int) ($periodCounts->year ?? 0),
                            ],
                            'data_amounts' => [
                                'today' => (float) ($periodCounts->amount_today ?? 0),
                                'week' => (float) ($periodCounts->amount_week ?? 0),
                                'month' => (float) ($periodCounts->amount_month ?? 0),
                                'year' => (float) ($periodCounts->amount_year ?? 0),
                                'all' => (float) ($periodCounts->total_amount ?? 0),
                            ],
                        ],
                    ];
                });
            }

            if ($summaryOnly && in_array($summaryScope, ['realized', 'realized_pr', 'realized_do'], true)) {
                return $this->getRealizedSummaryFromConnection(
                    $readConnection,
                    $summaryScope,
                    $dateFilter,
                    $startDate,
                    $endDate,
                    $prefix,
                );
            }

            // Filter "Semua Data" tidak membutuhkan status turunan dari detail,
            // PR, atau DO. Tangani lebih awal agar request tabel hanya membaca
            // tb_poin dan tidak membangun/menjalankan subquery join yang mahal.
            $applyDeadlineFilter = function ($query) use ($deadlineFilter, $todaySql, $soonSql) {
                if ($deadlineFilter === 'overdue') {
                    $query->whereRaw("p.delivery_date <= {$todaySql}");
                } elseif ($deadlineFilter === 'soon') {
                    $query->whereRaw("p.delivery_date > {$todaySql} and p.delivery_date <= {$soonSql}");
                }
            };

            if ($statusFilter === 'all' && ! $summaryOnly) {
                $now = now();
                $query = $readConnection->table('tb_poin as p')
                    ->where(function ($q) use ($prefix) {
                        $q->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                            ->orWhere('p.kode_poin', 'like', '%.POIN-%')
                            ->orWhere('p.kode_poin', 'like', 'POIN-%');
                    })
                    ->select(
                        'p.id',
                        'p.kode_poin',
                        'p.no_poin',
                        'p.date_poin',
                        'p.created_at',
                        'p.delivery_date',
                        'p.customer_name',
                        'p.grand_total'
                    )
                    ->selectRaw('0 as has_do');

                if ($search !== '') {
                    $like = '%'.strtolower($search).'%';
                    $query->where(function ($q) use ($like) {
                        $q->whereRaw('lower(p.kode_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.no_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.customer_name) like ?', [$like]);
                    });
                }

                $this->applyCreatedDateFilter($query, $dateFilter, $startDate, $endDate);

                $applyDeadlineFilter($query);

                $total = $rowsOnly ? null : (clone $query)->count();
                $rows = $paginationOnly
                    ? collect()
                    : (function () use ($query, $perPage, $page) {
                        $orderedQuery = $this->applyNewestInputOrder(clone $query);

                        return $perPage === null
                            ? $orderedQuery->get()
                            : $orderedQuery->forPage($page, $perPage)->get();
                    })();

                $pagination = [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage === null ? 'all' : $perPage,
                    'total_pages' => $perPage === null ? 1 : max(1, (int) ceil(($total ?? 0) / $perPage)),
                ];

                if ($isPartial || $rowsOnly) {
                    $response = [];
                    if (! $paginationOnly) {
                        $response['purchaseOrderIns'] = $rows;
                    }
                    if (! $rowsOnly) {
                        $response['pagination'] = $pagination;
                    }

                    return $response;
                }

                return [
                    'purchaseOrderIns' => $rows,
                    'pagination' => $pagination,
                ];
            }

            $sisaPrCondition = '(coalesce(ds.sisa_pr_items, 0) > 0 or (coalesce(ds.changed_count, 0) > 0 and coalesce(ds.unrealized_items, 0) > 0))';
            $sisaDoCondition = '(coalesce(ds.sisa_do_items, 0) > 0 or (coalesce(ds.do_changed_count, 0) > 0 and coalesce(ds.do_unrealized_items, 0) > 0))';

            $qtyValue = $this->poinNumericSql($readConnection, 'qty');
            $prValue = $this->poinNumericSql($readConnection, 'sisa_qtypr');
            $doValue = $this->poinNumericSql($readConnection, 'sisa_qtydo');
            $priceValue = $this->poinNumericSql($readConnection, 'price_po_in');
            $detailStats = $readConnection->table('tb_detailpoin')
                ->where('kode_poin', 'like', $prefix.'.POIN-%')
                ->select('kode_poin')
                ->selectRaw('count(*) as total_items')
                ->selectRaw("sum(case when coalesce({$prValue}, {$qtyValue}, 0) <> coalesce({$qtyValue}, 0) then 1 else 0 end) as changed_count")
                ->selectRaw("sum(case when coalesce({$prValue}, {$qtyValue}, 0) > 0 then 1 else 0 end) as unrealized_items")
                ->selectRaw("sum(case when coalesce({$prValue}, {$qtyValue}, 0) < coalesce({$qtyValue}, 0) then 1 else 0 end) as started_items")
                ->selectRaw("sum(case when coalesce({$doValue}, coalesce({$qtyValue}, 0)) <> coalesce({$qtyValue}, 0) then 1 else 0 end) as do_changed_count")
                ->selectRaw("sum(case when coalesce({$doValue}, coalesce({$qtyValue}, 0)) > 0 then 1 else 0 end) as do_unrealized_items")
                ->selectRaw("sum(case when coalesce({$doValue}, coalesce({$qtyValue}, 0)) < coalesce({$qtyValue}, 0) then 1 else 0 end) as do_started_items")
                ->selectRaw("sum(case when coalesce({$prValue}, {$qtyValue}, 0) <> coalesce({$qtyValue}, 0) and coalesce({$prValue}, {$qtyValue}, 0) <> 0 then 1 else 0 end) as sisa_pr_items")
                ->selectRaw("sum(case when coalesce({$doValue}, coalesce({$qtyValue}, 0)) <> coalesce({$qtyValue}, 0) and coalesce({$doValue}, coalesce({$qtyValue}, 0)) <> 0 then 1 else 0 end) as sisa_do_items")
                ->selectRaw("sum(coalesce({$doValue}, coalesce({$qtyValue}, 0))) as do_remaining_qty")
                ->selectRaw("sum(coalesce({$prValue}, {$qtyValue}, 0) * coalesce({$priceValue}, 0)) as pr_remaining_amount")
                ->selectRaw("sum(coalesce({$doValue}, {$qtyValue}, 0) * coalesce({$priceValue}, 0)) as do_remaining_amount")
                ->groupBy('kode_poin');

            if (($isPartial && ! $summaryOnly) || ($summaryOnly && $summaryScope !== 'all')) {
                $detailStats->columns = array_values(array_filter($detailStats->columns, function ($column) use ($summaryOnly, $summaryScope, $readConnection) {
                    $sql = is_string($column) ? $column : $column->getValue($readConnection->getQueryGrammar());
                    if (str_ends_with($sql, ' as started_items') || str_ends_with($sql, ' as do_started_items')) {
                        return false;
                    }
                    if (! $summaryOnly && (str_ends_with($sql, ' as pr_remaining_amount') || str_ends_with($sql, ' as do_remaining_amount'))) {
                        return false;
                    }
                    if ($summaryOnly && $summaryScope === 'realized' && (str_ends_with($sql, ' as pr_remaining_amount') || str_ends_with($sql, ' as do_remaining_amount'))) {
                        return false;
                    }

                    return true;
                }));
            }

            // Restrict aggregation to candidate headers before evaluating detail status.
            // Realized filters use PR/DO dates, so must not use header-created dates.
            if ($isPartial && ! $summaryOnly
                && ($dateFilter !== 'all' || $deadlineFilter !== 'all')
                && ! in_array($statusFilter, ['realized_pr', 'realized_do'], true)) {
                $candidates = $readConnection->table('tb_poin as p')->select('p.kode_poin');
                if ($search !== '') {
                    $like = '%'.strtolower($search).'%';
                    $candidates->where(function ($q) use ($like) {
                        $q->whereRaw('lower(p.kode_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.no_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.customer_name) like ?', [$like]);
                    });
                }
                $this->applyCreatedDateFilter($candidates, $dateFilter, $startDate, $endDate);
                $applyDeadlineFilter($candidates);
                $detailStats->whereIn('kode_poin', $candidates);
            }

            $doStats = $readConnection->table('tb_kddo as kdo')
                ->selectRaw('kdo.ref_po as ref_po_key')
                ->selectRaw('count(*) as do_count')
                ->selectRaw("max(str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')) as last_do_date")
                ->where('kdo.ref_po', '<>', '')
                ->groupBy('kdo.ref_po');

            $prStats = $readConnection->table('tb_poin as pr_p')->where('pr_p.kode_poin', 'like', $prefix.'.POIN-%')
                ->join('tb_detailpoin as dp', 'dp.kode_poin', '=', 'pr_p.kode_poin')
                ->join('tb_detailpr as dpr', function ($join) {
                    $join->on('dpr.ref_po', '=', DB::raw('CONVERT(dp.no_poin USING latin1)'));
                    $join->on('dpr.kd_material', '=', DB::raw('CONVERT(dp.kd_material USING latin1)'));
                })
                ->selectRaw('pr_p.no_poin as ref_po')
                ->selectRaw("max(case when dpr.date like '__.__.____' then str_to_date(dpr.date, '%d.%m.%Y') else str_to_date(dpr.date, '%Y-%m-%d') end) as last_pr_date")
                ->groupBy('pr_p.no_poin');

            $now = now();
            $startToday = $now->copy()->toDateString();
            $endToday = $now->copy()->toDateString();
            $startWeek = $now->copy()->startOfWeek()->toDateString();
            $endWeek = $now->copy()->endOfWeek()->toDateString();
            $startMonth = $now->copy()->startOfMonth()->toDateString();
            $endMonth = $now->copy()->endOfMonth()->toDateString();
            $startYear = $now->copy()->startOfYear()->toDateString();
            $endYear = $now->copy()->endOfYear()->toDateString();

            if ($summaryOnly && $summaryScope !== 'all') {
                if ($summaryScope === 'operational' || $summaryScope === 'outstanding' || $summaryScope === 'outstanding_pr' || $summaryScope === 'outstanding_do') {
                    $deadlineDateExpr = 'p.delivery_date';
                    $isOverdueExpr = "{$deadlineDateExpr} <= {$todaySql}";
                    $isSoonExpr = "{$deadlineDateExpr} > {$todaySql} and {$deadlineDateExpr} <= {$soonSql}";

                    $row = $readConnection->table('tb_poin as p')->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                        ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->selectRaw('count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then 1 end) as outstanding_pr')
                        ->selectRaw('coalesce(sum(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then p.grand_total else 0 end), 0) as outstanding_pr_amount')
                        ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isSoonExpr} then 1 end) as outstanding_pr_soon")
                        ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isOverdueExpr} then 1 end) as outstanding_pr_overdue")
                        ->selectRaw('count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then 1 end) as outstanding_do')
                        ->selectRaw('coalesce(sum(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then p.grand_total else 0 end), 0) as outstanding_do_amount')
                        ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isSoonExpr} then 1 end) as outstanding_do_soon")
                        ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isOverdueExpr} then 1 end) as outstanding_do_overdue");

                    if ($summaryScope === 'operational') {
                        $row->selectRaw("count(case when {$sisaPrCondition} then 1 end) as sisa_pr")
                            ->selectRaw("coalesce(sum(case when {$sisaPrCondition} then ds.pr_remaining_amount else 0 end), 0) as sisa_pr_amount")
                            ->selectRaw("count(case when {$sisaPrCondition} and {$isSoonExpr} then 1 end) as sisa_pr_soon")
                            ->selectRaw("count(case when {$sisaPrCondition} and {$isOverdueExpr} then 1 end) as sisa_pr_overdue")
                            ->selectRaw("count(case when {$sisaDoCondition} then 1 end) as sisa_do")
                            ->selectRaw("coalesce(sum(case when {$sisaDoCondition} then ds.do_remaining_amount else 0 end), 0) as sisa_do_amount")
                            ->selectRaw("count(case when {$sisaDoCondition} and {$isSoonExpr} then 1 end) as sisa_do_soon")
                            ->selectRaw("count(case when {$sisaDoCondition} and {$isOverdueExpr} then 1 end) as sisa_do_overdue");
                    }

                    $row = $row->first();

                    $summary = [];
                    if ($summaryScope === 'operational' || $summaryScope === 'outstanding' || $summaryScope === 'outstanding_pr') {
                        $summary['outstanding_pr'] = (int) ($row->outstanding_pr ?? 0);
                        $summary['outstanding_pr_amount'] = (float) ($row->outstanding_pr_amount ?? 0);
                        $summary['outstanding_pr_soon'] = (int) ($row->outstanding_pr_soon ?? 0);
                        $summary['outstanding_pr_overdue'] = (int) ($row->outstanding_pr_overdue ?? 0);
                    }
                    if ($summaryScope === 'operational' || $summaryScope === 'outstanding' || $summaryScope === 'outstanding_do') {
                        $summary['outstanding_do'] = (int) ($row->outstanding_do ?? 0);
                        $summary['outstanding_do_amount'] = (float) ($row->outstanding_do_amount ?? 0);
                        $summary['outstanding_do_soon'] = (int) ($row->outstanding_do_soon ?? 0);
                        $summary['outstanding_do_overdue'] = (int) ($row->outstanding_do_overdue ?? 0);
                    }
                    if ($summaryScope === 'operational') {
                        foreach (['sisa_pr', 'sisa_do'] as $metric) {
                            $summary[$metric] = (int) ($row->{$metric} ?? 0);
                            $summary["{$metric}_amount"] = (float) ($row->{"{$metric}_amount"} ?? 0);
                            $summary["{$metric}_soon"] = (int) ($row->{"{$metric}_soon"} ?? 0);
                            $summary["{$metric}_overdue"] = (int) ($row->{"{$metric}_overdue"} ?? 0);
                        }
                    }

                    return ['summary' => $summary];
                }

                if ($summaryScope === 'sisa' || $summaryScope === 'sisa_pr' || $summaryScope === 'sisa_do') {
                    $deadlineDateExpr = 'p.delivery_date';
                    $isOverdueExpr = "{$deadlineDateExpr} <= {$todaySql}";
                    $isSoonExpr = "{$deadlineDateExpr} > {$todaySql} and {$deadlineDateExpr} <= {$soonSql}";

                    $row = $readConnection->table('tb_poin as p')->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                        ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->selectRaw("count(case when {$sisaPrCondition} then 1 end) as sisa_pr")
                        ->selectRaw("coalesce(sum(case when {$sisaPrCondition} then ds.pr_remaining_amount else 0 end), 0) as sisa_pr_amount")
                        ->selectRaw("count(case when {$sisaPrCondition} and {$isSoonExpr} then 1 end) as sisa_pr_soon")
                        ->selectRaw("count(case when {$sisaPrCondition} and {$isOverdueExpr} then 1 end) as sisa_pr_overdue")
                        ->selectRaw("count(case when {$sisaDoCondition} then 1 end) as sisa_do")
                        ->selectRaw("coalesce(sum(case when {$sisaDoCondition} then ds.do_remaining_amount else 0 end), 0) as sisa_do_amount")
                        ->selectRaw("count(case when {$sisaDoCondition} and {$isSoonExpr} then 1 end) as sisa_do_soon")
                        ->selectRaw("count(case when {$sisaDoCondition} and {$isOverdueExpr} then 1 end) as sisa_do_overdue")
                        ->first();

                    $summary = [];
                    if ($summaryScope === 'sisa' || $summaryScope === 'sisa_pr') {
                        $summary['sisa_pr'] = (int) ($row->sisa_pr ?? 0);
                        $summary['sisa_pr_amount'] = (float) ($row->sisa_pr_amount ?? 0);
                        $summary['sisa_pr_soon'] = (int) ($row->sisa_pr_soon ?? 0);
                        $summary['sisa_pr_overdue'] = (int) ($row->sisa_pr_overdue ?? 0);
                    }
                    if ($summaryScope === 'sisa' || $summaryScope === 'sisa_do') {
                        $summary['sisa_do'] = (int) ($row->sisa_do ?? 0);
                        $summary['sisa_do_amount'] = (float) ($row->sisa_do_amount ?? 0);
                        $summary['sisa_do_soon'] = (int) ($row->sisa_do_soon ?? 0);
                        $summary['sisa_do_overdue'] = (int) ($row->sisa_do_overdue ?? 0);
                    }

                    return ['summary' => $summary];
                }

                if ($summaryScope === 'realized' || $summaryScope === 'realized_pr' || $summaryScope === 'realized_do') {
                    $summary = [];

                    if ($summaryScope === 'realized' || $summaryScope === 'realized_do') {
                        $doReferences = $readConnection->table('tb_kddo')
                            ->where('ref_po', '<>', '')
                            ->whereRaw("trim(coalesce(no_do, '')) <> ''")
                            ->selectRaw('ref_po as ref_po_key, lower(trim(no_do)) as no_do, pos_tgl')->distinct();
                        $doCountsQuery = $readConnection->query()->fromSub($doReferences, 'kdo')
                            ->join('tb_poin as p', function ($join) use ($prefix) {
                                $join->where('p.kode_poin', 'like', $prefix.'.POIN-%');
                                $join->whereRaw('kdo.ref_po_key = CONVERT(p.no_poin USING latin1)');
                            })
                            ->joinSub($detailStats, 'do_ds', function ($join) {
                                $join->on('do_ds.kode_poin', '=', 'p.kode_poin');
                            })
                            ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                            ->whereRaw('coalesce(do_ds.total_items, 0) > 0')
                            ->whereRaw('coalesce(do_ds.do_unrealized_items, 0) = 0');

                        if ($dateFilter === 'today') {
                            $doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [$startToday, $endToday]);
                        } elseif ($dateFilter === 'this_week') {
                            $doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [$startWeek, $endWeek]);
                        } elseif ($dateFilter === 'this_month') {
                            $doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [$startMonth, $endMonth]);
                        } elseif ($dateFilter === 'this_year') {
                            $doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [$startYear, $endYear]);
                        } elseif ($dateFilter === 'range' && $startDate !== '' && $endDate !== '') {
                            $doCountsQuery->whereRaw("date(str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')) between ? and ?", [$startDate, $endDate]);
                        }

                        $doCounts = $doCountsQuery->selectRaw('count(distinct lower(trim(kdo.no_do))) as realized_do')->first();
                        $summary['realized_do'] = (int) ($doCounts->realized_do ?? 0);
                    }

                    if ($summaryScope === 'realized' || $summaryScope === 'realized_pr') {
                        $prDateExpression = "case when trim(dpr.date) like '__.__.____' then str_to_date(trim(dpr.date), '%d.%m.%Y') else str_to_date(trim(dpr.date), '%Y-%m-%d') end";

                        $prReferences = $readConnection->table('tb_detailpr')
                            ->where('ref_po', '<>', '')
                            ->where('no_pr', '<>', '')
                            ->selectRaw('ref_po as ref_po_key, date')->distinct();
                        $prCountsQuery = $readConnection->query()->fromSub($prReferences, 'dpr')
                            ->join('tb_poin as p', function ($join) use ($prefix) {
                                $join->where('p.kode_poin', 'like', $prefix.'.POIN-%');
                                $join->whereRaw('dpr.ref_po_key = CONVERT(p.no_poin USING latin1)');
                            })
                            ->joinSub($detailStats, 'pr_ds', function ($join) {
                                $join->on('pr_ds.kode_poin', '=', 'p.kode_poin');
                            })
                            ->whereRaw('coalesce(pr_ds.total_items, 0) > 0')
                            ->whereRaw('coalesce(pr_ds.unrealized_items, 0) = 0');

                        if ($dateFilter === 'today') {
                            $prCountsQuery->whereRaw("{$prDateExpression} between ? and ?", [$startToday, $endToday]);
                        } elseif ($dateFilter === 'this_week') {
                            $prCountsQuery->whereRaw("{$prDateExpression} between ? and ?", [$startWeek, $endWeek]);
                        } elseif ($dateFilter === 'this_month') {
                            $prCountsQuery->whereRaw("{$prDateExpression} between ? and ?", [$startMonth, $endMonth]);
                        } elseif ($dateFilter === 'this_year') {
                            $prCountsQuery->whereRaw("{$prDateExpression} between ? and ?", [$startYear, $endYear]);
                        } elseif ($dateFilter === 'range' && $startDate !== '' && $endDate !== '') {
                            $prCountsQuery->whereRaw("date({$prDateExpression}) between ? and ?", [$startDate, $endDate]);
                        }

                        $prCounts = $prCountsQuery->selectRaw('count(distinct lower(trim(p.kode_poin))) as realized_pr')->first();
                        $summary['realized_pr'] = (int) ($prCounts->realized_pr ?? 0);
                    }

                    return ['summary' => $summary];
                }
            }

            // Status tabel ditentukan dari sisa qty pada tb_detailpoin.
            $needsDoDate = false;
            $needsPrDate = false;

            if ($statusFilter === 'realized_do') {
                $doDateExpression = "str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')";
                $query = $readConnection->table('tb_kddo as kdo')
                    ->join('tb_poin as p', function ($join) use ($prefix) {
                        $join->where('p.kode_poin', 'like', $prefix.'.POIN-%');
                        $join->on('kdo.ref_po', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
                    })
                    ->joinSub($detailStats, 'ds', function ($join) {
                        $join->on('ds.kode_poin', '=', 'p.kode_poin');
                    })
                    ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                    ->whereRaw('coalesce(ds.total_items, 0) > 0')
                    ->whereRaw('coalesce(ds.do_unrealized_items, 0) = 0')
                    ->selectRaw('min(p.id) as id, p.kode_poin, p.no_poin, p.date_poin, p.created_at, p.delivery_date, p.customer_name, p.grand_total')
                    ->selectRaw('max(trim(kdo.no_do)) as no_do')
                    ->selectRaw("max({$doDateExpression}) as last_do_date")
                    ->selectRaw('1 as has_do')
                    ->groupBy('p.kode_poin', 'p.no_poin', 'p.date_poin', 'p.created_at', 'p.delivery_date', 'p.customer_name', 'p.grand_total', DB::raw('lower(trim(kdo.no_do))'));

                if ($search !== '') {
                    $like = '%'.strtolower($search).'%';
                    $query->where(function ($q) use ($like) {
                        $q->whereRaw('lower(kdo.no_do) like ?', [$like])
                            ->orWhereRaw('lower(p.kode_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.no_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.customer_name) like ?', [$like]);
                    });
                }

                if ($dateFilter === 'today') {
                    $query->whereRaw("{$doDateExpression} between ? and ?", [$startToday, $endToday]);
                } elseif ($dateFilter === 'this_week') {
                    $query->whereRaw("{$doDateExpression} between ? and ?", [$startWeek, $endWeek]);
                } elseif ($dateFilter === 'this_month') {
                    $query->whereRaw("{$doDateExpression} between ? and ?", [$startMonth, $endMonth]);
                } elseif ($dateFilter === 'this_year') {
                    $query->whereRaw("{$doDateExpression} between ? and ?", [$startYear, $endYear]);
                } elseif ($dateFilter === 'range') {
                    if ($startDate !== '' && $endDate !== '') {
                        $query->whereRaw("date({$doDateExpression}) between ? and ?", [$startDate, $endDate]);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }

                $applyDeadlineFilter($query);

                $total = ($rowsOnly && $isPartial) ? null : $readConnection->query()->fromSub(clone $query, 'realized_do_rows')->count();
                $rows = ($paginationOnly && $isPartial)
                    ? collect()
                    : (function () use ($query, $perPage, $page) {
                        $orderedQuery = $this->applyNewestInputOrder(clone $query, 'created_at', 'id')
                            ->orderByDesc('last_do_date')
                            ->orderByDesc('no_do');

                        return $perPage === null
                            ? $orderedQuery->get()
                            : $orderedQuery->forPage($page, $perPage)->get();
                    })();

                $pagination = [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage === null ? 'all' : $perPage,
                    'total_pages' => $perPage === null ? 1 : max(1, (int) ceil(($total ?? 0) / $perPage)),
                ];

                if ($isPartial || $rowsOnly) {
                    $response = [];
                    if (! $paginationOnly) {
                        $response['purchaseOrderIns'] = $rows;
                    }
                    if (! $rowsOnly) {
                        $response['pagination'] = $pagination;
                    }

                    return $response;
                }

                return [
                    'purchaseOrderIns' => $rows,
                    'pagination' => $pagination,
                ];
            }

            if ($statusFilter === 'realized_pr') {
                $prDateExpression = "case when trim(dpr.date) like '__.__.____' then str_to_date(trim(dpr.date), '%d.%m.%Y') else str_to_date(trim(dpr.date), '%Y-%m-%d') end";

                $query = $readConnection->table('tb_detailpr as dpr')
                    ->join('tb_poin as p', function ($join) use ($prefix) {
                        $join->where(function ($q) use ($prefix) {
                            $q->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                                ->orWhere('p.kode_poin', 'like', '%.POIN-%')
                                ->orWhere('p.kode_poin', 'like', 'POIN-%');
                        });
                        $join->on('dpr.ref_po', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
                    })
                    ->joinSub($detailStats, 'ds', function ($join) {
                        $join->on('ds.kode_poin', '=', 'p.kode_poin');
                    })
                    ->whereRaw("trim(coalesce(dpr.ref_po, '')) <> ''")
                    ->where('dpr.no_pr', '<>', '')
                    ->whereRaw('coalesce(ds.total_items, 0) > 0')
                    ->whereRaw('coalesce(ds.unrealized_items, 0) = 0')
                    ->selectRaw('min(p.id) as id, p.kode_poin, p.no_poin, p.date_poin, p.created_at, p.delivery_date, p.customer_name, p.grand_total')
                    ->selectRaw('max(trim(dpr.no_pr)) as no_pr')
                    ->selectRaw("max({$prDateExpression}) as last_pr_date")
                    ->selectRaw('coalesce(max(ds.do_remaining_qty), 0) as sisa_qtydo')
                    ->selectRaw('0 as has_do')
                    ->groupBy('p.kode_poin', 'p.no_poin', 'p.date_poin', 'p.created_at', 'p.delivery_date', 'p.customer_name', 'p.grand_total');

                if ($search !== '') {
                    $like = '%'.strtolower($search).'%';
                    $query->where(function ($q) use ($like) {
                        $q->whereRaw('lower(dpr.no_pr) like ?', [$like])
                            ->orWhereRaw('lower(p.kode_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.no_poin) like ?', [$like])
                            ->orWhereRaw('lower(p.customer_name) like ?', [$like]);
                    });
                }

                if ($dateFilter === 'today') {
                    $query->whereRaw("{$prDateExpression} between ? and ?", [$startToday, $endToday]);
                } elseif ($dateFilter === 'this_week') {
                    $query->whereRaw("{$prDateExpression} between ? and ?", [$startWeek, $endWeek]);
                } elseif ($dateFilter === 'this_month') {
                    $query->whereRaw("{$prDateExpression} between ? and ?", [$startMonth, $endMonth]);
                } elseif ($dateFilter === 'this_year') {
                    $query->whereRaw("{$prDateExpression} between ? and ?", [$startYear, $endYear]);
                } elseif ($dateFilter === 'range') {
                    if ($startDate !== '' && $endDate !== '') {
                        $query->whereRaw("date({$prDateExpression}) between ? and ?", [$startDate, $endDate]);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }

                $applyDeadlineFilter($query);

                $total = ($rowsOnly && $isPartial) ? null : $readConnection->query()->fromSub(clone $query, 'realized_pr_rows')->count();
                $rows = ($paginationOnly && $isPartial)
                    ? collect()
                    : (function () use ($query, $perPage, $page) {
                        $orderedQuery = $this->applyNewestInputOrder(clone $query, 'created_at', 'id')
                            ->orderByDesc('last_pr_date')
                            ->orderByDesc('no_pr');

                        return $perPage === null
                            ? $orderedQuery->get()
                            : $orderedQuery->forPage($page, $perPage)->get();
                    })();

                $pagination = [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage === null ? 'all' : $perPage,
                    'total_pages' => $perPage === null ? 1 : max(1, (int) ceil(($total ?? 0) / $perPage)),
                ];

                if ($isPartial || $rowsOnly) {
                    $response = [];
                    if (! $paginationOnly) {
                        $response['purchaseOrderIns'] = $rows;
                    }
                    if (! $rowsOnly) {
                        $response['pagination'] = $pagination;
                    }

                    return $response;
                }

                return [
                    'purchaseOrderIns' => $rows,
                    'pagination' => $pagination,
                ];
            }

            $query = $readConnection->table('tb_poin as p')
                ->where(function ($q) use ($prefix) {
                    $q->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                        ->orWhere('p.kode_poin', 'like', '%.POIN-%')
                        ->orWhere('p.kode_poin', 'like', 'POIN-%');
                })
                ->select(
                    'p.id',
                    'p.kode_poin',
                    'p.no_poin',
                    'p.date_poin',
                    'p.created_at',
                    'p.delivery_date',
                    'p.customer_name',
                    'p.grand_total'
                );

            $requiresDs = in_array($statusFilter, [
                'outstanding', 'outstanding_do', 'outstanding_pr',
                'sisa_pr', 'sisa_do', 'realized', 'realized_do',
            ], true);

            if ($requiresDs) {
                $query->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                    ->selectRaw('coalesce(ds.do_remaining_qty, 0) as sisa_qtydo');
            }

            $query->selectRaw('0 as has_do');

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $like = '%'.strtolower($search).'%';
                    $q->whereRaw('lower(p.kode_poin) like ?', [$like])
                        ->orWhereRaw('lower(p.no_poin) like ?', [$like])
                        ->orWhereRaw('lower(p.customer_name) like ?', [$like]);
                });
            }

            if ($statusFilter === 'outstanding' || $statusFilter === 'outstanding_do') {
                $query->whereRaw('coalesce(ds.do_changed_count, 0) = 0')
                    ->whereRaw('coalesce(ds.total_items, 0) > 0');
            } elseif ($statusFilter === 'outstanding_pr') {
                $query->whereRaw('coalesce(ds.changed_count, 0) = 0')
                    ->whereRaw('coalesce(ds.total_items, 0) > 0');
            } elseif ($statusFilter === 'sisa_pr') {
                $query->whereRaw("{$sisaPrCondition}");
            } elseif ($statusFilter === 'sisa_do') {
                $query->whereRaw("{$sisaDoCondition}");
            } elseif ($statusFilter === 'realized' || $statusFilter === 'realized_do') {
                $query->whereRaw('coalesce(ds.total_items, 0) > 0')
                    ->whereRaw('coalesce(ds.do_unrealized_items, 0) = 0');
            }

            $this->applyCreatedDateFilter($query, $dateFilter, $startDate, $endDate);

            $applyDeadlineFilter($query);

            if ($summaryOnly) {
                $total = 0;
                $rows = collect();
            } else {
                $total = $rowsOnly ? null : (clone $query)->count();
                $rows = $paginationOnly
                    ? collect()
                    : (function () use ($query, $perPage, $page) {
                        $orderedQuery = $this->applyDeliveryDeadlineOrder(clone $query);

                        return $perPage === null
                            ? $orderedQuery->get()
                            : $orderedQuery->forPage($page, $perPage)->get();
                    })();

                if ($isPartial || $rowsOnly) {
                    $response = [];
                    if (! $paginationOnly) {
                        $response['purchaseOrderIns'] = $rows;
                    }
                    if (! $rowsOnly) {
                        $response['pagination'] = [
                            'total' => $total,
                            'page' => $page,
                            'per_page' => $perPage === null ? 'all' : $perPage,
                            'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
                        ];
                    }

                    return $response;
                }
            }

            $deadlineDateExpr = 'p.delivery_date';
            $isOverdueExpr = "{$deadlineDateExpr} <= {$todaySql}";
            $isSoonExpr = "{$deadlineDateExpr} > {$todaySql} and {$deadlineDateExpr} <= {$soonSql}";

            $statusData = $readConnection->table('tb_poin as p')->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                ->leftJoinSub($doStats, 'dos', function ($join) {
                    $join->on('dos.ref_po_key', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
                })
                ->leftJoinSub($prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                ->selectRaw('count(*) as total')
                ->selectRaw('count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then 1 end) as outstanding')
                ->selectRaw('count(case when coalesce(ds.do_started_items, 0) > 0 and coalesce(ds.do_unrealized_items, 0) > 0 then 1 end) as belum_pr')
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date is not null then 1 end) as realized')
                ->selectRaw('count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then 1 end) as outstanding_pr')
                ->selectRaw('coalesce(sum(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then p.grand_total else 0 end), 0) as outstanding_pr_amount')
                ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isSoonExpr} then 1 end) as outstanding_pr_soon")
                ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isOverdueExpr} then 1 end) as outstanding_pr_overdue")
                ->selectRaw('count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then 1 end) as outstanding_do')
                ->selectRaw('coalesce(sum(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 then p.grand_total else 0 end), 0) as outstanding_do_amount')
                ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isSoonExpr} then 1 end) as outstanding_do_soon")
                ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and coalesce(ds.total_items, 0) > 0 and {$isOverdueExpr} then 1 end) as outstanding_do_overdue")
                ->selectRaw("count(case when {$sisaPrCondition} then 1 end) as sisa_pr")
                ->selectRaw("coalesce(sum(case when {$sisaPrCondition} then ds.pr_remaining_amount else 0 end), 0) as sisa_pr_amount")
                ->selectRaw("count(case when {$sisaPrCondition} and {$isSoonExpr} then 1 end) as sisa_pr_soon")
                ->selectRaw("count(case when {$sisaPrCondition} and {$isOverdueExpr} then 1 end) as sisa_pr_overdue")
                ->selectRaw("count(case when {$sisaDoCondition} then 1 end) as sisa_do")
                ->selectRaw("coalesce(sum(case when {$sisaDoCondition} then ds.do_remaining_amount else 0 end), 0) as sisa_do_amount")
                ->selectRaw("count(case when {$sisaDoCondition} and {$isSoonExpr} then 1 end) as sisa_do_soon")
                ->selectRaw("count(case when {$sisaDoCondition} and {$isOverdueExpr} then 1 end) as sisa_do_overdue")
                ->selectRaw('count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date is not null then 1 end) as realized_pr')
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and coalesce(dos.do_count, 0) > 0 then 1 end) as realized_do')
                ->selectRaw('count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_today', [$startToday, $endToday])
                ->selectRaw('count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_week', [$startWeek, $endWeek])
                ->selectRaw('count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_month', [$startMonth, $endMonth])
                ->selectRaw('count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_year', [$startYear, $endYear])
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_today', [$startToday, $endToday])
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_week', [$startWeek, $endWeek])
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_month', [$startMonth, $endMonth])
                ->selectRaw('count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_year', [$startYear, $endYear])
                ->first();

            $periodCounts = $readConnection->table('tb_poin')->where('kode_poin', 'like', $prefix.'.POIN-%')
                ->selectRaw('count(*) as total')
                ->selectRaw('coalesce(sum(grand_total), 0) as total_amount')
                ->selectRaw('count(case when created_at >= ? then 1 end) as today', [$startToday])
                ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_today', [$startToday])
                ->selectRaw('count(case when created_at >= ? then 1 end) as week', [$startWeek])
                ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_week', [$startWeek])
                ->selectRaw('count(case when created_at >= ? then 1 end) as month', [$startMonth])
                ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_month', [$startMonth])
                ->selectRaw('count(case when created_at >= ? then 1 end) as year', [$startYear])
                ->selectRaw('coalesce(sum(case when created_at >= ? then grand_total else 0 end), 0) as amount_year', [$startYear])
                ->first();

            $summary = [
                'total' => (int) $statusData->total,
                'total_amount' => (float) ($periodCounts->total_amount ?? 0),
                'outstanding' => (int) $statusData->outstanding,
                'belum_pr' => (int) $statusData->belum_pr,
                'realized' => (int) $statusData->realized,
                'outstanding_pr' => (int) ($statusData->outstanding_pr ?? 0),
                'outstanding_pr_amount' => (float) ($statusData->outstanding_pr_amount ?? 0),
                'outstanding_pr_soon' => (int) ($statusData->outstanding_pr_soon ?? 0),
                'outstanding_pr_overdue' => (int) ($statusData->outstanding_pr_overdue ?? 0),
                'outstanding_do' => (int) ($statusData->outstanding_do ?? 0),
                'outstanding_do_amount' => (float) ($statusData->outstanding_do_amount ?? 0),
                'outstanding_do_soon' => (int) ($statusData->outstanding_do_soon ?? 0),
                'outstanding_do_overdue' => (int) ($statusData->outstanding_do_overdue ?? 0),
                'sisa_pr' => (int) ($statusData->sisa_pr ?? 0),
                'sisa_pr_amount' => (float) ($statusData->sisa_pr_amount ?? 0),
                'sisa_pr_soon' => (int) ($statusData->sisa_pr_soon ?? 0),
                'sisa_pr_overdue' => (int) ($statusData->sisa_pr_overdue ?? 0),
                'sisa_do' => (int) ($statusData->sisa_do ?? 0),
                'sisa_do_amount' => (float) ($statusData->sisa_do_amount ?? 0),
                'sisa_do_soon' => (int) ($statusData->sisa_do_soon ?? 0),
                'sisa_do_overdue' => (int) ($statusData->sisa_do_overdue ?? 0),
                'realized_pr' => (int) ($statusData->realized_pr ?? 0),
                'realized_do' => (int) ($statusData->realized_do ?? 0),
                'realized_pr_counts' => [
                    'today' => (int) ($statusData->realized_pr_today ?? 0),
                    'week' => (int) ($statusData->realized_pr_week ?? 0),
                    'month' => (int) ($statusData->realized_pr_month ?? 0),
                    'year' => (int) ($statusData->realized_pr_year ?? 0),
                    'all' => (int) ($statusData->realized_pr ?? 0),
                ],
                'realized_do_counts' => [
                    'today' => (int) ($statusData->realized_do_today ?? 0),
                    'week' => (int) ($statusData->realized_do_week ?? 0),
                    'month' => (int) ($statusData->realized_do_month ?? 0),
                    'year' => (int) ($statusData->realized_do_year ?? 0),
                    'all' => (int) ($statusData->realized_do ?? 0),
                ],
                'data_counts' => [
                    'today' => (int) $periodCounts->today,
                    'week' => (int) $periodCounts->week,
                    'month' => (int) $periodCounts->month,
                    'year' => (int) $periodCounts->year,
                ],
                'data_amounts' => [
                    'today' => (float) ($periodCounts->amount_today ?? 0),
                    'week' => (float) ($periodCounts->amount_week ?? 0),
                    'month' => (float) ($periodCounts->amount_month ?? 0),
                    'year' => (float) ($periodCounts->amount_year ?? 0),
                    'all' => (float) ($periodCounts->total_amount ?? 0),
                ],
            ];

            $base = $readConnection->table('tb_poin as p')->where('p.kode_poin', 'like', $prefix.'.POIN-%')
                ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                ->leftJoinSub($doStats, 'dos', function ($join) {
                    $join->on('dos.ref_po_key', '=', DB::raw('CONVERT(p.no_poin USING latin1)'));
                })
                ->leftJoinSub($prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                ->select('p.id', 'p.kode_poin', 'p.no_poin', 'p.date_poin', 'p.created_at', 'p.customer_name', 'p.grand_total', DB::raw('prs.last_pr_date as last_pr_date'), DB::raw('dos.last_do_date as last_do_date'))
                ->orderByDesc('p.id');

            return [
                'summary' => $summary,
                'purchaseOrderIns' => $rows,
                'outstandingPurchaseOrderIns' => [],
                'outstandingDoPurchaseOrderIns' => [],
                'belumPrPurchaseOrderIns' => [],
                'sisaDoPurchaseOrderIns' => [],
                'realizedPurchaseOrderIns' => [],
                'realizedDoPurchaseOrderIns' => [],
                'allPurchaseOrderIns' => [],
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage === null ? 'all' : $perPage,
                    'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
                ],
            ];
        })();
    }

    public function create()
    {
        return Inertia::render('marketing/purchase-order-in/create', [
            'defaults' => [
                'date' => now()->toDateString(),
                'payment_term' => '30 Hari',
                'currency' => 'IDR',
            ],
            'vendors' => [
                'PT Sinar Karya Utama',
                'CV Bintang Niaga',
                'PT Cakra Persada',
            ],
        ]);
    }

    public function edit($kodePoin)
    {
        $purchaseOrderIn = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first();

        if (! $purchaseOrderIn) {
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        $prUsage = DB::table('tb_detailpr as pr')
            ->where('pr.ref_po', trim((string) $purchaseOrderIn->no_poin))
            ->whereRaw('lower(trim(pr.for_customer)) = lower(trim(?))', [(string) $purchaseOrderIn->customer_name])
            ->select('pr.kd_material')->selectRaw('count(*) as has_pr')
            ->groupBy('pr.kd_material');

        $purchaseOrderInItems = DB::table('tb_detailpoin as d')
            ->leftJoinSub($prUsage, 'pr_usage', 'pr_usage.kd_material', '=', 'd.kd_material')
            ->where('d.kode_poin', $kodePoin)
            ->select('d.*')->selectRaw('coalesce(pr_usage.has_pr, 0) as has_pr')
            ->orderBy('d.id')
            ->get();

        return Inertia::render('marketing/purchase-order-in/edit', [
            'purchaseOrderIn' => $purchaseOrderIn,
            'purchaseOrderInItems' => $purchaseOrderInItems,
            'defaults' => [
                'date' => now()->toDateString(),
                'payment_term' => '30 Hari',
                'currency' => 'IDR',
            ],
        ]);
    }

    public function track(Request $request)
    {
        $refPo = $request->query('ref_po');
        if (empty($refPo)) {
            return response()->json(['success' => false, 'message' => 'Silakan masukkan Ref PO.', 'data' => []]);
        }

        $refPoLower = strtolower(trim($refPo));
        $flow = [];
        $tables = DB::connection()->getSchemaBuilder()->getTableListing(schemaQualified: false);

        // Level 1: PO In (tb_poin)
        if (in_array('tb_poin', $tables, true)) {
            $poIns = DB::table('tb_poin')->whereRaw('lower(trim(no_poin)) = ?', [$refPoLower])->get();
            foreach ($poIns as $poin) {
                $date = $poin->created_at ?? $poin->date_poin ?? '-';
                $flow[] = "Ref PO Customer telah di input pada {$date} dengan nomor document {$poin->kode_poin}";
            }
        }

        // Level 2: PR (tb_pr)
        if (in_array('tb_pr', $tables, true)) {
            $prs = DB::table('tb_pr')->whereRaw('lower(trim(ref_po)) = ?', [$refPoLower])->get();
            foreach ($prs as $pr) {
                $flow[] = "Purchase Requirement telah dibuat pada {$pr->date} dengan nomor document {$pr->no_pr}";
            }
        }

        // Level 3: PO (tb_po)
        $poNos = [];
        if (in_array('tb_po', $tables, true)) {
            $pos = DB::table('tb_po')->whereRaw('lower(trim(ref_poin)) = ?', [$refPoLower])->get();
            foreach ($pos as $po) {
                $flow[] = "Purchase order telah dibuat pada {$po->tgl} dengan nomor document {$po->no_po}";
                if (! empty($po->no_po)) {
                    $poNos[] = strtolower(trim($po->no_po));
                }
            }
        }

        // Level 4: Penerimaan Material (tb_mi)
        if (in_array('tb_mi', $tables, true) && count($poNos) > 0) {
            $mis = DB::table('tb_mi')->whereIn(DB::raw('lower(trim(ref_po))'), $poNos)->get();
            $seenMi = [];
            foreach ($mis as $mi) {
                if (! empty($mi->no_doc) && in_array(strtolower(trim($mi->no_doc)), $seenMi)) {
                    continue;
                }
                if (! empty($mi->no_doc)) {
                    $seenMi[] = strtolower(trim($mi->no_doc));
                }

                $tgl = $mi->posting_date ?? $mi->posting_tgl ?? $mi->tgl_mi ?? $mi->tgl_doc ?? $mi->tgl ?? '-';
                $flow[] = "barang sudah diterimakan pada {$tgl} dengan nomor document {$mi->no_doc}";
            }
        }

        // Level 5: Delivery Order (tb_kddo & tb_kddob)
        $doNos = [];
        if (in_array('tb_kddo', $tables, true)) {
            $dos = DB::table('tb_kddo')->where('ref_po', trim((string) $refPo))->get();
            $doNos = $dos->map(fn ($row) => strtolower(trim($row->no_do)))->unique()->values()->all();
            $doBantuByRef = collect();
            if ($doNos !== [] && in_array('tb_kddob', $tables, true)) {
                $doBantuByRef = DB::table('tb_kddob')
                    ->whereIn(DB::raw('lower(trim(ref_do))'), $doNos)
                    ->get(['ref_do', 'date', 'no_dob'])
                    ->groupBy(fn ($row) => strtolower(trim($row->ref_do)));
            }

            foreach ($dos as $doRecord) {
                $doInfo = "Delivery Order telah dibuat pada tanggal {$doRecord->tgl} dengan nomor document {$doRecord->no_do}";
                foreach ($doBantuByRef->get(strtolower(trim($doRecord->no_do)), []) as $dob) {
                    $doInfo .= " dan DO bantu pada tanggal {$dob->date} dengan nomor document {$dob->no_dob}";
                }
                $flow[] = $doInfo;
            }
        }

        // Level 6: Faktur Penjualan (tb_kdfakturpenjualan)
        $fakturNos = [];
        if (in_array('tb_kdfakturpenjualan', $tables, true)) {
            $fakturs = DB::table('tb_kdfakturpenjualan')->whereRaw('lower(trim(ref_po)) = ?', [$refPoLower])->get();
            foreach ($fakturs as $faktur) {
                $flow[] = "faktur penjualan telah dibuat pada tanggal {$faktur->tgl_doc} dengan nomor document {$faktur->no_fakturpenjualan}";
                if (! empty($faktur->no_fakturpenjualan)) {
                    $fakturNos[] = strtolower(trim($faktur->no_fakturpenjualan));
                }
            }
        }

        // Level 7: Kwitansi (tb_kwitansi)
        if (in_array('tb_kwitansi', $tables, true) && count($fakturNos) > 0) {
            $kwitansis = DB::table('tb_kwitansi')->whereIn(DB::raw('lower(trim(ref_faktur))'), $fakturNos)->get();
            foreach ($kwitansis as $kw) {
                $flow[] = "kwitansi telah dibuat pada tanggal {$kw->tgl} dengan nomor document {$kw->no_kwitansi}";
            }
        }

        // Level 8: Tanda Terima Invoice (tb_ttinv)
        if (in_array('tb_ttinv', $tables, true)) {
            $ttinvs = DB::table('tb_ttinv')->whereRaw('lower(trim(ref_po)) = ?', [$refPoLower])->get();
            foreach ($ttinvs as $tt) {
                $flow[] = "faktur penjualan telah diterima oleh {$tt->nm_penerima} pada tanggal {$tt->tgl_terima} dengan nomor document {$tt->no_ttinv}";
            }
        }

        // Level 9: Pembayaran / Kas (tb_kas)
        if (in_array('tb_kas', $tables, true) && count($fakturNos) > 0) {
            $query = DB::table('tb_kas');
            $query->where(function ($q) use ($fakturNos) {
                foreach ($fakturNos as $fn) {
                    $q->orWhereRaw('lower(trim(keterangan)) like ?', ['%'.$fn.'%']);
                }
            });
            $kasList = $query->get();
            foreach ($kasList as $kas) {
                $tglVoucher = $kas->Tgl_Voucher ?? $kas->tgl_voucher ?? '-';
                $kodeVoucher = $kas->Kode_Voucher ?? $kas->kode_voucher ?? '-';
                $flow[] = "transaksi sudah dibukukan pada tanggal {$tglVoucher} dengan nomor document {$kodeVoucher}";
            }
        }

        return response()->json(['success' => true, 'data' => $flow]);
    }

    public function show(Request $request, $kodePoin)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $page = max(1, (int) $request->query('page', 1));

        $conn = DB::connection();
        $this->readSource = 'mysql';

        $header = $conn->table('tb_poin')->where('kode_poin', $kodePoin)->first();

        if (! $header) {
            return response()->json(['message' => 'PO In tidak ditemukan'], 404);
        }

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? max(1, (int) $perPageInput) : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = $conn->table('tb_detailpoin')->where('kode_poin', $kodePoin);
        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->whereRaw('lower(material) like ?', [$like]);
        }

        $total = $perPage === null ? null : (clone $query)->count();

        if ($perPage === null) {
            $items = (clone $query)->orderBy('id')->get();
        } else {
            $items = (clone $query)->orderBy('id')->forPage($page, $perPage)->get();
        }
        $total ??= $items->count();

        return response()->json([
            'header' => $header,
            'items' => $items,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage === null ? 'all' : $perPage,
                'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
            ],
        ])->header('X-Data-Source', $this->readSource)->header('Cache-Control', 'no-store');
    }

    public function print($kodePoin)
    {
        $data = (function () use ($kodePoin) {
            $header = DB::table('tb_poin')->where('kode_poin', $kodePoin)->first();
            if (! $header) {
                return null;
            }

            $items = DB::table('tb_detailpoin')->where('kode_poin', $kodePoin)->orderBy('id')->get();

            $customer = null;
            if (isset($header->kode_customer)) {
                $customer = DB::table('tb_cs')->where('kd_cs', $header->kode_customer)->first();
            }

            return ['header' => $header, 'items' => $items, 'customer' => $customer];
        })();

        if (! $data) {
            return redirect()->route('marketing.purchase-order-in.index')->with('error', 'Data PO In tidak ditemukan.');
        }

        $lookupKey = $this->activeTenantDatabase(request());
        $companyConfig = $lookupKey ? config("tenants.companies.$lookupKey", []) : [];
        $fallbackName = $lookupKey ? config("tenants.labels.$lookupKey", $lookupKey) : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('marketing/purchase-order-in/print', [
            'purchaseOrder' => $data['header'],
            'purchaseOrderDetails' => $data['items'],
            'customer' => $data['customer'],
            'company' => $company,
        ]);
    }

    public function materials(Request $request)
    {
        $perPageInput = $request->query('per_page');
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));

        $codeColumn = $this->firstExistingColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
        $nameColumn = $this->firstExistingColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
        $unitColumn = $this->firstExistingColumn('tb_barang', ['unit', 'satuan'], 'unit');
        $stockTotal = $this->barangStockTotalExpression();

        $query = DB::connection()->table('tb_barang')->selectRaw("
            tb_barang.*,
            {$codeColumn} as kd_material,
            {$nameColumn} as material,
            {$unitColumn} as unit,
            coalesce(cast(stok_g1 as decimal(65,4)), 0) as stok_g1,
            coalesce(cast(stok_g2 as decimal(65,4)), 0) as stok_g2,
            coalesce(cast(stok_g3 as decimal(65,4)), 0) as stok_g3,
            coalesce(cast(stok_g4 as decimal(65,4)), 0) as stok_g4,
            {$stockTotal} as stok
        ");

        if ($search !== '') {
            $query->where(function ($q) use ($search, $codeColumn, $nameColumn) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw("lower({$codeColumn}) like ?", [$like])
                    ->orWhereRaw("lower({$nameColumn}) like ?", [$like]);
            });
        }

        if ($perPageInput === null) {
            $materials = (clone $query)->orderBy($nameColumn)->get();

            return response()->json(['materials' => $materials, 'total' => $materials->count()]);
        }

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 10);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 10;
        }

        if ($perPage === null) {
            $materials = (clone $query)->orderBy($nameColumn)->get();

            return response()->json(['materials' => $materials, 'total' => $materials->count()]);
        }

        $total = (clone $query)->count();
        $materials = (clone $query)->orderBy($nameColumn)->forPage($page, $perPage)->get();

        return response()->json([
            'materials' => $materials,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function storeMaterial(Request $request)
    {
        $validated = $request->validate([
            'material' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:100'],
            'stok' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string', 'max:255'],
        ]);

        $stok = (int) ($validated['stok'] ?? 0);
        $pembuat = optional($request->user())->name
            ?? $request->cookie('login_user')
            ?? $request->cookie('login_user_name')
            ?? ' ';
        $codeColumn = $this->firstExistingColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
        $nameColumn = $this->firstExistingColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
        $unitColumn = $this->firstExistingColumn('tb_barang', ['unit', 'satuan'], 'unit');
        $lastKdMaterial = DB::connection()->table('tb_barang')->max($codeColumn);
        $nextKdMaterial = $lastKdMaterial
            ? (string) (((int) $lastKdMaterial) + 1)
            : '1000000001';
        if (strlen($nextKdMaterial) < 10) {
            $nextKdMaterial = '1'.str_pad(substr($nextKdMaterial, 1), 9, '0', STR_PAD_LEFT);
        }

        try {
            $insertData = [
                $codeColumn => (int) $nextKdMaterial,
                $nameColumn => $validated['material'],
                $unitColumn => $validated['unit'],
            ];

            foreach ([
                'stok_g1' => $stok,
                'stok_g2' => 0,
                'stok_g3' => 0,
                'stok_g4' => 0,
                'harga' => 0,
                'remark' => ($validated['remark'] ?? null) === null ? ' ' : $validated['remark'],
                'tgl_buat' => now()->toDateString(),
                'pembuat' => $pembuat,
            ] as $column => $value) {
                $actualColumn = $this->columnsForTable('tb_barang')[strtolower($column)] ?? null;
                if ($actualColumn !== null) {
                    $insertData[$actualColumn] = $value;
                }
            }

            DB::connection()->table('tb_barang')->insert($insertData);

        } catch (Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Data material berhasil disimpan.',
            'material' => [
                'kd_material' => (int) $nextKdMaterial,
                'material' => $validated['material'],
                'unit' => $validated['unit'],
                'stok_g1' => $stok,
                'stok_g2' => 0,
                'stok_g3' => 0,
                'stok_g4' => 0,
                'stok' => $stok,
                'harga' => 0,
                'remark' => $validated['remark'] ?? null,
            ],
        ]);
    }

    public function customers(Request $request)
    {
        $perPageInput = $request->query('per_page', 5);
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? max(1, (int) $perPageInput) : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::connection()->table('tb_cs')->select('kd_cs', 'nm_cs', 'kota_cs');
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw('lower(kd_cs) like ?', [$like])
                    ->orWhereRaw('lower(nm_cs) like ?', [$like])
                    ->orWhereRaw('lower(kota_cs) like ?', [$like]);
            });
        }

        if ($perPage === null) {
            $customers = (clone $query)->orderBy('nm_cs')->get();
            $data = ['customers' => $customers, 'total' => $customers->count()];
        } else {
            $total = (clone $query)->count();
            $customers = (clone $query)->orderBy('nm_cs')->forPage($page, $perPage)->get();
            $data = [
                'customers' => $customers,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
            ];
        }

        return response()->json($data)->header('X-Data-Source', $this->readSource)->header('Cache-Control', 'no-store');
    }

    public function customerPics(Request $request)
    {
        $kdCs = trim((string) $request->query('kd_cs', ''));
        $search = trim((string) $request->query('search', ''));

        if (empty($kdCs)) {
            return response()->json(['pics' => []]);
        }

        $query = DB::table('tb_cspic')
            ->where('kd_cs', $kdCs)
            ->select('pic_name');

        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->whereRaw('lower(pic_name) like ?', [$like]);
        }

        $pics = $query->orderBy('pic_name')->pluck('pic_name');

        return response()->json(['pics' => $pics]);
    }

    public function storeCustomer(Request $request)
    {

        $validated = $request->validate([
            'nm_cs' => ['required', 'string', 'max:255'],
            'alamat_cs' => ['nullable', 'string', 'max:255'],
            'kota_cs' => ['nullable', 'string', 'max:255'],
            'telp_cs' => ['nullable', 'string', 'max:100'],
            'fax_cs' => ['nullable', 'string', 'max:100'],
            'npwp_cs' => ['nullable', 'string', 'max:255'],
            'npwp1_cs' => ['nullable', 'string', 'max:255'],
            'npwp2_cs' => ['nullable', 'string', 'max:255'],
            'Attnd' => ['nullable', 'string', 'max:255'],
        ]);

        $lastCode = DB::connection()->table('tb_cs')
            ->where('kd_cs', 'like', 'CST%')
            ->orderBy('kd_cs', 'desc')
            ->value('kd_cs');
        $lastNumber = $lastCode ? (int) substr((string) $lastCode, 3) : 0;
        $nextCode = 'CST'.str_pad((string) ($lastNumber + 1), 7, '0', STR_PAD_LEFT);
        $validated['kd_cs'] = $nextCode;

        try {
            DB::connection()->table('tb_cs')->insert($validated);

        } catch (Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Data customer berhasil disimpan.',
            'customer' => [
                'kd_cs' => $validated['kd_cs'],
                'nm_cs' => $validated['nm_cs'],
                'kota_cs' => $validated['kota_cs'] ?? '',
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'no_poin' => ['required', 'string', 'max:100'],
            'date' => ['nullable', 'string', 'max:20'],
            'delivery_date' => ['nullable', 'string', 'max:20'],
            'kd_customer' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'payment_term' => ['nullable', 'string', 'max:100'],
            'ppn_percent' => ['required', 'numeric', 'min:0'],
            'franco_loco' => ['required', 'string', 'max:255'],
            'sender_name' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'total_price' => ['nullable', 'numeric', 'min:0'],
            'dpp' => ['nullable', 'numeric', 'min:0'],
            'ppn_value' => ['nullable', 'numeric', 'min:0'],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
            'materials' => ['required', 'array', 'min:1'],
            'materials.*.kd_material' => ['nullable', 'numeric'],
            'materials.*.material' => ['required', 'string', 'max:255'],
            'materials.*.qty' => ['required', 'numeric', 'min:0.0001'],
            'materials.*.satuan' => ['nullable', 'string', 'max:100'],
            'materials.*.price_po_in' => ['required', 'numeric', 'min:0'],
            'materials.*.total_price_po_in' => ['nullable', 'numeric', 'min:0'],
            'materials.*.remark' => ['nullable', 'string'],
        ]);

        // Validasi: sender_name harus ada di tb_cspic untuk customer yang dipilih
        $kdCustomer = trim((string) ($validated['kd_customer'] ?? ''));
        $senderName = trim((string) ($validated['sender_name'] ?? ''));
        if ($kdCustomer !== '') {
            $picExists = DB::table('tb_cspic')
                ->where('kd_cs', $kdCustomer)
                ->where('pic_name', trim($senderName))
                ->exists();
            if (! $picExists) {
                throw ValidationException::withMessages([
                    'sender_name' => 'PIC PO Customer tidak ditemukan. Pilih PIC dari daftar yang tersedia.',
                ]);
            }
        }

        try {
            $this->purchaseOrderInService->createPurchaseOrderIn($validated, $this->resolveDatabasePrefix($request));

            $this->broadcastPoInChanged();

            if ($request->header('X-Inertia')) {
                return redirect()
                    ->route('marketing.purchase-order-in.index')
                    ->with('success', 'Data PO IN berhasil disimpan.');
            }
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Data PO IN berhasil disimpan.',
                    'redirect' => route('marketing.purchase-order-in.index'),
                ]);
            }

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil disimpan.');
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $this->formatFailureMessage('menyimpan', $e),
                ], 500);
            }

            return back()
                ->withInput()
                ->with('error', $this->formatFailureMessage('menyimpan', $e));
        }
    }

    public function update(Request $request, $kodePoin)
    {
        $exists = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->exists();

        if (! $exists) {
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        $validated = $request->validate([
            'no_poin' => ['required', 'string', 'max:100'],
            'date' => ['nullable', 'string', 'max:20'],
            'delivery_date' => ['nullable', 'string', 'max:20'],
            'kd_customer' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'payment_term' => ['nullable', 'string', 'max:100'],
            'ppn_percent' => ['required', 'numeric', 'min:0'],
            'franco_loco' => ['required', 'string', 'max:255'],
            'sender_name' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'total_price' => ['nullable', 'numeric', 'min:0'],
            'dpp' => ['nullable', 'numeric', 'min:0'],
            'ppn_value' => ['nullable', 'numeric', 'min:0'],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        // Validasi: sender_name harus ada di tb_cspic untuk customer yang dipilih
        $kdCustomerUpd = trim((string) ($validated['kd_customer'] ?? ''));
        if ($kdCustomerUpd === '') {
            // coba ambil dari DB
            $existingHeader = DB::table('tb_poin')->where('kode_poin', $kodePoin)->value('kode_customer');
            $kdCustomerUpd = trim((string) ($existingHeader ?? ''));
        }
        $senderNameUpd = trim((string) ($validated['sender_name'] ?? ''));
        if ($kdCustomerUpd !== '') {
            $picExistsUpd = DB::table('tb_cspic')
                ->where('kd_cs', $kdCustomerUpd)
                ->where('pic_name', trim($senderNameUpd))
                ->exists();
            if (! $picExistsUpd) {
                throw ValidationException::withMessages([
                    'sender_name' => 'PIC PO Customer tidak ditemukan. Pilih PIC dari daftar yang tersedia.',
                ]);
            }
        }

        try {
            $this->purchaseOrderInService->updatePurchaseOrderIn($kodePoin, $validated);

            $this->broadcastPoInChanged();

            if ($request->header('X-Inertia')) {
                session()->flash('success', 'Data PO IN berhasil diperbarui.');

                return redirect('/marketing/purchase-order-in');
            }
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Data PO IN berhasil diperbarui.',
                    'redirect' => route('marketing.purchase-order-in.index'),
                ]);
            }

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil diperbarui.');
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Gagal memperbarui data: '.$e->getMessage(),
                ], 500);
            }

            return back()->with('error', 'Gagal memperbarui data: '.$e->getMessage());
        }
    }

    public function destroy(Request $request, $kodePoin)
    {
        try {
            $this->purchaseOrderInService->deletePurchaseOrderIn($kodePoin);
            $this->broadcastPoInChanged();

            if ($request->header('X-Inertia')) {
                session()->flash('success', 'PO In berhasil dihapus.');

                return redirect('/marketing/purchase-order-in');
            }

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil dihapus.');
        } catch (Throwable $e) {
            $status = $e->getCode() === 404 ? 404 : 500;
            if ($request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], $status);
            }
            if ($status === 404) {
                return redirect()
                    ->route('marketing.purchase-order-in.index')
                    ->with('error', $e->getMessage());
            }

            return back()->with('error', 'Gagal menghapus data: '.$e->getMessage());
        }
    }

    public function storeDetail(Request $request, $kodePoin)
    {
        try {
            $validated = $request->validate([
                'kd_material' => ['nullable', 'numeric'],
                'material' => ['required', 'string', 'max:255'],
                'qty' => ['required', 'numeric', 'min:0.0001'],
                'satuan' => ['nullable', 'string', 'max:100'],
                'price_po_in' => ['required', 'numeric', 'min:0'],
                'total_price_po_in' => ['nullable', 'numeric', 'min:0'],
                'remark' => ['nullable', 'string'],
            ]);

            $detail = $this->purchaseOrderInService->addPurchaseOrderDetail($kodePoin, $validated);
            $this->broadcastPoInChanged();

            return response()->json([
                'message' => 'Material berhasil ditambahkan.',
                'detail' => $detail,
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $this->exceptionStatus($e));
        }
    }

    public function updateDetail(Request $request, $kodePoin, $detailId)
    {
        try {
            $validated = $request->validate([
                'kd_material' => ['nullable', 'numeric'],
                'material' => ['required', 'string', 'max:255'],
                'qty' => ['required', 'numeric', 'min:0.0001'],
                'satuan' => ['nullable', 'string', 'max:100'],
                'price_po_in' => ['required', 'numeric', 'min:0'],
                'total_price_po_in' => ['nullable', 'numeric', 'min:0'],
                'remark' => ['nullable', 'string'],
            ]);

            $this->purchaseOrderInService->updatePurchaseOrderDetail($kodePoin, (int) $detailId, $validated);
            $this->broadcastPoInChanged();

            return response()->json([
                'message' => 'Material berhasil diperbarui.',
                'updated_at' => now('Asia/Singapore'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $this->exceptionStatus($e));
        }
    }

    public function destroyDetail($kodePoin, $detailId)
    {
        try {
            $this->purchaseOrderInService->deletePurchaseOrderDetail($kodePoin, (int) $detailId);
            $this->broadcastPoInChanged();

            return response()->json([
                'message' => 'Material berhasil dihapus.',
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $this->exceptionStatus($e));
        }
    }
}
