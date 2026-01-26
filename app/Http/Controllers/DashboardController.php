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

        $accountMap = [
            '1101AD' => 'Kas Tunai',
            '1102AD' => 'Kas Giro',
            '1103AD' => 'Kas Bank 1',
            '1104AD' => 'Kas Bank 2',
        ];

        $saldoByCode = DB::table('tb_nabb')
            ->whereIn('Kode_Akun', array_keys($accountMap))
            ->pluck('Saldo', 'Kode_Akun');

        $lastVoucherByCode = DB::table('tb_kas')
            ->select('Kode_Akun', DB::raw('MAX(Tgl_Voucher) as last_voucher'))
            ->whereIn('Kode_Akun', array_keys($accountMap))
            ->groupBy('Kode_Akun')
            ->pluck('last_voucher', 'Kode_Akun');

        $saldoStats = [];
        foreach ($accountMap as $code => $label) {
            $saldoStats[] = [
                'code' => $code,
                'label' => $label,
                'saldo' => (float) ($saldoByCode[$code] ?? 0),
                'last_voucher' => $lastVoucherByCode[$code] ?? null,
            ];
        }

        return Inertia::render('dashboard', [
            'quotationStats' => $quotationStats,
            'saldoStats' => $saldoStats,
        ]);
    }
}
