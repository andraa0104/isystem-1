<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Pengguna;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PrivilegeAccessController extends Controller
{
    /**
     * Show the privilege access settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/privilege-access');
    }

    /**
     * Fetch users for privilege assignment.
     */
    public function data(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 5);
        $page = max(1, (int) $request->input('page', 1));

        $query = Pengguna::query()->select([
            'kd_user',
            'nm_user',
            'tingkat',
        ]);

        $total = (clone $query)->count();
        $useAll = $perPage === 'all';
        $pageSize = $useAll ? $total : (int) $perPage;

        $allowed = [5, 10, 25, 50];
        if (! $useAll && ! in_array($pageSize, $allowed, true)) {
            $pageSize = 5;
        }

        if (! $useAll) {
            $query
                ->orderBy('nm_user')
                ->offset(($page - 1) * $pageSize)
                ->limit($pageSize);
        } else {
            $query->orderBy('nm_user');
        }

        $users = $query
            ->get()
            ->map(static fn (Pengguna $user) => [
                'kd_user' => $user->kd_user,
                'nm_user' => $user->nm_user,
                'tingkat' => $user->tingkat,
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
     * Get saved privileges for a user.
     */
    public function privileges(Request $request): JsonResponse
    {
        $kdUser = (string) $request->query('kd_user', '');
        if ($kdUser === '') {
            return response()->json([
                'data' => [],
            ]);
        }

        $all = $this->loadPrivileges();
        $userPrivileges = $all['users'][$kdUser]['menus'] ?? [];

        return response()->json([
            'data' => $userPrivileges,
        ]);
    }

    /**
     * Save privileges for a user.
     */
    public function storePrivileges(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kd_user' => ['required', 'string'],
            'menus' => ['required', 'array'],
        ]);

        $all = $this->loadPrivileges();
        $all['users'][$validated['kd_user']] = [
            'menus' => $validated['menus'],
            'updated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $this->savePrivileges($all);

        return response()->json([
            'message' => 'Privilege berhasil disimpan.',
        ]);
    }

    private function loadPrivileges(): array
    {
        $path = 'privileges.json';
        if (!Storage::disk('local')->exists($path)) {
            return ['users' => []];
        }

        $raw = Storage::disk('local')->get($path);
        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            return ['users' => []];
        }

        return $decoded + ['users' => []];
    }

    private function savePrivileges(array $data): void
    {
        Storage::disk('local')->put(
            'privileges.json',
            json_encode($data, JSON_PRETTY_PRINT)
        );
    }
}
