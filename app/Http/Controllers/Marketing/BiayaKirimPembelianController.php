<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Support\Carbon;

class BiayaKirimPembelianController
{
    public function index(Request $request)
    {
        return Inertia::render('Pembayaran/biaya-kirim-pembelian/index', [
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
        return Inertia::render('Pembayaran/biaya-kirim-pembelian/create', [
            'poRows' => [],
        ]);
    }

    public function edit(string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return redirect()
                ->route('pembayaran.biaya-kirim-pembelian.index')
                ->with('error', 'Data BKP tidak ditemukan.');
        }

        $details = DB::table('tb_biayakirimbelidetail as d')
            ->leftJoin('tb_detailpo as p', function ($join) {
                $join->on('p.no_po', '=', 'd.no_po')
                    ->orOn(DB::raw('p.no_po'), '=', DB::raw('TRIM(d.no_po)'));
            })
            ->where('d.no_bkp', $noBkp)
            ->orderBy('d.no_po')
            ->select('d.*', 'p.kd_vdr as po_kd_vdr')
            ->get();

        return Inertia::render('Pembayaran/biaya-kirim-pembelian/edit', [
            'header' => $header,
            'details' => $details,
        ]);
    }

    public function data(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'all');

        $query = DB::table('tb_biayakirimbeli');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('no_bkp', 'like', $term)
                    ->orWhere('Vendor_Ekspedisi', 'like', $term)
                    ->orWhere('no_inv', 'like', $term);
            });
        }

        switch ($status) {
            case 'belum_dibayar':
                $query->whereColumn('Total_Biaya', 'pembayaran');
                break;
            case 'sisa_bayar':
                $query->whereRaw('COALESCE(sisa, 0) > 0');
                break;
            case 'belum_dijurnal':
                $query->where(function ($q) {
                    $q->whereNull('trx_kas')
                        ->orWhere('trx_kas', '')
                        ->orWhere('trx_kas', ' ');
                });
                break;
            case 'all':
            default:
                break;
        }

        $items = $query
            ->orderByDesc('no_bkp')
            ->get();

        $unpaidQuery = DB::table('tb_biayakirimbeli')
            ->whereColumn('Total_Biaya', 'pembayaran');
        $unpaidCount = (int) $unpaidQuery->count();
        $unpaidTotal = (float) $unpaidQuery->sum('Total_Biaya');

        return response()->json([
            'items' => $items,
            'summary' => [
                'unpaid_count' => $unpaidCount,
                'unpaid_total' => $unpaidTotal,
            ],
        ]);
    }

    public function poList(Request $request)
    {
        $search = $request->query('search');
        $pageSize = $request->query('pageSize', 5);
        $page = (int) $request->query('page', 1);
        if ($page < 1) {
            $page = 1;
        }

        $query = DB::table('tb_detailpo')
            ->select('no_po', 'tgl', 'ref_poin', 'for_cus', 'kd_vdr', 'nm_vdr', 'franco_loco')
            ->whereNotNull('no_gudang')
            ->where('no_gudang', '<>', '')
            ->whereRaw('COALESCE(qtybiayakirim, 0) = 0')
            ->distinct()
            ->orderByDesc('no_po');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('no_po', 'like', $term)
                    ->orWhere('ref_poin', 'like', $term)
                    ->orWhere('for_cus', 'like', $term);
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

    public function poMaterials(Request $request)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['rows' => []]);
        }

        $rows = DB::table('tb_detailpo')
            ->select('kd_mat', 'material', 'qty', 'unit', 'price', 'total_price')
            ->where('no_po', $noPo)
            ->orderBy('kd_mat')
            ->get();

        return response()->json(['rows' => $rows]);
    }

    public function prPrice(Request $request)
    {
        $refPo = $request->query('ref_po');
        $kdMaterial = $request->query('kd_material');
        if (!$refPo) {
            return response()->json(['price_po' => null]);
        }

        $query = DB::table('tb_detailpr')->where('ref_po', $refPo);
        if ($kdMaterial) {
            $query->where('kd_material', $kdMaterial);
        }
        $price = $query->orderBy('kd_material')->value('price_po');

        return response()->json(['price_po' => $price]);
    }

    public function store(Request $request)
    {
        $rows = $request->input('rows', []);
        if (!is_array($rows) || count($rows) === 0) {
            return back()->with('error', 'Data biaya kirim pembelian kosong.');
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
        $prefix = $prefix.'.BKP-';

        $now = Carbon::now('Asia/Singapore');
        $tanggalDb = $now->format('Y-m-d');
        $tglPos = $tanggalDb;

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
        $biayaKirim = (float) $request->input('biaya_kirim', 0);
        $totalJual = (float) $request->input('total_sales', 0);
        $marginPercent = (float) $request->input('margin_percent', 0);
        $namaEkspedisi = trim((string) $request->input('nama_ekspedisi', ''));
        $noInvoice = trim((string) $request->input('no_invoice', ''));

        if ($namaEkspedisi === '') {
            return back()->with('error', 'Nama ekspedisi wajib diisi.');
        }

        DB::transaction(function () use (
            $rows,
            $prefix,
            $tglPos,
            $tanggalDb,
            $tglInv,
            $totalBeli,
            $biayaKirim,
            $totalJual,
            $marginPercent,
            $namaEkspedisi,
            $noInvoice
        ) {
            $lastNumber = DB::table('tb_biayakirimbeli')
                ->where('no_bkp', 'like', $prefix.'%')
                ->orderBy('no_bkp', 'desc')
                ->lockForUpdate()
                ->value('no_bkp');

            $sequence = 1;
            if ($lastNumber) {
                $suffix = substr($lastNumber, strlen($prefix));
                $sequence = max(1, (int) $suffix + 1);
            }

            $noBkp = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

            DB::table('tb_biayakirimbeli')->insert([
                'no_bkp' => $noBkp,
                'tgl_inv' => $tglInv,
                'total_beli' => $totalBeli,
                'biaya_kirim' => $biayaKirim,
                'Total_Biaya' => $biayaKirim,
                'pembayaran' => $biayaKirim,
                'gtotal_jual' => $totalJual,
                'margin' => $marginPercent.'%',
                'Vendor_Ekspedisi' => $namaEkspedisi,
                'no_inv' => $noInvoice,
                'keterangan' => ' ',
                'sisa' => 0,
                'trx_kas' => ' ',
                'tanggal' => $tanggalDb,
            ]);

            foreach ($rows as $row) {
                $tglPoRaw = $row['date'] ?? null;
                $tglPo = $tglPoRaw;
                try {
                    $tglPo = $tglPoRaw ? Carbon::parse($tglPoRaw)->format('d.m.Y') : $tglPoRaw;
                } catch (\Throwable $e) {
                    $tglPo = $tglPoRaw;
                }

                $idPo = DB::table('tb_detailpo')
                    ->where('ref_poin', $row['ref_po_in'] ?? null)
                    ->where('nm_vdr', $row['vendor'] ?? null)
                    ->where('material', $row['material'] ?? null)
                    ->value('id_po');

                DB::table('tb_biayakirimbelidetail')->insert([
                    'no_bkp' => $noBkp,
                    'no_po' => $row['no_po'] ?? null,
                    'tgl_pos' => $tglPos,
                    'tgl_po' => $tglPo,
                    'customer' => $row['customer'] ?? null,
                    'po_cust' => $row['ref_po_in'] ?? null,
                    'vendor' => $row['vendor'] ?? null,
                    'franco' => $row['franco'] ?? null,
                    'material' => $row['material'] ?? null,
                    'qty' => $row['qty'] ?? 0,
                    'end_qty' => $row['qty'] ?? 0,
                    'unit' => $row['unit'] ?? null,
                    'harga_modal' => $row['price'] ?? 0,
                    'total_modal' => $row['total_price'] ?? 0,
                    'harga_jual' => $row['price_sell'] ?? 0,
                    'total_jual' => $row['total_price_sell'] ?? 0,
                    'margin' => isset($row['margin']) ? ($row['margin'].'%') : '0%',
                    'id_po' => $idPo,
                ]);

                DB::table('tb_detailpo')
                    ->where('ref_poin', $row['ref_po_in'] ?? null)
                    ->where('nm_vdr', $row['vendor'] ?? null)
                    ->where('material', $row['material'] ?? null)
                    ->update(['qtybiayakirim' => $row['qty'] ?? 0]);
            }
        });

        return redirect()
            ->route('pembayaran.biaya-kirim-pembelian.index')
            ->with('success', 'Data biaya kirim pembelian berhasil disimpan.');
    }

    public function update(Request $request, string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return back()->with('error', 'Data BKP tidak ditemukan.');
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

        try {
            DB::table('tb_biayakirimbeli')
                ->where('no_bkp', $noBkp)
                ->update([
                    'tgl_inv' => $tglInv,
                    'biaya_kirim' => $request->input('biaya_kirim', 0),
                    'no_inv' => $request->input('no_invoice', ''),
                    'Vendor_Ekspedisi' => $request->input('nama_ekspedisi', ''),
                    'margin' => ((float) $request->input('margin_percent', 0)).'%',
                ]);
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()
            ->route('pembayaran.biaya-kirim-pembelian.index')
            ->with('success', 'Data biaya kirim pembelian berhasil diperbarui.');
    }

    public function destroy(string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return back()->with('error', 'Data BKP tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($noBkp) {
                $details = DB::table('tb_biayakirimbelidetail')
                    ->where('no_bkp', $noBkp)
                    ->get(['no_po', 'material']);

                foreach ($details as $detail) {
                    if (!$detail->no_po || !$detail->material) {
                        continue;
                    }
                    DB::table('tb_detailpo')
                        ->where('no_po', $detail->no_po)
                        ->where('material', $detail->material)
                        ->update(['qtybiayakirim' => 0]);
                }

                DB::table('tb_biayakirimbelidetail')
                    ->where('no_bkp', $noBkp)
                    ->delete();

                DB::table('tb_biayakirimbeli')
                    ->where('no_bkp', $noBkp)
                    ->delete();
            });
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Data BKP berhasil dihapus.');
    }

    public function print(Request $request, string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return redirect()
                ->route('pembayaran.biaya-kirim-pembelian.index')
                ->with('error', 'Data BKP tidak ditemukan.');
        }

        $details = DB::table('tb_biayakirimbelidetail')
            ->where('no_bkp', $noBkp)
            ->orderBy('no_po')
            ->orderBy('material')
            ->get();

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

        return Inertia::render('Pembayaran/biaya-kirim-pembelian/print', [
            'header' => $header,
            'details' => $details,
            'company' => $company,
            'printDate' => $printDate,
        ]);
    }

    public function show(string $noBkp)
    {
        $header = DB::table('tb_biayakirimbeli')
            ->where('no_bkp', $noBkp)
            ->first();

        if (!$header) {
            return response()->json(['message' => 'Data BKP tidak ditemukan.'], 404);
        }

        return response()->json(['header' => $header]);
    }

    public function detailList(string $noBkp)
    {
        $table = 'tb_biayakirimbelidetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['details' => []]);
        }

        $query = DB::table($table)->orderBy('no_po');

        if (Schema::hasColumn($table, 'no_bkp')) {
            $query->where('no_bkp', $noBkp);
        }

        $details = $query->select('no_po', 'tgl_po', 'customer', 'vendor', 'franco')->distinct()->get();

        return response()->json(['details' => $details]);
    }

    public function materialList(Request $request, string $noBkp)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['materials' => []]);
        }

        $table = 'tb_biayakirimbelidetail';
        if (!Schema::hasTable($table)) {
            return response()->json(['materials' => []]);
        }

        $query = DB::table($table)->orderBy('material');
        if (Schema::hasColumn($table, 'no_bkp')) {
            $query->where('no_bkp', $noBkp);
        }
        if (Schema::hasColumn($table, 'no_po')) {
            $query->where('no_po', $noPo);
        }

        $materials = $query->get();

        return response()->json(['materials' => $materials]);
    }
}
