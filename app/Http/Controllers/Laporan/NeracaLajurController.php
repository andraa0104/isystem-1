<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NeracaLajurController
{
    private function getRequestedColumns(array $available)
    {
        $desired = [
            'Kode_Akun',
            'Nama_Akun',
            'Saldo_Debit',
            'Saldo_Kredit',
            'AJP_Debit',
            'AJP_Kredit',
            'NSSP_Debit',
            'NSSP_Kredit',
            'RL_Debit',
            'RL_Kredit',
            'NA_Debit',
            'NA_Kredit',
        ];

        $availableSet = array_fill_keys($available, true);
        $selected = [];
        foreach ($desired as $col) {
            if (isset($availableSet[$col])) {
                $selected[] = $col;
            }
        }

        return $selected;
    }

    public function index(Request $request)
    {
        return Inertia::render('laporan/neraca-lajur/index', [
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
        return Inertia::render('laporan/neraca-lajur/print', [
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
                    'error' => 'Tabel tb_neracalajur tidak ditemukan.',
                ], 500);
            }

            $search = trim((string) $request->query('search', ''));

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $allowedSortBy = [
                'Kode_Akun' => 'Kode_Akun',
                'Nama_Akun' => 'Nama_Akun',
                'NA_Debit' => 'NA_Debit',
                'NA_Kredit' => 'NA_Kredit',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? 'Kode_Akun';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $availableCols = Schema::getColumnListing('tb_neracalajur');
            $selectCols = $this->getRequestedColumns($availableCols);
            if (count($selectCols) === 0) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'error' => 'Kolom tb_neracalajur tidak terdeteksi.',
                ], 500);
            }

            $filtered = DB::table('tb_neracalajur');
            if ($search !== '') {
                $filtered->where(function ($q) use ($search) {
                    $q->where('Kode_Akun', 'like', '%' . $search . '%')
                        ->orWhere('Nama_Akun', 'like', '%' . $search . '%');
                });
            }

            $total = (int) ((clone $filtered)->count());

            $rowsQuery = (clone $filtered)
                ->select($selectCols)
                ->orderBy($sortBy, $sortDir);
            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            return response()->json([
                'rows' => $rowsQuery->get(),
                'total' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

