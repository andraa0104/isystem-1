<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;

class QuotationDss
{
    /**
     * Suggest Franco value based on customer history in tb_penawaran.
     * Default to 'SAMARINDA' if no history found.
     */
    public function suggestFranco(string $customerName): string
    {
        $customerName = trim($customerName);
        if (empty($customerName)) {
            return 'SAMARINDA';
        }

        $latestFranco = DB::table('tb_penawaran')
            ->where('Customer', $customerName)
            ->orderBy('Tgl_Posting', 'desc')
            ->orderBy('No_penawaran', 'desc')
            ->value('Franco');

        $franco = trim((string)$latestFranco);

        return !empty($franco) ? $franco : 'SAMARINDA';
    }
}
