<?php

namespace App\Http\Controllers\Inventory;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Validation\ValidationException;

class PenerimaanMaterialController
{
    public function index()
    {
        return Inertia::render('inventory/penerimaan-material/index');
    }

    public function poList(Request $request)
    {
        if (!Schema::hasTable('tb_detailpo')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        // New rule: show PO only when there are detail rows whose no_gudang does NOT contain "MI".
        // This indicates material has not been received into MI yet.
        if (!Schema::hasColumn('tb_detailpo', 'no_gudang')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $base = DB::table('tb_detailpo')
            ->where('gr_mat', '<>', 0);

        if ($search !== '') {
            $base->where(function ($q) use ($search) {
                $q->where('no_po', 'like', '%' . $search . '%')
                    ->orWhere('ref_pr', 'like', '%' . $search . '%')
                    ->orWhere('nm_vdr', 'like', '%' . $search . '%');
            });
        }

        // Total distinct PO rows.
        $total = (clone $base)->distinct('no_po')->count('no_po');

        $query = (clone $base)
            ->select('no_po', 'ref_pr', 'nm_vdr')
            ->groupBy('no_po', 'ref_pr', 'nm_vdr')
            ->orderByDesc('no_po');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $rows = $query->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

    public function poMaterials(Request $request)
    {
        $noPo = trim((string) $request->query('no_po', ''));
        if ($noPo === '' || !Schema::hasTable('tb_detailpo')) {
            return response()->json(['rows' => []]);
        }

        if (!Schema::hasColumn('tb_detailpo', 'no_gudang')) {
            return response()->json(['rows' => []]);
        }

        $query = DB::table('tb_detailpo')
            ->leftJoin('tb_material', 'tb_material.kd_material', '=', 'tb_detailpo.kd_mat')
            ->where('tb_detailpo.no_po', $noPo)
            ->where('tb_detailpo.gr_mat', '<>', 0)
            ->select(
                'tb_detailpo.kd_mat',
                'tb_detailpo.material',
                'tb_detailpo.qty',
                'tb_detailpo.gr_mat',
                'tb_detailpo.unit',
                'tb_detailpo.price',
                'tb_detailpo.no_gudang',
                'tb_material.stok as last_stock',
                'tb_material.harga as last_price'
            )
            ->orderBy('tb_detailpo.kd_mat');

        $rows = $query->get();

        return response()->json(['rows' => $rows]);
    }

    public function storeMi(Request $request)
    {
        $data = $request->validate([
            'doc_date' => ['required', 'date'],
            'no_po' => ['required', 'string'],
            'ref_pr' => ['nullable', 'string'],
            'vendor' => ['nullable', 'string'],
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.kd_mat' => ['required', 'string'],
            'rows.*.material' => ['required', 'string'],
            'rows.*.qty' => ['required', 'numeric'],
            'rows.*.unit' => ['required', 'string'],
            'rows.*.price' => ['required'],
            'rows.*.total_price' => ['required', 'numeric'],
        ]);

        if (!Schema::hasTable('tb_mi') || !Schema::hasTable('tb_kdmi')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_mi / tb_kdmi tidak ditemukan.',
            ]);
        }

        if (!Schema::hasTable('tb_detailpo')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_detailpo tidak ditemukan.',
            ]);
        }

        if (!Schema::hasTable('tb_material')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_material tidak ditemukan.',
            ]);
        }

        try {
            DB::transaction(function () use ($data) {
                $now = now();
                $docTgl = \Carbon\Carbon::parse($data['doc_date'])->format('d.m.Y');
                $postingTgl = $now->format('d.m.Y');

                // Generate MI code: MI + 8 digits (last + 1)
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

                // Header insert to tb_kdmi
                DB::table('tb_kdmi')->insert([
                    'no_doc' => $noDoc,
                    'ref_pr' => $data['no_po'],
                    'ref_po' => $data['ref_pr'] ?? '',
                    'vdr' => $data['vendor'] ?? '',
                    'doc_tgl' => $docTgl,
                    'posting_tgl' => $postingTgl,
                ]);

                // Stock column is `stok` (tb_stok doesn't exist in this DB).
                $stockColumn = Schema::hasColumn('tb_material', 'stok') ? 'stok' : null;
                $priceColumn = Schema::hasColumn('tb_material', 'harga') ? 'harga' : null;
                $stockCol = Schema::hasColumn('tb_material', 'stok') ? 'stok' : null;

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                $kdMaterials = array_unique(array_column($data['rows'], 'kd_mat'));

                // Bulk fetch PO details
                $poDetails = DB::table('tb_detailpo')
                    ->where('no_po', $data['no_po'])
                    ->whereIn($detailMatColumn, $kdMaterials)
                    ->get()
                    ->mapWithKeys(fn($item) => [strtolower($item->{$detailMatColumn}) => $item]);

                // Bulk fetch Materials
                $materials = $stockColumn || $priceColumn
                    ? DB::table('tb_material')
                        ->whereIn('kd_material', $kdMaterials)
                        ->get()
                        ->mapWithKeys(fn($item) => [strtolower($item->kd_material) => $item])
                    : collect();

                // Bulk fetch Existing MI records for Upsert logic
                $existingMis = DB::table('tb_mi')
                    ->where('ref_po', $data['no_po'])
                    ->where('inv', 0)
                    ->get()
                    ->groupBy(fn($item) => strtolower($item->kd_mat));

                // Determine noDoc: use existing if available, else generate new
                $noDoc = null;
                foreach ($existingMis as $group) {
                    if ($group->first()->no_doc) {
                        $noDoc = $group->first()->no_doc;
                        break;
                    }
                }

                // If not found in materials, check the header table directly (tb_kdmi)
                if (!$noDoc) {
                    $existingHeader = DB::table("tb_kdmi")
                        ->where("ref_pr", $data["no_po"]) // PO number in tb_kdmi.ref_pr
                        ->first();

                    if ($existingHeader) {
                        // Safeguard: Reuse only if NO items for this header are invoiced
                        $anyInvoiced = DB::table("tb_mi")
                            ->where("no_doc", $existingHeader->no_doc)
                            ->where("inv", 1)
                            ->exists();

                        if (!$anyInvoiced) {
                            $noDoc = $existingHeader->no_doc;
                        }
                    }
                }

                if (!$noDoc) {
                    // Generate new MI code
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

                    // Header insert to tb_kdmi
                    DB::table('tb_kdmi')->insert([
                        'no_doc' => $noDoc,
                        'ref_pr' => $data['no_po'],
                        'ref_po' => $data['ref_pr'] ?? '',
                        'vdr' => $data['vendor'] ?? '',
                        'doc_tgl' => $docTgl,
                        'posting_tgl' => $postingTgl,
                    ]);
                }

                $miInserts = [];

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];
                    $kdMatLower = strtolower($kdMat);
                    $qtyNum = is_numeric($row['qty']) ? (float) $row['qty'] : 0.0;
                    $totalPrice = is_numeric($row['total_price']) ? (float) $row['total_price'] : 0.0;

                    $poDetail = $poDetails->get($kdMatLower);
                    $idPo = $poDetail->id_po ?? 0;

                    // Check for existing record for UPSERT
                    $existingMiSet = $existingMis->get($kdMatLower);
                    $existingMi = $existingMiSet ? $existingMiSet->first() : null;

                    if ($existingMi) {
                        // Update existing tb_mi: Increment quantities and prices
                        $newQtyTotal = (float)($existingMi->qty ?? 0) + $qtyNum;
                        $newMiuTotal = (float)($existingMi->miu ?? 0) + $qtyNum;
                        $newPriceTotal = (float)($existingMi->total_price ?? 0) + $totalPrice;
                        $newHargaMiuTotal = (float)($existingMi->harga_miu ?? 0) + $totalPrice;

                        DB::table('tb_mi')
                            ->where('no_doc', $existingMi->no_doc)
                            ->where('kd_mat', $existingMi->kd_mat)
                            ->update([
                                'qty' => $newQtyTotal,
                                'miu' => $newMiuTotal,
                                'total_price' => $newPriceTotal,
                                'harga_miu' => $newHargaMiuTotal,
                                'price' => $row['price'], // Update to latest price
                                'doc_tgl' => $docTgl,
                                'posting_tgl' => $postingTgl,
                            ]);
                    } else {
                        // Prepare insert for tb_mi
                        $miInserts[] = [
                            'no_doc' => $noDoc,
                            'ref_po' => $data['no_po'],
                            'ref_pr' => $data['ref_pr'] ?? '',
                            'vdr' => $data['vendor'] ?? '',
                            'doc_tgl' => $docTgl,
                            'posting_tgl' => $postingTgl,
                            'no' => $no,
                            'kd_mat' => $kdMat,
                            'material' => (string) $row['material'],
                            'qty' => $row['qty'],
                            'unit' => (string) $row['unit'],
                            'price' => $row['price'],
                            'total_price' => $row['total_price'],
                            'id_po' => $idPo,
                            'miu' => $row['qty'],
                            'harga_miu' => $row['total_price'],
                            'mis' => 0,
                            'harga_mis' => 0,
                            'mib' => 0,
                            'harga_mib' => 0,
                            'transfer_mis' => 0,
                            'transfer_mib' => 0,
                            'inv' => 0,
                        ];
                    }

                    // PO Detail Tracking: correct remaining balance
                    $newGrMat = (float)($poDetail->gr_mat ?? 0) - $qtyNum;
                    $newGrPrice = (float)($poDetail->gr_price ?? 0) - $totalPrice;
                    $newEndGr = (float)($poDetail->end_gr ?? 0) + $qtyNum;
                    $newIrMat = (float)($poDetail->ir_mat ?? 0) + $qtyNum;
                    $newIrPrice = (float)($poDetail->ir_price ?? 0) + $totalPrice;

                    DB::table('tb_detailpo')
                        ->where('no_po', $data['no_po'])
                        ->where($detailMatColumn, $kdMat)
                        ->update([
                            'gr_mat' => $newGrMat,
                            'gr_price' => $newGrPrice,
                            'end_gr' => $newEndGr,
                            'ir_mat' => $newIrMat,
                            'ir_price' => $newIrPrice,
                            'no_gudang' => $noDoc, // Warehouse Tracking
                        ]);

                    // Update Material stock
                    if ($stockColumn || $priceColumn) {
                        $material = $materials->get($kdMatLower);
                        if ($material) {
                            $updateData = [];
                            if ($stockColumn) {
                                $currentStockNum = is_numeric($material->{$stockColumn}) ? (float) $material->{$stockColumn} : 0;
                                $newStock = $currentStockNum + $qtyNum;
                                $updateData[$stockColumn] = $newStock;
                                $updateData['rest_stock'] = $newStock; // Sync rest_stock
                            }
                            if ($priceColumn) {
                                $updateData[$priceColumn] = $row['price'];
                            }

                            DB::table('tb_material')->where('kd_material', $kdMat)->update($updateData);
                        }
                    }
                }

                // Execute Batch Inserts
                if (!empty($miInserts)) {
                    foreach (array_chunk($miInserts, 100) as $chunk) {
                        DB::table('tb_mi')->insert($chunk);
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'general' => $e->getMessage(),
            ]);
        }

        return redirect()
            ->route('inventory.penerimaan-material.index')
            ->with('success', 'Berhasil menyimpan data MI.');
    }

    public function storeMis(Request $request)
    {
        $data = $request->validate([
            'doc_date' => ['required', 'date'],
            'no_po' => ['required', 'string'],
            'ref_pr' => ['nullable', 'string'],
            'vendor' => ['nullable', 'string'],
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.kd_mat' => ['required', 'string'],
            'rows.*.material' => ['required', 'string'],
            'rows.*.qty' => ['required', 'numeric'],
            'rows.*.unit' => ['required', 'string'],
            'rows.*.price' => ['required'],
            'rows.*.total_price' => ['required', 'numeric'],
        ]);

        if (!Schema::hasTable('tb_mi') || !Schema::hasTable('tb_kdmi')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_mi / tb_kdmi tidak ditemukan.',
            ]);
        }

        if (!Schema::hasTable('tb_detailpo')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_detailpo tidak ditemukan.',
            ]);
        }

        if (!Schema::hasTable('tb_material')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_material tidak ditemukan.',
            ]);
        }

        try {
            DB::transaction(function () use ($data) {
                $now = now();
                $docTgl = \Carbon\Carbon::parse($data['doc_date'])->format('d.m.Y');
                $postingTgl = $now->format('d.m.Y');

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                $priceColumn = Schema::hasColumn('tb_material', 'harga') ? 'harga' : null;
                $stockCol = Schema::hasColumn('tb_material', 'stok') ? 'stok' : null;

                $kdMaterials = array_unique(array_column($data['rows'], 'kd_mat'));

                // Bulk fetch PO details for id_po
                $poDetails = DB::table('tb_detailpo')
                    ->where('no_po', $data['no_po'])
                    ->whereIn($detailMatColumn, $kdMaterials)
                    ->get()
                    ->mapWithKeys(fn($item) => [strtolower($item->{$detailMatColumn}) => $item]);

                // Bulk fetch Materials for stock update
                $materials = DB::table('tb_material')
                    ->whereIn('kd_material', $kdMaterials)
                    ->get()
                    ->mapWithKeys(fn($item) => [strtolower($item->kd_material) => $item]);

                // Bulk fetch Existing MI records for Upsert logic
                $existingMis = DB::table('tb_mi')
                    ->where('ref_po', $data['no_po'])
                    ->where('inv', 0)
                    ->get()
                    ->groupBy(fn($item) => strtolower($item->kd_mat));

                // Determine noDoc: use existing if available, else generate new
                $noDoc = null;
                foreach ($existingMis as $group) {
                    if ($group->first()->no_doc) {
                        $noDoc = $group->first()->no_doc;
                        break;
                    }
                }

                // If not found in materials, check the header table directly (tb_kdmi)
                if (!$noDoc) {
                    $existingHeader = DB::table("tb_kdmi")
                        ->where("ref_pr", $data["no_po"]) // PO number in tb_kdmi.ref_pr
                        ->first();

                    if ($existingHeader) {
                        // Safeguard: Reuse only if NO items for this header are invoiced
                        $anyInvoiced = DB::table("tb_mi")
                            ->where("no_doc", $existingHeader->no_doc)
                            ->where("inv", 1)
                            ->exists();

                        if (!$anyInvoiced) {
                            $noDoc = $existingHeader->no_doc;
                        }
                    }
                }

                if (!$noDoc) {
                    // Generate new MI code
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

                    // Header insert to tb_kdmi
                    DB::table('tb_kdmi')->insert([
                        'no_doc' => $noDoc,
                        'ref_pr' => $data['no_po'],
                        'ref_po' => $data['ref_pr'] ?? '',
                        'vdr' => $data['vendor'] ?? '',
                        'doc_tgl' => $docTgl,
                        'posting_tgl' => $postingTgl,
                    ]);
                }

                $miInserts = [];

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];
                    $kdMatLower = strtolower($kdMat);
                    $qtyNum = is_numeric($row['qty']) ? (float) $row['qty'] : 0.0;
                    $totalPrice = is_numeric($row['total_price']) ? (float) $row['total_price'] : 0.0;

                    $poDetail = $poDetails->get($kdMatLower);
                    $idPo = $poDetail->id_po ?? 0;

                    // Check for existing record for UPSERT
                    $existingMiSet = $existingMis->get($kdMatLower);
                    $existingMi = $existingMiSet ? $existingMiSet->first() : null;

                    if ($existingMi) {
                        // Update existing tb_mi (MIS): Increment qty and mis
                        $newQtyTotal = (float)($existingMi->qty ?? 0) + $qtyNum;
                        $newMisTotal = (float)($existingMi->mis ?? 0) + $qtyNum;
                        $newPriceTotal = (float)($existingMi->total_price ?? 0) + $totalPrice;
                        $newHargaMisTotal = (float)($existingMi->harga_mis ?? 0) + $totalPrice;

                        DB::table('tb_mi')
                            ->where('no_doc', $existingMi->no_doc)
                            ->where('kd_mat', $existingMi->kd_mat)
                            ->update([
                                'qty' => $newQtyTotal,
                                'mis' => $newMisTotal,
                                'total_price' => $newPriceTotal,
                                'harga_mis' => $newHargaMisTotal,
                                'price' => $row['price'],
                                'doc_tgl' => $docTgl,
                                'posting_tgl' => $postingTgl,
                            ]);
                    } else {
                        // Prepare insert for tb_mi
                        $miInserts[] = [
                            'no_doc' => $noDoc,
                            'ref_po' => $data['no_po'],
                            'ref_pr' => $data['ref_pr'] ?? '',
                            'vdr' => $data['vendor'] ?? '',
                            'doc_tgl' => $docTgl,
                            'posting_tgl' => $postingTgl,
                            'no' => $no,
                            'kd_mat' => $kdMat,
                            'material' => (string) $row['material'],
                            'qty' => $row['qty'],
                            'mis' => $row['qty'],
                            'unit' => (string) $row['unit'],
                            'price' => $row['price'],
                            'total_price' => $row['total_price'],
                            'harga_mis' => $row['total_price'],
                            'id_po' => $idPo,
                            'miu' => 0,
                            'harga_miu' => 0,
                            'mib' => 0,
                            'harga_mib' => 0,
                            'transfer_mis' => 0,
                            'transfer_mib' => 0,
                            'inv' => 0,
                        ];
                    }

                    // Warehouse Tracking for MIS
                    if ($poDetail) {
                        DB::table('tb_detailpo')
                            ->where('no_po', $data['no_po'])
                            ->where($detailMatColumn, $kdMat)
                            ->update(['no_gudang' => $noDoc]);
                    }

                    // Update stock and rest_stock and last price in tb_material
                    $material = $materials->get($kdMatLower);
                    if ($material) {
                        $updateData = [];
                        if ($priceColumn) {
                            $updateData[$priceColumn] = $row['price'];
                        }

                        // Sync stok and rest_stock
                        if ($stockCol) {
                            $currentStockNum = is_numeric($material->{$stockCol}) ? (float) $material->{$stockCol} : 0;
                            $newStock = $currentStockNum + $qtyNum;
                            $updateData[$stockCol] = $newStock;
                            $updateData['rest_stock'] = $newStock;
                        }

                        if (!empty($updateData)) {
                            DB::table('tb_material')->where('kd_material', $kdMat)->update($updateData);
                        }
                    }
                }

                // Batch insert MI details
                if (!empty($miInserts)) {
                    foreach (array_chunk($miInserts, 100) as $chunk) {
                        DB::table('tb_mi')->insert($chunk);
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'general' => $e->getMessage(),
            ]);
        }

        return redirect()
            ->route('inventory.penerimaan-material.index')
            ->with('success', 'Berhasil menyimpan data MIS.');
    }

    public function storeMib(Request $request)
    {
        $data = $request->validate([
            'doc_date' => ['required', 'date'],
            'no_po' => ['required', 'string'],
            'ref_pr' => ['nullable', 'string'],
            'vendor' => ['nullable', 'string'],
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.kd_mat' => ['required', 'string'],
            'rows.*.material' => ['required', 'string'],
            'rows.*.qty' => ['required', 'numeric'],
            'rows.*.unit' => ['required', 'string'],
            'rows.*.price' => ['required'],
            'rows.*.total_price' => ['required', 'numeric'],
            'rows.*.remark' => ['nullable', 'string'],
        ]);

        if (!Schema::hasTable('tb_mib') || !Schema::hasTable('tb_kdmib')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_mib / tb_kdmib tidak ditemukan.',
            ]);
        }

        if (!Schema::hasTable('tb_detailpo')) {
            throw ValidationException::withMessages([
                'general' => 'Tabel tb_detailpo tidak ditemukan.',
            ]);
        }

        try {
            DB::transaction(function () use ($data) {
                $now = now();
                $docTgl = \Carbon\Carbon::parse($data['doc_date'])->format('d.m.Y');
                $postingTgl = $now->format('d.m.Y');

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                $kdMaterials = array_unique(array_column($data['rows'], 'kd_mat'));

                // Bulk fetch PO details
                $poDetails = DB::table('tb_detailpo')
                    ->where('no_po', $data['no_po'])
                    ->whereIn($detailMatColumn, $kdMaterials)
                    ->get()
                    ->mapWithKeys(fn($item) => [strtolower($item->{$detailMatColumn}) => $item]);

                // Bulk fetch Existing MIB records for Upsert logic
                // Join with tb_kdmib to verify ref_po
                $existingMibs = DB::table('tb_mib')
                    ->join('tb_kdmib', 'tb_kdmib.no_doc', '=', 'tb_mib.no_doc')
                    ->where('tb_kdmib.ref_po', $data['no_po'])
                    ->select('tb_mib.*')
                    ->get()
                    ->groupBy(fn($item) => strtolower($item->kd_mat));

                // Determine noDoc: use existing if available, else generate new
                $noDoc = null;
                foreach ($existingMibs as $group) {
                    if ($group->first()->no_doc) {
                        $noDoc = $group->first()->no_doc;
                        break;
                    }
                }

                // If not found in materials, check the header table directly (tb_kdmib)
                if (!$noDoc) {
                    $existingHeader = DB::table('tb_kdmib')
                        ->where('ref_po', $data['no_po'])
                        ->first();
                    if ($existingHeader) {
                        $noDoc = $existingHeader->no_doc;
                    }
                }

                if (!$noDoc) {
                    // Generate new MIB code: MIB + 7 digits (last + 1)
                    $last = DB::table('tb_kdmib')
                        ->select('no_doc')
                        ->where('no_doc', 'like', 'MIB%')
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
                    $noDoc = 'MIB' . str_pad((string) ($lastNum + 1), 7, '0', STR_PAD_LEFT);

                    // Header insert to tb_kdmib
                    $header = [
                        'no_doc' => $noDoc,
                        'ref_po' => $data['no_po'],
                        'ref_pr' => $data['ref_pr'] ?? '',
                        'vdr' => $data['vendor'] ?? '',
                        'doc_tgl' => $docTgl,
                        'posting_tgl' => $postingTgl,
                    ];
                    // Only keep columns that exist.
                    $header = array_filter(
                        $header,
                        fn ($_, $col) => Schema::hasColumn('tb_kdmib', $col),
                        ARRAY_FILTER_USE_BOTH
                    );
                    DB::table('tb_kdmib')->insert($header);
                }

                // Move schema checks outside loop
                $hasMis = Schema::hasColumn('tb_mib', 'mis');
                $hasHargaMis = Schema::hasColumn('tb_mib', 'harga_mis');
                $mibColumns = Schema::getColumnListing('tb_mib');

                $mibInserts = [];

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];
                    $kdMatLower = strtolower($kdMat);
                    $qtyNum = is_numeric($row['qty']) ? (float) $row['qty'] : 0.0;
                    $totalPrice = is_numeric($row['total_price']) ? (float) $row['total_price'] : 0.0;

                    $poDetail = $poDetails->get($kdMatLower);
                    $idPo = $poDetail->id_po ?? 0;

                    // Check for existing record for UPSERT
                    $existingMibSet = $existingMibs->get($kdMatLower);
                    $existingMib = $existingMibSet ? $existingMibSet->first() : null;

                    if ($existingMib) {
                        // Update existing tb_mib: Increment qty and rest_mat
                        $newQtyTotal = (float)($existingMib->qty ?? 0) + $qtyNum;
                        $newRestMatTotal = (float)($existingMib->rest_mat ?? 0) + $qtyNum;
                        $newPriceTotal = (float)($existingMib->total_price ?? 0) + $totalPrice;

                        $updateData = [
                            'qty' => $newQtyTotal,
                            'rest_mat' => $newRestMatTotal,
                            'total_price' => $newPriceTotal,
                            'price' => $row['price'],
                        ];

                        if ($hasMis) {
                            $updateData['mis'] = $newQtyTotal;
                        }
                        if ($hasHargaMis) {
                            $updateData['harga_mis'] = $newPriceTotal;
                        }

                        // Filter existing columns
                        $updateData = array_intersect_key($updateData, array_flip($mibColumns));

                        DB::table('tb_mib')
                            ->where('no_doc', $existingMib->no_doc)
                            ->where('kd_mat', $existingMib->kd_mat)
                            ->update($updateData);
                    } else {
                        // Prepare insert for tb_mib
                        $insert = [
                            'no_doc' => $noDoc,
                            'keterangan' => (string) ($row['remark'] ?? ''),
                            'no' => $no,
                            'kd_mat' => $kdMat,
                            'material' => (string) $row['material'],
                            'qty' => $row['qty'],
                            'unit' => (string) $row['unit'],
                            'price' => $row['price'],
                            'total_price' => $row['total_price'],
                            'id_po' => $idPo,
                            'transfer' => 0,
                            'rest_mat' => $row['qty'],
                        ];

                        if ($hasMis) {
                            $insert['mis'] = $row['qty'];
                        }
                        if ($hasHargaMis) {
                            $insert['harga_mis'] = $row['total_price'];
                        }

                        // Only insert existing columns
                        $insert = array_intersect_key($insert, array_flip($mibColumns));

                        $mibInserts[] = $insert;
                    }

                    // DO NOT update tb_detailpo.no_gudang for MIB as per user request
                }

                if (!empty($mibInserts)) {
                    foreach (array_chunk($mibInserts, 100) as $chunk) {
                        DB::table('tb_mib')->insert($chunk);
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'general' => $e->getMessage(),
            ]);
        }

        return redirect()
            ->route('inventory.penerimaan-material.index')
            ->with('success', 'Berhasil menyimpan data MIB.');
    }
}
