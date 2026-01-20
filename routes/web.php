<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Marketing\QuotationController;
use App\Http\Controllers\Marketing\PurchaseRequirementController;
use App\Http\Controllers\Marketing\PurchaseOrderController;
use App\Http\Controllers\Marketing\DeliveryOrderController;
use App\Http\Controllers\Marketing\DeliveryOrderAddController;
use App\Http\Controllers\Marketing\DeliveryOrderCostController;
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

    return redirect('/dashboard')
        ->withCookie(cookie('tenant_database', $database, 60 * 24 * 30))
        ->withCookie(cookie('login_user', $user->pengguna, 60 * 24 * 30))
        ->withCookie(cookie('login_user_name', $user->name, 60 * 24 * 30))
        ->withCookie(cookie('login_last_online', (string) ($user->last_online ?? ''), 60 * 24 * 30));
});

Route::post('/logout-simple', function (Request $request) {
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
                ->update([$column => now()]);
        }
    }

    return redirect('/login')
        ->withCookie(Cookie::forget('login_user'))
        ->withCookie(Cookie::forget('login_user_name'))
        ->withCookie(Cookie::forget('login_last_online'))
        ->withCookie(Cookie::forget('tenant_database'));
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
Route::get('marketing/purchase-requirement/details', [PurchaseRequirementController::class, 'details'])
    ->name('marketing.purchase-requirement.details');
Route::get('marketing/purchase-requirement/outstanding', [PurchaseRequirementController::class, 'outstanding'])
    ->name('marketing.purchase-requirement.outstanding');
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
Route::get('marketing/purchase-requirement/{noPr}/print', [PurchaseRequirementController::class, 'print'])
    ->name('marketing.purchase-requirement.print');

Route::get('marketing/purchase-order', [PurchaseOrderController::class, 'index'])
    ->name('marketing.purchase-order.index');
Route::get('marketing/purchase-order/outstanding-pr', [PurchaseOrderController::class, 'outstandingPurchaseRequirements'])
    ->name('marketing.purchase-order.outstanding-pr');
Route::get('marketing/purchase-order/pr-details', [PurchaseOrderController::class, 'purchaseRequirementDetails'])
    ->name('marketing.purchase-order.pr-details');
Route::get('marketing/purchase-order/vendors', [PurchaseOrderController::class, 'vendors'])
    ->name('marketing.purchase-order.vendors');
Route::get('marketing/purchase-order/details', [PurchaseOrderController::class, 'details'])
    ->name('marketing.purchase-order.details');
Route::get('marketing/purchase-order/outstanding', [PurchaseOrderController::class, 'outstanding'])
    ->name('marketing.purchase-order.outstanding');
Route::get('marketing/purchase-order/create', [PurchaseOrderController::class, 'create'])
    ->name('marketing.purchase-order.create');
Route::get('marketing/purchase-order/{noPo}/edit', [PurchaseOrderController::class, 'edit'])
    ->name('marketing.purchase-order.edit');
Route::get('marketing/purchase-order/{noPo}/print', [PurchaseOrderController::class, 'print'])
    ->name('marketing.purchase-order.print');
Route::post('marketing/purchase-order', [PurchaseOrderController::class, 'store'])
    ->name('marketing.purchase-order.store');
Route::put('marketing/purchase-order/{noPo}', [PurchaseOrderController::class, 'update'])
    ->name('marketing.purchase-order.update');
Route::put('marketing/purchase-order/{noPo}/detail/{detailId}', [PurchaseOrderController::class, 'updateDetail'])
    ->name('marketing.purchase-order.detail.update');

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
Route::post('marketing/delivery-order', [DeliveryOrderController::class, 'store'])
    ->name('marketing.delivery-order.store');
Route::put('marketing/delivery-order/{noDo}/detail/{lineNo}', [DeliveryOrderController::class, 'updateDetail'])
    ->name('marketing.delivery-order.detail.update');

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
Route::post('marketing/delivery-order-add', [DeliveryOrderAddController::class, 'store'])
    ->name('marketing.delivery-order-add.store');
Route::put('marketing/delivery-order-add/{noDob}/detail/{lineNo}', [DeliveryOrderAddController::class, 'updateDetail'])
    ->name('marketing.delivery-order-add.detail.update');
Route::get('marketing/delivery-order-add/{noDob}/print', [DeliveryOrderAddController::class, 'print'])
    ->name('marketing.delivery-order-add.print');

Route::get('marketing/delivery-order-cost', [DeliveryOrderCostController::class, 'index'])
    ->name('marketing.delivery-order-cost.index');
Route::get('marketing/delivery-order-cost/create', [DeliveryOrderCostController::class, 'create'])
    ->name('marketing.delivery-order-cost.create');
Route::get('marketing/delivery-order-cost/{noAlokasi}/edit', [DeliveryOrderCostController::class, 'edit'])
    ->name('marketing.delivery-order-cost.edit');
Route::get('marketing/delivery-order-cost/details', [DeliveryOrderCostController::class, 'details'])
    ->name('marketing.delivery-order-cost.details');
Route::get('marketing/delivery-order-cost/outstanding', [DeliveryOrderCostController::class, 'outstanding'])
    ->name('marketing.delivery-order-cost.outstanding');
Route::get('marketing/delivery-order-cost/materials', [DeliveryOrderCostController::class, 'materials'])
    ->name('marketing.delivery-order-cost.materials');
Route::post('marketing/delivery-order-cost', [DeliveryOrderCostController::class, 'store'])
    ->name('marketing.delivery-order-cost.store');
Route::post('marketing/delivery-order-cost/{noAlokasi}/detail', [DeliveryOrderCostController::class, 'storeDetail'])
    ->name('marketing.delivery-order-cost.detail.store');
Route::put('marketing/delivery-order-cost/{noAlokasi}/detail/{lineNo}', [DeliveryOrderCostController::class, 'updateDetail'])
    ->name('marketing.delivery-order-cost.detail.update');
Route::delete('marketing/delivery-order-cost/{noAlokasi}/detail/{lineNo}', [DeliveryOrderCostController::class, 'deleteDetail'])
    ->name('marketing.delivery-order-cost.detail.delete');
Route::put('marketing/delivery-order-cost/{noAlokasi}', [DeliveryOrderCostController::class, 'updateHeader'])
    ->name('marketing.delivery-order-cost.update');

require __DIR__.'/settings.php';
