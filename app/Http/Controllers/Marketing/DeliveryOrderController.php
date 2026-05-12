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

        return Inertia::render('marketing/delivery-order/index', [
            'deliveryOrders' => [],
            'outstandingCount' => 0,
            'realizedCount' => 0,
            'outstandingTotal' => 0,
            'realizedTotal' => 0,
            'period' => $period,
        ]);
    }

    public function data(Request $request)
    {
        try {
        $period = $request->query('period', 'today');
        $now = \Carbon\Carbon::now(); // Pastikan menggunakan backslash agar tidak error namespace

        $query = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->orderBy('no_do', 'desc');

        // Karena tb_do.date adalah STRING dd.mm.yyyy
        if ($period === 'today') {
            $query->where('date', $now->format('d.m.Y'));
        } elseif ($period === 'this_month') {
            // Mencari yang berakhiran .mm.yyyy
            $query->where('date', 'like', '%' . $now->format('.m.Y'));
        } elseif ($period === 'this_year') {
            // Mencari yang berakhiran .yyyy
            $query->where('date', 'like', '%' . $now->format('.Y'));
        }

        $deliveryOrders = $query->get();

        // Kueri Summary (Outstanding & Realized)
        // Gunakan try-catch internal agar jika summary gagal, tabel tetap muncul
        $outstandingCount = DB::table('tb_do')->where('val_inv', 0)->distinct('no_do')->count('no_do');
        $outstandingTotal = DB::table('tb_do')->where('val_inv', 0)->sum(DB::raw('CAST(total AS DECIMAL(18,4))'));

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'realizedCount' => 0, // Set 0 dulu untuk testing stabilitas
            'outstandingTotal' => (float)$outstandingTotal,
            'realizedTotal' => 0,
            'period' => $period,
        ]);
        } catch (\Exception $e) {
        // Log error untuk debug di storage/logs/laravel.log
        \Log::error("Error DO Data: " . $e->getMessage());
        return response()->json(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
        }
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
            return back()->with('error', 'Gagal memperbarui data: ' . $e->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil diperbarui.');
            return inertia_location('/marketing/delivery-order');
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
            ->select('no_do', 'mat', 'qty', 'unit', 'harga', 'total', 'remark', 'nm_cs', 'ref_po')
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

            $kdMats = $rawItems->map(fn($item) => $item->kd_material ?? $item->kd_mat ?? $item->kd_mtrl)->filter()->unique()->all();
            $stocks = DB::table('tb_material')
                ->whereIn('kd_material', $kdMats)
                ->pluck('stok', 'kd_material');

            $prItems = $rawItems->map(function ($item) use ($stocks) {
                $kdMaterial = $item->kd_material
                    ?? $item->kd_mat
                    ?? $item->kd_mtrl
                    ?? null;
                $material = $item->material ?? $item->mat ?? $item->mtrl ?? null;
                $unit = $item->unit ?? $item->satuan ?? $item->Unit ?? '';
                $remark = $item->renmark ?? $item->remark ?? $item->keterangan ?? '';
                $sisa = $item->sisa_pr ?? $item->Sisa_pr ?? null;
                $qty = $sisa ?? $item->qty ?? $item->Qty ?? $item->quantity ?? null;

                $lastStock = $stocks->get($kdMaterial) ?? 0;

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
            DB::transaction(function () use ($request, $items, $noDo, $parseNumber) {
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

                // Bulk Pre-fetching
                $refPo = $request->input('ref_po');
                $kodePoin = $request->input('kode_poin');
                $kdMaterialsFromItems = collect($items)->pluck('kd_material')->filter()->unique()->all();
                $materialNamesFromItems = collect($items)->pluck('material')->filter()->unique()->all();

                $materials = DB::table('tb_material')
                    ->whereIn('kd_material', $kdMaterialsFromItems)
                    ->orWhereIn(DB::raw('lower(trim(material))'), collect($materialNamesFromItems)->map(fn($n) => strtolower(trim($n))))
                    ->get();
                $materialsMap = $materials->keyBy(fn($row) => strtolower(trim((string)$row->material)));
                $materialsByCode = $materials->keyBy(fn($row) => strtolower(trim((string)$row->kd_material)));

                $doPayload = [];
                $ttldoPayload = [];
                $materialUpdates = [];
                $detailPoinUpdates = [];

                foreach ($items as $index => $item) {
                    $material = $item['material'] ?? null;
                    $kdMaterial = $item['kd_material'] ?? null;
                    $materialLower = strtolower(trim((string)$material));
                    $kdMaterialLower = strtolower(trim((string)$kdMaterial));

                    $resolvedKdMat = $kdMaterial;

                    $materialRow = $materialLower ? $materialsMap->get($materialLower) : null;
                    if (!$materialRow && $resolvedKdMat) {
                        $materialRow = $materialsByCode->get(strtolower(trim((string)$resolvedKdMat)));
                    }
                    if (!$resolvedKdMat && $materialRow?->kd_material) {
                        $resolvedKdMat = $materialRow->kd_material;
                    }

                    $effectivePrice = $materialRow->harga ?? 0;
                    $effectiveTotal = $parseNumber($item['qty'] ?? 0) * $parseNumber($effectivePrice);

                    $doPayload[] = [
                        'no_do' => $noDo,
                        'date' => $formattedDate,
                        'pos_tgl' => $todayFormatted,
                        'ref_po' => $refPo,
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
                    ];

                    $ttldoPayload[] = [
                        'no' => $item['no'] ?? ($index + 1),
                        'qty' => $item['qty'] ?? null,
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'unit' => $item['unit'] ?? null,
                        'price' => $effectivePrice,
                        'total' => $effectiveTotal,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
                    ];

                    $stockNow = $item['stock_now'] ?? null;
                    if ($resolvedKdMat && $stockNow !== null) {
                        $materialUpdates[] = [
                            'kd_material' => $resolvedKdMat,
                            'stok' => $stockNow,
                        ];
                    }

                    if ($kodePoin && $resolvedKdMat) {
                        $detailPoinUpdates[] = [
                            'kode_poin' => $kodePoin,
                            'kd_material' => $resolvedKdMat,
                            'qty' => $parseNumber($item['qty'] ?? 0),
                        ];
                    }
                }

                // Batch Inserts
                if (!empty($doPayload)) {
                    DB::table('tb_do')->insert($doPayload);
                }
                if (!empty($ttldoPayload)) {
                    DB::table('tb_ttldo')->insert($ttldoPayload);
                }

                // Batch updates (executed as single queries since Laravel doesn't have bulk update easily)
                foreach ($materialUpdates as $up) {
                    DB::table('tb_material')
                        ->where('kd_material', $up['kd_material'])
                        ->update([
                            'stok' => $up['stok'],
                            'rest_stock' => $up['stok'],
                        ]);
                }

                if (Schema::hasColumn('tb_detailpoin', 'sisa_qtydo')) {
                    foreach ($detailPoinUpdates as $up) {
                        $q = DB::table('tb_detailpoin')
                            ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string)$up['kode_poin']))]);
                        if ($up['kd_material']) {
                            $q->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim((string)$up['kd_material']))]);
                        }
                        $q->update([
                            'sisa_qtydo' => DB::raw(sprintf(
                                'case when coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F < 0 then 0 else coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F end',
                                $up['qty'],
                                $up['qty']
                            )),
                        ]);
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal menyimpan data: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil disimpan.');
            return inertia_location('/marketing/delivery-order');
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
        $stockNow = $request->input('stock_now');

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
                $newDate,
                $stockNow,
                $parseNumber
            ) {
                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->where('no', $lineNo)
                    ->update([
                        'date' => $newDate,
                        'qty' => $newQtyInput,
                        'remark' => $remarkValue,
                        'total' => (float)$newQty * (float)($row->harga ?? 0),
                    ]);

                if ($row->mat && $stockNow !== null) {
                    DB::table('tb_material')
                        ->whereRaw('lower(trim(material)) = ?', [strtolower(trim((string) $row->mat))])
                        ->update([
                            'stok' => $stockNow,
                            'rest_stock' => $stockNow,
                        ]);
                }

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
            return back()->with('error', 'Gagal memperbarui detail: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil diperbarui.');
            return inertia_location('/marketing/delivery-order');
        }

        return redirect()
            ->route('marketing.delivery-order.index')
            ->with('success', 'Data DO berhasil diperbarui.');
    }

    public function destroyDetail(Request $request, $noDo, $lineNo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            $message = 'Detail DO tidak ditemukan.';
            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 404);
            }
            return back()->with('error', $message);
        }

        $qty = is_numeric($row->qty ?? null) ? (float) $row->qty : 0;
        $kdMat = strtolower(trim((string) ($row->kd_mat ?? '')));
        $refPo = strtolower(trim((string) ($row->ref_po ?? '')));

        try {
            DB::transaction(function () use ($noDo, $lineNo, $qty, $kdMat, $refPo) {
                // Business rule: Minimal 1 material
                $count = DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->count();

                if ($count <= 1) {
                    throw new \RuntimeException('Gagal menghapus. Minimal harus ada 1 material dalam DO.');
                }

                if ($qty > 0 && $kdMat !== '' && $refPo !== '') {
                    $kodePoin = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [$refPo])
                        ->value('kode_poin');

                    if ($kodePoin) {
                        $updatePayload = [];

                        if (Schema::hasColumn('tb_detailpoin', 'sisa_qtypr')) {
                            $updatePayload['sisa_qtypr'] = DB::raw(sprintf(
                                'coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F',
                                $qty
                            ));
                        }

                        if (Schema::hasColumn('tb_detailpoin', 'sisa_qtydo')) {
                            $updatePayload['sisa_qtydo'] = DB::raw(sprintf(
                                'coalesce(cast(sisa_qtydo as decimal(18,4)), 0) + %.4F',
                                $qty
                            ));
                        }

                        if (!empty($updatePayload)) {
                            DB::table('tb_detailpoin')
                                ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string) $kodePoin))])
                                ->whereRaw('lower(trim(kd_material)) = ?', [$kdMat])
                                ->update($updatePayload);
                        }
                    }
                }

                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->where('no', $lineNo)
                    ->delete();
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal menghapus material: ' . $exception->getMessage());
        }

        $successMessage = 'Data material DO berhasil dihapus.';
        if ($request->expectsJson()) {
            return response()->json(['message' => $successMessage]);
        }
        if ($request->header('X-Inertia')) {
            session()->flash('success', $successMessage);
            return inertia_location('/marketing/delivery-order');
        }

        return back()->with('success', $successMessage);
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

                // Bulk Pre-fetching
                $refPos = $rows->pluck('ref_po')->filter()->unique()->all();

                $poinMap = collect();
                if (!empty($refPos)) {
                    $poinMap = DB::table('tb_poin')
                        ->whereIn(DB::raw('lower(trim(no_poin))'), collect($refPos)->map(fn($n) => strtolower(trim($n))))
                        ->get()
                        ->keyBy(fn($row) => strtolower(trim($row->no_poin)));
                }

                $materialUpdates = [];
                $detailPoinUpdates = [];

                foreach ($rows as $row) {
                    $qty = $parseNumber($row->qty ?? 0);
                    $kdMat = $row->kd_mat ?? null;
                    $matName = $row->mat ?? null;
                    $refPo = $row->ref_po ?? null;
                    $refPoLower = strtolower(trim((string)$refPo));

                    $kodePoin = $refPoLower ? $poinMap->get($refPoLower)?->kode_poin : null;

                    if ($kdMat) {
                        $materialUpdates[] = [
                            'material' => $matName,
                            'harga' => $row->harga ?? 0,
                            'qty' => $qty,
                        ];

                        if ($kodePoin) {
                            $detailPoinUpdates[] = [
                                'kode_poin' => $kodePoin,
                                'kd_material' => $kdMat,
                                'qty' => $qty,
                                'material' => null,
                            ];
                        }
                    } elseif ($matName) {
                        $materialUpdates[] = [
                            'qty' => $qty,
                            'material' => $matName,
                            'harga' => $row->harga ?? 0,
                        ];

                        if ($kodePoin) {
                            $detailPoinUpdates[] = [
                                'kode_poin' => $kodePoin,
                                'kd_material' => null,
                                'qty' => $qty,
                                'material' => $matName,
                            ];
                        }
                    }
                }

                // Execute Updates
                foreach ($materialUpdates as $up) {
                    $materialName = trim((string)($up['material'] ?? ''));
                    if ($materialName === '') {
                        continue;
                    }

                    $materialRow = DB::table('tb_material')
                        ->whereRaw('lower(trim(material)) = ?', [strtolower($materialName)])
                        ->first();

                    if (!$materialRow) {
                        continue;
                    }

                    $materialUpdate = [
                        'stok' => $parseNumber($materialRow->stok ?? 0) + $up['qty'],
                        'rest_stock' => $parseNumber($materialRow->rest_stock ?? 0) + $up['qty'],
                    ];

                    $doHarga = $parseNumber($up['harga'] ?? 0);
                    $materialHarga = $parseNumber($materialRow->harga ?? 0);
                    if ($doHarga > $materialHarga) {
                        $materialUpdate['harga'] = $doHarga;
                    }

                    DB::table('tb_material')
                        ->where('kd_material', $materialRow->kd_material)
                        ->update($materialUpdate);
                }

                $hasSisaQtyDo = Schema::hasColumn('tb_detailpoin', 'sisa_qtydo');
                if ($hasSisaQtyDo) {
                    foreach ($detailPoinUpdates as $up) {
                        $q = DB::table('tb_detailpoin')
                            ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string)$up['kode_poin']))]);
                        if ($up['kd_material']) {
                            $q->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim((string)$up['kd_material']))]);
                        } else {
                            $q->whereRaw('lower(trim(material)) = ?', [strtolower(trim((string)$up['material']))]);
                        }
                        $q->increment('sisa_qtydo', $up['qty']);
                    }
                }

                DB::table('tb_do')->where('no_do', $noDo)->delete();
                DB::table('tb_kddo')->where('no_do', $noDo)->delete();
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal menghapus DO: ' . $e->getMessage());
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Data DO berhasil dihapus.']);
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil dihapus.');
            return inertia_location('/marketing/delivery-order');
        }
    }

    public function searchPr(Request $request)
    {
    $search = $request->input('search');
    $perPageInput = $request->input('per_page', 5);
    
    // Batasi 'all' agar tidak menarik seluruh database yang bisa menyebabkan timeout
    $perPage = $perPageInput === 'all' ? 100 : (is_numeric($perPageInput) ? (int) $perPageInput : 5);

    $query = DB::table('tb_poin as p')
        ->whereExists(function ($subQuery) {
            $subQuery->select(DB::raw(1))
                ->from('tb_detailpoin as d')
                // OPTIMASI: Gunakan join standar daripada whereRaw jika memungkinkan
                ->whereColumn('d.kode_poin', 'p.kode_poin')
                // Hindari cast(decimal) di query jika kolom sudah numerik
                ->where('d.sisa_qtydo', '>', 0);
        })
        ->select('p.kode_poin', 'p.no_poin', 'p.date_poin', 'p.customer_name');

    if ($search) {
        $query->where(function ($q) use ($search) {
            $q->where('p.kode_poin', 'like', "%{$search}%")
              ->orWhere('p.no_poin', 'like', "%{$search}%")
              ->orWhere('p.customer_name', 'like', "%{$search}%");
        });
    }

    // Gunakan simplePaginate untuk performa lebih cepat jika data sangat besar
    return response()->json($query->orderByDesc('p.id')->paginate($perPage));
    }

    public function getPrDetails(Request $request)
    {
    $noPoin = $request->input('no_poin');
    $poin = DB::table('tb_poin')->where('no_poin', $noPoin)->first();

    if (!$poin) return response()->json(['error' => 'PO In not found'], 404);

    $kdCs = DB::table('tb_cs')->where('nm_cs', $poin->customer_name)->value('kd_cs');

    // OPTIMASI: Ambil detail tanpa whereRaw yang berat
    $rawItems = DB::table('tb_detailpoin')
        ->where('kode_poin', $poin->kode_poin)
        ->where('sisa_qtydo', '>', 0)
        ->get();

    $kdMats = $rawItems->pluck('kd_material')->filter()->unique()->all();
    $stocks = DB::table('tb_material')->whereIn('kd_material', $kdMats)->pluck('stok', 'kd_material');

    $items = $rawItems->map(function ($item) use ($stocks) {
        return (object) [
            'kd_material' => $item->kd_material,
            'material' => $item->material,
            'qty' => $item->sisa_qtydo ?? $item->qty,
            'unit' => $item->unit ?? '',
            'remark' => $item->remark ?? '',
            'sisa_qtydo' => $item->sisa_qtydo,
            'last_stock' => (float) ($stocks->get($item->kd_material) ?? 0),
        ];
    });

    return response()->json(['pr' => $poin, 'kd_cs' => $kdCs, 'items' => $items]);
    }
}
