<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Throwable;

class MaterialController
{
    private array $columnCache = [];

    private function resolveColumn(string $table, array $candidates, string $fallback): string
    {
        if (!isset($this->columnCache[$table])) {
            $columns = DB::select('SHOW COLUMNS FROM '.$table);
            $this->columnCache[$table] = array_map(
                static fn ($column) => $column->Field ?? '',
                $columns
            );
        }

        foreach ($candidates as $candidate) {
            foreach ($this->columnCache[$table] as $column) {
                if ($column !== '' && strcasecmp($column, $candidate) === 0) {
                    return $column;
                }
            }
        }

        return $fallback;
    }

    private function optionalColumnSelect(string $table, array $candidates, string $alias, string $default = "''"): string
    {
        foreach ($candidates as $candidate) {
            if (Schema::hasColumn($table, $candidate)) {
                return "{$candidate} as {$alias}";
            }
        }

        return "{$default} as {$alias}";
    }

    private function optionalNumberColumnSelect(string $table, array $candidates, string $alias): string
    {
        foreach ($candidates as $candidate) {
            if (Schema::hasColumn($table, $candidate)) {
                return "cast(coalesce(cast({$candidate} as decimal(65,4)), 0) as signed) as {$alias}";
            }
        }

        return "0 as {$alias}";
    }

    private function firstExistingColumn(string $table, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (Schema::hasColumn($table, $candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    public function index()
    {
        // Inertia::lazy() memastikan kerangka halaman (UI) dirender secara instan,
        // sementara pengambilan data ribuan material dikerjakan menyusul di background.
        return Inertia::render('master-data/material/index', [
            'materials' => Inertia::lazy(function () {
                $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
                $nameColumn = $this->resolveColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
                $unitColumn = $this->resolveColumn('tb_barang', ['unit', 'satuan'], 'unit');
                $hargaG1 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg1', 'harga_g1', 'harga1'], 'harga_stokg1');
                $hargaG2 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg2', 'harga_g2', 'harga2'], 'harga_stokg2');
                $hargaG3 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg3', 'harga_g3', 'harga3'], 'harga_stokg3');
                $hargaG4 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg4', 'harga_g4', 'harga4'], 'harga_stokg4');
                $kategoriG1 = $this->optionalColumnSelect('tb_barang', ['katagori_stok1', 'kategori_stok1', 'katagori_g1', 'kategori_g1', 'katagori1', 'kategori1'], 'kategori_stok1');
                $kategoriG2 = $this->optionalColumnSelect('tb_barang', ['katagori_stok2', 'kategori_stok2', 'katagori_g2', 'kategori_g2', 'katagori2', 'kategori2'], 'kategori_stok2');
                $kategoriG3 = $this->optionalColumnSelect('tb_barang', ['katagori_stok3', 'kategori_stok3', 'katagori_g3', 'kategori_g3', 'katagori3', 'kategori3'], 'kategori_stok3');
                $kategoriG4 = $this->optionalColumnSelect('tb_barang', ['katagori_stok4', 'kategori_stok4', 'katagori_g4', 'kategori_g4', 'katagori4', 'kategori4'], 'kategori_stok4');

                return DB::table('tb_barang')
                    ->selectRaw("
                        {$codeColumn} as kd_material,
                        {$nameColumn} as material,
                        {$unitColumn} as unit,
                        cast(coalesce(cast(stok_g1 as decimal(65,4)), 0) as signed) as stok_g1,
                        {$hargaG1},
                        {$kategoriG1},
                        cast(coalesce(cast(stok_g2 as decimal(65,4)), 0) as signed) as stok_g2,
                        {$hargaG2},
                        {$kategoriG2},
                        cast(coalesce(cast(stok_g3 as decimal(65,4)), 0) as signed) as stok_g3,
                        {$hargaG3},
                        {$kategoriG3},
                        cast(coalesce(cast(stok_g4 as decimal(65,4)), 0) as signed) as stok_g4,
                        {$hargaG4},
                        {$kategoriG4},
                        cast((
                            coalesce(cast(stok_g1 as decimal(65,4)), 0) +
                            coalesce(cast(stok_g2 as decimal(65,4)), 0) +
                            coalesce(cast(stok_g3 as decimal(65,4)), 0) +
                            coalesce(cast(stok_g4 as decimal(65,4)), 0)
                        ) as signed) as stok
                    ")
                    ->orderBy($codeColumn)
                    ->get();
            }),
            'materialCount' => Inertia::lazy(function () {
                return DB::table('tb_barang')->count();
            }),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'material' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:100'],
            'gudang' => ['nullable', 'string', 'in:g1,g2,g3,g4'],
            'kategori' => ['nullable', 'string', 'in:FAST MOVING,SLOW MOVING,DEAD STOK'],
            'stok' => ['nullable', 'numeric', 'min:0'],
        ]);

        $stok = (int) ($validated['stok'] ?? 0);
        $selectedWarehouse = $validated['gudang'] ?? null;
        $selectedCategory = $validated['kategori'] ?? null;

        if ($stok > 0 && (!$selectedWarehouse || !$selectedCategory)) {
            $messages = [];
            if (!$selectedWarehouse) {
                $messages['gudang'] = 'Gudang wajib dipilih jika stok lebih dari 0.';
            }
            if (!$selectedCategory) {
                $messages['kategori'] = 'Kategori wajib dipilih jika stok lebih dari 0.';
            }

            throw ValidationException::withMessages($messages);
        }

        $pembuat = $request->user()->name
            ?? $request->cookie('login_user')
            ?? $request->cookie('login_user_name')
            ?? null;
            
        // Catatan: Query max() tidak di-cache untuk menghindari duplikasi ID saat input bersama-sama
        $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
        $nameColumn = $this->resolveColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
        $unitColumn = $this->resolveColumn('tb_barang', ['unit', 'satuan'], 'unit');
        $lastKdMaterial = DB::table('tb_barang')->max($codeColumn);
        $nextKdMaterial = $lastKdMaterial
            ? (string) (((int) $lastKdMaterial) + 1)
            : '1000000001';
        if (strlen($nextKdMaterial) < 10) {
            $nextKdMaterial = '1'.str_pad(substr($nextKdMaterial, 1), 9, '0', STR_PAD_LEFT);
        }

        try {
            $insertData = [
                $codeColumn => $nextKdMaterial,
                $nameColumn => $validated['material'],
                $unitColumn => $validated['unit'],
                'stok_g1' => 0,
                'stok_g2' => 0,
                'stok_g3' => 0,
                'stok_g4' => 0,
            ];

            $warehouseColumns = [
                'g1' => [
                    'stock' => 'stok_g1',
                    'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok1', 'kategori_stok1', 'katagori_g1', 'kategori_g1', 'katagori1', 'kategori1']),
                ],
                'g2' => [
                    'stock' => 'stok_g2',
                    'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok2', 'kategori_stok2', 'katagori_g2', 'kategori_g2', 'katagori2', 'kategori2']),
                ],
                'g3' => [
                    'stock' => 'stok_g3',
                    'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok3', 'kategori_stok3', 'katagori_g3', 'kategori_g3', 'katagori3', 'kategori3']),
                ],
                'g4' => [
                    'stock' => 'stok_g4',
                    'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok4', 'kategori_stok4', 'katagori_g4', 'kategori_g4', 'katagori4', 'kategori4']),
                ],
            ];
            foreach ([
                'harga_stokg1' => 0.00,
                'harga_stokg2' => 0.00,
                'harga_stokg3' => 0.00,
                'harga_stokg4' => 0.00,
            ] as $column => $value) {
                if (Schema::hasColumn('tb_barang', $column)) {
                    $insertData[$column] = $value;
                }
            }
            foreach ($warehouseColumns as $columns) {
                if ($columns['category']) {
                    $insertData[$columns['category']] = 0;
                }
            }

            if ($selectedWarehouse && isset($warehouseColumns[$selectedWarehouse])) {
                $insertData[$warehouseColumns[$selectedWarehouse]['stock']] = $stok;
                if ($selectedCategory && $warehouseColumns[$selectedWarehouse]['category']) {
                    $insertData[$warehouseColumns[$selectedWarehouse]['category']] = $selectedCategory;
                }
            }
            foreach ([
                'tgl_buat' => Carbon::now()->toDateString(),
                'pembuat' => $pembuat,
            ] as $column => $value) {
                if (Schema::hasColumn('tb_barang', $column)) {
                    $insertData[$column] = $value;
                }
            }

            DB::table('tb_barang')->insert($insertData);

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
        $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
        $nameColumn = $this->resolveColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
        $unitColumn = $this->resolveColumn('tb_barang', ['unit', 'satuan'], 'unit');
        $hargaG1 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg1', 'harga_g1', 'harga1'], 'harga_stokg1');
        $hargaG2 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg2', 'harga_g2', 'harga2'], 'harga_stokg2');
        $hargaG3 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg3', 'harga_g3', 'harga3'], 'harga_stokg3');
        $hargaG4 = $this->optionalNumberColumnSelect('tb_barang', ['harga_stokg4', 'harga_g4', 'harga4'], 'harga_stokg4');
        $kategoriG1 = $this->optionalColumnSelect('tb_barang', ['katagori_stok1', 'kategori_stok1', 'katagori_g1', 'kategori_g1', 'katagori1', 'kategori1'], 'kategori_stok1');
        $kategoriG2 = $this->optionalColumnSelect('tb_barang', ['katagori_stok2', 'kategori_stok2', 'katagori_g2', 'kategori_g2', 'katagori2', 'kategori2'], 'kategori_stok2');
        $kategoriG3 = $this->optionalColumnSelect('tb_barang', ['katagori_stok3', 'kategori_stok3', 'katagori_g3', 'kategori_g3', 'katagori3', 'kategori3'], 'kategori_stok3');
        $kategoriG4 = $this->optionalColumnSelect('tb_barang', ['katagori_stok4', 'kategori_stok4', 'katagori_g4', 'kategori_g4', 'katagori4', 'kategori4'], 'kategori_stok4');

        $materials = DB::table('tb_barang')
            ->selectRaw("
                {$codeColumn} as kd_material,
                {$nameColumn} as material,
                {$unitColumn} as unit,
                cast((
                    coalesce(cast(stok_g1 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g2 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g3 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g4 as decimal(65,4)), 0)
                ) as signed) as stok,
                stok_g1,
                {$hargaG1},
                {$kategoriG1},
                stok_g2,
                {$hargaG2},
                {$kategoriG2},
                stok_g3,
                {$hargaG3},
                {$kategoriG3},
                stok_g4,
                {$hargaG4},
                {$kategoriG4}
            ")
            ->orderBy($codeColumn)
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
            'remark' => ['nullable', 'string', 'in:FAST MOVING,SLOW MOVING,DEAD STOK'],
        ]);

        $stok = (int) ($validated['stok'] ?? 0);

        try {
            $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
            $nameColumn = $this->resolveColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
            $unitColumn = $this->resolveColumn('tb_barang', ['unit', 'satuan'], 'unit');

            $updateData = [
                $nameColumn => $validated['material'],
                $unitColumn => $validated['unit'],
                'stok_g1' => $stok,
            ];
            if (Schema::hasColumn('tb_barang', 'katagori_stok1')) {
                $updateData['katagori_stok1'] = $validated['remark'] ?? null;
            } elseif (Schema::hasColumn('tb_barang', 'kategori_stok1')) {
                $updateData['kategori_stok1'] = $validated['remark'] ?? null;
            }

            DB::table('tb_barang')
                ->where($codeColumn, $kdMaterial)
                ->update($updateData);

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
            $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');

            DB::table('tb_barang')
                ->where($codeColumn, $kdMaterial)
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
