<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class AIPredictionService
{
    /**
     * Predict PPN and Franco for a customer based on historical PO In data.
     *
     * @param string $customerName
     * @return array
     */
    public function predictPOInFields(string $customerName): array
    {
        // 1. Fetch historical data from tb_poin
        // We limit to the last 100 entries for efficiency and relevance
        $history = DB::table('tb_poin')
            ->select('customer_name', 'franco_loco', 'ppn_input_percent as ppn_percent', 'payment_term')
            ->whereNotNull('customer_name')
            ->orderBy('created_at', 'desc')
            ->limit(200) // Capture a good chunk of history
            ->get()
            ->toArray();

        // 2. Prepare payload for Python script
        $payload = json_encode([
            'customer_name' => $customerName,
            'history' => $history
        ]);

        // 3. Execute Python script
        // We use full path to python3 and the script
        $scriptPath = base_path('app/Intelligence/POInPredictor.py');
        
        $process = new Process(['python3', $scriptPath]);
        $process->setInput($payload);
        $process->run();

        if (!$process->isSuccessful()) {
            return [
                'ppn' => null,
                'franco' => null,
                'confidence' => 0,
                'error' => $process->getErrorOutput()
            ];
        }

        $result = json_decode($process->getOutput(), true);

        return $result ?? [
            'ppn' => null,
            'franco' => null,
            'confidence' => 0
        ];
    }
}
