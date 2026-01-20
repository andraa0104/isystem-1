<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DeliveryOrderCostController
{
    public function index()
    {
        $deliveryOrders = DB::table('tb_dobi')
            ->select('no_alokasi', 'date', 'ref_permintaan', 'kd_cs', 'status')
            ->groupBy('no_alokasi', 'date', 'ref_permintaan', 'kd_cs', 'status')
            ->orderBy('no_alokasi', 'desc')
            ->get();

        $outstandingCount = DB::table('tb_dobi')
            ->where('status', 0)
            ->distinct('no_alokasi')
            ->count('no_alokasi');

        $outstandingTotal = DB::table('tb_dobi')
            ->where('status', 0)
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        $realizedCount = DB::table('tb_dobi')
            ->where('status', 1)
            ->distinct('no_alokasi')
            ->count('no_alokasi');

        return Inertia::render('marketing/delivery-order-cost/index', [
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
        ]);
    }

    public function create()
    {
        return Inertia::render('marketing/delivery-order-cost/create');
    }

    public function edit(Request $request, $noAlokasi)
    {
        $header = DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->orderBy('no')
            ->first();

        $headerKddobi = DB::table('tb_kddobi')
            ->where('no_alokasi', $noAlokasi)
            ->first();

        if (!$header && !$headerKddobi) {
            return redirect()
                ->route('marketing.delivery-order-cost.index')
                ->with('error', 'Data DO biaya tidak ditemukan.');
        }

        $items = DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->orderBy('no')
            ->get();

        return Inertia::render('marketing/delivery-order-cost/edit', [
            'deliveryOrder' => [
                'no_alokasi' => $header?->no_alokasi ?? $headerKddobi?->no_alokasi,
                'date' => $header?->date ?? $headerKddobi?->date ?? null,
                'ref_permintaan' => $header?->ref_permintaan
                    ?? $headerKddobi?->ref_permintaan
                    ?? null,
                'kd_cs' => $header?->kd_cs ?? $headerKddobi?->kd_cs ?? null,
                'nm_cs' => $header?->nm_cs ?? $headerKddobi?->nm_cs ?? null,
            ],
            'items' => $items,
        ]);
    }

    public function details(Request $request)
    {
        $noAlokasi = $request->query('no_alokasi');
        if (!$noAlokasi) {
            return response()->json([
                'details' => [],
                'header' => null,
            ]);
        }

        $details = DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->orderBy('no')
            ->get();

        $header = $details->first();

        return response()->json([
            'details' => $details,
            'header' => $header ? [
                'no_alokasi' => $header->no_alokasi,
                'date' => $header->date,
                'pos_tgl' => $header->pos_tgl,
                'ref_permintaan' => $header->ref_permintaan,
                'kd_cs' => $header->kd_cs,
                'nm_cs' => $header->nm_cs,
            ] : null,
        ]);
    }

    public function outstanding()
    {
        $deliveryOrders = DB::table('tb_dobi')
            ->select('no_alokasi', 'date', 'ref_permintaan', 'kd_cs', 'status')
            ->where('status', 0)
            ->groupBy('no_alokasi', 'date', 'ref_permintaan', 'kd_cs', 'status')
            ->orderBy('date', 'desc')
            ->orderBy('no_alokasi', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function materials(Request $request)
    {
        $search = $request->input('search');
        $perPageInput = $request->input('per_page', 5);
        $perPage = $perPageInput === 'all'
            ? null
            : (is_numeric($perPageInput) ? (int) $perPageInput : 5);
        if ($perPage !== null && $perPage < 1) {
            $perPage = 5;
        }

        $query = DB::table('tb_material')
            ->select('kd_material', 'material', 'unit', 'remark', 'harga')
            ->orderBy('material');

        if ($search) {
            $query->where('material', 'like', "%{$search}%");
        }

        if ($perPage === null) {
            $items = $query->get();
            return response()->json([
                'data' => $items,
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 'all',
                'total' => $items->count(),
            ]);
        }

        $items = $query->paginate($perPage);

        return response()->json($items);
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
        $prefix = $prefix.'.DOB-';

        $lastNumber = DB::table('tb_dobi')
            ->where('no_alokasi', 'like', $prefix.'%')
            ->orderBy('no_alokasi', 'desc')
            ->value('no_alokasi');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noAlokasi = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

        $items = $request->input('items', []);
        if (!is_array($items)) {
            $items = [];
        }

        try {
            DB::transaction(function () use ($request, $items, $noAlokasi) {
                DB::table('tb_kddobi')->insert([
                    'no_alokasi' => $noAlokasi,
                    'date' => $request->input('date'),
                    'pos_tgl' => now()->toDateString(),
                    'ref_permintaan' => $request->input('ref_permintaan'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                foreach ($items as $index => $item) {
                    DB::table('tb_dobi')->insert([
                        'no_alokasi' => $noAlokasi,
                        'date' => $request->input('date'),
                        'pos_tgl' => now()->toDateString(),
                        'ref_permintaan' => $request->input('ref_permintaan'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'kd_mat' => $item['kd_mat'] ?? null,
                        'mat' => $item['mat'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                        'harga' => $item['harga'] ?? null,
                        'total' => $item['total'] ?? null,
                        'status' => 0,
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.delivery-order-cost.index')
            ->with('success', 'Data DO biaya berhasil disimpan.');
    }

    public function storeDetail(Request $request, $noAlokasi)
    {
        $itemsMax = DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->max('no');
        $nextNo = ($itemsMax ? (int) $itemsMax : 0) + 1;

        $qty = $request->input('qty');
        $harga = $request->input('harga');
        $total = $request->input('total');
        $remarkInput = $request->input('remark');
        $remarkValue = $remarkInput === null ? ' ' : $remarkInput;

        DB::table('tb_dobi')->insert([
            'no_alokasi' => $noAlokasi,
            'date' => $request->input('date'),
            'pos_tgl' => now()->toDateString(),
            'ref_permintaan' => $request->input('ref_permintaan'),
            'kd_cs' => $request->input('kd_cs'),
            'nm_cs' => $request->input('nm_cs'),
            'no' => $nextNo,
            'kd_mat' => $request->input('kd_mat'),
            'mat' => $request->input('mat'),
            'qty' => $qty,
            'unit' => $request->input('unit'),
            'remark' => $remarkValue,
            'harga' => $harga,
            'total' => $total,
            'status' => 0,
        ]);

        return response()->json([
            'item' => [
                'no' => $nextNo,
                'kd_mat' => $request->input('kd_mat'),
                'mat' => $request->input('mat'),
                'qty' => $qty,
                'unit' => $request->input('unit'),
                'remark' => $remarkValue,
                'harga' => $harga,
                'total' => $total,
            ],
        ]);
    }

    public function updateDetail(Request $request, $noAlokasi, $lineNo)
    {
        $row = DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            return response()->json(['error' => 'Data tidak ditemukan.'], 404);
        }

        $qty = $request->input('qty');
        $harga = $request->input('harga');
        $total = $request->input('total');
        $remarkInput = $request->input('remark');
        $remarkValue = $remarkInput === null ? ' ' : $remarkInput;

        DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->where('no', $lineNo)
            ->update([
                'qty' => $qty,
                'harga' => $harga,
                'total' => $total,
                'remark' => $remarkValue,
            ]);

        return response()->json([
            'item' => [
                'no' => $lineNo,
                'qty' => $qty,
                'harga' => $harga,
                'total' => $total,
                'remark' => $remarkValue,
            ],
        ]);
    }

    public function deleteDetail(Request $request, $noAlokasi, $lineNo)
    {
        DB::table('tb_dobi')
            ->where('no_alokasi', $noAlokasi)
            ->where('no', $lineNo)
            ->delete();

        return response()->json(['status' => 'ok']);
    }

    public function updateHeader(Request $request, $noAlokasi)
    {
        $payload = [
            'date' => $request->input('date'),
            'ref_permintaan' => $request->input('ref_permintaan'),
            'kd_cs' => $request->input('kd_cs'),
            'nm_cs' => $request->input('nm_cs'),
        ];

        try {
            DB::transaction(function () use ($noAlokasi, $payload) {
                DB::table('tb_kddobi')
                    ->where('no_alokasi', $noAlokasi)
                    ->update($payload);

                DB::table('tb_dobi')
                    ->where('no_alokasi', $noAlokasi)
                    ->update($payload);
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Data DO biaya berhasil diperbarui.');
    }
}
