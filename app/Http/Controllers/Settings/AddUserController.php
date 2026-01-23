<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Pengguna;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AddUserController extends Controller
{
    /**
     * Show the add new user settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/add-user');
    }

    /**
     * Fetch users with server-side pagination and search.
     */
    public function data(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 5);
        $page = max(1, (int) $request->input('page', 1));
        $search = trim((string) $request->input('search', ''));

        $query = Pengguna::query()->select([
            'kd_user',
            'nm_user',
            'no_hp',
            'pengguna',
            'pass',
            'tingkat',
            'Sesi',
            'LastOnline',
        ]);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('kd_user', 'like', "%{$search}%")
                    ->orWhere('nm_user', 'like', "%{$search}%")
                    ->orWhere('pengguna', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();

        $useAll = $perPage === 'all';
        $pageSize = $useAll
            ? $total
            : (int) $perPage;

        $allowed = [5, 10, 25, 50];
        if (! $useAll && ! in_array($pageSize, $allowed, true)) {
            $pageSize = 5;
        }

        if (! $useAll) {
            $query
                ->orderBy('kd_user')
                ->offset(($page - 1) * $pageSize)
                ->limit($pageSize);
        } else {
            $query->orderBy('kd_user');
        }

        $users = $query
            ->get()
            ->map(static fn (Pengguna $user) => [
                'kd_user' => $user->kd_user,
                'nm_user' => $user->nm_user,
                'no_hp' => $user->no_hp,
                'pengguna' => $user->pengguna,
                'pass' => $user->pass,
                'tingkat' => $user->tingkat,
                'Sesi' => $user->getAttribute('Sesi'),
                'LastOnline' => $user->last_online,
            ]);

        $totalPages = $useAll || $pageSize === 0
            ? 1
            : (int) ceil($total / $pageSize);

        return response()->json([
            'data' => $users,
            'meta' => [
                'total' => $total,
                'per_page' => $useAll ? 'all' : $pageSize,
                'page' => $page,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    /**
     * Store a new user in tb_pengguna.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'max:255'],
            'level' => [
                'required',
                'string',
                'in:Admin,User-Marketing,User-Pembelian,User-Penjualan,User-Keuangan',
            ],
        ]);

        $maxId = DB::table('tb_pengguna')
            ->where('kd_user', 'like', 'USR%')
            ->selectRaw("MAX(CAST(SUBSTRING(kd_user, 4, 4) AS UNSIGNED)) as max_id")
            ->value('max_id');

        $nextId = str_pad((string) (((int) $maxId) + 1), 4, '0', STR_PAD_LEFT);
        $kdUser = 'USR'.$nextId;

        DB::table('tb_pengguna')->insert([
            'kd_user' => $kdUser,
            'nm_user' => $validated['name'],
            'pengguna' => $validated['username'],
            'no_hp' => $validated['phone'] ?? null,
            'pass' => $validated['password'],
            'tingkat' => $validated['level'],
            'Sesi' => 'T',
            'LastOnline' => now()->format('Y-m-d H:i:s'),
        ]);

        return redirect()
            ->route('settings.add-user')
            ->with('success', 'User berhasil ditambahkan.');
    }
}
