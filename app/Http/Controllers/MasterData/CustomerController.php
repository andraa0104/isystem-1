<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class CustomerController
{


    public function index()
    {
        // Inertia::lazy() memastikan data hanya dimuat saat di-request parsial oleh frontend.
        // Hal ini mempercepat pemuatan halaman (UI render instan).
        return Inertia::render('master-data/customer/index', [
            'customers' => Inertia::lazy(function () {
                return DB::table('tb_cs')
                    ->select('kd_cs', 'nm_cs', 'alamat_cs')
                    ->orderBy('kd_cs')
                    ->get();
            }),
            'customerCount' => Inertia::lazy(function () {
                return DB::table('tb_cs')->count();
            }),
        ]);
    }

    public function show(string $kdCustomer)
    {
        $customer = DB::table('tb_cs')
            ->where('kd_cs', $kdCustomer)
            ->first();
        
        if ($customer) {
            // Attach multiple PICs
            $pics = DB::table('tb_cspic')
                ->where('kd_cs', $kdCustomer)
                ->pluck('pic_name')
                ->toArray();
            
            if (!empty($pics)) {
                $customer->Attnd = $pics;
            } else {
                if ($customer->Attnd) {
                    $customer->Attnd = array_values(array_filter(array_map('trim', explode(',', $customer->Attnd))));
                    if (empty($customer->Attnd)) {
                        $customer->Attnd = [''];
                    }
                } else {
                    $customer->Attnd = [''];
                }
            }
        }

        if (!$customer) {
            return response()->json(['message' => 'Customer tidak ditemukan.'], 404);
        }

        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po')
            ->where('kd_cs', $kdCustomer)
            ->groupBy('no_do', 'date', 'ref_po')
            ->orderBy('no_do', 'desc')
            ->get();

        if (is_array($customer->Attnd) && count($customer->Attnd) === 1 && str_contains($customer->Attnd[0] ?? '', ',')) {
            $customer->Attnd = array_values(array_filter(array_map('trim', explode(',', $customer->Attnd[0]))));
        }

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
            'Attnd' => ['nullable', 'array'],
            'Attnd.*' => ['nullable', 'string', 'max:255'],
        ]);

        $lastCode = DB::table('tb_cs')
            ->where('kd_cs', 'like', 'CST%')
            ->orderBy('kd_cs', 'desc')
            ->value('kd_cs');
        $lastNumber = $lastCode ? (int) substr((string) $lastCode, 3) : 0;
        $nextCode = 'CST'.str_pad((string) ($lastNumber + 1), 7, '0', STR_PAD_LEFT);
        $validated['kd_cs'] = $nextCode;

        try {
            DB::transaction(function () use ($validated, $nextCode, $request) {
                $attndArray = $validated['Attnd'] ?? [];
                $attndString = '';
                if (is_array($attndArray)) {
                    $attndArray = array_filter($attndArray);
                    $attndString = !empty($attndArray) ? implode(', ', $attndArray) : '';
                } else {
                    $attndString = $attndArray;
                }
                
                $validatedCs = $validated;
                $validatedCs['Attnd'] = $attndString;
                
                DB::table('tb_cs')->insert($validatedCs);
                
                $attndInput = $request->input('Attnd', []);
                if (is_array($attndInput)) {
                    $picData = [];
                    foreach (array_filter($attndInput) as $pic) {
                        $picData[] = [
                            'kd_cs' => $nextCode,
                            'customer_name' => $validated['nm_cs'] ?? '',
                            'pic_name' => $pic,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    if (!empty($picData)) {
                        DB::table('tb_cspic')->insert($picData);
                    }
                }
            });
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menyimpan data customer: ' . $exception->getMessage());
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
            'Attnd' => ['nullable', 'array'],
            'Attnd.*' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            DB::transaction(function () use ($validated, $kdCustomer, $request) {
                $attndArray = $request->input('Attnd', []);
                $attndString = '';
                if (is_array($attndArray)) {
                    $attndArray = array_filter($attndArray);
                    $attndString = !empty($attndArray) ? implode(', ', $attndArray) : '';
                } else {
                    $attndString = $attndArray;
                }
                
                $validatedCs = $validated;
                $validatedCs['Attnd'] = $attndString;
                
                DB::table('tb_cs')
                    ->where('kd_cs', $kdCustomer)
                    ->update($validatedCs);

                DB::table('tb_cspic')->where('kd_cs', $kdCustomer)->delete();

                $attndInput = $request->input('Attnd', []);
                if (is_array($attndInput)) {
                    $picData = [];
                    foreach (array_filter($attndInput) as $pic) {
                        $picData[] = [
                            'kd_cs' => $kdCustomer,
                            'customer_name' => $validated['nm_cs'] ?? '',
                            'pic_name' => $pic,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    if (!empty($picData)) {
                        DB::table('tb_cspic')->insert($picData);
                    }
                }
            });
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal memperbarui data customer: ' . $exception->getMessage());
        }


        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil diperbarui.');
    }

    public function export(Request $request)
    {
        // Ambil semua customer dari tb_cs
        $customers = DB::table('tb_cs')
            ->select(
                'kd_cs', 'nm_cs', 'alamat_cs', 'kota_cs',
                'telp_cs', 'fax_cs', 'npwp_cs', 'npwp1_cs', 'npwp2_cs'
            )
            ->orderBy('kd_cs')
            ->get();

        // Ambil semua PIC dari tb_cspic, group by kd_cs
        $picsRaw = DB::table('tb_cspic')
            ->select('kd_cs', 'pic_name')
            ->whereNotNull('pic_name')
            ->where('pic_name', '<>', '')
            ->orderBy('kd_cs')
            ->orderBy('pic_name')
            ->get()
            ->groupBy('kd_cs');

        // Merge: tiap customer dapat array pic_names dari tb_cspic
        $data = $customers->map(function ($cs) use ($picsRaw) {
            $pics = $picsRaw->get($cs->kd_cs, collect())->pluck('pic_name')->toArray();
            return [
                'kd_cs'     => $cs->kd_cs,
                'nm_cs'     => $cs->nm_cs,
                'alamat_cs' => $cs->alamat_cs,
                'kota_cs'   => $cs->kota_cs,
                'telp_cs'   => $cs->telp_cs,
                'fax_cs'    => $cs->fax_cs,
                'npwp_cs'   => $cs->npwp_cs,
                'npwp1_cs'  => $cs->npwp1_cs,
                'npwp2_cs'  => $cs->npwp2_cs,
                'pics'      => $pics,
            ];
        })->values()->toArray();

        return Inertia::render('master-data/customer/export', [
            'customers' => $data,
        ]);
    }

    public function destroy(string $kdCustomer)
    {
        try {
            DB::transaction(function () use ($kdCustomer) {
                DB::table('tb_cspic')->where('kd_cs', $kdCustomer)->delete();
                DB::table('tb_cs')->where('kd_cs', $kdCustomer)->delete();
            });
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menghapus data customer: ' . $exception->getMessage());
        }


        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil dihapus.');
    }
}
