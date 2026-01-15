<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Marketing\QuotationController;
use App\Http\Controllers\Marketing\PurchaseRequirementController;
use App\Http\Controllers\Marketing\PurchaseOrderController;
use App\Http\Controllers\Marketing\DeliveryOrderController;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('marketing/quotation', [QuotationController::class, 'index'])
        ->name('marketing.quotation.index');
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
    Route::get('marketing/delivery-order/search-pr', [DeliveryOrderController::class, 'searchPr'])
        ->name('marketing.delivery-order.search-pr');
    Route::get('marketing/delivery-order/get-pr-details', [DeliveryOrderController::class, 'getPrDetails'])
        ->name('marketing.delivery-order.get-pr-details');

    Route::get('marketing/delivery-order', [DeliveryOrderController::class, 'index'])
        ->name('marketing.delivery-order.index');
    Route::get('marketing/delivery-order/{noDo}/print', [DeliveryOrderController::class, 'print'])
        ->name('marketing.delivery-order.print');
});

require __DIR__.'/settings.php';
