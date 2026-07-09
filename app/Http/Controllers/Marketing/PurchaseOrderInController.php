<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Throwable;

class PurchaseOrderInController
{
    private const POIN_CACHE_TAGS = ['poin_data'];
    private const MATERIAL_CACHE_TAGS = ['material_data'];
    private const CUSTOMER_CACHE_TAGS = ['customer_data'];
    private const LOOKUP_CACHE_TTL = 30;

    public function export(Request $request)
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $purchaseOrders = DB::table('tb_poin')
            ->whereDate('created_at', '>=', $validated['start_date'])
            ->whereDate('created_at', '<=', $validated['end_date'])
            ->orderByDesc('created_at')
            ->orderByDesc('kode_poin')
            ->get();

        $detailsByDocument = DB::table('tb_detailpoin')
            ->whereIn('kode_poin', $purchaseOrders->pluck('kode_poin'))
            ->orderBy('id')
            ->get()
            ->groupBy('kode_poin');

        $exportRows = $purchaseOrders->map(function ($purchaseOrder) use ($detailsByDocument) {
            foreach (['ppn_input_percent', 'total_price', 'ppn_amount', 'grand_total'] as $column) {
                $purchaseOrder->{$column} = (float) ($purchaseOrder->{$column} ?? 0);
            }

            // Data legacy dari aplikasi desktop tersimpan dalam dua satuan:
            // sebagian rupiah penuh, sebagian dalam ribuan rupiah. Normalisasi
            // satu dokumen secara utuh sebelum dikirim ke halaman export.
            $moneyScale = $purchaseOrder->total_price > 0
                && $purchaseOrder->total_price < 100000
                ? 1000
                : 1;

            foreach (['total_price', 'ppn_amount', 'grand_total'] as $column) {
                $purchaseOrder->{$column} *= $moneyScale;
            }

            $purchaseOrder->details = $detailsByDocument
                ->get($purchaseOrder->kode_poin, collect())
                ->map(function ($detail) {
                    foreach (['qty', 'price_po_in', 'total_price_po_in'] as $column) {
                        $detail->{$column} = (float) ($detail->{$column} ?? 0);
                    }

                    // Detail dalam satu dokumen pun dapat bercampur antara
                    // rupiah penuh dan ribuan rupiah (data legacy desktop).
                    $detailScale = $detail->total_price_po_in > 0
                        && $detail->total_price_po_in < 100000
                        ? 1000
                        : 1;
                    $detail->total_price_po_in *= $detailScale;
                    if ($detail->qty > 0 && $detail->total_price_po_in > 0) {
                        $detail->price_po_in = $detail->total_price_po_in / $detail->qty;
                    } else {
                        $priceScale = $detail->price_po_in > 0
                            && $detail->price_po_in < 100000
                            ? 1000
                            : 1;
                        $detail->price_po_in *= $priceScale;
                    }

                    return $detail;
                })
                ->values();

            return $purchaseOrder;
        });

        return Inertia::render('marketing/purchase-order-in/export', [
            'purchaseOrders' => $exportRows,
            'startDate' => $validated['start_date'],
            'endDate' => $validated['end_date'],
        ]);
    }

    private function formatFailureMessage(string $action, Throwable $e): string
    {
        $type = $e instanceof QueryException ? 'Error SQL/database' : 'Error sistem';
        $detail = trim($e->getMessage());

        return "Gagal {$action} data PO In. {$type}: " . ($detail !== '' ? $detail : 'Tidak ada detail error dari server.');
    }

    private function recalculateHeaderTotals(string $kodePoin): void
    {
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first(['ppn_input_percent']);

        if (!$header) {
            return;
        }

        $totalPrice = (float) (DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->selectRaw('coalesce(sum(coalesce(cast(qty as decimal(18,4)), 0) * coalesce(cast(price_po_in as decimal(18,4)), 0)), 0) as total_price')
            ->value('total_price') ?? 0);
        $ppnPercentInput = (float) ($header->ppn_input_percent ?? 0);
        $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
        $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);
        $dpp = $ppnPercentInput > 0
            ? round((11 / $ppnPercentInput) * $totalPrice, 2)
            : $totalPrice;
        $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
        $grandTotal = round($totalPrice + $ppnValue, 2);

        DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->update([
                'total_price' => $totalPrice,
                'dpp' => $dpp,
                'ppn_amount' => $ppnValue,
                'grand_total' => $grandTotal,
                'updated_at' => now('Asia/Singapore'),
            ]);
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

    private function tenantCachePrefix(?Request $request = null): string
    {
        $database = $this->activeTenantDatabase($request);

        return preg_replace('/[^A-Za-z0-9_.:-]/', '_', strtolower($database)) ?: 'default';
    }

    private function poinCacheKey(string $scope, array $parts = [], ?Request $request = null): string
    {
        return 'poin:' . $this->tenantCachePrefix($request) . ':' . $scope . ':' . md5(json_encode($parts));
    }

    private function parseDateOrNull(?string $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) === 1) {
            return $text;
        }

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $text, $matches) === 1) {
            return $matches[3].'-'.$matches[2].'-'.$matches[1];
        }

        return null;
    }

    private function resolveDatabasePrefix(Request $request): string
    {
        $database = $this->activeTenantDatabase($request);
        $configuredPrefix = config("tenants.company_codes.$database");

        if (is_string($configuredPrefix) && trim($configuredPrefix) !== '') {
            return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $configuredPrefix));
        }

        $prefix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', preg_replace('/^db/i', '', $database)));
        return $prefix !== '' ? $prefix : 'SYS';
    }

    private function generateKodePoin(Request $request): string
    {
        $prefix = $this->resolveDatabasePrefix($request);
        $latest = DB::table('tb_poin')
            ->select('kode_poin')
            ->where('kode_poin', 'like', $prefix.'.POIN-%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();

        $nextNumber = 1;
        if ($latest && isset($latest->kode_poin)) {
            $current = (string) $latest->kode_poin;
            if (preg_match('/(\d{1,})$/', $current, $matches) === 1) {
                $nextNumber = ((int) $matches[1]) + 1;
            }
        }

        return $prefix.'.POIN-'.str_pad((string) $nextNumber, 8, '0', STR_PAD_LEFT);
    }

    private function firstExistingColumn(string $table, array $columns, string $fallback): string
    {
        foreach ($columns as $column) {
            if (Schema::hasColumn($table, $column)) {
                return $column;
            }
        }

        return $fallback;
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

    private function normalizeMaterialCode(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private function replaceRefPoValue(?string $value, string $oldRefPo, string $newRefPo): string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return $text;
        }

        $oldKey = strtolower(trim($oldRefPo));
        $parts = array_map('trim', explode(',', $text));
        $changed = false;

        $parts = array_map(function ($part) use ($oldKey, $newRefPo, &$changed) {
            if (strtolower(trim($part)) === $oldKey) {
                $changed = true;
                return $newRefPo;
            }

            return $part;
        }, $parts);

        return $changed ? implode(', ', $parts) : $text;
    }

    private function syncPurchaseRequirementRefPo(string $oldRefPo, string $newRefPo): void
    {
        $oldRefPo = trim($oldRefPo);
        $newRefPo = trim($newRefPo);

        if ($oldRefPo === '' || $newRefPo === '' || strcasecmp($oldRefPo, $newRefPo) === 0) {
            return;
        }

        $refPoMatches = function ($query) use ($oldRefPo) {
            $query->whereRaw('lower(trim(ref_po)) = lower(trim(?))', [$oldRefPo])
                ->orWhereRaw("find_in_set(lower(trim(?)), replace(lower(coalesce(ref_po, '')), ' ', '')) > 0", [$oldRefPo]);
        };

        DB::table('tb_pr')
            ->where($refPoMatches)
            ->orderBy('no_pr')
            ->get(['no_pr', 'ref_po'])
            ->each(function ($row) use ($oldRefPo, $newRefPo) {
                DB::table('tb_pr')
                    ->where('no_pr', $row->no_pr)
                    ->update([
                        'ref_po' => $this->replaceRefPoValue($row->ref_po, $oldRefPo, $newRefPo),
                    ]);
            });

        DB::table('tb_detailpr')
            ->where($refPoMatches)
            ->orderBy('no_pr')
            ->orderBy('no')
            ->get(['no_pr', 'no', 'ref_po'])
            ->each(function ($row) use ($oldRefPo, $newRefPo) {
                DB::table('tb_detailpr')
                    ->where('no_pr', $row->no_pr)
                    ->where('no', $row->no)
                    ->update([
                        'ref_po' => $this->replaceRefPoValue($row->ref_po, $oldRefPo, $newRefPo),
                    ]);
            });
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all' ? null : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        $statusFilter = $request->query('status', 'all');
        $dateFilter = $request->query('date_filter', 'today');
        $page = max(1, (int) $request->query('page', 1));

        return Inertia::render('marketing/purchase-order-in/index', [
            'purchaseOrderIns' => [],
            'summary' => [
                'total' => 0,
                'outstanding' => 0,
                'belum_pr' => 0,
                'realized' => 0,
                'data_counts' => [
                    'today' => 0, 'week' => 0, 'month' => 0, 'year' => 0,
                ]
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
        $perPage = $perPageInput === 'all' ? null : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        $statusFilter = $request->query('status', 'all');
        $page = max(1, (int) $request->query('page', 1));
        $isPartial = $request->boolean('is_partial', false);
        $summaryOnly = $request->boolean('summary_only', false);
        $summaryScope = (string) $request->query('summary_scope', 'all');
        $rowsOnly = $request->boolean('rows_only', false);
        $paginationOnly = $request->boolean('pagination_only', false);
        $dateFilter = (string) $request->query('date_filter', 'today');
        $startDate = (string) $request->query('start_date', '');
        $endDate = (string) $request->query('end_date', '');

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
            $endDate
        );
        $data['applied_filters'] = [
            'search' => $search,
            'status' => $statusFilter,
            'date_filter' => $dateFilter,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'page' => $page,
            'per_page' => $perPageInput,
        ];

        return response()->json($data)->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
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
        $endDate = ''
    ) {
        return (function () use ($search, $perPage, $statusFilter, $page, $isPartial, $summaryOnly, $summaryScope, $rowsOnly, $paginationOnly, $dateFilter, $startDate, $endDate) {
            $detailStats = DB::table('tb_detailpoin')
                ->select('kode_poin')
                ->selectRaw('count(*) as total_items')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtypr as decimal(18,4)), 0) <> coalesce(cast(qty as decimal(18,4)), 0) then 1 else 0 end) as changed_count')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtypr as decimal(18,4)), 0) > 0 then 1 else 0 end) as unrealized_items')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtypr as decimal(18,4)), 0) < coalesce(cast(qty as decimal(18,4)), 0) then 1 else 0 end) as started_items')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtydo as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) <> coalesce(cast(qty as decimal(18,4)), 0) then 1 else 0 end) as do_changed_count')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtydo as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) > 0 then 1 else 0 end) as do_unrealized_items')
                ->selectRaw('sum(case when coalesce(cast(sisa_qtydo as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) < coalesce(cast(qty as decimal(18,4)), 0) then 1 else 0 end) as do_started_items')
                ->groupBy('kode_poin');

            $doStats = DB::table('tb_kddo as kdo')
                ->selectRaw('lower(trim(kdo.ref_po)) as ref_po_key')
                ->selectRaw('count(*) as do_count')
                ->selectRaw("max(str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')) as last_do_date")
                ->whereRaw("trim(coalesce(kdo.ref_po, '')) <> ''")
                ->groupByRaw('lower(trim(kdo.ref_po))');

            $prStats = DB::table('tb_poin as pr_p')
                ->join('tb_pr as pr', function ($join) {
                    $join->whereRaw("find_in_set(lower(trim(pr_p.no_poin)), replace(lower(coalesce(pr.ref_po, '')), ' ', '')) > 0");
                })
                ->selectRaw('pr_p.no_poin as ref_po')
                ->selectRaw("max(coalesce(str_to_date(pr.date, '%d.%m.%Y'), str_to_date(pr.date, '%Y-%m-%d'))) as last_pr_date")
                ->groupBy('pr_p.no_poin');

            $now = now();
            $startToday = $now->copy()->startOfDay()->toDateTimeString();
            $endToday = $now->copy()->endOfDay()->toDateTimeString();
            $startWeek = $now->copy()->startOfWeek()->toDateTimeString();
            $endWeek = $now->copy()->endOfWeek()->toDateTimeString();
            $startMonth = $now->copy()->startOfMonth()->toDateTimeString();
            $endMonth = $now->copy()->endOfMonth()->toDateTimeString();
            $startYear = $now->copy()->startOfYear()->toDateTimeString();
            $endYear = $now->copy()->endOfYear()->toDateTimeString();

            if ($summaryOnly && $summaryScope !== 'all') {
                if ($summaryScope === 'total') {
                    $periodCounts = DB::table('tb_poin')
                        ->selectRaw("count(*) as total")
                        ->selectRaw("count(case when created_at >= ? then 1 end) as today", [$startToday])
                        ->selectRaw("count(case when created_at >= ? then 1 end) as week", [$startWeek])
                        ->selectRaw("count(case when created_at >= ? then 1 end) as month", [$startMonth])
                        ->selectRaw("count(case when created_at >= ? then 1 end) as year", [$startYear])
                        ->first();

                    return [
                        'summary' => [
                            'total' => (int) ($periodCounts->total ?? 0),
                            'data_counts' => [
                                'today' => (int) ($periodCounts->today ?? 0),
                                'week' => (int) ($periodCounts->week ?? 0),
                                'month' => (int) ($periodCounts->month ?? 0),
                                'year' => (int) ($periodCounts->year ?? 0),
                            ],
                        ],
                    ];
                }

                if ($summaryScope === 'outstanding' || $summaryScope === 'outstanding_pr' || $summaryScope === 'outstanding_do') {
                    $row = DB::table('tb_poin as p')
                        ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and ds.kode_poin is not null then 1 end) as outstanding_pr")
                        ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and ds.kode_poin is not null then 1 end) as outstanding_do")
                        ->first();

                    $summary = [];
                    if ($summaryScope === 'outstanding' || $summaryScope === 'outstanding_pr') {
                        $summary['outstanding_pr'] = (int) ($row->outstanding_pr ?? 0);
                    }
                    if ($summaryScope === 'outstanding' || $summaryScope === 'outstanding_do') {
                        $summary['outstanding_do'] = (int) ($row->outstanding_do ?? 0);
                    }

                    return ['summary' => $summary];
                }

                if ($summaryScope === 'sisa' || $summaryScope === 'sisa_pr' || $summaryScope === 'sisa_do') {
                    $row = DB::table('tb_poin as p')
                        ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->leftJoinSub($doStats, 'dos', function ($join) {
                            $join->whereRaw('dos.ref_po_key = lower(trim(p.no_poin))');
                        })
                        ->selectRaw("count(case when coalesce(ds.started_items, 0) > 0 and coalesce(ds.unrealized_items, 0) > 0 then 1 end) as sisa_pr")
                        ->selectRaw("count(case when coalesce(dos.do_count, 0) > 0 and coalesce(ds.do_unrealized_items, 0) > 0 then 1 end) as sisa_do")
                        ->first();

                    $summary = [];
                    if ($summaryScope === 'sisa' || $summaryScope === 'sisa_pr') {
                        $summary['sisa_pr'] = (int) ($row->sisa_pr ?? 0);
                    }
                    if ($summaryScope === 'sisa' || $summaryScope === 'sisa_do') {
                        $summary['sisa_do'] = (int) ($row->sisa_do ?? 0);
                    }

                    return ['summary' => $summary];
                }

                if ($summaryScope === 'realized' || $summaryScope === 'realized_pr' || $summaryScope === 'realized_do') {
                    $doCounts = DB::table('tb_kddo as kdo')
                        ->join('tb_poin as p', function ($join) {
                            $join->whereRaw('lower(trim(kdo.ref_po)) = lower(trim(p.no_poin))');
                        })
                        ->joinSub($detailStats, 'do_ds', function ($join) {
                            $join->on('do_ds.kode_poin', '=', 'p.kode_poin');
                        })
                        ->whereRaw("trim(coalesce(kdo.ref_po, '')) <> ''")
                        ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                        ->whereRaw('coalesce(do_ds.total_items, 0) > 0')
                        ->whereRaw('coalesce(do_ds.do_unrealized_items, 0) = 0')
                        ->selectRaw('count(distinct lower(trim(kdo.no_do))) as realized_do')
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_today", [$startToday, $endToday])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_week", [$startWeek, $endWeek])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_month", [$startMonth, $endMonth])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_year", [$startYear, $endYear])
                        ->first();

                    $row = DB::table('tb_poin as p')
                        ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->leftJoinSub($doStats, 'dos', function ($join) {
                            $join->whereRaw('dos.ref_po_key = lower(trim(p.no_poin))');
                        })
                        ->leftJoinSub($prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                        ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null then 1 end) as realized_pr")
                        ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_today", [$startToday, $endToday])
                        ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_week", [$startWeek, $endWeek])
                        ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_month", [$startMonth, $endMonth])
                        ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_year", [$startYear, $endYear])
                        ->first();

                    $summary = [];
                    if ($summaryScope === 'realized' || $summaryScope === 'realized_pr') {
                        $summary['realized_pr'] = (int) ($row->realized_pr ?? 0);
                        $summary['realized_pr_counts'] = [
                            'today' => (int) ($row->realized_pr_today ?? 0),
                            'week' => (int) ($row->realized_pr_week ?? 0),
                            'month' => (int) ($row->realized_pr_month ?? 0),
                            'year' => (int) ($row->realized_pr_year ?? 0),
                            'all' => (int) ($row->realized_pr ?? 0),
                        ];
                    }
                    if ($summaryScope === 'realized' || $summaryScope === 'realized_do') {
                        $summary['realized_do'] = (int) ($doCounts->realized_do ?? 0);
                        $summary['realized_do_counts'] = [
                            'today' => (int) ($doCounts->realized_do_today ?? 0),
                            'week' => (int) ($doCounts->realized_do_week ?? 0),
                            'month' => (int) ($doCounts->realized_do_month ?? 0),
                            'year' => (int) ($doCounts->realized_do_year ?? 0),
                            'all' => (int) ($doCounts->realized_do ?? 0),
                        ];
                    }

                    return ['summary' => $summary];
                }
            }

            $needsDoDate = in_array($statusFilter, ['sisa_do', 'realized', 'realized_do'], true);
            $needsPrDate = $statusFilter === 'realized_pr';

            if ($statusFilter === 'realized_do') {
                $doDateExpression = "str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')";
                $query = DB::table('tb_kddo as kdo')
                    ->join('tb_poin as p', function ($join) {
                        $join->whereRaw('lower(trim(kdo.ref_po)) = lower(trim(p.no_poin))');
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

                $total = DB::query()->fromSub(clone $query, 'realized_do_rows')->count();
                $rows = $perPage === null
                    ? (clone $query)->orderByDesc('last_do_date')->orderByDesc('no_do')->get()
                    : (clone $query)->orderByDesc('last_do_date')->orderByDesc('no_do')->forPage($page, $perPage)->get();

                return [
                    'purchaseOrderIns' => $rows,
                    'pagination' => [
                        'total' => $total,
                        'page' => $page,
                        'per_page' => $perPage === null ? 'all' : $perPage,
                        'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
                    ],
                ];
            }

            $query = DB::table('tb_poin as p')
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
                'sisa_pr', 'sisa_do', 'realized', 'realized_do', 'realized_pr'
            ], true);

            if ($requiresDs) {
                $query->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin');
            }

            $query->leftJoinSub($doStats, 'dos', function ($join) {
                $join->whereRaw('dos.ref_po_key = lower(trim(p.no_poin))');
            })->selectRaw('case when coalesce(dos.do_count, 0) > 0 then 1 else 0 end as has_do');

            if ($needsDoDate) {
                $query->selectRaw('dos.last_do_date as last_do_date');
            }

            if ($needsPrDate) {
                $query->leftJoinSub($prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                    ->selectRaw('prs.last_pr_date as last_pr_date');
            }

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
                $query->whereRaw('coalesce(ds.started_items, 0) > 0')
                    ->whereRaw('coalesce(ds.unrealized_items, 0) > 0');
            } elseif ($statusFilter === 'sisa_do') {
                $query->whereRaw('coalesce(dos.do_count, 0) > 0')
                    ->whereRaw('coalesce(ds.do_unrealized_items, 0) > 0');
            } elseif ($statusFilter === 'realized' || $statusFilter === 'realized_do') {
                $query->whereRaw('coalesce(ds.do_unrealized_items, 0) = 0')
                    ->whereRaw('coalesce(dos.do_count, 0) > 0');
            } elseif ($statusFilter === 'realized_pr') {
                $query->whereRaw('coalesce(ds.unrealized_items, 0) = 0')
                    ->whereRaw('coalesce(ds.started_items, 0) > 0')
                    ->whereNotNull('prs.last_pr_date');
            }

            if ($statusFilter === 'realized_pr') {
                if ($dateFilter === 'today') {
                    $query->whereBetween('prs.last_pr_date', [$startToday, $endToday]);
                } elseif ($dateFilter === 'this_week') {
                    $query->whereBetween('prs.last_pr_date', [$startWeek, $endWeek]);
                } elseif ($dateFilter === 'this_month') {
                    $query->whereBetween('prs.last_pr_date', [$startMonth, $endMonth]);
                } elseif ($dateFilter === 'this_year') {
                    $query->whereBetween('prs.last_pr_date', [$startYear, $endYear]);
                } elseif ($dateFilter === 'range') {
                    if ($startDate !== '' && $endDate !== '') {
                        $query->whereDate('prs.last_pr_date', '>=', $startDate)
                            ->whereDate('prs.last_pr_date', '<=', $endDate);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }
            } else {
                if ($dateFilter === 'today') {
                    $query->whereDate('p.created_at', $now->toDateString());
                } elseif ($dateFilter === 'this_week') {
                    $query->whereDate('p.created_at', '>=', $now->copy()->startOfWeek()->toDateString())
                        ->whereDate('p.created_at', '<=', $now->copy()->endOfWeek()->toDateString());
                } elseif ($dateFilter === 'this_month') {
                    $query->whereYear('p.created_at', $now->year)
                        ->whereMonth('p.created_at', $now->month);
                } elseif ($dateFilter === 'this_year') {
                    $query->whereYear('p.created_at', $now->year);
                } elseif ($dateFilter === 'range') {
                    if ($startDate !== '' && $endDate !== '') {
                        $query->whereDate('p.created_at', '>=', $startDate)
                            ->whereDate('p.created_at', '<=', $endDate);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }
            }

            if ($summaryOnly) {
                $total = 0;
                $rows = collect();
            } else {
                $total = $rowsOnly ? null : (clone $query)->count();
                $rows = $paginationOnly
                    ? collect()
                    : ($perPage === null
                        ? (clone $query)->orderByDesc('p.id')->get()
                        : (clone $query)
                            ->orderByDesc('p.id')
                            ->forPage($page, $perPage)
                            ->get());

                if ($isPartial) {
                    $response = [];
                    if (!$paginationOnly) {
                        $response['purchaseOrderIns'] = $rows;
                    }
                    if (!$rowsOnly) {
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

            $cacheKey = $this->poinCacheKey('main_summary');
            $summary = \Illuminate\Support\Facades\Cache::tags(self::POIN_CACHE_TAGS)->remember($cacheKey, now()->addMinutes(60), function () use ($detailStats, $doStats, $prStats, $startToday, $startWeek, $startMonth, $startYear, $endToday, $endWeek, $endMonth, $endYear) {
                $statusData = DB::table('tb_poin as p')
                    ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                    ->leftJoinSub($doStats, 'dos', function ($join) {
                        $join->whereRaw('dos.ref_po_key = lower(trim(p.no_poin))');
                    })
                    ->leftJoinSub($prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                    ->selectRaw("count(*) as total")
                    ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and ds.kode_poin is not null then 1 end) as outstanding")
                    ->selectRaw("count(case when coalesce(ds.do_started_items, 0) > 0 and coalesce(ds.do_unrealized_items, 0) > 0 then 1 end) as belum_pr")
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date is not null then 1 end) as realized")
                    ->selectRaw("count(case when coalesce(ds.changed_count, 0) = 0 and ds.kode_poin is not null then 1 end) as outstanding_pr")
                    ->selectRaw("count(case when coalesce(ds.do_changed_count, 0) = 0 and ds.kode_poin is not null then 1 end) as outstanding_do")
                    ->selectRaw("count(case when coalesce(ds.started_items, 0) > 0 and coalesce(ds.unrealized_items, 0) > 0 then 1 end) as sisa_pr")
                    ->selectRaw("count(case when coalesce(dos.do_count, 0) > 0 and coalesce(ds.do_unrealized_items, 0) > 0 then 1 end) as sisa_do")
                    ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null then 1 end) as realized_pr")
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and coalesce(dos.do_count, 0) > 0 then 1 end) as realized_do")
                    ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null and prs.last_pr_date >= ? then 1 end) as realized_pr_today", [$startToday])
                    ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null and prs.last_pr_date >= ? then 1 end) as realized_pr_week", [$startWeek])
                    ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null and prs.last_pr_date >= ? then 1 end) as realized_pr_month", [$startMonth])
                    ->selectRaw("count(case when coalesce(ds.unrealized_items, 0) = 0 and coalesce(ds.started_items, 0) > 0 and prs.last_pr_date is not null and prs.last_pr_date >= ? then 1 end) as realized_pr_year", [$startYear])
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_today", [$startToday, $endToday])
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_week", [$startWeek, $endWeek])
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_month", [$startMonth, $endMonth])
                    ->selectRaw("count(case when coalesce(ds.do_unrealized_items, 0) = 0 and dos.last_do_date between ? and ? then 1 end) as realized_do_year", [$startYear, $endYear])
                    ->first();

                $periodCounts = DB::table('tb_poin')
                    ->selectRaw("count(case when created_at >= ? then 1 end) as today", [$startToday])
                    ->selectRaw("count(case when created_at >= ? then 1 end) as week", [$startWeek])
                    ->selectRaw("count(case when created_at >= ? then 1 end) as month", [$startMonth])
                    ->selectRaw("count(case when created_at >= ? then 1 end) as year", [$startYear])
                    ->first();

                return [
                    'total'      => (int) $statusData->total,
                    'outstanding' => (int) $statusData->outstanding,
                    'belum_pr'   => (int) $statusData->belum_pr,
                    'realized'   => (int) $statusData->realized,
                    'outstanding_pr' => (int) ($statusData->outstanding_pr ?? 0),
                    'outstanding_do' => (int) ($statusData->outstanding_do ?? 0),
                    'sisa_pr' => (int) ($statusData->sisa_pr ?? 0),
                    'sisa_do' => (int) ($statusData->sisa_do ?? 0),
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
                        'week'  => (int) $periodCounts->week,
                        'month' => (int) $periodCounts->month,
                        'year'  => (int) $periodCounts->year,
                    ]
                ];
            });

            $base = DB::table('tb_poin as p')
                ->leftJoinSub($detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                ->leftJoinSub($doStats, 'dos', function ($join) {
                    $join->whereRaw('dos.ref_po_key = lower(trim(p.no_poin))');
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

        if (!$purchaseOrderIn) {
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        $purchaseOrderInItems = DB::table('tb_detailpoin as d')
            ->where('d.kode_poin',  $kodePoin)
            ->addSelect([
                'd.*',
                'has_pr' => DB::table('tb_detailpr as pr')
                    ->whereRaw("lower(trim(pr.ref_po)) = lower(trim(?))", [(string)$purchaseOrderIn->no_poin])
                    ->whereRaw("lower(trim(pr.for_customer)) = lower(trim(?))", [(string)$purchaseOrderIn->customer_name])
                    ->whereColumn('pr.kd_material', 'd.kd_material')
                    ->selectRaw('count(*)')
            ])
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

    public function show(Request $request, $kodePoin)
    {
        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $page = max(1, (int) $request->query('page', 1));
        
        $data = (function () use ($kodePoin, $search, $perPageInput, $page) {
            $header = DB::table('tb_poin')->where('kode_poin', $kodePoin)->first();

            if (!$header) {
                return null; // Akan ditangani di bawah
            }

            $perPage = $perPageInput === 'all'
                ? null
                : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
            if ($perPage !== null && $perPage < 1) {
                $perPage = 5;
            }

            $query = DB::table('tb_detailpoin')->where('kode_poin', $kodePoin);
            if ($search !== '') {
                $like = '%'.strtolower($search).'%';
                $query->whereRaw('lower(material) like ?', [$like]);
            }

            $total = (clone $query)->count();

            if ($perPage === null) {
                $items = (clone $query)->orderBy('id')->get();
            } else {
                $items = (clone $query)->orderBy('id')->forPage($page, $perPage)->get();
            }

            return [
                'header' => $header,
                'items' => $items,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage === null ? 'all' : $perPage,
                    'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
                ],
            ];
        })();

        if (!$data) {
            return response()->json(['message' => 'Data PO In tidak ditemukan.'], 404);
        }

        return response()->json($data);
    }

    public function print($kodePoin)
    {
        $data = (function () use ($kodePoin) {
            $header = DB::table('tb_poin')->where('kode_poin', $kodePoin)->first();
            if (!$header) return null;

            $items = DB::table('tb_detailpoin')->where('kode_poin', $kodePoin)->orderBy('id')->get();

            $customer = null;
            if (isset($header->kode_customer)) {
                $customer = DB::table('tb_cs')->where('kd_cs', $header->kode_customer)->first();
            }

            return ['header' => $header, 'items' => $items, 'customer' => $customer];
        })();

        if (!$data) {
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

        // Menggunakan tag 'material_data' yang sama persis seperti di MaterialController
        $cacheKey = $this->poinCacheKey('materials', [$search, $perPageInput, $page], $request);

        $data = Cache::tags(self::MATERIAL_CACHE_TAGS)->remember($cacheKey, self::LOOKUP_CACHE_TTL, function () use ($search, $perPageInput, $page) {
            $codeColumn = $this->firstExistingColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
            $nameColumn = $this->firstExistingColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
            $unitColumn = $this->firstExistingColumn('tb_barang', ['unit', 'satuan'], 'unit');
            $stockTotal = $this->barangStockTotalExpression();

            $query = DB::table('tb_barang')->selectRaw("
                {$codeColumn} as kd_material,
                {$nameColumn} as material,
                {$unitColumn} as unit,
                cast(coalesce(cast(stok_g1 as decimal(65,4)), 0) as signed) as stok_g1,
                cast(coalesce(cast(stok_g2 as decimal(65,4)), 0) as signed) as stok_g2,
                cast(coalesce(cast(stok_g3 as decimal(65,4)), 0) as signed) as stok_g3,
                cast(coalesce(cast(stok_g4 as decimal(65,4)), 0) as signed) as stok_g4,
                cast({$stockTotal} as signed) as stok
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
                return ['materials' => $materials, 'total' => $materials->count()];
            }

            $perPage = $perPageInput === 'all'
                ? null
                : (is_numeric($perPageInput) ? (int) $perPageInput : 10);
            if ($perPage !== null && $perPage < 1) {
                $perPage = 10;
            }

            if ($perPage === null) {
                $materials = (clone $query)->orderBy($nameColumn)->get();
                return ['materials' => $materials, 'total' => $materials->count()];
            }

            $total = (clone $query)->count();
            $materials = (clone $query)->orderBy($nameColumn)->forPage($page, $perPage)->get();

            return [
                'materials' => $materials,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
            ];
        });

        return response()->json($data);
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
        $lastKdMaterial = DB::table('tb_barang')->max($codeColumn);
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
                if (Schema::hasColumn('tb_barang', $column)) {
                    $insertData[$column] = $value;
                }
            }

            DB::table('tb_barang')->insert($insertData);

            // [FLUSH] Sinkronisasi otomatis menghapus memori 'material_data'
            Cache::tags(self::MATERIAL_CACHE_TAGS)->flush();

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

        $cacheKey = $this->poinCacheKey('customers', [$search, $perPageInput, $page], $request);

        $data = Cache::tags(self::CUSTOMER_CACHE_TAGS)->remember($cacheKey, self::LOOKUP_CACHE_TTL, function () use ($search, $perPageInput, $page) {
            $perPage = $perPageInput === 'all'
                ? null
                : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
            if ($perPage !== null && $perPage < 1) {
                $perPage = 5;
            }

            $query = DB::table('tb_cs')->select('kd_cs', 'nm_cs', 'kota_cs');
            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $like = '%'.strtolower($search).'%';
                    $q->whereRaw('lower(kd_cs) like ?', [$like])
                        ->orWhereRaw('lower(nm_cs) like ?', [$like])
                        ->orWhereRaw('lower(kota_cs) like ?', [$like]);
                });
            }

            if ($perPage === null) {
                $data = (clone $query)->orderBy('nm_cs')->get();
                return ['customers' => $data, 'total' => $data->count()];
            }

            $total = (clone $query)->count();
            $data = (clone $query)->orderBy('nm_cs')->forPage($page, $perPage)->get();

            return [
                'customers' => $data,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
            ];
        });

        return response()->json($data);
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

        $lastCode = DB::table('tb_cs')
            ->where('kd_cs', 'like', 'CST%')
            ->orderBy('kd_cs', 'desc')
            ->value('kd_cs');
        $lastNumber = $lastCode ? (int) substr((string) $lastCode, 3) : 0;
        $nextCode = 'CST'.str_pad((string) ($lastNumber + 1), 7, '0', STR_PAD_LEFT);
        $validated['kd_cs'] = $nextCode;

        try {
            DB::table('tb_cs')->insert($validated);
            
            // [FLUSH] Bersihkan cache jika ada customer baru
            Cache::tags(self::CUSTOMER_CACHE_TAGS)->flush();

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

        $noPoin = trim((string) $validated['no_poin']);
        $duplicateExists = DB::table('tb_poin')
            ->whereRaw('lower(trim(no_poin)) = lower(trim(?))', [$noPoin])
            ->exists();

        if ($duplicateExists) {
            throw ValidationException::withMessages([
                'no_poin' => "No PO In {$noPoin} sudah ada di database.",
            ]);
        }

        try {
            DB::transaction(function () use ($request, $validated, $noPoin) {
                $duplicateExists = DB::table('tb_poin')
                    ->whereRaw('lower(trim(no_poin)) = lower(trim(?))', [$noPoin])
                    ->lockForUpdate()
                    ->exists();

                if ($duplicateExists) {
                    throw ValidationException::withMessages([
                        'no_poin' => "No PO In {$noPoin} sudah ada di database.",
                    ]);
                }

                $nowGmt8 = now('Asia/Singapore');
                $kodePoin = $this->generateKodePoin($request);
                $datePoin = $this->parseDateOrNull($validated['date'] ?? null);
                $deliveryDate = $this->parseDateOrNull($validated['delivery_date'] ?? null);

                $ppnPercentInput = (float) ($validated['ppn_percent'] ?? 0);
                $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
                $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);

                $totalPrice = (float) ($validated['total_price'] ?? 0);
                if ($totalPrice <= 0 && is_array($validated['materials'] ?? null)) {
                    $totalPrice = collect($validated['materials'])->sum(function ($item) {
                        $qty = (float) ($item['qty'] ?? 0);
                        $price = (float) ($item['price_po_in'] ?? 0);
                        return $qty * $price;
                    });
                }

                $dpp = $ppnPercentInput > 0
                    ? round((11 / $ppnPercentInput) * $totalPrice, 2)
                    : $totalPrice;
                $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
                $grandTotal = round($totalPrice + $ppnValue, 2);

                $headerId = (int) (DB::table('tb_poin')->max('id') ?? 0) + 1;
                DB::table('tb_poin')->insert([
                    'id' => $headerId,
                    'kode_poin' => $kodePoin,
                    'no_poin' => $noPoin,
                    'date_poin' => $datePoin,
                    'delivery_date' => $deliveryDate,
                    'kode_customer' => trim((string) ($validated['kd_customer'] ?? '')),
                    'customer_name' => trim((string) $validated['customer_name']),
                    'payment_term' => trim((string) ($validated['payment_term'] ?? '')),
                    'franco_loco' => trim((string) $validated['franco_loco']),
                    'note_doc' => trim((string) ($validated['note'] ?? '')),
                    'ppn_input_percent' => $ppnPercentInputValue,
                    'ppn_percent_used' => $ppnPercentUsed,
                    'total_price' => $totalPrice,
                    'dpp' => $dpp,
                    'ppn_amount' => $ppnValue,
                    'grand_total' => $grandTotal,
                    'created_at' => $nowGmt8,
                    'updated_at' => $nowGmt8,
                ]);

                $detailId = (int) (DB::table('tb_detailpoin')->max('id') ?? 0) + 1;
                $detailData = [];
                foreach (($validated['materials'] ?? []) as $index => $item) {
                    $qty = (float) ($item['qty'] ?? 0);
                    $price = (float) ($item['price_po_in'] ?? 0);
                    $totalDetail = isset($item['total_price_po_in'])
                        ? (float) $item['total_price_po_in']
                        : ($qty * $price);

                    $kdMaterial = $this->normalizeMaterialCode($item['kd_material'] ?? null);

                    $detailData[] = [
                        'id' => $detailId + $index,
                        'id_poin' => $headerId,
                        'kode_poin' => $kodePoin,
                        'kd_material' => $kdMaterial,
                        'material' => trim((string) ($item['material'] ?? '')),
                        'qty' => $qty,
                        'sisa_qtypr' => $qty,
                        'sisa_qtydo' => $qty,
                        'satuan' => trim((string) ($item['satuan'] ?? '')),
                        'price_po_in' => $price,
                        'total_price_po_in' => $totalDetail,
                        'remark' => trim((string) ($item['remark'] ?? '')),
                        'created_at' => $nowGmt8,
                        'updated_at' => $nowGmt8,
                    ];
                }

                if (!empty($detailData)) {
                    DB::table('tb_detailpoin')->insert($detailData);
                    DB::table('tb_detailpoin')
                        ->where('kode_poin', $kodePoin)
                        ->update([
                            'sisa_qtypr' => DB::raw('qty'),
                        ]);
                }
            });

            // [FLUSH] Kosongkan cache agar tampilan tabel di depan (index) otomatis terbarui
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            if ($request->header('X-Inertia')) {
                return redirect()
                    ->route('marketing.purchase-order-in.index')
                    ->with('success', 'Data PO IN berhasil disimpan.');
            }
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil disimpan.');
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
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

        if (!$exists) {
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        $validated = $request->validate([
            'no_poin' => ['required', 'string', 'max:100'],
            'date' => ['nullable', 'string', 'max:20'],
            'delivery_date' => ['nullable', 'string', 'max:20'],
            'customer_name' => ['required', 'string', 'max:255'],
            'payment_term' => ['nullable', 'string', 'max:100'],
            'ppn_percent' => ['required', 'numeric', 'min:0'],
            'franco_loco' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'total_price' => ['nullable', 'numeric', 'min:0'],
            'dpp' => ['nullable', 'numeric', 'min:0'],
            'ppn_value' => ['nullable', 'numeric', 'min:0'],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        try {
            DB::transaction(function () use ($validated, $kodePoin) {
                $header = DB::table('tb_poin')
                    ->where('kode_poin', $kodePoin)
                    ->lockForUpdate()
                    ->first(['kode_poin', 'no_poin']);

                if (!$header) {
                    throw new \RuntimeException('Data PO In tidak ditemukan.');
                }

                $oldNoPoin = trim((string) ($header->no_poin ?? ''));
                $newNoPoin = trim((string) $validated['no_poin']);

                $duplicateExists = DB::table('tb_poin')
                    ->whereRaw('lower(trim(no_poin)) = lower(trim(?))', [$newNoPoin])
                    ->where('kode_poin', '<>', $kodePoin)
                    ->exists();

                if ($duplicateExists) {
                    throw ValidationException::withMessages([
                        'no_poin' => "No PO In {$newNoPoin} sudah ada di database.",
                    ]);
                }

                $nowGmt8 = now('Asia/Singapore');
                $datePoin = $this->parseDateOrNull($validated['date'] ?? null);
                $deliveryDate = $this->parseDateOrNull($validated['delivery_date'] ?? null);
                $ppnPercentInput = (float) ($validated['ppn_percent'] ?? 0);
                $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
                $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);

                $totalPrice = (float) (DB::table('tb_detailpoin')
                    ->where('kode_poin', $kodePoin)
                    ->selectRaw('coalesce(sum(coalesce(cast(qty as decimal(18,4)), 0) * coalesce(cast(price_po_in as decimal(18,4)), 0)), 0) as total_price')
                    ->value('total_price') ?? 0);

                $dpp = $ppnPercentInput > 0
                    ? round((11 / $ppnPercentInput) * $totalPrice, 2)
                    : $totalPrice;
                $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
                $grandTotal = round($totalPrice + $ppnValue, 2);

                DB::table('tb_poin')
                    ->where('kode_poin', $kodePoin)
                    ->update([
                        'no_poin' => $newNoPoin,
                        'date_poin' => $datePoin,
                        'delivery_date' => $deliveryDate,
                        'customer_name' => trim((string) $validated['customer_name']),
                        'payment_term' => trim((string) ($validated['payment_term'] ?? '')),
                        'franco_loco' => trim((string) $validated['franco_loco']),
                        'note_doc' => trim((string) ($validated['note'] ?? '')),
                        'ppn_input_percent' => $ppnPercentInputValue,
                        'ppn_percent_used' => $ppnPercentUsed,
                        'total_price' => $totalPrice,
                        'dpp' => $dpp,
                        'ppn_amount' => $ppnValue,
                        'grand_total' => $grandTotal,
                        'updated_at' => $nowGmt8,
                    ]);

                $this->syncPurchaseRequirementRefPo($oldNoPoin, $newNoPoin);
            });

            // [FLUSH] Kosongkan cache saat PO In di-update
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            if ($request->header('X-Inertia')) {
                session()->flash('success', 'Data PO IN berhasil diperbarui.');
                return inertia_location('/marketing/purchase-order-in');
            }
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil diperbarui.');
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal memperbarui data: ' . $e->getMessage());
        }
    }

    public function destroy(Request $request, $kodePoin)
    {
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first();

        if (!$header) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Data PO In tidak ditemukan.'], 404);
            }
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($kodePoin) {
                DB::table('tb_detailpoin')
                    ->where('kode_poin', $kodePoin)
                    ->delete();

                DB::table('tb_poin')
                    ->where('kode_poin', $kodePoin)
                    ->delete();
            });

            // [FLUSH] Bersihkan cache jika dihapus
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            if ($request->header('X-Inertia')) {
                session()->flash('success', 'PO In berhasil dihapus.');
                return inertia_location('/marketing/purchase-order-in');
            }

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil dihapus.');
        } catch (\Throwable $e) {
            if ($request->expectsJson()) {
                return response()->json(['message' => $e->getMessage()], 500);
            }
            return back()->with('error', 'Gagal menghapus data: ' . $e->getMessage());
        }
    }

    public function storeDetail(Request $request, $kodePoin)
    {
        try {
            $header = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->first(['id']);

            if (!$header) {
                return response()->json([
                    'message' => 'Data PO In tidak ditemukan.',
                ], 404);
            }

            $validated = $request->validate([
                'kd_material' => ['nullable', 'numeric'],
                'material' => ['required', 'string', 'max:255'],
                'qty' => ['required', 'numeric', 'min:0.0001'],
                'satuan' => ['nullable', 'string', 'max:100'],
                'price_po_in' => ['required', 'numeric', 'min:0'],
                'total_price_po_in' => ['nullable', 'numeric', 'min:0'],
                'remark' => ['nullable', 'string'],
            ]);

            $qty = (float) ($validated['qty'] ?? 0);
            $price = (float) ($validated['price_po_in'] ?? 0);
            $total = array_key_exists('total_price_po_in', $validated)
                ? (float) $validated['total_price_po_in']
                : ($qty * $price);
            $nowGmt8 = now('Asia/Singapore');

            $kdMaterial = $this->normalizeMaterialCode($validated['kd_material'] ?? null);
            $sisaQtyPr = $qty;
            $detailId = ((int) (DB::table('tb_detailpoin')->max('id') ?? 0)) + 1;

            DB::table('tb_detailpoin')->insert([
                'id' => $detailId,
                'id_poin' => $header->id,
                'kode_poin' => $kodePoin,
                'kd_material' => $kdMaterial,
                'material' => trim((string) $validated['material']),
                'qty' => $qty,
                'sisa_qtypr' => $sisaQtyPr,
                'sisa_qtydo' => $qty,
                'satuan' => trim((string) ($validated['satuan'] ?? '')),
                'price_po_in' => $price,
                'total_price_po_in' => $total,
                'remark' => trim((string) ($validated['remark'] ?? '')),
                'created_at' => $nowGmt8,
                'updated_at' => $nowGmt8,
            ]);

            $this->recalculateHeaderTotals($kodePoin);
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            return response()->json([
                'message' => 'Material berhasil ditambahkan.',
                'detail' => [
                    'id' => $detailId,
                    'sisa_qtypr' => $sisaQtyPr,
                    'sisa_qtydo' => $qty,
                ],
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateDetail(Request $request, $kodePoin, $detailId)
    {
        try {
            $headerExists = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->exists();

            if (!$headerExists) {
                return response()->json([
                    'message' => 'Data PO In tidak ditemukan.',
                ], 404);
            }

            $detail = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->first();

            if (!$detail) {
                return response()->json([
                    'message' => 'Data material tidak ditemukan.',
                ], 404);
            }

            $validated = $request->validate([
                'kd_material' => ['nullable', 'numeric'],
                'material' => ['required', 'string', 'max:255'],
                'qty' => ['required', 'numeric', 'min:0.0001'],
                'satuan' => ['nullable', 'string', 'max:100'],
                'price_po_in' => ['required', 'numeric', 'min:0'],
                'total_price_po_in' => ['nullable', 'numeric', 'min:0'],
                'remark' => ['nullable', 'string'],
            ]);

            $qty = (float) ($validated['qty'] ?? 0);
            $originalQty = (float) ($detail->qty ?? 0);
            $sisaQtyPrBefore = (float) ($detail->sisa_qtypr ?? 0);
            $usedQtyPr = max(0, $originalQty - $sisaQtyPrBefore);

            if ($sisaQtyPrBefore == 0.0 && $qty <= $originalQty) {
                return response()->json([
                    'message' => 'Sisa Qty PR sudah 0. Qty harus lebih dari qty awal.',
                ], 422);
            }

            if ($sisaQtyPrBefore != 0.0 && $qty < $usedQtyPr) {
                return response()->json([
                    'message' => 'Qty tidak boleh kurang dari qty yang sudah ada pada tb_detailpr.',
                ], 422);
            }

            $sisaQtyDoBefore = (float) ($detail->sisa_qtydo ?? $originalQty);
            $usedQtyDo = max(0, $originalQty - $sisaQtyDoBefore);
            if ($qty < $usedQtyDo) {
                return response()->json([
                    'message' => 'Qty tidak boleh kurang dari qty yang sudah ada penerimaan material (MI).',
                ], 422);
            }

            $price = (float) ($validated['price_po_in'] ?? 0);
            $total = array_key_exists('total_price_po_in', $validated)
                ? (float) $validated['total_price_po_in']
                : ($qty * $price);
            $nowGmt8 = now('Asia/Singapore');

            $kdMaterial = $this->normalizeMaterialCode($validated['kd_material'] ?? null);
            $sisaQtyPr = max(0, $sisaQtyPrBefore + ($qty - $originalQty));

            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->update([
                    'kd_material' => $kdMaterial,
                    'material' => trim((string) $validated['material']),
                    'qty' => $qty,
                    'sisa_qtypr' => $sisaQtyPr,
                    'sisa_qtydo' => $qty,
                    'satuan' => trim((string) ($validated['satuan'] ?? '')),
                    'price_po_in' => $price,
                    'total_price_po_in' => $total,
                    'remark' => trim((string) ($validated['remark'] ?? '')),
                    'updated_at' => $nowGmt8,
                ]);

            $this->recalculateHeaderTotals($kodePoin);
            // [FLUSH] Bersihkan cache
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            return response()->json([
                'message' => 'Material berhasil diperbarui.',
                'updated_at' => $nowGmt8,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroyDetail($kodePoin, $detailId)
    {
        try {
            $headerExists = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->exists();

            if (!$headerExists) {
                return response()->json([
                    'message' => 'Data PO In tidak ditemukan.',
                ], 404);
            }

            $detail = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->first();

            if (!$detail) {
                return response()->json([
                    'message' => 'Data material tidak ditemukan.',
                ], 404);
            }

            $poHeader = DB::table('tb_poin')->where('kode_poin', $kodePoin)->first();
            if ($poHeader) {
                $hasPr = DB::table('tb_detailpr')
                    ->whereRaw("lower(trim(ref_po)) = lower(trim(?))", [(string)$poHeader->no_poin])
                    ->whereRaw("lower(trim(for_customer)) = lower(trim(?))", [(string)$poHeader->customer_name])
                    ->where('kd_material', $detail->kd_material)
                    ->exists();

                if ($hasPr) {
                    return response()->json([
                        'message' => 'Material tidak dapat dihapus karena sudah dibuat PR.',
                    ], 422);
                }
            }

            if (isset($detail->sisa_qtypr) && isset($detail->qty) && isset($detail->sisa_qtydo)) {
                $sisaQtyPr = (float)($detail->sisa_qtypr ?? 0);
                $sisaQtyDo = (float)($detail->sisa_qtydo ?? 0);
                $qty = (float)($detail->qty ?? 0);
                if ($sisaQtyPr < $qty) {
                    return response()->json([
                        'message' => 'Material tidak dapat dihapus karena sudah dibuat PR.',
                    ], 422);
                }
                if ($sisaQtyDo < $qty) {
                    return response()->json([
                        'message' => 'Material tidak dapat dihapus karena sudah ada penerimaan material (MI).',
                    ], 422);
                }
            }

            $count = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->count();

            if ($count <= 1) {
                return response()->json([
                    'message' => 'Gagal menghapus. Minimal harus ada 1 material dalam PO In.',
                ], 400);
            }

            $deleted = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->delete();

            if (!$deleted) {
                return response()->json([
                    'message' => 'Data material tidak ditemukan.',
                ], 404);
            }

            $this->recalculateHeaderTotals($kodePoin);
            // [FLUSH] Bersihkan cache
            Cache::tags(self::POIN_CACHE_TAGS)->flush();

            return response()->json([
                'message' => 'Material berhasil dihapus.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
