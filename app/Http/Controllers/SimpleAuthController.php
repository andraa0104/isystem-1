<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Cache;
use App\Models\Pengguna;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Features;

class SimpleAuthController extends Controller
{
    public static function onlineUsersSetKey(?string $database): string
    {
        return 'online_users:' . ($database ?: 'default');
    }

    public static function onlineUserAliveKey(?string $database, string $username): string
    {
        return 'online_user_alive:' . ($database ?: 'default') . ':' . $username;
    }

    public static function onlineUserNameKey(?string $database, string $username): string
    {
        return 'online_user_name:' . ($database ?: 'default') . ':' . $username;
    }

    public function home()
    {
        return Inertia::render('welcome', [
            'canRegister' => Features::enabled(Features::registration()),
        ]);
    }

    public function login(Request $request)
    {
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
        $onlineSetKey = self::onlineUsersSetKey($database);
        $onlineAliveKey = self::onlineUserAliveKey($database, $user->pengguna);
        $onlineNameKey = self::onlineUserNameKey($database, $user->pengguna);

        // Replace Redis set with Cache array
        $usernames = Cache::store('file')->get($onlineSetKey, []);
        if (!in_array($user->pengguna, $usernames)) {
            $usernames[] = $user->pengguna;
            Cache::store('file')->forever($onlineSetKey, $usernames);
        }

        Cache::store('file')->put($onlineAliveKey, (string) time(), $onlineTtlSeconds);
        Cache::store('file')->put($onlineNameKey, (string) ($user->name ?? $user->pengguna), $onlineTtlSeconds);

        // Inisialisasi heartbeat supaya request pertama setelah redirect tidak dianggap "stale"
        $key = 'browser_active:' . ($database ?: 'default') . ':' . $user->pengguna;
        Cache::store('file')->put($key, time(), now()->addMinutes(10));

        // Session cookie: otomatis hilang saat browser ditutup.
        $loginCookieMinutes = 0;
        $tenantCookieMinutes = 0;

        Cookie::queue('tenant_database', $database, $tenantCookieMinutes);
        Cookie::queue('login_user', $user->pengguna, $loginCookieMinutes);
        Cookie::queue('login_user_name', $user->name, $loginCookieMinutes);
        Cookie::queue('login_last_online', (string) ($user->last_online ?? ''), $loginCookieMinutes);

        return Inertia::location('/dashboard');
    }

    public function heartbeat(Request $request)
    {
        $database = $request->cookie('tenant_database')
            ?? $request->session()->get('tenant.database');
        $username = $request->cookie('login_user')
            ?? optional(Auth::user())->pengguna;
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
        $onlineSetKey = self::onlineUsersSetKey($database);
        $onlineAliveKey = self::onlineUserAliveKey($database, $username);
        $onlineNameKey = self::onlineUserNameKey($database, $username);
        $displayName = (string) ($request->cookie('login_user_name') ?: $username);

        // Replace Redis set with Cache array
        $usernames = Cache::store('file')->get($onlineSetKey, []);
        if (!in_array($username, $usernames)) {
            $usernames[] = $username;
            Cache::store('file')->forever($onlineSetKey, $usernames);
        }

        Cache::store('file')->put($onlineAliveKey, (string) time(), $onlineTtlSeconds);
        Cache::store('file')->put($onlineNameKey, $displayName, $onlineTtlSeconds);

        return response()->json(['ok' => true]);
    }

    public function logout(Request $request)
    {
        $database = $request->cookie('tenant_database')
            ?? $request->session()->get('tenant.database');
        $username = $request->cookie('login_user')
            ?? optional(Auth::user())->pengguna;
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

                $onlineSetKey = self::onlineUsersSetKey($database);
                $onlineAliveKey = self::onlineUserAliveKey($database, $username);
                $onlineNameKey = self::onlineUserNameKey($database, $username);

                // Replace Redis srem with Cache array filter
                $usernames = Cache::store('file')->get($onlineSetKey, []);
                $usernames = array_filter($usernames, fn($u) => $u !== $username);
                Cache::store('file')->forever($onlineSetKey, array_values($usernames));

                Cache::store('file')->forget($onlineAliveKey);
                Cache::store('file')->forget($onlineNameKey);
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
    }

    public function onlineUsers(Request $request)
    {
        $database = $request->cookie('tenant_database')
            ?? $request->session()->get('tenant.database');
        $allowed = config('tenants.databases', []);

        if (!$database || !in_array($database, $allowed, true)) {
            return response()->json(['count' => 0, 'users' => []]);
        }

        $onlineSetKey = self::onlineUsersSetKey($database);
        $usernames = Cache::store('file')->get($onlineSetKey, []);
        $aliveUsers = [];
        $staleUsers = [];

        foreach ($usernames as $username) {
            $aliveKey = self::onlineUserAliveKey($database, (string) $username);
            if (Cache::store('file')->has($aliveKey)) {
                $name = Cache::store('file')->get(self::onlineUserNameKey($database, (string) $username));
                $aliveUsers[] = $name ?: $username;
            } else {
                $staleUsers[] = $username;
            }
        }

        if (!empty($staleUsers)) {
            // Replace Redis srem with Cache array filter
            $usernames = array_filter($usernames, fn($u) => !in_array($u, $staleUsers));
            Cache::store('file')->forever($onlineSetKey, array_values($usernames));
        }

        sort($aliveUsers, SORT_NATURAL | SORT_FLAG_CASE);
        $users = collect($aliveUsers)->values();

        return response()->json([
            'count' => $users->count(),
            'users' => $users,
        ]);
    }

    public function debugUrl()
    {
        return [
            'app_url' => config('app.url'),
            'http_host' => $_SERVER['HTTP_HOST'] ?? 'not set',
            'request_host' => request()->getHost(),
            'request_port' => request()->getPort(),
            'full_url' => url('/dashboard'),
        ];
    }

    public function ping()
    {
        return response()->json(['ok' => true]);
    }

    public function pingDb(Request $request)
    {
        $database = $request->cookie('tenant_database')
            ?? $request->session()->get('tenant.database');
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
    }
}
