<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiAnalyticsService
{
    public function generateJson(string $systemPrompt, string $userPrompt): array
    {
        $apiKey = (string) config('services.gemini.api_key', '');
        $model = (string) config('services.gemini.model', 'gemini-3.8-flash');
        $timeout = max(10, (int) config('services.gemini.timeout', 60));

        if ($apiKey === '') {
            return [
                'data' => null,
                'error' => 'Gemini configuration error: GEMINI_API_KEY belum dikonfigurasi di server.',
                'error_code' => 'MISSING_API_KEY',
            ];
        }

        try {
            $response = Http::connectTimeout(5)
                ->timeout($timeout)
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                    'systemInstruction' => [
                        'parts' => [['text' => $systemPrompt]],
                    ],
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [['text' => $userPrompt]],
                    ]],
                    'generationConfig' => [
                        'temperature' => 0.15,
                        'topP' => 0.85,
                        'maxOutputTokens' => 4096,
                        'responseMimeType' => 'application/json',
                    ],
                ]);

            if (!$response->successful()) {
                $status = $response->status();
                $apiMessage = (string) data_get($response->json(), 'error.message', 'Tidak ada detail dari provider.');
                $apiMessage = str_replace($apiKey, '[REDACTED]', $apiMessage);
                $category = match ($status) {
                    400 => 'invalid request/model atau parameter Gemini',
                    401, 403 => 'API key ditolak atau tidak memiliki izin',
                    429 => 'kuota free/rate limit Gemini habis atau terlalu banyak request',
                    500, 502, 503, 504 => 'layanan Gemini sedang bermasalah',
                    default => 'error dari provider Gemini',
                };
                $errorCode = $status === 429 ? 'QUOTA_EXCEEDED' : "HTTP_{$status}";
                $error = "[{$errorCode}] Gemini {$category} (HTTP {$status}). Detail: {$apiMessage}";

                Log::warning('Gemini API request failed', [
                    'status' => $status,
                    'error_code' => $errorCode,
                    'provider_message' => $apiMessage,
                ]);

                return ['data' => null, 'error' => $error, 'error_code' => $errorCode];
            }

            $text = trim((string) data_get($response->json(), 'candidates.0.content.parts.0.text', ''));
            $text = preg_replace('/^```(?:json)?\s*/i', '', $text);
            $text = preg_replace('/\s*```$/', '', $text);
            $decoded = json_decode(trim($text), true);

            if (is_array($decoded)) {
                return ['data' => $decoded, 'error' => null];
            }

            return [
                'data' => null,
                'error' => 'Gemini response error: respons berhasil diterima, tetapi format JSON tidak valid.',
                'error_code' => 'INVALID_JSON_RESPONSE',
            ];
        } catch (\Throwable $e) {
            $exceptionMessage = str_replace($apiKey, '[REDACTED]', $e->getMessage());
            Log::warning('Gemini call failed', [
                'exception' => get_class($e),
                'message' => $exceptionMessage,
            ]);

            return [
                'data' => null,
                'error' => "Gemini connection error: {$exceptionMessage}",
                'error_code' => 'CONNECTION_ERROR',
            ];
        }
    }
}