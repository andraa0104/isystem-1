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
        $period = $request->query('period', 'today');

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

        // Realized DO: tb_fakturpenjualan.no_do = tb_kddo.no_do, filter tgl_pos
        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $realizedQuery = DB::table('tb_kddo as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_do))'));
            });

        $now = now();
        if ($period === 'today') {
            $realizedQuery->whereRaw("{$docDateExpr} = ?", [$now->toDateString()]);
        } elseif ($period === 'this_week') {
            $realizedQuery->whereRaw("{$docDateExpr} between ? and ?", [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString(),
            ]);
        } elseif ($period === 'this_month') {
            $realizedQuery->whereRaw("month({$docDateExpr}) = ?", [$now->month])
                ->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $realizedQuery->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        }

        $realizedNos = $realizedQuery->distinct('k.no_do')->pluck('k.no_do');
        $realizedCount = $realizedNos->count();
        // total diambil dari tb_do.total untuk no_do yang terealisasi
        $realizedTotal = DB::table('tb_do')
            ->whereIn(DB::raw('lower(trim(no_do))'), $realizedNos->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        $outstandingTotal = DB::table('tb_do')
            ->where('val_inv', 0)
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return Inertia::render('marketing/delivery-order/index', [
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'realizedCount' => $realizedCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedTotal' => (float) $realizedTotal,
            'period' => $period,
        ]);
    }

    public function update(Request $request, $noDo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Data DO tidak ditemukan.');
        }

        try {
            $dateInput = $request->input('date');
            $formattedDate = $dateInput;
            try {
                $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
            } catch (\Throwable $e) {
                $formattedDate = $dateInput;
            }

            DB::transaction(function () use ($noDo, $formattedDate, $request) {
                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->update([
                        'date' => $formattedDate,
                    ]);

                DB::table('tb_kddo')
                    ->where('no_do', $noDo)
                    ->update([
                        'tgl' => $formattedDate,
                    ]);
            });
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Data DO berhasil diperbarui.');
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

        $query = DB::table('tb_do')
            ->select('no_do', 'mat', 'qty', 'harga', 'total', 'remark', 'nm_cs', 'ref_po')
            ->where('no_do', $noDo);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('mat', 'like', "%{$search}%");
        }

        if ($request->boolean('realized_only')) {
            $query->whereIn(
                DB::raw('lower(trim(ref_po))'),
                DB::table('tb_fakturpenjualan')
                    ->selectRaw('lower(trim(ref_po))')
                    ->whereRaw('lower(trim(no_do)) = ?', [strtolower(trim($noDo))])
            );
        }

        $deliveryOrderDetails = $query->orderBy('no_do')->get();

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

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $query = DB::table('tb_kddo as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_do))'));
            })
            ->select(
                'k.no_do',
                'k.pos_tgl as date',
                'k.ref_po',
                'f.nm_cs'
            )
            ->distinct();

        $now = now();
        if ($period === 'today') {
            $query->whereRaw("{$docDateExpr} = ?", [$now->toDateString()]);
        } elseif ($period === 'this_week') {
            $query->whereRaw("{$docDateExpr} between ? and ?", [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString(),
            ]);
        } elseif ($period === 'this_month') {
            $query->whereRaw("month({$docDateExpr}) = ?", [$now->month])
                ->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $query->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        }

        $deliveryOrders = $query
            ->orderBy('k.pos_tgl', 'desc')
            ->orderBy('k.no_do', 'desc')
            ->get();

        $realizedTotal = DB::table('tb_do')
            ->whereIn(DB::raw('lower(trim(no_do))'), $deliveryOrders->pluck('no_do')->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
            'realizedTotal' => (float) $realizedTotal,
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
            $normalizedRefPo = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $header->ref_po));
            $refPr = DB::table('tb_pr')
                ->select('no_pr', 'ref_po')
                ->get()
                ->first(function ($row) use ($normalizedRefPo) {
                    $candidate = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $row->ref_po));
                    return $candidate === $normalizedRefPo;
                })
                ?->no_pr;
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
                $dateInput = $request->input('date');
                try {
                    $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                    $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
                } catch (\Throwable $e) {
                    $formattedDate = $dateInput;
                }
                $todayFormatted = now()->format('d.m.Y');

                DB::table('tb_kddo')->insert([
                    'no_do' => $noDo,
                    'tgl' => $formattedDate,
                    'pos_tgl' => $todayFormatted,
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

                    // ambil kd_mat dan harga dari tb_material berdasarkan nama material jika perlu
                    $materialRow = null;
                    if ($material) {
                        $materialRow = DB::table('tb_material')
                            ->whereRaw('lower(trim(material)) = ?', [strtolower(trim($material))])
                            ->first(['kd_material', 'harga']);
                    }
                    if (!$resolvedKdMat && $materialRow?->kd_material) {
                        $resolvedKdMat = $materialRow->kd_material;
                    }

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

                    // price & total fallback ke tb_material.harga bila ada
                    $priceFromMaterial = $materialRow->harga ?? null;
                    $effectivePrice = $priceFromMaterial !== null ? $priceFromMaterial : $price;
                    $effectiveTotal = $parseNumber($item['qty'] ?? 0) * $parseNumber($effectivePrice);

                    DB::table('tb_do')->insert([
                        'no_do' => $noDo,
                        'date' => $formattedDate,
                        'pos_tgl' => $todayFormatted,
                        'ref_po' => $request->input('ref_po'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
                        'harga' => $effectivePrice,
                        'total' => $effectiveTotal,
                        'val_inv' => 0,
                        'inv' => ' ',
                    ]);

                    DB::table('tb_ttldo')->insert([
                        'no' => $item['no'] ?? ($index + 1),
                        'qty' => $item['qty'] ?? null,
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'unit' => $item['unit'] ?? null,
                        'price' => $effectivePrice,
                        'total' => $effectiveTotal,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
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
        $newDateInput = $request->input('date');
        try {
            $parsed = $newDateInput ? \Carbon\Carbon::parse($newDateInput) : null;
            $newDate = $parsed ? $parsed->format('d.m.Y') : $newDateInput;
        } catch (\Throwable $e) {
            $newDate = $newDateInput;
        }

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
                        'date' => $newDate,
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

    public function destroy(Request $request, $noDo)
    {
        $rows = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['message' => 'Data DO tidak ditemukan.'], 404);
        }

        try {
            DB::transaction(function () use ($rows, $noDo) {
                foreach ($rows as $row) {
                    $qty = (float) ($row->qty ?? 0);
                    $kdMat = $row->kd_mat ?? null;
                    $matName = $row->mat ?? null;
                    $refPo = $row->ref_po ?? null;

                    if ($kdMat) {
                        DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->increment('stok', $qty);

                        $detailQuery = DB::table('tb_detailpr')
                            ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim($kdMat))]);
                        if ($refPo) {
                            $detailQuery->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPo))]);
                        }
                        $detailQuery->increment('sisa_pr', $qty);
                    } elseif ($matName) {
                        // fallback by material name
                        DB::table('tb_detailpr')
                            ->whereRaw('lower(trim(material)) = ?', [strtolower(trim($matName))])
                            ->when($refPo, function ($q) use ($refPo) {
                                $q->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPo))]);
                            })
                            ->increment('sisa_pr', $qty);
                    }
                }

                DB::table('tb_do')->where('no_do', $noDo)->delete();
                DB::table('tb_kddo')->where('no_do', $noDo)->delete();
            });
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menghapus DO: '.$e->getMessage(),
            ], 500);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Data DO berhasil dihapus.']);
        }

        return redirect()
            ->route('marketing.delivery-order.index')
            ->with('success', 'Data DO berhasil dihapus.');
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
