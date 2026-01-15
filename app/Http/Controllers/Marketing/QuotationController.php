<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class QuotationController
{
    public function index(Request $request)
    {
        $penawaran = DB::table('tb_penawaran')
            ->select(
                'No_penawaran',
                'Tgl_penawaran',
                'Tgl_Posting',
                'Customer',
                'Alamat',
                'Telp',
                'Fax',
                'Email',
                'Attend',
                'Payment',
                'Validity',
                'Delivery',
                'Franco',
                'Note1',
                'Note2',
                'Note3'
            )
            ->orderBy('Tgl_Posting', 'desc')
            ->orderBy('No_penawaran', 'desc')
            ->get();

        $detailNo = $request->query('detail_no');
        $penawaranDetail = collect();
        if ($detailNo) {
            $penawaranDetail = DB::table('tb_penawarandetail')
                ->select(
                    'ID',
                    'No_penawaran',
                    'Material',
                    'Harga',
                    'Qty',
                    'Satuan',
                    'Harga_modal',
                    'Margin',
                    'Remark'
                )
                ->where('No_penawaran', $detailNo)
                ->orderBy('ID')
                ->get();
        }

        return Inertia::render('marketing/quotation/index', [
            'penawaran' => $penawaran,
            'penawaranDetail' => $penawaranDetail,
            'detailNo' => $detailNo,
        ]);
    }

    public function create()
    {
        $customers = DB::table('tb_cs')
            ->select(
                'kd_cs as kd_cs',
                'nm_cs as nm_cs',
                'Attnd as attnd',
                'alamat_cs as alamat_cs',
                'telp_cs as telp_cs',
                'fax_cs as fax_cs'
            )
            ->orderBy('nm_cs')
            ->get();

        $materials = DB::table('tb_material')
            ->select(
                'Material as material',
                'Unit as unit',
                'Stok as stok',
                'Remark as remark'
            )
            ->orderBy('Material')
            ->get();

        return Inertia::render('marketing/quotation/create', [
            'customers' => $customers,
            'materials' => $materials,
        ]);
    }


    public function edit($noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran',
                'Tgl_penawaran',
                'Tgl_Posting',
                'Customer',
                'Alamat',
                'Telp',
                'Fax',
                'Email',
                'Attend',
                'Payment',
                'Validity',
                'Delivery',
                'Franco',
                'Note1',
                'Note2',
                'Note3'
            )
            ->where('No_penawaran', $noPenawaran)
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $quotationDetails = DB::table('tb_penawarandetail')
            ->select(
                'ID',
                'No_penawaran',
                'Material',
                'Harga',
                'Qty',
                'Satuan',
                'Harga_modal',
                'Margin',
                'Remark'
            )
            ->where('No_penawaran', $noPenawaran)
            ->orderBy('No_penawaran')
            ->get();

        $customers = DB::table('tb_cs')
            ->select(
                'kd_cs as kd_cs',
                'nm_cs as nm_cs',
                'Attnd as attnd',
                'alamat_cs as alamat_cs',
                'telp_cs as telp_cs',
                'fax_cs as fax_cs'
            )
            ->orderBy('nm_cs')
            ->get();

        $materials = DB::table('tb_material')
            ->select(
                'Material as material',
                'Unit as unit',
                'Stok as stok',
                'Remark as remark'
            )
            ->orderBy('Material')
            ->get();

        return Inertia::render('marketing/quotation/edit', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'customers' => $customers,
            'materials' => $materials,
        ]);
    }

    public function print(Request $request, $noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran',
                'Tgl_penawaran',
                'Customer',
                'Alamat',
                'Telp',
                'Email',
                'Attend',
                'Payment',
                'Validity',
                'Delivery',
                'Franco'
            )
            ->where('No_penawaran', $noPenawaran)
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $quotationDetails = DB::table('tb_penawarandetail')
            ->select(
                'ID',
                'No_penawaran',
                'Material',
                'Harga',
                'Qty',
                'Satuan',
                'Remark'
            )
            ->where('No_penawaran', $noPenawaran)
            ->orderBy('ID')
            ->get();

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $companyConfig = $database
            ? config("tenants.companies.$database", [])
            : [];
        $fallbackName = $database
            ? config("tenants.labels.$database", $database)
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('marketing/quotation/print', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'company' => $company,
        ]);
    }

    public function update(Request $request, $noPenawaran)
    {
        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $exists = DB::table('tb_penawaran')
            ->where('No_penawaran', $noPenawaran)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPenawaran) {
                DB::table('tb_penawaran')
                    ->where('No_penawaran', $noPenawaran)
                    ->update([
                        'Tgl_penawaran' => $request->input('tgl_penawaran')
                            ?? Carbon::today()->toDateString(),
                        'Customer' => $request->input('customer'),
                        'Alamat' => $request->input('alamat'),
                        'Telp' => $request->input('telp'),
                        'Fax' => $request->input('fax'),
                        'Email' => $request->input('email'),
                        'Attend' => $request->input('attend'),
                        'Payment' => $request->input('payment'),
                        'Validity' => $request->input('validity'),
                        'Delivery' => $request->input('delivery'),
                        'Franco' => $request->input('franco'),
                        'Note1' => $request->input('note1'),
                        'Note2' => $request->input('note2'),
                        'Note3' => $request->input('note3'),
                    ]);

                DB::table('tb_penawarandetail')
                    ->where('No_penawaran', $noPenawaran)
                    ->delete();

                foreach ($materials as $item) {
                    DB::table('tb_penawarandetail')->insert([
                        'No_penawaran' => $noPenawaran,
                        'Material' => $item['material'] ?? null,
                        'Qty' => $item['quantity'] ?? null,
                        'Harga' => $item['harga_modal'] ?? null,
                        'Harga_modal' => $item['harga_penawaran'] ?? null,
                        'Satuan' => $item['satuan'] ?? null,
                        'Margin' => $item['margin'] ?? null,
                        'Remark' => $item['remark'] ?? null,
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil diperbarui.');
    }


    public function updateDetail(Request $request, $noPenawaran, $detailId)
    {
        $exists = DB::table('tb_penawarandetail')
            ->where('No_penawaran', $noPenawaran)
            ->where('ID', $detailId)
            ->exists();

        if (!$exists) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        DB::table('tb_penawarandetail')
            ->where('No_penawaran', $noPenawaran)
            ->where('ID', $detailId)
            ->update([
                'Material' => $request->input('material'),
                'Qty' => $request->input('quantity'),
                'Harga' => $request->input('harga_modal'),
                'Harga_modal' => $request->input('harga_penawaran'),
                'Satuan' => $request->input('satuan'),
                'Margin' => $request->input('margin'),
                'Remark' => $request->input('remark'),
            ]);

        return back()->with('success', 'Detail quotation berhasil diperbarui.');
    }

    public function destroyDetail($noPenawaran, $detailId)
    {
        $deleted = DB::table('tb_penawarandetail')
            ->where('No_penawaran', $noPenawaran)
            ->where('ID', $detailId)
            ->delete();

        if (!$deleted) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        return back()->with('success', 'Detail quotation berhasil dihapus.');
    }

    public function store(Request $request)
    {
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

        $lastNumber = DB::table('tb_penawaran')
            ->where('No_penawaran', 'like', $prefix.'%')
            ->orderBy('No_penawaran', 'desc')
            ->value('No_penawaran');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noPenawaran = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPenawaran) {
                DB::table('tb_penawaran')->insert([
                    'No_penawaran' => $noPenawaran,
                    'Tgl_penawaran' => $request->input('tgl_penawaran')
                        ?? Carbon::today()->toDateString(),
                    'Tgl_Posting' => Carbon::today()->toDateString(),
                    'Customer' => $request->input('customer'),
                    'Alamat' => $request->input('alamat'),
                    'Telp' => $request->input('telp'),
                    'Fax' => $request->input('fax'),
                    'Email' => $request->input('email'),
                    'Attend' => $request->input('attend'),
                    'Payment' => $request->input('payment'),
                    'Validity' => $request->input('validity'),
                    'Delivery' => $request->input('delivery'),
                    'Franco' => $request->input('franco'),
                    'Note1' => $request->input('note1'),
                    'Note2' => $request->input('note2'),
                    'Note3' => $request->input('note3'),
                ]);

                foreach ($materials as $item) {
                    DB::table('tb_penawarandetail')->insert([
                        'No_penawaran' => $noPenawaran,
                        'Material' => $item['material'] ?? null,
                        'Qty' => $item['quantity'] ?? null,
                        'Harga' => $item['harga_modal'] ?? null,
                        'Harga_modal' => $item['harga_penawaran'] ?? null,
                        'Satuan' => $item['satuan'] ?? null,
                        'Margin' => $item['margin'] ?? null,
                        'Remark' => $item['remark'] ?? null,
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil disimpan.');
    }
}
