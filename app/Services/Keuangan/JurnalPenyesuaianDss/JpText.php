<?php

namespace App\Services\Keuangan\JurnalPenyesuaianDss;

class JpText
{
    public static function normalize(string $text): string
    {
        $t = trim((string) $text);
        if ($t === '') return '';

        $t = mb_strtolower($t);

        // Jurnal penyesuaian code patterns
        $t = preg_replace('/\\b[a-z0-9]{2,8}\\/jp\\/\\d{4,}\\b/i', '{jp}', $t) ?? $t;

        // Replace long digit sequences to reduce noise (ids, amounts, years)
        $t = preg_replace('/\\b\\d{4,}\\b/', '{#}', $t) ?? $t;

        // Keep only alnum + braces placeholders
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
            'pt', 'cv', 'gv', 'bv', 'jp', 'sja',
            'the', 'a', 'an', 'of', 'to', 'in',
        ];

        $parts = preg_split('/\\s+/', $s) ?: [];
        $out = [];
        foreach ($parts as $p) {
            $p = trim((string) $p);
            if ($p === '' || strlen($p) < 3) continue;
            if (in_array($p, $stop, true)) continue;
            if (preg_match('/^\\{[^}]+\\}$/', $p)) continue; // placeholder tokens not useful for pruning
            $out[$p] = ($out[$p] ?? 0) + 1;
        }

        if (count($out) <= $limit) return $out;
        arsort($out);
        return array_slice($out, 0, $limit, true);
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
}

