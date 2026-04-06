<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PurchaseOrderDss
{
    /**
     * Suggest values for PPN, Payment Terms, Franco Loco, and Ref Quota based on vendor history.
     */
    public function suggest(string $vendorCode, string $vendorName): array
    {
        $vendorCode = trim($vendorCode);
        $vendorName = trim($vendorName);

        // 1. Fetch latest PO for this vendor.
        $latestDetail = DB::table('tb_detailpo')
            ->where(function ($query) use ($vendorCode, $vendorName) {
                if ($vendorCode) {
                    $query->where('kd_vdr', $vendorCode);
                }
                if ($vendorName) {
                    $query->orWhere('nm_vdr', $vendorName);
                }
            })
            ->orderBy('tgl', 'desc')
            ->orderBy('no_po', 'desc')
            ->first();

        $ppn = 0;
        $paymentTerms = '';
        $francoLoco = '';
        $deliveryTime = '';
        $historicalPrefix = '';

        if ($latestDetail) {
            $paymentTerms = $latestDetail->payment_terms ?? '';
            $francoLoco = $latestDetail->franco_loco ?? '';
            $deliveryTime = $latestDetail->del_time ?? '';
            
            // Extract Prefix from historical ref_quota if available (ACRONYM-DDMMYY)
            if (!empty($latestDetail->ref_quota)) {
                $parts = explode('-', $latestDetail->ref_quota);
                if (count($parts) >= 2) {
                    $historicalPrefix = $parts[0];
                }
            }

            // Extract PPN
            $ppnStr = (string) ($latestDetail->ppn ?? '0');
            if (($ppnStr === '' || $ppnStr === '0') && $latestDetail->no_po) {
                $poHeader = DB::table('tb_po')->where('no_po', $latestDetail->no_po)->first();
                if ($poHeader) {
                    $ppnStr = (string) ($poHeader->ppn ?? '0');
                }
            }
            $ppn = (int) str_replace('%', '', $ppnStr);
        }

        // 2. Generate ref_quota using the prefix (historical or generated) and current date
        $refQuota = $this->generateRefQuota($vendorName, $historicalPrefix);

        return [
            'ppn' => $ppn,
            'payment_terms' => $paymentTerms,
            'franco_loco' => $francoLoco,
            'delivery_time' => $deliveryTime,
            'ref_quota' => $refQuota,
        ];
    }

    /**
     * Generate acronym-based reference quota.
     * Extracts acronym from vendor name if no historical prefix is provided.
     * Ignores common generic words like PT, CV, BENGKEL, etc.
     */
    private function generateRefQuota(string $vendorName, string $prefix = ''): string
    {
        if (empty($vendorName)) {
            return '';
        }

        if (empty($prefix)) {
            // Multi-word acronym generation
            $cleanName = preg_replace('/[^A-Za-z0-9 ]/i', '', $vendorName);
            $words = explode(' ', $cleanName);
            
            // Generic words to skip for acronym generation
            $stopWords = [
                'PT', 'CV', 'UD', 'TOKO', 'BENGKEL', 'LAS', 'PD', 'TB', 'FA', 'CV.', 'PT.', 'UD.'
            ];
            
            $filteredWords = array_filter($words, function($word) use ($stopWords) {
                return !empty($word) && !in_array(strtoupper($word), $stopWords);
            });

            // Fallback to original words if everything was a stop-word
            $sourceWords = !empty($filteredWords) ? $filteredWords : $words;

            foreach ($sourceWords as $word) {
                if (!empty($word)) {
                    $prefix .= strtoupper($word[0]);
                }
            }
        }

        if (empty($prefix)) {
            $prefix = 'VND'; 
        }

        // Current date in DDMMYY format
        $datePart = Carbon::now()->format('dmy');

        return "{$prefix}-{$datePart}";
    }
}
