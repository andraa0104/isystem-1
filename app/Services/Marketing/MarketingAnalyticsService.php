<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class MarketingAnalyticsService
{
    /**
     * Run Python Data Analytics Engine for Overall Performance and enrich with Qwen 2.5 7B.
     *
     * @param array $perfData
     * @param array $filters
     * @return array
     */
    public function analyzeOverallPerformance(array $perfData, array $filters): array
    {
        // 1. Jalankan Analisis Data Presisi di Python
        $pythonAnalysis = $this->runPythonAnalytics('overall', $perfData);

        if (!$pythonAnalysis || empty($pythonAnalysis['result'])) {
            Log::warning('Python MarketingAnalytics overall failed, returning basic fallback.');
            return [
                'success' => false,
                'engine' => 'Python Analytics Engine (Error)',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analitik data Python.',
                'data' => null,
            ];
        }

        $pythonResult = $pythonAnalysis['result'];
        $llmContext = $pythonAnalysis['llm_context'] ?? '';
        $metrics = $pythonAnalysis['analytics'] ?? [];

        // 2. Teruskan Ringkasan Analitik ke Qwen 2.5 7B (Ollama)
        $qwenResult = $this->callQwenWithDossier('overall', $llmContext, $pythonResult);

        if ($qwenResult && !empty($qwenResult['data'])) {
            // Gabungkan narasi Qwen 2.5 7B dengan angka skor presisi Python (mencegah halusinasi skor LLM)
            $mergedData = $this->mergeOverallData($pythonResult, $qwenResult['data'], $metrics);
            $modelName = config('services.ollama.model', 'qwen2.5:7b');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
            ];
        }

        // 3. Fallback Mandiri (Lokal / Saat Ollama VPS Standby)
        // Menggunakan output komputasi Python langsung yang sudah terstruktur dan sangat akurat
        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $qwenResult['error'] ?? 'Ollama AI engine (qwen2.5:7b) standby di server produksi. Menggunakan hasil analitik data Python.',
            'data' => $pythonResult,
        ];
    }

    /**
     * Run Python Data Analytics Engine for Customer-Specific Performance and enrich with Qwen 2.5 7B.
     *
     * @param array $customerPerfData
     * @param array $filters
     * @return array
     */
    public function analyzeCustomerPerformance(array $customerPerfData, array $filters): array
    {
        // 1. Jalankan Analisis Data Pelanggan Presisi di Python (RFM, Volatilitas, Produk)
        $pythonAnalysis = $this->runPythonAnalytics('customer', $customerPerfData);

        if (!$pythonAnalysis || empty($pythonAnalysis['result'])) {
            Log::warning('Python MarketingAnalytics customer failed, returning basic fallback.');
            return [
                'success' => false,
                'engine' => 'Python Analytics Engine (Error)',
                'is_fallback' => true,
                'notice' => 'Gagal memproses analitik data customer di Python.',
                'data' => null,
            ];
        }

        $pythonResult = $pythonAnalysis['result'];
        $llmContext = $pythonAnalysis['llm_context'] ?? '';
        $metrics = $pythonAnalysis['analytics'] ?? [];

        // 2. Teruskan Ringkasan Analitik ke Qwen 2.5 7B (Ollama)
        $qwenResult = $this->callQwenWithDossier('customer', $llmContext, $pythonResult);

        if ($qwenResult && !empty($qwenResult['data'])) {
            $mergedData = $this->mergeCustomerData($pythonResult, $qwenResult['data'], $metrics);
            $modelName = config('services.ollama.model', 'qwen2.5:7b');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
            ];
        }

        // 3. Fallback Mandiri (Lokal / Saat Ollama VPS Standby)
        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $qwenResult['error'] ?? 'Ollama AI engine (qwen2.5:7b) standby di server produksi. Menggunakan hasil analitik data Python.',
            'data' => $pythonResult,
        ];
    }

    /**
     * Enrich raw performance data using Python Data Analytics before returning to frontend.
     *
     * @param array $perfData
     * @return array
     */
    public function enrichPerformanceDataset(array $perfData): array
    {
        $pythonAnalysis = $this->runPythonAnalytics('overall', $perfData);
        if ($pythonAnalysis && !empty($pythonAnalysis['enriched_customers'])) {
            $perfData['allCustomers'] = $pythonAnalysis['enriched_customers']['allCustomers'];
            $perfData['topCustomers'] = $pythonAnalysis['enriched_customers']['topCustomers'];
            $perfData['lowestCustomers'] = $pythonAnalysis['enriched_customers']['lowestCustomers'];
            $perfData['decliningCustomers'] = $pythonAnalysis['enriched_customers']['decliningCustomers'];
            $perfData['analyticsMetrics'] = $pythonAnalysis['analytics'] ?? [];
        }
        return $perfData;
    }

    /**
     * Enrich raw customer data using Python Customer Analytics before returning to frontend.
     *
     * @param array $customerData
     * @return array
     */
    public function enrichCustomerDataset(array $customerData): array
    {
        $pythonAnalysis = $this->runPythonAnalytics('customer', $customerData);
        if ($pythonAnalysis && !empty($pythonAnalysis['enriched_kpi'])) {
            $kpi = $customerData['kpi'] ?? [];
            $kpi['status'] = $pythonAnalysis['enriched_kpi']['status'] ?? ($kpi['status'] ?? 'Aktif Reguler');
            $kpi['account_health_score'] = $pythonAnalysis['enriched_kpi']['account_health_score'] ?? 75;
            $kpi['rfm_segment'] = $pythonAnalysis['enriched_kpi']['rfm_segment'] ?? 'Reguler';
            $customerData['kpi'] = $kpi;
            $customerData['analyticsMetrics'] = $pythonAnalysis['analytics'] ?? [];
        }
        return $customerData;
    }

    /**
     * Execute Python MarketingAnalytics script using stdin/stdout.
     *
     * @param string $mode ('overall' | 'customer')
     * @param array $payload
     * @return array|null
     */
    private function runPythonAnalytics(string $mode, array $payload): ?array
    {
        $scriptPath = base_path('app/Intelligence/MarketingAnalytics.py');

        // Pastikan file script python ada
        if (!file_exists($scriptPath)) {
            Log::error("MarketingAnalytics.py script not found at {$scriptPath}");
            return null;
        }

        try {
            $jsonInput = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            $process = new Process(['python3', $scriptPath, "--mode={$mode}"]);
            $process->setInput($jsonInput);
            $process->setTimeout(30); // Maksimal 30 detik (biasanya < 100ms)
            $process->run();

            if (!$process->isSuccessful()) {
                Log::error('MarketingAnalytics.py execution failed', [
                    'mode' => $mode,
                    'error' => $process->getErrorOutput(),
                    'exit_code' => $process->getExitCode(),
                ]);
                return null;
            }

            $output = trim($process->getOutput());
            $parsed = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE || !is_array($parsed)) {
                Log::error('MarketingAnalytics.py returned non-JSON output', ['output' => $output]);
                return null;
            }

            return $parsed;
        } catch (\Throwable $e) {
            Log::error('Exception running MarketingAnalytics.py: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Call Ollama (qwen2.5:7b) with pre-computed Python Analytical Dossier.
     *
     * @param string $mode ('overall' | 'customer')
     * @param string $llmContext
     * @param array $pythonResult
     * @return array|null
     */
    private function callQwenWithDossier(string $mode, string $llmContext, array $pythonResult): ?array
    {
        $baseUrl = rtrim(config('services.ollama.base_url', 'http://127.0.0.1:11434'), '/');
        $model = config('services.ollama.model', 'qwen2.5:7b');
        $configuredTimeout = (int) config('services.ollama.timeout', 90);
        $timeout = $configuredTimeout > 0 ? $configuredTimeout : 90;

        if ($mode === 'customer') {
            $systemPrompt = <<<PROMPT
Anda adalah Senior Key Account Commercial Manager & B2B Sales Intelligence Analyst.
Tugas Anda: Menganalisis profil transaksi dan KPI akun pelanggan B2B ini berdasarkan FAKTA ANALITIK DATA MATEMATIS dari Python Engine (RFM, Volatilitas CV, dan Pola Pembelian).
Pedoman Analisis:
1. Jadikan data numerik Python sebagai fakta mutlak (GROUND TRUTH). Jangan mengubah angka, skor kesehatan akun, atau persentase.
2. Tuliskan analisis dengan bahasa Indonesia bisnis profesional, taktis, padat, dan langsung pada solusi (maksimal 1-2 kalimat per poin).
3. Output WAJIB berupa JSON murni tanpa markdown ```json.

Struktur JSON WAJIB:
{
  "account_health_score": {$pythonResult['account_health_score']},
  "loyalty_status": "{$pythonResult['loyalty_status']}",
  "executive_summary": "<1 paragraf ringkas (2-3 kalimat) profil pembelian dan potensi komersial akun>",
  "buying_habits": {
    "pattern": "{$pythonResult['buying_habits']['pattern']}",
    "favorite_categories": "{$pythonResult['buying_habits']['favorite_categories']}",
    "order_characteristics": "{$pythonResult['buying_habits']['order_characteristics']}"
  },
  "risk_and_drop_alerts": [
    {
      "alert": "<isu risiko>",
      "impact": "<dampak nominal/frekuensi>",
      "mitigation": "<1 kalimat tindakan mitigasi>"
    }
  ],
  "sales_growth_opportunities": [
    {
      "category": "<Cross-Selling | Upselling Volume | Paket Kontrak>",
      "suggested_product": "<rekomendasi produk>",
      "rationale": "<1 kalimat alasan penawaran>",
      "pitching_strategy": "<1 kalimat strategi penawaran>"
    }
  ],
  "quick_wins": [
    "<aksi taktis 1 dalam 7 hari>",
    "<aksi taktis 2 dalam 7 hari>",
    "<aksi taktis 3 dalam 7 hari>"
  ]
}
PROMPT;

            $userPrompt = "Berikut adalah dossier analitik data dari Python Engine untuk akun ini:\n" . $llmContext . "\n\nSintesiskan menjadi laporan strategis akun customer sesuai format JSON di atas.";
        } else {
            $systemPrompt = <<<PROMPT
Anda adalah Chief Commercial Officer (CCO) & Senior Sales Performance Analyst B2B.
Tugas Anda: Menganalisis laporan KPI Penjualan secara objektif, tajam, dan strategis berdasarkan FAKTA ANALITIK DATA MATEMATIS dari Python Engine (Pareto HHI, Gini, Outlier Z-Scores, Kohort Churn & NRR).
Pedoman Analisis:
1. Jadikan data statistik Python sebagai fakta mutlak (GROUND TRUTH). Pertahankan skor kesehatan KPI dan metrik konsentrasi HHI yang telah dihitung.
2. Bahasa: Bahasa Indonesia bisnis profesional, padat, lugas, dan berorientasi tindakan komersial (maksimal 1-2 kalimat per poin).
3. Output WAJIB berupa JSON murni tanpa markdown ```json.

Struktur JSON WAJIB:
{
  "health_score": {$pythonResult['health_score']},
  "status_label": "{$pythonResult['status_label']}",
  "executive_summary": "<1 paragraf padat (2-3 kalimat) ringkasan pencapaian penjualan periode ini vs periode lalu>",
  "pareto_risk_analysis": {
    "top5_share_percent": {$pythonResult['pareto_risk_analysis']['top5_share_percent']},
    "risk_level": "{$pythonResult['pareto_risk_analysis']['risk_level']}",
    "evaluation": "{$pythonResult['pareto_risk_analysis']['evaluation']}"
  },
  "critical_areas_to_fix": [
    {
      "issue": "<judul anomali singkat>",
      "customer_affected": "<nama customer atau kelompok>",
      "nominal_impact": "<dampak nominal>",
      "root_cause": "<1 kalimat akar masalah data>",
      "action_to_fix": "<1 kalimat tindakan korektif tim marketing>"
    }
  ],
  "tactical_recommendations": [
    {
      "category": "<Customer VIP / Top Performers | Customer Menurun / At-Risk | Penetrasi & Upselling>",
      "focus": "<fokus utama>",
      "action": "<1-2 kalimat langkah taktis tim sales>"
    }
  ],
  "quick_wins": [
    "<aksi prioritas 1 dalam 7 hari>",
    "<aksi prioritas 2 dalam 7 hari>",
    "<aksi prioritas 3 dalam 7 hari>"
  ]
}
PROMPT;

            $userPrompt = "Berikut adalah dossier analitik data dari Python Engine:\n" . $llmContext . "\n\nSintesiskan menjadi laporan analitik kinerja penjualan dan rekomendasi strategis CCO sesuai format JSON di atas.";
        }

        try {
            // Quick connect timeout (2.5s) agar cepat mendeteksi jika Ollama tidak aktif (misal di lokal)
            $res = Http::connectTimeout(2.5)
                ->timeout($timeout)
                ->post("{$baseUrl}/api/chat", [
                    'model' => $model,
                    'keep_alive' => -1,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'stream' => false,
                    'format' => 'json',
                    'options' => [
                        'temperature' => 0.15,
                        'top_p' => 0.85,
                        'num_predict' => 450,
                    ],
                ]);

            if (!$res->successful()) {
                Log::info('Ollama API not successful', ['status' => $res->status()]);
                return ['error' => 'Ollama API error: status ' . $res->status()];
            }

            $body = $res->json();
            $content = $body['message']['content'] ?? '';

            // Clean markdown wrap if any
            $cleaned = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
            $cleaned = preg_replace('/\s*```$/', '', $cleaned);

            $parsed = json_decode($cleaned, true);
            if (is_array($parsed)) {
                return ['data' => $parsed];
            }

            if (preg_match('/\{[\s\S]*\}/', $cleaned, $match)) {
                $matchedJson = json_decode($match[0], true);
                if (is_array($matchedJson)) {
                    return ['data' => $matchedJson];
                }
            }

            return ['error' => 'Gagal membaca format JSON dari Ollama'];
        } catch (\Throwable $e) {
            // Ollama offline / unreachable (terjadi di lokal secara wajar)
            return ['error' => 'Ollama offline: ' . $e->getMessage()];
        }
    }

    /**
     * Merge Python analytical metrics with Qwen 2.5 7B generated narrative for Overall Performance.
     *
     * @param array $pythonResult
     * @param array $qwenData
     * @param array $metrics
     * @return array
     */
    private function mergeOverallData(array $pythonResult, array $qwenData, array $metrics): array
    {
        return [
            // Skor kesehatan dan label status selalu diikat ke perhitungan matematis Python
            'health_score' => $pythonResult['health_score'],
            'status_label' => $pythonResult['status_label'],
            'executive_summary' => !empty($qwenData['executive_summary']) ? $qwenData['executive_summary'] : $pythonResult['executive_summary'],
            'pareto_risk_analysis' => [
                'top5_share_percent' => $pythonResult['pareto_risk_analysis']['top5_share_percent'],
                'risk_level' => $pythonResult['pareto_risk_analysis']['risk_level'],
                'evaluation' => !empty($qwenData['pareto_risk_analysis']['evaluation']) ? $qwenData['pareto_risk_analysis']['evaluation'] : $pythonResult['pareto_risk_analysis']['evaluation'],
            ],
            'critical_areas_to_fix' => !empty($qwenData['critical_areas_to_fix']) && is_array($qwenData['critical_areas_to_fix'])
                ? $qwenData['critical_areas_to_fix']
                : $pythonResult['critical_areas_to_fix'],
            'tactical_recommendations' => !empty($qwenData['tactical_recommendations']) && is_array($qwenData['tactical_recommendations'])
                ? $qwenData['tactical_recommendations']
                : $pythonResult['tactical_recommendations'],
            'quick_wins' => !empty($qwenData['quick_wins']) && is_array($qwenData['quick_wins'])
                ? $qwenData['quick_wins']
                : $pythonResult['quick_wins'],
            'analytics_metrics' => $metrics,
        ];
    }

    /**
     * Merge Python analytical metrics with Qwen 2.5 7B generated narrative for Customer Performance.
     *
     * @param array $pythonResult
     * @param array $qwenData
     * @param array $metrics
     * @return array
     */
    private function mergeCustomerData(array $pythonResult, array $qwenData, array $metrics): array
    {
        return [
            'account_health_score' => $pythonResult['account_health_score'],
            'loyalty_status' => $pythonResult['loyalty_status'],
            'executive_summary' => !empty($qwenData['executive_summary']) ? $qwenData['executive_summary'] : $pythonResult['executive_summary'],
            'buying_habits' => [
                'pattern' => !empty($qwenData['buying_habits']['pattern']) ? $qwenData['buying_habits']['pattern'] : $pythonResult['buying_habits']['pattern'],
                'favorite_categories' => !empty($qwenData['buying_habits']['favorite_categories']) ? $qwenData['buying_habits']['favorite_categories'] : $pythonResult['buying_habits']['favorite_categories'],
                'order_characteristics' => !empty($qwenData['buying_habits']['order_characteristics']) ? $qwenData['buying_habits']['order_characteristics'] : $pythonResult['buying_habits']['order_characteristics'],
            ],
            'sales_growth_opportunities' => !empty($qwenData['sales_growth_opportunities']) && is_array($qwenData['sales_growth_opportunities'])
                ? $qwenData['sales_growth_opportunities']
                : $pythonResult['sales_growth_opportunities'],
            'risk_and_drop_alerts' => !empty($qwenData['risk_and_drop_alerts']) && is_array($qwenData['risk_and_drop_alerts'])
                ? $qwenData['risk_and_drop_alerts']
                : $pythonResult['risk_and_drop_alerts'],
            'quick_wins' => !empty($qwenData['quick_wins']) && is_array($qwenData['quick_wins'])
                ? $qwenData['quick_wins']
                : $pythonResult['quick_wins'],
            'analytics_metrics' => $metrics,
        ];
    }
}
