<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NeracaSaldoController
{
    public function index(Request $request)
    {
        return Inertia::render('laporan/neraca-saldo/index', [
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
        return Inertia::render('laporan/neraca-saldo/print', [
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
            if (!Schema::hasTable('tb_neracasaldo')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_accounts' => 0,
                        'debit' => 0,
                        'kredit' => 0,
                    ],
                    'error' => 'Tabel tb_neracasaldo tidak ditemukan.',
                ], 500);
            }

            if (!Schema::hasTable('tb_nabb')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => [
                        'total_accounts' => 0,
                        'debit' => 0,
                        'kredit' => 0,
                    ],
                    'error' => 'Tabel tb_nabb tidak ditemukan (untuk Nama_Akun).',
                ], 500);
            }

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $allowedSortBy = [
                'Kode_Akun' => 'tb_neracasaldo.Kode_Akun',
                'Nama_Akun' => 'tb_nabb.Nama_Akun',
                'Debit' => 'tb_neracasaldo.Debit',
                'Kredit' => 'tb_neracasaldo.Kredit',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'tb_neracasaldo.Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $filtered = DB::table('tb_neracasaldo')
                ->leftJoin('tb_nabb', 'tb_nabb.Kode_Akun', '=', 'tb_neracasaldo.Kode_Akun');

            if ($search !== '') {
                $filtered->where(function ($q) use ($search) {
                    $q->where('tb_neracasaldo.Kode_Akun', 'like', '%' . $search . '%')
                        ->orWhere('tb_nabb.Nama_Akun', 'like', '%' . $search . '%');
                });
            }

            $summaryRow = (clone $filtered)
                ->selectRaw('COUNT(*) as total_accounts')
                ->selectRaw('COALESCE(SUM(tb_neracasaldo.Debit), 0) as debit')
                ->selectRaw('COALESCE(SUM(tb_neracasaldo.Kredit), 0) as kredit')
                ->first();

            $total = (int) ((clone $filtered)->count());

            $rowsQuery = (clone $filtered)
                ->select([
                    'tb_neracasaldo.Kode_Akun',
                    'tb_nabb.Nama_Akun',
                    'tb_neracasaldo.Debit',
                    'tb_neracasaldo.Kredit',
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
                    'debit' => (float) ($summaryRow->debit ?? 0),
                    'kredit' => (float) ($summaryRow->kredit ?? 0),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => [
                    'total_accounts' => 0,
                    'debit' => 0,
                    'kredit' => 0,
                ],
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

