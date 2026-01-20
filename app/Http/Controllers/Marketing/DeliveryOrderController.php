<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            'outstandingCount' => $outstandingCount,
            'realizedCount' => $realizedCount,
            'outstandingTotal' => $outstandingTotal,
        ]);
    }

    public function details(Request $request)
    {
        $noDo = $request->query('no_do');
        if (!$noDo) {
            return response()->json([
                'deliveryOrderDetails' => [],
                'customerAddress' => null,
            ]);
        }

        $deliveryOrderDetails = DB::table('tb_do')
            ->select('no_do', 'mat', 'qty', 'harga', 'total', 'remark', 'nm_cs')
            ->where('no_do', $noDo)
            ->orderBy('no_do')
            ->get();

        $first = $deliveryOrderDetails->first();
        $customerAddress = null;
        if ($first?->nm_cs) {
            $customerAddress = DB::table('tb_cs')
                ->where('nm_cs', $first->nm_cs)
                ->value('alamat_cs');
        }

        return response()->json([
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
        ]);
    }

    public function outstanding()
    {
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->where('val_inv', 0)
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->orderBy('date', 'desc')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
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

    public function edit(Request $request, $noDo)
    {
        $items = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->orderBy('no')
            ->get();

        $header = $items->first();
        if (!$header) {
            return redirect()
                ->route('marketing.delivery-order.index')
                ->with('error', 'Data DO tidak ditemukan.');
        }

        $refPr = null;
        if (Schema::hasColumn('tb_do', 'ref_pr')) {
            $refPr = $header->ref_pr ?? null;
        }
        if (!$refPr) {
            $refPr = DB::table('tb_pr')
                ->where('ref_po', $header->ref_po)
                ->where('for_customer', $header->nm_cs)
                ->orderBy('date', 'desc')
                ->orderBy('no_pr', 'desc')
                ->value('no_pr');
        }

        $prItems = collect();
        if ($refPr) {
            $rawItems = DB::table('tb_detailpr')
                ->where('no_pr', $refPr)
                ->get();

            $prItems = $rawItems->map(function ($item) {
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
        }

        $mappedItems = $items->map(function ($item) {
            return [
                'no' => $item->no,
                'kd_material' => $item->kd_mat ?? null,
                'material' => $item->mat ?? null,
                'qty' => $item->qty ?? null,
                'unit' => $item->unit ?? null,
                'remark' => $item->remark ?? null,
            ];
        });

        return Inertia::render('marketing/delivery-order/edit', [
            'deliveryOrder' => [
                'no_do' => $header->no_do,
                'date' => $header->date,
                'ref_po' => $header->ref_po,
                'kd_cs' => $header->kd_cs,
                'nm_cs' => $header->nm_cs,
            ],
            'items' => $mappedItems,
            'refPr' => $refPr,
            'prItems' => $prItems,
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
        $prefix = $prefix.'.DO-';

        $lastNumber = DB::table('tb_do')
            ->where('no_do', 'like', $prefix.'%')
            ->orderBy('no_do', 'desc')
            ->value('no_do');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noDo = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

        $items = $request->input('items', []);
        if (!is_array($items)) {
            $items = [];
        }

        $refPr = $request->input('ref_pr');
        $parseNumber = static function ($value) {
            if ($value === null) {
                return 0.0;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }
            $clean = str_replace(',', '', (string) $value);
            return is_numeric($clean) ? (float) $clean : 0.0;
        };

        try {
            DB::transaction(function () use ($request, $items, $noDo, $refPr, $parseNumber) {
                DB::table('tb_kddo')->insert([
                    'no_do' => $noDo,
                    'tgl' => $request->input('date'),
                    'pos_tgl' => now()->toDateString(),
                    'ref_po' => $request->input('ref_po'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                foreach ($items as $index => $item) {
                    $material = $item['material'] ?? null;
                    $kdMaterial = $item['kd_material'] ?? null;

                    $detailPr = null;
                    if ($kdMaterial || $material) {
                        $detailPrQuery = DB::table('tb_detailpr')
                            ->where('no_pr', $refPr);
                        if ($kdMaterial) {
                            $detailPrQuery->where('kd_material', $kdMaterial);
                        } else {
                            $detailPrQuery->where('material', $material);
                        }
                        $detailPr = $detailPrQuery->first();
                    }

                    $resolvedKdMat = $kdMaterial
                        ?: ($detailPr->kd_material ?? $detailPr->kd_mat ?? $detailPr->kd_mtrl ?? null);

                    $price = 0;
                    $total = 0;
                    if ($resolvedKdMat || $material) {
                        $detailPoQuery = DB::table('tb_detailpo')
                            ->where('ref_pr', $refPr);
                        if ($resolvedKdMat) {
                            $detailPoQuery->where('kd_mat', $resolvedKdMat);
                        } else {
                            $detailPoQuery->where('material', $material);
                        }
                        $detailPo = $detailPoQuery
                            ->select('price', 'total_price')
                            ->first();
                        if ($detailPo) {
                            $price = $detailPo->price ?? 0;
                            $total = $detailPo->total_price ?? 0;
                        }
                    }

                    DB::table('tb_do')->insert([
                        'no_do' => $noDo,
                        'date' => $request->input('date'),
                        'pos_tgl' => now()->toDateString(),
                        'ref_po' => $request->input('ref_po'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
                        'harga' => $price,
                        'total' => $total,
                        'val_inv' => 0,
                        'inv' => ' ',
                    ]);

                    $stockNow = $item['stock_now'] ?? null;
                    if ($resolvedKdMat && $stockNow !== null) {
                        DB::table('tb_material')
                            ->where('kd_material', $resolvedKdMat)
                            ->update([
                                'stok' => $stockNow,
                                'rest_stock' => $stockNow,
                            ]);
                    }

                    if ($detailPr && ($resolvedKdMat || $material)) {
                        $currentSisa = $detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0;
                        $newSisa = $parseNumber($currentSisa) - $parseNumber($item['qty'] ?? 0);
                        if ($newSisa < 0) {
                            $newSisa = 0;
                        }

                        $detailPrUpdate = DB::table('tb_detailpr')
                            ->where('no_pr', $refPr);
                        if ($resolvedKdMat) {
                            $detailPrUpdate->where('kd_material', $resolvedKdMat);
                        } elseif ($material) {
                            $detailPrUpdate->where('material', $material);
                        }
                        $detailPrUpdate->update([
                            'sisa_pr' => $newSisa,
                        ]);
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.delivery-order.index')
            ->with('success', 'Data DO berhasil disimpan.');
    }

    public function updateDetail(Request $request, $noDo, $lineNo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Detail DO tidak ditemukan.');
        }

        $parseNumber = static function ($value) {
            if ($value === null) {
                return 0.0;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }
            $clean = str_replace(',', '', (string) $value);
            return is_numeric($clean) ? (float) $clean : 0.0;
        };

        $newQtyInput = $request->input('qty');
        $newQty = $parseNumber($newQtyInput);
        $oldQty = $parseNumber($row->qty ?? 0);
        $remarkInput = $request->input('remark');
        $remarkValue = $remarkInput === null ? ' ' : $remarkInput;
        $refPr = $request->input('ref_pr');

        try {
            DB::transaction(function () use (
                $noDo,
                $lineNo,
                $row,
                $newQtyInput,
                $remarkValue,
                $refPr,
                $oldQty,
                $newQty,
                $parseNumber
            ) {
                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->where('no', $lineNo)
                    ->update([
                        'qty' => $newQtyInput,
                        'remark' => $remarkValue,
                    ]);

                if (!$refPr) {
                    return;
                }

                $kdMat = $row->kd_mat ?? null;
                $material = $row->mat ?? null;
                if (!$kdMat && !$material) {
                    return;
                }

                $detailPrQuery = DB::table('tb_detailpr')
                    ->where('no_pr', $refPr);
                if ($kdMat) {
                    $detailPrQuery->where('kd_material', $kdMat);
                } else {
                    $detailPrQuery->where('material', $material);
                }
                $detailPr = $detailPrQuery->first();
                if (!$detailPr) {
                    return;
                }

                $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                $newSisa = $currentSisa + $oldQty - $newQty;
                if ($newSisa < 0) {
                    $newSisa = 0;
                }

                $detailPrQuery->update([
                    'sisa_pr' => $newSisa,
                ]);
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Data DO berhasil diperbarui.');
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
