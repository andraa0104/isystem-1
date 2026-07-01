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

    private function movementWarehouseExpressions(): array
    {
        return [
            [
                'warehouse' => 'g1',
                'stock' => 'stok_g1',
                'price' => $this->firstExistingColumn('tb_barang', ['harga_stokg1', 'harga_g1', 'harga1']),
                'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok1', 'kategori_stok1', 'katagori_g1', 'kategori_g1', 'katagori1', 'kategori1']),
            ],
            [
                'warehouse' => 'g2',
                'stock' => 'stok_g2',
                'price' => $this->firstExistingColumn('tb_barang', ['harga_stokg2', 'harga_g2', 'harga2']),
                'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok2', 'kategori_stok2', 'katagori_g2', 'kategori_g2', 'katagori2', 'kategori2']),
            ],
            [
                'warehouse' => 'g3',
                'stock' => 'stok_g3',
                'price' => $this->firstExistingColumn('tb_barang', ['harga_stokg3', 'harga_g3', 'harga3']),
                'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok3', 'kategori_stok3', 'katagori_g3', 'kategori_g3', 'katagori3', 'kategori3']),
            ],
            [
                'warehouse' => 'g4',
                'stock' => 'stok_g4',
                'price' => $this->firstExistingColumn('tb_barang', ['harga_stokg4', 'harga_g4', 'harga4']),
                'category' => $this->firstExistingColumn('tb_barang', ['katagori_stok4', 'kategori_stok4', 'katagori_g4', 'kategori_g4', 'katagori4', 'kategori4']),
            ],
        ];
    }

    private function movementBaseQuery()
    {
        $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');

        $queries = collect($this->movementWarehouseExpressions())
            ->filter(fn (array $columns) => $columns['category'] !== null)
            ->map(function (array $columns) use ($codeColumn) {
                $priceColumn = $columns['price'];
                $priceExpression = $priceColumn
                    ? "coalesce(cast({$priceColumn} as decimal(65,4)), 0)"
                    : '0';

                return DB::table('tb_barang')
                    ->selectRaw("
                        {$codeColumn} as kd_material,
                        '{$columns['warehouse']}' as gudang,
                        coalesce(cast({$columns['stock']} as decimal(65,4)), 0) as stok,
                        {$priceExpression} as harga,
                        {$columns['category']} as kategori
                    ");
            })
            ->values();

        if ($queries->isEmpty()) {
            return null;
        }

        $query = $queries->shift();
        foreach ($queries as $unionQuery) {
            $query->unionAll($unionQuery);
        }

        return DB::query()->fromSub($query, 'movement');
    }

    private function movementMetricValue(string $category, string $metric, ?string $warehouse = null): int
    {
        $matcher = match ($category) {
            'fast' => 'fast',
            'slow' => 'slow',
            'dead' => 'dead',
            default => null,
        };

        if ($matcher === null || ! in_array($metric, ['stock', 'items', 'total'], true)) {
            abort(422, 'Metric tidak valid.');
        }

        $query = $this->movementBaseQuery();
        if ($query === null) {
            return 0;
        }

        $query->whereRaw('lower(coalesce(kategori, ?)) like ?', ['', "%{$matcher}%"]);
        if ($warehouse !== null) {
            $query->where('gudang', $warehouse);
        }

        if ($metric === 'items') {
            return (int) DB::query()
                ->fromSub(
                    $query->select('kd_material')->groupBy('kd_material'),
                    'category_items'
                )
                ->count();
        }

        return (int) match ($metric) {
            'stock' => $query->sum('stok'),
            'total' => $query->selectRaw('sum(stok * harga) as aggregate')->value('aggregate'),
        };
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

    public function movementMetric(Request $request)
    {
        $validated = $request->validate([
            'category' => ['required', 'string', 'in:fast,slow,dead'],
            'metric' => ['required', 'string', 'in:stock,items,total'],
            'warehouse' => ['nullable', 'string', 'in:g1,g2,g3,g4'],
        ]);

        return response()->json([
            'value' => $this->movementMetricValue(
                $validated['category'],
                $validated['metric'],
                $validated['warehouse'] ?? null
            ),
        ]);
    }

    public function warehouseSummary(Request $request)
    {
        $validated = $request->validate([
            'warehouse' => ['required', 'string', 'in:g1,g2,g3,g4'],
        ]);

        $query = $this->movementBaseQuery();
        if ($query === null) {
            return response()->json([
                'total' => ['stock' => 0, 'items' => 0, 'total' => 0],
                'categories' => [],
            ]);
        }

        $rows = $query
            ->where('gudang', $validated['warehouse'])
            ->whereRaw('lower(trim(coalesce(kategori, ?))) not in (?, ?)', ['', '', '0'])
            ->get();

        $categories = $rows
            ->groupBy(fn ($row) => trim((string) ($row->kategori ?? '')))
            ->map(function ($categoryRows, string $category) {
                return [
                    'key' => str($category)->lower()->slug('-')->toString(),
                    'label' => $category,
                    'stock' => (int) $categoryRows->sum(fn ($row) => (float) $row->stok),
                    'items' => $categoryRows->pluck('kd_material')->unique()->count(),
                    'total' => (int) $categoryRows->sum(fn ($row) => (float) $row->stok * (float) $row->harga),
                ];
            })
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return response()->json([
            'total' => [
                'stock' => (int) $rows->sum(fn ($row) => (float) $row->stok),
                'items' => $rows->pluck('kd_material')->unique()->count(),
                'total' => (int) $rows->sum(fn ($row) => (float) $row->stok * (float) $row->harga),
            ],
            'categories' => $categories,
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

    public function export(Request $request)
    {
        $filters = $request->validate([
            'warehouse' => ['nullable', 'in:all,g1,g2,g3,g4'],
            'category' => ['nullable', 'in:all,fast,slow,dead'],
            'stock' => ['nullable', 'in:all,highest,lowest,empty'],
        ]);
        $warehouse = $filters['warehouse'] ?? 'all';
        $category = $filters['category'] ?? 'all';
        $stockFilter = $filters['stock'] ?? 'all';
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

        $stockExpression = $warehouse === 'all'
            ? '(coalesce(cast(stok_g1 as decimal(65,4)), 0) + coalesce(cast(stok_g2 as decimal(65,4)), 0) + coalesce(cast(stok_g3 as decimal(65,4)), 0) + coalesce(cast(stok_g4 as decimal(65,4)), 0))'
            : 'coalesce(cast(stok_'.$warehouse.' as decimal(65,4)), 0)';

        $categoryColumns = collect($this->movementWarehouseExpressions())
            ->filter(fn (array $columns) => $warehouse === 'all' || $columns['warehouse'] === $warehouse)
            ->pluck('category')
            ->filter()
            ->values();

        $query = DB::table('tb_barang')
            ->selectRaw("
                {$codeColumn} as kd_material,
                {$nameColumn} as material,
                {$unitColumn} as unit,
                cast({$stockExpression} as signed) as stok,
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
            ");

        if ($category !== 'all' && $categoryColumns->isNotEmpty()) {
            $categoryNeedle = match ($category) {
                'fast' => 'fast',
                'slow' => 'slow',
                'dead' => 'dead',
            };
            $query->where(function ($categoryQuery) use ($categoryColumns, $categoryNeedle) {
                foreach ($categoryColumns as $column) {
                    $categoryQuery->orWhereRaw('lower(trim(coalesce('.$column.", ''))) like ?", ['%'.$categoryNeedle.'%']);
                }
            });
        }

        if ($stockFilter === 'empty') {
            $query->whereRaw("{$stockExpression} = 0");
        } elseif ($stockFilter === 'lowest') {
            $query->whereRaw("{$stockExpression} > 0")
                ->orderByRaw("{$stockExpression} asc");
        } elseif ($stockFilter === 'highest') {
            $query->orderByRaw("{$stockExpression} desc");
        }

        $materials = $query->orderBy($codeColumn)->get();

        return response()->view('exports.material', [
            'materials' => $materials,
            'warehouse' => $warehouse,
        ]);
    }

    public function inventorySummary(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:mis,mib,mibs'],
            'metric' => ['required', 'in:items,qty,total'],
        ]);
        $type = $validated['type'];
        $metric = $validated['metric'];

        if ($type === 'mis' || $type === 'mib') {
            $qtyColumn = $type;
            $totalColumn = 'harga_'.$type;
            $query = DB::table('tb_mi')->where($qtyColumn, '>', 0);
            $value = match ($metric) {
                'items' => $query->count(),
                'qty' => (float) $query->sum($qtyColumn),
                'total' => (float) $query->sum($totalColumn),
            };

            return response()->json(['value' => $value]);
        }

        $query = DB::table('tb_mib')
            ->whereRaw('coalesce(cast(qty as decimal(65,4)), 0) <> coalesce(cast(transfer as decimal(65,4)), 0)');

        $value = match ($metric) {
            'items' => $query->count(),
            'qty' => (float) $query->sum(DB::raw('coalesce(cast(qty as decimal(65,4)), 0) - coalesce(cast(transfer as decimal(65,4)), 0)')),
            'total' => (float) $query->sum(DB::raw('coalesce(cast(total_price as decimal(65,4)), 0)')),
        };

        return response()->json(['value' => $value]);
    }

    public function inventoryRows(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:mis,mib,mibs'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable'],
        ]);
        $type = $validated['type'];
        $search = trim((string) ($validated['search'] ?? ''));
        $page = max(1, (int) ($validated['page'] ?? 1));
        $perPageRaw = $validated['per_page'] ?? 5;
        $perPage = $perPageRaw === 'all' ? null : max(1, (int) $perPageRaw);

        if ($type === 'mis' || $type === 'mib') {
            $qtyColumn = $type;
            $totalColumn = 'harga_'.$type;
            $query = DB::table('tb_mi')->where($qtyColumn, '>', 0);
            if ($search !== '') {
                $query->where(function ($nested) use ($search) {
                    $nested->where('no_doc', 'like', '%'.$search.'%')
                        ->orWhere('ref_po', 'like', '%'.$search.'%')
                        ->orWhere('material', 'like', '%'.$search.'%');
                });
            }
            $query->select([
                'no_doc', 'doc_tgl', 'ref_po', 'material', 'qty', 'unit', 'price',
                DB::raw($totalColumn.' as total_price'),
                DB::raw($qtyColumn.' as balance_qty'),
            ]);
        } else {
            $query = DB::table('tb_mib')
                ->whereRaw('coalesce(cast(qty as decimal(65,4)), 0) <> coalesce(cast(transfer as decimal(65,4)), 0)');
            if ($search !== '') {
                $query->where(function ($nested) use ($search) {
                    $nested->where('no_doc', 'like', '%'.$search.'%')
                        ->orWhere('material', 'like', '%'.$search.'%');
                });
            }
            $query->select([
                'no_doc', 'material', 'qty', 'unit', 'price', 'total_price',
                DB::raw('coalesce(cast(qty as decimal(65,4)), 0) - coalesce(cast(transfer as decimal(65,4)), 0) as balance_qty'),
            ]);
        }

        $total = (clone $query)->count();
        $query->orderByDesc('no_doc');
        if ($perPage !== null) {
            $query->forPage($page, $perPage);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
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
