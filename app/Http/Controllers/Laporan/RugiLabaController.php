<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class RugiLabaController
{
    private function pickNameColumn(): array
    {
        // Prefer tb_nabb.Nama_Akun if available.
        if (Schema::hasTable('tb_nabb')) {
            $cols = Schema::getColumnListing('tb_nabb');
            if (in_array('Nama_Akun', $cols, true)) {
                return [
                    'join' => ['tb_nabb', 'tb_nabb.Kode_Akun', '=', 'tb_neracalajur.Kode_Akun'],
                    'name_select' => 'tb_nabb.Nama_Akun as Nama_Akun',
                    'name_where' => 'tb_nabb.Nama_Akun',
                    'name_sort' => 'tb_nabb.Nama_Akun',
                ];
            }
        }

        // Fallback to tb_neracalajur.Nama_Akun if exists.
        $cols = Schema::getColumnListing('tb_neracalajur');
        if (in_array('Nama_Akun', $cols, true)) {
            return [
                'join' => null,
                'name_select' => 'tb_neracalajur.Nama_Akun as Nama_Akun',
                'name_where' => 'tb_neracalajur.Nama_Akun',
                'name_sort' => 'tb_neracalajur.Nama_Akun',
            ];
        }

        return [
            'join' => null,
            'name_select' => DB::raw("'' as Nama_Akun"),
            'name_where' => null,
            'name_sort' => null,
        ];
    }

    private function groupFromCode(string $code): string
    {
        $first = substr(trim($code), 0, 1);
        return match ($first) {
            '4' => 'pendapatan',
            '5' => 'hpp',
            '6' => 'beban_operasional',
            '7' => 'lain_lain',
            default => 'lainnya',
        };
    }

    public function index(Request $request)
    {
        return Inertia::render('laporan/rugi-laba/index', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
                'pageSize' => $request->query('pageSize', 10),
            ],
        ]);
    }

    public function print(Request $request)
    {
        return Inertia::render('laporan/rugi-laba/print', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
            ],
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_neracalajur')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_pendapatan' => 0,
                        'total_hpp' => 0,
                        'laba_kotor' => 0,
                        'total_beban_operasional' => 0,
                        'laba_usaha' => 0,
                        'total_lain_lain_net' => 0,
                        'laba_bersih' => 0,
                    ],
                    'error' => 'Tabel tb_neracalajur tidak ditemukan.',
                ], 500);
            }

            $neracaCols = Schema::getColumnListing('tb_neracalajur');
            $required = ['Kode_Akun', 'RL_Debit', 'RL_Kredit'];
            foreach ($required as $col) {
                if (!in_array($col, $neracaCols, true)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_pendapatan' => 0,
                            'total_hpp' => 0,
                            'laba_kotor' => 0,
                            'total_beban_operasional' => 0,
                            'laba_usaha' => 0,
                            'total_lain_lain_net' => 0,
                            'laba_bersih' => 0,
                        ],
                        'error' => "Kolom tb_neracalajur.$col tidak ditemukan.",
                    ], 500);
                }
            }

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $nameInfo = $this->pickNameColumn();

            $allowedSortBy = [
                'Kode_Akun' => 'tb_neracalajur.Kode_Akun',
                'Nama_Akun' => $nameInfo['name_sort'] ?: 'tb_neracalajur.Kode_Akun',
                'Amount' => DB::raw('(COALESCE(tb_neracalajur.RL_Kredit,0) - COALESCE(tb_neracalajur.RL_Debit,0))'),
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'tb_neracalajur.Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $filtered = DB::table('tb_neracalajur');
            if ($nameInfo['join']) {
                $filtered->leftJoin(...$nameInfo['join']);
            }

            // Only RL non-zero by default.
            $filtered->where(function ($q) {
                $q->whereRaw('COALESCE(tb_neracalajur.RL_Debit,0) <> 0')
                    ->orWhereRaw('COALESCE(tb_neracalajur.RL_Kredit,0) <> 0');
            });

            if ($search !== '') {
                $filtered->where(function ($q) use ($search, $nameInfo) {
                    $q->where('tb_neracalajur.Kode_Akun', 'like', '%' . $search . '%');
                    if ($nameInfo['name_where']) {
                        $q->orWhere($nameInfo['name_where'], 'like', '%' . $search . '%');
                    }
                });
            }

            $total = (int) ((clone $filtered)->count());

            $summaryQuery = (clone $filtered)->select([
                'tb_neracalajur.Kode_Akun',
                'tb_neracalajur.RL_Debit',
                'tb_neracalajur.RL_Kredit',
            ]);

            $sortedRowsQuery = (clone $filtered)->select([
                'tb_neracalajur.Kode_Akun',
                $nameInfo['name_select'],
                'tb_neracalajur.RL_Debit',
                'tb_neracalajur.RL_Kredit',
            ]);

            if ($sortByRaw === 'Amount') {
                $sortedRowsQuery->orderByRaw($sortBy . ' ' . $sortDir);
            } else {
                $sortedRowsQuery->orderBy($sortBy, $sortDir);
            }

            $rowsQuery = (clone $sortedRowsQuery);
            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();
            $rawRowsForSummary = $pageSize === 'all' ? $rawRows : $summaryQuery->get();
            $rows = [];

            $sumPendapatan = 0.0;
            $sumHpp = 0.0;
            $sumBebanOperasional = 0.0;
            $sumPendapatanLain = 0.0;
            $sumBebanLain = 0.0;

            $accumulate = function ($r) use (&$sumPendapatan, &$sumHpp, &$sumBebanOperasional, &$sumPendapatanLain, &$sumBebanLain) {
                $code = (string) ($r->Kode_Akun ?? '');
                $rlDebit = (float) ($r->RL_Debit ?? 0);
                $rlKredit = (float) ($r->RL_Kredit ?? 0);
                $net = $rlKredit - $rlDebit;
                $group = $this->groupFromCode($code);

                if ($group === 'pendapatan') {
                    $sumPendapatan += max($net, 0);
                    return;
                }

                if ($group === 'hpp') {
                    $sumHpp += max(-$net, 0);
                    return;
                }

                if ($group === 'beban_operasional') {
                    $sumBebanOperasional += max(-$net, 0);
                    return;
                }

                if ($net >= 0) {
                    $sumPendapatanLain += $net;
                    return;
                }

                $sumBebanLain += -$net;
            };

            foreach ($rawRowsForSummary as $r) {
                $accumulate($r);
            }

            foreach ($rawRows as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $name = (string) ($r->Nama_Akun ?? '');
                $rlDebit = (float) ($r->RL_Debit ?? 0);
                $rlKredit = (float) ($r->RL_Kredit ?? 0);
                $net = $rlKredit - $rlDebit;
                $group = $this->groupFromCode($code);

                $subgroup = null;
                $amountDisplay = 0.0;
                $isAnomaly = false;

                if ($group === 'pendapatan') {
                    $amountDisplay = max($net, 0);
                    if ($net < 0) {
                        $isAnomaly = true;
                    }
                    $sumPendapatan += $amountDisplay;
                } elseif ($group === 'hpp') {
                    $amountDisplay = max(-$net, 0);
                    if ($net > 0) {
                        $isAnomaly = true;
                    }
                    $sumHpp += $amountDisplay;
                } elseif ($group === 'beban_operasional') {
                    $amountDisplay = max(-$net, 0);
                    if ($net > 0) {
                        $isAnomaly = true;
                    }
                    $sumBebanOperasional += $amountDisplay;
                } else {
                    if ($net >= 0) {
                        $subgroup = 'pendapatan_lain';
                        $amountDisplay = $net;
                        $sumPendapatanLain += $amountDisplay;
                    } else {
                        $subgroup = 'beban_lain';
                        $amountDisplay = -$net;
                        $sumBebanLain += $amountDisplay;
                    }
                }

                $rows[] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => $name,
                    'rl_debit' => $rlDebit,
                    'rl_kredit' => $rlKredit,
                    'net' => $net,
                    'group' => $group,
                    'subgroup' => $subgroup,
                    'amount_display' => $amountDisplay,
                    'is_anomaly' => $isAnomaly,
                ];
            }

            // Summary is based on the full filtered dataset (search + RL non-zero).
            $totalPendapatan = $sumPendapatan + $sumPendapatanLain;
            $labaKotor = $totalPendapatan - $sumHpp;
            $labaUsaha = $labaKotor - $sumBebanOperasional;
            $totalLainLainNet = $sumPendapatanLain - $sumBebanLain;
            $labaBersih = $labaUsaha + $totalLainLainNet;

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'summary' => [
                    'total_pendapatan' => $totalPendapatan,
                    'total_hpp' => $sumHpp,
                    'laba_kotor' => $labaKotor,
                    'total_beban_operasional' => $sumBebanOperasional,
                    'laba_usaha' => $labaUsaha,
                    'total_lain_lain_net' => $totalLainLainNet,
                    'laba_bersih' => $labaBersih,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_pendapatan' => 0,
                    'total_hpp' => 0,
                    'laba_kotor' => 0,
                    'total_beban_operasional' => 0,
                    'laba_usaha' => 0,
                    'total_lain_lain_net' => 0,
                    'laba_bersih' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
