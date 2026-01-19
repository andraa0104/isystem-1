<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class CustomerController
{
    public function index()
    {
        $customers = DB::table('tb_cs')
            ->select('kd_cs', 'nm_cs', 'alamat_cs')
            ->orderBy('kd_cs')
            ->get();

        return Inertia::render('master-data/customer/index', [
            'customers' => $customers,
            'customerCount' => $customers->count(),
        ]);
    }

    public function show(string $kdCustomer)
    {
        $customer = DB::table('tb_cs')
            ->where('kd_cs', $kdCustomer)
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Customer tidak ditemukan.'], 404);
        }

        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po')
            ->where('kd_cs', $kdCustomer)
            ->groupBy('no_do', 'date', 'ref_po')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'customer' => $customer,
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nm_cs' => ['required', 'string', 'max:255'],
            'alamat_cs' => ['nullable', 'string', 'max:255'],
            'kota_cs' => ['nullable', 'string', 'max:255'],
            'telp_cs' => ['nullable', 'string', 'max:100'],
            'fax_cs' => ['nullable', 'string', 'max:100'],
            'npwp_cs' => ['nullable', 'string', 'max:255'],
            'npwp1_cs' => ['nullable', 'string', 'max:255'],
            'npwp2_cs' => ['nullable', 'string', 'max:255'],
            'Attnd' => ['nullable', 'string', 'max:255'],
        ]);

        $lastCode = DB::table('tb_cs')
            ->where('kd_cs', 'like', 'CST%')
            ->orderBy('kd_cs', 'desc')
            ->value('kd_cs');
        $lastNumber = $lastCode ? (int) substr((string) $lastCode, 3) : 0;
        $nextCode = 'CST'.str_pad((string) ($lastNumber + 1), 7, '0', STR_PAD_LEFT);
        $validated['kd_cs'] = $nextCode;

        try {
            DB::table('tb_cs')->insert($validated);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menyimpan data customer.');
        }

        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil disimpan.');
    }

    public function update(Request $request, string $kdCustomer)
    {
        $validated = $request->validate([
            'nm_cs' => ['required', 'string', 'max:255'],
            'alamat_cs' => ['nullable', 'string', 'max:255'],
            'kota_cs' => ['nullable', 'string', 'max:255'],
            'telp_cs' => ['nullable', 'string', 'max:100'],
            'fax_cs' => ['nullable', 'string', 'max:100'],
            'npwp_cs' => ['nullable', 'string', 'max:255'],
            'npwp1_cs' => ['nullable', 'string', 'max:255'],
            'npwp2_cs' => ['nullable', 'string', 'max:255'],
            'Attnd' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            DB::table('tb_cs')
                ->where('kd_cs', $kdCustomer)
                ->update($validated);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal memperbarui data customer.');
        }

        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil diperbarui.');
    }

    public function destroy(string $kdCustomer)
    {
        try {
            DB::table('tb_cs')
                ->where('kd_cs', $kdCustomer)
                ->delete();
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menghapus data customer.');
        }

        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil dihapus.');
    }
}
