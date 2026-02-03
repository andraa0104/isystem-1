<?php

namespace App\Http\Middleware;

use App\Models\Pengguna;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;

class AuthenticateFromCookie
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $timeoutSeconds = (int) env('BROWSER_ACTIVE_TIMEOUT_SECONDS', 120);
        $isStale = function (?string $username) use ($database, $timeoutSeconds): bool {
            if (!$username) {
                return true;
            }
            $key = 'browser_active:' . ($database ?: 'default') . ':' . $username;
            $lastSeen = Cache::store('file')->get($key);
            // Jika belum ada heartbeat sama sekali, anggap masih aktif dan biarkan request ini membuatnya.
            if (!$lastSeen) {
                Cache::store('file')->put($key, time(), now()->addMinutes(10));
                return false;
            }
            return (time() - (int) $lastSeen) > $timeoutSeconds;
        };

        // Jika session Laravel masih aktif tapi heartbeat sudah mati (tab/browser ditutup),
        // paksa logout supaya tidak "terlogin" saat browser dibuka lagi.
        if (Auth::check()) {
            $currentUsername = $request->user()?->getAuthIdentifier();
            if ($isStale($currentUsername)) {
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
            return $next($request);
        }

        if ($isStale($username)) {
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
