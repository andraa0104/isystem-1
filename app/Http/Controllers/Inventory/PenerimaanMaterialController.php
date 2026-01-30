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
        return Inertia::render('Inventory/penerimaan-material/index');
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
            ->whereRaw("UPPER(TRIM(COALESCE(no_gudang, ''))) NOT LIKE '%MI%'");

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
            ->whereRaw("UPPER(TRIM(COALESCE(tb_detailpo.no_gudang, ''))) NOT LIKE '%MI%'")
            ->select(
                'tb_detailpo.kd_mat',
                'tb_detailpo.material',
                'tb_detailpo.qty',
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

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];
                    $qtyNum = is_numeric($row['qty']) ? (float) $row['qty'] : 0.0;

                    $idPo = 0;
                    if ($detailMatColumn && Schema::hasColumn('tb_detailpo', 'id_po')) {
                        $found = DB::table('tb_detailpo')
                            ->where('no_po', $data['no_po'])
                            ->where($detailMatColumn, $kdMat)
                            ->value('id_po');
                        $idPo = $found === null ? 0 : $found;
                    }

                    // Insert detail to tb_mi (per-row)
                    DB::table('tb_mi')->insert([
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
                        // Keep MIU = 0 on receipt; MIU will be filled by transfer (MIS/MIB -> MI).
                        'miu' => 0,
                        'harga_miu' => 0,
                        'mis' => 0,
                        'harga_mis' => 0,
                        'mib' => 0,
                        'harga_mib' => 0,
                        'transfer_mis' => 0,
                        'transfer_mib' => 0,
                        'inv' => 0,
                    ]);

                    // Update tb_detailpo based on No PO & Kode Material
                    $detailUpdate = [
                        'ir_mat' => $row['qty'],
                        'ir_price' => $row['total_price'],
                        'gr_mat' => 0,
                        'gr_price' => 0,
                    ];
                    // no_gudang will be set in TransferMaterialController when qty == miu.

                    DB::table('tb_detailpo')
                        ->where('no_po', $data['no_po'])
                        ->where($detailMatColumn, $kdMat)
                        ->update($detailUpdate);

                    // Update stock in tb_material
                    if ($stockColumn) {
                        $currentStock = DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->value($stockColumn);
                        $currentStockNum = is_numeric($currentStock) ? (float) $currentStock : 0;
                        $newStock = $currentStockNum + $qtyNum;

                        DB::table('tb_material')
                            ->where('kd_material', $kdMat)
                            ->update([$stockColumn => $newStock]);
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

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];
                    $qtyNum = is_numeric($row['qty']) ? (float) $row['qty'] : 0.0;

                    $idPo = 0;
                    if (Schema::hasColumn('tb_detailpo', 'id_po')) {
                        $found = DB::table('tb_detailpo')
                            ->where('no_po', $data['no_po'])
                            ->where($detailMatColumn, $kdMat)
                            ->value('id_po');
                        $idPo = $found === null ? 0 : $found;
                    }

                    // Insert MIS detail to tb_mi (per-row)
                    DB::table('tb_mi')->insert([
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
                    ]);
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

                // Generate MIB code: MIB + 7 digits (last + 1)
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

                $detailMatColumn = Schema::hasColumn('tb_detailpo', 'kd_mat')
                    ? 'kd_mat'
                    : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);
                if (!$detailMatColumn) {
                    throw new \RuntimeException('Kolom kd_mat/no_material tidak ditemukan di tb_detailpo.');
                }

                foreach (array_values($data['rows']) as $i => $row) {
                    $no = $i + 1;
                    $kdMat = (string) $row['kd_mat'];

                    $idPo = 0;
                    if (Schema::hasColumn('tb_detailpo', 'id_po')) {
                        $found = DB::table('tb_detailpo')
                            ->where('no_po', $data['no_po'])
                            ->where($detailMatColumn, $kdMat)
                            ->value('id_po');
                        $idPo = $found === null ? 0 : $found;
                    }

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
                        'rest_mat' => 0,
                    ];

                    // Some schemas use mis/harga_mis for MIB table; set if columns exist.
                    if (Schema::hasColumn('tb_mib', 'mis')) {
                        $insert['mis'] = $row['qty'];
                    }
                    if (Schema::hasColumn('tb_mib', 'harga_mis')) {
                        $insert['harga_mis'] = $row['total_price'];
                    }

                    // Only insert existing columns to avoid SQL errors.
                    $insert = array_filter(
                        $insert,
                        fn ($_, $col) => Schema::hasColumn('tb_mib', $col),
                        ARRAY_FILTER_USE_BOTH
                    );

                    DB::table('tb_mib')->insert($insert);
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
