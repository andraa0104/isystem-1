<?php

use App\Http\Controllers\Settings\AddUserController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\PrivilegeAccessController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('user-password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    Route::middleware('admin.tingkat')->group(function () {
        Route::get('settings/add-user', [AddUserController::class, 'edit'])
            ->name('settings.add-user');
        Route::get('settings/add-user/data', [AddUserController::class, 'data'])
            ->name('settings.add-user.data');
        Route::post('settings/add-user', [AddUserController::class, 'store'])
            ->name('settings.add-user.store');

        Route::get('settings/privilege-access', [PrivilegeAccessController::class, 'edit'])
            ->name('settings.privilege-access');
        Route::get('settings/privilege-access/data', [PrivilegeAccessController::class, 'data'])
            ->name('settings.privilege-access.data');
        Route::get('settings/privilege-access/privileges', [PrivilegeAccessController::class, 'privileges'])
            ->name('settings.privilege-access.privileges');
        Route::post('settings/privilege-access/privileges', [PrivilegeAccessController::class, 'storePrivileges'])
            ->name('settings.privilege-access.privileges.store');
    });
});
