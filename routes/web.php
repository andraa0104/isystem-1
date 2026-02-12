<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Marketing\QuotationController;
use App\Http\Controllers\Marketing\PurchaseRequirementController;
use App\Http\Controllers\Marketing\PurchaseOrderController;
use App\Http\Controllers\Marketing\DeliveryOrderController;
use App\Http\Controllers\Marketing\DeliveryOrderAddController;
use App\Http\Controllers\Marketing\DeliveryOrderCostController;
use App\Http\Controllers\Marketing\BiayaKirimPembelianController;
use App\Http\Controllers\Marketing\BiayaKirimPenjualanController;
use App\Http\Controllers\Inventory\DataMaterialController;
use App\Http\Controllers\Inventory\PenerimaanMaterialController;
use App\Http\Controllers\Inventory\TransferMaterialController;
use App\Http\Controllers\Marketing\InvoiceMasukController;
use App\Http\Controllers\Marketing\FakturPenjualanController;
use App\Http\Controllers\Marketing\KwitansiPenjualanController;
use App\Http\Controllers\Marketing\TandaTerimaInvoiceController;
use App\Http\Controllers\Pembayaran\PermintaanDanaOperasionalController;
use App\Http\Controllers\Pembayaran\PermintaanDanaBiayaController;
use App\Http\Controllers\Pembayaran\PaymentCostController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MasterData\MaterialController;
use App\Http\Controllers\MasterData\VendorController;
use App\Http\Controllers\MasterData\CustomerController;
use App\Http\Controllers\Laporan\BukuBesarController;
use App\Http\Controllers\Laporan\NeracaLajurController;
use App\Http\Controllers\Laporan\NeracaSaldoController;
use App\Http\Controllers\Laporan\RugiLabaController;
use App\Http\Controllers\Laporan\NeracaAkhirController;
use App\Http\Controllers\Laporan\JurnalUmumController;
use App\Http\Controllers\Laporan\JurnalPenyesuaianController;
use App\Http\Controllers\Laporan\BukuKasController;
use App\Http\Controllers\Laporan\PerubahanModalController;
use App\Http\Controllers\Laporan\SaldoAkunController;
use App\Http\Controllers\Laporan\AuditRekonsiliasiController;
use App\Http\Controllers\Keuangan\InputPembelianController;
use App\Http\Controllers\Keuangan\InputPenjualanController;
use App\Http\Controllers\Keuangan\MutasiKasController;
use App\Http\Controllers\Keuangan\JurnalPenyesuaianController as KeuanganJurnalPenyesuaianController;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use App\Models\Pengguna;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

if (!function_exists('onlineUsersSetKey')) {
    function onlineUsersSetKey(?string $database): string
    {
        return 'online_users:' . ($database ?: 'default');
    }
}

if (!function_exists('onlineUserAliveKey')) {
    function onlineUserAliveKey(?string $database, string $username): string
    {
        return 'online_user_alive:' . ($database ?: 'default') . ':' . $username;
    }
}

if (!function_exists('onlineUserNameKey')) {
    function onlineUserNameKey(?string $database, string $username): string
    {
        return 'online_user_name:' . ($database ?: 'default') . ':' . $username;
    }
}

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');



Route::post('/login-simple', function (Request $request) {
    $database = $request->input('database');
    $username = $request->input('pengguna');
    $password = $request->input('password');
    $allowed = config('tenants.databases', []);

    if (!$database || !in_array($database, $allowed, true)) {
        throw ValidationException::withMessages([
            'database' => __('Please select a valid database.'),
        ]);
    }

    if (!$username || !$password) {
        throw ValidationException::withMessages([
            'pengguna' => __('Username atau password salah.'),
        ]);
    }

    $connection = config('tenants.connection', config('database.default'));
    config(['database.default' => $connection]);
    DB::setDefaultConnection($connection);
    config(["database.connections.$connection.database" => $database]);
    DB::purge($connection);
    DB::reconnect($connection);

    $user = Pengguna::on($connection)
        ->where('pengguna', $username)
        ->first();

    if (!$user || (string) $password !== trim($user->pass)) {
        throw ValidationException::withMessages([
            'pengguna' => __('Username atau password salah.'),
        ]);
    }

    // Set session flag to Y on successful login
    Pengguna::on($connection)
        ->where('pengguna', $user->pengguna)
        ->update(['Sesi' => 'Y']);

    $onlineTtlSeconds = 120;
    $onlineSetKey = onlineUsersSetKey($database);
    $onlineAliveKey = onlineUserAliveKey($database, $user->pengguna);
    $onlineNameKey = onlineUserNameKey($database, $user->pengguna);
    Redis::sadd($onlineSetKey, [$user->pengguna]);
    Redis::setex($onlineAliveKey, $onlineTtlSeconds, (string) time());
    Redis::setex($onlineNameKey, $onlineTtlSeconds, (string) ($user->name ?? $user->pengguna));

    // Inisialisasi heartbeat supaya request pertama setelah redirect tidak dianggap "stale"
    $key = 'browser_active:' . ($database ?: 'default') . ':' . $user->pengguna;
    Cache::store('file')->put($key, time(), now()->addMinutes(10));

    // Cookie persisten supaya tidak gampang terlogout sendiri (mobile sering membuang session-cookie).
    // Status login "aktif" tetap dikontrol oleh heartbeat (lihat /heartbeat-simple).
    $loginCookieMinutes = 60 * 24 * 30; // 30 hari
    $tenantCookieMinutes = 60 * 24 * 30; // 30 hari

    return redirect('/dashboard')
        ->withCookie(cookie('tenant_database', $database, $tenantCookieMinutes))
        ->withCookie(cookie('login_user', $user->pengguna, $loginCookieMinutes))
        ->withCookie(cookie('login_user_name', $user->name, $loginCookieMinutes))
        ->withCookie(cookie('login_last_online', (string) ($user->last_online ?? ''), $loginCookieMinutes));
});



Route::post('/heartbeat-simple', function (Request $request) {
    $database = $request->cookie('tenant_database');
    $username = $request->cookie('login_user');
    $allowed = config('tenants.databases', []);

    if (!$username) {
        return response()->json(['ok' => false], 401);
    }

    if ($database && in_array($database, $allowed, true)) {
        $connection = config('tenants.connection', config('database.default'));
        config(['database.default' => $connection]);
        DB::setDefaultConnection($connection);
        config(["database.connections.$connection.database" => $database]);
        DB::purge($connection);
        DB::reconnect($connection);

        Pengguna::on($connection)
            ->where('pengguna', $username)
            ->update(['Sesi' => 'Y']);
    }

    $key = 'browser_active:' . ($database ?: 'default') . ':' . $username;
    Cache::store('file')->put($key, time(), now()->addMinutes(10));

    $onlineTtlSeconds = 120;
    $onlineSetKey = onlineUsersSetKey($database);
    $onlineAliveKey = onlineUserAliveKey($database, $username);
    $onlineNameKey = onlineUserNameKey($database, $username);
    $displayName = (string) ($request->cookie('login_user_name') ?: $username);

    Redis::sadd($onlineSetKey, [$username]);
    Redis::setex($onlineAliveKey, $onlineTtlSeconds, (string) time());
    Redis::setex($onlineNameKey, $onlineTtlSeconds, $displayName);

    return response()->json(['ok' => true]);
});

Route::match(['get', 'post'], '/logout-simple', function (Request $request) {
    $database = $request->cookie('tenant_database');
    $username = $request->cookie('login_user');
    $allowed = config('tenants.databases', []);

    if ($database && in_array($database, $allowed, true)) {
        $connection = config('tenants.connection', config('database.default'));
        config(['database.default' => $connection]);
        DB::setDefaultConnection($connection);
        config(["database.connections.$connection.database" => $database]);
        DB::purge($connection);
        DB::reconnect($connection);

        if ($username) {
            $column = config('tenants.last_online_column', 'LastOnline');
            Pengguna::on($connection)
                ->where('pengguna', $username)
                ->update([
                    $column => now('Asia/Singapore'),
                    'Sesi' => 'T',
                ]);

            $onlineSetKey = onlineUsersSetKey($database);
            $onlineAliveKey = onlineUserAliveKey($database, $username);
            $onlineNameKey = onlineUserNameKey($database, $username);
            Redis::srem($onlineSetKey, [$username]);
            Redis::del([$onlineAliveKey, $onlineNameKey]);
        }
    }

    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login')
        ->withCookie(Cookie::forget('login_user'))
        ->withCookie(Cookie::forget('login_user_name'))
        ->withCookie(Cookie::forget('login_last_online'))
        ->withCookie(Cookie::forget('tenant_database'));
});

Route::get('/online-users', function (Request $request) {
    $database = $request->cookie('tenant_database');
    $allowed = config('tenants.databases', []);

    if (!$database || !in_array($database, $allowed, true)) {
        return response()->json(['count' => 0, 'users' => []]);
    }

    $onlineSetKey = onlineUsersSetKey($database);
    $usernames = Redis::smembers($onlineSetKey) ?: [];
    $aliveUsers = [];
    $staleUsers = [];

    foreach ($usernames as $username) {
        $aliveKey = onlineUserAliveKey($database, (string) $username);
        if (Redis::exists($aliveKey)) {
            $name = Redis::get(onlineUserNameKey($database, (string) $username));
            $aliveUsers[] = $name ?: $username;
        } else {
            $staleUsers[] = $username;
        }
    }

    if (!empty($staleUsers)) {
        Redis::srem($onlineSetKey, $staleUsers);
    }

    sort($aliveUsers, SORT_NATURAL | SORT_FLAG_CASE);
    $users = collect($aliveUsers)->values();

    return response()->json([
        'count' => $users->count(),
        'users' => $users,
    ]);
});

Route::get('/ping-db', function (Request $request) {
    $database = $request->cookie('tenant_database');
    $allowed = config('tenants.databases', []);

    if (!$database || !in_array($database, $allowed, true)) {
        return response()->json(['ping_ms' => null], 400);
    }

    $connection = config('tenants.connection', config('database.default'));
    config(['database.default' => $connection]);
    DB::setDefaultConnection($connection);
    config(["database.connections.$connection.database" => $database]);
    DB::purge($connection);
    DB::reconnect($connection);

    $start = microtime(true);
    DB::select('select 1');
    $ping = round((microtime(true) - $start) * 1000, 2);

    return response()->json(['ping_ms' => $ping]);
});

Route::get('dashboard', [DashboardController::class, 'index'])
    ->name('dashboard');
Route::get('dashboard/quotation-stats', [DashboardController::class, 'quotationStats'])
    ->name('dashboard.quotation-stats');
Route::get('dashboard/saldo-stats', [DashboardController::class, 'saldoStats'])
    ->name('dashboard.saldo-stats');
Route::get('dashboard/receivable-payable-stats', [DashboardController::class, 'receivablePayableStats'])
    ->name('dashboard.receivable-payable-stats');
Route::get('dashboard/delivery-stats', [DashboardController::class, 'deliveryStats'])
    ->name('dashboard.delivery-stats');
Route::get('dashboard/sales-hpp-stats/{period?}', [DashboardController::class, 'getSalesHppStats'])
    ->name('dashboard.sales-hpp-stats');

Route::get('laporan/jurnal-umum', [JurnalUmumController::class, 'index'])
    ->name('laporan.jurnal-umum.index');
Route::get('laporan/jurnal-umum/rows', [JurnalUmumController::class, 'rows'])
    ->name('laporan.jurnal-umum.rows');
Route::get('laporan/jurnal-umum/details', [JurnalUmumController::class, 'details'])
    ->name('laporan.jurnal-umum.details');
Route::get('laporan/jurnal-umum/print', [JurnalUmumController::class, 'print'])
    ->name('laporan.jurnal-umum.print');

Route::get('laporan/audit-rekonsiliasi', [AuditRekonsiliasiController::class, 'index'])
    ->name('laporan.audit-rekonsiliasi.index');
Route::get('laporan/audit-rekonsiliasi/rows', [AuditRekonsiliasiController::class, 'rows'])
    ->name('laporan.audit-rekonsiliasi.rows');

Route::get('laporan/jurnal-penyesuaian', [JurnalPenyesuaianController::class, 'index'])
    ->name('laporan.jurnal-penyesuaian.index');
Route::get('laporan/jurnal-penyesuaian/rows', [JurnalPenyesuaianController::class, 'rows'])
    ->name('laporan.jurnal-penyesuaian.rows');
Route::get('laporan/jurnal-penyesuaian/details', [JurnalPenyesuaianController::class, 'details'])
    ->name('laporan.jurnal-penyesuaian.details');
Route::get('laporan/jurnal-penyesuaian/print', [JurnalPenyesuaianController::class, 'print'])
    ->name('laporan.jurnal-penyesuaian.print');

Route::get('laporan/buku-kas', [BukuKasController::class, 'index'])
    ->name('laporan.buku-kas.index');
Route::get('laporan/buku-kas/rows', [BukuKasController::class, 'rows'])
    ->name('laporan.buku-kas.rows');
Route::get('laporan/buku-kas/print', [BukuKasController::class, 'print'])
    ->name('laporan.buku-kas.print');

Route::get('laporan/buku-besar', [BukuBesarController::class, 'index'])
    ->name('laporan.buku-besar.index');
Route::get('laporan/buku-besar/rows', [BukuBesarController::class, 'rows'])
    ->name('laporan.buku-besar.rows');
Route::get('laporan/buku-besar/print', [BukuBesarController::class, 'print'])
    ->name('laporan.buku-besar.print');

Route::get('laporan/saldo-akun', [SaldoAkunController::class, 'index'])
    ->name('laporan.saldo-akun.index');
Route::get('laporan/saldo-akun/rows', [SaldoAkunController::class, 'rows'])
    ->name('laporan.saldo-akun.rows');
Route::get('laporan/saldo-akun/print', [SaldoAkunController::class, 'print'])
    ->name('laporan.saldo-akun.print');

Route::get('laporan/neraca-lajur', [NeracaLajurController::class, 'index'])
    ->name('laporan.neraca-lajur.index');
Route::get('laporan/neraca-lajur/rows', [NeracaLajurController::class, 'rows'])
    ->name('laporan.neraca-lajur.rows');
Route::get('laporan/neraca-lajur/print', [NeracaLajurController::class, 'print'])
    ->name('laporan.neraca-lajur.print');

Route::get('laporan/neraca-saldo', [NeracaSaldoController::class, 'index'])
    ->name('laporan.neraca-saldo.index');
Route::get('laporan/neraca-saldo/rows', [NeracaSaldoController::class, 'rows'])
    ->name('laporan.neraca-saldo.rows');
Route::get('laporan/neraca-saldo/print', [NeracaSaldoController::class, 'print'])
    ->name('laporan.neraca-saldo.print');

Route::get('laporan/rugi-laba', [RugiLabaController::class, 'index'])
    ->name('laporan.rugi-laba.index');
Route::get('laporan/rugi-laba/rows', [RugiLabaController::class, 'rows'])
    ->name('laporan.rugi-laba.rows');
Route::get('laporan/rugi-laba/print', [RugiLabaController::class, 'print'])
    ->name('laporan.rugi-laba.print');

Route::get('laporan/neraca-akhir', [NeracaAkhirController::class, 'index'])
    ->name('laporan.neraca-akhir.index');
Route::get('laporan/neraca-akhir/rows', [NeracaAkhirController::class, 'rows'])
    ->name('laporan.neraca-akhir.rows');
Route::get('laporan/neraca-akhir/print', [NeracaAkhirController::class, 'print'])
    ->name('laporan.neraca-akhir.print');

Route::get('laporan/perubahan-modal', [PerubahanModalController::class, 'index'])
    ->name('laporan.perubahan-modal.index');
Route::get('laporan/perubahan-modal/rows', [PerubahanModalController::class, 'rows'])
    ->name('laporan.perubahan-modal.rows');
Route::get('laporan/perubahan-modal/print', [PerubahanModalController::class, 'print'])
    ->name('laporan.perubahan-modal.print');

Route::get('master-data/material', [MaterialController::class, 'index'])
    ->name('master-data.material.index');
Route::get('master-data/material/export', [MaterialController::class, 'export'])
    ->name('master-data.material.export');
Route::post('master-data/material', [MaterialController::class, 'store'])
    ->name('master-data.material.store');
Route::put('master-data/material/{kdMaterial}', [MaterialController::class, 'update'])
    ->name('master-data.material.update');
Route::delete('master-data/material/{kdMaterial}', [MaterialController::class, 'destroy'])
    ->name('master-data.material.destroy');
Route::get('master-data/vendor', [VendorController::class, 'index'])
    ->name('master-data.vendor.index');
Route::get('master-data/vendor/{kdVendor}', [VendorController::class, 'show'])
    ->name('master-data.vendor.show');
Route::post('master-data/vendor', [VendorController::class, 'store'])
    ->name('master-data.vendor.store');
Route::put('master-data/vendor/{kdVendor}', [VendorController::class, 'update'])
    ->name('master-data.vendor.update');
Route::delete('master-data/vendor/{kdVendor}', [VendorController::class, 'destroy'])
    ->name('master-data.vendor.destroy');
Route::get('master-data/customer', [CustomerController::class, 'index'])
    ->name('master-data.customer.index');
Route::get('master-data/customer/{kdCustomer}', [CustomerController::class, 'show'])
    ->name('master-data.customer.show');
Route::post('master-data/customer', [CustomerController::class, 'store'])
    ->name('master-data.customer.store');
Route::put('master-data/customer/{kdCustomer}', [CustomerController::class, 'update'])
    ->name('master-data.customer.update');
Route::delete('master-data/customer/{kdCustomer}', [CustomerController::class, 'destroy'])
    ->name('master-data.customer.destroy');

Route::get('marketing/quotation', [QuotationController::class, 'index'])
    ->name('marketing.quotation.index');
Route::get('marketing/quotation/customers', [QuotationController::class, 'customers'])
    ->name('marketing.quotation.customers');
Route::get('marketing/quotation/materials', [QuotationController::class, 'materials'])
    ->name('marketing.quotation.materials');
Route::get('marketing/quotation/create', [QuotationController::class, 'create'])
    ->name('marketing.quotation.create');
Route::get('marketing/quotation/{noPenawaran}/edit', [QuotationController::class, 'edit'])
    ->name('marketing.quotation.edit');
Route::get('marketing/quotation/{noPenawaran}/details', [QuotationController::class, 'details'])
    ->name('marketing.quotation.details');
Route::get('marketing/quotation/{noPenawaran}/print', [QuotationController::class, 'print'])
    ->name('marketing.quotation.print');
Route::delete('marketing/quotation/{noPenawaran}', [QuotationController::class, 'destroy'])
    ->name('marketing.quotation.destroy');
Route::put('marketing/quotation/{noPenawaran}', [QuotationController::class, 'update'])
    ->name('marketing.quotation.update');
Route::put('marketing/quotation/{noPenawaran}/detail/{detailId}', [QuotationController::class, 'updateDetail'])
    ->name('marketing.quotation.detail.update');
Route::delete('marketing/quotation/{noPenawaran}/detail/{detailId}', [QuotationController::class, 'destroyDetail'])
    ->name('marketing.quotation.detail.destroy');
Route::post('marketing/quotation', [QuotationController::class, 'store'])
    ->name('marketing.quotation.store');

Route::get('marketing/purchase-requirement', [PurchaseRequirementController::class, 'index'])
    ->name('marketing.purchase-requirement.index');
Route::get('marketing/purchase-requirement/materials', [PurchaseRequirementController::class, 'materials'])
    ->name('marketing.purchase-requirement.materials');
Route::get('marketing/purchase-requirement/customers', [PurchaseRequirementController::class, 'customers'])
    ->name('marketing.purchase-requirement.customers');
Route::get('marketing/purchase-requirement/customers', [PurchaseRequirementController::class, 'customers'])
    ->name('marketing.purchase-requirement.customers');
Route::get('marketing/purchase-requirement/details', [PurchaseRequirementController::class, 'details'])
    ->name('marketing.purchase-requirement.details');
Route::get('marketing/purchase-requirement/outstanding', [PurchaseRequirementController::class, 'outstanding'])
    ->name('marketing.purchase-requirement.outstanding');
Route::get('marketing/purchase-requirement/realized', [PurchaseRequirementController::class, 'realized'])
    ->name('marketing.purchase-requirement.realized');
Route::get('marketing/purchase-requirement/create', [PurchaseRequirementController::class, 'create'])
    ->name('marketing.purchase-requirement.create');
Route::get('marketing/purchase-requirement/{noPr}/edit', [PurchaseRequirementController::class, 'edit'])
    ->name('marketing.purchase-requirement.edit');
Route::post('marketing/purchase-requirement', [PurchaseRequirementController::class, 'store'])
    ->name('marketing.purchase-requirement.store');
Route::put('marketing/purchase-requirement/{noPr}', [PurchaseRequirementController::class, 'update'])
    ->name('marketing.purchase-requirement.update');
Route::put('marketing/purchase-requirement/{noPr}/detail/{detailNo}', [PurchaseRequirementController::class, 'updateDetail'])
    ->name('marketing.purchase-requirement.detail.update');
Route::delete('marketing/purchase-requirement/{noPr}/detail/{detailNo}', [PurchaseRequirementController::class, 'destroyDetail'])
    ->name('marketing.purchase-requirement.detail.destroy');
Route::delete('marketing/purchase-requirement/{noPr}', [PurchaseRequirementController::class, 'destroy'])
    ->name('marketing.purchase-requirement.destroy');
Route::get('marketing/purchase-requirement/{noPr}/print', [PurchaseRequirementController::class, 'print'])
    ->name('marketing.purchase-requirement.print');

Route::get('pembelian/purchase-order', [PurchaseOrderController::class, 'index'])
    ->name('pembelian.purchase-order.index');
Route::get('pembelian/purchase-order/data', [PurchaseOrderController::class, 'data'])
    ->name('pembelian.purchase-order.data');
Route::get('pembelian/purchase-order/outstanding-pr', [PurchaseOrderController::class, 'outstandingPurchaseRequirements'])
    ->name('pembelian.purchase-order.outstanding-pr');
Route::get('pembelian/purchase-order/pr-details', [PurchaseOrderController::class, 'purchaseRequirementDetails'])
    ->name('pembelian.purchase-order.pr-details');
Route::get('pembelian/purchase-order/vendors', [PurchaseOrderController::class, 'vendors'])
    ->name('pembelian.purchase-order.vendors');
Route::get('pembelian/purchase-order/details', [PurchaseOrderController::class, 'details'])
    ->name('pembelian.purchase-order.details');
Route::get('pembelian/purchase-order/outstanding', [PurchaseOrderController::class, 'outstanding'])
    ->name('pembelian.purchase-order.outstanding');
Route::get('pembelian/purchase-order/realized', [PurchaseOrderController::class, 'realized'])
    ->name('pembelian.purchase-order.realized');
Route::get('pembelian/purchase-order/realized', [PurchaseOrderController::class, 'realized'])
    ->name('pembelian.purchase-order.realized');
Route::get('pembelian/purchase-order/create', [PurchaseOrderController::class, 'create'])
    ->name('pembelian.purchase-order.create');
Route::get('pembelian/purchase-order/{noPo}/edit', [PurchaseOrderController::class, 'edit'])
    ->name('pembelian.purchase-order.edit');
Route::get('pembelian/purchase-order/{noPo}/print', [PurchaseOrderController::class, 'print'])
    ->name('pembelian.purchase-order.print');
Route::post('pembelian/purchase-order', [PurchaseOrderController::class, 'store'])
    ->name('pembelian.purchase-order.store');
Route::put('pembelian/purchase-order/{noPo}', [PurchaseOrderController::class, 'update'])
    ->name('pembelian.purchase-order.update');
Route::put('pembelian/purchase-order/{noPo}/detail/{detailId}', [PurchaseOrderController::class, 'updateDetail'])
    ->name('pembelian.purchase-order.detail.update');
Route::delete('pembelian/purchase-order/{noPo}', [PurchaseOrderController::class, 'destroy'])
    ->name('pembelian.purchase-order.destroy');
Route::delete('pembelian/purchase-order/{noPo}/detail/{kdMat}', [PurchaseOrderController::class, 'destroyDetail'])
    ->name('pembelian.purchase-order.detail.destroy');

Route::get('marketing/delivery-order/create', [DeliveryOrderController::class, 'create'])
    ->name('marketing.delivery-order.create');
Route::get('marketing/delivery-order/{noDo}/edit', [DeliveryOrderController::class, 'edit'])
    ->name('marketing.delivery-order.edit');
Route::get('marketing/delivery-order/search-pr', [DeliveryOrderController::class, 'searchPr'])
    ->name('marketing.delivery-order.search-pr');
Route::get('marketing/delivery-order/get-pr-details', [DeliveryOrderController::class, 'getPrDetails'])
    ->name('marketing.delivery-order.get-pr-details');
Route::get('marketing/delivery-order/details', [DeliveryOrderController::class, 'details'])
    ->name('marketing.delivery-order.details');
Route::get('marketing/delivery-order/outstanding', [DeliveryOrderController::class, 'outstanding'])
    ->name('marketing.delivery-order.outstanding');
Route::get('marketing/delivery-order/realized', [DeliveryOrderController::class, 'realized'])
    ->name('marketing.delivery-order.realized');
Route::post('marketing/delivery-order', [DeliveryOrderController::class, 'store'])
    ->name('marketing.delivery-order.store');
Route::put('marketing/delivery-order/{noDo}/detail/{lineNo}', [DeliveryOrderController::class, 'updateDetail'])
    ->name('marketing.delivery-order.detail.update');
Route::put('marketing/delivery-order/{noDo}', [DeliveryOrderController::class, 'update'])
    ->name('marketing.delivery-order.update');
Route::delete('marketing/delivery-order/{noDo}', [DeliveryOrderController::class, 'destroy'])
    ->name('marketing.delivery-order.destroy');

Route::get('marketing/delivery-order', [DeliveryOrderController::class, 'index'])
    ->name('marketing.delivery-order.index');
Route::get('marketing/delivery-order/{noDo}/print', [DeliveryOrderController::class, 'print'])
    ->name('marketing.delivery-order.print');

Route::get('marketing/delivery-order-add', [DeliveryOrderAddController::class, 'index'])
    ->name('marketing.delivery-order-add.index');
Route::get('marketing/delivery-order-add/create', [DeliveryOrderAddController::class, 'create'])
    ->name('marketing.delivery-order-add.create');
Route::get('marketing/delivery-order-add/{noDob}/edit', [DeliveryOrderAddController::class, 'edit'])
    ->name('marketing.delivery-order-add.edit');
Route::get('marketing/delivery-order-add/details', [DeliveryOrderAddController::class, 'details'])
    ->name('marketing.delivery-order-add.details');
Route::get('marketing/delivery-order-add/outstanding', [DeliveryOrderAddController::class, 'outstanding'])
    ->name('marketing.delivery-order-add.outstanding');
Route::get('marketing/delivery-order-add/outstanding-do', [DeliveryOrderAddController::class, 'outstandingDo'])
    ->name('marketing.delivery-order-add.outstanding-do');
Route::get('marketing/delivery-order-add/pr-materials', [DeliveryOrderAddController::class, 'prMaterials'])
    ->name('marketing.delivery-order-add.pr-materials');
Route::get('marketing/delivery-order-add/realized', [DeliveryOrderAddController::class, 'realized'])
    ->name('marketing.delivery-order-add.realized');
Route::post('marketing/delivery-order-add', [DeliveryOrderAddController::class, 'store'])
    ->name('marketing.delivery-order-add.store');
Route::put('marketing/delivery-order-add/{noDob}', [DeliveryOrderAddController::class, 'update'])
    ->name('marketing.delivery-order-add.update');
Route::put('marketing/delivery-order-add/{noDob}/detail/{lineNo}', [DeliveryOrderAddController::class, 'updateDetail'])
    ->name('marketing.delivery-order-add.detail.update');
Route::delete('marketing/delivery-order-add/{noDob}', [DeliveryOrderAddController::class, 'destroy'])
    ->name('marketing.delivery-order-add.destroy');
Route::get('marketing/delivery-order-add/{noDob}/print', [DeliveryOrderAddController::class, 'print'])
    ->name('marketing.delivery-order-add.print');

Route::get('pembelian/delivery-order-cost', [DeliveryOrderCostController::class, 'index'])
    ->name('pembelian.delivery-order-cost.index');
Route::get('pembelian/delivery-order-cost/create', [DeliveryOrderCostController::class, 'create'])
    ->name('pembelian.delivery-order-cost.create');
Route::get('pembelian/delivery-order-cost/{noAlokasi}/edit', [DeliveryOrderCostController::class, 'edit'])
    ->name('pembelian.delivery-order-cost.edit');
Route::get('pembelian/delivery-order-cost/details', [DeliveryOrderCostController::class, 'details'])
    ->name('pembelian.delivery-order-cost.details');
Route::get('pembelian/delivery-order-cost/outstanding', [DeliveryOrderCostController::class, 'outstanding'])
    ->name('pembelian.delivery-order-cost.outstanding');
Route::get('pembelian/delivery-order-cost/materials', [DeliveryOrderCostController::class, 'materials'])
    ->name('pembelian.delivery-order-cost.materials');
Route::post('pembelian/delivery-order-cost', [DeliveryOrderCostController::class, 'store'])
    ->name('pembelian.delivery-order-cost.store');
Route::get('pembelian/delivery-order-cost/{noAlokasi}/print', [DeliveryOrderCostController::class, 'print'])
    ->name('pembelian.delivery-order-cost.print');
Route::post('pembelian/delivery-order-cost/{noAlokasi}/detail', [DeliveryOrderCostController::class, 'storeDetail'])
    ->name('pembelian.delivery-order-cost.detail.store');
Route::put('pembelian/delivery-order-cost/{noAlokasi}/detail/{lineNo}', [DeliveryOrderCostController::class, 'updateDetail'])
    ->name('pembelian.delivery-order-cost.detail.update');
Route::delete('pembelian/delivery-order-cost/{noAlokasi}/detail/{lineNo}', [DeliveryOrderCostController::class, 'deleteDetail'])
    ->name('pembelian.delivery-order-cost.detail.delete');
Route::put('pembelian/delivery-order-cost/{noAlokasi}', [DeliveryOrderCostController::class, 'updateHeader'])
    ->name('pembelian.delivery-order-cost.update');

Route::get('pembayaran/permintaan-dana-operasional', [PermintaanDanaOperasionalController::class, 'index'])
    ->name('pembayaran.permintaan-dana-operasional.index');
Route::get('pembayaran/permintaan-dana-operasional/create', [PermintaanDanaOperasionalController::class, 'create'])
    ->name('pembayaran.permintaan-dana-operasional.create');
Route::post('pembayaran/permintaan-dana-operasional', [PermintaanDanaOperasionalController::class, 'store'])
    ->name('pembayaran.permintaan-dana-operasional.store');
Route::get('pembayaran/permintaan-dana-operasional/rows', [PermintaanDanaOperasionalController::class, 'rows'])
    ->name('pembayaran.permintaan-dana-operasional.rows');
Route::get('pembayaran/permintaan-dana-operasional/fi-rows', [PermintaanDanaOperasionalController::class, 'fiRows'])
    ->name('pembayaran.permintaan-dana-operasional.fi-rows');
Route::get('pembayaran/permintaan-dana-operasional/fi/{noDoc}', [PermintaanDanaOperasionalController::class, 'fiDetail'])
    ->name('pembayaran.permintaan-dana-operasional.fi-detail');
Route::get('pembayaran/permintaan-dana-operasional/{noPdo}/rows', [PermintaanDanaOperasionalController::class, 'pdoRows'])
    ->name('pembayaran.permintaan-dana-operasional.pdo-rows');
Route::get('pembayaran/permintaan-dana-operasional/{noPdo}/print', [PermintaanDanaOperasionalController::class, 'print'])
    ->name('pembayaran.permintaan-dana-operasional.print');
Route::get('pembayaran/permintaan-dana-biaya', [PermintaanDanaBiayaController::class, 'index'])
    ->name('pembayaran.permintaan-dana-biaya.index');
Route::get('pembayaran/permintaan-dana-biaya/create', [PermintaanDanaBiayaController::class, 'create'])
    ->name('pembayaran.permintaan-dana-biaya.create');
Route::post('pembayaran/permintaan-dana-biaya', [PermintaanDanaBiayaController::class, 'store'])
    ->name('pembayaran.permintaan-dana-biaya.store');
Route::get('pembayaran/permintaan-dana-biaya/rows', [PermintaanDanaBiayaController::class, 'rows'])
    ->name('pembayaran.permintaan-dana-biaya.rows');
Route::get('pembayaran/permintaan-dana-biaya/paycost-rows', [PermintaanDanaBiayaController::class, 'payCostRows'])
    ->name('pembayaran.permintaan-dana-biaya.paycost-rows');
Route::get('pembayaran/permintaan-dana-biaya/bayar-detail', [PermintaanDanaBiayaController::class, 'bayarDetail'])
    ->name('pembayaran.permintaan-dana-biaya.bayar-detail');
Route::get('pembayaran/permintaan-dana-biaya/detail-rows', [PermintaanDanaBiayaController::class, 'detailRows'])
    ->name('pembayaran.permintaan-dana-biaya.detail-rows');
Route::get('pembayaran/permintaan-dana-biaya/print', [PermintaanDanaBiayaController::class, 'print'])
    ->name('pembayaran.permintaan-dana-biaya.print');
Route::get('pembayaran/payment-cost', [PaymentCostController::class, 'index'])
    ->name('pembayaran.payment-cost.index');
Route::get('pembayaran/payment-cost/create', [PaymentCostController::class, 'create'])
    ->name('pembayaran.payment-cost.create');
Route::post('pembayaran/payment-cost', [PaymentCostController::class, 'store'])
    ->name('pembayaran.payment-cost.store');
Route::get('pembayaran/payment-cost/bkp-rows', [PaymentCostController::class, 'bkpRows'])
    ->name('pembayaran.payment-cost.bkp-rows');
Route::get('pembayaran/payment-cost/bkj-rows', [PaymentCostController::class, 'bkjRows'])
    ->name('pembayaran.payment-cost.bkj-rows');
Route::get('pembayaran/payment-cost/rows', [PaymentCostController::class, 'rows'])
    ->name('pembayaran.payment-cost.rows');

Route::get('penjualan/faktur-penjualan', [FakturPenjualanController::class, 'index'])
    ->name('penjualan.faktur-penjualan.index');
Route::get('pembayaran/biaya-kirim-penjualan', [BiayaKirimPenjualanController::class, 'index'])
    ->name('pembayaran.biaya-kirim-penjualan.index');
Route::get('pembayaran/biaya-kirim-penjualan/create', [BiayaKirimPenjualanController::class, 'create'])
    ->name('pembayaran.biaya-kirim-penjualan.create');
Route::get('pembayaran/biaya-kirim-penjualan/do-list', [BiayaKirimPenjualanController::class, 'doList'])
    ->name('pembayaran.biaya-kirim-penjualan.do-list');
Route::get('pembayaran/biaya-kirim-penjualan/do-materials', [BiayaKirimPenjualanController::class, 'doMaterials'])
    ->name('pembayaran.biaya-kirim-penjualan.do-materials');
Route::get('pembayaran/biaya-kirim-penjualan/dot-materials', [BiayaKirimPenjualanController::class, 'dotMaterials'])
    ->name('pembayaran.biaya-kirim-penjualan.dot-materials');
Route::get('pembayaran/biaya-kirim-penjualan/biaya-kirim', [BiayaKirimPenjualanController::class, 'biayaKirim'])
    ->name('pembayaran.biaya-kirim-penjualan.biaya-kirim');
Route::get('pembayaran/biaya-kirim-penjualan/data', [BiayaKirimPenjualanController::class, 'data'])
    ->name('pembayaran.biaya-kirim-penjualan.data');
Route::post('pembayaran/biaya-kirim-penjualan', [BiayaKirimPenjualanController::class, 'store'])
    ->name('pembayaran.biaya-kirim-penjualan.store');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}/edit', [BiayaKirimPenjualanController::class, 'edit'])
    ->name('pembayaran.biaya-kirim-penjualan.edit');
Route::put('pembayaran/biaya-kirim-penjualan/{noBkj}', [BiayaKirimPenjualanController::class, 'update'])
    ->name('pembayaran.biaya-kirim-penjualan.update');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}/print', [BiayaKirimPenjualanController::class, 'print'])
    ->name('pembayaran.biaya-kirim-penjualan.print');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}', [BiayaKirimPenjualanController::class, 'show'])
    ->name('pembayaran.biaya-kirim-penjualan.show');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}/details', [BiayaKirimPenjualanController::class, 'detailList'])
    ->name('pembayaran.biaya-kirim-penjualan.details');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}/materials', [BiayaKirimPenjualanController::class, 'materialList'])
    ->name('pembayaran.biaya-kirim-penjualan.materials');
Route::get('pembayaran/biaya-kirim-penjualan/{noBkj}/dot-materials', [BiayaKirimPenjualanController::class, 'dotMaterialList'])
    ->name('pembayaran.biaya-kirim-penjualan.dot-materials');
Route::delete('pembayaran/biaya-kirim-penjualan/{noBkj}', [BiayaKirimPenjualanController::class, 'destroy'])
    ->name('pembayaran.biaya-kirim-penjualan.destroy');

Route::get('inventory/data-material', [DataMaterialController::class, 'index'])
    ->name('inventory.data-material.index');
Route::get('inventory/data-material/rows', [DataMaterialController::class, 'sectionRows'])
    ->name('inventory.data-material.rows');
Route::delete('inventory/data-material/row', [DataMaterialController::class, 'destroy'])
    ->name('inventory.data-material.destroy');

Route::get('inventory/penerimaan-material', [PenerimaanMaterialController::class, 'index'])
    ->name('inventory.penerimaan-material.index');
Route::get('inventory/penerimaan-material/po-list', [PenerimaanMaterialController::class, 'poList'])
    ->name('inventory.penerimaan-material.po-list');
Route::get('inventory/penerimaan-material/po-materials', [PenerimaanMaterialController::class, 'poMaterials'])
    ->name('inventory.penerimaan-material.po-materials');
Route::post('inventory/penerimaan-material/mi', [PenerimaanMaterialController::class, 'storeMi'])
    ->name('inventory.penerimaan-material.mi.store');
Route::post('inventory/penerimaan-material/mis', [PenerimaanMaterialController::class, 'storeMis'])
    ->name('inventory.penerimaan-material.mis.store');
Route::post('inventory/penerimaan-material/mib', [PenerimaanMaterialController::class, 'storeMib'])
    ->name('inventory.penerimaan-material.mib.store');

Route::get('inventory/transfer-material', [TransferMaterialController::class, 'index'])
    ->name('inventory.transfer-material.index');
Route::get('inventory/transfer-material/mis-list', [TransferMaterialController::class, 'misList'])
    ->name('inventory.transfer-material.mis-list');
Route::post('inventory/transfer-material/mis-transfer', [TransferMaterialController::class, 'transferMis'])
    ->name('inventory.transfer-material.mis-transfer');
Route::get('inventory/transfer-material/mib-list', [TransferMaterialController::class, 'mibList'])
    ->name('inventory.transfer-material.mib-list');
Route::post('inventory/transfer-material/mib-transfer', [TransferMaterialController::class, 'transferMib'])
    ->name('inventory.transfer-material.mib-transfer');
Route::get('penjualan/faktur-penjualan/data', [FakturPenjualanController::class, 'listInvoices'])
    ->name('penjualan.faktur-penjualan.data');
Route::get('penjualan/faktur-penjualan/kwitansi', [KwitansiPenjualanController::class, 'index'])
    ->name('penjualan.faktur-penjualan.kwitansi.index');
Route::get('penjualan/faktur-penjualan/kwitansi/data', [KwitansiPenjualanController::class, 'listKwitansi'])
    ->name('penjualan.faktur-penjualan.kwitansi.data');
Route::get('penjualan/faktur-penjualan/kwitansi/no-receipt', [KwitansiPenjualanController::class, 'listNoReceiptInvoices'])
    ->name('penjualan.faktur-penjualan.kwitansi.no-receipt');
Route::get('penjualan/faktur-penjualan/kwitansi/{noKwitansi}/print', [KwitansiPenjualanController::class, 'print'])
    ->name('penjualan.faktur-penjualan.kwitansi.print');
Route::get('penjualan/tanda-terima-invoice', [TandaTerimaInvoiceController::class, 'index'])
    ->name('penjualan.tanda-terima-invoice.index');
Route::get('penjualan/tanda-terima-invoice/create', [TandaTerimaInvoiceController::class, 'create'])
    ->name('penjualan.tanda-terima-invoice.create');
Route::get('penjualan/tanda-terima-invoice/edit', [TandaTerimaInvoiceController::class, 'edit'])
    ->name('penjualan.tanda-terima-invoice.edit');
Route::get('penjualan/tanda-terima-invoice/data', [TandaTerimaInvoiceController::class, 'listData'])
    ->name('penjualan.tanda-terima-invoice.data');
Route::get('penjualan/tanda-terima-invoice/invoices', [TandaTerimaInvoiceController::class, 'listInvoices'])
    ->name('penjualan.tanda-terima-invoice.invoices');
Route::get('penjualan/tanda-terima-invoice/edit-data', [TandaTerimaInvoiceController::class, 'editData'])
    ->name('penjualan.tanda-terima-invoice.edit-data');
Route::get('penjualan/tanda-terima-invoice/{noTtInv}/details', [TandaTerimaInvoiceController::class, 'details'])
    ->name('penjualan.tanda-terima-invoice.details');
Route::get('penjualan/tanda-terima-invoice/details', [TandaTerimaInvoiceController::class, 'details'])
    ->name('penjualan.tanda-terima-invoice.details.query');
Route::get('penjualan/tanda-terima-invoice/{noTtInv}/receive', [TandaTerimaInvoiceController::class, 'receiveInfo'])
    ->name('penjualan.tanda-terima-invoice.receive');
Route::get('penjualan/tanda-terima-invoice/receive', [TandaTerimaInvoiceController::class, 'receiveInfo'])
    ->name('penjualan.tanda-terima-invoice.receive.query');
Route::post('penjualan/tanda-terima-invoice/receive', [TandaTerimaInvoiceController::class, 'storeReceive'])
    ->name('penjualan.tanda-terima-invoice.receive.store');
Route::post('penjualan/tanda-terima-invoice', [TandaTerimaInvoiceController::class, 'store'])
    ->name('penjualan.tanda-terima-invoice.store');
Route::post('penjualan/tanda-terima-invoice/update', [TandaTerimaInvoiceController::class, 'update'])
    ->name('penjualan.tanda-terima-invoice.update');
Route::post('penjualan/tanda-terima-invoice/update-remark', [TandaTerimaInvoiceController::class, 'updateRemark'])
    ->name('penjualan.tanda-terima-invoice.update-remark');
Route::post('penjualan/tanda-terima-invoice/delete-item', [TandaTerimaInvoiceController::class, 'deleteItem'])
    ->name('penjualan.tanda-terima-invoice.delete-item');
Route::post('penjualan/tanda-terima-invoice/add-item', [TandaTerimaInvoiceController::class, 'addItem'])
    ->name('penjualan.tanda-terima-invoice.add-item');
Route::post('penjualan/tanda-terima-invoice/delete', [TandaTerimaInvoiceController::class, 'deleteHeader'])
    ->name('penjualan.tanda-terima-invoice.delete');
Route::get('penjualan/tanda-terima-invoice/{noTtInv}/print', [TandaTerimaInvoiceController::class, 'print'])
    ->name('penjualan.tanda-terima-invoice.print');
Route::get('penjualan/tanda-terima-invoice/print', [TandaTerimaInvoiceController::class, 'print'])
    ->name('penjualan.tanda-terima-invoice.print.query');

Route::get('pembelian/invoice-masuk', [InvoiceMasukController::class, 'index'])
    ->name('pembelian.invoice-masuk.index');
Route::get('pembelian/invoice-masuk/data', [InvoiceMasukController::class, 'data'])
    ->name('pembelian.invoice-masuk.data');
Route::get('pembelian/invoice-masuk/create', [InvoiceMasukController::class, 'create'])
    ->name('pembelian.invoice-masuk.create');
Route::get('pembelian/invoice-masuk/{noDoc}/edit', [InvoiceMasukController::class, 'edit'])
    ->name('pembelian.invoice-masuk.edit');
Route::get('pembelian/invoice-masuk/po-list', [InvoiceMasukController::class, 'poList'])
    ->name('pembelian.invoice-masuk.po-list');
Route::get('pembelian/invoice-masuk/po-detail', [InvoiceMasukController::class, 'poDetail'])
    ->name('pembelian.invoice-masuk.po-detail');
Route::get('pembelian/invoice-masuk/po-materials', [InvoiceMasukController::class, 'poMaterials'])
    ->name('pembelian.invoice-masuk.po-materials');
Route::get('pembelian/invoice-masuk/paid', [InvoiceMasukController::class, 'paid'])
    ->name('pembelian.invoice-masuk.paid');
Route::get('pembelian/invoice-masuk/{noDoc}', [InvoiceMasukController::class, 'detail'])
    ->name('pembelian.invoice-masuk.detail');
Route::post('pembelian/invoice-masuk', [InvoiceMasukController::class, 'store'])
    ->name('pembelian.invoice-masuk.store');
Route::post('pembelian/invoice-masuk/{noDoc}', [InvoiceMasukController::class, 'update'])
    ->name('pembelian.invoice-masuk.update');
Route::post('pembelian/invoice-masuk/{noDoc}/delete', [InvoiceMasukController::class, 'destroy'])
    ->name('pembelian.invoice-masuk.destroy');

Route::get('keuangan/input-pembelian', [InputPembelianController::class, 'index'])
    ->name('keuangan.input-pembelian.index');
Route::get('keuangan/input-pembelian/create', [InputPembelianController::class, 'create'])
    ->name('keuangan.input-pembelian.create');
Route::get('keuangan/input-pembelian/rows', [InputPembelianController::class, 'rows'])
    ->name('keuangan.input-pembelian.rows');
Route::get('keuangan/input-pembelian/fi-rows', [InputPembelianController::class, 'fiRows'])
    ->name('keuangan.input-pembelian.fi-rows');
Route::get('keuangan/input-pembelian/fi-detail/{noDoc}', [InputPembelianController::class, 'fiDetail'])
    ->name('keuangan.input-pembelian.fi-detail');
Route::get('keuangan/input-pembelian/suggest/{noDoc}', [InputPembelianController::class, 'suggest'])
    ->name('keuangan.input-pembelian.suggest');
Route::post('keuangan/input-pembelian', [InputPembelianController::class, 'store'])
    ->name('keuangan.input-pembelian.store');

Route::get('keuangan/input-penjualan', [InputPenjualanController::class, 'index'])
    ->name('keuangan.input-penjualan.index');
Route::get('keuangan/input-penjualan/create', [InputPenjualanController::class, 'create'])
    ->name('keuangan.input-penjualan.create');
Route::get('keuangan/input-penjualan/rows', [InputPenjualanController::class, 'rows'])
    ->name('keuangan.input-penjualan.rows');
Route::get('keuangan/input-penjualan/invoice-rows', [InputPenjualanController::class, 'invoiceRows'])
    ->name('keuangan.input-penjualan.invoice-rows');
Route::get('keuangan/input-penjualan/invoice-detail/{noFaktur}', [InputPenjualanController::class, 'invoiceDetail'])
    ->name('keuangan.input-penjualan.invoice-detail');
Route::get('keuangan/input-penjualan/suggest/{noFaktur}', [InputPenjualanController::class, 'suggest'])
    ->name('keuangan.input-penjualan.suggest');
Route::post('keuangan/input-penjualan', [InputPenjualanController::class, 'store'])
    ->name('keuangan.input-penjualan.store');

Route::get('keuangan/mutasi-kas', [MutasiKasController::class, 'index'])
    ->name('keuangan.mutasi-kas.index');
Route::get('keuangan/mutasi-kas/create', [MutasiKasController::class, 'create'])
    ->name('keuangan.mutasi-kas.create');
Route::get('keuangan/mutasi-kas/rows', [MutasiKasController::class, 'rows'])
    ->name('keuangan.mutasi-kas.rows');
Route::get('keuangan/mutasi-kas/bayar-rows', [MutasiKasController::class, 'bayarRows'])
    ->name('keuangan.mutasi-kas.bayar-rows');
Route::get('keuangan/mutasi-kas/suggest', [MutasiKasController::class, 'suggest'])
    ->name('keuangan.mutasi-kas.suggest');
Route::post('keuangan/mutasi-kas', [MutasiKasController::class, 'store'])
    ->name('keuangan.mutasi-kas.store');

Route::get('keuangan/penyesuaian', [KeuanganJurnalPenyesuaianController::class, 'index'])
    ->name('keuangan.penyesuaian.index');
Route::get('keuangan/penyesuaian/create', [KeuanganJurnalPenyesuaianController::class, 'create'])
    ->name('keuangan.penyesuaian.create');
Route::get('keuangan/penyesuaian/rows', [KeuanganJurnalPenyesuaianController::class, 'rows'])
    ->name('keuangan.penyesuaian.rows');
Route::get('keuangan/penyesuaian/details', [KeuanganJurnalPenyesuaianController::class, 'details'])
    ->name('keuangan.penyesuaian.details');
Route::get('keuangan/penyesuaian/suggest', [KeuanganJurnalPenyesuaianController::class, 'suggest'])
    ->name('keuangan.penyesuaian.suggest');
Route::post('keuangan/penyesuaian', [KeuanganJurnalPenyesuaianController::class, 'store'])
    ->name('keuangan.penyesuaian.store');
Route::get('pembayaran/biaya-kirim-pembelian', [BiayaKirimPembelianController::class, 'index'])
    ->name('pembayaran.biaya-kirim-pembelian.index');
Route::get('pembayaran/biaya-kirim-pembelian/create', [BiayaKirimPembelianController::class, 'create'])
    ->name('pembayaran.biaya-kirim-pembelian.create');
Route::get('pembayaran/biaya-kirim-pembelian/{noBkp}/edit', [BiayaKirimPembelianController::class, 'edit'])
    ->name('pembayaran.biaya-kirim-pembelian.edit');
Route::get('pembayaran/biaya-kirim-pembelian/data', [BiayaKirimPembelianController::class, 'data'])
    ->name('pembayaran.biaya-kirim-pembelian.data');
Route::get('pembayaran/biaya-kirim-pembelian/po-list', [BiayaKirimPembelianController::class, 'poList'])
    ->name('pembayaran.biaya-kirim-pembelian.po-list');
Route::get('pembayaran/biaya-kirim-pembelian/po-materials', [BiayaKirimPembelianController::class, 'poMaterials'])
    ->name('pembayaran.biaya-kirim-pembelian.po-materials');
Route::get('pembayaran/biaya-kirim-pembelian/pr-price', [BiayaKirimPembelianController::class, 'prPrice'])
    ->name('pembayaran.biaya-kirim-pembelian.pr-price');
Route::post('pembayaran/biaya-kirim-pembelian', [BiayaKirimPembelianController::class, 'store'])
    ->name('pembayaran.biaya-kirim-pembelian.store');
Route::post('pembayaran/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'update'])
    ->name('pembayaran.biaya-kirim-pembelian.update');
Route::delete('pembayaran/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'destroy'])
    ->name('pembayaran.biaya-kirim-pembelian.destroy');
Route::get('pembayaran/biaya-kirim-pembelian/{noBkp}/print', [BiayaKirimPembelianController::class, 'print'])
    ->name('pembayaran.biaya-kirim-pembelian.print');
Route::get('pembayaran/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'show'])
    ->name('pembayaran.biaya-kirim-pembelian.show');
Route::get('pembayaran/biaya-kirim-pembelian/{noBkp}/details', [BiayaKirimPembelianController::class, 'detailList'])
    ->name('pembayaran.biaya-kirim-pembelian.details');
Route::get('pembayaran/biaya-kirim-pembelian/{noBkp}/materials', [BiayaKirimPembelianController::class, 'materialList'])
    ->name('pembayaran.biaya-kirim-pembelian.materials');
Route::get('penjualan/faktur-penjualan/create', [FakturPenjualanController::class, 'create'])
    ->name('penjualan.faktur-penjualan.create');
Route::get('penjualan/faktur-penjualan/{noFaktur}/edit', [FakturPenjualanController::class, 'edit'])
    ->name('penjualan.faktur-penjualan.edit');
Route::post('penjualan/faktur-penjualan', [FakturPenjualanController::class, 'store'])
    ->name('penjualan.faktur-penjualan.store');
Route::put('penjualan/faktur-penjualan/{noFaktur}', [FakturPenjualanController::class, 'update'])
    ->name('penjualan.faktur-penjualan.update');
Route::delete('penjualan/faktur-penjualan/{noFaktur}', [FakturPenjualanController::class, 'destroy'])
    ->name('penjualan.faktur-penjualan.destroy');
Route::post('penjualan/faktur-penjualan/upload-faktur-pajak', [FakturPenjualanController::class, 'uploadFakturPajak'])
    ->name('penjualan.faktur-penjualan.upload-faktur-pajak');
Route::post('penjualan/faktur-penjualan/kwitansi', [FakturPenjualanController::class, 'storeKwitansi'])
    ->name('penjualan.faktur-penjualan.kwitansi');
Route::get('penjualan/faktur-penjualan/{noFaktur}/details', [FakturPenjualanController::class, 'details'])
    ->name('penjualan.faktur-penjualan.details');
Route::get('penjualan/faktur-penjualan/{noFaktur}/print', [FakturPenjualanController::class, 'print'])
    ->name('penjualan.faktur-penjualan.print');
Route::get('penjualan/faktur-penjualan/outstanding-do', [FakturPenjualanController::class, 'outstandingDo'])
    ->name('penjualan.faktur-penjualan.outstanding-do');
Route::get('penjualan/faktur-penjualan/do-materials', [FakturPenjualanController::class, 'doMaterials'])
    ->name('penjualan.faktur-penjualan.do-materials');
Route::get('penjualan/faktur-penjualan/do-add-materials', [FakturPenjualanController::class, 'doAddMaterials'])
    ->name('penjualan.faktur-penjualan.do-add-materials');

require __DIR__.'/settings.php';
