<?php

namespace App\Http\Middleware;

use App\Models\Pengguna;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticateFromCookie
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        if (Auth::check()) {
            return $next($request);
        }

        $username = $request->cookie('login_user');
        if (!$username) {
            return $next($request);
        }

        $user = Pengguna::where('pengguna', $username)->first();
        if ($user) {
            Auth::login($user);
        }

        return $next($request);
    }
}
