<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class CollectionAnalyticsService
{
    /**
    * Run Python Data Analytics Engine for Invoices and enrich with Gemini.
     *
     * @param array $invoices
     * @param string|null $referenceDate
     * @return array
     */
    public function analyzeCollections(array $invoices, ?string $referenceDate = null): array
    {
        // 1. Jalankan Analisis Data Presisi di Python
        $pythonAnalysis = $this->runPythonAnalytics($invoices, $referenceDate);

        if (!$pythonAnalysis || empty($pythonAnalysis['result'])) {
            Log::warning('Python CollectionAnalytics failed, returning basic fallback.');
            return [
                'success' => false,
                'engine' => 'Python Analytics Engine (Error)',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analitik data penagihan di Python.',
                'data' => null,
            ];
        }

        $pythonResult = $pythonAnalysis['result'];
        $llmContext = $pythonAnalysis['llm_context'] ?? '';
        $metrics = $pythonAnalysis['analytics'] ?? ($pythonAnalysis['metrics'] ?? []);
        $agingDistribution = $pythonAnalysis['aging_distribution'] ?? [];
        $topAccounts = $pythonAnalysis['top_priority_accounts'] ?? [];
        $quickWins = $pythonAnalysis['quick_wins'] ?? [];
        $cashflowForecast = $pythonAnalysis['cashflow_forecast'] ?? ($pythonResult['cashflow_forecast'] ?? []);
        $defaultRiskAnalysis = $pythonAnalysis['default_risk_analysis'] ?? ($pythonResult['default_risk_analysis'] ?? []);

        // 2. Teruskan dossier Python ke Gemini untuk arahan penagihan.
        $geminiResult = $this->callGeminiWithDossier($llmContext, $pythonResult);

        if ($geminiResult && !empty($geminiResult['data'])) {
            // Gabungkan narasi dan taktik Gemini dengan fakta numerik presisi Python
            $mergedData = $this->mergeCollectionData(
                $pythonResult,
                $geminiResult['data'],
                $metrics,
                $agingDistribution,
                $topAccounts,
                $quickWins,
                $cashflowForecast,
                $defaultRiskAnalysis
            );
            $modelName = config('services.gemini.model', 'gemini-3.8-flash');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
                'analytics' => $metrics,
            ];
        }

        // 3. Fallback numerik bila Gemini sedang tidak tersedia.
        $pythonResult['aging_distribution'] = $agingDistribution;
        $pythonResult['analytics'] = $metrics;
        $pythonResult['cashflow_forecast'] = $cashflowForecast;
        $pythonResult['default_risk_analysis'] = $defaultRiskAnalysis;

        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $geminiResult['error'] ?? 'Gemini AI tidak tersedia. Menggunakan hasil analitik data Python.',
            'data' => $pythonResult,
            'analytics' => $metrics,
        ];
    }

    /**
     * Execute Python CollectionAnalytics script using stdin/stdout.
     *
     * @param array $invoices
     * @param string|null $referenceDate
     * @return array|null
     */
    private function runPythonAnalytics(array $invoices, ?string $referenceDate = null): ?array
    {
        $scriptPath = base_path('app/Intelligence/CollectionAnalytics.py');

        if (!file_exists($scriptPath)) {
            Log::error("CollectionAnalytics.py script not found at {$scriptPath}");
            return null;
        }

        try {
            $payload = [
                'invoices' => $invoices,
                'reference_date' => $referenceDate ?? date('Y-m-d'),
            ];

            $jsonInput = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            $pythonBinary = env('PYTHON_BINARY', 'python3');
            $process = new Process([$pythonBinary, $scriptPath]);
            $process->setInput($jsonInput);
            $process->setTimeout(30);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::error('CollectionAnalytics.py execution failed', [
                    'error' => $process->getErrorOutput(),
                    'exit_code' => $process->getExitCode(),
                ]);
                return null;
            }

            $output = trim($process->getOutput());
            $parsed = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE || !is_array($parsed)) {
                Log::error('CollectionAnalytics.py returned non-JSON output', ['output' => substr($output, 0, 500)]);
                return null;
            }

            return $parsed;
        } catch (\Throwable $e) {
            Log::error('Exception running CollectionAnalytics.py: ' . $e->getMessage());
            return null;
        }
    }

    /**
    * Call Gemini with the pre-computed Python Analytical Dossier.
     *
     * @param string $llmContext
     * @param array $pythonResult
     * @return array|null
     */
    private function callGeminiWithDossier(string $llmContext, array $pythonResult): ?array
    {
        $systemPrompt = <<<PROMPT
Anda adalah Chief Credit Officer & Senior B2B Accounts Receivable Collection Strategist.
Tugas Anda: Menganalisis profil penagihan piutang pelanggan B2B dan merumuskan panduan taktis penagihan untuk tim Marketing dan Finance berdasarkan FAKTA ANALITIK DATA MATEMATIS dari Python Collection Engine (Aging Buckets, DSO, Concentration HHI, dan Skor Prioritas).

Pedoman Analisis:
1. Jadikan data numerik Python sebagai fakta mutlak (GROUND TRUTH). Jangan mengubah angka nominal rupiah, persentase, hari keterlambatan, atau skor kesehatan (Health Score).
2. Tuliskan analisis dengan bahasa Indonesia bisnis profesional, taktis, persuasif namun tegas, dan berorientasi langsung pada percepatan pencairan kas (cash recovery).
3. Buatkan panduan script percakapan penagihan yang praktis digunakan tim sales/marketing melalui WhatsApp atau telepon.
4. Sesuaikan target, urgensi, tindakan, dan script dengan customer, nominal saldo, umur piutang, serta pola pembayaran yang benar-benar ada di dossier. Jangan memakai script penagihan yang sama untuk semua customer.
5. Jika kondisi berbeda, gunakan strategi berbeda; jangan mengulang rekomendasi Python secara otomatis.
6. Output WAJIB berupa JSON murni tanpa markdown ```json.

Struktur JSON WAJIB:
{
  "health_score": {$pythonResult['health_score']},
  "health_status": "{$pythonResult['health_status']}",
  "executive_summary": "<1 paragraf ringkas (3-4 kalimat) mengenai kondisi likuiditas piutang dan fokus penagihan hari ini>",
  "collection_directives": [
    {
      "role": "Marketing & Sales Account Manager",
      "target": "<Nama customer prioritas utama & nominal>",
      "action": "<1-2 kalimat tindakan komersial konkret, negosiasi, atau conditional ordering>",
      "script": "<Contoh pesan WhatsApp / call script persuasif untuk penagihan>",
      "urgency": "Kritis / Tinggi / Sedang"
    },
    {
      "role": "AR Collection & Finance Admin",
      "target": "<Kelompok piutang kritis / SP>",
      "action": "<Tindakan administratif, pengiriman faktur ulang, rekonsiliasi, atau surat peringatan>",
      "script": "<Draft pesan formal penagihan>",
      "urgency": "Kritis / Tinggi"
    },
    {
      "role": "Sales Representative Lapangan",
      "target": "<Tagihan Quick-Wins>",
      "action": "<Tindakan follow-up lapangan cepat>",
      "script": "<Pesan ramah konfirmasi jadwal pembayaran>",
      "urgency": "Sedang"
    }
  ],
  "credit_risk_warnings": [
    {
      "title": "<Judul peringatan risiko>",
      "description": "<Uraian risiko kredit / konsentrasi>",
      "severity": "critical / high / medium"
    }
  ],
  "credit_policy_recommendations": [
    "<1 kalimat rekomendasi kebijakan kredit/TOP untuk manajemen>",
    "<1 kalimat rekomendasi verifikasi order berikutnya>"
  ]
}
PROMPT;

        $userPrompt = "Berikut adalah Dossier Analisis Data Penagihan Piutang hasil perhitungan Python Engine:\n\n" . $llmContext . "\n\nRumuskan ringkasan eksekutif, arahan taktis penagihan per peran (Marketing & Finance), script penagihan praktis, dan rekomendasi kebijakan kredit.";

        return app(GeminiAnalyticsService::class)->generateJson($systemPrompt, $userPrompt);
    }

    /**
     * Merge Qwen strategic insights with Python mathematical precision data.
     */
    private function mergeCollectionData(
        array $pythonResult,
        array $geminiData,
        array $metrics,
        array $agingDistribution,
        array $topAccounts,
        array $quickWins,
        array $cashflowForecast = [],
        array $defaultRiskAnalysis = []
    ): array {
        return [
            // Selalu kunci Health Score dan Status ke hasil perhitungan matematis Python
            'health_score' => $pythonResult['health_score'] ?? ($geminiData['health_score'] ?? 50),
            'health_status' => $pythonResult['health_status'] ?? ($geminiData['health_status'] ?? 'Moderat'),
            'executive_summary' => !empty($geminiData['executive_summary'])
                ? $geminiData['executive_summary']
                : ($pythonResult['executive_summary'] ?? ''),
            'top_priority_accounts' => $topAccounts,
            'collection_directives' => !empty($geminiData['collection_directives'])
                ? $geminiData['collection_directives']
                : ($pythonResult['collection_directives'] ?? []),
            'quick_wins' => $quickWins,
            'cashflow_forecast' => $cashflowForecast,
            'default_risk_analysis' => $defaultRiskAnalysis,
            'credit_risk_warnings' => !empty($geminiData['credit_risk_warnings'])
                ? $geminiData['credit_risk_warnings']
                : ($pythonResult['credit_risk_warnings'] ?? []),
            'credit_policy_recommendations' => $geminiData['credit_policy_recommendations'] ?? [
                'Terapkan pembekuan kredit (stop shipment) untuk customer dengan keterlambatan melampaui 60 hari.',
                'Wajibkan konfirmasi bukti transfer lunas sebelum persetujuan SO (Sales Order) berikutnya.',
            ],
            'aging_distribution' => $agingDistribution,
            'analytics' => $metrics,
        ];
    }
}
