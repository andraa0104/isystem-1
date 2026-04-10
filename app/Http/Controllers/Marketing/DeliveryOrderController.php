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
            ->orderBy('no_do', 'desc')
            ->orderBy('date', 'desc')
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

                // Bulk Pre-fetching
                $kdMaterialsFromItems = collect($items)->pluck('kd_material')->filter()->unique()->all();
                $materialNamesFromItems = collect($items)->pluck('material')->filter()->unique()->all();

                $detailPrs = collect();
                if ($refPr) {
                    $detailPrs = DB::table('tb_detailpr')
                        ->where('no_pr', $refPr)
                        ->get()
                        ->groupBy(fn($row) => strtolower(trim((string)($row->kd_material ?? $row->kd_mat ?? ''))))
                        ->mapWithKeys(function ($group, $key) {
                            return [$key => $group->first()];
                        });
                }

                $materialsMap = DB::table('tb_material')
                    ->whereIn('kd_material', $kdMaterialsFromItems)
                    ->orWhereIn(DB::raw('lower(trim(material))'), collect($materialNamesFromItems)->map(fn($n) => strtolower(trim($n))))
                    ->get()
                    ->keyBy(fn($row) => strtolower(trim($row->material)));

                $detailPos = collect();
                if ($refPr) {
                    $detailPos = DB::table('tb_detailpo')
                        ->where('ref_pr', $refPr)
                        ->get()
                        ->groupBy(fn($row) => strtolower(trim((string)($row->kd_mat ?? ''))))
                        ->mapWithKeys(function ($group, $key) {
                            return [$key => $group->first()];
                        });
                }

                $doPayload = [];
                $ttldoPayload = [];
                $materialUpdates = [];
                $detailPrUpdates = [];

                foreach ($items as $index => $item) {
                    $material = $item['material'] ?? null;
                    $kdMaterial = $item['kd_material'] ?? null;
                    $materialLower = strtolower(trim((string)$material));
                    $kdMaterialLower = strtolower(trim((string)$kdMaterial));

                    $detailPr = $kdMaterialLower ? $detailPrs->get($kdMaterialLower) : null;
                    if (!$detailPr && $materialLower) {
                        // Fallback fallback: identify detailPr by material name if no kd_material match found in group
                        $detailPr = $detailPrs->first(fn($row) => strtolower(trim($row->material ?? '')) === $materialLower);
                    }

                    $resolvedKdMat = $kdMaterial
                        ?: ($detailPr->kd_material ?? $detailPr->kd_mat ?? $detailPr->kd_mtrl ?? null);

                    $materialRow = $materialLower ? $materialsMap->get($materialLower) : null;
                    if (!$resolvedKdMat && $materialRow?->kd_material) {
                        $resolvedKdMat = $materialRow->kd_material;
                    }

                    $price = 0;
                    $total = 0;
                    $resolvedKdMatLower = strtolower(trim((string)$resolvedKdMat));
                    if ($resolvedKdMatLower) {
                        $detailPo = $detailPos->get($resolvedKdMatLower);
                        if (!$detailPo && $materialLower) {
                            $detailPo = $detailPos->first(fn($row) => strtolower(trim($row->material ?? '')) === $materialLower);
                        }
                        if ($detailPo) {
                            $price = $detailPo->price ?? 0;
                            $total = $detailPo->total_price ?? 0;
                        }
                    }

                    $priceFromMaterial = $materialRow->harga ?? null;
                    $effectivePrice = $priceFromMaterial !== null ? $priceFromMaterial : $price;
                    $effectiveTotal = $parseNumber($item['qty'] ?? 0) * $parseNumber($effectivePrice);

                    $doPayload[] = [
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

                    if ($detailPr && ($resolvedKdMat || $material)) {
                        $currentSisa = $detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0;
                        $newSisa = $parseNumber($currentSisa) - $parseNumber($item['qty'] ?? 0);
                        if ($newSisa < 0) {
                            $newSisa = 0;
                        }

                        $detailPrUpdates[] = [
                            'no_pr' => $refPr,
                            'kd_material' => $detailPr->kd_material ?? null,
                            'material' => $detailPr->material ?? null,
                            'sisa_pr' => $newSisa,
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

                foreach ($detailPrUpdates as $up) {
                    $q = DB::table('tb_detailpr')->where('no_pr', $up['no_pr']);
                    if ($up['kd_material']) {
                        $q->where('kd_material', $up['kd_material']);
                    } else {
                        $q->where('material', $up['material']);
                    }
                    $q->update(['sisa_pr' => $up['sisa_pr']]);
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
                // Bulk Pre-fetching
                $refPos = $rows->pluck('ref_po')->filter()->unique()->all();
                $kdMats = $rows->pluck('kd_mat')->filter()->unique()->all();
                $materialNames = $rows->pluck('mat')->filter()->unique()->all();

                $poinMap = collect();
                if (!empty($refPos)) {
                    $poinMap = DB::table('tb_poin')
                        ->whereIn(DB::raw('lower(trim(no_poin))'), collect($refPos)->map(fn($n) => strtolower(trim($n))))
                        ->get()
                        ->keyBy(fn($row) => strtolower(trim($row->no_poin)));
                }

                $materialUpdates = [];
                $detailPrUpdates = [];
                $detailPoinUpdates = [];

                foreach ($rows as $row) {
                    $qty = (float) ($row->qty ?? 0);
                    $kdMat = $row->kd_mat ?? null;
                    $matName = $row->mat ?? null;
                    $refPo = $row->ref_po ?? null;
                    $refPoLower = strtolower(trim((string)$refPo));

                    $kodePoin = $refPoLower ? $poinMap->get($refPoLower)?->kode_poin : null;

                    if ($kdMat) {
                        $materialUpdates[] = [
                            'kd_material' => $kdMat,
                            'qty' => $qty,
                        ];

                        $detailPrUpdates[] = [
                            'kd_material' => $kdMat,
                            'ref_po' => $refPo,
                            'qty' => $qty,
                            'material' => null,
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
                        $detailPrUpdates[] = [
                            'kd_material' => null,
                            'ref_po' => $refPo,
                            'qty' => $qty,
                            'material' => $matName,
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
                    DB::table('tb_material')
                        ->where('kd_material', $up['kd_material'])
                        ->increment('stok', $up['qty']);
                }

                foreach ($detailPrUpdates as $up) {
                    $q = DB::table('tb_detailpr');
                    if ($up['kd_material']) {
                        $q->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim($up['kd_material']))]);
                    } else {
                        $q->whereRaw('lower(trim(material)) = ?', [strtolower(trim($up['material']))]);
                    }
                    if ($up['ref_po']) {
                        $q->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($up['ref_po']))]);
                    }
                    $q->increment('sisa_pr', $up['qty']);
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
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::table('tb_poin as p')
            ->whereExists(function ($subQuery) {
                $subQuery->select(DB::raw(1))
                    ->from('tb_detailpoin as d')
                    ->whereRaw('lower(trim(d.kode_poin)) = lower(trim(p.kode_poin))')
                    ->whereRaw('coalesce(cast(d.sisa_qtydo as decimal(18,4)), 0) <> 0');
            })
            ->select(
                'p.kode_poin',
                'p.no_poin',
                'p.date_poin',
                'p.customer_name'
            );

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('p.kode_poin', 'like', "%{$search}%")
                    ->orWhere('p.no_poin', 'like', "%{$search}%")
                    ->orWhere('p.customer_name', 'like', "%{$search}%");
            });
        }

        $query = $query
            ->orderByDesc('p.id');

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
        $noPoin = $request->input('no_poin');

        $poin = DB::table('tb_poin')->where('no_poin', $noPoin)->first();

        if (!$poin) {
            return response()->json(['error' => 'PO In not found'], 404);
        }

        $kdCs = DB::table('tb_cs')
            ->where('nm_cs', $poin->customer_name)
            ->value('kd_cs');

        try {
            $rawItems = DB::table('tb_detailpoin')
                ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string) $poin->kode_poin))])
                ->whereRaw('coalesce(cast(sisa_qtydo as decimal(18,4)), 0) <> 0')
                ->get();
        } catch (\Throwable $exception) {
            return response()->json([
                'error' => 'Gagal mengambil detail PO In.',
                'message' => $exception->getMessage(),
            ], 500);
        }

        $kdMats = $rawItems->map(fn($item) => $item->kd_material)->filter()->unique()->all();
        $stocks = DB::table('tb_material')
            ->whereIn('kd_material', $kdMats)
            ->pluck('stok', 'kd_material');

        $items = $rawItems->map(function ($item) use ($stocks) {
            $kdMaterial = $item->kd_material ?? null;
            $material = $item->material ?? null;
            $unit = $item->unit ?? $item->satuan ?? $item->Unit ?? '';
            $remark = $item->renmark ?? $item->remark ?? $item->keterangan ?? '';
            $sisaDo = $item->sisa_qtydo ?? null;
            $qty = $sisaDo ?? $item->qty ?? null;

            $lastStock = $stocks->get($kdMaterial) ?? 0;

            return (object) [
                'kd_material' => $kdMaterial,
                'material' => $material,
                'qty' => $qty,
                'unit' => $unit,
                'remark' => $remark,
                'sisa_qtydo' => $sisaDo,
                'last_stock' => (float) $lastStock,
            ];
        });

        return response()->json([
            'pr' => $poin,
            'kd_cs' => $kdCs,
            'items' => $items,
        ]);
    }
}
