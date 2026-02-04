<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NeracaAkhirController
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
            '1' => 'aset',
            '2' => 'liabilitas',
            '3' => 'ekuitas',
            default => 'lainnya',
        };
    }

    public function index(Request $request)
    {
        return Inertia::render('laporan/neraca-akhir/index', [
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
        return Inertia::render('laporan/neraca-akhir/print', [
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
                        'total_aset' => 0,
                        'total_liabilitas' => 0,
                        'total_ekuitas' => 0,
                        'selisih' => 0,
                    ],
                    'error' => 'Tabel tb_neracalajur tidak ditemukan.',
                ], 500);
            }

            $cols = Schema::getColumnListing('tb_neracalajur');
            foreach (['Kode_Akun', 'NA_Debit', 'NA_Kredit'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json([
                        'rows' => [],
                        'total' => 0,
                        'summary' => [
                            'total_aset' => 0,
                            'total_liabilitas' => 0,
                            'total_ekuitas' => 0,
                            'selisih' => 0,
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
                'Amount' => DB::raw('(COALESCE(tb_neracalajur.NA_Debit,0) - COALESCE(tb_neracalajur.NA_Kredit,0))'),
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'tb_neracalajur.Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $filtered = DB::table('tb_neracalajur');
            if ($nameInfo['join']) {
                $filtered->leftJoin(...$nameInfo['join']);
            }

            // Only show non-zero NA by default.
            $filtered->where(function ($q) {
                $q->whereRaw('COALESCE(tb_neracalajur.NA_Debit,0) <> 0')
                    ->orWhereRaw('COALESCE(tb_neracalajur.NA_Kredit,0) <> 0');
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
                'tb_neracalajur.NA_Debit',
                'tb_neracalajur.NA_Kredit',
            ]);

            $sortedRowsQuery = (clone $filtered)->select([
                'tb_neracalajur.Kode_Akun',
                $nameInfo['name_select'],
                'tb_neracalajur.NA_Debit',
                'tb_neracalajur.NA_Kredit',
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

            $sumAset = 0.0;
            $sumLiabilitas = 0.0;
            $sumEkuitas = 0.0;

            $accumulate = function ($r) use (&$sumAset, &$sumLiabilitas, &$sumEkuitas) {
                $code = (string) ($r->Kode_Akun ?? '');
                $naDebit = (float) ($r->NA_Debit ?? 0);
                $naKredit = (float) ($r->NA_Kredit ?? 0);
                $net = $naDebit - $naKredit;
                $group = $this->groupFromCode($code);

                if ($group === 'aset') {
                    $sumAset += max($net, 0);
                    return;
                }

                if ($group === 'liabilitas') {
                    $sumLiabilitas += max(-$net, 0);
                    return;
                }

                if ($group === 'ekuitas') {
                    $sumEkuitas += max(-$net, 0);
                    return;
                }

                // Unknown group: assign by sign to keep equation readable.
                if ($net >= 0) {
                    $sumAset += $net;
                    return;
                }

                $sumLiabilitas += -$net;
            };

            foreach ($rawRowsForSummary as $r) {
                $accumulate($r);
            }

            $rows = [];
            foreach ($rawRows as $r) {
                $code = (string) ($r->Kode_Akun ?? '');
                $name = (string) ($r->Nama_Akun ?? '');
                $naDebit = (float) ($r->NA_Debit ?? 0);
                $naKredit = (float) ($r->NA_Kredit ?? 0);
                $net = $naDebit - $naKredit;
                $group = $this->groupFromCode($code);

                $side = $group;
                $amountDisplay = 0.0;
                $isAnomaly = false;
                $isOther = false;

                if ($group === 'aset') {
                    $amountDisplay = max($net, 0);
                    if ($net < 0) {
                        $isAnomaly = true;
                    }
                } elseif ($group === 'liabilitas' || $group === 'ekuitas') {
                    $amountDisplay = max(-$net, 0);
                    if ($net > 0) {
                        $isAnomaly = true;
                    }
                } else {
                    $isOther = true;
                    if ($net >= 0) {
                        $side = 'aset';
                        $amountDisplay = $net;
                    } else {
                        $side = 'liabilitas';
                        $amountDisplay = -$net;
                    }
                }

                $rows[] = [
                    'Kode_Akun' => $code,
                    'Nama_Akun' => $name,
                    'na_debit' => $naDebit,
                    'na_kredit' => $naKredit,
                    'net' => $net,
                    'group' => $group,
                    'side' => $side,
                    'amount_display' => $amountDisplay,
                    'is_anomaly' => $isAnomaly,
                    'is_other' => $isOther,
                ];
            }

            $selisih = $sumAset - ($sumLiabilitas + $sumEkuitas);

            return response()->json([
                'rows' => $rows,
                'total' => $total,
                'summary' => [
                    'total_aset' => $sumAset,
                    'total_liabilitas' => $sumLiabilitas,
                    'total_ekuitas' => $sumEkuitas,
                    'selisih' => $selisih,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_aset' => 0,
                    'total_liabilitas' => 0,
                    'total_ekuitas' => 0,
                    'selisih' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

