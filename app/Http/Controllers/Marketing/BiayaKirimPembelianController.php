<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class BiayaKirimPembelianController
{
    public function index(Request $request)
    {
        return Inertia::render('Pembelian/biaya-kirim-pembelian/index', [
            'items' => [],
            'summary' => [
                'unpaid_count' => 0,
                'unpaid_total' => 0,
            ],
            'filters' => [
                'search' => null,
                'status' => 'all',
                'pageSize' => 5,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Pembelian/biaya-kirim-pembelian/create', [
            'poRows' => [],
        ]);
    }

    public function data(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'all');

        $query = DB::table('tb_biayakirimbeli');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('no_bkp', 'like', $term)
                    ->orWhere('Vendor_Ekspedisi', 'like', $term)
                    ->orWhere('no_inv', 'like', $term);
            });
        }

        switch ($status) {
            case 'belum_dibayar':
                $query->whereColumn('Total_Biaya', 'pembayaran');
                break;
            case 'sisa_bayar':
                $query->whereRaw('COALESCE(sisa, 0) > 0');
                break;
            case 'belum_dijurnal':
                $query->where(function ($q) {
                    $q->whereNull('trx_kas')
                        ->orWhere('trx_kas', '')
                        ->orWhere('trx_kas', ' ');
                });
                break;
            case 'all':
            default:
                break;
        }

        $items = $query
            ->orderByDesc('no_bkp')
            ->get();

        $unpaidQuery = DB::table('tb_biayakirimbeli')
            ->whereColumn('Total_Biaya', 'pembayaran');
        $unpaidCount = (int) $unpaidQuery->count();
        $unpaidTotal = (float) $unpaidQuery->sum('Total_Biaya');

        return response()->json([
            'items' => $items,
            'summary' => [
                'unpaid_count' => $unpaidCount,
                'unpaid_total' => $unpaidTotal,
            ],
        ]);
    }

    public function poList(Request $request)
    {
        $search = $request->query('search');

        $query = DB::table('tb_detailpo')
            ->select('no_po', 'tgl', 'ref_poin', 'for_cus', 'no_gudang', 'qtybiayakirim', 'kd_vdr', 'nm_vdr')
            ->whereNotNull('no_gudang')
            ->where('no_gudang', '<>', '')
            ->whereRaw('COALESCE(qtybiayakirim, 0) <> 0')
            ->orderByDesc('no_po');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('no_po', 'like', $term)
                    ->orWhere('ref_poin', 'like', $term)
                    ->orWhere('for_cus', 'like', $term);
            });
        }

        $rows = $query->get();

        return response()->json(['rows' => $rows]);
    }

    public function poMaterials(Request $request)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['rows' => []]);
        }

        $rows = DB::table('tb_detailpo')
            ->select('kd_mat', 'material', 'qty', 'unit', 'price', 'total_price')
            ->where('no_po', $noPo)
            ->orderBy('kd_mat')
            ->get();

        return response()->json(['rows' => $rows]);
    }

    public function show(string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return response()->json(['message' => 'Data BKP tidak ditemukan.'], 404);
        }

        return response()->json(['header' => $header]);
    }

    public function detailList(string $noBkp)
    {
        $table = 'tb_biayakirimbelidetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['details' => []]);
        }

        $query = DB::table($table)->orderBy('no_po');

        if (Schema::hasColumn($table, 'no_bkp')) {
            $query->where('no_bkp', $noBkp);
        }

        $details = $query->get();

        return response()->json(['details' => $details]);
    }

    public function materialList(Request $request, string $noBkp)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['materials' => []]);
        }

        $table = 'tb_biayakirimbelidetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['materials' => []]);
        }

        $query = DB::table($table)->orderBy('material');
        if (Schema::hasColumn($table, 'no_bkp')) {
            $query->where('no_bkp', $noBkp);
        }
        if (Schema::hasColumn($table, 'no_po')) {
            $query->where('no_po', $noPo);
        }

        $materials = $query->get();

        return response()->json(['materials' => $materials]);
    }
}
