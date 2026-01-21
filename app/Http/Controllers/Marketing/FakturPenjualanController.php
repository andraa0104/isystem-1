<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FakturPenjualanController
{
    public function index()
    {
        $unpaidCount = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->count();

        $unpaidTotal = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        $noReceiptCount = DB::table('tb_kdfakturpenjualan')
            ->where(function ($query) {
                $query->whereNull('no_kwitansi')
                    ->orWhereRaw("ltrim(rtrim(coalesce(no_kwitansi, ''))) = ''")
                    ->orWhereRaw("upper(ltrim(rtrim(coalesce(no_kwitansi, '')))) = 'NULL'");
            })
            ->count();

        $noReceiptTotal = DB::table('tb_kdfakturpenjualan')
            ->where(function ($query) {
                $query->whereNull('no_kwitansi')
                    ->orWhereRaw("ltrim(rtrim(coalesce(no_kwitansi, ''))) = ''")
                    ->orWhereRaw("upper(ltrim(rtrim(coalesce(no_kwitansi, '')))) = 'NULL'");
            })
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        $dueCount = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->whereDate('jth_tempo', '<=', now())
            ->count();

        $dueTotal = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->whereDate('jth_tempo', '<=', now())
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        return Inertia::render('Penjualan/faktur-penjualan/index', [
            'unpaidCount' => $unpaidCount,
            'unpaidTotal' => $unpaidTotal,
            'noReceiptCount' => $noReceiptCount,
            'noReceiptTotal' => $noReceiptTotal,
            'dueCount' => $dueCount,
            'dueTotal' => $dueTotal,
        ]);
    }
}
