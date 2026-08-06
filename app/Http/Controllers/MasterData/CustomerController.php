<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class CustomerController
{
    private const CUSTOMER_CACHE_TAGS = ['customer_data'];
    private const CUSTOMER_CACHE_TTL = 86400;

    private function tenantCachePrefix(?Request $request = null): string
    {
        $request ??= request();
        $database = (string) (
            $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database')
            ?? config('database.connections.'.config('database.default').'.database')
            ?? ''
        );

        return preg_replace('/[^A-Za-z0-9_.:-]/', '_', strtolower($database)) ?: 'default';
    }

    private function customerCacheKey(string $scope, array $parts = [], ?Request $request = null): string
    {
        return 'customer:' . $this->tenantCachePrefix($request) . ':' . $scope . ':' . md5(json_encode($parts));
    }

    private function flushCustomerCache(): void
    {
        Cache::tags(self::CUSTOMER_CACHE_TAGS)->flush();
    }

    public function index()
    {
        // Inertia::lazy() memastikan data hanya dimuat saat di-request parsial oleh frontend.
        // Hal ini mempercepat pemuatan halaman (UI render instan).
        return Inertia::render('master-data/customer/index', [
            'customers' => Inertia::lazy(function () {
                return Cache::tags(self::CUSTOMER_CACHE_TAGS)->remember($this->customerCacheKey('index.customers'), self::CUSTOMER_CACHE_TTL, function () {
                    return DB::table('tb_cs')
                        ->select('kd_cs', 'nm_cs', 'alamat_cs')
                        ->orderBy('kd_cs')
                        ->get();
                });
            }),
            'customerCount' => Inertia::lazy(function () {
                return Cache::tags(self::CUSTOMER_CACHE_TAGS)->remember($this->customerCacheKey('index.count'), self::CUSTOMER_CACHE_TTL, function () {
                    return DB::table('tb_cs')->count();
                });
            }),
        ]);
    }

    public function show(string $kdCustomer)
    {
        $customer = Cache::tags(self::CUSTOMER_CACHE_TAGS)->remember($this->customerCacheKey('show.customer', [$kdCustomer]), self::CUSTOMER_CACHE_TTL, function () use ($kdCustomer) {
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
            return $customer;
        });

        if (!$customer) {
            return response()->json(['message' => 'Customer tidak ditemukan.'], 404);
        }

        $deliveryOrders = Cache::tags(self::CUSTOMER_CACHE_TAGS)->remember($this->customerCacheKey('show.delivery-orders', [$kdCustomer]), self::CUSTOMER_CACHE_TTL, function () use ($kdCustomer) {
            return DB::table('tb_do')
                ->select('no_do', 'date', 'ref_po')
                ->where('kd_cs', $kdCustomer)
                ->groupBy('no_do', 'date', 'ref_po')
                ->orderBy('no_do', 'desc')
                ->get();
        });

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
            DB::transaction(function () use ($validated, $nextCode) {
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
                
                if (is_array($validated['Attnd'] ?? [])) {
                    $picData = [];
                    foreach (array_filter($validated['Attnd']) as $pic) {
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

        $this->flushCustomerCache();

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
            DB::transaction(function () use ($validated, $kdCustomer) {
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
                
                DB::table('tb_cs')
                    ->where('kd_cs', $kdCustomer)
                    ->update($validatedCs);

                DB::table('tb_cspic')->where('kd_cs', $kdCustomer)->delete();

                if (is_array($validated['Attnd'] ?? [])) {
                    $picData = [];
                    foreach (array_filter($validated['Attnd']) as $pic) {
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

        $this->flushCustomerCache();

        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil diperbarui.');
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

        $this->flushCustomerCache();

        return redirect()
            ->route('master-data.customer.index')
            ->with('success', 'Data customer berhasil dihapus.');
    }
}
