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
        return Inertia::render('inventory/data-material/index', [
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
        $period = $request->query('period', 'today');
        $startDateParam = $request->query('startDate');
        $endDateParam = $request->query('endDate');

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

        // Period Filtering (MI and MIS use tb_mi which has posting_tgl)
        if (($key === 'mi' || $key === 'mis') && Schema::hasColumn($table, 'posting_tgl')) {
            $dateExpr = "str_to_date(trim(posting_tgl), '%d.%m.%Y')";
            
            $now = now();
            $startDate = null;
            $endDate = null;

            if ($period === 'today') {
                $startDate = $now->copy()->startOfDay();
                $endDate = $now->copy()->endOfDay();
            } elseif ($period === 'this_week') {
                $startDate = $now->copy()->startOfWeek();
                $endDate = $now->copy()->endOfWeek();
            } elseif ($period === 'this_month') {
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfMonth();
            } elseif ($period === 'this_year') {
                $startDate = $now->copy()->startOfYear();
                $endDate = $now->copy()->endOfYear();
            } elseif ($period === 'range' && $startDateParam && $endDateParam) {
                try {
                    $startDate = \Carbon\Carbon::parse($startDateParam)->startOfDay();
                    $endDate = \Carbon\Carbon::parse($endDateParam)->endOfDay();
                } catch (\Exception $e) {}
            }

            if ($startDate && $endDate) {
                $base->whereRaw("{$dateExpr} >= ?", [$startDate->toDateString()])
                     ->whereRaw("{$dateExpr} <= ?", [$endDate->toDateString()]);
            }
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
            $base->select($select)->orderByDesc('no_doc');
        } elseif ($key === 'mis') {
            $select = ['no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price', DB::raw('harga_mis as total_price'), 'mis'];
            if (Schema::hasColumn($table, 'id')) {
                array_unshift($select, 'id');
            }
            $base->select($select)->orderByDesc('no_doc');
        } else { // mib
            $select = ['no_doc', 'material', 'qty', 'unit', 'price', DB::raw('(price * qty) as total_price'), DB::raw('rest_mat as mib')];
            if (Schema::hasColumn($table, 'id')) {
                array_unshift($select, 'id');
            }
            $base->select($select)->orderByDesc('no_doc');
        }

        $total = $base->count();

        if ($pageSize !== 'all') {
            $base->forPage($page, $pageSize);
        }

        \Illuminate\Support\Facades\Log::info('Inventory Filter Debug', [
            'key' => $key,
            'period' => $period,
            'sql' => $base->toSql(),
            'bindings' => $base->getBindings(),
            'total' => $total
        ]);

        $rows = $base->get();

        return response()->json([
            'rows' => $rows,
            'total' => (int) $total,
        ]);
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
                    ->select('*')
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

                // If MI or MIS, revert tb_detailpo counters
                if ($key === 'mi' || $key === 'mis') {
                    $refPo = (string) ($row->ref_po ?? '');
                    $kdMat = (string) ($row->kd_mat ?? '');
                    $qty = (float) ($row->qty ?? 0);
                    $price = (float) ($row->price ?? 0);

                    if ($refPo !== '' && $kdMat !== '' && Schema::hasTable('tb_detailpo')) {
                        $matCol = Schema::hasColumn('tb_detailpo', 'kd_mat')
                            ? 'kd_mat'
                            : (Schema::hasColumn('tb_detailpo', 'no_material') ? 'no_material' : null);

                        if ($matCol) {
                            $prev = DB::table('tb_detailpo')
                                ->where('no_po', $refPo)
                                ->where($matCol, $kdMat)
                                ->lockForUpdate()
                                ->first(['ir_mat', 'ir_price', 'gr_mat', 'gr_price', 'end_gr']);

                            if ($prev) {
                                DB::table('tb_detailpo')
                                    ->where('no_po', $refPo)
                                    ->where($matCol, $kdMat)
                                    ->update([
                                        'ir_mat' => (float)$prev->ir_mat - $qty,
                                        'ir_price' => (float)$prev->ir_price - ($qty * $price),
                                        'gr_mat' => (float)$prev->gr_mat + $qty,
                                        'gr_price' => (float)$prev->gr_price + ($qty * $price),
                                        'end_gr' => (float)$prev->end_gr - $qty,
                                        'no_gudang' => '0',
                                    ]);
                            }
                        }
                    }

                    // For MI (Realized Stock), also revert tb_material stok, rest_stock, and harga
                    if ($key === 'mi' && $kdMat !== '' && Schema::hasTable('tb_material')) {
                        $stockCol = Schema::hasColumn('tb_material', 'stok') ? 'stok' : null;
                        if ($stockCol) {
                            DB::table('tb_material')
                                ->where('kd_material', $kdMat)
                                ->update([
                                    $stockCol => DB::raw("COALESCE({$stockCol}, 0) - {$qty}"),
                                    'rest_stock' => DB::raw("COALESCE(rest_stock, 0) - {$qty}")
                                ]);
                        }

                        if (Schema::hasColumn('tb_material', 'harga')) {
                            // Revert harga to the next latest MI price
                            $prevPrice = DB::table('tb_mi')
                                ->where('kd_mat', $kdMat)
                                ->where('id', '<>', (int) $id)
                                ->where('miu', '>', 0)
                                ->orderByDesc('id')
                                ->value('price');
                            
                            if ($prevPrice !== null) {
                                DB::table('tb_material')
                                    ->where('kd_material', $kdMat)
                                    ->update(['harga' => $prevPrice]);
                            }
                        }
                    }
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
