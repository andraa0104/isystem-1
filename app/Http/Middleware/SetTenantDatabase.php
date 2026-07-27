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
            $request->session()->put('tenant.database', $database);
            Cookie::queue('tenant_database', $database);
        } else {
            $database = $request->session()->get('tenant.database')
                ?? $request->cookie('tenant_database');
        }

        if ($database && in_array($database, $allowed, true)
            && !$request->cookie('tenant_database')) {
            Cookie::queue('tenant_database', $database);
        }

        if ($database && in_array($database, $allowed, true)) {
            $connection = config('tenants.connection', config('database.default'));
            $currentDatabase = config("database.connections.$connection.database");

            config(['database.default' => $connection]);
            DB::setDefaultConnection($connection);

            if ($currentDatabase !== $database) {
                config(["database.connections.$connection.database" => $database]);
                DB::purge($connection);
                try {
                    DB::reconnect($connection);
                } catch (\Exception $e) {
                    // Ignore reconnection errors
                }
            }
        }

        return $next($request);
    }
}
