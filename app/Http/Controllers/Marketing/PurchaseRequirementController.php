<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Carbon\Carbon;

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
                DB::raw('case when coalesce(detail.pr_sisa, 0) = 0 then 1 else 0 end as realized_count'),
                DB::raw('case when exists (select 1 from tb_po where lower(trim(tb_po.ref_pr)) = lower(trim(pr.no_pr))) then 0 else 1 end as can_delete')
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

        // Backward compatible: if per_page is not provided, return full dataset.
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

        $timestamp = now()->format('m/d/Y h:i:s A');
        $dateFormatted = null;
        try {
            $parsedDate = $request->input('date')
                ? Carbon::parse($request->input('date'))
                : null;
            $dateFormatted = $parsedDate ? $parsedDate->format('d.m.Y') : $request->input('date');
        } catch (\Throwable $e) {
            $dateFormatted = $request->input('date');
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPr, $timestamp, $dateFormatted) {
                DB::table('tb_pr')
                    ->where('no_pr', $noPr)
                    ->update([
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                    ]);

                DB::table('tb_detailpr')
                    ->where('no_pr', $noPr)
                    ->delete();

                foreach ($materials as $index => $item) {
                    $noValue = $item['no'] ?? ($index + 1);
                    DB::table('tb_detailpr')->insert([
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'for_customer' => $request->input('for_customer'),
                        'ref_po' => $request->input('ref_po'),
                        'no' => $noValue,
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

                    DB::table('tb_ubah')->insert([
                        'no_pr' => $noPr,
                        'date' => $dateFormatted,
                        'payment' => $request->input('payment'),
                        'ref_po' => $request->input('ref_po'),
                        'no' => $noValue,
                        'id' => $noValue,
                        'for_customer' => $request->input('for_customer'),
                        'kd_material' => $item['kd_material'] ?? null,
                        'material' => $item['material'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'qty_po' => $item['qty'] ?? null,
                        'sisa_pr' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'stok' => $item['stok'] ?? null,
                        'unit_price' => $item['unit_price'] ?? null,
                        'total_price' => $item['total_price'] ?? null,
                        'price_po' => $item['price_po'] ?? null,
                        'margin' => $item['margin'] ?? null,
                        'renmark' => $item['renmark'] ?? null,
                        'tgl_ubah' => $timestamp,
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

        $timestamp = now()->format('m/d/Y h:i:s A');
        try {
            $parsedDate = $request->input('date')
                ? Carbon::parse($request->input('date'))
                : null;
            $dateFormatted = $parsedDate
                ? $parsedDate->format('d.m.Y')
                : $request->input('date');
        } catch (\Throwable $e) {
            $dateFormatted = $request->input('date');
        }

        DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->where('no', $detailNo)
            ->update([
                'date' => $dateFormatted,
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

        DB::table('tb_ubah')->insert([
            'no_pr' => $noPr,
            'date' => $dateFormatted,
            'payment' => $request->input('payment'),
            'ref_po' => $request->input('ref_po'),
            'no' => $detailNo,
            'id' => $detailNo,
            'for_customer' => $request->input('for_customer'),
            'kd_material' => $request->input('kd_material'),
            'material' => $request->input('material'),
            'qty' => $request->input('qty'),
            'qty_po' => $request->input('qty'),
            'sisa_pr' => $request->input('qty'),
            'unit' => $request->input('unit'),
            'stok' => $request->input('stok'),
            'unit_price' => $request->input('unit_price'),
            'total_price' => $request->input('total_price'),
            'price_po' => $request->input('price_po'),
            'margin' => $request->input('margin'),
            'renmark' => $request->input('renmark'),
            'tgl_ubah' => $timestamp,
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

    public function destroy($noPr)
    {
        $noPr = trim((string) $noPr);
        if ($noPr === '') {
            return response()->json([
                'message' => 'No PR tidak valid.',
            ], 400);
        }

        $isUsedInPo = DB::table('tb_po')
            ->whereRaw('lower(trim(ref_pr)) = ?', [strtolower($noPr)])
            ->exists();

        if ($isUsedInPo) {
            return response()->json([
                'message' => 'PR sudah terpakai di PO, tidak dapat dihapus.',
            ], 400);
        }

        $details = DB::table('tb_detailpr')
            ->where('no_pr', $noPr)
            ->get([
                'no_pr',
                'date',
                'payment',
                'for_customer',
                'ref_po',
                'no',
                'kd_material',
                'material',
                'qty',
                'unit',
                'stok',
                'unit_price',
                'total_price',
                'price_po',
                'margin',
                'renmark',
                'qty_po',
                'sisa_pr',
                'id',
            ]);

        $timestamp = now()->format('m/d/Y h:i:s A');

        $truncate = function ($value, $length) {
            $string = is_null($value) ? '' : (string) $value;
            return Str::limit($string, $length, '');
        };

        DB::transaction(function () use ($details, $noPr, $timestamp, $truncate) {
            if ($details->isNotEmpty()) {
                $payload = $details->map(function ($row) use ($timestamp, $truncate) {
                    return [
                        'no_pr' => $truncate($row->no_pr, 50),
                        'date' => $truncate($row->date, 50),
                        'payment' => $truncate($row->payment, 100),
                        'for_customer' => $truncate($row->for_customer, 191),
                        'ref_po' => $truncate($row->ref_po, 100),
                        'no' => $row->no,
                        'kd_material' => $truncate($row->kd_material, 100),
                        'material' => $truncate($row->material, 191),
                        'qty' => $row->qty,
                        'unit' => $row->unit,
                        'stok' => $row->stok,
                        'unit_price' => $row->unit_price,
                        'total_price' => $row->total_price,
                        'price_po' => $row->price_po,
                        'margin' => $truncate($row->margin, 50),
                        'renmark' => $truncate($row->renmark, 191),
                        'qty_po' => $row->qty_po,
                        'sisa_pr' => $row->sisa_pr,
                        'id' => $row->id,
                        'tgl_hapus' => $timestamp,
                    ];
                })->all();

                DB::table('tb_hapus')->insert($payload);
            }

            DB::table('tb_detailpr')->where('no_pr', $noPr)->delete();
            DB::table('tb_pr')->where('no_pr', $noPr)->delete();
        });

        return response()->json([
            'message' => 'Data PR berhasil dihapus.',
        ]);
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
        $lookupKey = is_string($database) ? strtolower($database) : '';
        // normalize prefixes like "DBSJA" or "dbsja" or "DB.SJA"
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja'; // default company if tenant cookie/session missing
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
