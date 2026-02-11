<?php

namespace App\Services\Keuangan\KasDss;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

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
        // - BV = Bank Voucher -> kas bank 1/2 (and others)
        if (str_starts_with($a, '1101')) return 'CV';
        if (str_starts_with($a, '1102')) return 'GV';
        if (str_starts_with($a, '1103') || str_starts_with($a, '1104')) return 'BV';
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
                    if ($debit > 0) $lawanVotes[$akun] = ($lawanVotes[$akun] ?? 0) + $w;
                } else {
                    // Cash in journal: debit cash/bank, credit revenue.
                    if ($debit > 0) $cashVotes[$akun] = ($cashVotes[$akun] ?? 0) + $w;
                    if ($kredit > 0) $lawanVotes[$akun] = ($lawanVotes[$akun] ?? 0) + $w;
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
                    // Treat slot2 as PPN if it has nominal > 0 (common company standard).
                    if ($slot === 2) continue;
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

                // Build hashed feature list (repeat by tf for multinomial).
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

                // counterpart label(s): slot1/slot3 only
                $targets = [];
                foreach ([1, 3] as $slot) {
                    $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                    $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                    if ($akun === '' || $nom <= 0) continue;
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
            // Use query term weight (qtf) so emphasized tokens (e.g. from parentheses) matter more.
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

    /**
     * Main recommendation API (kNN + Naive Bayes ensemble).
     *
     * @return array{kode_akun:string,voucher_type:string,ppn_akun:string,ppn_jenis:string,keterangan:string,lines:array<int,array{akun:string,jenis:string,nominal:float}>,confidence:array<string,float>,evidence:array<int,array<string,mixed>>}
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

        $normQ = KasText::normalize($keterangan);
        $qTf = KasText::tokensWithEmphasis($keterangan, 16);
        $qTris = KasText::trigrams($normQ, 60);

        // Candidate pruning from tb_kas
        $q = DB::table('tb_kas as k')
            ->whereNotNull('k.Kode_Akun')
            ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''");
        if ($mode === 'in') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
        if ($mode === 'out') $q->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');

        $queryTokens = array_keys($qTf);
        $pruneTokens = array_values(array_filter($queryTokens, function ($t) {
            $t = (string) $t;
            if ($t === '') return false;
            // Avoid placeholders like {#}, {doc}, {voucher} for pruning.
            if (preg_match('/^\\{[^}]+\\}$/', $t)) return false;
            return true;
        }));
        usort($pruneTokens, function ($a, $b) use ($qTf) {
            $la = strlen((string) $a);
            $lb = strlen((string) $b);
            if ($la !== $lb) return $lb <=> $la;
            return ((int) ($qTf[$b] ?? 0)) <=> ((int) ($qTf[$a] ?? 0));
        });
        $pruneTokens = array_slice($pruneTokens, 0, 6);

        if (count($pruneTokens)) {
            $q->where(function ($w) use ($pruneTokens) {
                foreach ($pruneTokens as $t) {
                    $w->orWhereRaw('LOWER(k.Keterangan) like ?', ['%' . $t . '%']);
                }
            });
        }

        $cols = Schema::getColumnListing('tb_kas');
        $sel = [
            'k.Kode_Voucher',
            'k.Kode_Akun',
            'k.Tgl_Voucher',
            'k.Keterangan',
            DB::raw('COALESCE(k.Mutasi_Kas,0) as Mutasi_Kas'),
            'k.Kode_Akun1', 'k.Nominal1',
            'k.Kode_Akun2', in_array('Nominal2', $cols, true) ? 'k.Nominal2' : DB::raw('0 as Nominal2'),
            'k.Kode_Akun3', in_array('Nominal3', $cols, true) ? 'k.Nominal3' : DB::raw('0 as Nominal3'),
            in_array('Jenis_Beban1', $cols, true) ? 'k.Jenis_Beban1' : DB::raw("'' as Jenis_Beban1"),
            in_array('Jenis_Beban2', $cols, true) ? 'k.Jenis_Beban2' : DB::raw("'' as Jenis_Beban2"),
            in_array('Jenis_Beban3', $cols, true) ? 'k.Jenis_Beban3' : DB::raw("'' as Jenis_Beban3"),
        ];

        $candRows = $q->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(800)
            ->get($sel);

        // If token-pruning yields no candidates, fallback to recent rows by mode.
        // This avoids empty evidence and "random" defaults when wording differs from stored redactions.
        if ($candRows->count() === 0 && $normQ !== '') {
            try {
                $q2 = DB::table('tb_kas as k')
                    ->whereNotNull('k.Kode_Akun')
                    ->whereRaw("TRIM(COALESCE(k.Kode_Akun,'')) <> ''");
                if ($mode === 'in') $q2->whereRaw('COALESCE(k.Mutasi_Kas,0) > 0');
                if ($mode === 'out') $q2->whereRaw('COALESCE(k.Mutasi_Kas,0) < 0');
                $candRows = $q2->orderByDesc('k.Tgl_Voucher')
                    ->orderByDesc('k.Kode_Voucher')
                    ->limit(800)
                    ->get($sel);
            } catch (\Throwable) {
                // ignore
            }
        }

        // If query is empty, don't force random similarity — fallback to most frequent.
        $hasQuery = ($normQ !== '' && (count($qTf) || count($qTris)));

        $docs = [];
        $df = [];
        $docLens = [];
        foreach ($candRows as $r) {
            $ket = (string) ($r->Keterangan ?? '');
            $normD = KasText::normalize($ket);
            $dTf = KasText::tokens($normD, 40);
            $dLen = (float) array_sum($dTf);
            $docLens[] = $dLen;
            // DF only for query tokens
            foreach ($qTf as $t => $_tf) {
                if (isset($dTf[$t])) $df[$t] = ($df[$t] ?? 0) + 1;
            }
            $docs[] = [
                'row' => $r,
                'norm' => $normD,
                'tf' => $dTf,
                'len' => $dLen,
                'tris' => null, // lazy
            ];
        }

        $N = max(1, count($docs));
        $avgLen = count($docLens) ? (array_sum($docLens) / max(1, count($docLens))) : 1.0;
        $idf = [];
        foreach ($qTf as $t => $_) {
            $dft = (int) ($df[$t] ?? 0);
            $idf[$t] = log((($N - $dft + 0.5) / ($dft + 0.5)) + 1.0);
        }

        $scored = [];
        $maxBm = 0.0;
        foreach ($docs as $i => $d) {
            $bm = $hasQuery ? $this->bm25Score($qTf, $d['tf'], (float) $d['len'], (float) $avgLen, $idf) : 0.0;
            $maxBm = max($maxBm, $bm);
            $scored[$i] = ['bm' => $bm, 'tri' => 0.0, 'final' => 0.0];
        }

        foreach ($docs as $i => $d) {
            $bm01 = ($maxBm > 0) ? ($scored[$i]['bm'] / $maxBm) : 0.0;
            $tri01 = 0.0;
            if ($hasQuery && count($qTris)) {
                $dTris = KasText::trigrams($d['norm'], 60);
                $tri01 = $this->jaccard($qTris, $dTris);
            }
            $final = 0.7 * $bm01 + 0.3 * $tri01;
            $scored[$i]['tri'] = $tri01;
            $scored[$i]['final'] = $final;
        }

        // Top-K candidates for kNN voting
        $finalScores = [];
        foreach ($scored as $i => $s) {
            $finalScores[$i] = (float) ($s['final'] ?? 0.0);
        }
        arsort($finalScores);
        $topIdx = array_slice(array_keys($finalScores), 0, 40);

        $cashVotes = [];
        $voucherVotes = [];
        $ppnVotes = [];
        $lawanVotes = [];
        $jenisVotes = []; // akun => ['Debit'=>w,'Kredit'=>w]
        $ratioSum = []; // akun => weighted ratio sum
        $ratioW = []; // akun => weighted weight
        $bestKet = '';
        $bestKetScore = -1.0;
        $evidence = [];

        foreach ($topIdx as $idx) {
            $w = (float) ($finalScores[$idx] ?? 0.0);
            if ($w <= 0) continue;
            $r = $docs[$idx]['row'];

            $cash = trim((string) ($r->Kode_Akun ?? ''));
            if ($cash !== '') $cashVotes[$cash] = ($cashVotes[$cash] ?? 0) + $w;

            $kv = trim((string) ($r->Kode_Voucher ?? ''));
            $vt = KasText::extractVoucherType($kv);
            if ($vt !== '') $voucherVotes[$vt] = ($voucherVotes[$vt] ?? 0) + $w;

            $ket = trim((string) ($r->Keterangan ?? ''));
            if ($ket !== '' && $w > $bestKetScore) {
                $bestKet = $ket;
                $bestKetScore = $w;
            }

            $nom2 = (float) ($r->Nominal2 ?? 0);
            $a2 = trim((string) ($r->Kode_Akun2 ?? ''));
            if ($nom2 > 0 && $a2 !== '') {
                $ppnVotes[$a2] = ($ppnVotes[$a2] ?? 0) + $w;
            }

            // Determine DPP slots from history row: treat slot2 as PPN when it has nominal > 0.
            $dppSlots = $nom2 > 0 ? [1, 3] : [1, 2, 3];
            $dppTotal = 0.0;
            foreach ($dppSlots as $slot) {
                $dppTotal += (float) ($r->{'Nominal' . $slot} ?? 0);
            }
            $dppTotal = max(1.0, $dppTotal);

            $targetSlots = ($hasPpn && $ppnNominal > 0) ? [1, 3] : [1, 2, 3];
            foreach ($targetSlots as $slot) {
                // Exclude slot2 from history when it is PPN.
                if ($slot === 2 && $nom2 > 0) continue;
                $akun = trim((string) ($r->{'Kode_Akun' . $slot} ?? ''));
                $nom = (float) ($r->{'Nominal' . $slot} ?? 0);
                if ($akun === '' || $nom <= 0) continue;
                $lawanVotes[$akun] = ($lawanVotes[$akun] ?? 0) + $w;

                $jenisRaw = trim((string) ($r->{'Jenis_Beban' . $slot} ?? ''));
                $jenis = strtoupper($jenisRaw) === 'KREDIT' ? 'Kredit' : (strtoupper($jenisRaw) === 'DEBIT' ? 'Debit' : '');
                if ($jenis !== '') {
                    $jenisVotes[$akun] = $jenisVotes[$akun] ?? ['Debit' => 0.0, 'Kredit' => 0.0];
                    $jenisVotes[$akun][$jenis] = ($jenisVotes[$akun][$jenis] ?? 0) + $w;
                }

                $ratio = max(0.0, $nom / $dppTotal);
                $ratioSum[$akun] = ($ratioSum[$akun] ?? 0) + ($w * $ratio);
                $ratioW[$akun] = ($ratioW[$akun] ?? 0) + $w;
            }

            if (count($evidence) < 3) {
                $evidence[] = [
                    'Kode_Voucher' => $kv,
                    'Kode_Akun' => $cash,
                    'Keterangan' => $ket,
                    'score' => round($w, 4),
                ];
            }
        }

        // Seed akun (e.g. tb_bayar.beban_akun) is a strong hint; keep it on top.
        if ($seedAkun !== '') {
            $lawanVotes[$seedAkun] = ($lawanVotes[$seedAkun] ?? 0) + 3.0;
        }

        // Learn also from jurnal history (fallback for new/unseen wording).
        $jv = $this->jurnalVotes($mode, $keterangan);
        $cashVotesJ = $jv['cash'] ?? [];
        $lawanVotesJ = $jv['lawan'] ?? [];

        // NB scores
        $alpha = 0.60; // tb_kas kNN
        $beta = 0.15; // jurnal votes
        $gamma = max(0.0, 1.0 - $alpha - $beta); // NB
        $cashModel = $this->getNbModel($mode, 'cash');
        $lawanModel = $this->getNbModel($mode, 'lawan');
        $cashNb = $this->softmax01($this->nbScore($cashModel, $keterangan));
        $lawanNb = $this->softmax01($this->nbScore($lawanModel, $keterangan));

        $cashKnn = $this->normalizeTo01($cashVotes);
        $lawanKnn = $this->normalizeTo01($lawanVotes);
        $cashJ = $this->normalizeTo01($cashVotesJ);
        $lawanJ = $this->normalizeTo01($lawanVotesJ);

        $cashFinal = [];
        foreach (array_unique(array_merge(array_keys($cashKnn), array_keys($cashJ), array_keys($cashNb))) as $a) {
            $cashFinal[$a] = $alpha * (float) ($cashKnn[$a] ?? 0)
                + $beta * (float) ($cashJ[$a] ?? 0)
                + $gamma * (float) ($cashNb[$a] ?? 0);
        }
        $lawanFinal = [];
        foreach (array_unique(array_merge(array_keys($lawanKnn), array_keys($lawanJ), array_keys($lawanNb))) as $a) {
            $lawanFinal[$a] = $alpha * (float) ($lawanKnn[$a] ?? 0)
                + $beta * (float) ($lawanJ[$a] ?? 0)
                + $gamma * (float) ($lawanNb[$a] ?? 0);
        }

        arsort($cashFinal);
        arsort($lawanFinal);

        $cashTop = (string) (array_key_first($cashFinal) ?? '');
        if ($cashTop === '') {
            // Fallback: most frequent in votes or NB
            $cashTop = (string) (array_key_first($cashVotes) ?? array_key_first($cashNb) ?? '');
        }
        if ($cashTop === '') {
            $best = '';
            $bestC = 0;
            foreach (($cashModel['docCount'] ?? []) as $a => $c) {
                if ((int) $c > $bestC) {
                    $best = (string) $a;
                    $bestC = (int) $c;
                }
            }
            $cashTop = $best;
        }

        // voucher type: prefer explicit votes, else derive from cash account
        $voucherType = '';
        if (count($voucherVotes)) {
            arsort($voucherVotes);
            $voucherType = (string) array_key_first($voucherVotes);
        }
        if ($voucherType === '') $voucherType = $this->voucherTypeForAkun($cashTop);

        $ppnAkun = '';
        if ($hasPpn && $ppnNominal > 0 && count($ppnVotes)) {
            arsort($ppnVotes);
            $ppnAkun = (string) array_key_first($ppnVotes);
        }

        $maxLines = ($hasPpn && $ppnNominal > 0) ? 2 : 3;
        $lineAccounts = array_slice(array_keys($lawanFinal), 0, $maxLines);
        if (count($lineAccounts) === 0 && $seedAkun !== '') $lineAccounts = [$seedAkun];
        if (count($lineAccounts) === 0) {
            // Fallback: most frequent lawan akun
            $best = [];
            foreach (($lawanModel['docCount'] ?? []) as $a => $c) {
                if ((int) $c <= 0) continue;
                $best[(string) $a] = (int) $c;
            }
            arsort($best);
            $lineAccounts = array_slice(array_keys($best), 0, $maxLines);
        }

        $defaultJenis = $mode === 'in' ? 'Kredit' : 'Debit';
        $dppTarget = max(0.0, $nominal - ($hasPpn ? $ppnNominal : 0.0));

        // Allocate by learned ratio (if available) otherwise put everything in line1.
        $ratios = [];
        $sumRat = 0.0;
        foreach ($lineAccounts as $a) {
            $r = 0.0;
            if (isset($ratioSum[$a]) && isset($ratioW[$a]) && (float) $ratioW[$a] > 0) {
                $r = (float) $ratioSum[$a] / (float) $ratioW[$a];
            }
            $r = max(0.0, $r);
            $ratios[$a] = $r;
            $sumRat += $r;
        }

        $lines = [];
        $running = 0.0;
        foreach ($lineAccounts as $i => $a) {
            $jenis = $defaultJenis;
            if (isset($jenisVotes[$a])) {
                $d = (float) ($jenisVotes[$a]['Debit'] ?? 0);
                $k = (float) ($jenisVotes[$a]['Kredit'] ?? 0);
                $jenis = $d >= $k ? 'Debit' : 'Kredit';
            }

            if ($dppTarget <= 0) {
                $nom = 0.0;
            } elseif ($i === count($lineAccounts) - 1) {
                $nom = round($dppTarget - $running, 2);
            } else {
                $ratio = $sumRat > 0 ? ((float) $ratios[$a] / $sumRat) : ($i === 0 ? 1.0 : 0.0);
                // If no ratio knowledge, default to putting everything to the first line.
                if ($sumRat <= 0) $ratio = $i === 0 ? 1.0 : 0.0;
                $nom = round($dppTarget * $ratio, 2);
            }
            $running += $nom;
            $lines[] = ['akun' => $a, 'jenis' => $jenis, 'nominal' => $nom];
        }

        // Confidence: margin of top1 vs top2
        $conf = function (array $scores): float {
            $vals = array_values($scores);
            if (count($vals) === 0) return 0.0;
            rsort($vals);
            $s1 = (float) ($vals[0] ?? 0.0);
            $s2 = (float) ($vals[1] ?? 0.0);
            if (abs($s1) < 1e-9) return 0.0;
            return max(0.0, min(1.0, ($s1 - $s2) / max(abs($s1), 1.0)));
        };

        $confidence = [
            'cash' => $conf($cashFinal),
            'lawan' => $conf($lawanFinal),
            'ppn' => $hasPpn && $ppnNominal > 0 ? $conf($ppnVotes) : 0.0,
        ];
        $confidence['overall'] = round((0.5 * $confidence['cash'] + 0.5 * $confidence['lawan']), 4);

        // Optional LLM reranker when confidence is low.
        $llmUrl = trim((string) env('DSS_LLM_URL', ''));
        $llmToken = trim((string) env('DSS_LLM_TOKEN', ''));
        $llmThreshold = (float) env('DSS_LLM_CONF_THRESHOLD', 0.12);
        if ($llmUrl !== '' && $confidence['overall'] < $llmThreshold) {
            try {
                $payload = [
                    'mode' => $mode,
                    'keterangan_normalized' => $normQ,
                    'candidates_cash' => array_slice(array_keys($cashFinal), 0, 10),
                    'candidates_lawan' => array_slice(array_keys($lawanFinal), 0, 15),
                    'evidence' => $evidence,
                ];
                $req = Http::timeout(2)->acceptJson();
                if ($llmToken !== '') $req = $req->withToken($llmToken);
                $resp = $req->post($llmUrl, $payload);
                if ($resp->ok()) {
                    $j = $resp->json();
                    $cashTopL = trim((string) ($j['kode_akun'] ?? ''));
                    if ($cashTopL !== '') $cashTop = $cashTopL;
                    $vtL = trim((string) ($j['voucher_type'] ?? ''));
                    if (in_array($vtL, ['CV', 'GV', 'BV'], true)) $voucherType = $vtL;
                    $linesL = $j['lines'] ?? null;
                    if (is_array($linesL) && count($linesL)) {
                        $lines = [];
                        foreach (array_slice($linesL, 0, $maxLines) as $l) {
                            $a = trim((string) ($l['akun'] ?? ''));
                            if ($a === '') continue;
                            $jenis = strtoupper(trim((string) ($l['jenis'] ?? $defaultJenis))) === 'KREDIT' ? 'Kredit' : 'Debit';
                            $nom = (float) ($l['nominal'] ?? 0);
                            $lines[] = ['akun' => $a, 'jenis' => $jenis, 'nominal' => $nom];
                        }
                    }
                }
            } catch (\Throwable) {
                // ignore LLM failures
            }
        }

        $keteranganSuggest = $bestKet !== '' ? $bestKet : ($mode === 'in' ? 'Mutasi/Kas Masuk' : 'Mutasi/Kas Keluar');

        return [
            'kode_akun' => $cashTop,
            'voucher_type' => $voucherType,
            'ppn_akun' => ($hasPpn && $ppnNominal > 0) ? $ppnAkun : '',
            'ppn_jenis' => $ppnJenis,
            'keterangan' => $keteranganSuggest,
            'lines' => $lines,
            'confidence' => $confidence,
            'evidence' => array_values(array_slice(array_merge($evidence, ($jv['evidence'] ?? [])), 0, 6)),
        ];
    }
}
