<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseRequirementController
{
    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        $purchaseRequirements = DB::table('tb_pr as pr')
            ->leftJoin(
                DB::raw('(
                    select
                        no_pr,
                        coalesce(sum(cast(sisa_pr as decimal(18,4))), 0) as pr_sisa
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
                'pr.payment',
                DB::raw('coalesce(detail.pr_sisa, 0) as sisa_pr'),
                DB::raw('case when coalesce(detail.pr_sisa, 0) > 0 then 1 else 0 end as outstanding_count'),
                DB::raw('case when coalesce(detail.pr_sisa, 0) = 0 then 1 else 0 end as realized_count')
            )
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $outstandingCount = DB::table('tb_detailpr')
            ->select('no_pr', DB::raw('coalesce(sum(cast(sisa_pr as decimal(18,4))), 0) as pr_sisa'))
            ->groupBy('no_pr')
            ->having('pr_sisa', '>', 0)
            ->count();

        $realizedCount = DB::table('tb_detailpr')
            ->select('no_pr', DB::raw('coalesce(sum(cast(sisa_pr as decimal(18,4))), 0) as pr_sisa'))
            ->groupBy('no_pr')
            ->having('pr_sisa', '=', 0)
            ->count();

        $outstandingTotal = DB::table('tb_detailpr')
            ->whereRaw('cast(sisa_pr as decimal(18,4)) > 0')
            ->sum(DB::raw('coalesce(total_price, 0)'));

        // Realized: tb_pr.ref_po = tb_do.ref_po filtered by tb_do.pos_tgl
        $docDateExpr = "coalesce(date(d.pos_tgl), str_to_date(d.pos_tgl, '%Y-%m-%d'), str_to_date(d.pos_tgl, '%Y/%m/%d'), str_to_date(d.pos_tgl, '%d/%m/%Y'), str_to_date(d.pos_tgl, '%d-%m-%Y'), str_to_date(d.pos_tgl, '%d.%m.%Y'))";

        $realizedQuery = DB::table('tb_pr as pr')
            ->join('tb_do as d', function ($join) {
                $join->on(DB::raw('lower(trim(pr.ref_po))'), '=', DB::raw('lower(trim(d.ref_po))'));
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

        $realizedPrNos = $realizedQuery->distinct('pr.no_pr')->pluck('pr.no_pr');
        $realizedCount = $realizedPrNos->count();
        $realizedTotal = DB::table('tb_detailpr')
            ->whereIn('no_pr', $realizedPrNos)
            ->sum(DB::raw('coalesce(total_price,0)'));

        return Inertia::render('marketing/purchase-requirement/index', [
            'purchaseRequirements' => $purchaseRequirements,
            'outstandingCount' => $outstandingCount,
            'realizedCount' => $realizedCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedTotal' => (float) $realizedTotal,
            'period' => $period,
        ]);
    }

    public function details(Request $request)
    {
        $noPr = $request->query('no_pr');
        if (!$noPr) {
            return response()->json([
                'purchaseRequirementDetails' => [],
            ]);
        }

        $query = DB::table('tb_detailpr')
            ->select(
                'no_pr',
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'sisa_pr',
                'renmark'
            )
            ->where('no_pr', $noPr);

        if ($request->boolean('realized_only')) {
            $query->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('tb_do')
                    ->whereColumn(DB::raw('lower(trim(tb_do.ref_po))'), '=', DB::raw('lower(trim(tb_detailpr.ref_po))'));
            });
        }

        $purchaseRequirementDetails = $query->orderBy('no')->get();

        return response()->json([
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
        ]);
    }

    public function outstanding()
    {
        $purchaseRequirements = DB::table('tb_pr as pr')
            ->leftJoin(
                DB::raw('(
                    select
                        no_pr,
                        coalesce(sum(cast(sisa_pr as decimal(18,4))), 0) as pr_sisa
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
                'pr.payment',
                DB::raw('coalesce(detail.pr_sisa, 0) as sisa_pr'),
                DB::raw('case when coalesce(detail.pr_sisa, 0) > 0 then 1 else 0 end as outstanding_count'),
                DB::raw('case when coalesce(detail.pr_sisa, 0) = 0 then 1 else 0 end as realized_count')
            )
            ->where(DB::raw('coalesce(detail.pr_sisa, 0)'), '>', 0)
            ->orderBy('pr.date', 'desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
        ]);
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        $docDateExpr = "coalesce(date(d.pos_tgl), str_to_date(d.pos_tgl, '%Y-%m-%d'), str_to_date(d.pos_tgl, '%Y/%m/%d'), str_to_date(d.pos_tgl, '%d/%m/%Y'), str_to_date(d.pos_tgl, '%d-%m-%Y'), str_to_date(d.pos_tgl, '%d.%m.%Y'))";

        $query = DB::table('tb_pr as pr')
            ->join('tb_do as d', function ($join) {
                $join->on(DB::raw('lower(trim(pr.ref_po))'), '=', DB::raw('lower(trim(d.ref_po))'));
            })
            ->select(
                'pr.no_pr',
                DB::raw('coalesce(d.pos_tgl, pr.date) as date'),
                'pr.for_customer',
                'pr.ref_po',
                'pr.payment',
                DB::raw('0 as outstanding_count'),
                DB::raw('1 as realized_count')
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

        $purchaseRequirements = $query
            ->orderByRaw('coalesce(d.pos_tgl, pr.date) desc')
            ->orderBy('pr.no_pr', 'desc')
            ->get();

        $realizedTotal = DB::table('tb_detailpr')
            ->whereIn('no_pr', $purchaseRequirements->pluck('no_pr'))
            ->sum(DB::raw('coalesce(total_price,0)'));

        return response()->json([
            'purchaseRequirements' => $purchaseRequirements,
            'realizedTotal' => (float) $realizedTotal,
        ]);
    }

    public function create()
    {
        return Inertia::render('marketing/purchase-requirement/create', [
            'materials' => [],
        ]);
    }

    public function materials()
    {
        $materials = DB::table('tb_material')
            ->select(
                'kd_material',
                'material',
                'unit',
                'stok'
            )
            ->orderBy('material')
            ->get();

        return response()->json([
            'materials' => $materials,
        ]);
    }

    public function edit($noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select('no_pr', 'date', 'payment', 'for_customer', 'ref_po')
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->orderBy('no')
            ->get();

        return Inertia::render('marketing/purchase-requirement/edit', [
            'purchaseRequirement' => $purchaseRequirement,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
            'materials' => [],
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
        $prefix = $prefix.'.PR-';

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $maxAttempts = 3;
        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use ($request, $materials, $prefix) {
                    $lastNumber = DB::table('tb_pr')
                        ->where('no_pr', 'like', $prefix.'%')
                        ->orderBy('no_pr', 'desc')
                        ->lockForUpdate()
                        ->value('no_pr');

                    $sequence = 1;
                    if ($lastNumber) {
                        $suffix = substr($lastNumber, strlen($prefix));
                        $sequence = max(1, (int) $suffix + 1);
                    }

                    $noPr = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

                    if (DB::table('tb_pr')->where('no_pr', $noPr)->exists()) {
                        throw new \RuntimeException('duplicate_no_pr');
                    }

                    DB::table('tb_pr')->insert([
                        'no_pr' => $noPr,
                        'date' => $request->input('date'),
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                    ]);

                    foreach ($materials as $index => $item) {
                        DB::table('tb_detailpr')->insert([
                            'date' => $request->input('date'),
                            'payment' => $request->input('payment'),
                            'for_customer' => $request->input('for_customer'),
                            'ref_po' => $request->input('ref_po'),
                            'no' => $item['no'] ?? ($index + 1),
                            'no_pr' => $noPr,
                            'kd_material' => $item['kd_material'] ?? null,
                            'material' => $item['material'] ?? null,
                            'qty' => $item['qty'] ?? null,
                            'unit' => $item['unit'] ?? null,
                            'stok' => $item['stok'] ?? null,
                            'unit_price' => $item['unit_price'] ?? null,
                            'total_price' => $item['total_price'] ?? null,
                            'price_po' => $item['price_po'] ?? null,
                            'margin' => $item['margin'] ?? null,
                            'renmark' => $item['renmark'] ?? null,
                            'qty_po' => 0,
                            'sisa_pr' => $item['qty'] ?? null,
                        ]);
                    }
                });
                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isDuplicate = str_contains($message, 'duplicate_no_pr')
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
            ->route('marketing.purchase-requirement.index')
            ->with('success', 'Data PR berhasil disimpan.');
    }

    public function update(Request $request, $noPr)
    {
        $exists = DB::table('tb_pr')
            ->where('no_pr', $noPr)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPr) {
                DB::table('tb_pr')
                    ->where('no_pr', $noPr)
                    ->update([
                        'date' => $request->input('date'),
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                    ]);

                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->delete();

                foreach ($materials as $index => $item) {
                    DB::table('tb_detailpr')->insert([
                        'date' => $request->input('date'),
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                        'no' => $item['no'] ?? ($index + 1),
                        'no_pr' => $noPr,
                        'kd_material' => $item['kd_material'] ?? null,
                        'material' => $item['material'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'stok' => $item['stok'] ?? null,
                        'unit_price' => $item['unit_price'] ?? null,
                        'total_price' => $item['total_price'] ?? null,
                        'price_po' => $item['price_po'] ?? null,
                        'margin' => $item['margin'] ?? null,
                        'renmark' => $item['renmark'] ?? null,
                        'qty_po' => 0,
                        'sisa_pr' => $item['qty'] ?? null,
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.purchase-requirement.index')
            ->with('success', 'Data PR berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPr, $detailNo)
    {
        $exists = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->exists();

        if (!$exists) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->update([
                'date' => $request->input('date'),
                'payment' => $request->input('payment'),
                'for_customer' => $request->input('for_customer'),
                'ref_po' => $request->input('ref_po'),
                'kd_material' => $request->input('kd_material'),
                'material' => $request->input('material'),
                'qty' => $request->input('qty'),
                'unit' => $request->input('unit'),
                'stok' => $request->input('stok'),
                'unit_price' => $request->input('unit_price'),
                'total_price' => $request->input('total_price'),
                'price_po' => $request->input('price_po'),
                'margin' => $request->input('margin'),
                'renmark' => $request->input('renmark'),
                'sisa_pr' => $request->input('qty'),
            ]);

        return back()->with('success', 'Detail PR berhasil diperbarui.');
    }

    public function destroyDetail($noPr, $detailNo)
    {
        $deleted = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->delete();

        if (!$deleted) {
            return back()->with('error', 'Detail PR tidak ditemukan.');
        }

        return back()->with('success', 'Detail PR berhasil dihapus.');
    }

    public function print(Request $request, $noPr)
    {
        $purchaseRequirement = DB::table('tb_pr')
            ->select(
                'no_pr',
                'date',
                'for_customer',
                'ref_po',
                'payment'
            )
            ->where('no_pr', $noPr)
            ->first();

        if (!$purchaseRequirement) {
            return redirect()
                ->route('marketing.purchase-requirement.index')
                ->with('error', 'Data PR tidak ditemukan.');
        }

        $purchaseRequirementDetails = DB::table('tb_detailpr')
            ->select(
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'stok',
                'unit_price',
                'total_price',
                'renmark'
            )
            ->where('no_pr', $noPr)
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

        return Inertia::render('marketing/purchase-requirement/print', [
            'purchaseRequirement' => $purchaseRequirement,
            'purchaseRequirementDetails' => $purchaseRequirementDetails,
            'company' => $company,
        ]);
    }
}
