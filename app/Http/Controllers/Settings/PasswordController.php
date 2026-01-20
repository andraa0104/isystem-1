<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    /**
     * Show the user's password settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/password');
    }

    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required'],
            'password' => ['required'],
        ]);

        $user = $request->user();
        if (!$user) {
            return back()->with('error', 'User tidak ditemukan.');
        }

        $current = trim((string) ($user->pass ?? ''));
        if ($validated['current_password'] !== $current) {
            return back()->withErrors([
                'current_password' => 'Password saat ini tidak sesuai.',
            ]);
        }

        \Illuminate\Support\Facades\DB::table('tb_pengguna')
            ->where('pengguna', $user->pengguna)
            ->update([
                'pass' => $validated['password'],
            ]);

        return back()->with('success', 'Password berhasil diperbarui.');
    }
}
