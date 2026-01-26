<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

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

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

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

        // DOT terealisasi: tb_fakturpenjualan.no_do = tb_kddob.no_dob, filter tgl_pos
        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $realizedQuery = DB::table('tb_kddob as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_dob))'));
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

        $realizedNos = $realizedQuery->distinct('k.no_dob')->pluck('k.no_dob');
        $realizedCount = $realizedNos->count();
        $realizedTotal = DB::table('tb_dob')
            ->whereIn(DB::raw('lower(trim(no_dob))'), $realizedNos->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return Inertia::render('marketing/delivery-order-add/index', [
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
            'realizedTotal' => (float) $realizedTotal,
            'period' => $period,
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

        $detailsQuery = DB::table('tb_dob')->where('no_dob', $noDob);
        $details = $detailsQuery
            ->orderBy('no_dob')
            ->get();

        $header = $details->first();

        if ($request->boolean('realized_only') && $header?->ref_do) {
            $refPo = DB::table('tb_do')
                ->where(DB::raw('lower(trim(no_do))'), strtolower(trim($header->ref_do)))
                ->value('ref_po');

            if ($refPo) {
                $details = DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->whereExists(function ($q) use ($refPo) {
                        $q->select(DB::raw(1))
                            ->from('tb_kdfakturpenjualan')
                            ->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPo))]);
                    })
                    ->orderBy('no_dob')
                    ->get();
            } else {
                $details = collect();
            }
        }

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

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $query = DB::table('tb_kddob as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_dob))'));
            })
            ->leftJoin('tb_dob as d', function ($join) {
                $join->on(DB::raw('lower(trim(d.no_dob))'), '=', DB::raw('lower(trim(k.no_dob))'));
            })
            ->select(
                'k.no_dob',
                'k.no_do as ref_do',
                'f.nm_cs',
                DB::raw("coalesce(f.tgl_pos, k.pos_tgl) as date"),
                DB::raw('coalesce(cast(d.total as decimal(18,4)), 0) as total')
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
            ->orderBy('k.no_dob', 'desc')
            ->get();

        $realizedTotal = DB::table('tb_dob')
            ->whereIn(DB::raw('lower(trim(no_dob))'), $deliveryOrders->pluck('no_dob')->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
            'realizedTotal' => (float) $realizedTotal,
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
                $dateInput = $request->input('date');
                try {
                    $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                    $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
                } catch (\Throwable $e) {
                    $formattedDate = $dateInput;
                }
                $todayFormatted = now()->format('d.m.Y');

                DB::table('tb_kddob')->insert([
                    'no_dob' => $noDob,
                    'date' => $formattedDate,
                    'pos_tgl' => $todayFormatted,
                    'ref_do' => $request->input('ref_do'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                foreach ($items as $index => $item) {
                    $qtyValue = $parseNumber($item['qty'] ?? 0);

                    $materialRow = null;
                    if (!empty($item['kd_mat'])) {
                        $materialRow = DB::table('tb_material')
                            ->where('kd_material', $item['kd_mat'])
                            ->first(['kd_material', 'harga']);
                    }
                    if (!$materialRow && !empty($item['mat'])) {
                        $materialRow = DB::table('tb_material')
                            ->whereRaw('lower(trim(material)) = ?', [strtolower(trim($item['mat']))])
                            ->first(['kd_material', 'harga']);
                    }

                    $resolvedKdMat = $item['kd_mat'] ?? $materialRow->kd_material ?? null;
                    $priceFromMaterial = $materialRow->harga ?? $item['harga'] ?? 0;
                    $effectiveTotal = $qtyValue * $parseNumber($priceFromMaterial);

                    DB::table('tb_dob')->insert([
                        'no_dob' => $noDob,
                        'date' => $formattedDate,
                        'pos_tgl' => $todayFormatted,
                        'ref_do' => $request->input('ref_do'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'kd_mat' => $resolvedKdMat,
                        'mat' => $item['mat'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                        'harga' => $priceFromMaterial,
                        'total' => $effectiveTotal,
                        'status' => 0,
                    ]);

                    DB::table('tb_ttldo')->insert([
                        'no' => $item['no'] ?? ($index + 1),
                        'qty' => $item['qty'] ?? null,
                        'mat' => $item['mat'] ?? null,
                        'kd_mat' => $resolvedKdMat,
                        'unit' => $item['unit'] ?? null,
                        'price' => $priceFromMaterial,
                        'total' => $effectiveTotal,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                    ]);

                    if ($refPo) {
                        $kdMat = $resolvedKdMat;
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

    public function update(Request $request, $noDob)
    {
        $request->validate([
            'date' => ['required'],
            'no_dob' => ['nullable', 'string'],
        ]);

        $rawDate = $request->input('date');
        $targetNoDob = $request->input('no_dob', $noDob);

        try {
            $carbonDate = Carbon::parse($rawDate);
            $formattedDate = $carbonDate->format('d.m.Y');
        } catch (\Throwable $e) {
            $formattedDate = $rawDate;
        }

        try {
            DB::transaction(function () use ($targetNoDob, $formattedDate) {
                DB::table('tb_dob')
                    ->where(DB::raw('lower(trim(no_dob))'), strtolower(trim($targetNoDob)))
                    ->update(['date' => $formattedDate]);

                DB::table('tb_kddob')
                    ->where(DB::raw('lower(trim(no_dob))'), strtolower(trim($targetNoDob)))
                    ->update(['date' => $formattedDate]);
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal memperbarui tanggal: '.$e->getMessage());
        }

        return back()->with('success', 'Tanggal DO berhasil diperbarui.');
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

    public function destroy(Request $request, $noDob)
    {
        $rows = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['message' => 'Data DOT tidak ditemukan.'], 404);
        }

        try {
            DB::transaction(function () use ($rows, $noDob) {
                foreach ($rows as $row) {
                    $qty = (float) ($row->qty ?? 0);
                    $kdMat = $row->kd_mat ?? null;
                    $matName = $row->mat ?? null;
                    $refDo = $row->ref_do ?? null;

                    if ($kdMat) {
                        DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->increment('stok', $qty);
                    }

                    $refPo = null;
                    if ($refDo) {
                        $refPo = DB::table('tb_do')
                            ->where('no_do', $refDo)
                            ->value('ref_po');
                    }

                    if ($refPo) {
                        $detailQuery = DB::table('tb_detailpr')
                            ->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPo))]);
                        if ($kdMat) {
                            $detailQuery->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim($kdMat))]);
                        } elseif ($matName) {
                            $detailQuery->whereRaw('lower(trim(material)) = ?', [strtolower(trim($matName))]);
                        }
                        $detailQuery->increment('sisa_pr', $qty);
                    }
                }

                DB::table('tb_dob')->where('no_dob', $noDob)->delete();
                DB::table('tb_kddob')->where('no_dob', $noDob)->delete();
            });
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menghapus DOT: '.$e->getMessage(),
            ], 500);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Data DOT berhasil dihapus.']);
        }

        return redirect()
            ->route('marketing.delivery-order-add.index')
            ->with('success', 'Data DOT berhasil dihapus.');
    }
}
