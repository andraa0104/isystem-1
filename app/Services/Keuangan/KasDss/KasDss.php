<?php

namespace App\Services\Keuangan\KasDss;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;

class KasDss
{
    private int $nbBuckets = 4096;

    public function voucherTypeForAkun(string $kodeAkun): string
    {
        $a = strtoupper(trim((string) $kodeAkun));
        if ($a === '') return 'BV';

        // Company rule:
        // - CV = Cash Voucher -> kas tunai
        // - GV = Giro Voucher -> kas bank giro
        // - BV = Bank Voucher -> kas bank 1
        // - SC = Second cash/bank table in the legacy VB6 flow -> kas bank 2
        if (str_starts_with($a, '1101')) return 'CV';
        if (str_starts_with($a, '1102')) return 'GV';
        if (str_starts_with($a, '1103')) return 'BV';
        if (str_starts_with($a, '1104')) return 'SC';
        return 'BV';
    }

    /**
     * Learn from `tb_jurnal` + `tb_jurnaldetail` (fallback for new/unseen wording).
     *
     * Columns aligned with `JurnalUmumController.php`:
     * - tb_jurnal: Kode_Jurnal, Tgl_Jurnal, (optional) Kode_Voucher, (optional) Remark
     * - tb_jurnaldetail: Kode_Jurnal, Kode_Akun, Debit, Kredit
     *
     * @return array{cash:array<string,float>,lawan:array<string,float>,evidence:array<int,array<string,mixed>>}
     */
    private function jurnalVotes(string $mode, string $keterangan): array
    {
        $mode = in_array($mode, ['in', 'out'], true) ? $mode : 'out';
        $normQ = KasText::normalize($keterangan);
        $qTf = KasText::tokensWithEmphasis($keterangan, 12);
        $tokens = array_keys($qTf);
        if (count($tokens) === 0) {
            return ['cash' => [], 'lawan' => [], 'evidence' => []];
        }

        if (!Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnaldetail')) {
            return ['cash' => [], 'lawan' => [], 'evidence' => []];
        }
        foreach (['Kode_Jurnal', 'Tgl_Jurnal'] as $c) {
            if (!Schema::hasColumn('tb_jurnal', $c)) return ['cash' => [], 'lawan' => [], 'evidence' => []];
        }
        foreach (['Kode_Jurnal', 'Kode_Akun', 'Debit', 'Kredit'] as $c) {
            if (!Schema::hasColumn('tb_jurnaldetail', $c)) return ['cash' => [], 'lawan' => [], 'evidence' => []];
        }

        $jCols = Schema::getColumnListing('tb_jurnal');
        $hasVoucher = in_array('Kode_Voucher', $jCols, true);
        $hasRemark = in_array('Remark', $jCols, true);

        try {
            $end = Carbon::now()->endOfDay()->toDateString();
            $start = Carbon::now()->subMonthsNoOverflow(30)->startOfDay()->toDateString();

            $jq = DB::table('tb_jurnal as j')
                ->whereBetween('j.Tgl_Jurnal', [$start, $end]);

            $jq->where(function ($w) use ($tokens, $hasVoucher, $hasRemark) {
                foreach (array_slice($tokens, 0, 6) as $t) {
                    if ($hasRemark) $w->orWhereRaw('LOWER(j.Remark) like ?', ['%' . $t . '%']);
                    if ($hasVoucher) $w->orWhereRaw('LOWER(j.Kode_Voucher) like ?', ['%' . $t . '%']);
                    $w->orWhereRaw('LOWER(j.Kode_Jurnal) like ?', ['%' . $t . '%']);
                }
            });

            $raw = $jq->orderByDesc('j.Tgl_Jurnal')
                ->orderByDesc('j.Kode_Jurnal')
                ->limit(220)
                ->get([
                    'j.Kode_Jurnal',
                    'j.Tgl_Jurnal',
                    $hasVoucher ? 'j.Kode_Voucher' : DB::raw("'' as Kode_Voucher"),
                    $hasRemark ? 'j.Remark' : DB::raw("'' as Remark"),
                ]);

            if ($raw->count() === 0) {
                return ['cash' => [], 'lawan' => [], 'evidence' => []];
            }

            $kodeList = $raw->pluck('Kode_Jurnal')
                ->map(fn ($v) => trim((string) $v))
                ->filter()
                ->values()
                ->all();

            if (count($kodeList) === 0) {
                return ['cash' => [], 'lawan' => [], 'evidence' => []];
            }

            // Per-journal score based on query-token hits in remark/voucher/journal code.
            $scoreByKode = [];
            $evidence = [];
            foreach ($raw as $r) {
                $kj = trim((string) ($r->Kode_Jurnal ?? ''));
                if ($kj === '') continue;
                $txt = trim((string) ($r->Remark ?? ''));
                $txt .= ' ' . trim((string) ($r->Kode_Voucher ?? ''));
                $txt .= ' ' . $kj;
                $n = KasText::normalize($txt);
                $hits = 0;
                foreach ($tokens as $t) {
                    if ($t !== '' && $n !== '' && str_contains($n, $t)) $hits++;
                }
                $score = max(0.2, min(3.0, 0.25 * $hits));
                $scoreByKode[$kj] = $score;

                if (count($evidence) < 3) {
                    $evidence[] = [
                        'Kode_Jurnal' => $kj,
                        'Tgl_Jurnal' => (string) ($r->Tgl_Jurnal ?? ''),
                        'Kode_Voucher' => (string) ($r->Kode_Voucher ?? ''),
                        'Remark' => (string) ($r->Remark ?? ''),
                        'score' => round($score, 4),
                    ];
                }
            }

            $details = DB::table('tb_jurnaldetail as d')
                ->whereIn('d.Kode_Jurnal', $kodeList)
                ->get([
                    'd.Kode_Jurnal',
                    'd.Kode_Akun',
                    DB::raw('COALESCE(d.Debit,0) as Debit'),
                    DB::raw('COALESCE(d.Kredit,0) as Kredit'),
                ]);

            $cashVotes = [];
            $lawanVotes = [];
            foreach ($details as $d) {
                $kj = trim((string) ($d->Kode_Jurnal ?? ''));
                $w = (float) ($scoreByKode[$kj] ?? 0.0);
                if ($w <= 0) continue;
                $akun = trim((string) ($d->Kode_Akun ?? ''));
                if ($akun === '') continue;
                $debit = (float) ($d->Debit ?? 0);
                $kredit = (float) ($d->Kredit ?? 0);

                if ($mode === 'out') {
                    // Cash out journal: credit cash/bank, debit expense.
                    if ($kredit > 0) $cashVotes[$akun] = ($cashVotes[$akun] ?? 0) + $w;
                    if ($debit > 0 && !in_array($akun, ['1100AD', '1200AD'], true)) $lawanVotes[$akun] = ($lawanVotes[$akun] ?? 0) + $w;
                } else {
                    // Cash in journal: debit cash/bank, credit revenue.
                    if ($debit > 0) $cashVotes[$akun] = ($cashVotes[$akun] ?? 0) + $w;
                    if ($kredit > 0 && !in_array($akun, ['1100AD', '1200AD'], true)) $lawanVotes[$akun] = ($lawanVotes[$akun] ?? 0) + $w;
                }
            }

            return ['cash' => $cashVotes, 'lawan' => $lawanVotes, 'evidence' => $evidence];
        } catch (\Throwable) {
            return ['cash' => [], 'lawan' => [], 'evidence' => []];
        }
    }

    private function normalizeTo01(array $scores): array
    {
        if (count($scores) === 0) return [];
        $max = max($scores);
        if ($max <= 0) return array_map(fn () => 0.0, $scores);
        $out = [];
        foreach ($scores as $k => $v) {
            $out[$k] = (float) $v / $max;
        }
        return $out;
    }

    private function softmax01(array $logScores): array
    {
        if (count($logScores) === 0) return [];
        $max = max($logScores);
        $tmp = [];
        foreach ($logScores as $k => $v) {
            $tmp[$k] = exp(((float) $v) - $max);
        }
        $sum = array_sum($tmp);
        if ($sum <= 0) return $this->normalizeTo01($tmp);
        $out = [];
        foreach ($tmp as $k => $v) {
            $out[$k] = (float) $v / $sum;
        }
        return $out;
    }

    /**
     * Build Naive Bayes model using hashing buckets (memory-safe).
     *
     * @return array{labels:string[],docCount:array<string,int>,totalDocs:int,counts:array<string,array<int,int>>,totalCounts:array<string,int>,V:int}
     */
    private function getNbModel(string $mode, string $target): array
    {
        $mode = in_array($mode, ['in', 'out'], true) ? $mode : 'out';
        $target = in_array($target, ['cash', 'lawan'], true) ? $target : 'lawan';

        $cacheKey = "kas_dss_nb_v2:{$mode}:{$target}";
        return Cache::remember($cacheKey, now()->addHours(6), function () use ($mode, $target) {
            $limit = 20000;
            $cols = Schema::getColumnListing('tb_kas');
            $hasNom2 = in_array('Nominal2', $cols, true);
            $hasNom3 = in_array('Nominal3', $cols, true);

            $q = DB::table('tb_kas as k')
                ->whereNotNull('k.Kode_Akun')
                ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''");
            if ($mode === 'in') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
            if ($mode === 'out') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');

            $rows = $q->orderByDesc('k.Tgl_Voucher')
                ->orderByDesc('k.Kode_Voucher')
                ->limit($limit)
                ->get([
                    'k.Kode_Akun',
                    'k.Keterangan',
                    'k.Kode_Akun1', 'k.Nominal1',
                    'k.Kode_Akun2', $hasNom2 ? 'k.Nominal2' : DB::raw('0 as Nominal2'),
                    'k.Kode_Akun3', $hasNom3 ? 'k.Nominal3' : DB::raw('0 as Nominal3'),
                ]);

            $cashCount = [];
            $lawanCount = [];
            foreach ($rows as $r) {
                $cash = trim((string) ($r->Kode_Akun ?? ''));
                if ($cash !== '') $cashCount[$cash] = ($cashCount[$cash] ?? 0) + 1;

                foreach ([1, 2, 3] as $slot) {
                    $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    if ($akun === '' || $nom <= 0) continue;
                    if ($slot === 2) continue;
                    if (in_array($akun, ['1100AD', '1200AD'], true)) continue;
                    $lawanCount[$akun] = ($lawanCount[$akun] ?? 0) + 1;
                }
            }

            arsort($cashCount);
            arsort($lawanCount);
            $cashLabels = array_slice(array_keys($cashCount), 0, 20);
            $lawanLabels = array_slice(array_keys($lawanCount), 0, 300);
            $labels = $target === 'cash' ? $cashLabels : $lawanLabels;

            $docCount = [];
            $counts = [];
            $totalCounts = [];

            foreach ($labels as $lab) {
                $docCount[$lab] = 0;
                $counts[$lab] = [];
                $totalCounts[$lab] = 0;
            }

            foreach ($rows as $r) {
                $text = KasText::normalize((string) ($r->Keterangan ?? ''));
                if ($text === '') continue;
                $tokenTf = KasText::tokens($text, 28);
                $tri = KasText::trigrams($text, 40);

                $features = [];
                foreach ($tokenTf as $t => $tf) {
                    $features[] = ['f' => "t:$t", 'tf' => (int) $tf];
                }
                foreach ($tri as $g) {
                    $features[] = ['f' => "g:$g", 'tf' => 1];
                }

                if ($target === 'cash') {
                    $label = trim((string) ($r->Kode_Akun ?? ''));
                    if ($label === '' || !isset($docCount[$label])) continue;
                    $docCount[$label]++;
                    foreach ($features as $f) {
                        $b = (int) (crc32($f['f']) % $this->nbBuckets);
                        $counts[$label][$b] = ($counts[$label][$b] ?? 0) + (int) $f['tf'];
                        $totalCounts[$label] += (int) $f['tf'];
                    }
                    continue;
                }

                $targets = [];
                foreach ([1, 3] as $slot) {
                    $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    if ($akun === '' || $nom <= 0) continue;
                    if (in_array($akun, ['1100AD', '1200AD'], true)) continue;
                    if (isset($docCount[$akun])) $targets[$akun] = true;
                }
                if (count($targets) === 0) continue;

                foreach (array_keys($targets) as $label) {
                    $docCount[$label]++;
                    foreach ($features as $f) {
                        $b = (int) (crc32($f['f']) % $this->nbBuckets);
                        $counts[$label][$b] = ($counts[$label][$b] ?? 0) + (int) $f['tf'];
                        $totalCounts[$label] += (int) $f['tf'];
                    }
                }
            }

            $totalDocs = array_sum($docCount);
            return [
                'labels' => $labels,
                'docCount' => $docCount,
                'totalDocs' => (int) $totalDocs,
                'counts' => $counts,
                'totalCounts' => $totalCounts,
                'V' => $this->nbBuckets,
            ];
        });
    }

    /**
     * @return array<string,float> label => logScore
     */
    private function nbScore(array $model, string $text): array
    {
        $norm = KasText::normalize($text);
        if ($norm === '' || ($model['totalDocs'] ?? 0) <= 0) return [];

        $tokenTf = KasText::tokens($norm, 28);
        $tri = KasText::trigrams($norm, 40);
        $features = [];
        foreach ($tokenTf as $t => $tf) $features[] = ['f' => "t:$t", 'tf' => (int) $tf];
        foreach ($tri as $g) $features[] = ['f' => "g:$g", 'tf' => 1];

        $labels = $model['labels'] ?? [];
        $docCount = $model['docCount'] ?? [];
        $counts = $model['counts'] ?? [];
        $totalCounts = $model['totalCounts'] ?? [];
        $totalDocs = (int) ($model['totalDocs'] ?? 0);
        $V = (int) ($model['V'] ?? $this->nbBuckets);

        $out = [];
        foreach ($labels as $label) {
            $dc = (int) ($docCount[$label] ?? 0);
            if ($dc <= 0) continue;
            $logPrior = log($dc / $totalDocs);
            $total = (int) ($totalCounts[$label] ?? 0);
            $log = $logPrior;
            foreach ($features as $f) {
                $b = (int) (crc32($f['f']) % $this->nbBuckets);
                $c = (int) (($counts[$label][$b] ?? 0) + 1);
                $den = (float) ($total + $V);
                $log += ((int) $f['tf']) * log($c / $den);
            }
            $out[$label] = $log;
        }
        return $out;
    }

    private function bm25Score(array $queryTf, array $docTf, float $docLen, float $avgLen, array $idf): float
    {
        if ($docLen <= 0) return 0.0;
        $k1 = 1.2;
        $b = 0.75;
        $score = 0.0;
        foreach ($queryTf as $t => $qtf) {
            $tf = (float) ($docTf[$t] ?? 0);
            if ($tf <= 0) continue;
            $id = (float) ($idf[$t] ?? 0.0);
            $den = $tf + $k1 * (1 - $b + $b * ($docLen / max(1.0, $avgLen)));
            $qWeight = 1.0 + log(1.0 + max(0.0, (float) $qtf));
            $score += $qWeight * $id * ($tf * ($k1 + 1) / $den);
        }
        return $score;
    }

    private function jaccard(array $a, array $b): float
    {
        if (count($a) === 0 || count($b) === 0) return 0.0;
        $sa = array_fill_keys($a, true);
        $sb = array_fill_keys($b, true);
        $inter = 0;
        foreach ($sa as $k => $_) {
            if (isset($sb[$k])) $inter++;
        }
        $union = count($sa) + count($sb) - $inter;
        return $union > 0 ? ($inter / $union) : 0.0;
    }

    private function topKey(array $scores): string
    {
        if (count($scores) === 0) return '';
        arsort($scores);
        $key = array_key_first($scores);
        return is_string($key) ? $key : '';
    }

    private function addScores(array &$target, array $scores, float $weight): void
    {
        foreach ($scores as $key => $score) {
            $key = trim((string) $key);
            $score = (float) $score;
            if ($key === '' || $score <= 0) continue;
            $target[$key] = ($target[$key] ?? 0.0) + ($score * $weight);
        }
    }

    private function isValidAccountSeed(string $akun): bool
    {
        $akun = strtoupper(trim($akun));
        return $akun !== '' && !str_contains($akun, 'XX') && !in_array($akun, ['1100AD', '1200AD'], true);
    }

    private function pythonPredictUrl(): string
    {
        return rtrim((string) env('KAS_DSS_PYTHON_URL', 'http://127.0.0.1:8000'), '/') . '/predict';
    }

    private function startPythonServiceIfNeeded(string $url): void
    {
        try {
            Http::timeout(1)->acceptJson()->post($url, [
                'mode' => 'out',
                'keterangan' => '__healthcheck__',
                'nominal' => 0,
                'hasPpn' => false,
                'ppnNominal' => 0,
                'seedAkun' => '',
            ]);
            return;
        } catch (\Throwable) {
            // Try to start the optional Python service below.
        }

        $dir = base_path('app/Services/Keuangan/KasDss/python_ml');
        $python = $dir . '/venv/bin/python';
        $main = $dir . '/main.py';
        if (!is_file($python) || !is_file($main)) return;

        try {
            $log = storage_path('logs/kas-dss-python.log');
            $sitePackages = glob($dir . '/venv/lib/python*/site-packages');
            $pythonPath = is_array($sitePackages) && isset($sitePackages[0]) ? (string) $sitePackages[0] : '';
            $cmd = sprintf(
                'cd %s && PYTHONPATH=%s nohup %s -m uvicorn main:app --host 127.0.0.1 --port 8000 >> %s 2>&1 &',
                escapeshellarg($dir),
                escapeshellarg($pythonPath),
                escapeshellarg($python),
                escapeshellarg($log)
            );
            Process::fromShellCommandline($cmd)->setTimeout(3)->run();
            for ($i = 0; $i < 10; $i++) {
                usleep(500000);
                try {
                    Http::timeout(1)->acceptJson()->post($url, [
                        'mode' => 'out',
                        'keterangan' => '__healthcheck__',
                        'nominal' => 0,
                        'hasPpn' => false,
                        'ppnNominal' => 0,
                        'seedAkun' => '',
                    ]);
                    return;
                } catch (\Throwable) {
                    // Keep waiting until the startup window expires.
                }
            }
        } catch (\Throwable) {
            // The caller will fall back to the PHP recommender.
        }
    }

    /**
     * Fallback in-process recommender. Keeps AI suggestions working when the
     * optional Python prediction service is not running.
     */
    private function suggestLocal(array $input, array $defaultResp): array
    {
        $mode = in_array(($input['mode'] ?? ''), ['in', 'out'], true) ? $input['mode'] : 'out';
        $keterangan = trim((string) ($input['keterangan'] ?? ''));
        $nominal = max(0.0, (float) ($input['nominal'] ?? 0));
        $hasPpn = (bool) ($input['hasPpn'] ?? false);
        $ppnNominal = max(0.0, (float) ($input['ppnNominal'] ?? 0));
        $seedAkun = trim((string) ($input['seedAkun'] ?? ''));

        $cashScores = [];
        $lawanScores = [];
        $evidence = [];

        $jurnal = $this->jurnalVotes($mode, $keterangan);
        $this->addScores($cashScores, $this->normalizeTo01($jurnal['cash'] ?? []), 0.35);
        $this->addScores($lawanScores, $this->normalizeTo01($jurnal['lawan'] ?? []), 0.35);
        $evidence = array_slice($jurnal['evidence'] ?? [], 0, 3);

        if (Schema::hasTable('tb_kas')) {
            $cashNb = $this->softmax01($this->nbScore($this->getNbModel($mode, 'cash'), $keterangan));
            $lawanNb = $this->softmax01($this->nbScore($this->getNbModel($mode, 'lawan'), $keterangan));
            $this->addScores($cashScores, $cashNb, 0.45);
            $this->addScores($lawanScores, $lawanNb, 0.45);

            try {
                $cols = Schema::getColumnListing('tb_kas');
                $hasNom2 = in_array('Nominal2', $cols, true);
                $hasNom3 = in_array('Nominal3', $cols, true);

                $q = DB::table('tb_kas as k')
                    ->whereNotNull('k.Kode_Akun')
                    ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''");
                if ($mode === 'in') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
                if ($mode === 'out') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');

                $tokens = KasText::tokens(KasText::normalize($keterangan), 12);
                if (count($tokens) > 0) {
                    $q->where(function ($w) use ($tokens) {
                        foreach (array_slice(array_keys($tokens), 0, 6) as $t) {
                            $w->orWhereRaw('LOWER(k.Keterangan) like ?', ['%' . $t . '%']);
                        }
                    });
                }

                $rows = $q->orderByDesc('k.Tgl_Voucher')
                    ->orderByDesc('k.Kode_Voucher')
                    ->limit(120)
                    ->get([
                        'k.Kode_Voucher', 'k.Tgl_Voucher', 'k.Kode_Akun', 'k.Keterangan',
                        'k.Kode_Akun1', 'k.Nominal1',
                        'k.Kode_Akun2', $hasNom2 ? 'k.Nominal2' : DB::raw('0 as Nominal2'),
                        'k.Kode_Akun3', $hasNom3 ? 'k.Nominal3' : DB::raw('0 as Nominal3'),
                    ]);

                foreach ($rows as $idx => $r) {
                    $weight = max(0.2, 1.0 - ((float) $idx / 160.0));
                    $cash = trim((string) ($r->Kode_Akun ?? ''));
                    if ($cash !== '') $cashScores[$cash] = ($cashScores[$cash] ?? 0.0) + (0.20 * $weight);

                    foreach ([1, 3] as $slot) {
                        $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                        $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                        if ($akun === '' || $nom <= 0 || in_array($akun, ['1100AD', '1200AD'], true)) continue;
                        $lawanScores[$akun] = ($lawanScores[$akun] ?? 0.0) + (0.20 * $weight);
                    }

                    if (count($evidence) < 3) {
                        $evidence[] = [
                            'Kode_Voucher' => (string) ($r->Kode_Voucher ?? ''),
                            'Tgl_Voucher' => (string) ($r->Tgl_Voucher ?? ''),
                            'Keterangan' => (string) ($r->Keterangan ?? ''),
                            'score' => round($weight, 4),
                        ];
                    }
                }
            } catch (\Throwable) {
                // Keep the default response if local history cannot be queried.
            }
        }

        if ($this->isValidAccountSeed($seedAkun)) $lawanScores[$seedAkun] = ($lawanScores[$seedAkun] ?? 0.0) + 0.5;

        $cash = $this->topKey($cashScores);
        $lawan = $this->topKey($lawanScores);
        $cashConfidence = count($cashScores) ? min(0.95, max($cashScores)) : 0.0;
        $lawanConfidence = count($lawanScores) ? min(0.95, max($lawanScores)) : 0.0;

        $lines = [];
        if ($lawan !== '') {
            $lines[] = [
                'akun' => $lawan,
                'jenis' => $mode === 'in' ? 'Kredit' : 'Debit',
                'nominal' => $nominal,
            ];
        }

        return array_merge($defaultResp, [
            'kode_akun' => $cash,
            'voucher_type' => $cash !== '' ? $this->voucherTypeForAkun($cash) : $defaultResp['voucher_type'],
            'ppn_akun' => ($hasPpn && $ppnNominal > 0) ? ($defaultResp['ppn_akun'] ?: $seedAkun) : '',
            'lines' => $lines,
            'confidence' => [
                'overall' => max($cashConfidence, $lawanConfidence),
                'cash' => $cashConfidence,
                'lawan' => $lawanConfidence,
                'ppn' => ($hasPpn && $ppnNominal > 0 && ($defaultResp['ppn_akun'] ?: $seedAkun) !== '') ? 0.5 : 0.0,
            ],
            'evidence' => $evidence,
        ]);
    }

    /**
     * Main recommendation API (kNN + Naive Bayes ensemble).
     */
    public function suggest(array $input): array
    {
        $mode = in_array(($input['mode'] ?? ''), ['in', 'out'], true) ? $input['mode'] : 'out';
        $keterangan = (string) ($input['keterangan'] ?? '');
        $nominal = (float) ($input['nominal'] ?? 0);
        $nominal = max(0.0, $nominal);
        $hasPpn = (bool) ($input['hasPpn'] ?? false);
        $ppnNominal = (float) ($input['ppnNominal'] ?? 0);
        $ppnNominal = max(0.0, $ppnNominal);
        $seedAkun = trim((string) ($input['seedAkun'] ?? ''));

        $ppnJenis = $mode === 'in' ? 'Kredit' : 'Debit';
        $keteranganSuggest = $keterangan !== '' ? $keterangan : ($mode === 'in' ? 'Mutasi Kas Masuk' : 'Mutasi Kas Keluar');

        $defaultResp = [
            'kode_akun' => '',
            'voucher_type' => 'BV',
            'ppn_akun' => ($hasPpn && $ppnNominal > 0) ? $seedAkun : '',
            'ppn_jenis' => $ppnJenis,
            'keterangan' => $keteranganSuggest,
            'lines' => [],
            'confidence' => ['overall' => 0.0, 'cash' => 0.0, 'lawan' => 0.0, 'ppn' => 0.0],
            'evidence' => [],
        ];

        try {
            $url = $this->pythonPredictUrl();
            $this->startPythonServiceIfNeeded($url);
            $payload = [
                'mode' => $mode,
                'keterangan' => $keterangan,
                'nominal' => $nominal,
                'hasPpn' => $hasPpn,
                'ppnNominal' => $ppnNominal,
                'seedAkun' => $seedAkun
            ];
            $resp = Http::timeout(5)->acceptJson()->post($url, $payload);
            
            if ($resp->ok()) {
                $j = $resp->json();
                return [
                    'kode_akun' => $j['kode_akun'] ?? '',
                    'voucher_type' => $j['voucher_type'] ?? 'BV',
                    'ppn_akun' => $j['ppn_akun'] ?? $defaultResp['ppn_akun'],
                    'ppn_jenis' => $j['ppn_jenis'] ?? $ppnJenis,
                    'keterangan' => $j['keterangan'] ?? $keteranganSuggest,
                    'lines' => $j['lines'] ?? [],
                    'confidence' => $j['confidence'] ?? $defaultResp['confidence'],
                    'evidence' => $j['evidence'] ?? [],
                ];
            }
        } catch (\Throwable $e) {
            // fallback gracefully
        }

        return $this->suggestLocal($input, $defaultResp);
    }
}
