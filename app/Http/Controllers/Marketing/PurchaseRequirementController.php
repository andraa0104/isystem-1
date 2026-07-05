<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Carbon\Carbon;

class PurchaseRequirementController
{
    private function prQtyValidationMessage(float $originalQty, float $qtyPoUsed, float $newQty, float $stock = 0, float $qtyPoIn = 0, float $sisaQtyPoIn = 0): ?string
    {
        $maxQtyByPoIn = $originalQty + $sisaQtyPoIn;
        if ($newQty > $maxQtyByPoIn) {
            return 'Qty PR tidak boleh melebihi qty awal + sisa qty PO In.';
        }

        $minimumQtyByStock = max(0, $stock - $qtyPoIn);
        if ($newQty < $minimumQtyByStock) {
            return 'Qty PR tidak boleh kurang dari Total Stok - Qty PO In.';
        }

        if ($newQty < $qtyPoUsed) {
            return 'Qty hanya boleh dikurangi sampai Sisa PR = 0.';
        }

        return null;
    }

    public function getLastPrice(Request $request)
    {
        try {
            // 1. Validasi input kode material dari axios
            $request->validate([
                'kd_mat' => 'required|string'
            ]);

            $kdMat = trim((string) $request->kd_mat);

            $latestPoDetail = null;
            if (Schema::hasTable('tb_detailpo')) {
                $latestPoDetail = DB::table('tb_detailpo')
                    ->whereRaw('lower(trim(kd_mat)) = ?', [Str::lower($kdMat)])
                    ->whereRaw('coalesce(cast(price as decimal(18,4)), 0) > 0')
                    ->orderByDesc('id_po')
                    ->orderByDesc('no_po')
                    ->first();
            }

            $latestInventory = null;
            if (!$latestPoDetail && Schema::hasTable('tb_invin')) {
                $latestInventory = DB::table('tb_invin')
                    ->whereRaw('lower(trim(kd_mat)) = ?', [Str::lower($kdMat)])
                    ->orderBy('id_invin', 'desc')
                    ->first();
            }

            return response()->json([
                'success' => true,
                'harga' => $latestPoDetail
                    ? $latestPoDetail->price
                    : ($latestInventory ? $latestInventory->harga : 0),
            ]);

        } catch (\Exception $e) {
            // Mencatat error ke log jika terjadi kendala lain
            Log::error('Error pada API getLastPrice PR: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'harga' => 0
            ], 200); // Status 200 agar React tidak mendeteksi crash/AxiosError merah
        }
    }

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
        $fetchType = $request->query('fetch_type');
        $status = $request->query('status', 'all');

        $response = [];

        if ($fetchType === 'summary' || !$fetchType) {
            $summary = $this->getPurchaseRequirementSummary($period);
            $response['outstandingCount'] = $summary['outstandingCount'];
            $response['outstandingTotal'] = $summary['outstandingTotal'];
            $response['sisaPoCount'] = $summary['sisaPoCount'];
            $response['sisaPoTotal'] = $summary['sisaPoTotal'];
            $response['realizedCount'] = $summary['realizedCount'];
            $response['realizedTotal'] = $summary['realizedTotal'];
        }

        if ($fetchType === 'table' || !$fetchType) {
            $response['purchaseRequirements'] = $this->getPurchaseRequirementList($period, $status);
        }

        return response()->json($response);
    }

    public function overdueInvoices(Request $request)
    {
        $customerName = trim((string) $request->query('customer', ''));

        if ($customerName === '') {
            return response()->json([
                'customer' => '',
                'total_overdue' => 0,
                'oldest_overdue_days' => 0,
                'invoices' => [],
            ]);
        }

        $today = Carbon::today();
        $dueDateExpr = "coalesce(date(jth_tempo), str_to_date(jth_tempo, '%Y-%m-%d'), str_to_date(jth_tempo, '%Y/%m/%d'), str_to_date(jth_tempo, '%d/%m/%Y'), str_to_date(jth_tempo, '%d-%m-%Y'), str_to_date(jth_tempo, '%d.%m.%Y'))";

        $rows = DB::table('tb_kdfakturpenjualan')
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
                'nm_cs',
                DB::raw("datediff(?, {$dueDateExpr}) as umur_tempo")
            )
            ->addBinding($today->toDateString(), 'select')
            ->whereRaw('lower(trim(nm_cs)) = ?', [Str::lower($customerName)])
            ->whereRaw('coalesce(cast(saldo_piutang as decimal(18,4)), 0) > 0')
            ->whereRaw("{$dueDateExpr} < ?", [$today->toDateString()])
            ->orderByDesc('umur_tempo')
            ->orderBy('jth_tempo')
            ->get();

        return response()->json([
            'customer' => $rows->first()->nm_cs ?? $customerName,
            'total_overdue' => (float) $rows->sum(fn ($row) => (float) ($row->saldo_piutang ?? 0)),
            'oldest_overdue_days' => (int) ($rows->max('umur_tempo') ?? 0),
            'invoices' => $rows,
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

    private function getPurchaseRequirementList($period, $status = 'all')
    {
        if (!in_array($status, ['all', 'outstanding', 'sisa_po', 'realized'], true)) {
            $status = 'all';
        }

        $detailAgg = DB::table('tb_detailpr')
                ->select(
                    'no_pr',
                    DB::raw('count(*) as total_items'),
                    DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), coalesce(cast(qty as decimal(18,4)), 0)) >= coalesce(cast(qty as decimal(18,4)), 0) and coalesce(cast(qty as decimal(18,4)), 0) > 0 then 1 else 0 end) as untouched_items'),
                    DB::raw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), 0) <= 0 then 1 else 0 end) as realized_items')
                )
                ->groupBy('no_pr');

            $needsPoDate = in_array($status, ['all', 'realized'], true);
            $periodFilterRaw = '1=1';

            if ($needsPoDate) {
                $common = $this->getCommonQueries($period);
                $poAgg = $common['poAgg'];
                $periodFilterRaw = $common['periodFilterRaw'];
            } else {
                $poAgg = DB::table('tb_po')
                    ->select('ref_pr')
                    ->whereNotNull('ref_pr')
                    ->groupBy('ref_pr');
            }

            $query = DB::table('tb_pr as pr')
                ->leftJoinSub($detailAgg, 'detail', 'pr.no_pr', '=', 'detail.no_pr')
                ->leftJoinSub($poAgg, 'po', 'pr.no_pr', '=', 'po.ref_pr')
                ->select(
                    'pr.no_pr',
                    'pr.date',
                    'pr.for_customer',
                    'pr.ref_po',
                    'pr.jenis_pr',
                    'pr.payment as payment',
                    DB::raw('detail.total_items, detail.untouched_items, detail.realized_items'),
                    DB::raw('case when detail.no_pr is not null and detail.total_items > 0 and detail.untouched_items = detail.total_items then 1 else 0 end as outstanding_count'),
                    DB::raw("case when detail.no_pr is not null and detail.total_items > 0 and detail.realized_items = detail.total_items and {$periodFilterRaw} then 1 else 0 end as realized_count"),
                    DB::raw('case when detail.no_pr is not null and detail.total_items > 0 and detail.untouched_items < detail.total_items and detail.realized_items < detail.total_items then 1 else 0 end as sisa_po_count'),
                    DB::raw('case when po.ref_pr is null then 1 else 0 end as can_delete')
                );

            if ($status === 'outstanding') {
                $query->where('detail.total_items', '>', 0)
                    ->whereColumn('detail.untouched_items', '=', 'detail.total_items');
            } elseif ($status === 'sisa_po') {
                $query->where('detail.total_items', '>', 0)
                    ->whereColumn('detail.untouched_items', '<', 'detail.total_items')
                    ->whereColumn('detail.realized_items', '<', 'detail.total_items');
            } elseif ($status === 'realized') {
                $query->where('detail.total_items', '>', 0)
                    ->whereColumn('detail.realized_items', '=', 'detail.total_items');

                if ($periodFilterRaw !== '1=1') {
                    $query->whereRaw(str_replace('latest_po_date', 'po.latest_po_date', $periodFilterRaw));
                }
            }

            $purchaseRequirements = $query
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
            return response()->json(['purchaseRequirementDetails' => []]);
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->select('no_pr', 'no', 'kd_material', 'material', 'qty', 'unit', 'sisa_pr', 'payment', 'renmark', 'ref_po', 'for_customer')
            ->where('no_pr', $noPr)
            ->orderBy('no')
            ->get();

        return response()->json(['purchaseRequirementDetails' => $purchaseRequirementDetails]);
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
                'pr.jenis_pr',
                'pr.payment as payment',
                DB::raw('1 as outstanding_count'),
                DB::raw('0 as realized_count'),
                DB::raw('case when po.ref_pr is null then 1 else 0 end as can_delete')
            )
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        return response()->json(['purchaseRequirements' => $purchaseRequirements]);
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
                'pr.jenis_pr',
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
                } catch (\Throwable $e) {}
            }
            return $item;
        });

        return response()->json(['purchaseRequirements' => $purchaseRequirements]);
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
            ->select('ref_pr', DB::raw("max({$docDateExpr}) as latest_po_date"))
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
                } catch (\Throwable $e) {}
            }
            return $item;
        });

        $data = [
            'purchaseRequirements' => $purchaseRequirements,
            'realizedTotal' => (float) $realizedTotal,
        ];

        return response()->json($data);
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
        $page = max(1, (int) $request->query('page', 1));
        $refPo = trim((string) $request->query('ref_po', ''));
        $noPr = trim((string) $request->query('no_pr', ''));

        $excludedMaterials = [];
        if ($noPr !== '') {
            $excludedMaterials = DB::table('tb_detailpr')
                ->where('no_pr', $noPr)
                ->pluck('kd_material')
                ->filter()
                ->map(fn($k) => strtolower(trim((string)$k)))
                ->unique()
                ->all();
        }

        $query = null;
        $mainTable = '';

        if ($refPo !== '') {
            $mainTable = 'd';
            $hasBarangStock = Schema::hasTable('tb_barang')
                && Schema::hasColumn('tb_barang', 'stok_g1')
                && Schema::hasColumn('tb_barang', 'stok_g2')
                && Schema::hasColumn('tb_barang', 'stok_g3')
                && Schema::hasColumn('tb_barang', 'stok_g4');

            $query = DB::table('tb_detailpoin as d')
                ->join('tb_poin as p', 'd.kode_poin', '=', 'p.kode_poin')
                ->whereRaw('lower(trim(p.no_poin)) = ?', [strtolower($refPo)]);

            if ($hasBarangStock) {
                $query->leftJoin('tb_barang as b', function($join) {
                    $join->on(DB::raw('lower(trim(d.kd_material))'), '=', DB::raw('lower(trim(b.kd_material))'));
                });
                $query->select(
                    'd.kd_material',
                    'd.material',
                    'd.satuan as unit',
                    DB::raw('coalesce(d.sisa_qtypr, 0) as sisa_qtypr'),
                    DB::raw('coalesce(d.qty, 0) as qty_po_in'),
                    DB::raw('coalesce(cast(b.stok_g1 as decimal(18,4)), 0) as stok_g1'),
                    DB::raw('coalesce(cast(b.stok_g2 as decimal(18,4)), 0) as stok_g2'),
                    DB::raw('coalesce(cast(b.stok_g3 as decimal(18,4)), 0) as stok_g3'),
                    DB::raw('coalesce(cast(b.stok_g4 as decimal(18,4)), 0) as stok_g4'),
                    DB::raw('0 as stok'),
                    DB::raw('coalesce(d.price_po_in, 0) as harga')
                );
            } else {
                $query->select(
                    'd.kd_material',
                    'd.material',
                    'd.satuan as unit',
                    'd.sisa_qtypr',
                    DB::raw('coalesce(d.qty, 0) as qty_po_in'),
                    DB::raw('0 as stok_g1'),
                    DB::raw('0 as stok_g2'),
                    DB::raw('0 as stok_g3'),
                    DB::raw('0 as stok_g4'),
                    DB::raw('0 as stok'),
                    DB::raw('coalesce(d.price_po_in, 0) as harga')
                );
            }
        } else {
            $mainTable = 'b';
            $priceColumn = Schema::hasColumn('tb_barang', 'harga_stokg1')
                ? 'b.harga_stokg1'
                : (Schema::hasColumn('tb_barang', 'harga_g1') ? 'b.harga_g1' : null);

            $query = DB::table('tb_barang as b')
                ->select(
                    'b.kd_material',
                    'b.material',
                    'b.unit',
                    DB::raw('cast((
                        coalesce(cast(b.stok_g1 as decimal(18,4)), 0) +
                        coalesce(cast(b.stok_g2 as decimal(18,4)), 0) +
                        coalesce(cast(b.stok_g3 as decimal(18,4)), 0) +
                        coalesce(cast(b.stok_g4 as decimal(18,4)), 0)
                    ) as signed) as stok'),
                    DB::raw($priceColumn ? "coalesce({$priceColumn}, 0) as harga" : '0 as harga'),
                    DB::raw('0 as sisa_qtypr'),
                    DB::raw('0 as qty_po_in'),
                    DB::raw('cast(coalesce(cast(b.stok_g1 as decimal(18,4)), 0) as signed) as stok_g1'),
                    DB::raw('cast(coalesce(cast(b.stok_g2 as decimal(18,4)), 0) as signed) as stok_g2'),
                    DB::raw('cast(coalesce(cast(b.stok_g3 as decimal(18,4)), 0) as signed) as stok_g3'),
                    DB::raw('cast(coalesce(cast(b.stok_g4 as decimal(18,4)), 0) as signed) as stok_g4')
                );
        }

        if (!empty($excludedMaterials)) {
            $query->whereNotIn(DB::raw("lower(trim({$mainTable}.kd_material))"), array_values($excludedMaterials));
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search, $mainTable) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw("lower({$mainTable}.kd_material) like ?", [$like])
                    ->orWhereRaw("lower({$mainTable}.material) like ?", [$like]);
            });
        }

        if ($perPageInput === null) {
            $materials = (clone $query)->orderBy("{$mainTable}.material")->get();
            return response()->json(['materials' => $materials, 'total' => $materials->count()]);
        }

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 10);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 10;
        }

        if ($perPage === null) {
            $materials = (clone $query)->orderBy("{$mainTable}.material")->get();
            $materials->transform(function ($item) {
                $item->stok_g1 = (int) ($item->stok_g1 ?? 0);
                $item->stok_g2 = (int) ($item->stok_g2 ?? 0);
                $item->stok_g3 = (int) ($item->stok_g3 ?? 0);
                $item->stok_g4 = (int) ($item->stok_g4 ?? 0);
                $item->stok = $item->stok_g1 + $item->stok_g2 + $item->stok_g3 + $item->stok_g4;
                $item->sisa_qtypr = (float) ($item->sisa_qtypr ?? 0);
                $item->qty_po_in = (float) ($item->qty_po_in ?? 0);
                return $item;
            });
            return response()->json(['materials' => $materials, 'total' => $materials->count()]);
        }

        $total = (clone $query)->count();
        $materials = (clone $query)->orderBy("{$mainTable}.material")->forPage($page, $perPage)->get();
        $metrics = $this->getStockMetrics($materials->pluck('kd_material')->toArray());

        $materials->transform(function ($item) use ($metrics) {
            $item->stok_g1 = (int) ($item->stok_g1 ?? 0);
            $item->stok_g2 = (int) ($item->stok_g2 ?? 0);
            $item->stok_g3 = (int) ($item->stok_g3 ?? 0);
            $item->stok_g4 = (int) ($item->stok_g4 ?? 0);
            $kd = strtolower(trim((string)$item->kd_material));
            if (isset($metrics[$kd])) {
                $item->mib = array_key_exists('mib', $metrics[$kd]) ? $metrics[$kd]['mib'] : 0;
                $item->mibs = array_key_exists('mibs', $metrics[$kd]) ? $metrics[$kd]['mibs'] : 0;
                $item->pr_outstanding = array_key_exists('pr_outstanding', $metrics[$kd]) ? $metrics[$kd]['pr_outstanding'] : 0;
                $item->po_outstanding = array_key_exists('po_outstanding', $metrics[$kd]) ? $metrics[$kd]['po_outstanding'] : 0;
                $item->do_outstanding = array_key_exists('do_outstanding', $metrics[$kd]) ? $metrics[$kd]['do_outstanding'] : 0;
            } else {
                $item->mib = 0; $item->mibs = 0; $item->pr_outstanding = 0; $item->po_outstanding = 0; $item->do_outstanding = 0;
            }
            $item->stok = max(0, $item->stok_g1 + $item->stok_g2 + $item->stok_g3 + $item->stok_g4 + $item->mib + $item->mibs + $item->pr_outstanding + $item->po_outstanding - $item->do_outstanding);
            $item->sisa_qtypr = (float) ($item->sisa_qtypr ?? 0);
            $item->qty_po_in = (float) ($item->qty_po_in ?? 0);
            return $item;
        });

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
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));

        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::table('tb_poin')
            ->select('kode_poin', 'no_poin', 'date_poin', 'customer_name')
            ->whereExists(function ($subQuery) {
                $subQuery->select(DB::raw(1))
                    ->from('tb_detailpoin as d')
                    ->whereRaw('lower(trim(d.kode_poin)) = lower(trim(tb_poin.kode_poin))')
                    ->whereRaw('coalesce(cast(d.sisa_qtypr as decimal(18,4)), 0) > 0');
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
            return response()->json(['customers' => $data, 'total' => $data->count()]);
        }

        $total = (clone $query)->count();
        $data = (clone $query)->orderByDesc('id')->forPage($page, $perPage)->get();

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
            return response()->json(['items' => []]);
        }

        $hasLineNo = Schema::hasColumn('tb_detailpoin', 'no');
        $hasRemark = Schema::hasColumn('tb_detailpoin', 'remark');
        $hasBarangStock = Schema::hasTable('tb_barang')
            && Schema::hasColumn('tb_barang', 'stok_g1')
            && Schema::hasColumn('tb_barang', 'stok_g2')
            && Schema::hasColumn('tb_barang', 'stok_g3')
            && Schema::hasColumn('tb_barang', 'stok_g4');

        $selects = [
            'd.id',
            'd.kd_material',
            'd.material',
            DB::raw('coalesce(d.sisa_qtypr, 0) as sisa_qtypr'),
            DB::raw('coalesce(d.qty, 0) as qty_po_in'),
            'd.satuan',
            DB::raw('coalesce(d.price_po_in, 0) as harga_po_in'),
        ];

        if ($hasRemark) {
            $selects[] = DB::raw('coalesce(d.remark, "") as remark');
        } else {
            $selects[] = DB::raw('"" as remark');
        }

        if ($hasBarangStock) {
            $selects[] = DB::raw('coalesce(cast(b.stok_g1 as decimal(18,4)), 0) as stok_g1');
            $selects[] = DB::raw('coalesce(cast(b.stok_g2 as decimal(18,4)), 0) as stok_g2');
            $selects[] = DB::raw('coalesce(cast(b.stok_g3 as decimal(18,4)), 0) as stok_g3');
            $selects[] = DB::raw('coalesce(cast(b.stok_g4 as decimal(18,4)), 0) as stok_g4');
            $selects[] = DB::raw('(
                coalesce(cast(b.stok_g1 as decimal(18,4)), 0) +
                coalesce(cast(b.stok_g2 as decimal(18,4)), 0) +
                coalesce(cast(b.stok_g3 as decimal(18,4)), 0) +
                coalesce(cast(b.stok_g4 as decimal(18,4)), 0)
            ) as stok');
        } else {
            $selects[] = DB::raw('0 as stok_g1');
            $selects[] = DB::raw('0 as stok_g2');
            $selects[] = DB::raw('0 as stok_g3');
            $selects[] = DB::raw('0 as stok_g4');
            $selects[] = DB::raw('0 as stok');
        }

        $items = DB::table('tb_detailpoin as d')
            ->when($hasBarangStock, function ($query) {
                $query->leftJoin('tb_barang as b', function ($join) {
                    $join->on(
                        DB::raw('lower(trim(d.kd_material))'),
                        '=',
                        DB::raw('lower(trim(b.kd_material))')
                    );
                });
            })
            ->whereRaw('lower(trim(d.kode_poin)) = ?', [strtolower($kodePoin)])
            ->when($hasLineNo, function ($query) {
                $query->orderBy('d.no');
            }, function ($query) {
                $query->orderBy('d.id');
            })
            ->select($selects)
            ->get();

        $metrics = $this->getStockMetrics($items->pluck('kd_material')->toArray());

        $items = $items->map(function ($item) use ($metrics) {
            $kd = strtolower(trim((string)$item->kd_material));
            if (isset($metrics[$kd])) {
                $item->mib = array_key_exists('mib', $metrics[$kd]) ? $metrics[$kd]['mib'] : 0;
                $item->mibs = array_key_exists('mibs', $metrics[$kd]) ? $metrics[$kd]['mibs'] : 0;
                $item->pr_outstanding = array_key_exists('pr_outstanding', $metrics[$kd]) ? $metrics[$kd]['pr_outstanding'] : 0;
                $item->po_outstanding = array_key_exists('po_outstanding', $metrics[$kd]) ? $metrics[$kd]['po_outstanding'] : 0;
                $item->do_outstanding = array_key_exists('do_outstanding', $metrics[$kd]) ? $metrics[$kd]['do_outstanding'] : 0;
            } else {
                $item->mib = 0; $item->mibs = 0; $item->pr_outstanding = 0; $item->po_outstanding = 0; $item->do_outstanding = 0;
            }

            return [
                'id' => $item->id,
                'kd_material' => $item->kd_material,
                'material' => $item->material,
                'sisa_qtypr' => (float) $item->sisa_qtypr,
                'qty_po_in' => (float) $item->qty_po_in,
                'qty_pr' => (float) $item->sisa_qtypr,
                'satuan' => $item->satuan,
                'harga_po_in' => (float) $item->harga_po_in,
                'harga_modal' => '',
                'stok_g1' => (float) $item->stok_g1,
                'stok_g2' => (float) $item->stok_g2,
                'stok_g3' => (float) $item->stok_g3,
                'stok_g4' => (float) $item->stok_g4,
                'mib' => (float) $item->mib,
                'mibs' => (float) $item->mibs,
                'pr_outstanding' => (float) $item->pr_outstanding,
                'po_outstanding' => (float) $item->po_outstanding,
                'do_outstanding' => (float) $item->do_outstanding,
                'stok' => max(0, (float) $item->stok + (float) $item->mib + (float) $item->mibs + (float) $item->pr_outstanding + (float) $item->po_outstanding - (float) $item->do_outstanding),
                'margin' => '0%',
                'remark' => $item->remark,
            ];
        })
        ->values();

        $selectedMaterialKeys = $items
            ->filter(fn ($item) => (float) ($item['sisa_qtypr'] ?? 0) > 0)
            ->pluck('kd_material')
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter()
            ->sort()
            ->values()
            ->all();

        $selectedHeader = DB::table('tb_poin')
            ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower($kodePoin)])
            ->first(['kode_poin', 'no_poin', 'customer_name']);

        $matchingPoIns = collect();
        if ($selectedHeader && !empty($selectedMaterialKeys)) {
            $candidateHeaders = DB::table('tb_poin')
                ->whereRaw('lower(trim(kode_poin)) <> ?', [strtolower($kodePoin)])
                ->get(['kode_poin', 'no_poin', 'customer_name']);

            foreach ($candidateHeaders as $candidate) {
                $candidateItems = DB::table('tb_detailpoin')
                    ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string) $candidate->kode_poin))])
                    ->whereRaw('coalesce(cast(sisa_qtypr as decimal(18,4)), 0) > 0')
                    ->orderBy('id')
                    ->get(['id', 'kd_material', 'material', 'qty', 'sisa_qtypr', 'satuan', 'price_po_in']);
                $candidateKeys = $candidateItems
                    ->pluck('kd_material')
                    ->map(fn ($value) => strtolower(trim((string) $value)))
                    ->filter()->sort()->values()->all();

                if ($candidateKeys === $selectedMaterialKeys) {
                    $matchingPoIns->push([
                        'kode_poin' => $candidate->kode_poin,
                        'no_poin' => $candidate->no_poin,
                        'customer_name' => $candidate->customer_name,
                        'materials' => $candidateItems->map(fn ($detail) => [
                            'id' => $detail->id,
                            'kd_material' => $detail->kd_material,
                            'material' => $detail->material,
                            'qty' => (float) $detail->qty,
                            'sisa_qtypr' => (float) $detail->sisa_qtypr,
                            'satuan' => $detail->satuan,
                            'harga_po_in' => (float) $detail->price_po_in,
                        ])->values(),
                    ]);
                }
            }
        }

        return response()->json([
            'items' => $items,
            'selected_po_in' => $selectedHeader,
            'matching_po_ins' => $matchingPoIns->values(),
        ]);
    }

    public function edit($noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select('no_pr', 'date', 'payment', 'for_customer', 'ref_po', 'jenis_pr')
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $poAgg = DB::table('tb_detailpo')
            ->select('ref_pr', 'kd_mat')
            ->selectRaw('sum(coalesce(cast(qty as decimal(18,4)), 0)) as qty_po_used')
            ->groupBy('ref_pr', 'kd_mat');

        $purchaseRequirementDetails = DB::table('tb_detailpr as d')
            ->leftJoinSub($poAgg, 'po', function ($join) {
                $join->on(DB::raw('lower(trim(po.ref_pr))'), '=', DB::raw('lower(trim(d.no_pr))'))
                    ->on(DB::raw('lower(trim(po.kd_mat))'), '=', DB::raw('lower(trim(d.kd_material))'));
            })
            ->leftJoin('tb_poin as p_ref', function($join) {
                $join->on(DB::raw('lower(trim(p_ref.no_poin))'), '=', DB::raw('lower(trim(d.ref_po))'));
            })
            ->leftJoin('tb_detailpoin as dp', function($join) {
                $join->on('dp.kode_poin', '=', 'p_ref.kode_poin')
                     ->on(DB::raw('lower(trim(dp.kd_material))'), '=', DB::raw('lower(trim(d.kd_material))'));
            })
            ->leftJoin('tb_barang as b', function($join) {
                $join->on(DB::raw('lower(trim(d.kd_material))'), '=', DB::raw('lower(trim(b.kd_material))'));
            })
            ->where('d.no_pr', $noPr)
            ->orderBy('d.no')
            ->select(
                'd.*',
                DB::raw('coalesce(cast(b.stok_g1 as decimal(18,4)), 0) as stok_g1'),
                DB::raw('coalesce(cast(b.stok_g2 as decimal(18,4)), 0) as stok_g2'),
                DB::raw('coalesce(cast(b.stok_g3 as decimal(18,4)), 0) as stok_g3'),
                DB::raw('coalesce(cast(b.stok_g4 as decimal(18,4)), 0) as stok_g4'),
                DB::raw('coalesce(dp.sisa_qtypr, 0) as sisa_qty_po'),
                DB::raw('coalesce(cast(dp.qty as decimal(18,4)), 0) as qty_po_in')
            )
            ->selectRaw('greatest(coalesce(cast(d.qty as decimal(18,4)), 0) - coalesce(cast(d.sisa_pr as decimal(18,4)), 0), 0) as qty_po')
            ->get();

        $purchaseRequirementDetails->transform(function ($item) {
            $item->stok_g1 = (int) ($item->stok_g1 ?? 0);
            $item->stok_g2 = (int) ($item->stok_g2 ?? 0);
            $item->stok_g3 = (int) ($item->stok_g3 ?? 0);
            $item->stok_g4 = (int) ($item->stok_g4 ?? 0);
            return $item;
        });

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
        $companyCode = config("tenants.company_codes.$rawPrefix");
        $labelPrefix = config("tenants.labels.$rawPrefix");
        $prefixSource = $companyCode ?: ($labelPrefix ?: $rawPrefix);
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
                        'jenis_pr' => $request->input('jenis_pr'),
                    ]);

                    $detailIdsToUpdate = [];
                    foreach ($materials as $item) {
                        if (
                            isset($item['detail_id']) &&
                            is_numeric($item['detail_id']) &&
                            (float) ($item['poin_consumed_qty'] ?? $item['qty'] ?? 0) > 0
                        ) {
                            $detailIdsToUpdate[] = (int) $item['detail_id'];
                        }
                    }

                    $detailPoinLookup = [];
                    if (!empty($detailIdsToUpdate)) {
                        $detailPoinLookup = DB::table('tb_detailpoin')
                            ->whereIn('id', $detailIdsToUpdate)
                            ->lockForUpdate()
                            ->get(['id', 'qty', 'sisa_qtypr'])
                            ->keyBy('id');
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
                        $poinConsumedQty = is_numeric($item['poin_consumed_qty'] ?? null)
                            ? max(0, (float) $item['poin_consumed_qty'])
                            : $qtyValue;
                        $detailIdForValidation = $item['detail_id'] ?? null;
                        if (
                            is_numeric($detailIdForValidation) &&
                            $detailPoinLookup->has((int) $detailIdForValidation) &&
                            $qtyValue > (float) $detailPoinLookup->get((int) $detailIdForValidation)->sisa_qtypr
                        ) {
                            throw new \RuntimeException(sprintf(
                                'Qty PR material %s tidak boleh melebihi Sisa Qty PR.',
                                (string) ($item['kd_material'] ?? '')
                            ));
                        }
                        if (
                            is_numeric($detailIdForValidation) &&
                            $detailPoinLookup->has((int) $detailIdForValidation) &&
                            $poinConsumedQty < (float) $detailPoinLookup->get((int) $detailIdForValidation)->sisa_qtypr
                        ) {
                            throw new \RuntimeException(sprintf(
                                'PR Input material %s tidak boleh dikurangi karena Sisa Qty PR harus menjadi 0.',
                                (string) ($item['kd_material'] ?? '')
                            ));
                        }
                        $stockParts = [
                            $item['stok_g1'] ?? null,
                            $item['stok_g2'] ?? null,
                            $item['stok_g3'] ?? null,
                            $item['stok_g4'] ?? null,
                        ];
                        $hasStockParts = collect($stockParts)->contains(fn ($value) => $value !== null && $value !== '');
                        $stockTotal = null;

                        if (array_key_exists('stok', $item) && $item['stok'] !== null && $item['stok'] !== '') {
                            $stockTotal = is_numeric($item['stok']) ? (float) $item['stok'] : null;
                        } elseif ($hasStockParts) {
                            $stockTotal = collect($stockParts)->sum(fn ($value) => is_numeric($value) ? (float) $value : 0);
                        } elseif (!empty($item['kd_material'])) {
                            $stockRow = DB::table('tb_barang')
                                ->where('kd_material', $item['kd_material'])
                                ->first(['stok_g1', 'stok_g2', 'stok_g3', 'stok_g4']);

                            if ($stockRow) {
                                $stockTotal =
                                    (is_numeric($stockRow->stok_g1 ?? null) ? (float) $stockRow->stok_g1 : 0) +
                                    (is_numeric($stockRow->stok_g2 ?? null) ? (float) $stockRow->stok_g2 : 0) +
                                    (is_numeric($stockRow->stok_g3 ?? null) ? (float) $stockRow->stok_g3 : 0) +
                                    (is_numeric($stockRow->stok_g4 ?? null) ? (float) $stockRow->stok_g4 : 0);
                            }
                        }

                        $insertData[] = [
                            'date' => $request->input('date'),
                            'payment' => $request->input('payment'),
                            'for_customer' => $item['for_customer'] ?? $request->input('for_customer'),
                            'ref_po' => $item['ref_po'] ?? $request->input('ref_po'),
                            'no' => $item['no'] ?? ($index + 1),
                            'no_pr' => $noPr,
                            'kd_material' => $item['kd_material'] ?? null,
                            'material' => $item['material'] ?? null,
                            'qty' => $item['qty'] ?? null,
                            'unit' => $item['unit'] ?? null,
                            'stok' => $stockTotal !== null ? max(0, $stockTotal) : null,
                            'unit_price' => $item['unit_price'] ?? null,
                            'total_price' => $item['total_price'] ?? null,
                            'price_po' => $item['price_po'] ?? null,
                            'margin' => $item['margin'] ?: '0%',
                            'renmark' => $item['renmark'] ?: ' ',
                            'qty_po' => 0,
                            'sisa_pr' => $qtyValue,
                            'jenis_pr' => $request->input('jenis_pr')
                        ];

                        if ($poinConsumedQty > 0) {
                            $detailId = $item['detail_id'] ?? null;
                            if (is_numeric($detailId)) {
                                DB::table('tb_detailpoin')
                                    ->where('id', (int)$detailId)
                                    ->update([
                                        'sisa_qtypr' => DB::raw(sprintf(
                                            'greatest(coalesce(cast(sisa_qtypr as decimal(18,4)), 0) - %.4F, 0)',
                                            $poinConsumedQty
                                        )),
                                    ]);
                            } elseif (!empty($kodePoinList)) {
                                DB::table('tb_detailpoin')
                                    ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim((string) ($item['kd_material'] ?? '')))])
                                    ->whereIn(DB::raw('lower(trim(kode_poin))'), $kodePoinList)
                                    ->update([
                                        'sisa_qtypr' => DB::raw(sprintf(
                                            'greatest(coalesce(cast(sisa_qtypr as decimal(18,4)), 0) - %.4F, 0)',
                                            $poinConsumedQty
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
            Cache::tags(['poin_data'])->flush();
            session()->flash('success', 'Data PR berhasil disimpan.');
            return inertia_location('/marketing/purchase-requirement');
        }

        Cache::tags(['poin_data'])->flush();
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
                $oldDetails = DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->get();
                $oldDetailsByNo = $oldDetails->keyBy(fn ($row) => (string) $row->no);

                foreach ($materials as $index => $item) {
                    $noValue = (string) ($item['no'] ?? ($index + 1));
                    $oldDetail = $oldDetailsByNo->get($noValue);
                    if (!$oldDetail) {
                        continue;
                    }

                    $newQty = (float) ($item['qty'] ?? 0);
                    $oldQty = (float) ($oldDetail->qty ?? 0);
                    $stock = (float) ($item['stok'] ?? $oldDetail->stok ?? 0);
                    $kdMaterial = strtolower(trim((string) ($item['kd_material'] ?? $oldDetail->kd_material ?? '')));
                    $qtyPoUsed = max(
                        0,
                        $oldQty - (float) ($oldDetail->sisa_pr ?? 0),
                    );
                    $qtyPoIn = (float) (DB::table('tb_detailpoin as dp')
                        ->join('tb_poin as p', 'p.kode_poin', '=', 'dp.kode_poin')
                        ->whereRaw('lower(trim(p.no_poin)) = ?', [strtolower(trim((string) ($item['ref_po'] ?? $oldDetail->ref_po ?? $request->input('ref_po'))))])
                        ->whereRaw('lower(trim(dp.kd_material)) = ?', [$kdMaterial])
                        ->selectRaw('coalesce(cast(dp.qty as decimal(18,4)), 0) as qty_po_in')
                        ->value('qty_po_in') ?? 0);
                    $sisaQtyPoIn = (float) (DB::table('tb_detailpoin as dp')
                        ->join('tb_poin as p', 'p.kode_poin', '=', 'dp.kode_poin')
                        ->whereRaw('lower(trim(p.no_poin)) = ?', [strtolower(trim((string) ($item['ref_po'] ?? $oldDetail->ref_po ?? $request->input('ref_po'))))])
                        ->whereRaw('lower(trim(dp.kd_material)) = ?', [$kdMaterial])
                        ->selectRaw('coalesce(cast(dp.sisa_qtypr as decimal(18,4)), 0) as sisa_qtypr')
                        ->value('sisa_qtypr') ?? 0);
                    $qtyValidationMessage = $this->prQtyValidationMessage($oldQty, $qtyPoUsed, $newQty, $stock, $qtyPoIn, $sisaQtyPoIn);

                    if ($qtyValidationMessage) {
                        throw new \RuntimeException($qtyValidationMessage);
                    }
                }

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

                DB::table('tb_pr')
                    ->where('no_pr', $noPr)
                    ->update([
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                        'jenis_pr' => $request->input('jenis_pr'),
                    ]);

                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->delete();

                $insertDetails = [];
                $insertUbah = [];

                $newRefPo = $request->input('ref_po');

                foreach ($materials as $index => $item) {
                    $itemRefPo = $item['ref_po'] ?? $newRefPo;
                    $kodePoinList = $itemRefPo ? DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim((string) $itemRefPo))])
                        ->pluck('kode_poin')
                        ->map(fn ($value) => strtolower(trim((string) $value)))
                        ->all() : [];
                    $noValue = $item['no'] ?? ($index + 1);
                    $qtyRaw = (float)($item['qty'] ?? 0);
                    $stok = max(0, (float)($item['stok'] ?? 0));
                    $oldDetail = $oldDetailsByNo->get((string) $noValue);
                    $initialRealizedQty = $oldDetail
                        ? max(0, (float) $oldDetail->qty - (float) $oldDetail->sisa_pr)
                        : 0;
                    $sisaPr = max(0, $qtyRaw - $initialRealizedQty);

                    $insertDetails[] = [
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $item['for_customer'] ?? $request->input('for_customer'),
                        'ref_po' => $itemRefPo,
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
                        'jenis_pr' => $request->input('jenis_pr'),
                    ];

                    $insertUbah[] = [
                        'no_pr' => $noPr,
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'ref_po' => $itemRefPo,
                        'no' => $noValue,
                        'id' => $noValue,
                        'for_customer' => $item['for_customer'] ?? $request->input('for_customer'),
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
            ->first(['qty', 'sisa_pr', 'kd_material', 'ref_po', 'stok']);

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
            $oldQty = is_numeric($existingDetail->qty ?? null) ? (float) $existingDetail->qty : 0;
            $newQty = is_numeric($request->input('qty')) ? (float) $request->input('qty') : 0;
            $qtyPoUsed = max(
                0,
                $oldQty - (float) ($existingDetail->sisa_pr ?? 0),
            );
            $kdMaterial = strtolower(trim((string) ($request->input('kd_material') ?: $existingDetail->kd_material)));
            $refPo = strtolower(trim((string) ($request->input('ref_po') ?: $existingDetail->ref_po)));
            $qtyPoIn = (float) (DB::table('tb_detailpoin as dp')
                ->join('tb_poin as p', 'p.kode_poin', '=', 'dp.kode_poin')
                ->whereRaw('lower(trim(p.no_poin)) = ?', [$refPo])
                ->whereRaw('lower(trim(dp.kd_material)) = ?', [$kdMaterial])
                ->selectRaw('coalesce(cast(dp.qty as decimal(18,4)), 0) as qty_po_in')
                ->value('qty_po_in') ?? 0);
            $sisaQtyPoIn = (float) (DB::table('tb_detailpoin as dp')
                ->join('tb_poin as p', 'p.kode_poin', '=', 'dp.kode_poin')
                ->whereRaw('lower(trim(p.no_poin)) = ?', [$refPo])
                ->whereRaw('lower(trim(dp.kd_material)) = ?', [$kdMaterial])
                ->selectRaw('coalesce(cast(dp.sisa_qtypr as decimal(18,4)), 0) as sisa_qtypr')
                ->value('sisa_qtypr') ?? 0);
            $stock = max(0, is_numeric($request->input('stok')) ? (float) $request->input('stok') : (float) ($existingDetail->stok ?? 0));
            $qtyValidationMessage = $this->prQtyValidationMessage($oldQty, $qtyPoUsed, $newQty, $stock, $qtyPoIn, $sisaQtyPoIn);
            if ($qtyValidationMessage) {
                return back()->with('error', $qtyValidationMessage);
            }

            $newSisaPr = max(0, $newQty - $qtyPoUsed);

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
                    'stok' => $stock,
                    'unit_price' => $request->input('unit_price'),
                    'total_price' => $request->input('total_price'),
                    'price_po' => $request->input('price_po'),
                    'margin' => $request->input('margin') ?: '0%',
                    'renmark' => $request->input('renmark') ?: ' ',
                    'sisa_pr' => $newSisaPr,
                    'jenis_pr' => $request->input('jenis_pr'),
                ]);

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
                'sisa_pr' => $newSisaPr,
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

    public function clearDetailSisaPr(Request $request, $noPr, $detailNo)
    {
        $detail = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->first([
                'date',
                'payment',
                'ref_po',
                'for_customer',
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
                'sisa_pr',
            ]);

        if (!$detail) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        $sisaPr = is_numeric($detail->sisa_pr ?? null) ? (float) $detail->sisa_pr : 0;
        $qty = is_numeric($detail->qty ?? null) ? (float) $detail->qty : 0;

        if ($sisaPr === 0.0) {
            return back()->with('error', 'Material ini tidak memenuhi syarat update Sisa PR.');
        }

        $timestamp = now()->format('m/d/Y h:i:s A');

        try {
            DB::transaction(function () use ($noPr, $detailNo, $detail, $sisaPr, $qty, $timestamp) {
                $kdMaterial = strtolower(trim((string) ($detail->kd_material ?? '')));
                $refPo = strtolower(trim((string) ($detail->ref_po ?? '')));

                if ($sisaPr > 0 && $kdMaterial !== '' && $refPo !== '') {
                    $detailPo = DB::table('tb_detailpoin as d')
                        ->join('tb_poin as p', 'd.kode_poin', '=', 'p.kode_poin')
                        ->whereRaw('lower(trim(p.no_poin)) = ?', [$refPo])
                        ->whereRaw('lower(trim(d.kd_material)) = ?', [$kdMaterial])
                        ->orderBy('d.id', 'desc')
                        ->first(['d.id']);

                    if ($detailPo) {
                        DB::table('tb_detailpoin')
                            ->where('id', $detailPo->id)
                            ->update([
                                'sisa_qtypr' => DB::raw(sprintf(
                                    'case when coalesce(cast(qty as decimal(18,4)), 0) > 0 then least(cast(qty as decimal(18,4)), coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F) else coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F end',
                                    $sisaPr,
                                    $sisaPr
                                )),
                            ]);
                    }
                }

                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->where('no', $detailNo)
                    ->update([
                        'qty' => DB::raw(sprintf(
                            'greatest(coalesce(cast(qty as decimal(18,4)), 0) - %.4F, 0)',
                            $sisaPr
                        )),
                        'sisa_pr' => 0,
                    ]);

                DB::table('tb_ubah')->insert([
                    'no_pr' => $noPr,
                    'date' => $detail->date,
                    'payment' => $detail->payment,
                    'ref_po' => $detail->ref_po,
                    'no' => $detailNo,
                    'id' => $detailNo,
                    'for_customer' => $detail->for_customer,
                    'kd_material' => $detail->kd_material,
                    'material' => $detail->material,
                    'qty' => max(0, $qty - $sisaPr),
                    'qty_po' => max(0, $qty - $sisaPr),
                    'sisa_pr' => 0,
                    'unit' => $detail->unit,
                    'stok' => $detail->stok,
                    'unit_price' => $detail->unit_price,
                    'total_price' => $detail->total_price,
                    'price_po' => $detail->price_po,
                    'margin' => $detail->margin ?: '0%',
                    'renmark' => $detail->renmark ?: ' ',
                    'tgl_ubah' => $timestamp,
                ]);
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal memperbarui Sisa PR: ' . $exception->getMessage());
        }

        return back()->with('success', 'Sisa PR berhasil diubah menjadi 0.');
    }

    public function destroyDetail(Request $request, $noPr, $detailNo)
    {
        $itemCount = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->count();

        if ($itemCount <= 1) {
            return back()->with('error', 'Data PR minimal harus memiliki 1 material.');
        }

        $detail = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->first(['qty', 'kd_material', 'ref_po', 'stok']);

        if (!$detail) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        $qtyValue = is_numeric($detail->qty ?? null) ? (float) $detail->qty : 0;
        $stokValue = is_numeric($detail->stok ?? null) ? (float) $detail->stok : 0;
        $totalReturn = $qtyValue + $stokValue;

        if ($totalReturn > 0) {
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
                                'case when coalesce(cast(qty as decimal(18,4)), 0) > 0 then least(cast(qty as decimal(18,4)), coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F) else coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F end',
                                $totalReturn,
                                $totalReturn
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

    public function removePo(Request $request, $noPr, $refPo)
    {
        $noPr = trim((string) $noPr);
        $refPoToRemove = strtolower(trim((string) $refPo));

        if ($noPr === '' || $refPoToRemove === '') {
            return response()->json(['message' => 'No PR atau Ref PO tidak valid.'], 400);
        }

        $isUsedInPo = DB::table('tb_po')
            ->whereRaw('lower(trim(ref_pr)) = ?', [strtolower($noPr)])
            ->exists();

        if ($isUsedInPo) {
            return response()->json(['message' => 'PR sudah terpakai di PO, tidak dapat diubah.'], 400);
        }

        $detailsToDelete = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->whereRaw('lower(trim(ref_po)) = ?', [$refPoToRemove])
            ->get([
                'no_pr', 'date', 'payment', 'for_customer', 'ref_po', 'no', 'kd_material',
                'material', 'qty', 'unit', 'stok', 'unit_price', 'total_price', 'price_po',
                'margin', 'renmark', 'qty_po', 'sisa_pr', 'id',
            ]);
            
        if ($detailsToDelete->isEmpty()) {
            return response()->json(['message' => 'Data customer tidak ditemukan di PR ini.'], 404);
        }

        $timestamp = now()->format('m/d/Y h:i:s A');
        $truncate = function ($value, $length) {
            $string = is_null($value) ? '' : (string) $value;
            return Str::limit($string, $length, '');
        };

        try {
            DB::transaction(function () use ($noPr, $refPoToRemove, $detailsToDelete, $timestamp, $truncate) {
                $updatesByPo = [];
                $payload = [];

                foreach ($detailsToDelete as $row) {
                    $qtyValue = is_numeric($row->sisa_pr) ? (float) $row->sisa_pr : 0;
                    $stokValue = is_numeric($row->qty_po) ? (float) $row->qty_po : 0;
                    $totalReturn = $qtyValue + $stokValue;

                    $kdMaterial = strtolower(trim((string) ($row->kd_material ?? '')));
                    $refPo = strtolower(trim((string) ($row->ref_po ?? '')));

                    if ($totalReturn > 0 && $kdMaterial !== '' && $refPo !== '') {
                        $updatesByPo[$refPo][] = [
                            'kd_material' => $kdMaterial,
                            'qty' => $totalReturn
                        ];
                    }

                    $payload[] = [
                        'no_pr' => $truncate($row->no_pr, 50),
                        'date' => $truncate($row->date, 20),
                        'payment' => $truncate($row->payment, 30),
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
                }

                foreach ($updatesByPo as $refPoIter => $matUpdates) {
                    $kodePoinList = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [$refPoIter])
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
                                    'case when coalesce(cast(qty as decimal(18,4)), 0) > 0 then least(cast(qty as decimal(18,4)), coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F) else coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F end',
                                    $up['qty'],
                                    $up['qty']
                                )),
                            ]);
                    }
                }

                if (!empty($payload)) {
                    DB::table('tb_hapus')->insert($payload);
                }

                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->whereRaw('lower(trim(ref_po)) = ?', [$refPoToRemove])
                    ->delete();

                // Recalculate parent values
                $remainingDetails = DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->get(['ref_po', 'for_customer']);

                if ($remainingDetails->isEmpty()) {
                    DB::table('tb_pr')->where('no_pr', $noPr)->delete();
                } else {
                    $uniqueCusts = array_values(array_filter(array_unique($remainingDetails->pluck('for_customer')->toArray())));
                    $uniqueRefs = array_values(array_filter(array_unique($remainingDetails->pluck('ref_po')->toArray())));

                    DB::table('tb_pr')->where('no_pr', $noPr)->update([
                        'for_customer' => implode(' / ', $uniqueCusts),
                        'ref_po' => implode(' / ', $uniqueRefs),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Gagal menghapus Customer dari PR: ' . $e->getMessage()], 500);
        }

        Cache::tags(['poin_data'])->flush();
        return response()->json(['message' => 'Customer terpilih berhasil dihapus dari PR.']);
    }

    public function destroy(Request $request, $noPr)
    {
        $noPr = trim((string) $noPr);
        if ($noPr === '') {
            return response()->json(['message' => 'No PR tidak valid.'], 400);
        }

        $isUsedInPo = DB::table('tb_po')
            ->whereRaw('lower(trim(ref_pr)) = ?', [strtolower($noPr)])
            ->exists();

        if ($isUsedInPo) {
            return response()->json(['message' => 'PR sudah terpakai di PO, tidak dapat dihapus.'], 400);
        }

        $details = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->get([
                'no_pr', 'date', 'payment', 'for_customer', 'ref_po', 'no', 'kd_material',
                'material', 'qty', 'unit', 'stok', 'unit_price', 'total_price', 'price_po',
                'margin', 'renmark', 'qty_po', 'sisa_pr', 'id',
            ]);

        $timestamp = now()->format('m/d/Y h:i:s A');

        $truncate = function ($value, $length) {
            $string = is_null($value) ? '' : (string) $value;
            return Str::limit($string, $length, '');
        };

        try {
            DB::transaction(function () use ($details, $noPr, $timestamp, $truncate) {
                if ($details->isNotEmpty()) {
                    $updatesByPo = [];
                    foreach ($details as $row) {
                        $qtyValue = is_numeric($row->qty ?? null) ? (float) $row->qty : 0;
                        $stokValue = is_numeric($row->stok ?? null) ? (float) $row->stok : 0;
                        $totalReturn = $qtyValue + $stokValue;

                        $kdMaterial = strtolower(trim((string) ($row->kd_material ?? '')));
                        $refPo = strtolower(trim((string) ($row->ref_po ?? '')));

                        if ($totalReturn <= 0 || $kdMaterial === '' || $refPo === '') continue;
                        
                        $updatesByPo[$refPo][] = [
                            'kd_material' => $kdMaterial,
                            'qty' => $totalReturn
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
                                        'case when coalesce(cast(qty as decimal(18,4)), 0) > 0 then least(cast(qty as decimal(18,4)), coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F) else coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F end',
                                        $up['qty'],
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
            Cache::tags(['poin_data'])->flush();
            session()->flash('success', 'Data PR berhasil dihapus.');
            return inertia_location('/marketing/purchase-requirement');
        }
        Cache::tags(['poin_data'])->flush();
        return response()->json(['message' => 'Data PR berhasil dihapus.']);
    }

    public function clearPoInSisaQtyPr($id)
    {
        try {
            DB::table('tb_detailpoin')->where('id', $id)->update(['sisa_qtypr' => 0]);
            return response()->json(['success' => true, 'message' => 'PO In quantity cleared successfully.']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Failed to clear quantity.', 'error' => $e->getMessage()], 500);
        }
    }

    public function print(Request $request, $noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select('no_pr', 'date', 'for_customer', 'ref_po', 'jenis_pr', 'payment')
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()->route('marketing.purchase-requirement.index')->with('error', 'Data PR tidak ditemukan.');
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr as d')
            ->leftJoin('tb_barang as b', 'b.kd_material', '=', 'd.kd_material')
            ->select(
                'd.no',
                'd.kd_material',
                'd.material',
                'd.qty',
                'd.unit',
                'd.stok',
                'd.unit_price',
                'd.total_price',
                'd.price_po',
                'd.margin',
                'd.renmark'
            )
            ->where('d.no_pr', $noPr)
            ->orderBy('d.no')
            ->get();

        $database = $request->session()->get('tenant.database') ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
        }
        $companyConfig = $lookupKey ? config("tenants.companies.$lookupKey", []) : [];
        $fallbackName = $lookupKey ? config("tenants.labels.$lookupKey", $lookupKey) : config('app.name');

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

    private function getStockMetrics(array $kdMaterials = [])
    {
        if (empty($kdMaterials)) {
            return [];
        }

        $metrics = [];
        foreach ($kdMaterials as $kd) {
            $metrics[strtolower(trim((string)$kd))] = [
                'mib' => 0.0, 
                'mibs' => 0.0, 
                'pr_outstanding' => 0.0, 
                'po_outstanding' => 0.0, 
                'do_outstanding' => 0.0
            ];
        }

        $kdList = array_map(function($k) { return strtolower(trim((string)$k)); }, $kdMaterials);

        // Fetch MIB
        $mibData = \Illuminate\Support\Facades\DB::table('tb_mi')
            ->whereIn(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'), $kdList)
            ->selectRaw('lower(trim(kd_mat)) as kd_mat, sum(coalesce(cast(mib as decimal(18,4)), 0)) as mib_val')
            ->groupBy(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'))
            ->get();
        foreach ($mibData as $row) {
            $metrics[$row->kd_mat]['mib'] = (float) $row->mib_val;
        }

        // Fetch MIBS
        $mibsData = \Illuminate\Support\Facades\DB::table('tb_mib')
            ->whereIn(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'), $kdList)
            ->selectRaw('lower(trim(kd_mat)) as kd_mat, sum(coalesce(cast(qty as decimal(18,4)), 0) - coalesce(cast(transfer as decimal(18,4)), 0)) as mibs_val')
            ->groupBy(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'))
            ->get();
        foreach ($mibsData as $row) {
            $metrics[$row->kd_mat]['mibs'] = (float) $row->mibs_val;
        }

        // Fetch PR Outstanding
        $prData = \Illuminate\Support\Facades\DB::table('tb_detailpr')
            ->whereIn(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_material))'), $kdList)
            ->selectRaw('lower(trim(kd_material)) as kd_mat, coalesce(sum(sisa_pr), 0) as pr_val')
            ->groupBy(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_material))'))
            ->get();
        foreach ($prData as $row) {
            $metrics[$row->kd_mat]['pr_outstanding'] = (float) $row->pr_val;
        }

        // Fetch PO Outstanding
        $poData = \Illuminate\Support\Facades\DB::table('tb_detailpo')
            ->whereIn(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'), $kdList)
            ->selectRaw('lower(trim(kd_mat)) as kd_mat, sum(coalesce(cast(qty as decimal(18,4)), 0) - coalesce(cast(end_gr as decimal(18,4)), 0)) as po_val')
            ->groupBy(\Illuminate\Support\Facades\DB::raw('lower(trim(kd_mat))'))
            ->get();
        foreach ($poData as $row) {
            $metrics[$row->kd_mat]['po_outstanding'] = (float) $row->po_val;
        }

        // Fetch DO Outstanding
        $doData = \Illuminate\Support\Facades\DB::table('tb_detailpoin as dpoin')
            ->whereIn(\Illuminate\Support\Facades\DB::raw('lower(trim(dpoin.kd_material))'), $kdList)
            ->selectRaw('lower(trim(dpoin.kd_material)) as kd_mat, sum(coalesce(cast(sisa_qtydo as decimal(18,4)), 0)) as do_val')
            ->groupBy(\Illuminate\Support\Facades\DB::raw('lower(trim(dpoin.kd_material))'))
            ->get();
        foreach ($doData as $row) {
            $metrics[$row->kd_mat]['do_outstanding'] = (float) $row->do_val;
        }

        return $metrics;
    }
}
