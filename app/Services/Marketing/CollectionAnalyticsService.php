<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class CollectionAnalyticsService
{
    /**
     * Run Python Data Analytics Engine for Invoices and optionally enrich with Qwen 2.5 7B.
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
        $metrics = $pythonAnalysis['analytics'] ?? [];
        $agingDistribution = $pythonAnalysis['aging_distribution'] ?? [];
        $topAccounts = $pythonAnalysis['top_priority_accounts'] ?? [];
        $quickWins = $pythonAnalysis['quick_wins'] ?? [];

        // 2. Teruskan Ringkasan Analitik ke Qwen 2.5 7B (Ollama) jika tersedia
        $qwenResult = $this->callQwenWithDossier($llmContext, $pythonResult);

        if ($qwenResult && !empty($qwenResult['data'])) {
            // Gabungkan narasi dan taktik Qwen 2.5 7B dengan fakta numerik presisi Python
            $mergedData = $this->mergeCollectionData(
                $pythonResult,
                $qwenResult['data'],
                $metrics,
                $agingDistribution,
                $topAccounts,
                $quickWins
            );
            $modelName = config('services.ollama.model', 'qwen2.5:7b');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
                'analytics' => $metrics,
            ];
        }

        // 3. Fallback Mandiri (Lokal / Saat Ollama VPS Standby)
        // Menggunakan output komputasi Python langsung yang sudah sangat terstruktur dan akurat
        $pythonResult['aging_distribution'] = $agingDistribution;
        $pythonResult['analytics'] = $metrics;

        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $qwenResult['error'] ?? 'Ollama AI engine (qwen2.5:7b) aktif di server produksi. Menggunakan hasil analitik data Python komprehensif.',
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

            $process = new Process(['python3', $scriptPath]);
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
     * Call Ollama (qwen2.5:7b) with pre-computed Python Analytical Dossier.
     *
     * @param string $llmContext
     * @param array $pythonResult
     * @return array|null
     */
    private function callQwenWithDossier(string $llmContext, array $pythonResult): ?array
    {
        $baseUrl = rtrim(config('services.ollama.base_url', 'http://127.0.0.1:11434'), '/');
        $model = config('services.ollama.model', 'qwen2.5:7b');
        $configuredTimeout = (int) config('services.ollama.timeout', 90);
        $timeout = $configuredTimeout > 0 ? $configuredTimeout : 90;

        $systemPrompt = <<<PROMPT
Anda adalah Chief Credit Officer & Senior B2B Accounts Receivable Collection Strategist.
Tugas Anda: Menganalisis profil penagihan piutang pelanggan B2B dan merumuskan panduan taktis penagihan untuk tim Marketing dan Finance berdasarkan FAKTA ANALITIK DATA MATEMATIS dari Python Collection Engine (Aging Buckets, DSO, Concentration HHI, dan Skor Prioritas).

Pedoman Analisis:
1. Jadikan data numerik Python sebagai fakta mutlak (GROUND TRUTH). Jangan mengubah angka nominal rupiah, persentase, hari keterlambatan, atau skor kesehatan (Health Score).
2. Tuliskan analisis dengan bahasa Indonesia bisnis profesional, taktis, persuasif namun tegas, dan berorientasi langsung pada percepatan pencairan kas (cash recovery).
3. Buatkan panduan script percakapan penagihan yang praktis digunakan tim sales/marketing melalui WhatsApp atau telepon.
4. Output WAJIB berupa JSON murni tanpa markdown ```json.

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

        try {
            // Quick connectivity check (2.5 detik)
            $testCheck = @fsockopen(
                parse_url($baseUrl, PHP_URL_HOST) ?: '127.0.0.1',
                parse_url($baseUrl, PHP_URL_PORT) ?: 11434,
                $errno,
                $errstr,
                2.5
            );

            if (!$testCheck) {
                return ['data' => null, 'error' => 'Koneksi ke Ollama VPS tidak aktif atau port tertutup.'];
            }
            fclose($testCheck);

            $response = Http::timeout($timeout)
                ->connectTimeout(5)
                ->post("{$baseUrl}/api/generate", [
                    'model' => $model,
                    'system' => $systemPrompt,
                    'prompt' => $userPrompt,
                    'stream' => false,
                    'format' => 'json',
                    'options' => [
                        'temperature' => 0.2, // Temperatur rendah untuk kepatuhan ketat data faktual
                        'top_p' => 0.85,
                        'num_predict' => 2048,
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('Ollama API request failed', ['status' => $response->status(), 'body' => $response->body()]);
                return ['data' => null, 'error' => 'Ollama API mengembalikan status non-200.'];
            }

            $body = $response->json();
            $rawText = trim($body['response'] ?? '');

            // Bersihkan markdown ```json jika ada
            if (str_starts_with($rawText, '```')) {
                $rawText = preg_replace('/^```(?:json)?\s*/i', '', $rawText);
                $rawText = preg_replace('/\s*```$/', '', $rawText);
                $rawText = trim($rawText);
            }

            $jsonDecoded = json_decode($rawText, true);

            if (json_last_error() !== JSON_ERROR_NONE || !is_array($jsonDecoded)) {
                Log::warning('Ollama Qwen returned invalid JSON format', ['raw' => substr($rawText, 0, 500)]);
                return ['data' => null, 'error' => 'Format JSON dari model AI tidak valid.'];
            }

            return ['data' => $jsonDecoded, 'error' => null];
        } catch (\Throwable $e) {
            Log::info('Ollama call skipped: ' . $e->getMessage());
            return ['data' => null, 'error' => 'Tidak dapat menghubungi layanan AI Qwen (offline/timeout).'];
        }
    }

    /**
     * Merge Qwen strategic insights with Python mathematical precision data.
     */
    private function mergeCollectionData(
        array $pythonResult,
        array $qwenData,
        array $metrics,
        array $agingDistribution,
        array $topAccounts,
        array $quickWins
    ): array {
        return [
            // Selalu kunci Health Score dan Status ke hasil perhitungan matematis Python
            'health_score' => $pythonResult['health_score'] ?? ($qwenData['health_score'] ?? 50),
            'health_status' => $pythonResult['health_status'] ?? ($qwenData['health_status'] ?? 'Moderat'),
            'executive_summary' => !empty($qwenData['executive_summary'])
                ? $qwenData['executive_summary']
                : ($pythonResult['executive_summary'] ?? ''),
            'top_priority_accounts' => $topAccounts,
            'collection_directives' => !empty($qwenData['collection_directives'])
                ? $qwenData['collection_directives']
                : ($pythonResult['collection_directives'] ?? []),
            'quick_wins' => $quickWins,
            'credit_risk_warnings' => !empty($qwenData['credit_risk_warnings'])
                ? $qwenData['credit_risk_warnings']
                : ($pythonResult['credit_risk_warnings'] ?? []),
            'credit_policy_recommendations' => $qwenData['credit_policy_recommendations'] ?? [
                'Terapkan pembekuan kredit (stop shipment) untuk customer dengan keterlambatan melampaui 60 hari.',
                'Wajibkan konfirmasi bukti transfer lunas sebelum persetujuan SO (Sales Order) berikutnya.',
            ],
            'aging_distribution' => $agingDistribution,
            'analytics' => $metrics,
        ];
    }
}
