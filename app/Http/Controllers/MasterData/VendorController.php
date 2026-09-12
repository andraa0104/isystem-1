<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Throwable;

class VendorController
{
    private const VENDOR_CACHE_TAGS = ['vendor_data'];
    private const VENDOR_CACHE_TTL = 86400;

    private ?bool $isClickhouse = null;
    private ?\Illuminate\Database\ConnectionInterface $readConnection = null;

    /**
     * Dapatkan koneksi untuk read data:
     * - VPS Production: Membaca dari ClickHouse (tersinkronisasi dengan MySQL).
     * - Komputer Lokal: Otomatis fallback ke MySQL jika ClickHouse tidak ada / tidak berjalan.
     */
    private function getReadConnection(): \Illuminate\Database\ConnectionInterface
    {
        if ($this->readConnection !== null) {
            return $this->readConnection;
        }

        $requestedDriver = strtolower((string) request()->query('driver', request()->query('source', env('VENDOR_DB_DRIVER', 'clickhouse'))));
        if ($requestedDriver === 'mysql') {
            $this->readConnection = DB::connection();
            $this->isClickhouse = false;
            return $this->readConnection;
        }

        try {
            $connection = DB::connection('clickhouse');
            if ($connection && $connection->getConfig('driver') === 'clickhouse') {
                $connection->select('SELECT 1');
                $this->readConnection = $connection;
                $this->isClickhouse = true;
                return $this->readConnection;
            }
        } catch (\Throwable $e) {
            Log::info("VendorController: ClickHouse tidak tersedia, otomatis fallback ke MySQL: " . $e->getMessage());
        }

        $this->readConnection = DB::connection();
        $this->isClickhouse = false;
        return $this->readConnection;
    }

    private function isClickhouse(): bool
    {
        if ($this->isClickhouse === null) {
            $this->getReadConnection();
        }

        return (bool) $this->isClickhouse;
    }

    /**
     * Eksekusi callback read data dengan proteksi failover:
     * Jika ClickHouse mengalami kendala query/timeout, otomatis fallback ke MySQL.
     */
    private function safeRead(callable $callback)
    {
        try {
            return $callback();
        } catch (\Throwable $e) {
            if ($this->isClickhouse()) {
                Log::warning("VendorController ClickHouse query error, fallback ke MySQL: " . $e->getMessage());
                $this->readConnection = DB::connection();
                $this->isClickhouse = false;
                return $callback();
            }
            throw $e;
        }
    }

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

    private function vendorCacheKey(string $scope, array $parts = [], ?Request $request = null): string
    {
        return 'vendor:' . $this->tenantCachePrefix($request) . ':' . $scope . ':' . md5(json_encode($parts));
    }

    private function flushVendorCache(): void
    {
        Cache::tags(self::VENDOR_CACHE_TAGS)->flush();
    }

    public function index()
    {
        // Inertia::lazy() memastikan query ini HANYA berjalan jika secara spesifik diminta oleh frontend.
        // Hal ini membuat loading awal halaman menjadi instan (memisahkan load UI dan Data).
        return Inertia::render('master-data/vendor/index', [
            'vendors' => Inertia::lazy(function () {
                return Cache::tags(self::VENDOR_CACHE_TAGS)->remember($this->vendorCacheKey('index.vendors'), self::VENDOR_CACHE_TTL, function () {
                    return $this->safeRead(function () {
                        // Memanfaatkan index primary key / kd_vdr untuk pengurutan cepat
                        return $this->getReadConnection()->table('tb_vendor')
                            ->select('kd_vdr', 'nm_vdr', 'almt_vdr')
                            ->orderBy('kd_vdr')
                            ->get();
                    });
                });
            }),
        ]);
    }

    public function show(string $kdVendor)
    {
        $vendor = Cache::tags(self::VENDOR_CACHE_TAGS)->remember($this->vendorCacheKey('show.vendor', [$kdVendor]), self::VENDOR_CACHE_TTL, function () use ($kdVendor) {
            return $this->safeRead(function () use ($kdVendor) {
                // Memanfaatkan index primary key kd_vdr
                return $this->getReadConnection()->table('tb_vendor')
                    ->where('kd_vdr', $kdVendor)
                    ->first();
            });
        });

        if (!$vendor) {
            return response()->json(['message' => 'Vendor tidak ditemukan.'], 404);
        }

        $purchaseOrders = Cache::tags(self::VENDOR_CACHE_TAGS)->remember($this->vendorCacheKey('show.purchase-orders', [$kdVendor, $vendor->nm_vdr]), self::VENDOR_CACHE_TTL, function () use ($vendor) {
            return $this->safeRead(function () use ($vendor) {
                // Memanfaatkan index no_po untuk sorting
                return $this->getReadConnection()->table('tb_po')
                    ->select('no_po', 's_total', 'h_ppn', 'g_total')
                    ->where('nm_vdr', $vendor->nm_vdr)
                    ->orderBy('no_po', 'desc')
                    ->get();
            });
        });

        return response()->json([
            'vendor' => $vendor,
            'purchaseOrders' => $purchaseOrders,
        ]);
    }

    public function store(Request $request)
    {
        // Operasi Write (INSERT) TETAP ke MySQL sebagai master source of truth
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

        // Generate kode baru langsung dari MySQL untuk konsistensi data realtime
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

        $this->flushVendorCache();

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil disimpan.');
    }

    public function update(Request $request, string $kdVendor)
    {
        // Operasi Write (UPDATE) TETAP ke MySQL sebagai master source of truth
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

        $this->flushVendorCache();

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil diperbarui.');
    }

    public function destroy(string $kdVendor)
    {
        // Operasi Write (DELETE) TETAP ke MySQL sebagai master source of truth
        try {
            DB::table('tb_vendor')
                ->where('kd_vdr', $kdVendor)
                ->delete();
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menghapus data vendor.');
        }

        $this->flushVendorCache();

        return redirect()
            ->route('master-data.vendor.index')
            ->with('success', 'Data vendor berhasil dihapus.');
    }
}
