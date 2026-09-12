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
        $timeout = max(10, (int) config('services.gemini.timeout', 90));

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
                        'maxOutputTokens' => 8192,
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

            $rawText = (string) data_get($response->json(), 'candidates.0.content.parts.0.text', '');
            $finishReason = (string) data_get($response->json(), 'candidates.0.finishReason', '');

            $decoded = $this->cleanAndDecodeJson($rawText);

            if (is_array($decoded)) {
                return ['data' => $decoded, 'error' => null];
            }

            Log::warning('Gemini response returned invalid JSON', [
                'finish_reason' => $finishReason,
                'raw_length' => strlen($rawText),
                'raw_preview' => substr($rawText, 0, 500),
                'raw_tail' => substr($rawText, -300),
                'json_error' => json_last_error_msg(),
            ]);

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

    /**
     * Parse and repair JSON from model output.
     */
    private function cleanAndDecodeJson(string $rawText): ?array
    {
        $text = trim($rawText);
        if ($text === '') {
            return null;
        }

        // 1. Direct decode
        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // 2. Strip markdown code fences ```json ... ```
        if (preg_match('/```(?:json)?\s*([\s\S]*?)\s*```/i', $text, $matches)) {
            $extracted = trim($matches[1]);
            $decoded = json_decode($extracted, true);
            if (is_array($decoded)) {
                return $decoded;
            }
            $text = $extracted;
        }

        // 3. Extract outermost JSON object { ... }
        $firstBrace = strpos($text, '{');
        $lastBrace = strrpos($text, '}');
        if ($firstBrace !== false && $lastBrace !== false && $lastBrace > $firstBrace) {
            $subJson = substr($text, $firstBrace, $lastBrace - $firstBrace + 1);
            $decoded = json_decode($subJson, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // 4. Remove trailing commas before closing braces/brackets (, } or , ])
        $cleanCommas = preg_replace('/,\s*([\}\]])/', '$1', $text);
        $decoded = json_decode($cleanCommas, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // 5. Repair truncated JSON (unclosed strings, braces, or brackets due to token limits)
        $repaired = $this->repairTruncatedJson($text);
        if ($repaired !== null) {
            $decoded = json_decode($repaired, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    /**
     * Auto-close unclosed strings, objects, and arrays in truncated JSON.
     */
    private function repairTruncatedJson(string $text): ?string
    {
        $start = strpos($text, '{');
        if ($start === false) {
            return null;
        }
        $json = substr($text, $start);

        $inString = false;
        $escape = false;
        $stack = [];

        $len = strlen($json);
        for ($i = 0; $i < $len; $i++) {
            $char = $json[$i];
            if ($escape) {
                $escape = false;
                continue;
            }
            if ($char === '\\') {
                $escape = true;
                continue;
            }
            if ($char === '"') {
                $inString = !$inString;
                continue;
            }
            if (!$inString) {
                if ($char === '{' || $char === '[') {
                    $stack[] = $char;
                } elseif ($char === '}') {
                    if (!empty($stack) && end($stack) === '{') {
                        array_pop($stack);
                    }
                } elseif ($char === ']') {
                    if (!empty($stack) && end($stack) === '[') {
                        array_pop($stack);
                    }
                }
            }
        }

        // If string is unclosed, close it
        if ($inString) {
            $json .= '"';
        }

        // Strip trailing commas, colons, or incomplete keys at the end
        $json = preg_replace('/,\s*$/', '', $json);
        $json = preg_replace('/:\s*$/', ': null', $json);
        $json = preg_replace('/,\s*"[^"]*"\s*$/', '', $json); // unvalued key at tail

        // Close unclosed brackets/braces in reverse order
        while (!empty($stack)) {
            $open = array_pop($stack);
            $json .= ($open === '{') ? '}' : ']';
        }

        // Strip any trailing commas that might have been introduced
        $json = preg_replace('/,\s*([\}\]])/', '$1', $json);

        return $json;
    }
}