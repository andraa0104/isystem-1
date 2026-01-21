<?php

namespace App\Providers;

use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(Logout::class, function (Logout $event): void {
            if (!$event->user) {
                return;
            }

            $request = request();
            $database = $request->session()->get('tenant.database')
                ?? $request->cookie('tenant_database');
            $allowed = config('tenants.databases', []);

            if (!$database || !in_array($database, $allowed, true)) {
                return;
            }

            $connection = config('tenants.connection', config('database.default'));
            config(["database.connections.$connection.database" => $database]);

            DB::connection($connection)
                ->table('tb_pengguna')
                ->where('pengguna', $event->user->getAuthIdentifier())
                ->update([config('tenants.last_online_column', 'LastOnline') => now('Asia/Singapore')]);
        });
    }
}
