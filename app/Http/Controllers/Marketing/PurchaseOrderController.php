<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController
{
    public function create()
    {
        $vendors = DB::table('tb_vendor')
            ->select(
                'kd_vdr',
                'nm_vdr',
                'almt_vdr',
                'telp_vdr',
                'eml_vdr',
                'attn_vdr'
            )
            ->orderBy('nm_vdr')
            ->get();

        return Inertia::render('Pembelian/purchase-order/create', [
            'purchaseRequirements' => [],
            'purchaseRequirementDetails' => [],
            'vendors' => $vendors,
        ]);
    }

    public function edit($noPo)
    {
        $purchaseOrder = DB::table('tb_po')
            ->where('no_po', $noPo)
            ->first();

        if (!$purchaseOrder) {
            return redirect()
                ->route('pembelian.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->orderBy('no')
            ->get();

        $vendors = DB::table('tb_vendor')
            ->select(
                'kd_vdr',
                'nm_vdr',
                'almt_vdr',
                'telp_vdr',
                'eml_vdr',
                'attn_vdr'
            )
            ->orderBy('nm_vdr')
            ->get();

        return Inertia::render('Pembelian/purchase-order/edit', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'purchaseRequirements' => [],
            'purchaseRequirementDetails' => [],
            'vendors' => $vendors,
        ]);
    }

    public function outstandingPurchaseRequirements()
    {
        $purchaseRequirements = DB::table('tb_pr as pr')
            ->leftJoin(
                DB::raw('(
                    select
                        no_pr,
                        sum(case when sisa_pr <> 0 then 1 else 0 end) as outstanding_count
                    from tb_detailpr
                    group by no_pr
                ) as detail'),
                'pr.no_pr',
                '=',
                'detail.no_pr'
            )
            ->select(
                'pr.no_pr',
                'pr.date',
                'pr.for_customer',
                'pr.ref_po',
                DB::raw('coalesce(detail.outstanding_count, 0) as outstanding_count')
            )
            ->where(DB::raw('coalesce(detail.outstanding_count, 0)'), '>', 0)
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
        ]);
    }

    public function purchaseRequirementDetails(Request $request)
    {
        $query = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                'kd_material',
                'material',
                'qty',
                'unit',
                'renmark'
            )
            ->orderBy('no_pr');

        $noPr = $request->query('no_pr');
        if ($noPr) {
            $query->where('no_pr', $noPr);
        }

        return response()->json([
            'purchaseRequirementDetails' => $query->get(),
        ]);
    }

    public function vendors()
    {
        $vendors = DB::table('tb_vendor')
            ->select(
                'kd_vdr',
                'nm_vdr',
                'almt_vdr',
                'telp_vdr',
                'eml_vdr',
                'attn_vdr'
            )
            ->orderBy('nm_vdr')
            ->get();

        return response()->json([
            'vendors' => $vendors,
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
        $prefix = $prefix.'.PO-';

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $ppnRaw = $request->input('ppn');
        $ppnValue = $ppnRaw === null || $ppnRaw === '' ? '' : $ppnRaw.'%';
        $dateInput = $request->input('date');
        $dateFormatted = null;
        try {
            $parsedDate = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
            $dateFormatted = $parsedDate ? $parsedDate->format('d.m.Y') : null;
        } catch (\Throwable $e) {
            $dateFormatted = $dateInput; // fallback
        }

        $sTotal = (float) $request->input('s_total', 0);
        $hPpn = (float) $request->input('h_ppn', 0);
        $gTotal = (float) $request->input('g_total', 0);

        $maxId = (int) (DB::table('tb_detailpo')->max('id') ?? 0);

        $maxAttempts = 3;
        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use (
                    $request,
                    $materials,
                    $prefix,
                    $ppnValue,
                    $sTotal,
                    $hPpn,
                    $gTotal,
                    &$maxId
                ) {
                    $lastNumber = DB::table('tb_po')
                        ->where('no_po', 'like', $prefix.'%')
                        ->orderBy('no_po', 'desc')
                        ->lockForUpdate()
                        ->value('no_po');

                    $sequence = 1;
                    if ($lastNumber) {
                        $suffix = substr($lastNumber, strlen($prefix));
                        $sequence = max(1, (int) $suffix + 1);
                    }

                    $noPo = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

                    if (DB::table('tb_po')->where('no_po', $noPo)->exists()) {
                        throw new \RuntimeException('duplicate_no_po');
                    }

                    DB::table('tb_po')->insert([
                        'no_po' => $noPo,
                        'tgl' => $dateFormatted,
                        'ref_pr' => $request->input('ref_pr'),
                        'ref_quota' => $request->input('ref_quota'),
                        'for_cus' => $request->input('for_cus'),
                        'ref_poin' => $request->input('ref_poin'),
                        'total_harga' => 0,
                        'qty_po' => 0,
                        'ppn' => $ppnValue,
                        'nm_vdr' => $request->input('nm_vdr'),
                        's_total' => $sTotal,
                        'h_ppn' => $hPpn,
                        'g_total' => $gTotal,
                    ]);

                    foreach ($materials as $index => $item) {
                        $maxId += 1;

                        $noPr = $request->input('ref_pr');
                        $kdMat = $item['kd_mat'] ?? null;
                        $qty = (float) ($item['qty'] ?? 0);

                        $prQty = (float) DB::table('tb_detailpr')
                            ->where('no_pr', $noPr)
                            ->where('kd_material', $kdMat)
                            ->value('qty');

                        $usedQty = (float) DB::table('tb_detailpo')
                            ->where('ref_pr', $noPr)
                            ->where('kd_mat', $kdMat)
                            ->sum('qty');

                        $sisaPr = $prQty - ($usedQty + $qty);

                        DB::table('tb_detailpo')->insert([
                            'id' => $maxId,
                            'no_po' => $noPo,
                            'tgl' => $dateFormatted,
                            'ref_pr' => $request->input('ref_pr'),
                            'ref_quota' => $request->input('ref_quota'),
                            'for_cus' => $request->input('for_cus'),
                            'ref_poin' => $request->input('ref_poin'),
                            'kd_vdr' => $request->input('kd_vdr'),
                            'nm_vdr' => $request->input('nm_vdr'),
                            'payment_terms' => $request->input('payment_terms'),
                            'del_time' => $request->input('del_time'),
                            'franco_loco' => $request->input('franco_loco'),
                            'no' => $item['no'] ?? ($index + 1),
                            'kd_mat' => $kdMat,
                            'material' => $item['material'] ?? null,
                            'qty' => $qty,
                            'qty_po' => $qty,
                            'gr_mat' => $qty,
                            'unit' => $item['unit'] ?? null,
                            'price' => $item['price'] ?? 0,
                            'total_price' => $item['total_price'] ?? 0,
                            'gr_price' => $item['total_price'] ?? 0,
                            'ket1' => $request->input('ket1'),
                            'ket2' => $request->input('ket2'),
                            'ket3' => $request->input('ket3'),
                            'ket4' => $request->input('ket4'),
                            'ir_mat' => 0,
                            'ir_price' => 0,
                            'end_fl' => 0,
                            'qtybiayakirim' => 0,
                            'no_gudang' => 0,
                            'end_gr' => 0,
                            'sisa_pr' => $sisaPr,
                        ]);
                    }
                });
                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isDuplicate = str_contains($message, 'duplicate_no_po')
                    || str_contains($message, 'duplicate')
                    || ($exception instanceof \Illuminate\Database\QueryException
                        && $exception->getCode() === '23000');

                if ($attempt < $maxAttempts && $isDuplicate) {
                    continue;
                }

                return back()->with('error', $exception->getMessage());
            }
        }

        return redirect()
            ->route('pembelian.purchase-order.index')
            ->with('success', 'Data PO berhasil disimpan.');
    }

    public function update(Request $request, $noPo)
    {
        $exists = DB::table('tb_po')
            ->where('no_po', $noPo)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('pembelian.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $ppnRaw = $request->input('ppn');
        $ppnValue = $ppnRaw === null || $ppnRaw === '' ? '' : $ppnRaw.'%';

        $sTotal = (float) $request->input('s_total', 0);
        $hPpn = (float) $request->input('h_ppn', 0);
        $gTotal = (float) $request->input('g_total', 0);
        $dateInput = $request->input('date');
        $dateFormatted = null;
        try {
            $parsedDate = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
            $dateFormatted = $parsedDate ? $parsedDate->format('d.m.Y') : null;
        } catch (\Throwable $e) {
            $dateFormatted = $dateInput; // fallback
        }

        try {
            DB::transaction(function () use (
                $request,
                $materials,
                $noPo,
                $ppnValue,
                $sTotal,
                $hPpn,
                $gTotal,
                $dateFormatted
            ) {
                DB::table('tb_po')
                    ->where('no_po', $noPo)
                    ->update([
                        'tgl' => $dateFormatted,
                        'ref_pr' => $request->input('ref_pr'),
                        'ref_quota' => $request->input('ref_quota'),
                        'for_cus' => $request->input('for_cus'),
                        'ref_poin' => $request->input('ref_poin'),
                        'ppn' => $ppnValue,
                        'nm_vdr' => $request->input('nm_vdr'),
                        's_total' => $sTotal,
                        'h_ppn' => $hPpn,
                        'g_total' => $gTotal,
                    ]);

                $nowStamp = now()->format('m/d/Y h:i:s A');

                foreach ($materials as $item) {
                    $id = $item['id'] ?? null;
                    $kdMat = $item['kd_mat'] ?? null;
                    if (!$id && !$kdMat) {
                        continue;
                    }

                    $priceRaw = $item['price'] ?? null;
                    $isPriceEmpty = $priceRaw === '' || $priceRaw === null;
                    $priceValue = $isPriceEmpty ? '' : $priceRaw;
                    $totalPriceRaw = $item['total_price'] ?? null;
                    $totalPriceValue = $isPriceEmpty ? '' : ($totalPriceRaw ?? '');
                    $qtyValue = $item['qty'] ?? 0;

                    $detailQuery = DB::table('tb_detailpo')->where('no_po', $noPo);
                    if ($kdMat) {
                        $detailQuery->where('kd_mat', $kdMat);
                    } else {
                        $detailQuery->where('id', $id);
                    }

                    $detailQuery->update([
                        'tgl' => $dateFormatted,
                        'qty' => $qtyValue,
                        'price' => $priceValue,
                        'total_price' => $totalPriceValue,
                        'gr_price' => $totalPriceValue,
                        'ppn' => $ppnValue,
                    ]);

                    if ($kdMat) {
                        $detailRow = DB::table('tb_detailpo')
                            ->where('no_po', $noPo)
                            ->where('kd_mat', $kdMat)
                            ->first();

                        $idPo = $detailRow->id_po ?? null;
                        $qtyValue = $item['qty'] ?? ($detailRow->qty ?? 0);
                        $unitValue = $item['unit'] ?? ($detailRow->unit ?? '');
                        $materialName = $item['material'] ?? ($detailRow->material ?? '');
                        $priceValue = $item['price'] ?? ($detailRow->price ?? 0);
                        $totalPriceValue = $item['total_price'] ?? ($detailRow->total_price ?? 0);
                        $noValue = $item['no'] ?? ($detailRow->no ?? null);

                        DB::table('tb_ubahpo')->insert([
                            'no_po' => $noPo,
                            'tgl' => $dateFormatted,
                            'ref_pr' => $request->input('ref_pr'),
                            'ref_quota' => $request->input('ref_quota'),
                            'for_cus' => $request->input('for_cus'),
                            'ref_poin' => $request->input('ref_poin'),
                            'kd_vdr' => $request->input('kd_vdr'),
                            'nm_vdr' => $request->input('nm_vdr'),
                            'ppn' => $ppnValue,
                            'payment_terms' => $request->input('payment_terms'),
                            'del_time' => $request->input('del_time'),
                            'franco_loco' => $request->input('franco_loco'),
                            'ket1' => $request->input('ket1'),
                            'ket2' => $request->input('ket2'),
                            'ket3' => $request->input('ket3'),
                            'ket4' => $request->input('ket4'),
                            'ket' => $request->input('ket1'),
                            'kd_mat' => $kdMat,
                            'material' => $materialName,
                            'qty' => $qtyValue,
                            'qty_po' => $qtyValue,
                            'ir_mat' => ' ',
                            'gr_mat' => ' ',
                            'sisa_pr' => $qtyValue,
                            'unit' => $unitValue,
                            'price' => $priceValue,
                            'total_price' => $totalPriceValue,
                            'gr_price' => ' ',
                            'ir_price' => ' ',
                            'no' => $noValue ?? 0,
                            'id' => $noValue,
                            'id_po' => $idPo,
                            'tgl_ubah' => $nowStamp,
                        ]);
                    }
                }

                $totalPpn = (float) DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->selectRaw('coalesce(sum(total_price - (qty * price)), 0) as total_ppn')
                    ->value('total_ppn');

                DB::table('tb_po')
                    ->where('no_po', $noPo)
                    ->update([
                        'h_ppn' => $totalPpn,
                    ]);
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('pembelian.purchase-order.index')
            ->with('success', 'Data PO berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPo, $detailId)
    {
        $updated = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->where('id', $detailId)
            ->update([
                'qty' => $request->input('qty', 0),
                'price' => $request->input('price', 0),
                'total_price' => $request->input('total_price', 0),
                'gr_price' => $request->input('total_price', 0),
            ]);

        if (!$updated) {
            return back()->with('error', 'Detail PO tidak ditemukan.');
        }

        $totalPpn = (float) DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->selectRaw('coalesce(sum(total_price - (qty * price)), 0) as total_ppn')
            ->value('total_ppn');

        $totalBeforePpn = (float) DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->selectRaw('coalesce(sum(qty * price), 0) as total_before_ppn')
            ->value('total_before_ppn');

        $grandTotal = (float) DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->selectRaw('coalesce(sum(total_price), 0) as grand_total')
            ->value('grand_total');

        DB::table('tb_po')
            ->where('no_po', $noPo)
            ->update([
                's_total' => $totalBeforePpn,
                'h_ppn' => $totalPpn,
                'g_total' => $grandTotal,
            ]);

        return back()->with('success', 'Detail PO berhasil diperbarui.');
    }

    public function destroyDetail($noPo, $kdMat)
    {
        try {
            DB::transaction(function () use ($noPo, $kdMat) {
                DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->where('kd_mat', $kdMat)
                    ->delete();

                $totalBeforePpn = (float) DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->selectRaw('coalesce(sum(qty * price), 0) as total_before_ppn')
                    ->value('total_before_ppn');

                $grandTotal = (float) DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->selectRaw('coalesce(sum(total_price), 0) as grand_total')
                    ->value('grand_total');

                $totalPpn = $grandTotal - $totalBeforePpn;

                DB::table('tb_po')
                    ->where('no_po', $noPo)
                    ->update([
                        's_total' => $totalBeforePpn,
                        'h_ppn' => $totalPpn,
                        'g_total' => $grandTotal,
                    ]);
            });
        } catch (\Throwable $e) {
            return redirect()
                ->back()
                ->with('error', 'Gagal menghapus material: '.$e->getMessage());
        }

        return redirect()
            ->back()
            ->with('success', 'Material berhasil dihapus.');
    }

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        $purchaseOrders = DB::table('tb_po as po')
            ->leftJoin(
                DB::raw('(
                    select
                        no_po,
                        max(case when gr_mat <> 0 then 1 else 0 end) as has_outstanding
                    from tb_detailpo
                    group by no_po
                ) as detail'),
                'po.no_po',
                '=',
                'detail.no_po'
            )
            ->select(
                'po.no_po',
                'po.tgl',
                'po.for_cus',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.ppn',
                'po.s_total',
                'po.h_ppn',
                DB::raw('coalesce(detail.has_outstanding, 0) as has_outstanding')
            )
            ->orderBy('tgl', 'desc')
            ->orderBy('no_po', 'desc')
            ->get();

        $outstandingCount = DB::table('tb_detailpo')
            ->where('gr_mat', '<>', 0)
            ->distinct('no_po')
            ->count('no_po');

        $outstandingTotal = (float) DB::table('tb_detailpo')
            ->where('gr_mat', '<>', 0)
            ->sum('total_price');

        // Realized Count berdasarkan tb_kdmi.ref_pr = tb_po.no_po dan filter doc_tgl
        $docDateExpr = "coalesce(date(k.doc_tgl), str_to_date(k.doc_tgl, '%Y-%m-%d'), str_to_date(k.doc_tgl, '%Y/%m/%d'), str_to_date(k.doc_tgl, '%d/%m/%Y'), str_to_date(k.doc_tgl, '%d-%m-%Y'), str_to_date(k.doc_tgl, '%d.%m.%Y'))";

        $realizedQuery = DB::table('tb_po')
            ->join('tb_kdmi as k', function ($join) {
                $join->on(
                    DB::raw('lower(trim(tb_po.no_po))'),
                    '=',
                    DB::raw('lower(trim(k.ref_pr))')
                );
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
            $realizedQuery
                ->whereRaw("month({$docDateExpr}) = ?", [$now->month])
                ->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $realizedQuery->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        }

        $realizedPoNos = $realizedQuery->distinct('tb_po.no_po')->pluck('tb_po.no_po');
        $realizedCount = $realizedPoNos->count();
        $realizedTotal = DB::table('tb_po')
            ->whereIn('no_po', $realizedPoNos)
            ->sum('g_total');

        if ($request->wantsJson()) {
            return response()->json([
                'realizedCount' => $realizedCount,
                'realizedTotal' => (float) $realizedTotal,
                'period' => $period,
            ]);
        }

        return Inertia::render('Pembelian/purchase-order/index', [
            'purchaseOrders' => $purchaseOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
            'realizedTotal' => (float) $realizedTotal,
            'period' => $period,
        ]);
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        $docDateExpr = "coalesce(date(k.doc_tgl), str_to_date(k.doc_tgl, '%Y-%m-%d'), str_to_date(k.doc_tgl, '%Y/%m/%d'), str_to_date(k.doc_tgl, '%d/%m/%Y'), str_to_date(k.doc_tgl, '%d-%m-%Y'), str_to_date(k.doc_tgl, '%d.%m.%Y'))";

        $query = DB::table('tb_po as po')
            ->join('tb_kdmi as k', function ($join) {
                $join->on(DB::raw('lower(trim(po.no_po))'), '=', DB::raw('lower(trim(k.ref_pr))'));
            })
            ->select(
                'po.no_po',
                'po.tgl',
                'po.for_cus',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.ppn',
                'po.s_total',
                'po.h_ppn',
                DB::raw('0 as has_outstanding')
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

        $purchaseOrders = $query
            ->orderBy('po.tgl', 'desc')
            ->orderBy('po.no_po', 'desc')
            ->get();

        $realizedTotal = $purchaseOrders->sum(function ($item) {
            return (float) ($item->g_total ?? 0);
        });

        return response()->json([
            'purchaseOrders' => $purchaseOrders,
            'realizedTotal' => (float) $realizedTotal,
        ]);
    }

    public function data()
    {
        $purchaseOrders = DB::table('tb_po as po')
            ->leftJoin(
                DB::raw('(
                    select
                        no_po,
                        max(case when gr_mat <> 0 then 1 else 0 end) as has_outstanding
                    from tb_detailpo
                    group by no_po
                ) as detail'),
                'po.no_po',
                '=',
                'detail.no_po'
            )
            ->select(
                'po.no_po',
                'po.tgl',
                'po.for_cus',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.ppn',
                'po.s_total',
                'po.h_ppn',
                DB::raw('coalesce(detail.has_outstanding, 0) as has_outstanding')
            )
            ->orderBy('tgl', 'desc')
            ->orderBy('no_po', 'desc')
            ->get();

        return response()->json([
            'purchaseOrders' => $purchaseOrders,
        ]);
    }

    public function details(Request $request)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json([
                'purchaseOrder' => null,
                'purchaseOrderDetails' => [],
            ]);
        }

        $header = DB::table('tb_po')
            ->select(
                'no_po',
                'tgl',
                'ref_pr',
                'ref_quota',
                'ref_poin',
                'for_cus',
                'nm_vdr',
                's_total',
                'h_ppn',
                'g_total',
                'ppn'
            )
            ->where('no_po', $noPo)
            ->first();

        $query = DB::table('tb_detailpo')
            ->select(
                'no_po',
                'no',
                'material',
                'qty',
                'unit',
                'price',
                'total_price',
                'del_time',
                'payment_terms',
                'franco_loco',
                'ket1',
                'ket2',
                'ket3',
                'ket4'
            )
            ->where('no_po', $noPo);

        if ($request->boolean('realized_only')) {
            // only tampilkan detail yang sudah masuk gudang (no_gudang != 0 / kosong)
            $query->whereRaw("coalesce(nullif(no_gudang, ''), '0') <> '0'");
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('material', 'like', "%{$search}%");
        }

        $purchaseOrderDetails = $query->orderBy('no')->get();

        return response()->json([
            'purchaseOrder' => $header,
            'purchaseOrderDetails' => $purchaseOrderDetails,
        ]);
    }

    public function outstanding()
    {
        $purchaseOrders = DB::table('tb_po as po')
            ->leftJoin(
                DB::raw('(
                    select
                        no_po,
                        max(case when gr_mat <> 0 then 1 else 0 end) as has_outstanding
                    from tb_detailpo
                    group by no_po
                ) as detail'),
                'po.no_po',
                '=',
                'detail.no_po'
            )
            ->select(
                'po.no_po',
                'po.tgl',
                'po.for_cus',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.ppn',
                'po.s_total',
                'po.h_ppn',
                DB::raw('coalesce(detail.has_outstanding, 0) as has_outstanding'),
                DB::raw('case when exists (select 1 from tb_invin where lower(trim(tb_invin.ref_po)) = lower(trim(po.no_po))) then 0 else 1 end as can_delete')
            )
            ->where(DB::raw('coalesce(detail.has_outstanding, 0)'), '>', 0)
            ->orderBy('tgl', 'desc')
            ->orderBy('no_po', 'desc')
            ->get();

        return response()->json([
            'purchaseOrders' => $purchaseOrders,
        ]);
    }

    public function print(Request $request, $noPo)
    {
        $purchaseOrder = DB::table('tb_po as po')
            ->leftJoin(
                DB::raw('(
                    select
                        no_po,
                        max(kd_vdr) as kd_vdr
                    from tb_detailpo
                    group by no_po
                ) as detail'),
                'po.no_po',
                '=',
                'detail.no_po'
            )
            ->leftJoin('tb_pr as pr', 'po.ref_pr', '=', 'pr.no_pr')
            ->leftJoin('tb_vendor as vdr', 'detail.kd_vdr', '=', 'vdr.kd_vdr')
            ->select(
                'po.*',
                'pr.ref_po as pr_ref_po',
                'detail.kd_vdr',
                'vdr.npwp_vdr',
                'vdr.almt_vdr',
                'vdr.telp_vdr',
                'vdr.eml_vdr',
                'vdr.attn_vdr'
            )
            ->where('po.no_po', $noPo)
            ->first();

        if (!$purchaseOrder) {
            return redirect()
                ->route('pembelian.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->orderBy('no')
            ->get();

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
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

        return Inertia::render('Pembelian/purchase-order/print', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'company' => $company,
        ]);
    }

    public function destroy($noPo)
    {
        $noPo = trim((string) $noPo);
        if ($noPo === '') {
            return response()->json(['message' => 'No PO tidak valid.'], 400);
        }

        // Cegah hapus jika sudah ada di tb_invin
        $existsInInvin = DB::table('tb_invin')
            ->whereRaw('lower(trim(ref_po)) = ?', [strtolower($noPo)])
            ->exists();
        if ($existsInInvin) {
            return response()->json([
                'message' => 'PO sudah masuk invoicing (tb_invin), tidak bisa dihapus.',
            ], 400);
        }

        $poHeader = DB::table('tb_po')
            ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
            ->first(['for_cus']);
        $fallbackForCus = $poHeader->for_cus ?? '';
        $timestamp = now()->format('m/d/Y h:i:s A');

        try {
            DB::transaction(function () use ($noPo, $timestamp, $fallbackForCus) {
                $details = DB::table('tb_detailpo')
                    ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
                    ->get([
                        'no_po',
                        'tgl',
                        'ref_pr',
                        'ref_quota',
                        'for_cus',
                        'ref_poin',
                        'kd_vdr',
                        'nm_vdr',
                        'ppn',
                        'payment_terms',
                        'del_time',
                        'franco_loco',
                        'no',
                        'kd_mat',
                        'material',
                        'qty',
                        'unit',
                        'price',
                        'total_price',
                        'ket1',
                        'ket2',
                        'ket3',
                        'ket4',
                        'gr_mat',
                        'gr_price',
                        'ir_mat',
                        'ir_price',
                        'qty_po',
                        'sisa_pr',
                        'id',
                        'id_po',
                    ]);

                if ($details->isNotEmpty()) {
                    $payload = $details->map(function ($row) use ($timestamp, $fallbackForCus) {
                        return [
                            'no_po' => $row->no_po,
                            'tgl' => $row->tgl,
                            'ref_pr' => $row->ref_pr,
                            'ref_quota' => $row->ref_quota,
                            'for_cus' => $row->for_cus ?? $fallbackForCus,
                            'ref_poin' => $row->ref_poin,
                            'kd_vdr' => $row->kd_vdr,
                            'nm_vdr' => $row->nm_vdr,
                            'ppn' => $row->ppn,
                            'payment_terms' => $row->payment_terms,
                            'del_time' => $row->del_time,
                            'franco_loco' => $row->franco_loco,
                            'no' => $row->no,
                            'kd_mat' => $row->kd_mat,
                            'material' => $row->material,
                            'qty' => $row->qty,
                            'unit' => $row->unit,
                            'price' => $row->price,
                            'total_price' => $row->total_price,
                            'ket1' => $row->ket1,
                            'ket2' => $row->ket2,
                            'ket3' => $row->ket3,
                            'ket4' => $row->ket4,
                            'gr_mat' => $row->gr_mat,
                            'gr_price' => $row->gr_price,
                            'ir_mat' => $row->ir_mat,
                            'ir_price' => $row->ir_price,
                            'qty_po' => $row->qty_po,
                            'sisa_pr' => $row->sisa_pr,
                            'id' => $row->id,
                            'id_po' => $row->id_po,
                            'tgl_hapus' => $timestamp,
                        ];
                    })->all();

                    DB::table('tb_hapuspo')->insert($payload);
                }

                DB::table('tb_detailpo')
                    ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
                    ->delete();
                DB::table('tb_po')
                    ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
                    ->delete();
            });
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json(['message' => 'PO berhasil dihapus.']);
    }
}
