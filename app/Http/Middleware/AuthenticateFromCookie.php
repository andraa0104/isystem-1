<?php

namespace App\Http\Middleware;

use App\Models\Pengguna;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AuthenticateFromCookie
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $isGuestAllowedPath = function (Request $request): bool {
            if ($request->is('/')) {
                return true;
            }

            return $request->is([
                'login',
                'login-simple',
                'logout',
                'logout-simple',
                'heartbeat-simple',
                'up',
                'storage/*',
                'register',
                'forgot-password',
                'reset-password',
                'two-factor-challenge',
                'user/confirm-password',
                'user/confirmed-password-status',
                'email/*',
            ]);
        };

        $guestResponse = function (Request $request) {
            if ($request->header('X-Inertia')) {
                return Inertia::location('/login');
            }

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            return redirect('/login');
        };

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $timeoutSeconds = (int) env('BROWSER_ACTIVE_TIMEOUT_SECONDS', 120);
        $isStale = function (?string $username, bool $treatMissingAsActive) use ($database, $timeoutSeconds): bool {
            if (!$username) {
                return true;
            }
            $key = 'browser_active:' . ($database ?: 'default') . ':' . $username;
            $lastSeen = Cache::store('file')->get($key);
            if (!$lastSeen) {
                if ($treatMissingAsActive) {
                    Cache::store('file')->put($key, time(), now()->addMinutes(10));
                    return false;
                }
                return true;
            }
            return (time() - (int) $lastSeen) > $timeoutSeconds;
        };

        // Jika session Laravel masih aktif tapi heartbeat sudah mati (tab/browser ditutup),
        // paksa logout supaya tidak "terlogin" saat browser dibuka lagi.
        if (Auth::check()) {
            $currentUsername = $request->user()?->getAuthIdentifier();
            if ($isStale($currentUsername, true)) {
                $this->updateLastOnline($database, $currentUsername);
                Auth::logout();
                try {
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();
                } catch (\Throwable) {
                    // ignore
                }
                Cookie::queue(Cookie::forget('login_user'));
                Cookie::queue(Cookie::forget('login_user_name'));
                Cookie::queue(Cookie::forget('login_last_online'));
            }
            // Sentuh aktivitas supaya navigasi normal tidak memicu logout.
            if ($currentUsername) {
                $key = 'browser_active:' . ($database ?: 'default') . ':' . $currentUsername;
                Cache::store('file')->put($key, time(), now()->addMinutes(10));
            }
            return $next($request);
        }

        $username = $request->cookie('login_user');
        if (!$username) {
            if (!$isGuestAllowedPath($request)) {
                return $guestResponse($request);
            }
            return $next($request);
        }

        if ($isStale($username, false)) {
            $this->updateLastOnline($database, $username);
            $response = $next($request);
            Cookie::queue(Cookie::forget('login_user'));
            Cookie::queue(Cookie::forget('login_user_name'));
            Cookie::queue(Cookie::forget('login_last_online'));
            return $response;
        }

        $user = Pengguna::where('pengguna', $username)->first();
        if ($user) {
            Auth::login($user);
        } elseif (!$isGuestAllowedPath($request)) {
            return $guestResponse($request);
        }

        return $next($request);
    }

    private function updateLastOnline(?string $database, ?string $username): void
    {
        if (!$database || !$username) {
            return;
        }

        $allowed = config('tenants.databases', []);
        if (!in_array($database, $allowed, true)) {
            return;
        }

        $connection = config('tenants.connection', config('database.default'));
        config(["database.connections.$connection.database" => $database]);

        $column = config('tenants.last_online_column', 'LastOnline');
        try {
            DB::connection($connection)
                ->table('tb_pengguna')
                ->where('pengguna', $username)
                ->update([
                    $column => now('Asia/Singapore'),
                    'Sesi' => 'T',
                ]);
        } catch (\Throwable) {
            // ignore
        }
    }
}
