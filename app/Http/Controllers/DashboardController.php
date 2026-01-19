<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController
{
    public function index()
    {
        $end = Carbon::now()->startOfMonth();
        $start = $end->copy()->subMonths(11);

        $rawStats = DB::table('tb_penawaran')
            ->selectRaw("DATE_FORMAT(Tgl_penawaran, '%Y-%m') as period, COUNT(*) as total")
            ->whereNotNull('Tgl_penawaran')
            ->where('Tgl_penawaran', '>=', $start->toDateString())
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->keyBy('period');

        $quotationStats = [];
        for ($i = 0; $i < 12; $i += 1) {
            $month = $start->copy()->addMonths($i);
            $period = $month->format('Y-m');
            $total = (int) ($rawStats[$period]->total ?? 0);
            $quotationStats[] = [
                'period' => $period,
                'label' => $month->locale('id')->translatedFormat('M Y'),
                'total' => $total,
            ];
        }

        return Inertia::render('dashboard', [
            'quotationStats' => $quotationStats,
        ]);
    }
}
