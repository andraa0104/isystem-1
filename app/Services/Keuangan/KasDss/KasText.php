<?php

namespace App\Services\Keuangan\KasDss;

class KasText
{
    /**
     * Normalize free-text description so similarity scoring is robust:
     * - lowercase
     * - replace long numbers / document codes with placeholders
     * - keep only alnum + spaces
     */
    public static function normalize(string $text): string
    {
        $t = trim((string) $text);
        if ($t === '') return '';

        $t = mb_strtolower($t);

        // Common document / voucher patterns (keep generic, not module-specific).
        $t = preg_replace('/\\b[a-z0-9]{2,8}\\/(cv|gv|bv)\\/\\d{4,}\\b/i', '{voucher}', $t) ?? $t;
        $t = preg_replace('/\\b[a-z0-9]{2,8}\\/pc\\/\\d{4,}\\b/i', '{pay}', $t) ?? $t;

        // FI / INV / PO / etc with long trailing digits.
        $t = preg_replace('/\\b(fi|inv|invoice|po|do|sj|bkp|bkj)[\\-\\/_ ]?\\d{4,}\\b/i', '{doc}', $t) ?? $t;

        // Replace long digit sequences (years, totals, ids) to reduce noise.
        $t = preg_replace('/\\b\\d{4,}\\b/', '{#}', $t) ?? $t;

        // Keep alnum + braces placeholders.
        $t = preg_replace('/[^a-z0-9{}]+/i', ' ', $t) ?? $t;
        $t = preg_replace('/\\s+/', ' ', $t) ?? $t;

        return trim($t);
    }

    /**
     * @return array<string,int> token => tf
     */
    public static function tokens(string $normalized, int $limit = 24): array
    {
        $limit = max(1, min(60, $limit));
        $s = trim((string) $normalized);
        if ($s === '') return [];

        $stop = [
            'dan', 'atau', 'yang', 'untuk', 'dari', 'ke', 'di', 'pada', 'dengan', 'tanpa',
            'pt', 'cv', 'gv', 'bv', 'pc', 'sja',
            'the', 'a', 'an', 'of', 'to', 'in',
        ];

        $parts = preg_split('/\\s+/', $s) ?: [];
        $out = [];
        foreach ($parts as $p) {
            $p = trim((string) $p);
            if ($p === '' || strlen($p) < 3) continue;
            if (in_array($p, $stop, true)) continue;
            $out[$p] = ($out[$p] ?? 0) + 1;
        }

        if (count($out) <= $limit) return $out;
        arsort($out);
        return array_slice($out, 0, $limit, true);
    }

    /**
     * Tokenize with light emphasis for high-signal parts of text.
     *
     * - Terms inside parentheses (...) get extra weight, because they often carry specific tags
     *   (e.g. BPJS, JHT, Kesehatan, Ketenagakerjaan).
     *
     * @return array<string,int> token => weighted tf
     */
    public static function tokensWithEmphasis(string $rawText, int $limit = 24): array
    {
        $limit = max(1, min(60, $limit));
        $raw = trim((string) $rawText);
        if ($raw === '') return [];

        $norm = self::normalize($raw);
        $base = self::tokens($norm, $limit);

        $parenText = '';
        if (preg_match_all('/\\(([^\\)]{1,120})\\)/', $raw, $m)) {
            $parenText = implode(' ', $m[1] ?? []);
        }
        $parenText = trim((string) $parenText);
        if ($parenText !== '') {
            $parenNorm = self::normalize($parenText);
            $parenTokens = self::tokens($parenNorm, min(12, $limit));
            foreach ($parenTokens as $t => $tf) {
                // +2x weight for parentheses tokens
                $base[$t] = ($base[$t] ?? 0) + (2 * (int) $tf);
            }
        }

        arsort($base);
        return array_slice($base, 0, $limit, true);
    }

    /**
     * @return string[] unique trigrams
     */
    public static function trigrams(string $normalized, int $limit = 64): array
    {
        $limit = max(1, min(200, $limit));
        $s = trim((string) $normalized);
        if ($s === '') return [];

        $s = preg_replace('/\\s+/', '', $s) ?? $s;
        if (strlen($s) < 3) return [];

        $set = [];
        $len = strlen($s);
        for ($i = 0; $i <= $len - 3; $i++) {
            $g = substr($s, $i, 3);
            if ($g === '') continue;
            $set[$g] = true;
            if (count($set) >= $limit) break;
        }

        return array_keys($set);
    }

    public static function extractVoucherType(string $kodeVoucher): string
    {
        $kv = strtoupper(trim((string) $kodeVoucher));
        if ($kv === '') return '';
        if (str_contains($kv, '/CV/')) return 'CV';
        if (str_contains($kv, '/GV/')) return 'GV';
        if (str_contains($kv, '/BV/')) return 'BV';
        return '';
    }
}
