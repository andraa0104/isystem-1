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
        return Inertia::render('Pembayaran/biaya-kirim-penjualan/index', [
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
        return Inertia::render('Pembayaran/biaya-kirim-penjualan/create', [
            'poRows' => [],
        ]);
    }


    public function edit(string $noBkj)
    {
        $header = null;
        $details = [];

        if (Schema::hasTable('tb_biayakirimjual')) {
            $header = DB::table('tb_biayakirimjual')->where('no_bkj', $noBkj)->first();
        }

        if (Schema::hasTable('tb_biayakirimjualdetail')) {
            $details = DB::table('tb_biayakirimjualdetail')
                ->where('no_bkj', $noBkj)
                ->get();
        }

        return Inertia::render('Pembayaran/biaya-kirim-penjualan/edit', [
            'noBkj' => $noBkj,
            'header' => $header,
            'details' => $details,
            'poRows' => [],
        ]);
    }

    public function update(Request $request, string $noBkj)
    {
        $headerTable = 'tb_biayakirimjual';
        $detailTable = 'tb_biayakirimjualdetail';

        if (!Schema::hasTable($headerTable)) {
            return back()->with('error', 'Data BKJ tidak ditemukan.');
        }

        $docDateInput = $request->input('doc_date');
        $tglInv = $docDateInput;
        try {
            $tglInv = $docDateInput
                ? Carbon::parse($docDateInput)->format('Y-m-d')
                : $docDateInput;
        } catch (\Throwable $e) {
            $tglInv = $docDateInput;
        }

        $noInvoice = trim((string) $request->input('no_invoice', ''));
        $namaEkspedisi = trim((string) $request->input('nama_ekspedisi', ''));
        $biayaKirim = (float) $request->input('biaya_kirim', 0);
        $finalMargin = number_format((float) $request->input('final_margin', 0), 2, '.', '').'%';
        $totalCost = (float) $request->input('total_cost', 0);
        $totalBeliBiayaJual = $totalCost + $biayaKirim;

        DB::transaction(function () use (
            $headerTable,
            $detailTable,
            $noBkj,
            $tglInv,
            $noInvoice,
            $namaEkspedisi,
            $biayaKirim,
            $finalMargin,
            $totalBeliBiayaJual
        ) {
            $headerUpdate = [
                'tgl_inv' => $tglInv,
                'no_inv' => $noInvoice,
                'nama_vendor' => $namaEkspedisi,
                'jumlah_inv' => $biayaKirim,
                'jumlah_beban' => $biayaKirim,
                'sisa' => $biayaKirim,
                'margin_sbj' => $finalMargin,
                'totalbeli_biayajual' => $totalBeliBiayaJual,
            ];

            if (!Schema::hasColumn($headerTable, 'nama_vendor') && Schema::hasColumn($headerTable, 'nma_vendor')) {
                unset($headerUpdate['nama_vendor']);
                $headerUpdate['nma_vendor'] = $namaEkspedisi;
            }

            DB::table($headerTable)->where('no_bkj', $noBkj)->update($headerUpdate);

            if (Schema::hasTable($detailTable) && Schema::hasColumn($detailTable, 'margin_final')) {
                DB::table($detailTable)
                    ->where('no_bkj', $noBkj)
                    ->update(['margin_final' => $finalMargin]);
            }
        });

        return redirect()
            ->route('pembayaran.biaya-kirim-penjualan.index')
            ->with('success', 'Data biaya kirim penjualan berhasil diperbarui.');
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

    public function biayaKirim(Request $request)
    {
        $refPo = $request->query('ref_po');
        $material = $request->query('material');

        if (!$refPo || !$material) {
            return response()->json(['biaya_kirim' => null]);
        }

        $detailTable = Schema::hasTable('tb_biayakirimbelidetail') ? 'tb_biayakirimbelidetail' : null;
        if (!$detailTable || !Schema::hasTable('tb_biayakirimbeli')) {
            return response()->json(['biaya_kirim' => null]);
        }

        $materialNormalized = preg_replace('/\s+/', '', trim((string) $material));
        $refPoNormalized = preg_replace('/\s+/', '', trim((string) $refPo));

        $noBkp = DB::table($detailTable.' as d')
            ->whereRaw("lower(replace(replace(replace(replace(d.material, '\\r', ''), '\\n', ''), '\\t', ''), ' ', '')) = lower(?)", [$materialNormalized])
            ->whereRaw("lower(replace(replace(replace(replace(d.po_cust, '\\r', ''), '\\n', ''), '\\t', ''), ' ', '')) = lower(?)", [$refPoNormalized])
            ->orderBy('d.tgl_pos', 'desc')
            ->value('d.no_bkp');

        $biayaKirim = null;
        if ($noBkp) {
            $biayaKirim = DB::table('tb_biayakirimbeli')
                ->where('no_bkp', $noBkp)
                ->value('Total_Biaya');
        }

        return response()->json(['biaya_kirim' => $biayaKirim]);
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
        $summaryQuery = DB::table($table);

        if ($search) {
            $term = '%'.trim($search).'%';
            $applySearch = function ($q) use ($term, $table) {
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
            };

            $query->where(function ($q) use ($applySearch) {
                $applySearch($q);
            });
            $summaryQuery->where(function ($q) use ($applySearch) {
                $applySearch($q);
            });
        }

        if (Schema::hasColumn($table, 'sisa') && Schema::hasColumn($table, 'jumlah_beban')) {
            switch ($status) {
                case 'belum_dibayar':
                    $query->whereRaw('sisa = jumlah_beban');
                    break;
                case 'sisa_bayar':
                    if (Schema::hasColumn($table, 'sisa')) {
                        $query->where('sisa', '>', 0);
                        if (Schema::hasColumn($table, 'jumlah_beban')) {
                            $query->whereRaw('sisa <> jumlah_beban');
                        }
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

        if (Schema::hasColumn($table, 'sisa') && Schema::hasColumn($table, 'jumlah_beban')) {
            // Summary "BKJ belum dibayar" harus selalu berdasarkan kondisi belum dibayar,
            // tidak mengikuti filter status (mis. "belum di jurnal").
            $summary['unpaid_count'] = (clone $summaryQuery)
                ->whereRaw('sisa = jumlah_beban')
                ->count();
            $summary['unpaid_total'] = (clone $summaryQuery)
                ->whereRaw('sisa = jumlah_beban')
                ->sum('sisa');
        }

        return response()->json([
            'items' => $items,
            'summary' => $summary,
        ]);
    }

    public function print(Request $request, string $noBkj)
    {
        $headerTable = 'tb_biayakirimjual';
        $detailTable = 'tb_biayakirimjualdetail';

        if (!Schema::hasTable($headerTable)) {
            return redirect()
                ->route('pembayaran.biaya-kirim-penjualan.index')
                ->with('error', 'Data BKJ tidak ditemukan.');
        }

        $header = DB::table($headerTable)->where('no_bkj', $noBkj)->first();
        if (!$header) {
            return redirect()
                ->route('pembayaran.biaya-kirim-penjualan.index')
                ->with('error', 'Data BKJ tidak ditemukan.');
        }

        $details = collect();
        if (Schema::hasTable($detailTable)) {
            $details = DB::table($detailTable)
                ->where('no_bkj', $noBkj)
                ->orderBy('no_do')
                ->orderBy('code_mat')
                ->get();
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
        }
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", $lookupKey)
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        $printDate = Carbon::now()
            ->locale('id')
            ->translatedFormat('d F Y');

        return Inertia::render('Pembayaran/biaya-kirim-penjualan/print', [
            'header' => $header,
            'details' => $details,
            'company' => $company,
            'printDate' => $printDate,
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

        $details = $query->select('no_do', 'tgl_do', 'customer', 'no_dob')
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

    public function dotMaterialList(Request $request, string $noBkj)
    {
        $noDob = $request->query('no_dob');
        if (!$noDob || !Schema::hasTable('tb_dob')) {
            return response()->json(['rows' => []]);
        }

        $rows = DB::table('tb_dob')
            ->select('kd_mat', 'mat', 'qty', 'unit', 'harga', 'total')
            ->where('no_dob', $noDob)
            ->orderBy('kd_mat')
            ->get();

        return response()->json(['rows' => $rows]);
    }

    public function destroy(string $noBkj)
    {
        $headerTable = 'tb_biayakirimjual';
        $detailTable = 'tb_biayakirimjualdetail';
        
        if (!Schema::hasTable($headerTable)) {
            return back()->with('error', 'Data BKJ tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($headerTable, $detailTable, $noBkj) {
                // Delete from detail table first (foreign key constraint)
                if (Schema::hasTable($detailTable)) {
                    DB::table($detailTable)->where('no_bkj', $noBkj)->delete();
                }
                
                // Then delete from header table
                DB::table($headerTable)->where('no_bkj', $noBkj)->delete();
            });
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
        $shippingSalesPercent = (float) number_format((float) $request->input('shipping_sales_percent', 0), 2, '.', '');
        $marginFinal = (float) number_format((float) $request->input('margin_final', 0), 2, '.', '');
        $marginSbjValue = number_format($shippingSalesPercent, 2, '.', '');
        $marginSbj = $marginSbjValue.'%';
        $totalDot = (float) $request->input('total_dot', 0);
        $namaEkspedisi = trim((string) $request->input('nama_ekspedisi', ''));
        $noInvoice = trim((string) $request->input('no_invoice', ''));

        DB::transaction(function () use (
            $rows,
            $rowsAdd,
            $prefix,
            $tanggalDb,
            $tglInv,
            $totalBeli,
            $totalJual,
            $biayaKirim,
            $shippingSalesPercent,
            $marginSbj,
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
                    'jumlah_bayar' => 0,
                    'gtotal_beli' => $totalBeli,
                    'totalbeli_biayajual' => $totalBeli,
                    'gtotal_jual' => $totalJual,
                    'margin_sbj' => $marginSbj,
                    'margin_final' => $marginFinal.'%',
                    'sisa' => $biayaKirim,
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
                $doAddMap = [];
                foreach ($rowsAdd as $rowAdd) {
                    $key = (string) ($rowAdd['no_do'] ?? '');
                    if ($key === '') {
                        continue;
                    }
                    $doAddMap[$key] = [
                        'no_dob' => $rowAdd['no_dot'] ?? 0,
                        'jumlah_dot' => $rowAdd['total_price'] ?? 0,
                    ];
                }

                foreach ($rows as $row) {
                    $noDo = $row['no_po'] ?? $row['no_do'] ?? null;
                    $kdMat = $row['kd_mat'] ?? null;
                    $idDo = null;
                    if ($noDo && $kdMat && Schema::hasTable('tb_do')) {
                        $idDo = DB::table('tb_do')
                            ->where('no_do', $noDo)
                            ->where('kd_mat', $kdMat)
                            ->value('id');
                    }

                    $dotInfo = $noDo && isset($doAddMap[$noDo]) ? $doAddMap[$noDo] : ['no_dob' => 0, 'jumlah_dot' => 0];
                    $totalPrice = $row['total_price'] ?? 0;
                    $biayaBeli = $row['biaya_kirim'] ?? 0;

                    $detailData = [
                        'no_bkj' => $noBkj,
                        'tgl_pos' => $tanggalDb,
                        'no_do' => $noDo,
                        'tgl_do' => $row['date'] ?? null,
                        'customer' => $row['customer'] ?? null,
                        'po_cust' => $row['ref_po_in'] ?? $row['ref_do'] ?? null,
                        'code_mat' => $row['kd_mat'] ?? null,
                        'material' => $row['material'] ?? null,
                        'qty' => $row['qty'] ?? 0,
                        'unit' => $row['unit'] ?? null,
                        'harga_beli' => $row['price'] ?? 0,
                        'total_beli' => $totalPrice,
                        'biaya_beli' => $biayaBeli,
                        'totalbeli_biaya' => (float) $totalPrice + (float) $biayaBeli,
                        'harga_jual' => $row['price_sell'] ?? 0,
                        'total_jual' => $row['total_price_sell'] ?? 0,
                        'margin_sbkj' => $row['margin'].'%',
                        'Vendor_Ekspedisi' => $namaEkspedisi,
                        'biaya_jual' => $biayaKirim,
                        'margin_final' => $marginFinal.'%',
                        'no_dob' => $dotInfo['no_dob'],
                        'jumlah_dot' => $dotInfo['jumlah_dot'],
                        'id_do' => $idDo,
                    ];

                    DB::table($detailTable)->insert($detailData);
                }
            }
        });

        return redirect()
            ->route('pembayaran.biaya-kirim-penjualan.index')
            ->with('success', 'Data biaya kirim penjualan berhasil disimpan.');
    }

    private function materialSection(string $table, string $label): array
    {
        if (!Schema::hasTable($table)) {
            return [
                'label' => $label,
                'count' => 0,
                'rows' => [],
            ];
        }

        $query = DB::table($table);
        $rows = $query
            ->select('kd_mat', 'material', 'qty', 'unit', 'price', 'total_price')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                return [
                    'kd_mat' => $row->kd_mat,
                    'material' => $row->material,
                    'qty' => $row->qty,
                    'unit' => $row->unit,
                    'price' => $row->price,
                    'total_price' => $row->total_price,
                ];
            })
            ->toArray();

        return [
            'label' => $label,
            'count' => (int) $query->count(),
            'rows' => $rows,
        ];
    }
}
