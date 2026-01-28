<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Support\Carbon;

class BiayaKirimPenjualanController
{
    public function index(Request $request)
    {
        return Inertia::render('Penjualan/biaya-kirim-penjualan/index', [
            'items' => [],
            'summary' => [
                'unpaid_count' => 0,
                'unpaid_total' => 0,
            ],
            'filters' => [
                'search' => null,
                'status' => 'all',
                'pageSize' => 5,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Penjualan/biaya-kirim-penjualan/create', [
            'poRows' => [],
        ]);
    }

    public function doList(Request $request)
    {
        if (!Schema::hasTable('tb_kddo')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = $request->query('search');
        $pageSize = $request->query('pageSize', 5);
        $page = (int) $request->query('page', 1);
        if ($page < 1) {
            $page = 1;
        }

        $doDateCol = Schema::hasColumn('tb_kddo', 'tgl')
            ? 'k.tgl'
            : 'null';
        $doCustomerCol = Schema::hasColumn('tb_kddo', 'nm_cs')
            ? 'k.nm_cs'
            : (Schema::hasColumn('tb_kddo', 'customer') ? 'k.customer' : (Schema::hasColumn('tb_kddo', 'nama_cus') ? 'k.nama_cus' : 'null'));
        $doPoCustCol = Schema::hasColumn('tb_kddo', 'ref_po')
            ? 'k.ref_po'
            : (Schema::hasColumn('tb_kddo', 'ref_do') ? 'k.ref_do' : 'null');

        $query = DB::table('tb_kddo as k')
            ->selectRaw("k.no_do as no_do, {$doDateCol} as tgl_do, {$doDateCol} as tgl, {$doPoCustCol} as po_cust, {$doCustomerCol} as customer")
            ->distinct()
            ->orderByDesc('no_do');

        if ($search) {
            $term = '%'.strtolower(trim($search)).'%';
            $query->where(function ($q) use ($term) {
                $q->whereRaw('lower(k.no_do) like ?', [$term])
                    ->orWhereRaw('lower(k.nm_cs) like ?', [$term]);
            });
        }

        if ($pageSize === 'all') {
            $rows = $query->get();
            return response()->json(['rows' => $rows, 'total' => $rows->count()]);
        }

        $size = (int) $pageSize;
        if ($size < 1) {
            $size = 5;
        }

        $total = (clone $query)->count();
        $rows = $query->skip(($page - 1) * $size)->take($size)->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }

    public function doMaterials(Request $request)
    {
        $noDo = $request->query('no_do');
        if (!$noDo) {
            return response()->json(['rows' => []]);
        }

        $table = 'tb_do';
        if (!Schema::hasTable($table)) {
            return response()->json(['rows' => []]);
        }

        $rows = DB::table($table)
            ->select('kd_mat', 'mat', 'qty', 'unit', 'harga', 'total')
            ->where('no_do', $noDo)
            ->orderBy('mat')
            ->get();

        return response()->json(['rows' => $rows]);
    }

    public function dotMaterials(Request $request)
    {
        $noDo = $request->query('no_do');
        if (!$noDo) {
            return response()->json(['rows' => []]);
        }

        $table = 'tb_dob';
        if (!Schema::hasTable($table)) {
            return response()->json(['rows' => []]);
        }

        $rows = DB::table($table)
            ->select('no_dob', 'kd_mat', 'mat', 'qty', 'unit', 'harga', 'total')
            ->where('ref_do', $noDo)
            ->orderBy('no_dob')
            ->get();

        return response()->json(['rows' => $rows]);
    }

    public function data(Request $request)
    {
        $table = 'tb_biayakirimjual';
        if (!Schema::hasTable($table)) {
            return response()->json([
                'items' => [],
                'summary' => [
                    'unpaid_count' => 0,
                    'unpaid_total' => 0,
                ],
            ]);
        }

        $search = $request->query('search');
        $status = $request->query('status', 'all');

        $query = DB::table($table);

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term, $table) {
                if (Schema::hasColumn($table, 'no_bkj')) {
                    $q->orWhere('no_bkj', 'like', $term);
                }
                if (Schema::hasColumn($table, 'nama_vendor')) {
                    $q->orWhere('nama_vendor', 'like', $term);
                } elseif (Schema::hasColumn($table, 'nma_vendor')) {
                    $q->orWhere('nma_vendor', 'like', $term);
                }
                if (Schema::hasColumn($table, 'no_inv')) {
                    $q->orWhere('no_inv', 'like', $term);
                }
            });
        }

        if (Schema::hasColumn($table, 'jumlah_bayar') && Schema::hasColumn($table, 'sisa')) {
            switch ($status) {
                case 'belum_dibayar':
                    $query->whereRaw('jumlah_bayar = sisa');
                    break;
                case 'sisa_bayar':
                    if (Schema::hasColumn($table, 'sisa')) {
                        $query->where('sisa', '>', 0);
                    }
                    break;
                case 'belum_dijurnal':
                    if (Schema::hasColumn($table, 'jurnal')) {
                        $query->whereRaw("IFNULL(jurnal,'') = '' OR jurnal = ' '");
                    }
                    break;
                default:
                    break;
            }
        }

        $items = $query->get();

        $summary = [
            'unpaid_count' => 0,
            'unpaid_total' => 0,
        ];

        if (Schema::hasColumn($table, 'jumlah_bayar') && Schema::hasColumn($table, 'sisa')) {
            $summary['unpaid_count'] = (clone $query)->whereRaw('jumlah_bayar = sisa')->count();
            $summary['unpaid_total'] = (clone $query)->whereRaw('jumlah_bayar = sisa')->sum('sisa');
        }

        return response()->json([
            'items' => $items,
            'summary' => $summary,
        ]);
    }

    public function show(string $noBkj)
    {
        $table = 'tb_biayakirimjual';
        if (!Schema::hasTable($table)) {
            return response()->json(['message' => 'Data BKJ tidak ditemukan.'], 404);
        }

        $header = DB::table($table)->where('no_bkj', $noBkj)->first();
        if (!$header) {
            return response()->json(['message' => 'Data BKJ tidak ditemukan.'], 404);
        }

        return response()->json(['header' => $header]);
    }

    public function detailList(string $noBkj)
    {
        $table = 'tb_biayakirimjualdetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['details' => []]);
        }

        $query = DB::table($table)->orderByDesc('no_do');
        if (Schema::hasColumn($table, 'no_bkj')) {
            $query->where('no_bkj', $noBkj);
        }

        $details = $query->select('no_do', 'tgl_do', 'customer')
        ->distinct()
        ->get();

        return response()->json(['details' => $details]);
    }

    public function materialList(Request $request, string $noBkj)
    {
        $noDo = $request->query('no_do');
        if (!$noDo) {
            return response()->json(['materials' => []]);
        }

        $table = 'tb_biayakirimjualdetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['materials' => []]);
        }

        $query = DB::table($table)->orderBy('material');
        if (Schema::hasColumn($table, 'no_bkj')) {
            $query->where('no_bkj', $noBkj);
        }
        if (Schema::hasColumn($table, 'no_do')) {
            $query->where('no_do', $noDo);
        }

        $materials = $query->select(DB::raw('material as mat'), 'qty', 'unit', 'harga_beli', 'harga_jual', 'margin_sbkj')->get();

        return response()->json(['materials' => $materials]);
    }

    public function destroy(string $noBkj)
    {
        $table = 'tb_biayakirimjual';
        if (!Schema::hasTable($table)) {
            return back()->with('error', 'Data BKJ tidak ditemukan.');
        }

        try {
            DB::table($table)->where('no_bkj', $noBkj)->delete();
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Data BKJ berhasil dihapus.');
    }

    public function store(Request $request)
    {
        $rows = $request->input('rows', []);
        $rowsAdd = $request->input('rows_add', []);
        if (!is_array($rows)) {
            $rows = [];
        }
        if (!is_array($rowsAdd)) {
            $rowsAdd = [];
        }
        if (count($rows) === 0 && count($rowsAdd) === 0) {
            return back()->with('error', 'Data biaya kirim penjualan kosong.');
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $allowed = config('tenants.databases', []);
        $rawPrefix = in_array($database, $allowed, true) ? $database : 'SJA';
        $labelPrefix = config("tenants.labels.$rawPrefix");
        $prefixSource = $labelPrefix ?: $rawPrefix;
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $prefixSource));
        if (str_starts_with($prefix, 'DB')) {
            $prefix = substr($prefix, 2);
        }
        if ($prefix === '') {
            $prefix = 'SJA';
        }
        $prefix = $prefix.'.BKJ-';

        $now = Carbon::now('Asia/Singapore');
        $tanggalDb = $now->format('Y-m-d');

        $docDateInput = $request->input('doc_date');
        $tglInv = $docDateInput;
        try {
            $tglInv = $docDateInput
                ? Carbon::parse($docDateInput)->format('Y-m-d')
                : $docDateInput;
        } catch (\Throwable $e) {
            $tglInv = $docDateInput;
        }

        $totalBeli = (float) $request->input('total_cost', 0);
        $totalJual = (float) $request->input('total_sales', 0);
        $biayaKirim = (float) $request->input('biaya_kirim', 0);
        $marginPercent = (float) $request->input('margin_percent', 0);
        $marginFinal = $request->input('margin_final', $marginPercent);
        $totalDot = (float) $request->input('total_dot', 0);
        $namaEkspedisi = trim((string) $request->input('nama_ekspedisi', ''));
        $noInvoice = trim((string) $request->input('no_invoice', ''));

        DB::transaction(function () use (
            $rows,
            $prefix,
            $tanggalDb,
            $tglInv,
            $totalBeli,
            $totalJual,
            $biayaKirim,
            $marginPercent,
            $marginFinal,
            $totalDot,
            $namaEkspedisi,
            $noInvoice
        ) {
            $headerTable = 'tb_biayakirimjual';
            $detailTable = 'tb_biayakirimjualdetail';

            $lastNumber = Schema::hasTable($headerTable)
                ? DB::table($headerTable)
                    ->where('no_bkj', 'like', $prefix.'%')
                    ->orderBy('no_bkj', 'desc')
                    ->lockForUpdate()
                    ->value('no_bkj')
                : null;

            $sequence = 1;
            if ($lastNumber) {
                $suffix = substr($lastNumber, strlen($prefix));
                $sequence = max(1, (int) $suffix + 1);
            }

            $noBkj = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

            if (Schema::hasTable($headerTable)) {
                $headerData = [
                    'no_bkj' => $noBkj,
                    'tanggal' => $tanggalDb,
                    'no_inv' => $noInvoice,
                    'jumlah_beban' => $biayaKirim,
                    'jumlah_inv' => $biayaKirim,
                    'jumlah_bayar' => $biayaKirim,
                    'gtotal_beli' => $totalBeli,
                    'totalbeli_biayajual' => $totalBeli,
                    'gtotal_jual' => $totalJual,
                    'margin_sbj' => $marginPercent.'%',
                    'margin_final' => $marginFinal,
                    'sisa' => 0,
                    'total_dot' => $totalDot,
                    'keterangan' => ' ',
                    'jurnal' => ' ',
                ];

                if (Schema::hasColumn($headerTable, 'nama_vendor')) {
                    $headerData['nama_vendor'] = $namaEkspedisi;
                } elseif (Schema::hasColumn($headerTable, 'nma_vendor')) {
                    $headerData['nma_vendor'] = $namaEkspedisi;
                }

                if (Schema::hasColumn($headerTable, 'tgl_inv')) {
                    $headerData['tgl_inv'] = $tglInv;
                }

                DB::table($headerTable)->insert($headerData);
            }

            if (Schema::hasTable($detailTable)) {
                foreach (array_merge($rows, $rowsAdd) as $row) {
                    $detailData = [
                        'no_bkj' => $noBkj,
                        'no_do' => $row['no_po'] ?? $row['no_do'] ?? null,
                        'tgl_do' => $row['date'] ?? null,
                        'customer' => $row['customer'] ?? null,
                        'po_cust' => $row['ref_po_in'] ?? $row['ref_do'] ?? null,
                        'material' => $row['material'] ?? null,
                        'qty' => $row['qty'] ?? 0,
                        'unit' => $row['unit'] ?? null,
                        'harga_beli' => $row['price'] ?? 0,
                        'harga_jual' => $row['price_sell'] ?? 0,
                        'margin_sbkj' => $row['margin'] ?? null,
                    ];

                    DB::table($detailTable)->insert($detailData);
                }
            }
        });

        return redirect()
            ->route('penjualan.biaya-kirim-penjualan.index')
            ->with('success', 'Data biaya kirim penjualan berhasil disimpan.');
    }
}
