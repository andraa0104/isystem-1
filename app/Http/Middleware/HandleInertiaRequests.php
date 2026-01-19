<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use App\Models\Pengguna;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return null;
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $databaseLabel = $database
            ? config("tenants.labels.$database", $database)
            : null;
        $authUser = $request->user();
        if (!$authUser) {
            $username = $request->cookie('login_user');
            if ($username && $database) {
                $connection = config('tenants.connection', config('database.default'));
                config(['database.default' => $connection]);
                config(["database.connections.$connection.database" => $database]);
                \Illuminate\Support\Facades\DB::setDefaultConnection($connection);
                \Illuminate\Support\Facades\DB::purge($connection);
                \Illuminate\Support\Facades\DB::reconnect($connection);
                $authUser = Pengguna::on($connection)
                    ->where('pengguna', $username)
                    ->first();
            }
        }
        $userData = null;
        if ($authUser) {
            $userData = [
                'name' => $authUser->name ?? null,
                'email' => $authUser->email ?? null,
                'avatar' => $authUser->avatar ?? null,
                'last_online' => $authUser->last_online ?? null,
                'database' => $database,
                'database_label' => $databaseLabel,
            ];
        } else {
            $cookieName = $request->cookie('login_user_name');
            $cookieLastOnline = $request->cookie('login_last_online');
            if ($cookieName) {
                $userData = [
                    'name' => $cookieName,
                    'email' => null,
                    'avatar' => null,
                    'last_online' => $cookieLastOnline ?: null,
                    'database' => $database,
                    'database_label' => $databaseLabel,
                ];
            }
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $userData,
            ],
            'tenant' => [
                'database' => $database,
                'label' => $databaseLabel,
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
