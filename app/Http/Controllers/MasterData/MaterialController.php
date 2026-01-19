<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class MaterialController
{
    public function index()
    {
        $materials = DB::table('tb_material')
            ->select(
                'kd_material',
                'material',
                'unit',
                'stok',
                'harga',
                'remark'
            )
            ->orderBy('kd_material')
            ->get();

        return Inertia::render('master-data/material/index', [
            'materials' => $materials,
            'materialCount' => $materials->count(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'material' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:100'],
            'stok' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string', 'max:255'],
        ]);

        $stok = (int) ($validated['stok'] ?? 0);
        $pembuat = $request->user()->name
            ?? $request->cookie('login_user')
            ?? $request->cookie('login_user_name')
            ?? null;
        $lastKdMaterial = DB::table('tb_material')->max('kd_material');
        $nextKdMaterial = $lastKdMaterial
            ? (string) (((int) $lastKdMaterial) + 1)
            : '1000000001';
        if (strlen($nextKdMaterial) < 10) {
            $nextKdMaterial = '1'.str_pad(substr($nextKdMaterial, 1), 9, '0', STR_PAD_LEFT);
        }

        try {
            DB::table('tb_material')->insert([
                'kd_material' => $nextKdMaterial,
                'material' => $validated['material'],
                'unit' => $validated['unit'],
                'stok' => $stok,
                'harga' => 0,
                'rest_stock' => $stok,
                'remark' => $validated['remark'] ?? null,
                'tgl_buat' => Carbon::now()->toDateString(),
                'pembuat' => $pembuat,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menyimpan data material.');
        }

        return redirect()
            ->route('master-data.material.index')
            ->with('success', 'Data material berhasil disimpan.');
    }

    public function export()
    {
        $materials = DB::table('tb_material')
            ->select(
                'kd_material',
                'material',
                'unit',
                'stok',
                'harga',
                'remark',
                'rest_stock',
                'tgl_buat',
                'pembuat'
            )
            ->orderBy('kd_material')
            ->get();

        return response()->view('exports.material', [
            'materials' => $materials,
        ]);
    }

    public function update(Request $request, string $kdMaterial)
    {
        $validated = $request->validate([
            'material' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:100'],
            'stok' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string', 'max:255'],
        ]);

        $stok = (int) ($validated['stok'] ?? 0);

        try {
            DB::table('tb_material')
                ->where('kd_material', $kdMaterial)
                ->update([
                    'material' => $validated['material'],
                    'unit' => $validated['unit'],
                    'stok' => $stok,
                    'rest_stock' => $stok,
                    'remark' => $validated['remark'] ?? null,
                ]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal memperbarui data material.');
        }

        return redirect()
            ->route('master-data.material.index')
            ->with('success', 'Data material berhasil diperbarui.');
    }

    public function destroy(string $kdMaterial)
    {
        try {
            DB::table('tb_material')
                ->where('kd_material', $kdMaterial)
                ->delete();
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Gagal menghapus data material.');
        }

        return redirect()
            ->route('master-data.material.index')
            ->with('success', 'Data material berhasil dihapus.');
    }
}
