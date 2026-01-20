<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DeliveryOrderAddController
{
    public function create()
    {
        return Inertia::render('marketing/delivery-order-add/create');
    }

    public function edit(Request $request, $noDob)
    {
        $items = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->orderBy('no')
            ->get();

        $header = $items->first();
        if (!$header) {
            return redirect()
                ->route('marketing.delivery-order-add.index')
                ->with('error', 'Data DOB tidak ditemukan.');
        }

        $refDo = $header->ref_do ?? null;
        $refPo = null;
        if ($refDo) {
            $refPo = DB::table('tb_do')
                ->where('no_do', $refDo)
                ->value('ref_po');
        }

        $mappedItems = $items->map(function ($item) {
            $lastStock = 0;
            if ($item->kd_mat) {
                $lastStock = DB::table('tb_material')
                    ->where('kd_material', $item->kd_mat)
                    ->value('stok');
            }

            return [
                'no' => $item->no,
                'kd_mat' => $item->kd_mat ?? null,
                'mat' => $item->mat ?? null,
                'qty' => $item->qty ?? null,
                'unit' => $item->unit ?? null,
                'remark' => $item->remark ?? null,
                'harga' => $item->harga ?? null,
                'total' => $item->total ?? null,
                'last_stock' => (float) ($lastStock ?? 0),
            ];
        });

        return Inertia::render('marketing/delivery-order-add/edit', [
            'deliveryOrder' => [
                'no_dob' => $header->no_dob,
                'date' => $header->date,
                'ref_do' => $header->ref_do,
                'ref_po' => $refPo,
                'kd_cs' => $header->kd_cs,
                'nm_cs' => $header->nm_cs,
            ],
            'items' => $mappedItems,
        ]);
    }

    public function index()
    {
        $deliveryOrders = DB::table('tb_dob')
            ->select('no_dob', 'ref_do', 'nm_cs', 'status')
            ->groupBy('no_dob', 'ref_do', 'nm_cs', 'status')
            ->orderBy('no_dob', 'desc')
            ->get();

        $outstandingCount = DB::table('tb_dob')
            ->where('status', 0)
            ->distinct('no_dob')
            ->count('no_dob');

        $outstandingTotal = DB::table('tb_dob')
            ->where('status', 0)
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        $realizedCount = DB::table('tb_dob')
            ->where('status', 1)
            ->distinct('no_dob')
            ->count('no_dob');

        return Inertia::render('marketing/delivery-order-add/index', [
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
        ]);
    }

    public function details(Request $request)
    {
        $noDob = $request->query('no_dob');
        if (!$noDob) {
            return response()->json([
                'details' => [],
                'header' => null,
            ]);
        }

        $details = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->orderBy('no_dob')
            ->get();

        $header = $details->first();

        return response()->json([
            'details' => $details,
            'header' => $header ? [
                'no_dob' => $header->no_dob,
                'nm_cs' => $header->nm_cs,
                'ref_do' => $header->ref_do,
                'date' => $header->date,
                'pos_tgl' => $header->pos_tgl,
            ] : null,
        ]);
    }

    public function outstandingDo()
    {
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'kd_cs')
            ->where('val_inv', 0)
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'kd_cs')
            ->orderBy('date', 'desc')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function prMaterials(Request $request)
    {
        $refPo = $request->query('ref_po');
        if (!$refPo) {
            return response()->json([
                'items' => [],
            ]);
        }

        $rawItems = DB::table('tb_detailpr')
            ->where('ref_po', $refPo)
            ->whereRaw('coalesce(cast(replace(sisa_pr, \',\', \'\') as decimal(18,4)), 0) > 0')
            ->orderBy('no')
            ->get();

        $items = $rawItems->map(function ($item) {
            $kdMaterial = $item->kd_material
                ?? $item->kd_mat
                ?? $item->kd_mtrl
                ?? null;
            $lastStock = 0;
            if ($kdMaterial) {
                $lastStock = DB::table('tb_material')
                    ->where('kd_material', $kdMaterial)
                    ->value('stok');
            }

            return [
                'no' => $item->no ?? null,
                'kd_material' => $kdMaterial,
                'material' => $item->material ?? $item->mat ?? $item->mtrl ?? null,
                'qty' => $item->qty ?? null,
                'sisa_pr' => $item->sisa_pr ?? $item->Sisa_pr ?? null,
                'unit' => $item->unit ?? $item->satuan ?? $item->Unit ?? null,
                'remark' => $item->renmark ?? $item->remark ?? null,
                'price_po' => $item->price_po ?? null,
                'last_stock' => (float) ($lastStock ?? 0),
            ];
        });

        return response()->json([
            'items' => $items,
        ]);
    }

    public function outstanding()
    {
        $deliveryOrders = DB::table('tb_dob')
            ->select('no_dob', 'ref_do', 'nm_cs', 'status')
            ->where('status', 0)
            ->groupBy('no_dob', 'ref_do', 'nm_cs', 'status')
            ->orderBy('no_dob', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
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
        $prefix = $prefix.'.DOT-';

        $lastNumber = DB::table('tb_dob')
            ->where('no_dob', 'like', $prefix.'%')
            ->orderBy('no_dob', 'desc')
            ->value('no_dob');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noDob = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

        $items = $request->input('items', []);
        if (!is_array($items)) {
            $items = [];
        }
        $refPo = $request->input('ref_po');
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
            DB::transaction(function () use ($request, $items, $noDob, $refPo, $parseNumber) {
                DB::table('tb_kddob')->insert([
                    'no_dob' => $noDob,
                    'date' => $request->input('date'),
                    'pos_tgl' => now()->toDateString(),
                    'ref_do' => $request->input('ref_do'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                foreach ($items as $index => $item) {
                    $qtyValue = $parseNumber($item['qty'] ?? 0);

                    DB::table('tb_dob')->insert([
                        'no_dob' => $noDob,
                        'date' => $request->input('date'),
                        'pos_tgl' => now()->toDateString(),
                        'ref_do' => $request->input('ref_do'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'kd_mat' => $item['kd_mat'] ?? null,
                        'mat' => $item['mat'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                        'harga' => $item['harga'] ?? null,
                        'total' => $item['total'] ?? null,
                        'status' => 0,
                    ]);

                    if ($refPo) {
                        $kdMat = $item['kd_mat'] ?? null;
                        $mat = $item['mat'] ?? null;
                        if ($kdMat || $mat) {
                            $detailPrQuery = DB::table('tb_detailpr')
                                ->where('ref_po', $refPo);
                            if ($kdMat) {
                                $detailPrQuery->where('kd_material', $kdMat);
                            } else {
                                $detailPrQuery->where('material', $mat);
                            }

                            $detailPr = $detailPrQuery->first();
                            if ($detailPr) {
                                $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                                $newSisa = $currentSisa - $qtyValue;
                                if ($newSisa < 0) {
                                    $newSisa = 0;
                                }
                                $detailPrQuery->update([
                                    'sisa_pr' => $newSisa,
                                ]);
                            }

                            if ($kdMat) {
                                $materialRow = DB::table('tb_material')
                                    ->where('kd_material', $kdMat)
                                    ->first();
                                if ($materialRow) {
                                    $currentStok = $parseNumber($materialRow->stok ?? 0);
                                    $currentRest = $parseNumber($materialRow->rest_stock ?? 0);
                                    $newStok = $currentStok - $qtyValue;
                                    $newRest = $currentRest - $qtyValue;
                                    if ($newStok < 0) {
                                        $newStok = 0;
                                    }
                                    if ($newRest < 0) {
                                        $newRest = 0;
                                    }

                                    DB::table('tb_material')
                                        ->where('kd_material', $kdMat)
                                        ->update([
                                            'stok' => $newStok,
                                            'rest_stock' => $newRest,
                                        ]);
                                }
                            }
                        }
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.delivery-order-add.index')
            ->with('success', 'Data DOB berhasil disimpan.');
    }

    public function updateDetail(Request $request, $noDob, $lineNo)
    {
        $row = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Detail DOB tidak ditemukan.');
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
        $refPo = $request->input('ref_po');
        $stockNowInput = $request->input('stock_now');
        $stockNowValue = $stockNowInput === null ? null : $parseNumber($stockNowInput);
        $newHarga = $parseNumber($request->input('harga', $row->harga ?? 0));
        $newTotal = $newHarga * $newQty;

        try {
            DB::transaction(function () use (
                $noDob,
                $lineNo,
                $row,
                $newQtyInput,
                $newHarga,
                $newTotal,
                $remarkValue,
                $refPo,
                $stockNowValue,
                $oldQty,
                $newQty,
                $parseNumber
            ) {
                DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->where('no', $lineNo)
                    ->update([
                        'qty' => $newQtyInput,
                        'harga' => $newHarga,
                        'remark' => $remarkValue,
                        'total' => $newTotal,
                    ]);

                if (!$refPo) {
                    return;
                }

                $kdMat = $row->kd_mat ?? null;
                $mat = $row->mat ?? null;
                if (!$kdMat && !$mat) {
                    return;
                }

                $detailPrQuery = DB::table('tb_detailpr')
                    ->where('ref_po', $refPo);
                if ($kdMat) {
                    $detailPrQuery->where('kd_material', $kdMat);
                } else {
                    $detailPrQuery->where('material', $mat);
                }
                $detailPr = $detailPrQuery->first();
                if ($detailPr) {
                    $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                    $newSisa = $currentSisa + $oldQty - $newQty;
                    if ($newSisa < 0) {
                        $newSisa = 0;
                    }
                    $detailPrQuery->update([
                        'sisa_pr' => $newSisa,
                    ]);
                }

                if ($kdMat) {
                    $materialRow = DB::table('tb_material')
                        ->where('kd_material', $kdMat)
                        ->first();
                    if ($materialRow) {
                        if ($stockNowValue !== null) {
                            $newStok = $stockNowValue;
                            $newRest = $stockNowValue;
                        } else {
                            $currentStok = $parseNumber($materialRow->stok ?? 0);
                            $currentRest = $parseNumber($materialRow->rest_stock ?? 0);
                            $newStok = $currentStok + $oldQty - $newQty;
                            $newRest = $currentRest + $oldQty - $newQty;
                            if ($newStok < 0) {
                                $newStok = 0;
                            }
                            if ($newRest < 0) {
                                $newRest = 0;
                            }
                        }

                        DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->update([
                                'stok' => $newStok,
                                'rest_stock' => $newRest,
                            ]);
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Data DOB berhasil diperbarui.');
    }

    public function print(Request $request, $noDob)
    {
        $deliveryOrderDetails = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->orderBy('no_dob')
            ->get();

        $deliveryOrder = $deliveryOrderDetails->first();

        if (!$deliveryOrder) {
            return redirect()
                ->route('marketing.delivery-order-add.index')
                ->with('error', 'Data DO bantu tidak ditemukan.');
        }

        $customerAddress = null;
        if ($deliveryOrder?->nm_cs) {
            $customerAddress = DB::table('tb_cs')
                ->where('nm_cs', $deliveryOrder->nm_cs)
                ->value('alamat_cs');
        }

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

        return Inertia::render('marketing/delivery-order-add/print', [
            'deliveryOrder' => $deliveryOrder,
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
            'grandTotal' => $grandTotal,
            'company' => $company,
        ]);
    }
}
