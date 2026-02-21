<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderInController
{
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
        $database = (string) (
            $request->cookie('tenant_database')
            ?? $request->session()->get('tenant.database')
            ?? config('database.connections.'.config('database.default').'.database')
            ?? ''
        );

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

    public function index()
    {
        $search = trim((string) request()->query('search', ''));
        $perPageInput = request()->query('per_page', 5);
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::table('tb_poin')
            ->select(
                'id',
                'kode_poin',
                'no_poin',
                'date_poin',
                'delivery_date',
                'customer_name',
                'grand_total'
            );

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = '%'.strtolower($search).'%';
                $q->whereRaw('lower(kode_poin) like ?', [$like])
                    ->orWhereRaw('lower(no_poin) like ?', [$like])
                    ->orWhereRaw('lower(customer_name) like ?', [$like]);
            });
        }

        $total = (clone $query)->count();
        $page = max(1, (int) request()->query('page', 1));
        if ($perPage === null) {
            $rows = (clone $query)->orderByDesc('id')->get();
        } else {
            $rows = (clone $query)
                ->orderByDesc('id')
                ->forPage($page, $perPage)
                ->get();
        }

        $outstandingBase = DB::table('tb_detailpoin as d')
            ->join('tb_poin as p', 'p.kode_poin', '=', 'd.kode_poin')
            ->where('d.sisa_qtydo', '<>', 0);

        $realizedBase = DB::table('tb_detailpoin as d')
            ->join('tb_poin as p', 'p.kode_poin', '=', 'd.kode_poin')
            ->whereColumn('d.sisa_qtypr', '<>', 'd.qty');

        $outstandingRows = (clone $outstandingBase)
            ->select(
                'p.id',
                'p.kode_poin',
                'p.no_poin',
                'p.date_poin',
                'p.delivery_date',
                'p.customer_name',
                'p.grand_total',
                DB::raw("case when exists (
                    select 1 from tb_pr pr
                    where lower(trim(pr.ref_po)) = lower(trim(p.no_poin))
                ) then 0 else 1 end as can_delete")
            )
            ->distinct()
            ->orderByDesc('p.id')
            ->get();

        $realizedRows = (clone $realizedBase)
            ->select(
                'p.id',
                'p.kode_poin',
                'p.no_poin',
                'p.date_poin',
                'p.delivery_date',
                'p.customer_name',
                'p.grand_total'
            )
            ->distinct()
            ->orderByDesc('p.id')
            ->get();

        return Inertia::render('marketing/purchase-order-in/index', [
            'summary' => [
                'total' => DB::table('tb_poin')->count(),
                'outstanding' => $outstandingRows->count(),
                'realized' => $realizedRows->count(),
            ],
            'purchaseOrderIns' => $rows,
            'outstandingPurchaseOrderIns' => $outstandingRows,
            'realizedPurchaseOrderIns' => $realizedRows,
            'filters' => [
                'search' => $search,
                'per_page' => $perPage === null ? 'all' : (string) $perPage,
                'page' => $page,
            ],
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage === null ? 'all' : $perPage,
                'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
            ],
        ]);
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

        $purchaseOrderInItems = DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->orderBy('line_no')
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
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first();

        if (!$header) {
            return response()->json([
                'message' => 'Data PO In tidak ditemukan.',
            ], 404);
        }

        $search = trim((string) $request->query('search', ''));
        $perPageInput = $request->query('per_page', 5);
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin);
        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->whereRaw('lower(material) like ?', [$like]);
        }

        $total = (clone $query)->count();
        $page = max(1, (int) $request->query('page', 1));

        if ($perPage === null) {
            $items = (clone $query)
                ->orderBy('line_no')
                ->get();
        } else {
            $items = (clone $query)
                ->orderBy('line_no')
                ->forPage($page, $perPage)
                ->get();
        }

        return response()->json([
            'header' => $header,
            'items' => $items,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage === null ? 'all' : $perPage,
                'total_pages' => $perPage === null ? 1 : max(1, (int) ceil($total / $perPage)),
            ],
        ]);
    }

    public function print($kodePoin)
    {
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first();

        if (!$header) {
            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('error', 'Data PO In tidak ditemukan.');
        }

        $items = DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->orderBy('line_no')
            ->get();

        return Inertia::render('marketing/purchase-order-in/print', [
            'header' => $header,
            'items' => $items,
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
            return response()->json([
                'customers' => $data,
                'total' => $data->count(),
            ]);
        }

        $page = max(1, (int) $request->query('page', 1));
        $total = (clone $query)->count();
        $data = (clone $query)
            ->orderBy('nm_cs')
            ->forPage($page, $perPage)
            ->get();

        return response()->json([
            'customers' => $data,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function store(Request $request)
    {
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
            'materials' => ['required', 'array', 'min:1'],
            'materials.*.kd_material' => ['nullable', 'string', 'max:100'],
            'materials.*.material' => ['required', 'string', 'max:255'],
            'materials.*.qty' => ['required', 'numeric', 'min:0.0001'],
            'materials.*.satuan' => ['nullable', 'string', 'max:100'],
            'materials.*.price_po_in' => ['required', 'numeric', 'min:0'],
            'materials.*.total_price_po_in' => ['nullable', 'numeric', 'min:0'],
            'materials.*.remark' => ['nullable', 'string'],
        ]);

        try {
            DB::transaction(function () use ($request, $validated) {
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
                    'no_poin' => trim((string) $validated['no_poin']),
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
                    'created_at' => $nowGmt8,
                    'updated_at' => $nowGmt8,
                ]);

                $detailId = (int) (DB::table('tb_detailpoin')->max('id') ?? 0) + 1;
                foreach (($validated['materials'] ?? []) as $index => $item) {
                    $qty = (float) ($item['qty'] ?? 0);
                    $price = (float) ($item['price_po_in'] ?? 0);
                    $totalDetail = isset($item['total_price_po_in'])
                        ? (float) $item['total_price_po_in']
                        : ($qty * $price);
                    DB::table('tb_detailpoin')->insert([
                        'id' => $detailId + $index,
                        'kode_poin' => $kodePoin,
                        'line_no' => $index + 1,
                        'kd_material' => trim((string) ($item['kd_material'] ?? '')),
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
                    ]);
                }
            });

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil disimpan.');
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
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
            'materials' => ['required', 'array', 'min:1'],
            'materials.*.id' => ['nullable'],
            'materials.*.kd_material' => ['nullable', 'string', 'max:100'],
            'materials.*.material' => ['required', 'string', 'max:255'],
            'materials.*.qty' => ['required', 'numeric', 'min:0.0001'],
            'materials.*.satuan' => ['nullable', 'string', 'max:100'],
            'materials.*.price_po_in' => ['required', 'numeric', 'min:0'],
            'materials.*.total_price_po_in' => ['nullable', 'numeric', 'min:0'],
            'materials.*.remark' => ['nullable', 'string'],
        ]);

        try {
            DB::transaction(function () use ($validated, $kodePoin) {
                $nowGmt8 = now('Asia/Singapore');
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

                DB::table('tb_poin')
                    ->where('kode_poin', $kodePoin)
                    ->update([
                        'no_poin' => trim((string) $validated['no_poin']),
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

                $existingIds = DB::table('tb_detailpoin')
                    ->where('kode_poin', $kodePoin)
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->all();

                $existingSet = array_flip($existingIds);
                $keptIds = [];
                $nextId = ((int) (DB::table('tb_detailpoin')->max('id') ?? 0)) + 1;

                foreach (($validated['materials'] ?? []) as $index => $item) {
                    $qty = (float) ($item['qty'] ?? 0);
                    $price = (float) ($item['price_po_in'] ?? 0);
                    $totalDetail = isset($item['total_price_po_in'])
                        ? (float) $item['total_price_po_in']
                        : ($qty * $price);
                    $incomingId = $item['id'] ?? null;
                    $resolvedId = null;

                    if ($incomingId !== null && $incomingId !== '' && is_numeric($incomingId)) {
                        $candidate = (int) $incomingId;
                        if (isset($existingSet[$candidate])) {
                            $resolvedId = $candidate;
                        }
                    }

                    if ($resolvedId !== null) {
                        DB::table('tb_detailpoin')
                            ->where('id', $resolvedId)
                            ->where('kode_poin', $kodePoin)
                            ->update([
                                'line_no' => $index + 1,
                                'kd_material' => trim((string) ($item['kd_material'] ?? '')),
                                'material' => trim((string) ($item['material'] ?? '')),
                                'qty' => $qty,
                                'sisa_qtypr' => $qty,
                                'sisa_qtydo' => $qty,
                                'satuan' => trim((string) ($item['satuan'] ?? '')),
                                'price_po_in' => $price,
                                'total_price_po_in' => $totalDetail,
                                'remark' => trim((string) ($item['remark'] ?? '')),
                                'updated_at' => $nowGmt8,
                            ]);
                        $keptIds[] = $resolvedId;
                    } else {
                        $insertId = $nextId++;
                        DB::table('tb_detailpoin')->insert([
                            'id' => $insertId,
                            'kode_poin' => $kodePoin,
                            'line_no' => $index + 1,
                            'kd_material' => trim((string) ($item['kd_material'] ?? '')),
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
                        ]);
                        $keptIds[] = $insertId;
                    }
                }

                DB::table('tb_detailpoin')
                    ->where('kode_poin', $kodePoin)
                    ->whereNotIn('id', $keptIds)
                    ->delete();
            });

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil diperbarui.');
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function destroy($kodePoin)
    {
        $exists = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->exists();

        if (!$exists) {
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

            return redirect()
                ->route('marketing.purchase-order-in.index')
                ->with('success', 'PO In berhasil dihapus.');
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
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
                'kd_material' => ['nullable', 'string', 'max:100'],
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

            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->update([
                    'kd_material' => trim((string) ($validated['kd_material'] ?? '')),
                    'material' => trim((string) $validated['material']),
                    'qty' => $qty,
                    'sisa_qtypr' => $qty,
                    'sisa_qtydo' => $qty,
                    'satuan' => trim((string) ($validated['satuan'] ?? '')),
                    'price_po_in' => $price,
                    'total_price_po_in' => $total,
                    'remark' => trim((string) ($validated['remark'] ?? '')),
                    'updated_at' => $nowGmt8,
                ]);

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

            $deleted = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->delete();

            if (!$deleted) {
                return response()->json([
                    'message' => 'Data material tidak ditemukan.',
                ], 404);
            }

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
