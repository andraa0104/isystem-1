<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class SaldoAkunController
{
    public function index(Request $request)
    {
        return Inertia::render('laporan/saldo-akun/index', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'saldoSign' => (string) $request->query('saldoSign', 'all'),
                'mark00' => (string) $request->query('mark00', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
                'pageSize' => $request->query('pageSize', 10),
            ],
        ]);
    }

    public function print(Request $request)
    {
        return Inertia::render('laporan/saldo-akun/print', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'saldoSign' => (string) $request->query('saldoSign', 'all'),
                'mark00' => (string) $request->query('mark00', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
            ],
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_nabb')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_accounts' => 0,
                        'na_debit' => 0,
                        'na_kredit' => 0,
                        'sum_saldo' => 0,
                        'positive_count' => 0,
                        'negative_count' => 0,
                        'zero_count' => 0,
                        'marked_00_count' => 0,
                        'null_saldo_count' => 0,
                        'na_nonzero_but_saldo_zero_count' => 0,
                        'saldo_nonzero_but_na_zero_count' => 0,
                        'top_positive' => [],
                        'top_negative' => [],
                    ],
                    'error' => 'Tabel tb_nabb tidak ditemukan.',
                ], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $saldoFilter = (string) $request->query('saldoFilter', 'all');
            $saldoSign = (string) $request->query('saldoSign', 'all'); // all|positive|negative|zero
            $mark00 = (string) $request->query('mark00', 'all'); // all|yes

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $allowedSortBy = [
                'Kode_Akun' => 'Kode_Akun',
                'Nama_Akun' => 'Nama_Akun',
                'Saldo' => 'Saldo',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $filtered = DB::table('tb_nabb');

            if ($search !== '') {
                $filtered->where(function ($q) use ($search) {
                    $q->where('Kode_Akun', 'like', '%' . $search . '%')
                        ->orWhere('Nama_Akun', 'like', '%' . $search . '%');
                });
            }

            if ($saldoFilter === 'nonzero') {
                $filtered->where('Saldo', '<>', 0);
            } elseif ($saldoFilter === 'zero') {
                $filtered->where('Saldo', '=', 0);
            }

            if ($saldoSign === 'positive') {
                $filtered->where('Saldo', '>', 0);
            } elseif ($saldoSign === 'negative') {
                $filtered->where('Saldo', '<', 0);
            } elseif ($saldoSign === 'zero') {
                $filtered->where('Saldo', '=', 0);
            }

            if ($mark00 === 'yes') {
                $filtered->whereRaw("TRIM(COALESCE(Kode_Akun,'')) LIKE '%00%'");
            }

            // Summary must be separate query to avoid ONLY_FULL_GROUP_BY issues.
            $summaryRow = (clone $filtered)
                ->selectRaw('COUNT(*) as total_accounts')
                ->selectRaw('COALESCE(SUM(NA_Debit), 0) as na_debit')
                ->selectRaw('COALESCE(SUM(NA_Kredit), 0) as na_kredit')
                ->selectRaw('COALESCE(SUM(COALESCE(Saldo,0)), 0) as sum_saldo')
                ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(Saldo,0) > 0 THEN 1 ELSE 0 END), 0) as positive_count')
                ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(Saldo,0) < 0 THEN 1 ELSE 0 END), 0) as negative_count')
                ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(Saldo,0) = 0 THEN 1 ELSE 0 END), 0) as zero_count')
                ->selectRaw("COALESCE(SUM(CASE WHEN TRIM(COALESCE(Kode_Akun,'')) LIKE '%00%' THEN 1 ELSE 0 END), 0) as marked_00_count")
                ->selectRaw('COALESCE(SUM(CASE WHEN Saldo IS NULL THEN 1 ELSE 0 END), 0) as null_saldo_count')
                ->selectRaw('COALESCE(SUM(CASE WHEN (COALESCE(NA_Debit,0) <> 0 OR COALESCE(NA_Kredit,0) <> 0) AND COALESCE(Saldo,0) = 0 THEN 1 ELSE 0 END), 0) as na_nonzero_but_saldo_zero_count')
                ->selectRaw('COALESCE(SUM(CASE WHEN (COALESCE(NA_Debit,0) = 0 AND COALESCE(NA_Kredit,0) = 0) AND COALESCE(Saldo,0) <> 0 THEN 1 ELSE 0 END), 0) as saldo_nonzero_but_na_zero_count')
                ->first();

            $total = (int) ((clone $filtered)->count());

            $topPositive = (clone $filtered)
                ->where('Saldo', '>', 0)
                ->orderByDesc('Saldo')
                ->limit(10)
                ->get(['Kode_Akun', 'Nama_Akun', 'Saldo'])
                ->map(fn ($r) => [
                    'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                    'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
                    'Saldo' => (float) ($r->Saldo ?? 0),
                ])
                ->values()
                ->all();

            $topNegative = (clone $filtered)
                ->where('Saldo', '<', 0)
                ->orderBy('Saldo')
                ->limit(10)
                ->get(['Kode_Akun', 'Nama_Akun', 'Saldo'])
                ->map(fn ($r) => [
                    'Kode_Akun' => (string) ($r->Kode_Akun ?? ''),
                    'Nama_Akun' => (string) ($r->Nama_Akun ?? ''),
                    'Saldo' => (float) ($r->Saldo ?? 0),
                ])
                ->values()
                ->all();

            $rowsQuery = (clone $filtered)
                ->select([
                    'Kode_Akun',
                    'Nama_Akun',
                    'NA_Debit',
                    'NA_Kredit',
                    'BB_Debit',
                    'BB_Kredit',
                    'Saldo',
                ])
                ->orderBy($sortBy, $sortDir);
            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            return response()->json([
                'rows' => $rowsQuery->get(),
                'total' => $total,
                'summary' => [
                    'total_accounts' => (int) ($summaryRow->total_accounts ?? 0),
                    'na_debit' => (float) ($summaryRow->na_debit ?? 0),
                    'na_kredit' => (float) ($summaryRow->na_kredit ?? 0),
                    'sum_saldo' => (float) ($summaryRow->sum_saldo ?? 0),
                    'positive_count' => (int) ($summaryRow->positive_count ?? 0),
                    'negative_count' => (int) ($summaryRow->negative_count ?? 0),
                    'zero_count' => (int) ($summaryRow->zero_count ?? 0),
                    'marked_00_count' => (int) ($summaryRow->marked_00_count ?? 0),
                    'null_saldo_count' => (int) ($summaryRow->null_saldo_count ?? 0),
                    'na_nonzero_but_saldo_zero_count' => (int) ($summaryRow->na_nonzero_but_saldo_zero_count ?? 0),
                    'saldo_nonzero_but_na_zero_count' => (int) ($summaryRow->saldo_nonzero_but_na_zero_count ?? 0),
                    'top_positive' => $topPositive,
                    'top_negative' => $topNegative,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_accounts' => 0,
                    'na_debit' => 0,
                    'na_kredit' => 0,
                    'sum_saldo' => 0,
                    'positive_count' => 0,
                    'negative_count' => 0,
                    'zero_count' => 0,
                    'marked_00_count' => 0,
                    'null_saldo_count' => 0,
                    'na_nonzero_but_saldo_zero_count' => 0,
                    'saldo_nonzero_but_na_zero_count' => 0,
                    'top_positive' => [],
                    'top_negative' => [],
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
