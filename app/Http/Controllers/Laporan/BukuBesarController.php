<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class BukuBesarController
{
    public function index(Request $request)
    {
        return Inertia::render('laporan/buku-besar/index', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
                'pageSize' => $request->query('pageSize', 10),
            ],
        ]);
    }

    public function print(Request $request)
    {
        return Inertia::render('laporan/buku-besar/print', [
            'initialQuery' => [
                'search' => (string) $request->query('search', ''),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
            ],
        ]);
    }

    public function rows(Request $request)
    {
        try {
            $search = trim((string) $request->query('search', ''));
            $saldoFilter = (string) $request->query('saldoFilter', 'all');

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

            $summaryRow = (clone $filtered)
                ->selectRaw('COUNT(*) as total_accounts')
                ->selectRaw('COALESCE(SUM(NA_Debit), 0) as na_debit')
                ->selectRaw('COALESCE(SUM(NA_Kredit), 0) as na_kredit')
                ->first();

            $total = (int) ((clone $filtered)->count());

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
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
