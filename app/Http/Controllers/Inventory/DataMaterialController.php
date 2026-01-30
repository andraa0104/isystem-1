<?php

namespace App\Http\Controllers\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DataMaterialController
{
    public function index()
    {
        return Inertia::render('Inventory/data-material/index', [
            'sections' => [
                'mi' => ['label' => 'Data MI'],
                'mis' => ['label' => 'Data MIS'],
                'mib' => ['label' => 'Data MIB'],
            ],
        ]);
    }

    public function sectionRows(Request $request)
    {
        $key = $request->query('key');
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $map = [
            'mi' => 'tb_mi',
            'mis' => 'tb_mi',
            'mib' => 'tb_mib',
        ];

        if (!isset($map[$key]) || !Schema::hasTable($map[$key])) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $table = $map[$key];
        $base = DB::table($table);

        if ($key === 'mi') {
            $base->where('miu', '>', 0);
        } elseif ($key === 'mis') {
            $base->where('mis', '>', 0);
        } elseif ($key === 'mib') {
            $base->where('rest_mat', '>', 0);
        }

        if ($search !== '') {
            $base->where(function ($q) use ($key, $search) {
                if ($key === 'mib') {
                    // Search by No MIB (no_doc) or material
                    $q->where('no_doc', 'like', '%' . $search . '%')
                        ->orWhere('material', 'like', '%' . $search . '%');
                    return;
                }

                // MI / MIS: search by No MI (no_doc), Ref PO (ref_po), or material
                $q->where('no_doc', 'like', '%' . $search . '%')
                    ->orWhere('ref_po', 'like', '%' . $search . '%')
                    ->orWhere('material', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $base)->count();

        if ($key === 'mi') {
            $select = ['no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price', 'total_price', 'miu'];
            if (Schema::hasColumn($table, 'inv')) {
                $select[] = 'inv';
            }
            if (Schema::hasColumn($table, 'id')) {
                array_unshift($select, 'id');
            }
            $base->select($select)
                ->orderByDesc('no_doc');
        } elseif ($key === 'mis') {
            $select = ['no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price', DB::raw('harga_mis as total_price'), 'mis'];
            if (Schema::hasColumn($table, 'id')) {
                array_unshift($select, 'id');
            }
            $base->select($select)
                ->orderByDesc('no_doc');
        } else { // mib
            $select = ['no_doc', 'material', 'qty', 'unit', 'price', DB::raw('(price * qty) as total_price'), DB::raw('rest_mat as mib')];
            if (Schema::hasColumn($table, 'id')) {
                array_unshift($select, 'id');
            }
            $base->select($select)
                ->orderByDesc('no_doc');
        }

        if ($pageSize !== 'all') {
            $base->forPage($page, $pageSize);
        }

        $rows = $base->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

    public function destroy(Request $request)
    {
        $key = (string) $request->input('key', '');
        $id = $request->input('id');

        $map = [
            'mi' => 'tb_mi',
            'mis' => 'tb_mi',
            'mib' => 'tb_mib',
        ];

        if (!isset($map[$key]) || !Schema::hasTable($map[$key])) {
            throw ValidationException::withMessages(['general' => 'Data tidak ditemukan.']);
        }

        $table = $map[$key];
        if (!Schema::hasColumn($table, 'id')) {
            throw ValidationException::withMessages(['general' => "Tabel {$table} tidak memiliki kolom id."]);
        }

        if (!is_numeric($id) || (int) $id <= 0) {
            throw ValidationException::withMessages(['general' => 'ID tidak valid.']);
        }

        try {
            DB::transaction(function () use ($key, $table, $id) {
                $row = DB::table($table)
                    ->select('id', 'no_doc')
                    ->where('id', (int) $id)
                    ->lockForUpdate()
                    ->first();

                if (!$row) {
                    throw new \RuntimeException('Data tidak ditemukan atau sudah terhapus.');
                }

                $noDoc = (string) ($row->no_doc ?? '');

                $deleted = DB::table($table)->where('id', (int) $id)->delete();
                if ($deleted <= 0) {
                    throw new \RuntimeException('Data tidak ditemukan atau sudah terhapus.');
                }

                if ($noDoc === '') {
                    return;
                }

                // Cleanup header table when the document no longer exists in detail table.
                // MI + MIS are stored in tb_mi and header is tb_kdmi.
                if (($key === 'mi' || $key === 'mis') && Schema::hasTable('tb_kdmi') && Schema::hasColumn('tb_kdmi', 'no_doc')) {
                    $remaining = (int) DB::table('tb_mi')->where('no_doc', $noDoc)->count();
                    if ($remaining <= 0) {
                        DB::table('tb_kdmi')->where('no_doc', $noDoc)->delete();
                    }
                    return;
                }

                // MIB stored in tb_mib and header is tb_kdmib.
                if ($key === 'mib' && Schema::hasTable('tb_kdmib') && Schema::hasColumn('tb_kdmib', 'no_doc')) {
                    $remaining = (int) DB::table('tb_mib')->where('no_doc', $noDoc)->count();
                    if ($remaining <= 0) {
                        DB::table('tb_kdmib')->where('no_doc', $noDoc)->delete();
                    }
                }
            });
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['general' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil dihapus.',
        ]);
    }

}
