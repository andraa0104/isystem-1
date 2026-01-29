<?php

namespace App\Http\Controllers\Inventory;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

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

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $base = DB::table('tb_detailpo')
            ->where('gr_mat', '>', 0);

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

        $query = DB::table('tb_detailpo')
            ->leftJoin('tb_material', 'tb_material.kd_material', '=', 'tb_detailpo.kd_mat')
            ->where('tb_detailpo.no_po', $noPo)
            ->select(
                'tb_detailpo.kd_mat',
                'tb_detailpo.material',
                'tb_detailpo.qty',
                'tb_detailpo.unit',
                'tb_detailpo.price',
                'tb_material.stok as last_stock'
            )
            ->orderBy('tb_detailpo.kd_mat');

        $rows = $query->get();

        return response()->json(['rows' => $rows]);
    }
}

