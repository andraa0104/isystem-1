<?php

namespace App\Http\Controllers\Inventory;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TransferMaterialController
{
    public function index()
    {
        return Inertia::render('Inventory/transfer-material/index');
    }

    public function misList(Request $request)
    {
        if (!Schema::hasTable('tb_mi')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);
        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        // Source for MIS -> MI transfer is tb_mi rows that still have MIS qty available.
        // We intentionally do NOT filter by inv here because many legacy rows have inv filled
        // but still need to be transferable.
        $base = DB::table('tb_mi')
            ->where('mis', '>', 0);

        // Search by No MI (no_doc) or No PO (ref_po) or Ref PR (ref_pr) or Material
        if ($search !== '') {
            $base->where(function ($q) use ($search) {
                $q->where('no_doc', 'like', '%' . $search . '%')
                    ->orWhere('ref_po', 'like', '%' . $search . '%')
                    ->orWhere('ref_pr', 'like', '%' . $search . '%')
                    ->orWhere('material', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $base)->count();

        $query = (clone $base)
            ->select('no_doc', 'ref_po', 'ref_pr', 'kd_mat', 'material', 'mis', 'harga_mis', 'price', 'unit', 'inv')
            ->orderByDesc('no_doc');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $rows = $query->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

    public function transferMis(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.no_doc' => ['required', 'string'],
            'items.*.kd_mat' => ['required', 'string'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
        ]);

        if (!Schema::hasTable('tb_mi')) {
            throw ValidationException::withMessages(['general' => 'Tabel tb_mi tidak ditemukan.']);
        }

        if (!Schema::hasTable('tb_material')) {
            throw ValidationException::withMessages(['general' => 'Tabel tb_material tidak ditemukan.']);
        }

        try {
            DB::transaction(function () use ($data) {
                foreach ($data['items'] as $item) {
                    $noDoc = (string) $item['no_doc'];
                    $kdMat = (string) $item['kd_mat'];
                    $qty = (float) $item['qty'];

                    $row = DB::table('tb_mi')
                        ->where('no_doc', $noDoc)
                        ->where('kd_mat', $kdMat)
                        ->lockForUpdate()
                        ->first();

                    if (!$row) {
                        throw new \RuntimeException("Data tb_mi tidak ditemukan untuk {$noDoc} / {$kdMat}.");
                    }

                    $available = (float) ($row->mis ?? 0);
                    if ($qty > $available) {
                        throw new \RuntimeException("Qty transfer melebihi MIS tersedia untuk {$noDoc} / {$kdMat}.");
                    }

                    $price = (float) ($row->price ?? 0);
                    $deltaValue = $price * $qty;

                    // Update tb_mi: add to MIU, subtract from MIS, track transfer_mis
                    $update = [];
                    $newMiu = null;
                    $totalQty = is_numeric($row->qty ?? null) ? (float) $row->qty : null;
                    if (Schema::hasColumn('tb_mi', 'miu')) {
                        $newMiu = (float) ($row->miu ?? 0) + $qty;
                        $update['miu'] = $newMiu;
                    }
                    if (Schema::hasColumn('tb_mi', 'harga_miu')) {
                        $update['harga_miu'] = (float) ($row->harga_miu ?? 0) + $deltaValue;
                    }
                    if (Schema::hasColumn('tb_mi', 'mis')) {
                        $update['mis'] = $available - $qty;
                    }
                    if (Schema::hasColumn('tb_mi', 'harga_mis')) {
                        $currentHargaMis = (float) ($row->harga_mis ?? 0);
                        $newMis = $available - $qty;

                        // Keep harga_mis consistent with remaining mis.
                        // When remaining MIS becomes 0 => force harga_mis to 0 (avoid -1 due to rounding).
                        if ($newMis <= 0) {
                            $update['mis'] = 0;
                            $update['harga_mis'] = 0;
                        } else {
                            $unitHargaMis = $available > 0 ? ($currentHargaMis / $available) : $price;
                            // If transferring the full available MIS (or close), consume all value.
                            $deltaHargaMis = $qty >= $available ? $currentHargaMis : ($unitHargaMis * $qty);
                            $newHargaMis = $currentHargaMis - $deltaHargaMis;
                            if ($newHargaMis < 0) {
                                $newHargaMis = 0;
                            }
                            $update['harga_mis'] = $newHargaMis;
                            $update['mis'] = $newMis;
                        }
                    }
                    if (Schema::hasColumn('tb_mi', 'transfer_mis')) {
                        $update['transfer_mis'] = (float) ($row->transfer_mis ?? 0) + $qty;
                    }

                    // Normalize MIB value fields too: if mib is 0 then harga_mib must be 0 (avoid -1).
                    if (Schema::hasColumn('tb_mi', 'mib') && Schema::hasColumn('tb_mi', 'harga_mib')) {
                        $currentMib = (float) ($row->mib ?? 0);
                        $currentHargaMib = (float) ($row->harga_mib ?? 0);
                        if ($currentMib <= 0) {
                            $update['mib'] = 0;
                            $update['harga_mib'] = 0;
                        } elseif ($currentHargaMib < 0) {
                            $update['harga_mib'] = 0;
                        }
                    }

                    if (!empty($update)) {
                        DB::table('tb_mi')
                            ->where('no_doc', $noDoc)
                            ->where('kd_mat', $kdMat)
                            ->update($update);
                    }

                    // Saat qty == miu => ambil No MI lalu update ke tb_detailpo.no_gudang.
                    if (
                        $newMiu !== null
                        && $totalQty !== null
                        && abs($newMiu - $totalQty) < 0.000001
                        && Schema::hasTable('tb_detailpo')
                        && Schema::hasColumn('tb_detailpo', 'no_gudang')
                    ) {
                        $matCol = Schema::hasColumn('tb_detailpo', 'kd_mat')
                            ? 'kd_mat'
                            : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                        if ($matCol) {
                            DB::table('tb_detailpo')
                                ->where('no_po', (string) ($row->ref_po ?? ''))
                                ->where($matCol, $kdMat)
                                ->update(['no_gudang' => $noDoc]);
                        }
                    }

                    // Update stock in tb_material.stok
                    if (Schema::hasColumn('tb_material', 'stok')) {
                        $current = DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->lockForUpdate()
                            ->value('stok');
                        $currentNum = is_numeric($current) ? (float) $current : 0;
                        $newStock = $currentNum + $qty;
                        DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->update(['stok' => $newStock]);
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['general' => $e->getMessage()]);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Berhasil transfer material dari MIS ke MI.',
            ]);
        }

        return redirect()
            ->route('inventory.transfer-material.index')
            ->with('success', 'Berhasil transfer material dari MIS ke MI.');
    }

    public function mibList(Request $request)
    {
        if (!Schema::hasTable('tb_mib')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $hasHeader = Schema::hasTable('tb_kdmib');
        $hasTransfer = Schema::hasColumn('tb_mib', 'transfer');

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);
        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $base = DB::table('tb_mib');
        if ($hasHeader) {
            $base->leftJoin('tb_kdmib', 'tb_kdmib.no_doc', '=', 'tb_mib.no_doc');
        }

        // Show rows where qty - transfer <> 0 (exclude fully transferred).
        if ($hasTransfer) {
            $base->whereRaw('(tb_mib.qty - IFNULL(tb_mib.transfer, 0)) <> 0');
        } else {
            $base->where('tb_mib.qty', '<>', 0);
        }

        if ($search !== '') {
            $base->where(function ($q) use ($search) {
                $q->where('tb_mib.no_doc', 'like', '%' . $search . '%')
                    ->orWhere('tb_mib.material', 'like', '%' . $search . '%');
                if (Schema::hasTable('tb_kdmib')) {
                    $q->orWhere('tb_kdmib.ref_po', 'like', '%' . $search . '%');
                }
            });
        }

        $total = (clone $base)->count('tb_mib.no_doc');

        $select = [
            'tb_mib.no_doc',
            'tb_mib.kd_mat',
            'tb_mib.material',
            'tb_mib.qty',
            'tb_mib.unit',
            'tb_mib.price',
            'tb_mib.total_price',
        ];
        if ($hasHeader) {
            $select[] = DB::raw('tb_kdmib.ref_po as ref_po');
        } else {
            $select[] = DB::raw("'' as ref_po");
        }
        if ($hasTransfer) {
            $select[] = 'tb_mib.transfer';
        } else {
            $select[] = DB::raw('0 as transfer');
        }

        $query = (clone $base)
            ->select($select)
            ->orderByDesc('tb_mib.no_doc');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $rows = $query->get()->map(function ($r) {
            $qty = (float) ($r->qty ?? 0);
            $transfer = (float) ($r->transfer ?? 0);
            $r->remaining = max(0, $qty - $transfer);
            return $r;
        });

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

    public function transferMib(Request $request)
    {
        $data = $request->validate([
            'posting_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.no_mib' => ['required', 'string'],
            'items.*.ref_po' => ['required', 'string'],
            'items.*.kd_mat' => ['required', 'string'],
            'items.*.material' => ['required', 'string'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', 'string'],
            'items.*.price' => ['required'],
        ]);

        if (!Schema::hasTable('tb_mib') || !Schema::hasTable('tb_mi') || !Schema::hasTable('tb_kdmi')) {
            throw ValidationException::withMessages(['general' => 'Tabel tb_mib/tb_mi/tb_kdmi tidak ditemukan.']);
        }

        if (!Schema::hasTable('tb_kdmib')) {
            throw ValidationException::withMessages(['general' => 'Tabel tb_kdmib tidak ditemukan.']);
        }

        if (!Schema::hasTable('tb_detailpo')) {
            throw ValidationException::withMessages(['general' => 'Tabel tb_detailpo tidak ditemukan.']);
        }

        try {
            DB::transaction(function () use ($data) {
                $now = now();
                $postingTgl = $now->format('d.m.Y');

                $matCol = Schema::hasColumn('tb_detailpo', 'kd_mat') ? 'kd_mat' : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$matCol) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                foreach ($data['items'] as $item) {
                    $noMib = (string) $item['no_mib'];
                    $refPo = (string) $item['ref_po'];
                    $kdMat = (string) $item['kd_mat'];
                    $qty = (float) $item['qty'];

                    $src = DB::table('tb_mib')
                        ->where('no_doc', $noMib)
                        ->where('kd_mat', $kdMat)
                        ->lockForUpdate()
                        ->first();
                    if (!$src) {
                        throw new \RuntimeException("Data tb_mib tidak ditemukan untuk {$noMib} / {$kdMat}.");
                    }

                    $srcQty = (float) ($src->qty ?? 0);
                    $srcTransfer = Schema::hasColumn('tb_mib', 'transfer') ? (float) ($src->transfer ?? 0) : 0;
                    $remaining = max(0, $srcQty - $srcTransfer);
                    if ($qty > $remaining) {
                        throw new \RuntimeException("Qty transfer melebihi sisa MIB untuk {$noMib} / {$kdMat}.");
                    }

                    // Update tb_mib.transfer
                    if (Schema::hasColumn('tb_mib', 'transfer')) {
                        DB::table('tb_mib')
                            ->where('no_doc', $noMib)
                            ->where('kd_mat', $kdMat)
                            ->update(['transfer' => $srcTransfer + $qty]);
                    }
                    $remainingAfter = max(0, $srcQty - ($srcTransfer + $qty));

                    // Generate new MI code (MI + 8 digits)
                    $last = DB::table('tb_kdmi')
                        ->select('no_doc')
                        ->where('no_doc', 'like', 'MI%')
                        ->orderByDesc('no_doc')
                        ->lockForUpdate()
                        ->first();

                    $lastNum = 0;
                    if ($last && isset($last->no_doc)) {
                        $digits = preg_replace('/\\D+/', '', (string) $last->no_doc);
                        if ($digits !== '') {
                            $lastNum = (int) $digits;
                        }
                    }
                    $noDoc = 'MI' . str_pad((string) ($lastNum + 1), 8, '0', STR_PAD_LEFT);

                    $refPr = (string) (DB::table('tb_detailpo')->where('no_po', $refPo)->value('ref_pr') ?? '');
                    $vdr = (string) (DB::table('tb_kdmib')->where('no_doc', $noMib)->value('vdr') ?? '');
                    $docTgl = (string) (DB::table('tb_kdmib')->where('no_doc', $noMib)->value('doc_tgl') ?? '');

                    // Insert header to tb_kdmi
                    DB::table('tb_kdmi')->insert([
                        'no_doc' => $noDoc,
                        'ref_po' => $refPo,
                        'ref_pr' => $refPr,
                        'vdr' => $vdr,
                        'doc_tgl' => $docTgl,
                        'posting_tgl' => $postingTgl,
                    ]);

                    $idPo = 0;
                    if (Schema::hasColumn('tb_detailpo', 'id_po')) {
                        $found = DB::table('tb_detailpo')
                            ->where('no_po', $refPo)
                            ->where($matCol, $kdMat)
                            ->value('id_po');
                        $idPo = $found === null ? 0 : $found;
                    }

                    // For tb_mi.qty/price/total_price, use original MIB qty & price (not the transfer qty)
                    $srcPrice = (float) ($src->price ?? 0);
                    $srcQtyForMi = (float) ($src->qty ?? 0);
                    $totalAll = $srcPrice * $srcQtyForMi;

                    // Values based on transfer qty and remaining qty
                    $totalTransfer = $srcPrice * $qty;
                    $hargaMibRemaining = $srcPrice * $remainingAfter;

                    $insert = [
                        'no_doc' => $noDoc,
                        'ref_po' => $refPo,
                        'ref_pr' => $refPr,
                        'vdr' => $vdr,
                        'doc_tgl' => $docTgl,
                        'posting_tgl' => $postingTgl,
                        'no' => 1,
                        'kd_mat' => $kdMat,
                        'material' => (string) $item['material'],
                        'qty' => $srcQtyForMi,
                        'unit' => (string) ($src->unit ?? $item['unit']),
                        'price' => $srcPrice,
                        'total_price' => $totalAll,
                        // Transfer MIB -> MI:
                        // - miu is the transferred qty, harga_miu is transferred value
                        // - mib is remaining qty not transferred, harga_mib is remaining value
                        'miu' => $qty,
                        'harga_miu' => $totalTransfer,
                        'mib' => $remainingAfter,
                        'harga_mib' => $hargaMibRemaining,
                        'id_po' => $idPo,
                        'mis' => 0,
                        'harga_mis' => 0,
                        'inv' => 0,
                    ];

                    // Some schemas use transfer_mib / transfer_mis; keep zero if exists.
                    if (Schema::hasColumn('tb_mi', 'transfer_mis')) {
                        $insert['transfer_mis'] = 0;
                    }
                    if (Schema::hasColumn('tb_mi', 'transfer_mib')) {
                        $insert['transfer_mib'] = $qty;
                    }
                    if (Schema::hasColumn('tb_mi', 'transfer')) {
                        $insert['transfer'] = $qty;
                    }
                    if (Schema::hasColumn('tb_mi', 'transfer_mi')) {
                        $insert['transfer_mi'] = $qty;
                    }

                    $insert = array_filter(
                        $insert,
                        fn ($_, $col) => Schema::hasColumn('tb_mi', $col),
                        ARRAY_FILTER_USE_BOTH
                    );

                    DB::table('tb_mi')->insert($insert);

                    // Saat qty == miu (transfer full) => update tb_detailpo.no_gudang dengan No MI (no_doc).
                    if (
                        Schema::hasColumn('tb_detailpo', 'no_gudang')
                        && abs($remainingAfter) < 0.000001
                    ) {
                        DB::table('tb_detailpo')
                            ->where('no_po', $refPo)
                            ->where($matCol, $kdMat)
                            ->update(['no_gudang' => $noDoc]);
                    }

                    // Update tb_material: stok += qty, harga = price (overwrite, not add)
                    if (Schema::hasTable('tb_material') && Schema::hasColumn('tb_material', 'kd_material')) {
                        $matUpdate = [];
                        if (Schema::hasColumn('tb_material', 'stok')) {
                            $currentStock = DB::table('tb_material')
                                ->where('kd_material', $kdMat)
                                ->lockForUpdate()
                                ->value('stok');
                            $currentStockNum = is_numeric($currentStock) ? (float) $currentStock : 0;
                            $matUpdate['stok'] = $currentStockNum + $qty;
                        }
                        if (Schema::hasColumn('tb_material', 'harga')) {
                            // Overwrite harga with latest buy price from transfer
                            $matUpdate['harga'] = $item['price'];
                        }
                        if (!empty($matUpdate)) {
                            DB::table('tb_material')
                                ->where('kd_material', $kdMat)
                                ->update($matUpdate);
                        }
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['general' => $e->getMessage()]);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Berhasil transfer material dari MIB ke MI.',
            ]);
        }

        return redirect()
            ->route('inventory.transfer-material.index')
            ->with('success', 'Berhasil transfer material dari MIB ke MI.');
    }
}
