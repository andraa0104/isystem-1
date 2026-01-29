<?php

namespace App\Http\Controllers\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Http\Request;

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
            $base->select('no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price', 'total_price', 'miu')
                ->orderByDesc('no_doc');
        } elseif ($key === 'mis') {
            $base->select('no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price', DB::raw('harga_mis as total_price'), 'mis')
                ->orderByDesc('no_doc');
        } else { // mib
            $base->select('no_doc', 'material', 'qty', 'unit', 'price', DB::raw('(price * qty) as total_price'), 'rest_mat as mib')
                ->orderByDesc('no_doc');
        }

        if ($pageSize !== 'all') {
            $base->forPage($page, $pageSize);
        }

        $rows = $base->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

}
