<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        if (!$user) {
            return back()->with('error', 'User tidak ditemukan.');
        }

        $currentUsername = $user->pengguna;

        \Illuminate\Support\Facades\DB::table('tb_pengguna')
            ->where('pengguna', $currentUsername)
            ->update([
                'nm_user' => $validated['name'],
                'no_hp' => $validated['phone'] ?? null,
                'pengguna' => $validated['username'],
            ]);

        $user->pengguna = $validated['username'];
        $user->nm_user = $validated['name'];
        $user->no_hp = $validated['phone'] ?? null;

        return to_route('profile.edit')
            ->with('success', 'Profil berhasil diperbarui.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $kdUser = $request->input('kd_user');
        $user = $request->user();

        if (!$kdUser && $user) {
            $kdUser = $user->kd_user ?? null;
        }

        if ($kdUser) {
            \Illuminate\Support\Facades\DB::table('tb_pengguna')
                ->where('kd_user', $kdUser)
                ->delete();
        }

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login')
            ->with('success', 'Akun berhasil dihapus.')
            ->withCookie(Cookie::forget('login_user'))
            ->withCookie(Cookie::forget('login_user_name'))
            ->withCookie(Cookie::forget('login_last_online'))
            ->withCookie(Cookie::forget('tenant_database'));
    }
}
