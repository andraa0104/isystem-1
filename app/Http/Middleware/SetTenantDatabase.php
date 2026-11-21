<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;

class SetTenantDatabase
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $allowed = config('tenants.databases', []);
        $database = $request->input('database');

        if ($database && in_array($database, $allowed, true)) {
            if ($request->hasSession()) {
                $request->session()->put('tenant.database', $database);
            }
            Cookie::queue('tenant_database', $database);
        } else {
            $database = ($request->hasSession() ? $request->session()->get('tenant.database') : null)
                ?? $request->cookie('tenant_database');
        }

        if ($database && in_array($database, $allowed, true)
            && !$request->cookie('tenant_database')) {
            Cookie::queue('tenant_database', $database);
        }

        if ($database && in_array($database, $allowed, true)) {
            $connection = config('tenants.connection', config('database.default'));
            config(['database.default' => $connection]);
            config(["database.connections.$connection.database" => $database]);

            $activeConn = DB::connection($connection);
            if ($activeConn->getDatabaseName() !== $database) {
                $activeConn->setDatabaseName($database);
                try {
                    $activeConn->statement("USE `{$database}`");
                } catch (\Throwable) {
                    // Jika koneksi PDO belum terbuka atau reconnect dibutuhkan
                    DB::purge($connection);
                    try {
                        DB::reconnect($connection);
                    } catch (\Throwable) {}
                }
            }
            DB::setDefaultConnection($connection);
        }

        return $next($request);
    }
}
