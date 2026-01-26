<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Carbon\Carbon;

class FakturPenjualanController
{
    public function index()
    {
        $unpaidCount = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->count();

        $unpaidTotal = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        $noReceiptCount = DB::table('tb_kdfakturpenjualan')
            ->where(function ($query) {
                $query->whereNull('no_kwitansi')
                    ->orWhereRaw("ltrim(rtrim(coalesce(no_kwitansi, ''))) = ''")
                    ->orWhereRaw("upper(ltrim(rtrim(coalesce(no_kwitansi, '')))) = 'NULL'");
            })
            ->count();

        $noReceiptTotal = DB::table('tb_kdfakturpenjualan')
            ->where(function ($query) {
                $query->whereNull('no_kwitansi')
                    ->orWhereRaw("ltrim(rtrim(coalesce(no_kwitansi, ''))) = ''")
                    ->orWhereRaw("upper(ltrim(rtrim(coalesce(no_kwitansi, '')))) = 'NULL'");
            })
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        $dueCount = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->whereDate('jth_tempo', '<=', now())
            ->count();

        $dueTotal = DB::table('tb_kdfakturpenjualan')
            ->where('total_bayaran', 0)
            ->whereDate('jth_tempo', '<=', now())
            ->sum(DB::raw('coalesce(cast(g_total as decimal(18,4)), 0)'));

        return Inertia::render('Penjualan/faktur-penjualan/index', [
            'unpaidCount' => $unpaidCount,
            'unpaidTotal' => $unpaidTotal,
            'noReceiptCount' => $noReceiptCount,
            'noReceiptTotal' => $noReceiptTotal,
            'dueCount' => $dueCount,
            'dueTotal' => $dueTotal,
        ]);
    }

    public function listInvoices()
    {
        $invoices = DB::table('tb_kdfakturpenjualan')
            ->select(
                'no_fakturpenjualan',
                'tgl_doc',
                'nm_cs',
                'ref_po',
                'g_total',
                'saldo_piutang',
                'total_bayaran',
                'tgl_terimainv',
                'no_kwitansi',
                'jth_tempo',
                'trx_jurnal',
            )
            ->orderBy('no_fakturpenjualan', 'desc')
            ->get();

        return response()->json([
            'data' => $invoices,
        ]);
    }


    public function create()
    {
        return Inertia::render('Penjualan/faktur-penjualan/create');
    }

    public function edit(string $noFaktur)
    {
        $invoice = DB::table('tb_kdfakturpenjualan')
            ->where('no_fakturpenjualan', $noFaktur)
            ->first();

        if (!$invoice) {
            return redirect()
                ->route('penjualan.faktur-penjualan.index')
                ->with('error', 'Data invoice tidak ditemukan.');
        }

        $items = DB::table('tb_fakturpenjualan')
            ->select('no_do', 'kd_mat', 'material', 'qty', 'unit', 'price', 'ttl_price')
            ->where('no_fakturpenjualan', $noFaktur)
            ->orderBy('no')
            ->get();

        $hppMap = collect();
        if (!empty($invoice->ref_po)) {
            $hppMap = DB::table('tb_detailpo')
                ->select('material', DB::raw('coalesce(max(cast(price as decimal(18,4))), 0) as hpp'))
                ->where('ref_poin', $invoice->ref_po)
                ->groupBy('material')
                ->get()
                ->keyBy('material');
        }

        $items = $items->map(function ($item) use ($hppMap) {
            $hpp = 0;
            if ($hppMap->has($item->material)) {
                $hpp = (float) ($hppMap->get($item->material)->hpp ?? 0);
            }
            $sourceType = str_contains((string) $item->no_do, 'DOT-')
                ? 'dot'
                : 'do';

            return [
                'no_ref' => $item->no_do,
                'kd_material' => $item->kd_mat,
                'material' => $item->material,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'price' => $item->price,
                'total' => $item->ttl_price,
                'hpp' => $hpp,
                'total_hpp' => (float) $item->qty * (float) $hpp,
                'source_type' => $sourceType,
            ];
        });

        return Inertia::render('Penjualan/faktur-penjualan/edit', [
            'invoice' => $invoice,
            'materialRows' => $items,
        ]);
    }

    public function store(Request $request)
    {
        $date = $request->input('date');
        $dueDate = $request->input('due_date');
        $refPoIn = $request->input('ref_po_in');
        $kdCs = $request->input('kd_cs');
        $nmCs = $request->input('nm_cs');
        $ppn = $request->input('ppn');
        $noFakturPajak = $request->input('no_fakturpajak');
        $materialRows = $request->input('materials', []);
        $grandTotalPrice = $request->input('grand_total_price', 0);
        $totalPpn = $request->input('total_ppn', 0);
        $grandTotalHpp = $request->input('grand_total_hpp', 0);
        $grandTotalWithPpn = $request->input('grand_total_with_ppn', 0);

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $prefix = 'GEN';
        if (is_string($database) && $database !== '') {
            $lookup = $database;
            if (Str::startsWith(Str::lower($lookup), 'db')) {
                $lookup = substr($lookup, 2);
            }
            $prefix = strtoupper($lookup);
        }

        $invoicePrefix = $prefix.'INV-';
        $startIndex = strlen($invoicePrefix) + 1;
        $lastNumber = DB::table('tb_kdfakturpenjualan')
            ->where('no_fakturpenjualan', 'like', $invoicePrefix.'%')
            ->select(DB::raw("max(cast(substring(no_fakturpenjualan, $startIndex) as unsigned)) as max_no"))
            ->value('max_no');
        $nextNumber = ((int) $lastNumber) + 1;
        $noFakturPenjualan = $invoicePrefix.str_pad((string) $nextNumber, 7, '0', STR_PAD_LEFT);

        $tglDoc = $date
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $date)->format('d.m.Y')
            : null;
        $tglPos = \Carbon\Carbon::now()->format('d.m.Y');
        $monthReport = \Carbon\Carbon::now()->startOfMonth()->format('Y-m-d');

        $ppnWithSymbol = trim((string) $ppn);
        if ($ppnWithSymbol !== '' && !str_ends_with($ppnWithSymbol, '%')) {
            $ppnWithSymbol .= '%';
        }

        DB::transaction(function () use (
            $materialRows,
            $refPoIn,
            $kdCs,
            $nmCs,
            $ppnWithSymbol,
            $noFakturPajak,
            $tglDoc,
            $dueDate,
            $tglPos,
            $noFakturPenjualan,
            $grandTotalPrice,
            $totalPpn,
            $grandTotalWithPpn,
            $grandTotalHpp,
            $monthReport
        ) {
            $totalHppDo = 0;
            $totalHppDot = 0;

            foreach ($materialRows as $index => $row) {
                $noRef = $row['no_ref'] ?? '';
                $kdMaterial = $row['kd_material'] ?? '';
                $material = $row['material'] ?? '';
                $qty = $row['qty'] ?? 0;
                $unit = $row['unit'] ?? '';
                $price = $row['price'] ?? 0;
                $total = $row['total'] ?? 0;
                $hpp = $row['hpp'] ?? 0;
                $totalHpp = $row['total_hpp'] ?? (float) $qty * (float) $hpp;
                $sourceType = $row['source_type'] ?? 'do';

                $idDo = null;
                if ($sourceType === 'dot') {
                    $idDo = DB::table('tb_dob')
                        ->where('no_dob', $noRef)
                        ->value('id');
                } else {
                    $idDo = DB::table('tb_do')
                        ->where('no_do', $noRef)
                        ->value('id');
                }

                DB::table('tb_fakturpenjualan')->insert([
                    'no' => $index + 1,
                    'no_do' => $noRef,
                    'kd_mat' => $kdMaterial,
                    'material' => $material,
                    'qty' => $qty,
                    'unit' => $unit,
                    'price' => $price,
                    'ttl_price' => $total,
                    'id_do' => $idDo,
                    'tgl_doc' => $tglDoc,
                    'jth_tempo' => $dueDate,
                    'ref_po' => $refPoIn,
                    'kd_cs' => $kdCs,
                    'nm_cs' => $nmCs,
                    'ppn' => $ppnWithSymbol,
                    'no_fakturpajak' => $noFakturPajak,
                    'no_fakturpenjualan' => $noFakturPenjualan,
                    'tgl_pos' => $tglPos,
                    'jurnal' => ' ',
                    'tgl_terimainv' => ' ',
                ]);

                if ($sourceType === 'dot') {
                    $totalHppDot += (float) $totalHpp;
                    DB::table('tb_dob')
                        ->where('no_dob', $noRef)
                        ->where('kd_mat', $kdMaterial)
                        ->update(['status' => 1]);
                } else {
                    $totalHppDo += (float) $totalHpp;
                    DB::table('tb_do')
                        ->where('no_do', $noRef)
                        ->where('kd_mat', $kdMaterial)
                        ->update([
                            'val_inv' => 1,
                            'inv' => $noFakturPenjualan,
                        ]);
                }
            }

            DB::table('tb_kdfakturpenjualan')->insert([
                'tgl_doc' => $tglDoc,
                'jth_tempo' => $dueDate,
                'ref_po' => $refPoIn,
                'kd_cs' => $kdCs,
                'nm_cs' => $nmCs,
                'ppn' => $ppnWithSymbol,
                'no_fakturpajak' => $noFakturPajak,
                'harga' => $grandTotalPrice,
                'h_ppn' => $totalPpn,
                'g_total' => $grandTotalWithPpn,
                'no_kwitansi' => ' ',
                'umur_oncst' => 0,
                'umur_tglinv' => 0,
                'saldo_piutang' => $grandTotalWithPpn,
                'total_bayaran' => 0,
                'Month_Report' => $monthReport,
                'trx_jurnal' => '1109AD',
                'HPP' => (float) $grandTotalHpp - (float) $totalHppDot,
                'HPPDOT' => (float) $grandTotalHpp - (float) $totalHppDo,
                'tgl_pos' => $tglPos,
                'no_fakturpenjualan' => $noFakturPenjualan,
            ]);
        });

        return redirect()
            ->route('penjualan.faktur-penjualan.index')
            ->with('success', 'Invoice berhasil ditambahkan.');
    }

    public function details(Request $request, string $noFaktur)
    {
        $header = DB::table('tb_kdfakturpenjualan')
            ->select(
                '*',
                'saldo_piutang',
                'total_bayaran',
            )
            ->where('no_fakturpenjualan', $noFaktur)
            ->first();

        $items = DB::table('tb_fakturpenjualan')
            ->select('no_do', 'material', 'qty', 'unit', 'ttl_price')
            ->where('no_fakturpenjualan', $noFaktur)
            ->orderBy('no')
            ->get();

        return response()->json([
            'invoice' => $header,
            'items' => $items,
        ]);
    }

    public function print(Request $request, string $noFaktur)
    {
        $invoice = DB::table('tb_kdfakturpenjualan')
            ->where('no_fakturpenjualan', $noFaktur)
            ->first();

        if (!$invoice) {
            return redirect()
                ->route('penjualan.faktur-penjualan.index')
                ->with('error', 'Data invoice tidak ditemukan.');
        }

        $details = DB::table('tb_fakturpenjualan')
            ->select('no_do', 'material', 'qty', 'unit', 'price', 'ttl_price')
            ->where('no_fakturpenjualan', $noFaktur)
            ->orderBy('no')
            ->get();

        $customer = null;
        if (!empty($invoice->nm_cs)) {
            $customer = DB::table('tb_cs')
                ->select('alamat_cs', 'kota_cs')
                ->where('nm_cs', $invoice->nm_cs)
                ->first();
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? $database : null;
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        if (!$companyConfig && is_string($lookupKey) && str_starts_with(strtolower($lookupKey), 'db')) {
            $altKey = substr($lookupKey, 2);
            $companyConfig = config("tenants.companies.$altKey", []);
            $lookupKey = $companyConfig ? $altKey : $lookupKey;
        }
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", strtoupper($lookupKey))
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        $isStg = is_string($database) && strtolower($database) === 'dbstg';
        $cityLabel = $isStg ? 'Banjarmasin' : 'Samarinda';

        return Inertia::render('Penjualan/faktur-penjualan/print', [
            'invoice' => $invoice,
            'details' => $details,
            'customer' => $customer,
            'company' => $company,
            'cityLabel' => $cityLabel,
            'isStg' => $isStg,
        ]);
    }

    public function uploadFakturPajak(Request $request)
    {
        $items = $request->input('items', []);
        if (!is_array($items)) {
            return response()->json([
                'message' => 'Format data tidak valid.',
            ], 422);
        }

        $updated = 0;
        DB::transaction(function () use ($items, &$updated) {
            foreach ($items as $item) {
                $invoiceNo = $item['no_fakturpenjualan'] ?? null;
                $noFakturPajak = $item['no_fakturpajak'] ?? null;
                if (!$invoiceNo || !$noFakturPajak) {
                    continue;
                }

                $affectedHeader = DB::table('tb_kdfakturpenjualan')
                    ->where('no_fakturpenjualan', $invoiceNo)
                    ->update(['no_fakturpajak' => $noFakturPajak]);

                $affectedDetail = DB::table('tb_fakturpenjualan')
                    ->where('no_fakturpenjualan', $invoiceNo)
                    ->update(['no_fakturpajak' => $noFakturPajak]);

                if ($affectedHeader || $affectedDetail) {
                    $updated++;
                }
            }
        });

        return response()->json([
            'updated' => $updated,
        ]);
    }

    public function storeKwitansi(Request $request)
    {
        $refFaktur = $request->input('ref_faktur');
        $date = $request->input('date');
        $customer = $request->input('customer');
        $totalPrice = $request->input('total_price', 0);

        if (!$refFaktur) {
            return response()->json([
                'message' => 'No invoice wajib diisi.',
            ], 422);
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $prefix = 'GEN';
        if (is_string($database) && $database !== '') {
            $lookup = $database;
            if (Str::startsWith(Str::lower($lookup), 'db')) {
                $lookup = substr($lookup, 2);
            }
            $prefix = strtoupper($lookup);
        }

        $kwitansiPrefix = $prefix.'.KWT-';
        $startIndex = strlen($kwitansiPrefix) + 1;
        $lastNumber = DB::table('tb_kwitansi')
            ->where('no_kwitansi', 'like', $kwitansiPrefix.'%')
            ->select(DB::raw("max(cast(substring(no_kwitansi, $startIndex) as unsigned)) as max_no"))
            ->value('max_no');
        $nextNumber = ((int) $lastNumber) + 1;
        $noKwitansi = $kwitansiPrefix.str_pad((string) $nextNumber, 7, '0', STR_PAD_LEFT);

        $tgl = $date
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $date)->format('d.m.Y')
            : null;

        try {
            DB::transaction(function () use (
                $refFaktur,
                $tgl,
                $customer,
                $totalPrice,
                $noKwitansi
            ) {
                DB::table('tb_kwitansi')->insert([
                    'ref_faktur' => $refFaktur,
                    'tgl' => $tgl,
                    'cs' => $customer,
                    'ttl_faktur' => $totalPrice,
                    'no_kwitansi' => $noKwitansi,
                ]);

                DB::table('tb_kdfakturpenjualan')
                    ->where('no_fakturpenjualan', $refFaktur)
                    ->update(['no_kwitansi' => $noKwitansi]);

            });
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menyimpan kwitansi: '.$e->getMessage(),
            ], 500);
        }

        return response()->json([
            'no_kwitansi' => $noKwitansi,
        ]);
    }

    public function update(Request $request, string $noFaktur)
    {
        $dateInput = $request->input('date');
        $dueDateInput = $request->input('due_date');
        $ppn = $request->input('ppn');
        $noFakturPajak = $request->input('no_fakturpajak');
        $materials = $request->input('materials', []);
        $totalPpn = $request->input('h_ppn', 0);
        $harga = $request->input('harga', 0);
        $grandTotal = $request->input('g_total', 0);

        if (!is_array($materials)) {
            return response()->json([
                'message' => 'Format data tidak valid.',
            ], 422);
        }

        $formattedDate = null;
        $formattedDue = null;
        try {
            if ($dateInput) {
                $formattedDate = Carbon::parse($dateInput)->format('Y-m-d');
            }
        } catch (\Throwable $e) {
            $formattedDate = null;
        }
        try {
            if ($dueDateInput) {
                $formattedDue = Carbon::parse($dueDateInput)->format('Y-m-d');
            }
        } catch (\Throwable $e) {
            $formattedDue = null;
        }

        try {
            DB::transaction(function () use ($noFaktur, $ppn, $noFakturPajak, $materials, $totalPpn, $harga, $grandTotal, $formattedDate, $formattedDue) {
                $updateHeader = [
                    'no_fakturpajak' => $noFakturPajak,
                    'tgl_doc' => $formattedDate,
                    'jth_tempo' => $formattedDue,
                    'h_ppn' => $totalPpn,
                    'harga' => $harga,
                    'g_total' => $grandTotal,
                ];
                if (Schema::hasColumn('tb_kdfakturpenjualan', 'no_ppn')) {
                    $updateHeader['no_ppn'] = $ppn;
                }
                if (Schema::hasColumn('tb_kdfakturpenjualan', 'ppn')) {
                    $updateHeader['ppn'] = $ppn;
                }

                DB::table('tb_kdfakturpenjualan')
                    ->where('no_fakturpenjualan', $noFaktur)
                    ->update($updateHeader);

                if (Schema::hasColumn('tb_fakturpenjualan', 'no_fakturpajak')) {
                    DB::table('tb_fakturpenjualan')
                        ->where('no_fakturpenjualan', $noFaktur)
                        ->update(['no_fakturpajak' => $noFakturPajak]);
                }
                if (Schema::hasColumn('tb_fakturpenjualan', 'no_ppn')) {
                    DB::table('tb_fakturpenjualan')
                        ->where('no_fakturpenjualan', $noFaktur)
                        ->update(['no_ppn' => $ppn]);
                }
                if (Schema::hasColumn('tb_fakturpenjualan', 'tgl_doc')) {
                    DB::table('tb_fakturpenjualan')
                        ->where('no_fakturpenjualan', $noFaktur)
                        ->update([
                            'tgl_doc' => $formattedDate,
                            'jth_tempo' => $formattedDue,
                        ]);
                }

                $keep = collect($materials)->map(function ($row) {
                    return [
                        'no_do' => $row['no_ref'] ?? '',
                        'kd_mat' => $row['kd_material'] ?? '',
                    ];
                })->filter(function ($row) {
                    return $row['no_do'] !== '' && $row['kd_mat'] !== '';
                })->values();

                if ($keep->isNotEmpty()) {
                    DB::table('tb_fakturpenjualan')
                        ->where('no_fakturpenjualan', $noFaktur)
                        ->whereNotIn(DB::raw("concat(no_do, ':', kd_mat)"), $keep->map(function ($row) {
                            return $row['no_do'].':'.$row['kd_mat'];
                        }))
                        ->delete();
                }

                $hppDo = 0;
                $hppDot = 0;

                foreach ($materials as $index => $row) {
                    $noRef = $row['no_ref'] ?? '';
                    $kdMat = $row['kd_material'] ?? '';
                    $material = $row['material'] ?? '';
                    $qty = $row['qty'] ?? 0;
                    $unit = $row['unit'] ?? '';
                    $price = $row['price'] ?? 0;
                    $total = $row['total'] ?? 0;
                    $hpp = $row['hpp'] ?? 0;
                    $totalHpp = (float) $qty * (float) $hpp;

                    if (str_contains((string) $noRef, 'DOT-')) {
                        $hppDot += $totalHpp;
                    } else {
                        $hppDo += $totalHpp;
                    }

                    $existing = DB::table('tb_fakturpenjualan')
                        ->where('no_fakturpenjualan', $noFaktur)
                        ->where('no_do', $noRef)
                        ->where('kd_mat', $kdMat)
                        ->exists();

                    $payload = [
                        'qty' => $qty,
                        'unit' => $unit,
                        'price' => $price,
                        'ttl_price' => $total,
                        'material' => $material,
                    ];

                    if ($existing) {
                        DB::table('tb_fakturpenjualan')
                            ->where('no_fakturpenjualan', $noFaktur)
                            ->where('no_do', $noRef)
                            ->where('kd_mat', $kdMat)
                            ->update($payload);
                    } else {
                        DB::table('tb_fakturpenjualan')->insert(array_merge($payload, [
                            'no_fakturpenjualan' => $noFaktur,
                            'no' => $index + 1,
                            'no_do' => $noRef,
                            'kd_mat' => $kdMat,
                        ]));
                    }
                }

                DB::table('tb_kdfakturpenjualan')
                    ->where('no_fakturpenjualan', $noFaktur)
                    ->update([
                        'HPP' => $hppDo,
                        'HPPDOT' => $hppDot,
                    ]);
            });
        } catch (\Throwable $e) {
            return redirect()
                ->back()
                ->with('error', 'Gagal menyimpan perubahan: '.$e->getMessage());
        }

        return redirect()
            ->back()
            ->with('success', 'Invoice berhasil diperbarui.');
    }

    public function destroy(string $noFaktur)
    {
        $target = strtolower(trim($noFaktur));

        try {
            DB::transaction(function () use ($target) {
                DB::table('tb_do')
                    ->whereRaw('lower(trim(inv)) = ?', [$target])
                    ->update([
                        'inv' => ' ',
                        'val_inv' => 0,
                    ]);

                DB::table('tb_fakturpenjualan')
                    ->whereRaw('lower(trim(no_fakturpenjualan)) = ?', [$target])
                    ->delete();

                DB::table('tb_kdfakturpenjualan')
                    ->whereRaw('lower(trim(no_fakturpenjualan)) = ?', [$target])
                    ->delete();

                DB::table('tb_kwitansi')
                    ->whereRaw('lower(trim(ref_faktur)) = ?', [$target])
                    ->delete();
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal menghapus invoice: '.$e->getMessage());
        }

        return back()->with('success', 'Invoice berhasil dihapus.');
    }

    public function outstandingDo()
    {
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'ref_po', 'kd_cs', 'nm_cs')
            ->whereRaw("ltrim(rtrim(coalesce(inv, ''))) = ''")
            ->groupBy('no_do', 'ref_po', 'kd_cs', 'nm_cs')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function doMaterials(Request $request)
    {
        $noDo = $request->query('no_do');
        $refPoIn = $request->query('ref_po_in');

        if (!$refPoIn) {
            return response()->json([
                'items' => [],
            ]);
        }

        $items = DB::table('tb_do as do')
            ->leftJoin('tb_material as m', 'm.material', '=', 'do.mat')
            ->leftJoin('tb_detailpr as pr', function ($join) {
                $join->on('pr.ref_po', '=', 'do.ref_po')
                    ->on('pr.material', '=', 'do.mat');
            })
            ->select(
                'do.no_do',
                'do.mat',
                'do.qty',
                'do.unit',
                'do.harga',
                'do.total',
                'do.ref_po',
                'm.harga as harga_material',
                'pr.price_po as price_po',
                'm.kd_material as kd_material',
            )
            ->where('do.ref_po', $refPoIn)
            ->orderBy('do.no_do')
            ->orderBy('do.mat')
            ->get();

        $hppMap = collect();
        if ($refPoIn) {
            $hppMap = DB::table('tb_detailpo')
                ->select(
                    'material',
                    DB::raw('coalesce(max(cast(price as decimal(18,4))), 0) as hpp'),
                )
                ->where('ref_poin', $refPoIn)
                ->groupBy('material')
                ->get()
                ->keyBy('material');
        }

        $items = $items->map(function ($item) use ($hppMap) {
            $priceFromMaterial = is_numeric($item->harga_material ?? null)
                ? (float) $item->harga_material
                : null;
            $priceFromDo = is_numeric($item->harga ?? null)
                ? (float) $item->harga
                : null;
            $priceFromPr = is_numeric($item->price_po ?? null)
                ? (float) $item->price_po
                : null;

            // price untuk form: ambil price_po (tb_detailpr) jika ada, fallback harga material, lalu harga DO
            $price = $priceFromPr ?? $priceFromMaterial ?? $priceFromDo ?? 0;

            // HPP diisi dari harga DO (jika ada), else dari harga material; dibulatkan
            $hpp = $priceFromDo ?? $priceFromMaterial ?? 0;
            $hpp = round($hpp, 0);

            $qty = is_numeric($item->qty ?? null) ? (float) $item->qty : 0;
            $total = $price * $qty;
            $totalHpp = $hpp * $qty;

            // Jika ada mapping HPP dari detail PO, gunakan itu sebagai fallback (tidak override utama)
            if ($hppMap->has($item->mat)) {
                $hppRow = $hppMap->get($item->mat);
                $hpp = $hpp ?: (float) ($hppRow->hpp ?? 0);
                $totalHpp = $totalHpp ?: ((float) ($hppRow->hpp ?? 0) * $qty);
            }

            return [
                'no_do' => $item->no_do,
                'mat' => $item->mat,
                'kd_material' => $item->kd_material,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'harga' => $price,
                'total' => $total,
                'hpp' => $hpp,
                'total_hpp' => $totalHpp,
            ];
        });

        return response()->json([
            'items' => $items,
        ]);
    }

    public function doAddMaterials(Request $request)
    {
        $noDo = $request->query('no_do');
        $refPoIn = $request->query('ref_po_in');

        if (!$noDo) {
            return response()->json([
                'items' => [],
            ]);
        }

        $items = DB::table('tb_dob as dob')
            ->leftJoin('tb_material as m', 'm.material', '=', 'dob.mat')
            ->select(
                'dob.no_dob',
                'dob.mat',
                'dob.qty',
                'dob.unit',
                'dob.harga',
                'dob.total',
                'm.harga as harga_material',
                'm.kd_material as kd_material',
            )
            ->where('dob.ref_do', $noDo)
            ->orderBy('dob.no_dob')
            ->orderBy('dob.mat')
            ->get();

        $hppMap = collect();
        if ($refPoIn) {
            $hppMap = DB::table('tb_detailpo')
                ->select(
                    'material',
                    DB::raw('coalesce(max(cast(price as decimal(18,4))), 0) as hpp'),
                )
                ->where('ref_poin', $refPoIn)
                ->groupBy('material')
                ->get()
                ->keyBy('material');
        }

        $items = $items->map(function ($item) use ($hppMap) {
            $priceFromMaterial = is_numeric($item->harga_material ?? null)
                ? (float) $item->harga_material
                : null;
            $priceFromDo = is_numeric($item->harga ?? null)
                ? (float) $item->harga
                : null;

            $price = $priceFromMaterial ?? $priceFromDo ?? 0;

            $hpp = $priceFromDo ?? $priceFromMaterial ?? 0;
            $hpp = round($hpp, 0);

            $qty = is_numeric($item->qty ?? null) ? (float) $item->qty : 0;
            $total = $price * $qty;
            $totalHpp = $hpp * $qty;

            if ($hppMap->has($item->mat)) {
                $hppRow = $hppMap->get($item->mat);
                $hpp = $hpp ?: (float) ($hppRow->hpp ?? 0);
                $totalHpp = $totalHpp ?: ((float) ($hppRow->hpp ?? 0) * $qty);
            }

            return [
                'no_dob' => $item->no_dob,
                'mat' => $item->mat,
                'kd_material' => $item->kd_material,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'harga' => $price,
                'total' => $total,
                'hpp' => $hpp,
                'total_hpp' => $totalHpp,
            ];
        });

        return response()->json([
            'items' => $items,
        ]);
    }
}
