<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminTingkat
{
    /**
     * Allow only users with tingkat Admin.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $tingkat = $user?->tingkat ?? $user?->level ?? null;

        if (is_string($tingkat) && strtolower($tingkat) === 'admin') {
            return $next($request);
        }

        return redirect()
            ->route('profile.edit')
            ->with('error', 'Akses ditolak. Hanya Admin yang dapat membuka halaman ini.');
    }
}
