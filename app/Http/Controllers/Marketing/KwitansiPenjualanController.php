<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class KwitansiPenjualanController
{
    public function index()
    {
        return Inertia::render('Penjualan/kwitansi/index');
    }

    public function listKwitansi()
    {
        $kwitansi = DB::table('tb_kwitansi')
            ->select('no_kwitansi', 'ref_faktur', 'tgl', 'cs', 'ttl_faktur')
            ->orderBy('no_kwitansi', 'desc')
            ->get();

        return response()->json([
            'data' => $kwitansi,
        ]);
    }

    public function listNoReceiptInvoices()
    {
        $noReceiptInvoices = DB::table('tb_kdfakturpenjualan')
            ->select(
                'no_fakturpenjualan',
                'tgl_doc',
                'nm_cs',
                'ref_po',
                'g_total',
                'no_kwitansi',
            )
            ->where(function ($query) {
                $query->whereNull('no_kwitansi')
                    ->orWhereRaw("ltrim(rtrim(coalesce(no_kwitansi, ''))) = ''")
                    ->orWhereRaw("upper(ltrim(rtrim(coalesce(no_kwitansi, '')))) = 'NULL'");
            })
            ->orderBy('no_fakturpenjualan', 'desc')
            ->get();

        return response()->json([
            'data' => $noReceiptInvoices,
        ]);
    }

    public function print(Request $request, string $noKwitansi)
    {
        $kwitansi = DB::table('tb_kwitansi')
            ->where('no_kwitansi', $noKwitansi)
            ->first();

        if (!$kwitansi) {
            return redirect()
                ->route('penjualan.faktur-penjualan.kwitansi.index')
                ->with('error', 'Data kwitansi tidak ditemukan.');
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? $database : null;
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        if (
            !$companyConfig &&
            is_string($lookupKey) &&
            Str::startsWith(Str::lower($lookupKey), 'db')
        ) {
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

        $cityLabel = 'Samarinda';
        if (is_string($database) && strtolower($database) === 'dbstg') {
            $cityLabel = 'Banjarmasin';
        }

        return Inertia::render('Penjualan/kwitansi/print', [
            'kwitansi' => $kwitansi,
            'company' => $company,
            'cityLabel' => $cityLabel,
        ]);
    }
}
