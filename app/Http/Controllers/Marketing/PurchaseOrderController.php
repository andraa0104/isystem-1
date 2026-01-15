<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController
{
    public function create()
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

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                'kd_material',
                'material',
                'qty',
                'unit',
                'renmark'
            )
            ->orderBy('no_pr')
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

        return Inertia::render('marketing/purchase-order/create', [
            'purchaseRequirements' => $purchaseRequirements,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
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
                ->route('marketing.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->orderBy('no')
            ->get();

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

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                'kd_material',
                'material',
                'qty',
                'unit',
                'renmark'
            )
            ->orderBy('no_pr')
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

        return Inertia::render('marketing/purchase-order/edit', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'purchaseRequirements' => $purchaseRequirements,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
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

        $lastNumber = DB::table('tb_po')
            ->where('no_po', 'like', $prefix.'%')
            ->orderBy('no_po', 'desc')
            ->value('no_po');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noPo = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $ppnRaw = $request->input('ppn');
        $ppnValue = $ppnRaw === null || $ppnRaw === '' ? '' : $ppnRaw.'%';

        $sTotal = (float) $request->input('s_total', 0);
        $hPpn = (float) $request->input('h_ppn', 0);
        $gTotal = (float) $request->input('g_total', 0);

        $maxId = (int) (DB::table('tb_detailpo')->max('id') ?? 0);

        try {
            DB::transaction(function () use (
                $request,
                $materials,
                $noPo,
                $ppnValue,
                $sTotal,
                $hPpn,
                $gTotal,
                &$maxId
            ) {
                DB::table('tb_po')->insert([
                    'no_po' => $noPo,
                    'tgl' => $request->input('date'),
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
                        'tgl' => $request->input('date'),
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
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.purchase-order.index')
            ->with('success', 'Data PO berhasil disimpan.');
    }

    public function update(Request $request, $noPo)
    {
        $exists = DB::table('tb_po')
            ->where('no_po', $noPo)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.purchase-order.index')
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

        try {
            DB::transaction(function () use (
                $request,
                $materials,
                $noPo,
                $ppnValue,
                $sTotal,
                $hPpn,
                $gTotal
            ) {
                DB::table('tb_po')
                    ->where('no_po', $noPo)
                    ->update([
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

                foreach ($materials as $item) {
                    $id = $item['id'] ?? null;
                    if (!$id) {
                        continue;
                    }

                    DB::table('tb_detailpo')
                        ->where('id', $id)
                        ->where('no_po', $noPo)
                        ->update([
                            'price' => $item['price'] ?? 0,
                            'total_price' => $item['total_price'] ?? 0,
                            'gr_price' => $item['total_price'] ?? 0,
                        ]);
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
            ->route('marketing.purchase-order.index')
            ->with('success', 'Data PO berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPo, $detailId)
    {
        $updated = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->where('id', $detailId)
            ->update([
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

    public function index(Request $request)
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

        $detailNo = $request->query('detail_no');
        $purchaseOrderDetails = collect();
        if ($detailNo) {
            $purchaseOrderDetails = DB::table('tb_detailpo')
                ->select(
                    'no_po',
                    'no',
                    'material',
                    'qty',
                    'unit',
                    'price',
                    'total_price'
                )
                ->where('no_po', $detailNo)
                ->orderBy('no')
                ->get();
        }

        $outstandingCount = DB::table('tb_detailpo')
            ->where('gr_mat', '<>', 0)
            ->distinct('no_po')
            ->count('no_po');

        $outstandingTotal = (float) DB::table('tb_detailpo')
            ->where('gr_mat', '<>', 0)
            ->sum('total_price');

        $realizedCount = max(0, $purchaseOrders->count() - $outstandingCount);

        return Inertia::render('marketing/purchase-order/index', [
            'purchaseOrders' => $purchaseOrders,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'detailNo' => $detailNo,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
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
                ->route('marketing.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->orderBy('no')
            ->get();

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

        return Inertia::render('marketing/purchase-order/print', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'company' => $company,
        ]);
    }
}
