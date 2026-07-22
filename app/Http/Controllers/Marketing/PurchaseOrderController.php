<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController
{
    private function bypassCache() {
        return new class {
            public function remember($key, $ttl, $callback) { return $callback(); }
            public function flush() {}
        };
    }

    private function redistributePurchaseOrderQtyToPr(string $noPr, string $kdMaterial, ?string $customer = null, ?string $refPoin = null): void
    {
        $poQuery = DB::table('tb_detailpo')
            ->whereRaw('lower(trim(ref_pr)) = ?', [strtolower(trim($noPr))])
            ->whereRaw('lower(trim(kd_mat)) = ?', [strtolower(trim($kdMaterial))]);
        $prQuery = DB::table('tb_detailpr')
            ->whereRaw('lower(trim(no_pr)) = ?', [strtolower(trim($noPr))])
            ->whereRaw('lower(trim(kd_material)) = ?', [strtolower(trim($kdMaterial))]);

        if ($customer !== null) {
            $poQuery->whereRaw('lower(trim(for_cus)) = ?', [strtolower(trim($customer))]);
            $prQuery->whereRaw('lower(trim(for_customer)) = ?', [strtolower(trim($customer))]);
        }
        if ($refPoin !== null) {
            $poQuery->whereRaw('lower(trim(ref_poin)) = ?', [strtolower(trim($refPoin))]);
            $prQuery->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPoin))]);
        }

        $totalPoQty = (float) ($poQuery
            ->selectRaw('coalesce(sum(cast(qty as decimal(18,4))), 0) as total_qty')
            ->value('total_qty') ?? 0);

        $remaining = max(0, $totalPoQty);
        $details = $prQuery
            ->orderByRaw('cast(no as unsigned)')
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id', 'qty']);

        foreach ($details as $detail) {
            $qty = max(0, (float) str_replace(',', '', (string) ($detail->qty ?? 0)));
            $used = min($qty, $remaining);
            DB::table('tb_detailpr')->where('id', $detail->id)->update([
                'qty_po' => $used,
                'sisa_pr' => max(0, $qty - $used),
            ]);
            $remaining -= $used;
        }
    }
    private const PO_CACHE_TAGS = ['po_data'];
    private const PO_PR_CACHE_TAGS = ['po_data', 'pr_data'];
    private const PO_VENDOR_CACHE_TAGS = ['po_data', 'vendor_data'];
    private const PO_CACHE_TTL = 86400;
    private const PO_VENDOR_CACHE_TTL = 3600;

    private function tenantCachePrefix(?Request $request = null): string
    {
        $request ??= request();
        $database = (string) (
            $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database')
            ?? config('database.connections.'.config('database.default').'.database')
            ?? ''
        );

        return preg_replace('/[^A-Za-z0-9_.:-]/', '_', strtolower($database)) ?: 'default';
    }

    private function poCacheKey(string $scope, array $parts = [], ?Request $request = null): string
    {
        return 'po:' . $this->tenantCachePrefix($request) . ':' . $scope . ':' . md5(json_encode($parts));
    }

    private function flushPurchaseOrderCache(): void
    {
        $this->bypassCache()->flush();
    }

    private function withRequiredSpace($value): string
    {
        $v = trim((string) $value);
        return $v === '' ? ' ' : $v;
    }

    public function create()
    {
        $vendors = $this->bypassCache()->remember($this->poCacheKey('vendors'), self::PO_VENDOR_CACHE_TTL, function () {
            return DB::table('tb_vendor')
                ->select('kd_vdr', 'nm_vdr', 'almt_vdr', 'telp_vdr', 'eml_vdr', 'attn_vdr')
                ->orderBy('nm_vdr')
                ->get();
        });

        return Inertia::render('pembelian/purchase-order/create', [
            'purchaseRequirements' => [],
            'purchaseRequirementDetails' => [],
            'vendors' => $vendors,
        ]);
    }

    public function edit($noPo)
    {
        $purchaseOrder = $this->bypassCache()->remember($this->poCacheKey('edit.header', [$noPo]), self::PO_CACHE_TTL, function () use ($noPo) {
            return DB::table('tb_po')
                ->where('no_po', $noPo)
                ->first();
        });

        if (!$purchaseOrder) {
            return redirect()
                ->route('pembelian.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = $this->bypassCache()->remember($this->poCacheKey('edit.details', [$noPo]), self::PO_CACHE_TTL, function () use ($noPo) {
            return DB::table('tb_detailpo')
                ->where('no_po', $noPo)
                ->orderBy('no')
                ->get();
        });

        $vendors = $this->bypassCache()->remember($this->poCacheKey('vendors'), self::PO_VENDOR_CACHE_TTL, function () {
            return DB::table('tb_vendor')
                ->select('kd_vdr', 'nm_vdr', 'almt_vdr', 'telp_vdr', 'eml_vdr', 'attn_vdr')
                ->orderBy('nm_vdr')
                ->get();
        });

        return Inertia::render('pembelian/purchase-order/edit', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseOrderDetails' => $purchaseOrderDetails,
            'purchaseRequirements' => [],
            'purchaseRequirementDetails' => [],
            'vendors' => $vendors,
        ]);
    }

    public function outstandingPurchaseRequirements()
    {
        $today = \Carbon\Carbon::today()->toDateString();
        $dueDateExpr = "coalesce(date(jth_tempo), str_to_date(jth_tempo, '%Y-%m-%d'), str_to_date(jth_tempo, '%Y/%m/%d'), str_to_date(jth_tempo, '%d/%m/%Y'), str_to_date(jth_tempo, '%d-%m-%Y'), str_to_date(jth_tempo, '%d.%m.%Y'))";
        $overdueCustomers = DB::table('tb_kdfakturpenjualan')
            ->whereRaw('coalesce(cast(saldo_piutang as decimal(18,4)), 0) > 0')
            ->whereRaw("trim(coalesce(nm_cs, '')) <> ''")
            ->whereRaw("{$dueDateExpr} < ?", [$today])
            ->select(
                DB::raw('lower(trim(nm_cs)) as customer_key'),
                DB::raw("max(datediff('{$today}', {$dueDateExpr})) as oldest_overdue_days")
            )
            ->groupBy(DB::raw('lower(trim(nm_cs))'));

        $customerExpr = "coalesce(nullif(trim(dpr.for_customer), ''), nullif(trim(poin.customer_name), ''), trim(pr.for_customer))";
        $refPoExpr = "coalesce(nullif(trim(poin.no_poin), ''), nullif(trim(dpr.ref_po), ''), trim(pr.ref_po))";

        $purchaseRequirements = DB::table('tb_detailpr as dpr')
            ->join('tb_pr as pr', 'pr.no_pr', '=', 'dpr.no_pr')
            ->leftJoin('tb_poin as poin', function ($join) {
                $join->on(DB::raw('lower(trim(poin.no_poin))'), '=', DB::raw('lower(trim(dpr.ref_po))'));
            })
            ->leftJoinSub($overdueCustomers, 'overdue', function ($join) use ($customerExpr) {
                $join->on(DB::raw("lower({$customerExpr})"), '=', 'overdue.customer_key');
            })
            ->whereRaw("coalesce(cast(replace(dpr.sisa_pr, ',', '') as decimal(65,4)), 0) > 0")
            ->select(
                'pr.no_pr',
                'pr.date',
                DB::raw("{$customerExpr} as for_customer"),
                DB::raw("{$refPoExpr} as ref_po"),
                DB::raw('coalesce(overdue.oldest_overdue_days, 0) as oldest_overdue_days'),
                DB::raw('case when coalesce(overdue.oldest_overdue_days, 0) > 90 then 1 else 0 end as has_overdue_gt_90')
            )
            ->distinct()
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $purchaseRequirements->transform(function ($item) {
            if ($item->date) {
                try {
                    $item->date = \Carbon\Carbon::parse($item->date)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            $item->oldest_overdue_days = (int) ($item->oldest_overdue_days ?? 0);
            $item->has_overdue_gt_90 = (bool) ($item->has_overdue_gt_90 ?? false);
            return $item;
        });

        $purchaseRequirements = $purchaseRequirements
            ->groupBy('no_pr')
            ->map(function ($rows) {
                $first = $rows->first();
                $customers = $rows->map(fn ($row) => [
                    'for_customer' => $row->for_customer,
                    'ref_po' => $row->ref_po,
                    'oldest_overdue_days' => $row->oldest_overdue_days,
                    'has_overdue_gt_90' => $row->has_overdue_gt_90,
                ])->values();

                return [
                    'no_pr' => $first->no_pr,
                    'date' => $first->date,
                    'customers' => $customers,
                    'has_overdue_gt_90' => $customers->contains('has_overdue_gt_90', true),
                    'all_customers_blocked' => $customers->every('has_overdue_gt_90', true),
                ];
            })
            ->values();

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
        ]);
    }

    public function purchaseRequirementDetails(Request $request)
    {
        $noPr = $request->query('no_pr');
        $selections = json_decode((string) $request->query('selections', '[]'), true);
        $selections = is_array($selections) ? $selections : [];
        $query = DB::table('tb_detailpr')
            ->select('no_pr', 'kd_material', 'for_customer', 'ref_po')
            ->selectRaw('max(material) as material')
            ->selectRaw('sum(coalesce(cast(qty as decimal(18,4)), 0)) as qty')
            ->selectRaw('sum(coalesce(cast(sisa_pr as decimal(18,4)), 0)) as sisa_pr')
            ->selectRaw('max(unit) as unit')
            ->selectRaw('max(renmark) as renmark')
            ->groupBy('no_pr', 'kd_material', 'for_customer', 'ref_po')
            ->orderBy('no_pr')
            ->orderBy('kd_material');

        if ($noPr) {
            $query->where('no_pr', $noPr);
        }
        if (!empty($selections)) {
            $query->where(function ($selectionQuery) use ($selections) {
                foreach ($selections as $selection) {
                    $customer = strtolower(trim((string) ($selection['for_customer'] ?? '')));
                    $refPo = strtolower(trim((string) ($selection['ref_po'] ?? '')));
                    $selectionQuery->orWhere(function ($pairQuery) use ($customer, $refPo) {
                        $pairQuery
                            ->whereRaw('lower(trim(for_customer)) = ?', [$customer])
                            ->whereRaw('lower(trim(ref_po)) = ?', [$refPo]);
                    });
                }
            });
        }

        $items = $query->get();

        // --- PENGIRIMAN DATA MENTAH KE PYTHON ---
        $dataForPython = [];
        foreach ($items as $idx => $item) {
            // Controller murni cuma passing data mentah ke Python
            $dataForPython[] = [
                'index'   => $idx + 1,
                'renmark' => $item->renmark,
                'sisa_pr' => $item->sisa_pr // Lempar sisa_pr untuk difilter oleh Python
            ];
        }

        $autofillNote1 = '';

        if (!empty($dataForPython)) {
            $jsonInput = json_encode($dataForPython);
            
            $pythonPath = 'python3'; 
            $scriptPath = base_path('app/Intelligence/RenmarkClustering.py');

            $command = $pythonPath . " " . escapeshellarg($scriptPath) . " " . escapeshellarg($jsonInput) . " 2>&1";
            
            $output = trim(shell_exec($command));

            if ($output && !str_contains(strtolower($output), 'error') && !str_contains(strtolower($output), 'traceback')) {
                $autofillNote1 = $output;
            }
        }
        // -----------------------------------------

        return response()->json([
            'purchaseRequirementDetails' => $items,
            'autofill_note_1' => $autofillNote1 
        ]);
    }

    public function vendors()
    {
        $vendors = $this->bypassCache()->remember($this->poCacheKey('vendors'), self::PO_VENDOR_CACHE_TTL, function () {
            return DB::table('tb_vendor')
                ->select('kd_vdr', 'nm_vdr', 'almt_vdr', 'telp_vdr', 'eml_vdr', 'attn_vdr')
                ->orderBy('nm_vdr')
                ->get();
        });

        return response()->json([
            'vendors' => $vendors,
        ]);
    }

    public function suggestVendor(Request $request)
    {
        $vendorCode = $request->input('kd_vdr');
        $vendorName = $request->input('nm_vdr');

        if (!$vendorCode && !$vendorName) {
            return response()->json(['error' => 'Vendor identification required'], 400);
        }

        $dss = new \App\Services\Marketing\PurchaseOrderDss();
        $suggestion = $dss->suggest($vendorCode ?: '', $vendorName ?: '');

        return response()->json($suggestion);
    }

    public function store(Request $request)
    {
        $dueDateExpr = "coalesce(date(jth_tempo), str_to_date(jth_tempo, '%Y-%m-%d'), str_to_date(jth_tempo, '%Y/%m/%d'), str_to_date(jth_tempo, '%d/%m/%Y'), str_to_date(jth_tempo, '%d-%m-%Y'), str_to_date(jth_tempo, '%d.%m.%Y'))";
        foreach (collect($request->input('materials', []))->unique('for_customer') as $material) {
            $customer = trim((string) ($material['for_customer'] ?? ''));
            $refPoin = trim((string) ($material['ref_poin'] ?? ''));
            $oldestOverdueDays = (int) (DB::table('tb_kdfakturpenjualan')
                ->whereRaw('lower(trim(nm_cs)) = ?', [strtolower($customer)])
                ->whereRaw('coalesce(cast(saldo_piutang as decimal(18,4)), 0) > 0')
                ->whereRaw("{$dueDateExpr} < ?", [\Carbon\Carbon::today()->toDateString()])
                ->selectRaw("max(datediff(?, {$dueDateExpr})) as oldest_overdue_days", [\Carbon\Carbon::today()->toDateString()])
                ->value('oldest_overdue_days') ?? 0);

            if ($oldestOverdueDays > 90) {
                return back()->with('error', "Customer {$customer} dengan ref PO {$refPoin} tidak bisa dibuat PO keluar karena memiliki tunggakan lebih dari 90 hari.");
            }
        }

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

        $prAllocations = collect($request->input('pr_allocations', []))
            ->filter(fn ($item) => is_array($item) && !empty($item['pr_group_key']))
            ->keyBy('pr_group_key');
        $prReturns = collect($request->input('pr_returns', []))
            ->filter(fn ($item) => is_array($item) && !empty($item['pr_group_key']))
            ->keyBy('pr_group_key');

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
                    $prReturns,
                    $prefix,
                    $ppnValue,
                    $sTotal,
                    $hPpn,
                    $gTotal,
                    $dateFormatted,
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

                    $noPrHeader = $request->input('ref_pr');
                    $kdMats = collect($materials)->pluck('kd_mat')->unique()->filter()->all();
                    $detailPrs = DB::table('tb_detailpr')
                        ->where('no_pr', $noPrHeader)
                        ->whereIn('kd_material', $kdMats)
                        ->lockForUpdate()
                        ->get()
                        ->groupBy('kd_material');

                    $parseNumber = static function ($value): float {
                        if ($value === null || $value === '') {
                            return 0.0;
                        }
                        return (float) str_replace(',', '', (string) $value);
                    };

                    $detailPoPayload = [];

                    foreach ($materials as $index => $item) {
                        $maxId += 1;

                        $kdMat = $item['kd_mat'] ?? null;
                        $qty = (float) ($item['qty'] ?? 0);
                        $itemCustomer = trim((string) ($item['for_customer'] ?? ''));
                        $itemRefPoin = trim((string) ($item['ref_poin'] ?? ''));
                        $matchingPrDetails = $detailPrs->get($kdMat, collect())
                            ->filter(fn ($detail) =>
                                strtolower(trim((string) $detail->for_customer)) === strtolower($itemCustomer)
                                && strtolower(trim((string) $detail->ref_po)) === strtolower($itemRefPoin)
                            );

                        if ($matchingPrDetails->isEmpty()) {
                            $matchingPrDetails = $detailPrs->get($kdMat, collect());
                        }

                        if ($matchingPrDetails->isEmpty()) {
                            throw new \RuntimeException("Detail PR tidak ditemukan untuk no_pr={$noPrHeader}, kd_material={$kdMat}");
                        }

                        $currentSisaPr = $matchingPrDetails->sum(
                            fn ($detail) => $parseNumber($detail->sisa_pr ?? $detail->qty ?? 0),
                        );

                        if ($qty > $currentSisaPr) {
                            throw new \RuntimeException("Qty material {$kdMat} tidak boleh melebihi sisa qty PR ({$currentSisaPr}).");
                        }

                        $sisaPr = max(0, $currentSisaPr - $qty);
                        $detailPoPayload[] = [
                            'id' => $maxId,
                            'no_po' => $noPo,
                            'tgl' => $dateFormatted,
                            'ref_pr' => $noPrHeader,
                            'ref_quota' => $request->input('ref_quota'),
                            'for_cus' => $itemCustomer,
                            'ref_poin' => $itemRefPoin,
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
                            'ppn' => $ppnValue,
                            'ket1' => $this->withRequiredSpace($request->input('ket1')),
                            'ket2' => $this->withRequiredSpace($request->input('ket2')),
                            'ket3' => $this->withRequiredSpace($request->input('ket3')),
                            'ket4' => $this->withRequiredSpace($request->input('ket4')),
                            'ir_mat' => 0,
                            'ir_price' => 0,
                            'end_fl' => 0,
                            'qtybiayakirim' => 0,
                            'no_gudang' => 0,
                            'end_gr' => 0,
                            'sisa_pr' => $sisaPr,
                        ];
                    }

                    // Bulk insert tb_detailpo
                    if (!empty($detailPoPayload)) {
                        DB::table('tb_detailpo')->insert($detailPoPayload);
                    }
                    if ($prReturns->isNotEmpty()) {
                        foreach ($materials as $item) {
                            $groupKey = (string) ($item['pr_group_key'] ?? '');
                            $returnGroup = $prReturns->get($groupKey);
                            if (!$returnGroup) {
                                continue;
                            }

                            foreach (($returnGroup['sources'] ?? []) as $source) {
                                $noPr = trim((string) ($source['no_pr'] ?? $noPrHeader));
                                $kdMaterial = trim((string) ($source['kd_material'] ?? ($item['kd_mat'] ?? '')));
                                $customer = trim((string) ($source['for_customer'] ?? ''));
                                $refPo = trim((string) ($source['ref_po'] ?? ''));
                                $availableQty = (float) ($source['available_qty'] ?? 0);
                                $returnedQty = min($availableQty, (float) ($source['returned_qty'] ?? 0));
                                $allocatedQty = max(0, $availableQty - $returnedQty);

                                $detailRows = DB::table('tb_detailpr')
                                    ->whereRaw('lower(trim(no_pr)) = ?', [strtolower($noPr)])
                                    ->whereRaw('lower(trim(kd_material)) = ?', [strtolower($kdMaterial)])
                                    ->whereRaw('lower(trim(for_customer)) = ?', [strtolower($customer)])
                                    ->whereRaw('lower(trim(ref_po)) = ?', [strtolower($refPo)])
                                    ->lockForUpdate()
                                    ->get();

                                foreach ($detailRows as $detailRow) {
                                    $currentQty = (float) str_replace(',', '', (string) ($detailRow->qty ?? 0));
                                    $currentQtyPo = (float) str_replace(',', '', (string) ($detailRow->qty_po ?? 0));
                                    $currentSisa = (float) str_replace(',', '', (string) ($detailRow->sisa_pr ?? 0));
                                    $newQtyPo = max(0, $currentQtyPo + $allocatedQty);
                                    $newSisa = max(0, $currentSisa - $allocatedQty);

                                    DB::table('tb_detailpr')
                                        ->where('id', $detailRow->id)
                                        ->update([
                                            'qty_po' => $newQtyPo,
                                            'sisa_pr' => $newSisa,
                                        ]);
                                }
                            }
                        }
                    } else {
                        $redistributionScopes = collect($materials)->unique(fn ($item) => implode('|', [
                            $item['kd_mat'] ?? '',
                            $item['for_customer'] ?? '',
                            $item['ref_poin'] ?? '',
                        ]));
                        foreach ($redistributionScopes as $scope) {
                            $this->redistributePurchaseOrderQtyToPr(
                                $noPrHeader,
                                (string) ($scope['kd_mat'] ?? ''),
                                (string) ($scope['for_customer'] ?? ''),
                                (string) ($scope['ref_poin'] ?? ''),
                            );
                        }
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

        $this->flushPurchaseOrderCache();

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data PO berhasil disimpan.');
            return redirect('/pembelian/purchase-order');
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

        $prAllocations = collect($request->input('pr_allocations', []))
            ->filter(fn ($item) => is_array($item) && !empty($item['pr_group_key']))
            ->keyBy('pr_group_key');

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
                $prAllocations,
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
                $parseNumber = static function ($value): float {
                    if ($value === null || $value === '') {
                        return 0.0;
                    }
                    return (float) str_replace(',', '', (string) $value);
                };

                $existingDetails = DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->lockForUpdate()
                    ->get();
                $detailsByKdMat = $existingDetails->whereNotNull('kd_mat')->keyBy('kd_mat');
                $detailsById = $existingDetails->keyBy('id');
                $maxDetailId = (int) (DB::table('tb_detailpo')->max('id') ?? 0);

                $noPrHeader = $request->input('ref_pr');
                $kdMatsForPr = collect($materials)->pluck('kd_mat')->unique()->filter()->all();
                $detailPrs = DB::table('tb_detailpr')
                    ->where('no_pr', $noPrHeader)
                    ->whereIn('kd_material', $kdMatsForPr)
                    ->lockForUpdate()
                    ->get();

                $nowStamp = now()->format('m/d/Y h:i:s A');
                $parseNumber = static function ($value): float {
                    if ($value === null || $value === '') {
                        return 0.0;
                    }
                    return (float) str_replace(',', '', (string) $value);
                };

                $ubahPoPayload = [];
                $detailPrUpdates = [];

                foreach ($materials as $item) {
                    $id = $item['id'] ?? null;
                    $kdMat = $item['kd_mat'] ?? null;
                    if (!$id && !$kdMat) {
                        continue;
                    }

                    $existingDetail = $kdMat ? $detailsByKdMat->get($kdMat) : $detailsById->get($id);
                    if (!$existingDetail) {
                        $matchingDetailPrs = $detailPrs
                            ->where('kd_material', $kdMat)
                            ->values();
                        $detailPr = $matchingDetailPrs->first();
                        if (!$detailPr || $matchingDetailPrs->isEmpty()) {
                            throw new \RuntimeException("Detail PR tidak ditemukan untuk no_pr={$noPrHeader}, kd_material={$kdMat}");
                        }

                        $qtyValue = $item['qty'] ?? 0;
                        $newQty = $parseNumber($qtyValue);
                        $currentSisa = $matchingDetailPrs->sum(
                            fn ($row) => $parseNumber($row->sisa_pr ?? $row->Sisa_pr ?? 0),
                        );

                        if ($newQty > $currentSisa) {
                            throw new \RuntimeException("Qty material {$kdMat} tidak boleh melebihi sisa qty PR ({$currentSisa}).");
                        }

                        $priceRaw = $item['price'] ?? null;
                        $isPriceEmpty = $priceRaw === '' || $priceRaw === null;
                        $priceValue = $isPriceEmpty ? 0 : $priceRaw;
                        $totalPriceRaw = $item['total_price'] ?? null;
                        $totalPriceValue = $isPriceEmpty ? 0 : ($totalPriceRaw ?? 0);
                        $maxDetailId += 1;

                        DB::table('tb_detailpo')->insert([
                            'id' => $maxDetailId,
                            'no_po' => $noPo,
                            'tgl' => $dateFormatted,
                            'ref_pr' => $noPrHeader,
                            'ref_quota' => $request->input('ref_quota'),
                            'for_cus' => $request->input('for_cus'),
                            'ref_poin' => $request->input('ref_poin'),
                            'kd_vdr' => $request->input('kd_vdr'),
                            'nm_vdr' => $request->input('nm_vdr'),
                            'payment_terms' => $request->input('payment_terms'),
                            'del_time' => $request->input('del_time'),
                            'franco_loco' => $request->input('franco_loco'),
                            'no' => $item['no'] ?? ($existingDetails->count() + 1),
                            'kd_mat' => $kdMat,
                            'material' => $item['material'] ?? null,
                            'qty' => $newQty,
                            'qty_po' => $newQty,
                            'gr_mat' => $newQty,
                            'unit' => $item['unit'] ?? null,
                            'price' => $priceValue,
                            'total_price' => $totalPriceValue,
                            'gr_price' => $totalPriceValue,
                            'ppn' => $ppnValue,
                            'ket1' => $this->withRequiredSpace($request->input('ket1')),
                            'ket2' => $this->withRequiredSpace($request->input('ket2')),
                            'ket3' => $this->withRequiredSpace($request->input('ket3')),
                            'ket4' => $this->withRequiredSpace($request->input('ket4')),
                            'ir_mat' => 0,
                            'ir_price' => 0,
                            'end_fl' => 0,
                            'qtybiayakirim' => 0,
                            'no_gudang' => 0,
                            'end_gr' => 0,
                            'sisa_pr' => max(0, $currentSisa - $newQty),
                        ]);

                        $allocationKey = trim((string) $noPrHeader) . '||' . trim((string) $kdMat);
                        $allocationGroup = $prAllocations->get($allocationKey);

                        if ($allocationGroup && !empty($allocationGroup['sources']) && is_array($allocationGroup['sources'])) {
                            $allocatedChange = collect($allocationGroup['sources'])
                                ->sum(fn ($source) => $parseNumber($source['qty_change'] ?? 0));

                            if (abs($allocatedChange - $newQty) > 0.000001) {
                                throw new \RuntimeException("Total alokasi qty material {$kdMat} harus sama dengan qty PO ({$newQty}).");
                            }

                            foreach ($allocationGroup['sources'] as $source) {
                                $sourceCustomer = trim((string) ($source['for_customer'] ?? ''));
                                $sourceRefPo = trim((string) ($source['ref_po'] ?? ''));
                                $qtyChange = $parseNumber($source['qty_change'] ?? 0);

                                if ($qtyChange <= 0) {
                                    continue;
                                }

                                $detailRow = $matchingDetailPrs->first(function ($row) use ($sourceCustomer, $sourceRefPo) {
                                    return strtolower(trim((string) ($row->for_customer ?? ''))) === strtolower($sourceCustomer)
                                        && strtolower(trim((string) ($row->ref_po ?? ''))) === strtolower($sourceRefPo);
                                });

                                if (!$detailRow) {
                                    throw new \RuntimeException("Detail PR tidak ditemukan untuk no_pr={$noPrHeader}, kd_material={$kdMat}, customer={$sourceCustomer}, ref_po={$sourceRefPo}");
                                }

                                $rowSisa = $parseNumber($detailRow->sisa_pr ?? $detailRow->Sisa_pr ?? 0);
                                if ($qtyChange > $rowSisa) {
                                    throw new \RuntimeException("Qty material {$kdMat} tidak boleh melebihi sisa qty PR ({$rowSisa}).");
                                }

                                DB::table('tb_detailpr')
                                    ->where('id', $detailRow->id)
                                    ->update([
                                        'sisa_pr' => max(0, $rowSisa - $qtyChange),
                                        'qty_po' => max(0, $parseNumber($detailRow->qty_po ?? 0) + $qtyChange),
                                    ]);
                            }
                        }

                        continue;
                    }

                    $priceRaw = $item['price'] ?? null;
                    $isPriceEmpty = $priceRaw === '' || $priceRaw === null;
                    $priceValue = $isPriceEmpty ? 0 : $priceRaw;
                    $totalPriceRaw = $item['total_price'] ?? null;
                    $totalPriceValue = $isPriceEmpty ? 0 : ($totalPriceRaw ?? 0);
                    $qtyValue = $item['qty'] ?? 0;

                    $resolvedKdMat = $kdMat ?: ($existingDetail->kd_mat ?? null);
                    $oldQty = $parseNumber($existingDetail->qty ?? 0);
                    $newQty = $parseNumber($qtyValue);
                    $qtyDelta = $newQty - $oldQty;
                    $newGrMat = max(
                        0,
                        $parseNumber($existingDetail->gr_mat ?? 0) + $qtyDelta,
                    );
                    $newDetailSisaPr = max(
                        0,
                        $parseNumber($existingDetail->sisa_pr ?? 0) - $qtyDelta,
                    );

                    // Update tb_detailpo
                    DB::table('tb_detailpo')
                        ->where('id', $existingDetail->id)
                        ->update([
                            'tgl' => $dateFormatted,
                            'qty' => $qtyValue,
                            'qty_po' => $newQty,
                            'gr_mat' => $newGrMat,
                            'sisa_pr' => $newDetailSisaPr,
                            'price' => $priceValue,
                            'total_price' => $totalPriceValue,
                            'gr_price' => $totalPriceValue,
                            'ppn' => $ppnValue,
                            'ket1' => $this->withRequiredSpace($request->input('ket1')),
                            'ket2' => $this->withRequiredSpace($request->input('ket2')),
                            'ket3' => $this->withRequiredSpace($request->input('ket3')),
                            'ket4' => $this->withRequiredSpace($request->input('ket4')),
                        ]);

                    $noPr = $noPrHeader ?: ($existingDetail->ref_pr ?? null);
                    if ($noPr && $resolvedKdMat && abs($qtyDelta) > 0.000001) {
                        $allocationKey = trim((string) $noPr) . '||' . trim((string) $resolvedKdMat);
                        $allocationGroup = $prAllocations->get($allocationKey);
                        $handledPrAllocation = false;

                        if ($allocationGroup && !empty($allocationGroup['sources']) && is_array($allocationGroup['sources'])) {
                            $allocatedChange = collect($allocationGroup['sources'])
                                ->sum(fn ($source) => $parseNumber($source['qty_change'] ?? 0));

                            if (abs($allocatedChange - $qtyDelta) > 0.000001) {
                                throw new \RuntimeException("Total alokasi qty material {$resolvedKdMat} harus sama dengan perubahan qty PO ({$qtyDelta}).");
                            }

                            $detailPrRows = DB::table('tb_detailpr')
                                ->where('no_pr', $noPr)
                                ->where('kd_material', $resolvedKdMat)
                                ->lockForUpdate()
                                ->get();

                            foreach ($allocationGroup['sources'] as $source) {
                                $sourceCustomer = trim((string) ($source['for_customer'] ?? ''));
                                $sourceRefPo = trim((string) ($source['ref_po'] ?? ''));
                                $qtyChange = $parseNumber($source['qty_change'] ?? 0);

                                if (abs($qtyChange) < 0.000001) {
                                    continue;
                                }

                                $detailRow = $detailPrRows->first(function ($row) use ($sourceCustomer, $sourceRefPo) {
                                    return strtolower(trim((string) ($row->for_customer ?? ''))) === strtolower($sourceCustomer)
                                        && strtolower(trim((string) ($row->ref_po ?? ''))) === strtolower($sourceRefPo);
                                });

                                if (!$detailRow) {
                                    throw new \RuntimeException("Detail PR tidak ditemukan untuk no_pr={$noPr}, kd_material={$resolvedKdMat}, customer={$sourceCustomer}, ref_po={$sourceRefPo}");
                                }

                                $currentSisa = $parseNumber($detailRow->sisa_pr ?? $detailRow->Sisa_pr ?? 0);
                                $currentQtyPo = $parseNumber($detailRow->qty_po ?? 0);
                                $newSisa = max(0, $currentSisa - $qtyChange);
                                $newQtyPo = max(0, $currentQtyPo + $qtyChange);

                                if ($qtyChange > 0 && $qtyChange > $currentSisa) {
                                    throw new \RuntimeException("Qty material {$resolvedKdMat} tidak boleh melebihi sisa qty PR ({$currentSisa}).");
                                }

                                DB::table('tb_detailpr')
                                    ->where('no_pr', $noPr)
                                    ->where('kd_material', $resolvedKdMat)
                                    ->whereRaw("lower(trim(coalesce(for_customer, ''))) = ?", [strtolower($sourceCustomer)])
                                    ->whereRaw("lower(trim(coalesce(ref_po, ''))) = ?", [strtolower($sourceRefPo)])
                                    ->update([
                                        'sisa_pr' => $newSisa,
                                        'qty_po' => $newQtyPo,
                                    ]);
                            }
                            $handledPrAllocation = true;
                        }

                        $detailPr = $handledPrAllocation
                            ? null
                            : $detailPrs->firstWhere('kd_material', $resolvedKdMat);

                        if ($detailPr) {
                            $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                            $currentQtyPo = $parseNumber($detailPr->qty_po ?? 0);

                            if ($qtyDelta > $currentSisa) {
                                throw new \RuntimeException("Qty material {$resolvedKdMat} tidak boleh melebihi sisa qty PR ({$currentSisa}).");
                            }

                            $newSisa = max(0, $currentSisa - $qtyDelta);
                            $newQtyPo = max(0, $currentQtyPo + $qtyDelta);

                            $detailPrUpdates[] = [
                                'no_pr' => $noPr,
                                'kd_material' => $resolvedKdMat,
                                'sisa_pr' => $newSisa,
                                'qty_po' => $newQtyPo,
                            ];
                        }
                    }

                    if ($kdMat) {
                        $idPo = $existingDetail->id_po ?? null;
                        $unitValue = $item['unit'] ?? ($existingDetail->unit ?? '');
                        $materialName = $item['material'] ?? ($existingDetail->material ?? '');
                        $noValue = $item['no'] ?? ($existingDetail->no ?? null);

                        $ubahPoPayload[] = [
                            'no_po' => $noPo,
                            'tgl' => $dateFormatted,
                            'ref_pr' => $noPrHeader,
                            'ref_quota' => $request->input('ref_quota'),
                            'for_cus' => $request->input('for_cus'),
                            'ref_poin' => $request->input('ref_poin'),
                            'kd_vdr' => $request->input('kd_vdr'),
                            'nm_vdr' => $request->input('nm_vdr'),
                            'ppn' => $ppnValue,
                            'payment_terms' => $request->input('payment_terms'),
                            'del_time' => $request->input('del_time'),
                            'franco_loco' => $request->input('franco_loco'),
                            'ket1' => $this->withRequiredSpace($request->input('ket1')),
                            'ket2' => $this->withRequiredSpace($request->input('ket2')),
                            'ket3' => $this->withRequiredSpace($request->input('ket3')),
                            'ket4' => $this->withRequiredSpace($request->input('ket4')),
                            'ket' => $this->withRequiredSpace($request->input('ket1')),
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
                        ];
                    }
                }

                // Consolidate tb_detailpr updates
                foreach ($detailPrUpdates as $up) {
                    DB::table('tb_detailpr')
                        ->where('no_pr', $up['no_pr'])
                        ->where('kd_material', $up['kd_material'])
                        ->update([
                            'sisa_pr' => $up['sisa_pr'],
                            'qty_po' => $up['qty_po'],
                        ]);
                }
                foreach ($kdMatsForPr as $kdMatForPr) {
                    $allocationKey = trim((string) $noPrHeader) . '||' . trim((string) $kdMatForPr);
                    if ($prAllocations->has($allocationKey)) {
                        continue;
                    }

                    $this->redistributePurchaseOrderQtyToPr(
                        $noPrHeader,
                        $kdMatForPr,
                    );
                }

                // Batch tb_ubahpo inserts
                if (!empty($ubahPoPayload)) {
                    DB::table('tb_ubahpo')->insert($ubahPoPayload);
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
            return back()->with('error', 'Gagal memperbarui data: ' . $exception->getMessage());
        }

        $this->flushPurchaseOrderCache();

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data PO berhasil diperbarui.');
            return redirect('/pembelian/purchase-order');
        }

        return redirect()
            ->route('pembelian.purchase-order.index')
            ->with('success', 'Data PO berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPo, $detailId)
    {
        try {
            DB::transaction(function () use ($request, $noPo, $detailId) {
                $parseNumber = static function ($value): float {
                    if ($value === null || $value === '') {
                        return 0.0;
                    }
                    return (float) str_replace(',', '', (string) $value);
                };

                $detailRow = DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->where('id', $detailId)
                    ->lockForUpdate()
                    ->first();

                if (!$detailRow) {
                    throw new \RuntimeException('Detail PO tidak ditemukan.');
                }

                $isClearRealization = $request->boolean('clear_realization');
                if ($isClearRealization) {
                    $newQty = max(
                        0,
                        $parseNumber($detailRow->qty ?? 0) - $parseNumber($detailRow->gr_mat ?? 0),
                    );
                    $returnedQty = $parseNumber($detailRow->gr_mat ?? 0);
                    $newTotalPrice = $parseNumber($request->input('total_price', 0));

                    DB::table('tb_detailpo')
                        ->where('no_po', $noPo)
                        ->where('id', $detailId)
                        ->update([
                            'qty' => $newQty,
                            'qty_po' => $newQty,
                            'gr_mat' => 0,
                            'gr_price' => 0,
                            'sisa_pr' => $newQty,
                            'price' => $request->input('price', 0),
                            'total_price' => $newTotalPrice,
                        ]);

                    $sources = collect($request->input('clear_realization_sources', []))
                        ->filter(fn ($item) => is_array($item))
                        ->values();

                    if ($sources->isNotEmpty() && $returnedQty > 0) {
                        $allocatedQty = $sources->sum(fn ($source) => $parseNumber($source['returned_qty'] ?? 0));
                        if (abs($allocatedQty - $returnedQty) > 0.000001) {
                            throw new \RuntimeException('Total qty pengembalian harus sama dengan qty realisasi yang dikembalikan.');
                        }

                        foreach ($sources as $source) {
                            $sourceCustomer = trim((string) ($source['for_customer'] ?? ''));
                            $sourceRefPo = trim((string) ($source['ref_po'] ?? ''));
                            $sourceKdMaterial = trim((string) ($source['kd_material'] ?? ''));
                            $returned = $parseNumber($source['returned_qty'] ?? 0);
                            if ($returned <= 0) {
                                continue;
                            }

                            $detailPrRow = DB::table('tb_detailpr')
                                ->whereRaw('lower(trim(no_pr)) = ?', [strtolower(trim((string) $detailRow->ref_pr))])
                                ->whereRaw('lower(trim(kd_material)) = ?', [strtolower($sourceKdMaterial)])
                                ->whereRaw('lower(trim(coalesce(for_customer, \"\"))) = ?', [strtolower($sourceCustomer)])
                                ->whereRaw('lower(trim(coalesce(ref_po, \"\"))) = ?', [strtolower($sourceRefPo)])
                                ->lockForUpdate()
                                ->first();

                            if (!$detailPrRow) {
                                throw new \RuntimeException("Detail PR tidak ditemukan untuk no_pr={$detailRow->ref_pr}, kd_material={$sourceKdMaterial}, customer={$sourceCustomer}, ref_po={$sourceRefPo}");
                            }

                            DB::table('tb_detailpr')
                                ->where('id', $detailPrRow->id)
                                ->update([
                                    'sisa_pr' => $parseNumber($detailPrRow->sisa_pr ?? 0) + $returned,
                                    'qty_po' => max(0, $parseNumber($detailPrRow->qty_po ?? 0) - $returned),
                                ]);
                        }
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

                    return;
                }

                $oldQty = $parseNumber($detailRow->qty ?? 0);
                $newQty = $parseNumber($request->input('qty', 0));
                $qtyDelta = $newQty - $oldQty;
                $newGrMat = max(
                    0,
                    $parseNumber($detailRow->gr_mat ?? 0) + $qtyDelta,
                );
                $newDetailSisaPr = max(
                    0,
                    $parseNumber($detailRow->sisa_pr ?? 0) - $qtyDelta,
                );

                DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->where('id', $detailId)
                    ->update([
                        'qty' => $request->input('qty', 0),
                        'qty_po' => $newQty,
                        'gr_mat' => $newGrMat,
                        'sisa_pr' => $newDetailSisaPr,
                        'price' => $request->input('price', 0),
                        'total_price' => $request->input('total_price', 0),
                        'gr_price' => $request->input('total_price', 0),
                    ]);

                $noPr = $detailRow->ref_pr ?? null;
                $kdMat = $detailRow->kd_mat ?? null;
                if ($noPr && $kdMat && abs($qtyDelta) > 0.000001) {
                    $detailPr = DB::table('tb_detailpr')
                        ->where('no_pr', $noPr)
                        ->where('kd_material', $kdMat)
                        ->lockForUpdate()
                        ->first();

                    if ($detailPr) {
                        $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                        $currentQtyPo = $parseNumber($detailPr->qty_po ?? 0);

                        if ($qtyDelta > $currentSisa) {
                            throw new \RuntimeException("Qty material {$kdMat} tidak boleh melebihi sisa qty PR ({$currentSisa}).");
                        }

                        $newSisa = max(0, $currentSisa - $qtyDelta);
                        $newQtyPo = max(0, $currentQtyPo + $qtyDelta);

                        DB::table('tb_detailpr')
                            ->where('no_pr', $noPr)
                            ->where('kd_material', $kdMat)
                            ->update([
                                'sisa_pr' => $newSisa,
                                'qty_po' => $newQtyPo,
                            ]);
                        $this->redistributePurchaseOrderQtyToPr($noPr, $kdMat);
                    }
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
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal memperbarui detail: ' . $exception->getMessage());
        }

        $this->flushPurchaseOrderCache();

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Detail PO berhasil diperbarui.');
            return redirect()->back();
        }

        return back()->with('success', 'Detail PO berhasil diperbarui.');
    }

    public function destroyDetail(Request $request, $noPo, $kdMat)
    {
        try {
            DB::transaction(function () use ($noPo, $kdMat) {
                // Business rule: Minimal 1 material
                $count = DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->count();

                if ($count <= 1) {
                    throw new \RuntimeException('Gagal menghapus. Minimal harus ada 1 material dalam PO.');
                }

                $parseNumber = static function ($value): float {
                    if ($value === null || $value === '') {
                        return 0.0;
                    }
                    return (float) str_replace(',', '', (string) $value);
                };

                $detailRows = DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->where('kd_mat', $kdMat)
                    ->lockForUpdate()
                    ->get(['ref_pr', 'kd_mat', 'qty']);

                if ($detailRows->isEmpty()) {
                    return;
                }

                $prKeys = $detailRows->map(function ($row) use ($parseNumber) {
                    return [
                        'no_pr' => trim((string) ($row->ref_pr ?? '')),
                        'kd_material' => trim((string) ($row->kd_mat ?? '')),
                        'qty' => $parseNumber($row->qty ?? 0)
                    ];
                })->filter(fn($k) => $k['no_pr'] !== '' && $k['kd_material'] !== '' && $k['qty'] > 0);

                if ($prKeys->isNotEmpty()) {
                    $noPrs = $prKeys->pluck('no_pr')->unique()->all();
                    $kdMats = $prKeys->pluck('kd_material')->unique()->all();

                    $detailPrs = DB::table('tb_detailpr')
                        ->whereIn('no_pr', $noPrs)
                        ->whereIn('kd_material', $kdMats)
                        ->lockForUpdate()
                        ->get()
                        ->groupBy(fn($row) => $row->no_pr . '|' . $row->kd_material);

                    foreach ($prKeys as $k) {
                        $key = $k['no_pr'] . '|' . $k['kd_material'];
                        $detailPr = $detailPrs->get($key)?->first();

                        if ($detailPr) {
                            $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                            $currentQtyPo = $parseNumber($detailPr->qty_po ?? 0);

                            DB::table('tb_detailpr')
                                ->where('no_pr', $k['no_pr'])
                                ->where('kd_material', $k['kd_material'])
                                ->update([
                                    'sisa_pr' => $currentSisa + $k['qty'],
                                    'qty_po' => max(0, $currentQtyPo - $k['qty']),
                                ]);
                        }
                    }
                }

                DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->where('kd_mat', $kdMat)
                    ->delete();
                foreach ($prKeys as $key) {
                    $this->redistributePurchaseOrderQtyToPr(
                        $key['no_pr'],
                        $key['kd_material'],
                    );
                }

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
            return back()->with('error', 'Gagal menghapus material: ' . $e->getMessage());
        }

        $this->flushPurchaseOrderCache();

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Material berhasil dihapus.');
            return redirect('/pembelian/purchase-order/' . $noPo . '/edit');
        }

        return redirect()
            ->back()
            ->with('success', 'Material berhasil dihapus.');
    }

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        if ($request->wantsJson()) {
            return $this->data($request);
        }

        return Inertia::render('pembelian/purchase-order/index', [
            'purchaseOrders' => [],
            'outstandingCount' => 0,
            'outstandingTotal' => 0,
            'partialCount' => 0,
            'partialTotal' => 0,
            'realizedCount' => 0,
            'realizedTotal' => 0,
            'period' => $period,
            'filters' => $request->all(['period']),
        ]);
    }

    public function data(Request $request)
    {
        $dateFilter = (string) $request->query('date_filter', 'today');
        $status = (string) $request->query('status', 'all');
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', '5');
        $page = max(1, (int) $request->query('page', 1));
        $poDateExpr = "coalesce(str_to_date(po.tgl, '%d.%m.%Y'), str_to_date(po.tgl, '%d/%m/%Y'), str_to_date(po.tgl, '%d-%m-%Y'), str_to_date(po.tgl, '%Y-%m-%d'), str_to_date(po.tgl, '%Y/%m/%d'), date(po.tgl))";

        $now = \Carbon\Carbon::now();
        $actualDateKey = $dateFilter;
        if ($dateFilter === 'today') {
            $actualDateKey = $now->toDateString();
        } elseif ($dateFilter === 'this_week') {
            $actualDateKey = $now->startOfWeek()->toDateString();
        } elseif ($dateFilter === 'this_month') {
            $actualDateKey = $now->format('Y-m');
        } elseif ($dateFilter === 'this_year') {
            $actualDateKey = $now->year;
        }

        $cacheKey = $this->poCacheKey('data', [
            'date_filter' => $dateFilter,
            'actual_date' => $actualDateKey, // <--- Kunci Tanggal Dinamis
            'status' => $status,
            'search' => $search,
            'pageSize' => $pageSizeRaw,
            'page' => $page,
            'start_date' => (string) $request->query('start_date', ''),
            'end_date' => (string) $request->query('end_date', ''),
            'include_summary' => $request->boolean('include_summary'),
            'period' => (string) $request->query('period', 'today'),
        ], $request);

        $response = $this->bypassCache()->remember($cacheKey, self::PO_CACHE_TTL, function () use ($dateFilter, $status, $search, $pageSizeRaw, $page, $poDateExpr, $request) {
            $statusSub = DB::table('tb_detailpo')
            ->select('no_po')
            ->selectRaw("
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) = 0 then 1 else 0 end as is_outstanding,
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) > 0 then 1 else 0 end as is_partial,
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(qty, 0) != coalesce(end_fl, 0) then 1 else 0 end) = 0 then 1 else 0 end as is_fully_realized,
                case when sum(case when coalesce(ir_mat, 0) > 0 then 1 else 0 end) > 0 then 1 else 0 end as is_sisa_ir
            ")
            ->groupBy('no_po');

        $query = DB::table('tb_po as po')
            ->leftJoinSub($statusSub, 's', 'po.no_po', '=', 's.no_po')
            ->select(
                'po.no_po',
                'po.tgl',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.for_cus',
                'po.ppn',
                'po.s_total',
                'po.h_ppn'
            )
            ->selectRaw('coalesce(s.is_outstanding, 0) as is_outstanding')
            ->selectRaw('coalesce(s.is_partial, 0) as is_partial');

        $now = now();
        if ($dateFilter === 'today') {
            $query->whereRaw("{$poDateExpr} = ?", [$now->toDateString()]);
        } elseif ($dateFilter === 'this_week') {
            $query->whereRaw("{$poDateExpr} between ? and ?", [
                $now->copy()->startOfWeek()->toDateString(),
                $now->copy()->endOfWeek()->toDateString(),
            ]);
        } elseif ($dateFilter === 'this_month') {
            $query->whereRaw("year({$poDateExpr}) = ?", [$now->year])
                ->whereRaw("month({$poDateExpr}) = ?", [$now->month]);
        } elseif ($dateFilter === 'this_year') {
            $query->whereRaw("year({$poDateExpr}) = ?", [$now->year]);
        } elseif ($dateFilter === 'range') {
            $startDate = (string) $request->query('start_date', '');
            $endDate = (string) $request->query('end_date', '');
            if ($startDate !== '' && $endDate !== '') {
                $query->whereRaw("{$poDateExpr} between ? and ?", [$startDate, $endDate]);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($status === 'outstanding') {
            $query->whereRaw('coalesce(s.is_outstanding, 0) = 1');
        } elseif ($status === 'partial') {
            $query->whereRaw('coalesce(s.is_partial, 0) = 1');
        } elseif ($status === 'realized') {
            $query->whereRaw('coalesce(s.is_fully_realized, 0) = 1');
        } elseif ($status === 'sisa_ir') {
            $query->whereRaw('coalesce(s.is_sisa_ir, 0) = 1');
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('po.no_po', 'like', "%{$search}%")
                    ->orWhere('po.tgl', 'like', "%{$search}%")
                    ->orWhere('po.nm_vdr', 'like', "%{$search}%")
                    ->orWhere('po.ref_pr', 'like', "%{$search}%")
                    ->orWhere('po.ref_quota', 'like', "%{$search}%")
                    ->orWhere('po.ref_poin', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();

        $query->orderByRaw("{$poDateExpr} desc")
            ->orderBy('po.no_po', 'desc');

        if ($pageSizeRaw !== 'all') {
            $pageSize = max(1, (int) $pageSizeRaw);
            $query->forPage($page, $pageSize);
        }

        $purchaseOrders = $query->get();

        $purchaseOrders->transform(function ($item) {
            if ($item->tgl) {
                try {
                    $item->tgl = \Carbon\Carbon::parse($item->tgl)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        $response = [
            'purchaseOrders' => $purchaseOrders,
            'total' => $total,
            'filters' => [
                'date_filter' => $dateFilter,
                'status' => $status,
            ],
        ];

        if ($request->boolean('include_summary')) {
            $response['summary'] = $this->getPurchaseOrderSummaryData(
                (string) $request->query('period', 'today')
            );
        }

            return $response;
        });

        return response()->json($response);
    }

    private function getPurchaseOrderSummaryData($period = 'today')
    {
        $outstandingIds = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) = 0')
            ->havingRaw('count(*) > 0')
            ->pluck('no_po');

        $outstandingStats = DB::table('tb_po')
            ->whereIn('no_po', $outstandingIds)
            ->selectRaw('count(*) as count, sum(g_total) as total')
            ->first();

        $partialIds = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) > 0')
            ->pluck('no_po');

        $partialStats = DB::table('tb_po')
            ->whereIn('no_po', $partialIds)
            ->selectRaw('count(*) as count, sum(g_total) as total')
            ->first();

        $docDateExpr = "coalesce(str_to_date(k.doc_tgl, '%d.%m.%Y'), str_to_date(k.doc_tgl, '%d/%m/%Y'), str_to_date(k.doc_tgl, '%d-%m-%Y'), str_to_date(k.doc_tgl, '%Y-%m-%d'), str_to_date(k.doc_tgl, '%Y/%m/%d'), date(k.doc_tgl))";

        $now = now();
        $startDate = $now->copy()->startOfDay()->toDateString();
        $endDate = $now->copy()->endOfDay()->toDateString();

        if ($period === 'this_week') {
            $startDate = $now->copy()->startOfWeek()->toDateString();
            $endDate = $now->copy()->endOfWeek()->toDateString();
        } elseif ($period === 'this_month') {
            $startDate = $now->copy()->startOfMonth()->toDateString();
            $endDate = $now->copy()->endOfMonth()->toDateString();
        } elseif ($period === 'this_year') {
            $startDate = $now->copy()->startOfYear()->toDateString();
            $endDate = $now->copy()->endOfYear()->toDateString();
        }

        $poNumbersInPeriod = DB::table('tb_kdmi as k')
            ->whereRaw("{$docDateExpr} >= ?", [$startDate])
            ->whereRaw("{$docDateExpr} <= ?", [$endDate])
            ->pluck('ref_pr')
            ->unique()
            ->filter()
            ->all();

        $realizedCount = 0;
        $realizedTotal = 0;
        if (!empty($poNumbersInPeriod)) {
            $finishedPoNumbers = DB::table('tb_detailpo')
                ->whereIn('no_po', $poNumbersInPeriod)
                ->groupBy('no_po')
                ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(qty, 0) \!= coalesce(end_fl, 0) then 1 else 0 end) = 0')
                ->pluck('no_po')
                ->all();

            if (!empty($finishedPoNumbers)) {
                $realizedQuery = DB::table('tb_po')
                    ->whereIn('no_po', $finishedPoNumbers)
                    ->selectRaw('count(*) as count, sum(g_total) as total')
                    ->first();

                $realizedCount = (int) ($realizedQuery->count ?? 0);
                $realizedTotal = (float) ($realizedQuery->total ?? 0);
            }
        }

        return [
            'outstandingCount' => (int) ($outstandingStats->count ?? 0),
            'outstandingTotal' => (float) ($outstandingStats->total ?? 0),
            'partialCount' => (int) ($partialStats->count ?? 0),
            'partialTotal' => (float) ($partialStats->total ?? 0),
            'realizedCount' => $realizedCount,
            'realizedTotal' => $realizedTotal,
        ];
    }

    private function getPurchaseOrderListingData($period = 'today')
    {
        // 1. Efficient Summary Stats
        $outstandingIds = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) = 0')
            ->havingRaw('count(*) > 0')
            ->pluck('no_po');

        $outstandingStats = DB::table('tb_po')
            ->whereIn('no_po', $outstandingIds)
            ->selectRaw('count(*) as count, sum(g_total) as total')
            ->first();

        $outstandingCount = (int) ($outstandingStats->count ?? 0);
        $outstandingTotal = (float) ($outstandingStats->total ?? 0);

        $partialIds = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) > 0')
            ->pluck('no_po');

        $partialStats = DB::table('tb_po')
            ->whereIn('no_po', $partialIds)
            ->selectRaw('count(*) as count, sum(g_total) as total')
            ->first();

        $partialCount = (int) ($partialStats->count ?? 0);
        $partialTotal = (float) ($partialStats->total ?? 0);
        $partialIrIds = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(ir_mat, 0) < coalesce(qty, 0) then 1 else 0 end) > 0')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(ir_mat, 0) > 0 then 1 else 0 end) > 0')
            ->pluck('no_po');

        $partialIrStats = DB::table('tb_detailpo')
            ->whereIn('no_po', $partialIrIds)
            ->selectRaw('count(distinct no_po) as count, sum(coalesce(cast(ir_price as decimal(65,4)), 0)) as total')
            ->first();

        $partialIrCount = (int) ($partialIrStats->count ?? 0);
        $partialIrTotal = (float) ($partialIrStats->total ?? 0);


        // 2. Fetch main PO headers
        $recentPurchaseOrders = DB::table('tb_po as po')
            ->select('po.no_po', 'po.tgl', 'po.nm_vdr', 'po.g_total', 'po.ref_pr', 'po.ref_quota', 'po.ref_poin', 'po.for_cus', 'po.ppn', 'po.s_total', 'po.h_ppn')
            ->orderBy('tgl', 'desc')
            ->orderBy('no_po', 'desc')
            ->limit(1500)
            ->get();

        $specialStatusPurchaseOrders = collect();
        $specialStatusIds = $outstandingIds->merge($partialIds)->unique();
        $recentIds = $recentPurchaseOrders->pluck('no_po')->all();
        $missingSpecialIds = $specialStatusIds->diff($recentIds);
        
        if ($missingSpecialIds->isNotEmpty()) {
            $specialStatusPurchaseOrders = DB::table('tb_po as po')
                ->select('po.no_po', 'po.tgl', 'po.nm_vdr', 'po.g_total', 'po.ref_pr', 'po.ref_quota', 'po.ref_poin', 'po.for_cus', 'po.ppn', 'po.s_total', 'po.h_ppn')
                ->whereIn('po.no_po', $missingSpecialIds)
                ->get();
        }

        $purchaseOrders = $recentPurchaseOrders->merge($specialStatusPurchaseOrders);
        $poNumbers = $purchaseOrders->pluck('no_po')->unique()->all();

        // 3. Single-query status aggregation
        $poStatuses = DB::table('tb_detailpo')
            ->select('no_po')
            ->selectRaw("
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) = 0 then 1 else 0 end as is_outstanding,
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) > 0 then 1 else 0 end as is_partial,
                case when sum(case when coalesce(qty, 0) > 0 and coalesce(qty, 0) != coalesce(end_fl, 0) then 1 else 0 end) = 0 then 1 else 0 end as is_fully_realized
            ")
            ->whereIn('no_po', $poNumbers)
            ->groupBy('no_po')
            ->get()
            ->keyBy('no_po');

        $purchaseOrders->transform(function($item) use ($poStatuses) {
            $status = $poStatuses->get($item->no_po);
            $item->is_outstanding = $status->is_outstanding ?? 0;
            $item->is_partial = $status->is_partial ?? 0;
            $item->is_fully_realized = $status->is_fully_realized ?? 0;
            return $item;
        });

        // 4. Realized stats in specific period
        $docDateExpr = "coalesce(str_to_date(k.doc_tgl, '%d.%m.%Y'), str_to_date(k.doc_tgl, '%d/%m/%Y'), str_to_date(k.doc_tgl, '%d-%m-%Y'), str_to_date(k.doc_tgl, '%Y-%m-%d'), str_to_date(k.doc_tgl, '%Y/%m/%d'), date(k.doc_tgl))";

        $now = now();
        $startDate = $now->copy()->startOfDay()->toDateString();
        $endDate = $now->copy()->endOfDay()->toDateString();

        if ($period === 'this_week') {
            $startDate = $now->copy()->startOfWeek()->toDateString();
            $endDate = $now->copy()->endOfWeek()->toDateString();
        } elseif ($period === 'this_month') {
            $startDate = $now->copy()->startOfMonth()->toDateString();
            $endDate = $now->copy()->endOfMonth()->toDateString();
        } elseif ($period === 'this_year') {
            $startDate = $now->copy()->startOfYear()->toDateString();
            $endDate = $now->copy()->endOfYear()->toDateString();
        }

        $poNumbersInPeriod = DB::table('tb_kdmi as k')
            ->whereRaw("{$docDateExpr} >= ?", [$startDate])
            ->whereRaw("{$docDateExpr} <= ?", [$endDate])
            ->pluck('ref_pr')
            ->unique()
            ->filter()
            ->all();

        if (empty($poNumbersInPeriod)) {
            $realizedCount = 0;
            $realizedTotal = 0;
        } else {
            $finishedPoNumbers = DB::table('tb_detailpo')
                ->whereIn('no_po', $poNumbersInPeriod)
                ->groupBy('no_po')
                ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(qty, 0) \!= coalesce(end_fl, 0) then 1 else 0 end) = 0')
                ->pluck('no_po')
                ->all();

            if (empty($finishedPoNumbers)) {
                $realizedCount = 0;
                $realizedTotal = 0;
            } else {
                $realizedQuery = DB::table('tb_po')
                    ->whereIn('no_po', $finishedPoNumbers)
                    ->selectRaw('count(*) as count, sum(g_total) as total')
                    ->first();
                    
                $realizedCount = (int) ($realizedQuery->count ?? 0);
                $realizedTotal = (float) ($realizedQuery->total ?? 0);
            }
        }

        $invinAgg = DB::table('tb_invin')
            ->select('ref_po')
            ->whereNotNull('ref_po')
            ->whereIn('ref_po', $poNumbers)
            ->groupBy('ref_po')
            ->pluck('ref_po')
            ->all();

        $purchaseOrders->transform(function ($item) use ($invinAgg) {
            $item->can_delete = !in_array($item->no_po, $invinAgg);
            return $item;
        });

        $purchaseOrders->transform(function ($item) {
            if ($item->tgl) {
                try {
                    $item->tgl = \Carbon\Carbon::parse($item->tgl)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        return [
            'purchaseOrders' => $purchaseOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'partialCount' => $partialCount,
            'partialTotal' => $partialTotal,
            'partialIrCount' => $partialIrCount,
            'partialIrTotal' => $partialIrTotal,
            'realizedCount' => $realizedCount,
            'realizedTotal' => $realizedTotal,
            'period' => $period,
        ];
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        // [PERBAIKAN] Tambahkan identitas tanggal hari ini agar cache ter-refresh tiap hari berganti
        $now = \Carbon\Carbon::now();
        $actualDateKey = $period;
        if ($period === 'today') {
            $actualDateKey = $now->toDateString();
        } elseif ($period === 'this_week') {
            $actualDateKey = $now->startOfWeek()->toDateString();
        } elseif ($period === 'this_month') {
            $actualDateKey = $now->format('Y-m');
        } elseif ($period === 'this_year') {
            $actualDateKey = $now->year;
        }

        $response = $this->bypassCache()->remember($this->poCacheKey('realized', [
            'period' => $period,
            'actual_date' => $actualDateKey, // <--- Kunci Tanggal Dinamis
            'summary' => $request->boolean('summary'),
        ], $request), self::PO_CACHE_TTL, function () use ($request, $period) {

        $docDateExpr = "coalesce(str_to_date(k.doc_tgl, '%d.%m.%Y'), str_to_date(k.doc_tgl, '%d/%m/%Y'), str_to_date(k.doc_tgl, '%d-%m-%Y'), str_to_date(k.doc_tgl, '%Y-%m-%d'), str_to_date(k.doc_tgl, '%Y/%m/%d'), date(k.doc_tgl))";

        $now = now();
        $startDate = $now->copy()->startOfDay()->toDateString();
        $endDate = $now->copy()->endOfDay()->toDateString();

        if ($period === 'this_week') {
            $startDate = $now->copy()->startOfWeek()->toDateString();
            $endDate = $now->copy()->endOfWeek()->toDateString();
        } elseif ($period === 'this_month') {
            $startDate = $now->copy()->startOfMonth()->toDateString();
            $endDate = $now->copy()->endOfMonth()->toDateString();
        } elseif ($period === 'this_year') {
            $startDate = $now->copy()->startOfYear()->toDateString();
            $endDate = $now->copy()->endOfYear()->toDateString();
        }

        $poNumbersInPeriod = DB::table('tb_kdmi as k')
            ->whereRaw("{$docDateExpr} >= ?", [$startDate])
            ->whereRaw("{$docDateExpr} <= ?", [$endDate])
            ->pluck('ref_pr')
            ->unique()
            ->filter()
            ->all();

        if (empty($poNumbersInPeriod)) {
            if ($request->boolean('summary')) {
                return [
                    'realizedCount' => 0,
                    'realizedTotal' => 0,
                    'period' => $period,
                ];
            }
            return [
                'purchaseOrders' => [],
                'realizedTotal' => 0,
            ];
        }

        $finishedPoNumbers = DB::table('tb_detailpo')
            ->whereIn('no_po', $poNumbersInPeriod)
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(qty, 0) \!= coalesce(end_fl, 0) then 1 else 0 end) = 0')
            ->pluck('no_po')
            ->all();

        if (empty($finishedPoNumbers)) {
            if ($request->boolean('summary')) {
                return [
                    'realizedCount' => 0,
                    'realizedTotal' => 0,
                    'period' => $period,
                ];
            }
            return [
                'purchaseOrders' => [],
                'realizedTotal' => 0,
            ];
        }

        $query = DB::table('tb_po as po')
            ->whereIn('po.no_po', $finishedPoNumbers)
            ->select(
                'po.no_po',
                'po.tgl',
                'po.nm_vdr',
                'po.g_total',
                'po.ref_pr',
                'po.ref_quota',
                'po.ref_poin',
                'po.for_cus',
                'po.ppn',
                'po.s_total',
                'po.h_ppn'
            )
            ->selectRaw('0 as is_outstanding');

        if ($request->boolean('summary')) {
            $summary = DB::table('tb_po')->whereIn('no_po', $finishedPoNumbers)->selectRaw('count(*) as count, coalesce(sum(g_total), 0) as total')->first();

            return [
                'realizedCount' => (int) ($summary->count ?? 0),
                'realizedTotal' => (float) ($summary->total ?? 0),
                'period' => $period,
            ];
        }

        $realizedTotal = (clone $query)->sum('g_total');

        $purchaseOrders = $query
            ->orderByRaw("coalesce(str_to_date(po.tgl, '%d.%m.%Y'), str_to_date(po.tgl, '%d/%m/%Y'), str_to_date(po.tgl, '%d-%m-%Y'), str_to_date(po.tgl, '%Y-%m-%d'), str_to_date(po.tgl, '%Y/%m/%d'), date(po.tgl)) desc")
            ->orderBy('po.no_po', 'desc')
            ->get();

        $purchaseOrders->transform(function ($item) {
            if ($item->tgl) {
                try {
                    $item->tgl = \Carbon\Carbon::parse($item->tgl)->format('d.m.Y');
                } catch (\Throwable $e) {
                }
            }
            return $item;
        });

        return [
            'purchaseOrders' => $purchaseOrders,
            'realizedTotal' => (float) $realizedTotal,
        ];
        });

        return response()->json($response);
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

        $response = $this->bypassCache()->remember($this->poCacheKey('details', [
            'no_po' => $noPo,
            'realized_only' => $request->boolean('realized_only'),
            'search' => (string) $request->input('search', ''),
        ], $request), self::PO_CACHE_TTL, function () use ($request, $noPo) {
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
                    'gr_mat',
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

            return [
                'purchaseOrder' => $header,
                'purchaseOrderDetails' => $query->orderBy('no')->get(),
            ];
        });

        return response()->json($response);
    }

    public function outstanding(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 'all');
        $page = max(1, (int) $request->query('page', 1));

        $response = $this->bypassCache()->remember($this->poCacheKey('outstanding', [
            'search' => $search,
            'pageSize' => $pageSizeRaw,
            'page' => $page,
        ], $request), self::PO_CACHE_TTL, function () use ($search, $pageSizeRaw, $page) {
            $sub = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) = 0');

        $query = DB::table('tb_po as po')
            ->joinSub($sub, 's', 'po.no_po', '=', 's.no_po')
            ->select(
                'po.no_po', 'po.tgl', 'po.nm_vdr', 'po.g_total', 'po.ref_pr', 'po.ref_quota', 'po.ref_poin', 'po.for_cus', 'po.ppn', 'po.s_total', 'po.h_ppn'
            )
            ->orderby('no_po', 'desc');

        if ($search !== '') {
            $query->where(function($q) use ($search) {
                $q->where('po.no_po', 'like', "%{$search}%")
                  ->orWhere('po.nm_vdr', 'like', "%{$search}%")
                  ->orWhere('po.ref_pr', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();

        if ($pageSizeRaw !== 'all') {
            $pageSize = max(1, (int) $pageSizeRaw);
            $query->forPage($page, $pageSize);
        }

        $purchaseOrders = $query->orderBy('po.tgl', 'desc')
            ->orderBy('po.no_po', 'desc')
            ->get();

        $poNumbers = $purchaseOrders->pluck('no_po')->all();
        $invinAgg = [];
        if (!empty($poNumbers)) {
            $invinAgg = DB::table('tb_invin')
                ->whereIn('ref_po', $poNumbers)
                ->pluck('ref_po')
                ->unique()
                ->all();
        }

        $purchaseOrders->transform(function ($item) use ($invinAgg) {
            $item->can_delete = !in_array($item->no_po, $invinAgg);
            $item->is_outstanding = 1;
            if ($item->tgl) {
                try {
                    $item->tgl = \Carbon\Carbon::parse($item->tgl)->format('d.m.Y');
                } catch (\Throwable $e) {}
            }
            return $item;
        });

            return [
            'purchaseOrders' => $purchaseOrders,
            'total' => $total,
            ];
        });

        return response()->json($response);
    }

    public function partialIr(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 'all');
        $page = max(1, (int) $request->query('page', 1));

        $response = $this->bypassCache()->remember($this->poCacheKey('partial_ir', [
            'search' => $search,
            'pageSize' => $pageSizeRaw,
            'page' => $page,
        ], $request), self::PO_CACHE_TTL, function () use ($search, $pageSizeRaw, $page) {
            $sub = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(ir_mat, 0) < coalesce(qty, 0) then 1 else 0 end) > 0')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(ir_mat, 0) > 0 then 1 else 0 end) > 0');

        $query = DB::table('tb_po as po')
            ->joinSub($sub, 's', 'po.no_po', '=', 's.no_po')
            ->select(
                'po.no_po', 'po.tgl', 'po.nm_vdr', 'po.g_total', 'po.ref_pr', 'po.ref_quota', 'po.ref_poin', 'po.for_cus', 'po.ppn', 'po.s_total', 'po.h_ppn'
            )
            ->orderby('no_po', 'desc');

        if ($search !== '') {
            $query->where(function($q) use ($search) {
                $q->where('po.no_po', 'like', "%{$search}%")
                  ->orWhere('po.nm_vdr', 'like', "%{$search}%")
                  ->orWhere('po.ref_pr', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();

        if ($pageSizeRaw !== 'all') {
            $pageSize = max(1, (int) $pageSizeRaw);
            $query->limit($pageSize)->offset(($page - 1) * $pageSize);
        }

        $purchaseOrders = collect($query->get());

        $hasRealized = false;
        if ($purchaseOrders->isNotEmpty()) {
            $hasRealized = DB::table('tb_kddo')
                ->whereIn('ref_po', $purchaseOrders->pluck('no_po'))
                ->exists();
        }

        $purchaseOrders->transform(function ($item) use ($hasRealized) {
            $item->is_outstanding = 0;
            $item->is_partial = 0;
            $item->is_fully_realized = 0; 
            $item->is_partial_ir = 1;
            $item->has_realized = $hasRealized ? 1 : 0;
            return $item;
        });

        return [
            'purchaseOrders' => $purchaseOrders,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSizeRaw === 'all' ? $total : (int)$pageSizeRaw,
        ];
        });

        return response()->json($response);
    }
    public function partial(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 'all');
        $page = max(1, (int) $request->query('page', 1));

        $response = $this->bypassCache()->remember($this->poCacheKey('partial', [
            'search' => $search,
            'pageSize' => $pageSizeRaw,
            'page' => $page,
        ], $request), self::PO_CACHE_TTL, function () use ($search, $pageSizeRaw, $page) {
            $sub = DB::table('tb_detailpo')
            ->select('no_po')
            ->groupBy('no_po')
            ->havingRaw('sum(case when coalesce(qty, 0) > 0 and coalesce(gr_mat, 0) > 0 and coalesce(gr_mat, 0) != coalesce(qty, 0) then 1 else 0 end) > 0');

        $query = DB::table('tb_po as po')
            ->joinSub($sub, 's', 'po.no_po', '=', 's.no_po')
            ->select(
                'po.no_po', 'po.tgl', 'po.nm_vdr', 'po.g_total', 'po.ref_pr', 'po.ref_quota', 'po.ref_poin', 'po.for_cus', 'po.ppn', 'po.s_total', 'po.h_ppn'
            );

        if ($search !== '') {
            $query->where(function($q) use ($search) {
                $q->where('po.no_po', 'like', "%{$search}%")
                  ->orWhere('po.nm_vdr', 'like', "%{$search}%")
                  ->orWhere('po.ref_pr', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();

        if ($pageSizeRaw !== 'all') {
            $pageSize = max(1, (int) $pageSizeRaw);
            $query->forPage($page, $pageSize);
        }

        $purchaseOrders = $query->orderBy('po.tgl', 'desc')
            ->orderBy('po.no_po', 'desc')
            ->get();

        $poNumbers = $purchaseOrders->pluck('no_po')->all();
        $invinAgg = [];
        if (!empty($poNumbers)) {
            $invinAgg = DB::table('tb_invin')
                ->whereIn('ref_po', $poNumbers)
                ->pluck('ref_po')
                ->unique()
                ->all();
        }

        $purchaseOrders->transform(function ($item) use ($invinAgg) {
            $item->can_delete = !in_array($item->no_po, $invinAgg);
            $item->is_partial = 1;
            if ($item->tgl) {
                try {
                    $item->tgl = \Carbon\Carbon::parse($item->tgl)->format('d.m.Y');
                } catch (\Throwable $e) {}
            }
            return $item;
        });

            return [
            'purchaseOrders' => $purchaseOrders,
            'total' => $total,
            ];
        });

        return response()->json($response);
    }

    public function print(Request $request, $noPo)
    {
        $printData = $this->bypassCache()->remember($this->poCacheKey('print', [$noPo], $request), self::PO_CACHE_TTL, function () use ($noPo) {
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

                $purchaseOrderDetails = DB::table('tb_detailpo')
                    ->where('no_po', $noPo)
                    ->orderBy('no')
                    ->get([
                        'no_po',
                        'no',
                        'material',
                        'qty',
                        'sisa_pr',
                        'gr_mat',
                        'ir_mat',
                        'unit',
                        'price',
                        'total_price',
                        'del_time',
                        'payment_terms',
                        'franco_loco',
                        'ket1',
                        'ket2',
                        'ket3',
                        'ket4',
                        'kd_mat',
                        'kd_vdr',
                        'ref_pr',
                        'ref_poin',
                        'for_cus',
                        'ppn',
                    ]);

            return [
                'purchaseOrder' => $purchaseOrder,
                'purchaseOrderDetails' => $purchaseOrderDetails,
            ];
        });

        $purchaseOrder = $printData['purchaseOrder'];

        if (!$purchaseOrder) {
            return redirect()
                ->route('pembelian.purchase-order.index')
                ->with('error', 'Data PO tidak ditemukan.');
        }

        $purchaseOrderDetails = $printData['purchaseOrderDetails'];

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

        return Inertia::render('pembelian/purchase-order/print', [
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
                $parseNumber = static function ($value): float {
                    if ($value === null || $value === '') {
                        return 0.0;
                    }
                    return (float) str_replace(',', '', (string) $value);
                };

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

                $details = DB::table('tb_detailpo')
                    ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
                    ->get(); // Get all columns for hapuspo

                if ($details->isEmpty()) {
                    return;
                }

                $prKeys = $details->map(function ($row) use ($parseNumber) {
                    return [
                        'no_pr' => trim((string) ($row->ref_pr ?? '')),
                        'kd_material' => trim((string) ($row->kd_mat ?? '')),
                        'qty' => $parseNumber($row->qty ?? 0)
                    ];
                })->filter(fn($k) => $k['no_pr'] !== '' && $k['kd_material'] !== '' && $k['qty'] > 0);

                if ($prKeys->isNotEmpty()) {
                    $noPrs = $prKeys->pluck('no_pr')->unique()->all();
                    $kdMats = $prKeys->pluck('kd_material')->unique()->all();

                    $detailPrs = DB::table('tb_detailpr')
                        ->whereIn('no_pr', $noPrs)
                        ->whereIn('kd_material', $kdMats)
                        ->lockForUpdate()
                        ->get()
                        ->groupBy(fn($row) => $row->no_pr . '|' . $row->kd_material);

                    foreach ($prKeys as $k) {
                        $key = $k['no_pr'] . '|' . $k['kd_material'];
                        $detailPr = $detailPrs->get($key)?->first();

                        if ($detailPr) {
                            $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                            $currentQtyPo = $parseNumber($detailPr->qty_po ?? 0);

                            DB::table('tb_detailpr')
                                ->where('no_pr', $k['no_pr'])
                                ->where('kd_material', $k['kd_material'])
                                ->update([
                                    'sisa_pr' => $currentSisa + $k['qty'],
                                    'qty_po' => max(0, $currentQtyPo - $k['qty']),
                                ]);
                        }
                    }
                }

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
                foreach ($prKeys as $key) {
                    $this->redistributePurchaseOrderQtyToPr(
                        $key['no_pr'],
                        $key['kd_material'],
                    );
                }
                DB::table('tb_po')
                    ->whereRaw('lower(trim(no_po)) = ?', [strtolower($noPo)])
                    ->delete();
            });
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        $this->flushPurchaseOrderCache();

        return response()->json(['message' => 'PO berhasil dihapus.']);
    }


}
