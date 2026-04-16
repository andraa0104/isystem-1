<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Carbon\Carbon;

class PurchaseRequirementController
{
    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        // Initially we send empty data or zeros for fast page load
        return Inertia::render('marketing/purchase-requirement/index', [
            'purchaseRequirements' => [],
            'outstandingCount' => 0,
            'sisaPoCount' => 0,
            'realizedCount' => 0,
            'outstandingTotal' => 0,
            'sisaPoTotal' => 0,
            'realizedTotal' => 0,
            'period' => $period,
            'realizedDeferred' => false,
        ]);
    }

    public function data(Request $request)
    {
        $period = $request->query('period', 'today');
        
        $summary = $this->getPurchaseRequirementSummary($period);
        $purchaseRequirements = $this->getPurchaseRequirementList($period);

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
            'outstandingCount' => $summary['outstandingCount'],
            'outstandingTotal' => $summary['outstandingTotal'],
            'sisaPoCount' => $summary['sisaPoCount'],
            'sisaPoTotal' => $summary['sisaPoTotal'],
            'realizedCount' => $summary['realizedCount'],
            'realizedTotal' => $summary['realizedTotal'],
        ]);
    }

    private function getCommonQueries($period)
    {
        $docDateExpr = "coalesce(date(tgl), str_to_date(tgl, '%Y-%m-%d'), str_to_date(tgl, '%Y/%m/%d'), str_to_date(tgl, '%d/%m/%Y'), str_to_date(tgl, '%d-%m-%Y'), str_to_date(tgl, '%d.%m.%Y'))";

        $detailAgg = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                DB::raw('sum(coalesce(total_price, 0)) as total_price_sum'),
                DB::raw('count(*) as total_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) >= coalesce(cast(qty as decimal(18,4)), 0) and coalesce(cast(qty as decimal(18,4)), 0) > 0 then 1 else 0 end) as untouched_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) <> coalesce(cast(qty as decimal(18,4)), 0) then 1 else 0 end) as touched_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), 0) <= 0 then 1 else 0 end) as realized_items')
            )
            ->groupBy('no_pr');

        $poAgg = DB::table('tb_detailpo')
            ->select(
                'ref_pr',
                DB::raw("max({$docDateExpr}) as latest_po_date")
            )
            ->whereNotNull('ref_pr')
            ->groupBy('ref_pr');

        $now = now();
        $startDate = null;
        $endDate = null;

        if ($period === 'today') {
            $startDate = $endDate = $now->toDateString();
        } elseif ($period === 'this_week') {
            $startDate = $now->startOfWeek()->toDateString();
            $endDate = $now->endOfWeek()->toDateString();
        } elseif ($period === 'this_month') {
            $startDate = $now->startOfMonth()->toDateString();
            $endDate = $now->endOfMonth()->toDateString();
        } elseif ($period === 'this_year') {
            $startDate = $now->startOfYear()->toDateString();
            $endDate = $now->endOfYear()->toDateString();
        }

        $periodFilterRaw = "1=1";
        if ($startDate && $endDate) {
            $periodFilterRaw = "latest_po_date between '{$startDate}' and '{$endDate}'";
        }

        return compact('detailAgg', 'poAgg', 'periodFilterRaw');
    }

    private function getPurchaseRequirementSummary($period)
    {
        $common = $this->getCommonQueries($period);
        $detailAgg = $common['detailAgg'];
        $poAgg = $common['poAgg'];
        $periodFilterRaw = $common['periodFilterRaw'];

        $summaryData = DB::table('tb_pr as pr')
            ->joinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
            ->leftJoinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
            ->select(
                DB::raw('sum(case when detail.total_items > 0 and detail.untouched_items = detail.total_items then 1 else 0 end) as outstanding_count'),
                DB::raw('sum(case when detail.total_items > 0 and detail.untouched_items = detail.total_items then detail.total_price_sum else 0 end) as outstanding_total'),
                DB::raw('sum(case when detail.total_items > 0 and detail.untouched_items < detail.total_items and detail.realized_items < detail.total_items then 1 else 0 end) as sisa_po_count'),
                DB::raw('sum(case when detail.total_items > 0 and detail.untouched_items < detail.total_items and detail.realized_items < detail.total_items then detail.total_price_sum else 0 end) as sisa_po_total'),
                DB::raw("sum(case when detail.total_items > 0 and detail.realized_items = detail.total_items and {$periodFilterRaw} then 1 else 0 end) as realized_count"),
                DB::raw("sum(case when detail.total_items > 0 and detail.realized_items = detail.total_items and {$periodFilterRaw} then detail.total_price_sum else 0 end) as realized_total")
            )
            ->first();

        return [
            'outstandingCount' => (int) ($summaryData->outstanding_count ?? 0),
            'outstandingTotal' => (float) ($summaryData->outstanding_total ?? 0),
            'sisaPoCount'      => (int) ($summaryData->sisa_po_count ?? 0),
            'sisaPoTotal'      => (float) ($summaryData->sisa_po_total ?? 0),
            'realizedCount'    => (int) ($summaryData->realized_count ?? 0),
            'realizedTotal'    => (float) ($summaryData->realized_total ?? 0),
        ];
    }

    private function getPurchaseRequirementList($period)
    {
        $common = $this->getCommonQueries($period);
        $detailAgg = $common['detailAgg'];
        $poAgg = $common['poAgg'];
        $periodFilterRaw = $common['periodFilterRaw'];

        $purchaseRequirements = DB::table('tb_pr as pr')
            ->leftJoinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
            ->leftJoinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
            ->select(
                'pr.no_pr',
                'pr.date',
                'pr.for_customer',
                'pr.ref_po',
                'pr.payment as payment',
                DB::raw('detail.total_items, detail.untouched_items, detail.realized_items'),
                DB::raw('case when detail.no_pr is not null and detail.total_items > 0 and detail.untouched_items = detail.total_items then 1 else 0 end as outstanding_count'),
                DB::raw("case when detail.no_pr is not null and detail.total_items > 0 and detail.realized_items = detail.total_items and {$periodFilterRaw} then 1 else 0 end as realized_count"),
                DB::raw('case when detail.no_pr is not null and detail.total_items > 0 and detail.untouched_items < detail.total_items and detail.realized_items < detail.total_items then 1 else 0 end as sisa_po_count'),
                DB::raw('case when po.ref_pr is null then 1 else 0 end as can_delete')
            )
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $purchaseRequirements->transform(function ($item) {
            if ($item->date) {
                try {
                    $item->date = \Carbon\Carbon::parse($item->date)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        return $purchaseRequirements;
    }

    public function details(Request $request)
    {
        $noPr = $request->query('no_pr');
        if (!$noPr) {
            return response()->json([
                'purchaseRequirementDetails' => [],
            ]);
        }

        $query = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'sisa_pr',
                'payment',
                'renmark'
            )
            ->where('no_pr', $noPr);


        $purchaseRequirementDetails = $query->orderBy('no')->get();

        return response()->json([
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
        ]);
    }

    public function outstanding()
    {
        $detailAgg = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                DB::raw('count(*) as total_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) >= coalesce(cast(qty as decimal(18,4)), 0) and coalesce(cast(qty as decimal(18,4)), 0) > 0 then 1 else 0 end) as untouched_items')
            )
            ->groupBy('no_pr');

        $poAgg = DB::table('tb_po')
            ->select('ref_pr')
            ->whereNotNull('ref_pr')
            ->groupBy('ref_pr');

        $purchaseRequirements = DB::table('tb_pr as pr')
            ->joinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
            ->leftJoinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
            ->where('detail.total_items', '>', 0)
            ->whereColumn('detail.untouched_items', '=', 'detail.total_items')
            ->select(
                'pr.no_pr',
                'pr.date',
                'pr.for_customer',
                'pr.ref_po',
                'pr.payment as payment',
                DB::raw('1 as outstanding_count'),
                DB::raw('0 as realized_count'),
                DB::raw('case when po.ref_pr is null then 1 else 0 end as can_delete')
            )
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
        ]);
    }

    public function sisaPo()
    {
        $detailAgg = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                DB::raw('count(*) as total_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) >= coalesce(cast(qty as decimal(18,4)), 0) and coalesce(cast(qty as decimal(18,4)), 0) > 0 then 1 else 0 end) as untouched_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), 0) <= 0 then 1 else 0 end) as realized_items')
            )
            ->groupBy('no_pr');

        $poAgg = DB::table('tb_po')
            ->select('ref_pr')
            ->whereNotNull('ref_pr')
            ->groupBy('ref_pr');

        $purchaseRequirements = DB::table('tb_pr as pr')
            ->joinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
            ->leftJoinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
            ->where('detail.total_items', '>', 0)
            ->whereColumn('detail.untouched_items', '<', 'detail.total_items')
            ->whereColumn('detail.realized_items', '<', 'detail.total_items')
            ->select(
                'pr.no_pr',
                'pr.date',
                'pr.for_customer',
                'pr.ref_po',
                'pr.payment as payment',
                DB::raw('0 as outstanding_count'),
                DB::raw('0 as realized_count'),
                DB::raw('1 as sisa_po_count'),
                DB::raw('case when po.ref_pr is null then 1 else 0 end as can_delete')
            )
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $purchaseRequirements->transform(function ($item) {
            if ($item->date) {
                try {
                    $item->date = \Carbon\Carbon::parse($item->date)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
        ]);
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');
        $docDateExpr = "coalesce(date(tgl), str_to_date(tgl, '%Y-%m-%d'), str_to_date(tgl, '%Y/%m/%d'), str_to_date(tgl, '%d/%m/%Y'), str_to_date(tgl, '%d-%m-%Y'), str_to_date(tgl, '%d.%m.%Y'))";

        $detailAgg = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                DB::raw('sum(coalesce(total_price, 0)) as total_price_sum'),
                DB::raw('count(*) as total_items'),
                DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), 0) <= 0 then 1 else 0 end) as realized_items')
            )
            ->groupBy('no_pr');

        $poAgg = DB::table('tb_detailpo')
            ->select(
                'ref_pr',
                DB::raw("max({$docDateExpr}) as latest_po_date")
            )
            ->whereNotNull('ref_pr')
            ->groupBy('ref_pr');

        $query = DB::table('tb_pr as pr')
            ->joinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
            ->joinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
            ->where('detail.total_items', '>', 0)
            ->whereColumn('detail.realized_items', '=', 'detail.total_items')
            ->select(
                'pr.no_pr',
                DB::raw('po.latest_po_date as date'),
                'pr.for_customer',
                'pr.ref_po',
                'pr.payment as payment',
                DB::raw('0 as outstanding_count'),
                DB::raw('1 as realized_count'),
                'detail.total_price_sum'
            );

        $now = now();
        if ($period === 'today') {
            $query->whereRaw("po.latest_po_date = ?", [$now->toDateString()]);
        } elseif ($period === 'this_week') {
            $query->whereRaw("po.latest_po_date between ? and ?", [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString(),
            ]);
        } elseif ($period === 'this_month') {
            $query->whereRaw("month(po.latest_po_date) = ?", [$now->month])
                ->whereRaw("year(po.latest_po_date) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $query->whereRaw("year(po.latest_po_date) = ?", [$now->year]);
        }

        $purchaseRequirements = $query
            ->orderBy('po.latest_po_date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $realizedTotal = $purchaseRequirements->sum('total_price_sum');

        $purchaseRequirements->transform(function ($item) {
            if ($item->date) {
                try {
                    $item->date = \Carbon\Carbon::parse($item->date)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
            'realizedTotal' => (float) $realizedTotal,
        ]);
    }

    public function create()
    {
        return Inertia::render('marketing/purchase-requirement/create', [
            'materials' => [],
        ]);
    }

    public function materials(Request $request)
    {
        $perPageInput = $request->query('per_page');
        $search = trim((string) $request->query('search', ''));

        $query = DB::table('tb_material')
            ->select(
                'kd_material',
                'material',
                'unit',
                'stok',
                'harga'
            );

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw('lower(kd_material) like ?', [$like])
                    ->orWhereRaw('lower(material) like ?', [$like]);
            });
        }

        // Backward compatible: if per_page is not provided, return full dataset.
        if ($perPageInput === null) {
            $materials = (clone $query)
                ->orderBy('material')
                ->get();

            return response()->json([
                'materials' => $materials,
                'total' => $materials->count(),
            ]);
        }

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 10);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 10;
        }

        if ($perPage === null) {
            $materials = (clone $query)
                ->orderBy('material')
                ->get();

            return response()->json([
                'materials' => $materials,
                'total' => $materials->count(),
            ]);
        }

        $page = max(1, (int) $request->query('page', 1));
        $total = (clone $query)->count();
        $materials = (clone $query)
            ->orderBy('material')
            ->forPage($page, $perPage)
            ->get();

        return response()->json([
            'materials' => $materials,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function customers(Request $request)
    {
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $search = trim((string) $request->query('search', ''));

        $query = DB::table('tb_poin')
            ->select('kode_poin', 'no_poin', 'date_poin', 'customer_name')
            ->whereExists(function ($subQuery) {
                $subQuery->select(DB::raw(1))
                    ->from('tb_detailpoin as d')
                    ->whereRaw('lower(trim(d.kode_poin)) = lower(trim(tb_poin.kode_poin))')
                    ->where(function ($q) {
                        $q->whereRaw('coalesce(cast(d.sisa_qtypr as decimal(18,4)), 0) <> 0')
                          ->orWhereRaw('coalesce(cast(d.sisa_qtydo as decimal(18,4)), 0) <> 0');
                    });
            });
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw('lower(kode_poin) like ?', [$like])
                    ->orWhereRaw('lower(no_poin) like ?', [$like])
                    ->orWhereRaw('lower(customer_name) like ?', [$like]);
            });
        }

        if ($perPage === null) {
            $data = (clone $query)->orderByDesc('id')->get();
            return response()->json([
                'customers' => $data,
                'total' => $data->count(),
            ]);
        }

        $page = max(1, (int) $request->query('page', 1));
        $total = (clone $query)->count();
        $data = (clone $query)
            ->orderByDesc('id')
            ->forPage($page, $perPage)
            ->get();

        return response()->json([
            'customers' => $data,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function poinDetails(Request $request)
    {
        $kodePoin = trim((string) $request->query('kode_poin', ''));
        if ($kodePoin === '') {
            return response()->json([
                'items' => [],
            ]);
        }

        $hasLineNo = Schema::hasColumn('tb_detailpoin', 'no');
        $hasRemark = Schema::hasColumn('tb_detailpoin', 'remark');
        $hasStock  = Schema::hasColumn('tb_material', 'stok');

        $selects = [
            'd.id',
            'd.kd_material',
            'd.material',
            DB::raw('coalesce(d.sisa_qtypr, 0) as qty_po_in'),
            'd.satuan',
            DB::raw('coalesce(d.price_po_in, 0) as harga_po_in'),
        ];

        if ($hasLineNo) {
            $selects[] = DB::raw('coalesce(d.no, 0) as line_no');
        } else {
            $selects[] = DB::raw('0 as line_no');
        }

        if ($hasRemark) {
            $selects[] = DB::raw('coalesce(d.remark, "") as remark');
        } else {
            $selects[] = DB::raw('"" as remark');
        }

        if ($hasStock) {
            $selects[] = DB::raw('coalesce(m.stok, 0) as stok');
        } else {
            $selects[] = DB::raw('0 as stok');
        }

        $items = DB::table('tb_detailpoin as d')
            ->leftJoin('tb_material as m', function ($join) {
                $join->on(
                    DB::raw('lower(trim(d.kd_material))'),
                    '=',
                    DB::raw('lower(trim(m.kd_material))')
                );
            })
            ->whereRaw('lower(trim(d.kode_poin)) = ?', [strtolower($kodePoin)])
            ->when($hasLineNo, function ($query) {
                $query->orderBy('d.no');
            }, function ($query) {
                $query->orderBy('d.id');
            })
            ->select($selects)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'line_no' => (int) $item->line_no,
                    'kd_material' => $item->kd_material,
                    'material' => $item->material,
                    'qty_po_in' => (float) $item->qty_po_in,
                    'qty_pr' => (float) $item->qty_po_in,
                    'satuan' => $item->satuan,
                    'harga_po_in' => (float) $item->harga_po_in,
                    'harga_modal' => '',
                    'stok' => (float) $item->stok,
                    'margin' => '0%',
                    'remark' => $item->remark,
                ];
            })
            ->values();

        return response()->json([
            'items' => $items,
        ]);
    }

    public function edit($noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select('no_pr', 'date', 'payment', 'for_customer', 'ref_po')
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->orderBy('no')
            ->get();

        return Inertia::render('marketing/purchase-requirement/edit', [
            'purchaseRequirement' => $purchaseRequirement,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
            'materials' => [],
        ]);
    }

    public function store(Request $request)
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $allowed = config('tenants.databases', []);
        $rawPrefix = in_array($database, $allowed, true) ? $database : 'SJA';
        $labelPrefix = config("tenants.labels.$rawPrefix");
        $prefixSource = $labelPrefix ?: $rawPrefix;
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $prefixSource));
        if (str_starts_with($prefix, 'DB')) {
            $prefix = substr($prefix, 2);
        }
        if ($prefix === '') {
            $prefix = 'SJA';
        }
        $prefix = $prefix.'.PR-';

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $maxAttempts = 3;
        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use ($request, $materials, $prefix) {
                    $lastNumber = DB::table('tb_pr')
                        ->where('no_pr', 'like', $prefix.'%')
                        ->orderBy('no_pr', 'desc')
                        ->lockForUpdate()
                        ->value('no_pr');

                    $sequence = 1;
                    if ($lastNumber) {
                        $suffix = substr($lastNumber, strlen($prefix));
                        $sequence = max(1, (int) $suffix + 1);
                    }

                    $noPr = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

                    if (DB::table('tb_pr')->where('no_pr', $noPr)->exists()) {
                        throw new \RuntimeException('duplicate_no_pr');
                    }

                    $dateInput = $request->input('date');
                    $dateFormatted = null;
                    try {
                        $parsedDate = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                        $dateFormatted = $parsedDate ? $parsedDate->format('d.m.Y') : $dateInput;
                    } catch (\Throwable $e) {
                        $dateFormatted = $dateInput;
                    }

                    DB::table('tb_pr')->insert([
                        'no_pr' => $noPr,
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                    ]);

                    // Collect all detail IDs and material/ref_po pairs to optimize lookups
                    $detailIdsToUpdate = [];
                    foreach ($materials as $item) {
                        if (isset($item['detail_id']) && is_numeric($item['detail_id']) && (float)($item['qty'] ?? 0) > 0) {
                            $detailIdsToUpdate[] = (int) $item['detail_id'];
                        }
                    }

                    $detailPoinLookup = [];
                    if (!empty($detailIdsToUpdate)) {
                        $detailPoinLookup = DB::table('tb_detailpoin')
                            ->whereIn('id', $detailIdsToUpdate)
                            ->pluck('sisa_qtypr', 'id')
                            ->all();
                    }

                    $kodePoinList = [];
                    if ($request->input('ref_po')) {
                        $kodePoinList = DB::table('tb_poin')
                            ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim((string) $request->input('ref_po')))])
                            ->pluck('kode_poin')
                            ->map(fn($k) => strtolower(trim($k)))
                            ->all();
                    }

                    $insertData = [];
                    foreach ($materials as $index => $item) {
                        $qtyValue = is_numeric($item['qty'] ?? null) ? (float) $item['qty'] : 0;
                        $insertData[] = [
                            'date' => $request->input('date'),
                            'payment' => $request->input('payment'),
                            'for_customer' => $request->input('for_customer'),
                            'ref_po' => $request->input('ref_po'),
                            'no' => $item['no'] ?? ($index + 1),
                            'no_pr' => $noPr,
                            'kd_material' => $item['kd_material'] ?? null,
                            'material' => $item['material'] ?? null,
                            'qty' => $item['qty'] ?? null,
                            'unit' => $item['unit'] ?? null,
                            'stok' => $item['stok'] ?? null,
                            'unit_price' => $item['unit_price'] ?? null,
                            'total_price' => $item['total_price'] ?? null,
                            'price_po' => $item['price_po'] ?? null,
                            'margin' => $item['margin'] ?: '0%',
                            'renmark' => $item['renmark'] ?: ' ',
                            'qty_po' => 0,
                            'sisa_pr' => max(0, ((float) ($item['qty'] ?? 0)) - ((float) ($item['stok'] ?? 0))),
                        ];

                        if ($qtyValue > 0) {
                            $detailId = $item['detail_id'] ?? null;
                            if (is_numeric($detailId)) {
                                DB::table('tb_detailpoin')
                                    ->where('id', (int)$detailId)
                                    ->update([
                                        'sisa_qtypr' => DB::raw(sprintf(
                                            'greatest(coalesce(cast(sisa_qtypr as decimal(18,4)), 0) - %.4F, 0)',
                                            $qtyValue
                                        )),
                                    ]);
                            } elseif (!empty($kodePoinList)) {
                                DB::table('tb_detailpoin')
                                    ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim((string) ($item['kd_material'] ?? '')))])
                                    ->whereIn(DB::raw('lower(trim(kode_poin))'), $kodePoinList)
                                    ->update([
                                        'sisa_qtypr' => DB::raw(sprintf(
                                            'greatest(coalesce(cast(sisa_qtypr as decimal(18,4)), 0) - %.4F, 0)',
                                            $qtyValue
                                        )),
                                    ]);
                            }
                        }
                    }
                    if (!empty($insertData)) {
                        DB::table('tb_detailpr')->insert($insertData);
                    }
                });
                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isDuplicate = str_contains($message, 'duplicate_no_pr')
                    || str_contains($message, 'duplicate')
                    || ($exception instanceof \Illuminate\Database\QueryException
                        && $exception->getCode() === '23000');

                if ($attempt < $maxAttempts && $isDuplicate) {
                    continue;
                }

                return back()->with('error', 'Gagal menyimpan data: ' . $exception->getMessage());
            }
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data PR berhasil disimpan.');
            return inertia_location('/marketing/purchase-requirement');
        }

        return redirect()
            ->route('marketing.purchase-requirement.index')
            ->with('success', 'Data PR berhasil disimpan.');
    }

    public function update(Request $request, $noPr)
    {
        $exists = DB::table('tb_pr')
            ->where('no_pr', $noPr)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $timestamp = now()->format('m/d/Y h:i:s A');
        $dateFormatted = null;
        try {
            $parsedDate = $request->input('date')
                ? Carbon::parse($request->input('date'))
                : null;
            $dateFormatted = $parsedDate ? $parsedDate->format('d.m.Y') : $request->input('date');
        } catch (\Throwable $e) {
            $dateFormatted = $request->input('date');
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPr, $timestamp, $dateFormatted) {
                // 1. Revert existing quotas before deleting
                $oldDetails = DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->get();

                // Group revert updates by Ref PO
                $revertsByPo = [];
                foreach ($oldDetails as $oldItem) {
                    if ($oldItem->ref_po && $oldItem->kd_material) {
                        $revertsByPo[trim($oldItem->ref_po)][] = [
                            'kd_material' => trim($oldItem->kd_material),
                            'qty' => (float)$oldItem->qty
                        ];
                    }
                }

                foreach ($revertsByPo as $refPo => $matReverts) {
                    $kodePoinList = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim($refPo))])
                        ->pluck('kode_poin')
                        ->map(fn($k) => strtolower(trim($k)))
                        ->all();

                    if (empty($kodePoinList)) continue;

                    foreach ($matReverts as $rev) {
                        DB::table('tb_detailpoin')
                            ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim($rev['kd_material']))])
                            ->whereIn(DB::raw('lower(trim(kode_poin))'), $kodePoinList)
                            ->increment('sisa_qtypr', $rev['qty']);
                    }
                }
 Riverside: 

                // 2. Update PR master
                DB::table('tb_pr')
                    ->where('no_pr', $noPr)
                    ->update([
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                    ]);

                // 3. Delete old details
                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->delete();

                $insertDetails = [];
                $insertUbah = [];

                // 4. Batch consume quota
                $newRefPo = $request->input('ref_po');
                $kodePoinList = [];
                if ($newRefPo) {
                    $kodePoinList = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim((string)$newRefPo))])
                        ->pluck('kode_poin')
                        ->map(fn($k) => strtolower(trim($k)))
                        ->all();
                }

                foreach ($materials as $index => $item) {
                    $noValue = $item['no'] ?? ($index + 1);
                    $qtyRaw = (float)($item['qty'] ?? 0);
                    $stok = (float)($item['stok'] ?? 0);
                    $sisaPr = max(0, $qtyRaw - $stok);

                    $insertDetails[] = [
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $newRefPo,
                        'no' => $noValue,
                        'no_pr' => $noPr,
                        'kd_material' => $item['kd_material'] ?? null,
                        'material' => $item['material'] ?? null,
                        'qty' => $qtyRaw,
                        'unit' => $item['unit'] ?? null,
                        'stok' => $stok,
                        'unit_price' => $item['unit_price'] ?? null,
                        'total_price' => $item['total_price'] ?? null,
                        'price_po' => $item['price_po'] ?? null,
                        'margin' => $item['margin'] ?: '0%',
                        'renmark' => $item['renmark'] ?: ' ',
                        'qty_po' => 0,
                        'sisa_pr' => $sisaPr,
                    ];

                    $insertUbah[] = [
                        'no_pr' => $noPr,
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'ref_po' => $newRefPo,
                        'no' => $noValue,
                        'id' => $noValue,
                        'for_customer' => $request->input('for_customer'),
                        'kd_material' => $item['kd_material'] ?? null,
                        'material' => $item['material'] ?? null,
                        'qty' => $qtyRaw,
                        'qty_po' => $qtyRaw,
                        'sisa_pr' => $sisaPr,
                        'unit' => $item['unit'] ?? null,
                        'stok' => $stok,
                        'unit_price' => $item['unit_price'] ?? null,
                        'total_price' => $item['total_price'] ?? null,
                        'price_po' => $item['price_po'] ?? null,
                        'margin' => $item['margin'] ?: '0%',
                        'renmark' => $item['renmark'] ?: ' ',
                        'tgl_ubah' => $timestamp,
                    ];

                    // Consume quota
                    if (!empty($kodePoinList) && ($item['kd_material'] ?? null)) {
                        DB::table('tb_detailpoin')
                            ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim((string)$item['kd_material']))])
                            ->whereIn(DB::raw('lower(trim(kode_poin))'), $kodePoinList)
                            ->decrement('sisa_qtypr', $qtyRaw);
                    }
                }

                if (!empty($insertDetails)) {
                    DB::table('tb_detailpr')->insert($insertDetails);
                }
                if (!empty($insertUbah)) {
                    DB::table('tb_ubah')->insert($insertUbah);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal memperbarui data: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data PR berhasil diperbarui.');
            return inertia_location('/marketing/purchase-requirement');
        }

        return redirect()
            ->route('marketing.purchase-requirement.index')
            ->with('success', 'Data PR berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPr, $detailNo)
    {
        $existingDetail = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->first(['qty', 'kd_material', 'ref_po']);

        if (!$existingDetail) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        $timestamp = now()->format('m/d/Y h:i:s A');
        try {
            $parsedDate = $request->input('date')
                ? Carbon::parse($request->input('date'))
                : null;
            $dateFormatted = $parsedDate
                ? $parsedDate->format('d.m.Y')
                : $request->input('date');
        } catch (\Throwable $e) {
            $dateFormatted = $request->input('date');
        }

        try {
            DB::table('tb_detailpr')
                ->where('no_pr', $noPr)
                ->where('no', $detailNo)
                ->update([
                    'date' => $dateFormatted,
                    'payment' => $request->input('payment'),
                    'for_customer' => $request->input('for_customer'),
                    'ref_po' => $request->input('ref_po'),
                    'kd_material' => $request->input('kd_material'),
                    'material' => $request->input('material'),
                    'qty' => $request->input('qty'),
                    'unit' => $request->input('unit'),
                    'stok' => $request->input('stok'),
                    'unit_price' => $request->input('unit_price'),
                    'total_price' => $request->input('total_price'),
                    'price_po' => $request->input('price_po'),
                    'margin' => $request->input('margin') ?: '0%',
                    'renmark' => $request->input('renmark') ?: ' ',
                    'sisa_pr' => max(0, ((float) $request->input('qty')) - ((float) $request->input('stok'))),
                ]);

            $oldQty = is_numeric($existingDetail->qty ?? null) ? (float) $existingDetail->qty : 0;
            $newQty = is_numeric($request->input('qty')) ? (float) $request->input('qty') : 0;
            $kdMaterial = strtolower(trim((string) ($request->input('kd_material') ?: $existingDetail->kd_material)));
            $refPo = strtolower(trim((string) ($request->input('ref_po') ?: $existingDetail->ref_po)));

            if ($kdMaterial !== '' && $refPo !== '') {
                $detailPo = DB::table('tb_detailpoin')
                    ->whereRaw('lower(trim(kd_material)) = ?', [$kdMaterial])
                    ->whereRaw('lower(trim(kode_poin)) in (select lower(trim(kode_poin)) from tb_poin where lower(trim(no_poin)) = ?)', [$refPo])
                    ->orderBy('id', 'desc')
                    ->first(['id', 'sisa_qtypr']);

                if ($detailPo) {
                    DB::table('tb_detailpoin')
                        ->where('id', $detailPo->id)
                        ->update([
                            'sisa_qtypr' => DB::raw(sprintf(
                                'greatest(coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F - %.4F, 0)',
                                $oldQty,
                                $newQty
                            )),
                        ]);
                }

            }

            DB::table('tb_ubah')->insert([
                'no_pr' => $noPr,
                'date' => $dateFormatted,
                'payment' => $request->input('payment'),
                'ref_po' => $request->input('ref_po'),
                'no' => $detailNo,
                'id' => $detailNo,
                'for_customer' => $request->input('for_customer'),
                'kd_material' => $request->input('kd_material'),
                'material' => $request->input('material'),
                'qty' => $request->input('qty'),
                'qty_po' => $request->input('qty'),
                'sisa_pr' => max(0, ((float) $request->input('qty')) - ((float) $request->input('stok'))),
                'unit' => $request->input('unit'),
                'stok' => $request->input('stok'),
                'unit_price' => $request->input('unit_price'),
                'total_price' => $request->input('total_price'),
                'price_po' => $request->input('price_po'),
                'margin' => $request->input('margin') ?: '0%',
                'renmark' => $request->input('renmark') ?: ' ',
                'tgl_ubah' => $timestamp,
            ]);
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal memperbarui detail: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Detail PR berhasil diperbarui.');
            return to_route('marketing.purchase-requirement.index');
        }

        return back()->with('success', 'Detail PR berhasil diperbarui.');
    }

    public function destroyDetail(Request $request, $noPr, $detailNo)
    {
        // Global Check: Minimal 1 material
        $itemCount = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->count();

        if ($itemCount <= 1) {
            return back()->with('error', 'Data PR minimal harus memiliki 1 material.');
        }

        $detail = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->first(['qty', 'kd_material', 'ref_po']);

        if (!$detail) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        $qtyValue = is_numeric($detail->qty ?? null) ? (float) $detail->qty : 0;
        if ($qtyValue > 0) {
            $kdMaterial = strtolower(trim((string) ($detail->kd_material ?? '')));
            $refPo = strtolower(trim((string) ($detail->ref_po ?? '')));

            if ($kdMaterial !== '' && $refPo !== '') {
                $detailPo = DB::table('tb_detailpoin as d')
                    ->join('tb_poin as p', 'd.kode_poin', '=', 'p.kode_poin')
                    ->whereRaw('lower(trim(p.no_poin)) = ?', [strtolower(trim($refPo))])
                    ->whereRaw('lower(trim(d.kd_material)) = ?', [strtolower(trim($kdMaterial))])
                    ->orderBy('d.id', 'desc')
                    ->first(['d.id', 'd.sisa_qtypr']);

                if ($detailPo) {
                    DB::table('tb_detailpoin')
                        ->where('id', $detailPo->id)
                        ->update([
                            'sisa_qtypr' => DB::raw(sprintf(
                                'coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F',
                                $qtyValue
                            )),
                        ]);
                }
            }
        }

        $deleted = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->delete();

        if (!$deleted) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        return back()->with('success', 'Detail PR berhasil dihapus.');
    }

    public function destroy(Request $request, $noPr)
    {
        $noPr = trim((string) $noPr);
        if ($noPr === '') {
            return response()->json([
                'message' => 'No PR tidak valid.',
            ], 400);
        }

        $isUsedInPo = DB::table('tb_po')
            ->whereRaw('lower(trim(ref_pr)) = ?', [strtolower($noPr)])
            ->exists();

        if ($isUsedInPo) {
            return response()->json([
                'message' => 'PR sudah terpakai di PO, tidak dapat dihapus.',
            ], 400);
        }

        $details = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->get([
                'no_pr',
                'date',
                'payment',
                'for_customer',
                'ref_po',
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'stok',
                'unit_price',
                'total_price',
                'price_po',
                'margin',
                'renmark',
                'qty_po',
                'sisa_pr',
                'id',
            ]);

        $timestamp = now()->format('m/d/Y h:i:s A');

        $truncate = function ($value, $length) {
            $string = is_null($value) ? '' : (string) $value;
            return Str::limit($string, $length, '');
        };

        try {
            DB::transaction(function () use ($details, $noPr, $timestamp, $truncate) {
                if ($details->isNotEmpty()) {
                    // Return reserved qty back to PO In detail before deleting PR detail rows.
                    // Group updates by Ref PO and Material to consolidate queries
                    $updatesByPo = [];
                    foreach ($details as $row) {
                        $qtyValue = is_numeric($row->qty ?? null) ? (float) $row->qty : 0;
                        $kdMaterial = strtolower(trim((string) ($row->kd_material ?? '')));
                        $refPo = strtolower(trim((string) ($row->ref_po ?? '')));

                        if ($qtyValue <= 0 || $kdMaterial === '' || $refPo === '') {
                            continue;
                        }
                        
                        $updatesByPo[$refPo][] = [
                            'kd_material' => $kdMaterial,
                            'qty' => $qtyValue
                        ];
                    }

                    foreach ($updatesByPo as $refPo => $matUpdates) {
                        $kodePoinList = DB::table('tb_poin')
                            ->whereRaw('lower(trim(no_poin)) = ?', [$refPo])
                            ->pluck('kode_poin')
                            ->map(fn($k) => strtolower(trim($k)))
                            ->all();

                        if (empty($kodePoinList)) continue;

                        foreach ($matUpdates as $up) {
                            DB::table('tb_detailpoin')
                                ->whereRaw('lower(trim(kd_material)) = ?', [$up['kd_material']])
                                ->whereIn(DB::raw('lower(trim(kode_poin))'), $kodePoinList)
                                ->update([
                                    'sisa_qtypr' => DB::raw(sprintf(
                                        'coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F',
                                        $up['qty']
                                    )),
                                ]);
                        }
                    }

                    $payload = $details->map(function ($row) use ($timestamp, $truncate) {
                        return [
                            'no_pr' => $truncate($row->no_pr, 100),
                            'date' => $truncate($row->date, 20),
                            'payment' => $truncate($row->payment, 10),
                            'for_customer' => $truncate($row->for_customer, 30),
                            'ref_po' => $truncate($row->ref_po, 30),
                            'no' => $truncate($row->no, 10),
                            'kd_material' => $truncate($row->kd_material, 15),
                            'material' => $truncate($row->material, 100),
                            'qty' => $truncate($row->qty, 10),
                            'unit' => $truncate($row->unit, 10),
                            'stok' => $truncate($row->stok, 20),
                            'unit_price' => $truncate($row->unit_price, 20),
                            'total_price' => $truncate($row->total_price, 20),
                            'price_po' => $truncate($row->price_po, 20),
                            'margin' => $truncate($row->margin ?: '0%', 20),
                            'renmark' => $truncate($row->renmark ?: ' ', 30),
                            'qty_po' => $truncate($row->qty_po, 20),
                            'sisa_pr' => $truncate($row->sisa_pr, 20),
                            'id' => $row->id,
                            'tgl_hapus' => $timestamp,
                        ];
                    })->all();

                    DB::table('tb_hapus')->insert($payload);
                }

                DB::table('tb_detailpr')->where('no_pr', $noPr)->delete();
                DB::table('tb_pr')->where('no_pr', $noPr)->delete();
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal menghapus PR: ' . $e->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data PR berhasil dihapus.');
            return inertia_location('/marketing/purchase-requirement');
        }

        return response()->json([
            'message' => 'Data PR berhasil dihapus.',
        ]);
    }


    public function print(Request $request, $noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select(
                'no_pr',
                'date',
                'for_customer',
                'ref_po',
                'payment'
            )
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->select(
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'stok',
                'unit_price',
                'total_price',
                'renmark'
            )
            ->where('no_pr', $noPr)
            ->orderBy('no')
            ->get();

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        // normalize prefixes like "DBSJA" or "dbsja" or "DB.SJA"
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja'; // default company if tenant cookie/session missing
        }
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", $lookupKey)
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('marketing/purchase-requirement/print', [
            'purchaseRequirement' => $purchaseRequirement,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
            'company' => $company,
        ]);
    }
}
