<?php

namespace App\Services\Keuangan\JurnalPenyesuaianDss;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class JpDss
{
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

    /**
     * @return array{lines:array<int,array{akun:string,jenis:string}>,remark_suggest:string,confidence:array<string,float>,evidence:array<int,array<string,mixed>>}
     */
    public function suggest(array $input): array
    {
        $remark = trim((string) ($input['remark'] ?? ''));
        $seedAkun = trim((string) ($input['seedAkun'] ?? ''));
        $seedJenis = trim((string) ($input['seedJenis'] ?? ''));
        $seedJenis = $seedJenis === 'Kredit' ? 'Kredit' : ($seedJenis === 'Debit' ? 'Debit' : '');
        $nominal = (float) ($input['nominal'] ?? 0);
        $nominal = max(0.0, $nominal);
        if ($remark === '') {
            return [
                'lines' => [],
                'remark_suggest' => '',
                'confidence' => ['overall' => 0.0],
                'evidence' => [],
            ];
        }

        if (!Schema::hasTable('tb_jurnalpenyesuaian')) {
            return [
                'lines' => [],
                'remark_suggest' => '',
                'confidence' => ['overall' => 0.0],
                'evidence' => [],
            ];
        }

        foreach (['Kode_Jurnal', 'Periode', 'Kode_Akun', 'Debit', 'Kredit'] as $c) {
            if (!Schema::hasColumn('tb_jurnalpenyesuaian', $c)) {
                return [
                    'lines' => [],
                    'remark_suggest' => '',
                    'confidence' => ['overall' => 0.0],
                    'evidence' => [],
                ];
            }
        }

        $cols = Schema::getColumnListing('tb_jurnalpenyesuaian');
        $hasRemark = in_array('Remark', $cols, true);
        if (!$hasRemark) {
            return [
                'lines' => [],
                'remark_suggest' => '',
                'confidence' => ['overall' => 0.0],
                'evidence' => [],
            ];
        }

        $normQ = JpText::normalize($remark);
        $qTf = JpText::tokens($normQ, 16);
        $qTris = JpText::trigrams($normQ, 60);

        // Candidate docs (grouped by kode_jurnal + date(periode))
        $q = DB::table('tb_jurnalpenyesuaian as a');

        $queryTokens = array_keys($qTf);
        $pruneTokens = array_values(array_filter($queryTokens, fn ($t) => $t !== ''));
        usort($pruneTokens, fn ($a, $b) => strlen((string) $b) <=> strlen((string) $a));
        $pruneTokens = array_slice($pruneTokens, 0, 6);

        if (count($pruneTokens) > 0) {
            $q->where(function ($w) use ($pruneTokens) {
                foreach ($pruneTokens as $t) {
                    $w->orWhereRaw('LOWER(a.Remark) like ?', ['%' . $t . '%']);
                }
            });
        }

        $agg = $q->selectRaw('a.Kode_Jurnal as Kode_Jurnal')
            ->selectRaw('DATE(a.Periode) as Periode')
            ->selectRaw('MAX(a.Remark) as Remark')
            ->groupBy('a.Kode_Jurnal')
            ->groupBy(DB::raw('DATE(a.Periode)'))
            ->orderByDesc('Periode')
            ->orderByDesc('Kode_Jurnal')
            ->limit(800)
            ->get();

        // Fallback: if pruning yields no docs, take recent docs anyway.
        if ($agg->count() === 0) {
            $agg = DB::table('tb_jurnalpenyesuaian as a')
                ->selectRaw('a.Kode_Jurnal as Kode_Jurnal')
                ->selectRaw('DATE(a.Periode) as Periode')
                ->selectRaw('MAX(a.Remark) as Remark')
                ->groupBy('a.Kode_Jurnal')
                ->groupBy(DB::raw('DATE(a.Periode)'))
                ->orderByDesc('Periode')
                ->orderByDesc('Kode_Jurnal')
                ->limit(800)
                ->get();
        }

        if ($agg->count() === 0) {
            return [
                'lines' => [],
                'remark_suggest' => '',
                'confidence' => ['overall' => 0.0],
                'evidence' => [],
            ];
        }

        $docKeys = [];
        $kodeList = [];
        $periodeList = [];
        foreach ($agg as $r) {
            $kj = trim((string) ($r->Kode_Jurnal ?? ''));
            $pd = trim((string) ($r->Periode ?? ''));
            if ($kj === '' || $pd === '') continue;
            $key = $kj . '|' . $pd;
            $docKeys[$key] = [
                'Kode_Jurnal' => $kj,
                'Periode' => $pd,
                'Remark' => (string) ($r->Remark ?? ''),
            ];
            $kodeList[] = $kj;
            $periodeList[] = $pd;
        }
        $kodeList = array_values(array_unique($kodeList));
        $periodeList = array_values(array_unique($periodeList));
        if (count($docKeys) === 0) {
            return [
                'lines' => [],
                'remark_suggest' => '',
                'confidence' => ['overall' => 0.0],
                'evidence' => [],
            ];
        }

        // Load detail lines for these docs
        $detail = DB::table('tb_jurnalpenyesuaian as a')
            ->whereIn('a.Kode_Jurnal', $kodeList)
            ->whereIn(DB::raw('DATE(a.Periode)'), $periodeList)
            ->select([
                'a.Kode_Jurnal',
                DB::raw('DATE(a.Periode) as Periode'),
                'a.Kode_Akun',
                DB::raw('COALESCE(a.Debit,0) as Debit'),
                DB::raw('COALESCE(a.Kredit,0) as Kredit'),
            ])
            ->get();

        $detailsByDoc = [];
        foreach ($detail as $d) {
            $kj = trim((string) ($d->Kode_Jurnal ?? ''));
            $pd = trim((string) ($d->Periode ?? ''));
            $key = $kj . '|' . $pd;
            if (!isset($docKeys[$key])) continue;
            $akun = trim((string) ($d->Kode_Akun ?? ''));
            if ($akun === '') continue;
            $debit = (float) ($d->Debit ?? 0);
            $kredit = (float) ($d->Kredit ?? 0);
            $jenis = $debit > 0 ? 'Debit' : ($kredit > 0 ? 'Kredit' : '');
            if ($jenis === '') continue;
            $detailsByDoc[$key] = $detailsByDoc[$key] ?? [];
            $detailsByDoc[$key][] = [
                'akun' => $akun,
                'jenis' => $jenis,
                'nominal' => $debit > 0 ? $debit : $kredit,
            ];
        }

        // Prepare documents for scoring
        $docs = [];
        $df = [];
        $lens = [];
        foreach ($docKeys as $key => $doc) {
            $ket = (string) ($doc['Remark'] ?? '');
            $normD = JpText::normalize($ket);
            $dTf = JpText::tokens($normD, 40);
            $dLen = (float) array_sum($dTf);
            $lens[] = $dLen;
            foreach ($qTf as $t => $_tf) {
                if (isset($dTf[$t])) $df[$t] = ($df[$t] ?? 0) + 1;
            }
            $docs[] = [
                'key' => $key,
                'remark' => $ket,
                'norm' => $normD,
                'tf' => $dTf,
                'len' => $dLen,
            ];
        }

        $N = max(1, count($docs));
        $avgLen = count($lens) ? (array_sum($lens) / max(1, count($lens))) : 1.0;
        $idf = [];
        foreach ($qTf as $t => $_) {
            $dft = (int) ($df[$t] ?? 0);
            $idf[$t] = log((($N - $dft + 0.5) / ($dft + 0.5)) + 1.0);
        }

        $scored = [];
        $maxBm = 0.0;
        foreach ($docs as $i => $d) {
            $bm = (count($qTf) || count($qTris)) ? $this->bm25Score($qTf, $d['tf'], (float) $d['len'], (float) $avgLen, $idf) : 0.0;
            $maxBm = max($maxBm, $bm);
            $scored[$i] = ['bm' => $bm, 'tri' => 0.0, 'final' => 0.0];
        }
        foreach ($docs as $i => $d) {
            $bm01 = ($maxBm > 0) ? ($scored[$i]['bm'] / $maxBm) : 0.0;
            $tri01 = (count($qTf) || count($qTris)) ? $this->jaccard($qTris, JpText::trigrams($d['norm'], 60)) : 0.0;
            $final = 0.7 * $bm01 + 0.3 * $tri01;
            $scored[$i]['tri'] = $tri01;
            $scored[$i]['final'] = $final;
        }

        $finalScores = [];
        foreach ($scored as $i => $s) {
            $finalScores[$i] = (float) ($s['final'] ?? 0.0);
        }
        arsort($finalScores);
        $topIdx = array_slice(array_keys($finalScores), 0, 40);

        $debitVotes = [];
        $kreditVotes = [];
        $bestRemark = '';
        $bestScore = -1.0;
        $evidence = [];

        foreach ($topIdx as $idx) {
            $w = (float) ($finalScores[$idx] ?? 0.0);
            if ($w <= 0) continue;
            $docKey = $docs[$idx]['key'];
            $docRemark = $docs[$idx]['remark'];

            // If user provides a seed account + amount, prefer documents whose seed-account line amount is close.
            if ($seedAkun !== '' && $nominal > 0) {
                $seedNom = 0.0;
                $seedHasJenis = false;
                foreach (($detailsByDoc[$docKey] ?? []) as $ln) {
                    if (trim((string) ($ln['akun'] ?? '')) !== $seedAkun) continue;
                    if ($seedJenis !== '' && (string) ($ln['jenis'] ?? '') !== $seedJenis) continue;
                    $seedNom = (float) ($ln['nominal'] ?? 0);
                    $seedHasJenis = true;
                    break;
                }
                if ($seedNom > 0) {
                    $delta = abs($seedNom - $nominal) / max($nominal, 1.0);
                    $amountScore = exp(-2.0 * $delta); // 1.0 when equal, approaches 0 when far
                    $w *= (0.6 + 0.4 * max(0.0, min(1.0, $amountScore)));
                } elseif ($seedJenis !== '' && !$seedHasJenis) {
                    // Penalize docs that don't match the requested side.
                    $w *= 0.85;
                }
            }

            if ($docRemark !== '' && $w > $bestScore) {
                $bestRemark = $docRemark;
                $bestScore = $w;
            }

            $lines = $detailsByDoc[$docKey] ?? [];
            foreach ($lines as $ln) {
                $akun = (string) ($ln['akun'] ?? '');
                $jenis = (string) ($ln['jenis'] ?? '');
                if ($akun === '' || $jenis === '') continue;
                if ($jenis === 'Debit') $debitVotes[$akun] = ($debitVotes[$akun] ?? 0) + $w;
                if ($jenis === 'Kredit') $kreditVotes[$akun] = ($kreditVotes[$akun] ?? 0) + $w;
            }

            if (count($evidence) < 3) {
                $preview = [];
                foreach (array_slice($lines, 0, 6) as $ln) {
                    $preview[] = ['akun' => (string) ($ln['akun'] ?? ''), 'jenis' => (string) ($ln['jenis'] ?? '')];
                }
                $evidence[] = [
                    'Kode_Jurnal' => $docKeys[$docKey]['Kode_Jurnal'] ?? '',
                    'Periode' => $docKeys[$docKey]['Periode'] ?? '',
                    'Remark' => $docRemark,
                    'score' => round($w, 4),
                    'accountsPreview' => $preview,
                ];
            }
        }

        arsort($debitVotes);
        arsort($kreditVotes);

        $linesOut = [];
        $used = [];
        $topDebit = array_keys($debitVotes);
        $topKredit = array_keys($kreditVotes);

        // If caller provides seed akun (akun fokus), make it the first line with the most likely side.
        if ($seedAkun !== '') {
            $pickedJenis = $seedJenis;
            if ($pickedJenis === '') {
                $dW = (float) ($debitVotes[$seedAkun] ?? 0);
                $kW = (float) ($kreditVotes[$seedAkun] ?? 0);
                $pickedJenis = $dW >= $kW ? 'Debit' : 'Kredit';
            }
            $linesOut[] = ['akun' => $seedAkun, 'jenis' => $pickedJenis];
            $used[$seedAkun] = true;

            // Next line: pick best counterpart on the opposite side.
            $needOpp = $pickedJenis === 'Debit' ? 'Kredit' : 'Debit';
            $pool = $needOpp === 'Debit' ? $topDebit : $topKredit;
            foreach ($pool as $a) {
                $a = (string) $a;
                if ($a === '' || isset($used[$a])) continue;
                $linesOut[] = ['akun' => $a, 'jenis' => $needOpp];
                $used[$a] = true;
                break;
            }
        } else {
            // No seed: pick the most likely debit and credit accounts from history.
            if (count($topDebit) > 0) {
                $a = (string) $topDebit[0];
                $linesOut[] = ['akun' => $a, 'jenis' => 'Debit'];
                $used[$a] = true;
            }
            if (count($topKredit) > 0) {
                $a = (string) $topKredit[0];
                if (!isset($used[$a])) {
                    $linesOut[] = ['akun' => $a, 'jenis' => 'Kredit'];
                    $used[$a] = true;
                }
            }
        }

        // Fill remaining up to 4 with the highest remaining votes.
        $merged = [];
        foreach ($debitVotes as $a => $v) $merged[] = ['akun' => (string) $a, 'jenis' => 'Debit', 'v' => (float) $v];
        foreach ($kreditVotes as $a => $v) $merged[] = ['akun' => (string) $a, 'jenis' => 'Kredit', 'v' => (float) $v];
        usort($merged, fn ($x, $y) => ($y['v'] <=> $x['v']));
        foreach ($merged as $m) {
            if (count($linesOut) >= 4) break;
            $a = (string) $m['akun'];
            if ($a === '' || isset($used[$a])) continue;
            $linesOut[] = ['akun' => $a, 'jenis' => (string) $m['jenis']];
            $used[$a] = true;
        }

        // Ensure we have at least 1 Debit and 1 Kredit if possible.
        $hasD = count(array_filter($linesOut, fn ($l) => ($l['jenis'] ?? '') === 'Debit')) > 0;
        $hasK = count(array_filter($linesOut, fn ($l) => ($l['jenis'] ?? '') === 'Kredit')) > 0;
        if (!$hasD && count($topDebit) > 0) {
            $a = (string) $topDebit[0];
            if ($a !== '' && !isset($used[$a])) $linesOut[] = ['akun' => $a, 'jenis' => 'Debit'];
        }
        if (!$hasK && count($topKredit) > 0) {
            $a = (string) $topKredit[0];
            if ($a !== '' && !isset($used[$a])) $linesOut[] = ['akun' => $a, 'jenis' => 'Kredit'];
        }
        $linesOut = array_slice($linesOut, 0, 4);

        // Confidence: based on best vs second best doc score.
        $vals = array_values($finalScores);
        rsort($vals);
        $s1 = (float) ($vals[0] ?? 0.0);
        $s2 = (float) ($vals[1] ?? 0.0);
        $conf = 0.0;
        if (abs($s1) > 1e-9) {
            $conf = max(0.0, min(1.0, ($s1 - $s2) / max(abs($s1), 1.0)));
        }

        return [
            'lines' => $linesOut,
            'remark_suggest' => $bestRemark,
            'confidence' => ['overall' => round($conf, 4)],
            'evidence' => $evidence,
        ];
    }
}
