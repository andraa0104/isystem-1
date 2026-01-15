<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DeliveryOrderController
{
    public function index(Request $request)
    {
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->orderBy('date', 'desc')
            ->orderBy('no_do', 'desc')
            ->get();

        $detailNo = $request->query('detail_no');
        $deliveryOrderDetails = collect();
        if ($detailNo) {
            $deliveryOrderDetails = DB::table('tb_do')
                ->select(
                    'no_do',
                    'mat',
                    'qty',
                    'harga',
                    'total',
                    'remark'
                )
                ->where('no_do', $detailNo)
                ->orderBy('no_do')
                ->get();
        }

        $customerAddresses = DB::table('tb_cs')
            ->select('nm_cs', 'alamat_cs')
            ->orderBy('nm_cs')
            ->get();

        $outstandingCount = DB::table('tb_do')
            ->where('val_inv', 0)
            ->distinct('no_do')
            ->count('no_do');

        $realizedCount = DB::table('tb_do')
            ->where('val_inv', 1)
            ->distinct('no_do')
            ->count('no_do');

        $outstandingTotal = DB::table('tb_do')
            ->where('val_inv', 0)
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return Inertia::render('marketing/delivery-order/index', [
            'deliveryOrders' => $deliveryOrders,
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'detailNo' => $detailNo,
            'customerAddresses' => $customerAddresses,
            'outstandingCount' => $outstandingCount,
            'realizedCount' => $realizedCount,
            'outstandingTotal' => $outstandingTotal,
        ]);
    }

    public function print(Request $request, $noDo)
    {
        $deliveryOrderDetails = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'mat', 'qty', 'unit', 'harga', 'total', 'remark')
            ->where('no_do', $noDo)
            ->orderBy('no_do')
            ->get();

        $deliveryOrder = $deliveryOrderDetails->first();

        if (!$deliveryOrder) {
            return redirect()
                ->route('marketing.delivery-order.index')
                ->with('error', 'Data DO tidak ditemukan.');
        }

        $customerAddress = DB::table('tb_cs')
            ->where('nm_cs', $deliveryOrder->nm_cs)
            ->value('alamat_cs');

        $grandTotal = $deliveryOrderDetails
            ->reduce(function ($total, $detail) {
                $value = is_numeric($detail->total ?? null)
                    ? (float) $detail->total
                    : 0.0;

                return $total + $value;
            }, 0.0);

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = $database;
        if (is_string($lookupKey) && str_starts_with($lookupKey, 'DB')) {
            $lookupKey = substr($lookupKey, 2);
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

        return Inertia::render('marketing/delivery-order/print', [
            'deliveryOrder' => $deliveryOrder,
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
            'grandTotal' => $grandTotal,
            'company' => $company,
        ]);
    }
    public function create()
    {
        return Inertia::render('marketing/delivery-order/create');
    }

    public function searchPr(Request $request)
    {
        $search = $request->input('search');
        $perPageInput = $request->input('per_page', 10);
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 10);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 10;
        }

        $detailSub = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                DB::raw('coalesce(sum(cast(replace(sisa_pr, \',\', \'\') as decimal(18,4))), 0) as pr_sisa')
            )
            ->groupBy('no_pr');

        $query = DB::table('tb_pr as pr')
            ->leftJoinSub($detailSub, 'detail', function ($join) {
                $join->on('pr.no_pr', '=', 'detail.no_pr');
            })
            ->whereRaw('coalesce(detail.pr_sisa, 0) > 0')
            ->select(
                'pr.no_pr',
                'pr.date',
                'pr.ref_po',
                'pr.for_customer',
                DB::raw('coalesce(detail.pr_sisa, 0) as sisa_pr')
            );

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('pr.no_pr', 'like', "%{$search}%")
                  ->orWhere('pr.ref_po', 'like', "%{$search}%")
                  ->orWhere('pr.for_customer', 'like', "%{$search}%");
            });
        }

        $query = $query
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc');

        if ($perPage === null) {
            $prs = $query->get();
            return response()->json([
                'data' => $prs,
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 'all',
                'total' => $prs->count(),
            ]);
        }

        $prs = $query->paginate($perPage);

        return response()->json($prs);
    }

    public function getPrDetails(Request $request)
    {
        $noPr = $request->input('no_pr');

        $pr = DB::table('tb_pr')->where('no_pr', $noPr)->first();

        if (!$pr) {
            return response()->json(['error' => 'PR not found'], 404);
        }

        $kdCs = DB::table('tb_cs')
            ->where('nm_cs', $pr->for_customer)
            ->value('kd_cs');

        try {
            $rawItems = DB::table('tb_detailpr')
                ->where('no_pr', $noPr)
                ->get();
        } catch (\Throwable $exception) {
            return response()->json([
                'error' => 'Gagal mengambil detail PR.',
                'message' => $exception->getMessage(),
            ], 500);
        }

        $items = $rawItems->map(function ($item) {
            $kdMaterial = $item->kd_material
                ?? $item->kd_mat
                ?? $item->kd_mtrl
                ?? null;
            $material = $item->material ?? $item->mat ?? $item->mtrl ?? null;
            $unit = $item->unit ?? $item->satuan ?? $item->Unit ?? '';
            $remark = $item->renmark ?? $item->remark ?? $item->keterangan ?? '';
            $sisa = $item->sisa_pr ?? $item->Sisa_pr ?? null;
            $qty = $sisa ?? $item->qty ?? $item->Qty ?? $item->quantity ?? null;

            $lastStock = 0;
            try {
                $lastStock = DB::table('tb_material')
                    ->where('kd_material', $kdMaterial)
                    ->value('stok');
            } catch (\Throwable $exception) {
                $lastStock = 0;
            }

            return (object) [
                'kd_material' => $kdMaterial,
                'material' => $material,
                'qty' => $qty,
                'unit' => $unit,
                'remark' => $remark,
                'sisa_pr' => $sisa,
                'last_stock' => (float) $lastStock,
            ];
        });

        return response()->json([
            'pr' => $pr,
            'kd_cs' => $kdCs,
            'items' => $items,
        ]);
    }
}
