<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class VendorController
{
    public function index()
    {
        $vendors = DB::table('tb_vendor')
            ->select('kd_vdr', 'nm_vdr', 'almt_vdr')
            ->orderBy('kd_vdr')
            ->get();

        return Inertia::render('master-data/vendor/index', [
            'vendors' => $vendors,
            'vendorCount' => $vendors->count(),
        ]);
    }

    public function show(string $kdVendor)
    {
        $vendor = DB::table('tb_vendor')
            ->where('kd_vdr', $kdVendor)
            ->first();

        if (!$vendor) {
            return response()->json(['message' => 'Vendor tidak ditemukan.'], 404);
        }

        $purchaseOrders = DB::table('tb_po')
            ->select('no_po', 's_total', 'h_ppn', 'g_total')
            ->where('nm_vdr', $vendor->nm_vdr)
            ->orderBy('no_po', 'desc')
            ->get();

        return response()->json([
            'vendor' => $vendor,
            'purchaseOrders' => $purchaseOrders,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nm_vdr' => ['required', 'string', 'max:255'],
            'almt_vdr' => ['nullable', 'string', 'max:255'],
            'telp_vdr' => ['nullable', 'string', 'max:100'],
            'fax_vdr' => ['nullable', 'string', 'max:100'],
            'eml_vdr' => ['nullable', 'string', 'max:255'],
            'attn_vdr' => ['nullable', 'string', 'max:255'],
            'npwp_vdr' => ['nullable', 'string', 'max:255'],
            'npwp1_vdr' => ['nullable', 'string', 'max:255'],
            'npwp2_vdr' => ['nullable', 'string', 'max:255'],
            'rek1_vdr' => ['nullable', 'string', 'max:255'],
            'bank1_vdr' => ['nullable', 'string', 'max:255'],
            'an1_vdr' => ['nullable', 'string', 'max:255'],
            'rek2_vdr' => ['nullable', 'string', 'max:255'],
            'bank2_vdr' => ['nullable', 'string', 'max:255'],
            'an2_vdr' => ['nullable', 'string', 'max:255'],
        ]);

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $allowed = config('tenants.databases', []);
        $rawPrefix = $database && in_array($database, $allowed, true)
            ? $database
            : 'SJA';
        $prefix = strtoupper($rawPrefix);
        $lastCode = DB::table('tb_vendor')
            ->where('kd_vdr', 'like', 'VDR'.$prefix.'%')
            ->orderBy('kd_vdr', 'desc')
            ->value('kd_vdr');
        $lastNumber = 0;
        if ($lastCode) {
            $lastNumber = (int) substr((string) $lastCode, -4);
        }
        $nextNumber = str_pad((string) ($lastNumber + 1), 4, '0', STR_PAD_LEFT);
        $validated['kd_vdr'] = 'VDR'.$prefix.$nextNumber;

        try {
            DB::table('tb_vendor')->insert($validated);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menyimpan data vendor.');
        }

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil disimpan.');
    }

    public function update(Request $request, string $kdVendor)
    {
        $validated = $request->validate([
            'nm_vdr' => ['required', 'string', 'max:255'],
            'almt_vdr' => ['nullable', 'string', 'max:255'],
            'telp_vdr' => ['nullable', 'string', 'max:100'],
            'fax_vdr' => ['nullable', 'string', 'max:100'],
            'eml_vdr' => ['nullable', 'string', 'max:255'],
            'attn_vdr' => ['nullable', 'string', 'max:255'],
            'npwp_vdr' => ['nullable', 'string', 'max:255'],
            'npwp1_vdr' => ['nullable', 'string', 'max:255'],
            'npwp2_vdr' => ['nullable', 'string', 'max:255'],
            'rek1_vdr' => ['nullable', 'string', 'max:255'],
            'bank1_vdr' => ['nullable', 'string', 'max:255'],
            'an1_vdr' => ['nullable', 'string', 'max:255'],
            'rek2_vdr' => ['nullable', 'string', 'max:255'],
            'bank2_vdr' => ['nullable', 'string', 'max:255'],
            'an2_vdr' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            DB::table('tb_vendor')
                ->where('kd_vdr', $kdVendor)
                ->update($validated);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal memperbarui data vendor.');
        }

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil diperbarui.');
    }

    public function destroy(string $kdVendor)
    {
        try {
            DB::table('tb_vendor')
                ->where('kd_vdr', $kdVendor)
                ->delete();
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menghapus data vendor.');
        }

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil dihapus.');
    }
}
