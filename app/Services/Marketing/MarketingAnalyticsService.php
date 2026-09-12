<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class MarketingAnalyticsService
{
    /**
    * Run Python Data Analytics Engine for Overall Performance and enrich with Gemini.
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
        $allCust = $pythonResult['enriched_customers']['allCustomers'] ?? [];
        // Prioritaskan maksimal 25 akun paling krusial agar output LLM tidak terpotong (token cutoff)
        $priorityCustomers = array_slice($allCust, 0, 25);
        $customerDossier = array_map(static function (array $customer): array {
            return array_intersect_key($customer, array_flip([
                'kd_cs', 'nm_cs', 'curr_sales', 'prev_sales', 'growth', 'diff_sales',
                'curr_invoices', 'ai_status', 'ai_action', 'ai_team_action', 'ai_reason',
            ]));
        }, $priorityCustomers);
        $llmContext .= "\n\nDOSSIER CUSTOMER PRIORITAS UNTUK REKOMENDASI (gunakan kode customer apa adanya):\n" . json_encode($customerDossier, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // 2. Teruskan dossier Python ke Gemini untuk narasi dan rekomendasi AI.
        $geminiResult = $this->callGeminiWithDossier('overall', $llmContext, $pythonResult);

        if ($geminiResult && !empty($geminiResult['data'])) {
            // Gabungkan narasi Gemini dengan angka skor presisi Python.
            $mergedData = $this->mergeOverallData($pythonResult, $geminiResult['data'], $metrics);
            $modelName = config('services.gemini.model', 'gemini-3.8-flash');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
            ];
        }

        // 3. Fallback numerik bila Gemini sedang tidak tersedia.
        // Menggunakan output komputasi Python langsung yang sudah terstruktur dan sangat akurat
        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $geminiResult['error'] ?? 'Gemini AI tidak tersedia. Menggunakan hasil analitik data Python.',
            'data' => $pythonResult,
        ];
    }

    /**
    * Run Python Data Analytics Engine for Customer-Specific Performance and enrich with Gemini.
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

        // 2. Teruskan dossier Python ke Gemini untuk narasi dan rekomendasi AI.
        $geminiResult = $this->callGeminiWithDossier('customer', $llmContext, $pythonResult);

        if ($geminiResult && !empty($geminiResult['data'])) {
            $mergedData = $this->mergeCustomerData($pythonResult, $geminiResult['data'], $metrics);
            $modelName = config('services.gemini.model', 'gemini-3.8-flash');

            return [
                'success' => true,
                'cached' => false,
                'engine' => "{$modelName} + Python Analytics Engine (Production)",
                'is_fallback' => false,
                'data' => $mergedData,
            ];
        }

        // 3. Fallback numerik bila Gemini sedang tidak tersedia.
        return [
            'success' => true,
            'cached' => false,
            'engine' => 'Python Data Analytics Engine (Standalone)',
            'is_fallback' => true,
            'notice' => $geminiResult['error'] ?? 'Gemini AI tidak tersedia. Menggunakan hasil analitik data Python.',
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
    * Call Gemini with the pre-computed Python Analytical Dossier.
     *
     * @param string $mode ('overall' | 'customer')
     * @param string $llmContext
     * @param array $pythonResult
     * @return array|null
     */
    private function callGeminiWithDossier(string $mode, string $llmContext, array $pythonResult): ?array
    {
        if ($mode === 'customer') {
            $systemPrompt = <<<PROMPT
Anda adalah Senior Key Account Commercial Manager & B2B Sales Intelligence Analyst.
Tugas Anda: Menganalisis profil transaksi dan KPI akun pelanggan B2B ini berdasarkan FAKTA ANALITIK DATA MATEMATIS dari Python Engine (RFM, Volatilitas CV, dan Pola Pembelian).
Pedoman Analisis:
1. Jadikan data numerik Python sebagai fakta mutlak (GROUND TRUTH). Jangan mengubah angka, skor kesehatan akun, atau persentase.
2. Tuliskan analisis dengan bahasa Indonesia bisnis profesional, taktis, padat, dan langsung pada solusi (maksimal 1-2 kalimat per poin).
3. Analisis harus spesifik terhadap dossier akun ini: sebutkan pola, material, tren, nominal, atau risiko yang benar-benar ada. Jangan memakai template rekomendasi yang sama untuk semua customer.
4. Bedakan tindakan berdasarkan kondisi aktual akun; jangan mengulang action Python jika ada insight yang lebih tepat dari data.
5. Output WAJIB berupa JSON murni tanpa markdown ```json.

Struktur JSON WAJIB:
{
  "account_health_score": 75,
  "loyalty_status": "Reguler",
  "executive_summary": "<1 paragraf ringkas (2-3 kalimat) profil pembelian dan potensi komersial akun>",
  "buying_habits": {
    "pattern": "<pola pembelian akun>",
    "favorite_categories": "<kategori material favorit>",
    "order_characteristics": "<karakteristik pemesanan>"
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
3. Setiap kesimpulan harus mengikuti data periode aktif. Gunakan nama customer, nominal, persentase, tren, dan material dari dossier; jangan membuat rekomendasi generik yang bisa berlaku sama untuk semua kasus.
4. Untuk customer_recommendations, berikan rekomendasi untuk akun-akun pada dossier prioritas (fokus pada akun VIP, akun menurun/at-risk, atau anomali Z-score).
5. Jangan menyalin mentah ai_status atau ai_action Python; gunakan hasil Python sebagai sinyal awal lalu berikan sintesis komersial yang lebih kontekstual.
6. Output WAJIB berupa JSON murni tanpa markdown ```json.

Struktur JSON WAJIB:
{
  "health_score": 75,
  "status_label": "Kuat",
  "executive_summary": "<1 paragraf padat (2-3 kalimat) ringkasan pencapaian penjualan periode ini vs periode lalu>",
  "pareto_risk_analysis": {
    "top5_share_percent": 65.0,
    "risk_level": "Sedang",
    "evaluation": "<1-2 kalimat evaluasi risiko konsentrasi pendapatan>"
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
  ],
  "customer_recommendations": [
    {
      "customer_code": "<kode customer dari dossier>",
      "status": "<status performa singkat>",
      "team_action": "<aksi tim yang spesifik>",
      "recommendation": "<rekomendasi penjualan/marketing spesifik>",
      "reason": "<alasan berbasis angka dossier>"
    }
  ]
}
PROMPT;

            $userPrompt = "Berikut adalah dossier analitik data dari Python Engine:\n" . $llmContext . "\n\nSintesiskan menjadi laporan analitik kinerja penjualan dan rekomendasi strategis CCO sesuai format JSON di atas.";
        }

        return app(GeminiAnalyticsService::class)->generateJson($systemPrompt, $userPrompt);
    }

    /**
    * Merge Python analytical metrics with Gemini-generated narrative for Overall Performance.
     *
     * @param array $pythonResult
    * @param array $geminiData
     * @param array $metrics
     * @return array
     */
    private function mergeOverallData(array $pythonResult, array $geminiData, array $metrics): array
    {
        $aiByCustomer = [];
        foreach ($geminiData['customer_recommendations'] ?? [] as $recommendation) {
            $code = strtolower(trim((string) ($recommendation['customer_code'] ?? '')));
            if ($code !== '') {
                $aiByCustomer[$code] = $recommendation;
            }
        }

        $allCustomers = array_map(static function (array $customer) use ($aiByCustomer): array {
            $code = strtolower(trim((string) ($customer['kd_cs'] ?? '')));
            $ai = $aiByCustomer[$code] ?? null;
            if (is_array($ai)) {
                $customer['ai_status'] = $ai['status'] ?? $customer['ai_status'] ?? $customer['status'] ?? 'Evaluasi AI';
                $customer['ai_action'] = $ai['recommendation'] ?? $customer['ai_action'] ?? '';
                $customer['ai_team_action'] = $ai['team_action'] ?? $customer['ai_team_action'] ?? '';
                $customer['ai_reason'] = $ai['reason'] ?? $customer['ai_reason'] ?? '';
                $customer['status'] = $customer['ai_status'];
            }
            return $customer;
        }, $pythonResult['enriched_customers']['allCustomers'] ?? []);

        $customerLists = $pythonResult['enriched_customers'] ?? [];
        $customerLists['allCustomers'] = $allCustomers;
        $customerByCode = [];
        foreach ($allCustomers as $customer) {
            $customerByCode[strtolower(trim((string) ($customer['kd_cs'] ?? '')))] = $customer;
        }
        foreach (['topCustomers', 'lowestCustomers', 'decliningCustomers'] as $listName) {
            $customerLists[$listName] = array_map(
                static fn (array $customer): array => $customerByCode[strtolower(trim((string) ($customer['kd_cs'] ?? '')))] ?? $customer,
                $customerLists[$listName] ?? []
            );
        }

        return [
            // Skor kesehatan dan label status selalu diikat ke perhitungan matematis Python
            'health_score' => $pythonResult['health_score'],
            'status_label' => $pythonResult['status_label'],
            'executive_summary' => !empty($geminiData['executive_summary']) ? $geminiData['executive_summary'] : $pythonResult['executive_summary'],
            'pareto_risk_analysis' => [
                'top5_share_percent' => $pythonResult['pareto_risk_analysis']['top5_share_percent'],
                'risk_level' => $pythonResult['pareto_risk_analysis']['risk_level'],
                'evaluation' => !empty($geminiData['pareto_risk_analysis']['evaluation']) ? $geminiData['pareto_risk_analysis']['evaluation'] : $pythonResult['pareto_risk_analysis']['evaluation'],
            ],
            'critical_areas_to_fix' => !empty($geminiData['critical_areas_to_fix']) && is_array($geminiData['critical_areas_to_fix'])
                ? $geminiData['critical_areas_to_fix']
                : $pythonResult['critical_areas_to_fix'],
            'tactical_recommendations' => !empty($geminiData['tactical_recommendations']) && is_array($geminiData['tactical_recommendations'])
                ? $geminiData['tactical_recommendations']
                : $pythonResult['tactical_recommendations'],
            'quick_wins' => !empty($geminiData['quick_wins']) && is_array($geminiData['quick_wins'])
                ? $geminiData['quick_wins']
                : $pythonResult['quick_wins'],
            'enriched_customers' => $customerLists,
            'analytics_metrics' => $metrics,
        ];
    }

    /**
    * Merge Python analytical metrics with Gemini-generated narrative for Customer Performance.
     *
     * @param array $pythonResult
    * @param array $geminiData
     * @param array $metrics
     * @return array
     */
    private function mergeCustomerData(array $pythonResult, array $geminiData, array $metrics): array
    {
        return [
            'account_health_score' => $pythonResult['account_health_score'],
            'loyalty_status' => $pythonResult['loyalty_status'],
            'executive_summary' => !empty($geminiData['executive_summary']) ? $geminiData['executive_summary'] : $pythonResult['executive_summary'],
            'buying_habits' => [
                'pattern' => !empty($geminiData['buying_habits']['pattern']) ? $geminiData['buying_habits']['pattern'] : $pythonResult['buying_habits']['pattern'],
                'favorite_categories' => !empty($geminiData['buying_habits']['favorite_categories']) ? $geminiData['buying_habits']['favorite_categories'] : $pythonResult['buying_habits']['favorite_categories'],
                'order_characteristics' => !empty($geminiData['buying_habits']['order_characteristics']) ? $geminiData['buying_habits']['order_characteristics'] : $pythonResult['buying_habits']['order_characteristics'],
            ],
            'sales_growth_opportunities' => !empty($geminiData['sales_growth_opportunities']) && is_array($geminiData['sales_growth_opportunities'])
                ? $geminiData['sales_growth_opportunities']
                : $pythonResult['sales_growth_opportunities'],
            'risk_and_drop_alerts' => !empty($geminiData['risk_and_drop_alerts']) && is_array($geminiData['risk_and_drop_alerts'])
                ? $geminiData['risk_and_drop_alerts']
                : $pythonResult['risk_and_drop_alerts'],
            'quick_wins' => !empty($geminiData['quick_wins']) && is_array($geminiData['quick_wins'])
                ? $geminiData['quick_wins']
                : $pythonResult['quick_wins'],
            'analytics_metrics' => $metrics,
        ];
    }
}
