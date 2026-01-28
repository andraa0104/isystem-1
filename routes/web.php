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
use App\Http\Controllers\Marketing\InvoiceMasukController;
use App\Http\Controllers\Marketing\FakturPenjualanController;
use App\Http\Controllers\Marketing\KwitansiPenjualanController;
use App\Http\Controllers\Marketing\TandaTerimaInvoiceController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MasterData\MaterialController;
use App\Http\Controllers\MasterData\VendorController;
use App\Http\Controllers\MasterData\CustomerController;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use App\Models\Pengguna;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

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

    // Gunakan session-cookie (expires saat browser ditutup) supaya perlu login ulang jika browser ditutup
    $sessionCookieMinutes = 0; // 0 = session cookie

    return redirect('/dashboard')
        ->withCookie(cookie('tenant_database', $database, $sessionCookieMinutes))
        ->withCookie(cookie('login_user', $user->pengguna, $sessionCookieMinutes))
        ->withCookie(cookie('login_user_name', $user->name, $sessionCookieMinutes))
        ->withCookie(cookie('login_last_online', (string) ($user->last_online ?? ''), $sessionCookieMinutes));
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

    $connection = config('tenants.connection', config('database.default'));
    config(['database.default' => $connection]);
    DB::setDefaultConnection($connection);
    config(["database.connections.$connection.database" => $database]);
    DB::purge($connection);
    DB::reconnect($connection);

    $users = DB::table('tb_pengguna')
        ->whereRaw("upper(trim(coalesce(Sesi,''))) = 'Y'")
        ->orderBy('nm_user')
        ->pluck('nm_user')
        ->map(fn ($name) => $name ?? '')
        ->values();

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

Route::get('penjualan/faktur-penjualan', [FakturPenjualanController::class, 'index'])
    ->name('penjualan.faktur-penjualan.index');
Route::get('penjualan/biaya-kirim-penjualan', [BiayaKirimPenjualanController::class, 'index'])
    ->name('penjualan.biaya-kirim-penjualan.index');
Route::get('penjualan/biaya-kirim-penjualan/create', [BiayaKirimPenjualanController::class, 'create'])
    ->name('penjualan.biaya-kirim-penjualan.create');
Route::get('penjualan/biaya-kirim-penjualan/do-list', [BiayaKirimPenjualanController::class, 'doList'])
    ->name('penjualan.biaya-kirim-penjualan.do-list');
Route::get('penjualan/biaya-kirim-penjualan/do-materials', [BiayaKirimPenjualanController::class, 'doMaterials'])
    ->name('penjualan.biaya-kirim-penjualan.do-materials');
Route::get('penjualan/biaya-kirim-penjualan/dot-materials', [BiayaKirimPenjualanController::class, 'dotMaterials'])
    ->name('penjualan.biaya-kirim-penjualan.dot-materials');
Route::get('penjualan/biaya-kirim-penjualan/data', [BiayaKirimPenjualanController::class, 'data'])
    ->name('penjualan.biaya-kirim-penjualan.data');
Route::post('penjualan/biaya-kirim-penjualan', [BiayaKirimPenjualanController::class, 'store'])
    ->name('penjualan.biaya-kirim-penjualan.store');
Route::get('penjualan/biaya-kirim-penjualan/{noBkj}', [BiayaKirimPenjualanController::class, 'show'])
    ->name('penjualan.biaya-kirim-penjualan.show');
Route::get('penjualan/biaya-kirim-penjualan/{noBkj}/details', [BiayaKirimPenjualanController::class, 'detailList'])
    ->name('penjualan.biaya-kirim-penjualan.details');
Route::get('penjualan/biaya-kirim-penjualan/{noBkj}/materials', [BiayaKirimPenjualanController::class, 'materialList'])
    ->name('penjualan.biaya-kirim-penjualan.materials');
Route::delete('penjualan/biaya-kirim-penjualan/{noBkj}', [BiayaKirimPenjualanController::class, 'destroy'])
    ->name('penjualan.biaya-kirim-penjualan.destroy');
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
Route::get('pembelian/invoice-masuk/{noDoc}', [InvoiceMasukController::class, 'detail'])
    ->name('pembelian.invoice-masuk.detail');
Route::post('pembelian/invoice-masuk', [InvoiceMasukController::class, 'store'])
    ->name('pembelian.invoice-masuk.store');
Route::post('pembelian/invoice-masuk/{noDoc}', [InvoiceMasukController::class, 'update'])
    ->name('pembelian.invoice-masuk.update');
Route::post('pembelian/invoice-masuk/{noDoc}/delete', [InvoiceMasukController::class, 'destroy'])
    ->name('pembelian.invoice-masuk.destroy');
Route::get('pembelian/biaya-kirim-pembelian', [BiayaKirimPembelianController::class, 'index'])
    ->name('pembelian.biaya-kirim-pembelian.index');
Route::get('pembelian/biaya-kirim-pembelian/create', [BiayaKirimPembelianController::class, 'create'])
    ->name('pembelian.biaya-kirim-pembelian.create');
Route::get('pembelian/biaya-kirim-pembelian/{noBkp}/edit', [BiayaKirimPembelianController::class, 'edit'])
    ->name('pembelian.biaya-kirim-pembelian.edit');
Route::get('pembelian/biaya-kirim-pembelian/data', [BiayaKirimPembelianController::class, 'data'])
    ->name('pembelian.biaya-kirim-pembelian.data');
Route::get('pembelian/biaya-kirim-pembelian/po-list', [BiayaKirimPembelianController::class, 'poList'])
    ->name('pembelian.biaya-kirim-pembelian.po-list');
Route::get('pembelian/biaya-kirim-pembelian/po-materials', [BiayaKirimPembelianController::class, 'poMaterials'])
    ->name('pembelian.biaya-kirim-pembelian.po-materials');
Route::get('pembelian/biaya-kirim-pembelian/pr-price', [BiayaKirimPembelianController::class, 'prPrice'])
    ->name('pembelian.biaya-kirim-pembelian.pr-price');
Route::post('pembelian/biaya-kirim-pembelian', [BiayaKirimPembelianController::class, 'store'])
    ->name('pembelian.biaya-kirim-pembelian.store');
Route::post('pembelian/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'update'])
    ->name('pembelian.biaya-kirim-pembelian.update');
Route::delete('pembelian/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'destroy'])
    ->name('pembelian.biaya-kirim-pembelian.destroy');
Route::get('pembelian/biaya-kirim-pembelian/{noBkp}', [BiayaKirimPembelianController::class, 'show'])
    ->name('pembelian.biaya-kirim-pembelian.show');
Route::get('pembelian/biaya-kirim-pembelian/{noBkp}/details', [BiayaKirimPembelianController::class, 'detailList'])
    ->name('pembelian.biaya-kirim-pembelian.details');
Route::get('pembelian/biaya-kirim-pembelian/{noBkp}/materials', [BiayaKirimPembelianController::class, 'materialList'])
    ->name('pembelian.biaya-kirim-pembelian.materials');
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
