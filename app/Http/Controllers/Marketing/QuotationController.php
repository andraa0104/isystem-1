<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use App\Services\Marketing\QuotationDss;

class QuotationController
{
    private array $columnCache = [];

    private function valueOrSpace(mixed $value): string
    {
        if ($value === null) {
            return ' ';
        }

        $text = trim((string) $value);

        return $text === '' ? ' ' : $text;
    }

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

    private function wrapColumn(string $column): string
    {
        return '`'.str_replace('`', '``', $column).'`';
    }

    public function getLastPrice(Request $request)
    {
        $materialName = $request->query('material');

        if (!$materialName) {
            return response()->json(['harga' => 0]);
        }

        try {
            $lastRecord = DB::table('tb_invin')
                ->where('mat', 'LIKE', '%' . $materialName . '%')
                ->orderBy('id_invin', 'desc')
                ->first();

            return response()->json([
                'harga' => $lastRecord ? round($lastRecord->harga) : 0
            ]);
        } catch (\Exception $e) {
            \Log::error('Gagal mengambil harga terakhir: ' . $e->getMessage());
            
            return response()->json(['harga' => 0, 'message' => 'Terjadi kesalahan pada database'], 500);
        }
    }
    
    public function details($noPenawaran)
    {
        $detailNo = trim($noPenawaran);
    
        $details = DB::table('tb_penawarandetail')
            ->where('No_Penawaran', $detailNo)
            ->get();
        
        // Tambahkan log untuk memastikan data ditemukan di server
        \Log::info("Fetching details for $detailNo: " . $details->count() . " records found.");
    
        return response()->json(['details' => $details]);
    }
    public function destroy(Request $request, $noPenawaran)
    {
        $noPenawaran = trim((string) $noPenawaran);
        if ($noPenawaran === '') {
            return response()->json(['message' => 'No penawaran tidak valid.'], 400);
        }

        try {
            DB::transaction(function () use ($noPenawaran) {
                DB::table('tb_penawarandetail')
                    ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                    ->delete();

                DB::table('tb_penawaran')
                    ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                    ->delete();
            });

            Cache::tags(['quotation_data'])->flush();

        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json(['message' => 'Data quotation berhasil dihapus.']);
    }

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        return Inertia::render('marketing/quotation/index', [
            'penawaran' => [],
            'penawaranDetail' => [],
            'detailNo' => null,
            'period' => $period,
        ]);
    }

    public function data(Request $request)
    {
        $period = $request->query('period', 'today');
        $search = trim((string) $request->query('search', ''));
        
        $penawaran = $this->getPenawaranQuery($period, $search)->get();
    
        return response()->json([
            'penawaran' => $penawaran,
        ]);
    }

    private function getPenawaranQuery($period, string $search = '')
    {
        // Gunakan nama kolom yang sudah dipastikan ada (hardcode)
        $query = DB::table('tb_penawaran as p')
            ->select(
                'p.No_penawaran',
                'p.Tgl_Penawaran',
                DB::raw('COALESCE(p.Tgl_Posting) as Tgl_Posting'),
                'p.Customer',
                'p.Alamat',
                'p.Telp',
                'p.Fax',
                'p.Email',
                'p.Attend',
                'p.Validity',
                'p.Delivery',
                'p.Franco',
                'p.Note1',
                'p.Note2',
                'p.Note3',
                DB::raw('1 as can_delete')
            );
    
        $now = Carbon::now();
    
        if ($period === 'today') {
            $todayDate = $now->format('Y-m-d');
            $todayDot = $now->format('d.m.Y');
            
            $query->where(function($q) use ($todayDate, $todayDot) {
                $q->whereDate('p.Tgl_Posting', $todayDate)
                  ->orWhere('p.Tgl_Posting', 'like', $todayDate . '%')
                  ->orWhere('p.Tgl_Posting', 'like', '%' . $todayDot . '%');
            });
        } elseif ($period === 'week') {
            $query->whereBetween('p.Tgl_Posting', [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString()
            ]);
        } elseif ($period === 'month') {
            $query->whereMonth('p.Tgl_Posting', $now->month)
                  ->whereYear('p.Tgl_Posting', $now->year);
        } elseif ($period === 'year') {
            $query->whereYear('p.Tgl_Posting', $now->year);
        } elseif ($period === 'all') {
            // tidak ada filter tambahan
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('p.No_penawaran', 'like', '%' . $search . '%')
                    ->orWhere('p.Customer', 'like', '%' . $search . '%')
                    ->orWhere('p.Alamat', 'like', '%' . $search . '%')
                    ->orWhere('p.Attend', 'like', '%' . $search . '%');
            });
        }
    
        return $query->orderBy('p.Tgl_Posting', 'desc')
            ->orderBy('p.No_Penawaran', 'desc');
    }


    // ==========================================
    // FUNGSI MATERIALS DETAILS DENGAN PAGINATION
    // ==========================================
    public function getQuotationMaterialsDetails(Request $request)
    {
        \Log::info('getQuotationMaterialsDetails called', $request->all());
        
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 5);
            $search = trim($request->query('search', ''));
    
            \Log::info("Params: page=$page, perPage=$perPage, search=$search");
    
            // Cek apakah tabel ada
            if (!DB::connection()->getSchemaBuilder()->hasTable('tb_penawarandetail')) {
                throw new \Exception('Tabel tb_penawarandetail tidak ditemukan');
            }
    
            // Cek kolom
            $columns = DB::getSchemaBuilder()->getColumnListing('tb_penawarandetail');
            \Log::info('Columns in tb_penawarandetail: ', $columns);
    
            // Query sederhana tanpa alias
            $query = DB::table('tb_penawarandetail')
                ->select('ID', 'No_Penawaran', 'Material', 'Qty', 'Satuan', 'Harga', 'Harga_Modal as Harga_modal');
    
            if ($search !== '') {
                $query->where(function($q) use ($search) {
                    $q->where('No_Penawaran', 'LIKE', '%' . $search . '%')
                        ->orWhere('Material', 'LIKE', "%{$search}%");
                });
            }
    
            $query->orderBy('ID', 'desc');
    
            // Gunakan paginate manual untuk menghindari bug
            $total = $query->count();
            $offset = ($page - 1) * $perPage;
            $items = $query->offset($offset)->limit($perPage)->get();
    
            // Tambahkan can_delete
            $items = $items->map(function($item) {
                $item->can_delete = 1;
                $item->id_detail = $item->ID;
                return $item;
            });
    
            return response()->json([
                'materials' => $items,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error in getQuotationMaterialsDetails: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json([
                'error' => 'Terjadi kesalahan: ' . $e->getMessage()
            ], 500);
        }
    }
 
    public function header($noPenawaran)
    {
        $header = DB::table('tb_penawaran')
            ->where('No_Penawaran', trim($noPenawaran))
            ->first();
    
        if (!$header) {
            return response()->json(['error' => 'Not found'], 404);
        }
    
        return response()->json($header);
    }
    
    public function create()
    {
        return Inertia::render('marketing/quotation/create', [
            'customers' => [],
            'materials' => [],
        ]);
    }

    public function customers()
    {
        $search = trim((string) request()->query('search', ''));
        $page = max(1, (int) request()->query('page', 1));
        $pageSizeRaw = request()->query('pageSize', 5);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $cacheKey = 'quotation_customers_' . md5(json_encode([
            'search' => $search,
            'page' => $page,
            'pageSize' => $pageSizeRaw,
        ]));

        $data = Cache::tags(['customer_data'])->remember($cacheKey, 86400, function () use ($search, $page, $pageSize) {
            $query = DB::table('tb_cs')
                ->select(
                    'kd_cs as kd_cs',
                    'nm_cs as nm_cs',
                    'Attnd as attnd',
                    'alamat_cs as alamat_cs',
                    'telp_cs as telp_cs',
                    'fax_cs as fax_cs'
                );

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('kd_cs', 'like', '%' . $search . '%')
                        ->orWhere('nm_cs', 'like', '%' . $search . '%')
                        ->orWhere('Attnd', 'like', '%' . $search . '%')
                        ->orWhere('alamat_cs', 'like', '%' . $search . '%')
                        ->orWhere('telp_cs', 'like', '%' . $search . '%');
                });
            }

            $total = (clone $query)->count();
            $query->orderBy('nm_cs');

            if ($pageSize !== 'all') {
                $query->forPage($page, $pageSize);
            }

            return [
                'customers' => $query->get(),
                'total' => $total,
            ];
        });

        return response()->json($data);
    }

    public function materials()
    {
        $search = trim((string) request()->query('search', ''));
        $page = max(1, (int) request()->query('page', 1));
        $pageSizeRaw = request()->query('pageSize', 5);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $cacheKey = 'quotation_materials_' . md5(json_encode([
            'search' => $search,
            'page' => $page,
            'pageSize' => $pageSizeRaw,
        ]));

        $data = Cache::tags(['material_data'])->remember($cacheKey, 86400, function () use ($search, $page, $pageSize) {
            $query = DB::table('tb_material')
                ->select(
                    'Material as material',
                    'Unit as unit',
                    'Stok as stok',
                    'Remark as remark'
                );

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('Material', 'like', '%' . $search . '%')
                        ->orWhere('Unit', 'like', '%' . $search . '%')
                        ->orWhere('Remark', 'like', '%' . $search . '%');
                });
            }

            $total = (clone $query)->count();
            $query->orderBy('Material');

            if ($pageSize !== 'all') {
                $query->forPage($page, $pageSize);
            }

            return [
                'materials' => $query->get(),
                'total' => $total,
            ];
        });

        return response()->json($data);
    }

    public function edit($noPenawaran)
    {
        $quotation = Cache::tags(['quotation_data'])->remember('quotation_header_' . $noPenawaran, 86400, function () use ($noPenawaran) {
            return DB::table('tb_penawaran')
                ->select(
                    'No_penawaran', 'Tgl_penawaran', 'Tgl_Posting', 'Customer', 'Alamat',
                    'Telp', 'Fax', 'Email', 'Attend', 'Payment', 'Validity',
                    'Delivery', 'Franco', 'Note1', 'Note2', 'Note3'
                )
                ->where('No_penawaran', $noPenawaran)
                ->first();
        });

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $quotationDetails = Cache::tags(['quotation_data'])->remember('quotation_details_' . $noPenawaran, 86400, function () use ($noPenawaran) {
            $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
            $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
            $hargaColumn = $this->resolveColumn('tb_penawarandetail', ['Harga', 'harga'], 'Harga');

            return DB::table('tb_penawarandetail')
                ->selectRaw(
                    'ID, ID as id, ' .
                    $this->wrapColumn($noPenawaranColumn).' as No_penawaran, ' .
                    $this->wrapColumn($noPenawaranColumn).' as no_penawaran, ' .
                    'Material, Material as material, ' .
                    $this->wrapColumn($hargaColumn).' as Harga, ' .
                    $this->wrapColumn($hargaColumn).' as harga_penawaran, ' .
                    'Qty, Qty as quantity, ' .
                    'Satuan, Satuan as satuan, ' .
                    $this->wrapColumn($hargaModalColumn).' as Harga_modal, ' .
                    $this->wrapColumn($hargaModalColumn).' as harga_modal, ' .
                    'Margin, Margin as margin, ' .
                    'Remark, Remark as remark'
                )
                ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
                ->orderBy('ID')
                ->get();
        });

        return Inertia::render('marketing/quotation/edit', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'customers' => [],
            'materials' => [],
        ]);
    }

    public function print(Request $request, $noPenawaran)
    {
        $data = Cache::tags(['quotation_data'])->remember('quotation_print_data_' . $noPenawaran, 86400, function () use ($noPenawaran) {
            $quotation = DB::table('tb_penawaran')
                ->select(
                    'No_penawaran', 'Tgl_penawaran', 'Customer', 'Alamat', 'Telp',
                    'Email', 'Attend', 'Payment', 'Validity', 'Delivery', 'Franco'
                )
                ->where('No_penawaran', $noPenawaran)
                ->first();

            if (!$quotation) return null;

            $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
            $hargaColumn = $this->resolveColumn('tb_penawarandetail', ['Harga', 'harga'], 'Harga');
            $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');

            $quotationDetails = DB::table('tb_penawarandetail')
                ->selectRaw(
                    'ID, ID as id, '.
                    $this->wrapColumn($noPenawaranColumn).' as No_penawaran, '.
                    $this->wrapColumn($noPenawaranColumn).' as no_penawaran, '.
                    'Material, Material as material, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaModalColumn)
                    .' ELSE '.$this->wrapColumn($hargaColumn).' END as Harga, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaModalColumn)
                    .' ELSE '.$this->wrapColumn($hargaColumn).' END as harga_penawaran, '.
                    'Qty, Qty as quantity, '.
                    'Satuan, Satuan as satuan, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaColumn)
                    .' ELSE '.$this->wrapColumn($hargaModalColumn).' END as Harga_modal, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaColumn)
                    .' ELSE '.$this->wrapColumn($hargaModalColumn).' END as harga_modal, '.
                    'Margin, Margin as margin, '.
                    'Remark, Remark as remark'
                )
                ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
                ->orderBy('ID')
                ->get();

            return ['quotation' => $quotation, 'quotationDetails' => $quotationDetails];
        });

        if (!$data) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $database = $request->session()->get('tenant.database') ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
        }
        $companyConfig = $lookupKey ? config("tenants.companies.$lookupKey", []) : [];
        $fallbackName = $lookupKey ? config("tenants.labels.$lookupKey", $lookupKey) : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('marketing/quotation/print', [
            'quotation' => $data['quotation'],
            'quotationDetails' => $data['quotationDetails'],
            'company' => $company,
        ]);
    }

    public function update(Request $request, $noPenawaran)
    {
        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $exists = DB::table('tb_penawaran')
            ->where('No_penawaran', $noPenawaran)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPenawaran) {
                DB::table('tb_penawaran')
                    ->where('No_penawaran', $noPenawaran)
                    ->update([
                        'Tgl_penawaran' => $request->input('tgl_penawaran') ?? Carbon::today()->toDateString(),
                        'Customer' => $this->valueOrSpace($request->input('customer')),
                        'Alamat' => $this->valueOrSpace($request->input('alamat')),
                        'Telp' => $this->valueOrSpace($request->input('telp')),
                        'Fax' => $this->valueOrSpace($request->input('fax')),
                        'Email' => $this->valueOrSpace($request->input('email')),
                        'Attend' => $this->valueOrSpace($request->input('attend')),
                        'Payment' => $this->valueOrSpace($request->input('payment')),
                        'Validity' => $this->valueOrSpace($request->input('validity')),
                        'Delivery' => $this->valueOrSpace($request->input('delivery')),
                        'Franco' => $this->valueOrSpace($request->input('franco')),
                        'Note1' => $this->valueOrSpace($request->input('note1')),
                        'Note2' => $this->valueOrSpace($request->input('note2')),
                        'Note3' => $this->valueOrSpace($request->input('note3')),
                    ]);

                $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
                
                DB::table('tb_penawarandetail')
                    ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
                    ->delete();

                $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
                $insertData = [];
                foreach ($materials as $item) {
                    $insertData[] = [
                        $noPenawaranColumn => $noPenawaran,
                        'Material' => $item['material'] ?? null,
                        'Qty' => $item['quantity'] ?? null,
                        'Harga' => $item['harga_penawaran'] ?? null,
                        $hargaModalColumn => $item['harga_modal'] ?? null,
                        'Satuan' => $item['satuan'] ?? null,
                        'Margin' => $item['margin'] ?? null,
                        'Remark' => $this->valueOrSpace($item['remark'] ?? null),
                    ];
                }
                if (!empty($insertData)) {
                    DB::table('tb_penawarandetail')->insert($insertData);
                }
            });

            Cache::tags(['quotation_data'])->flush();

        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPenawaran, $detailId)
    {
        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        
        $exists = DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->exists();

        if (!$exists) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
        DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->update([
                'Material' => $request->input('material'),
                'Qty' => $request->input('quantity'),
                'Harga' => $request->input('harga_penawaran'),
                $hargaModalColumn => $request->input('harga_modal'),
                'Satuan' => $request->input('satuan'),
                'Margin' => $request->input('margin'),
                'Remark' => $this->valueOrSpace($request->input('remark')),
            ]);

        Cache::tags(['quotation_data'])->flush();

        return back()->with('success', 'Detail quotation berhasil diperbarui.');
    }

    public function destroyDetail($noPenawaran, $detailId)
    {
        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        
        $deleted = DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->delete();

        if (!$deleted) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        Cache::tags(['quotation_data'])->flush();

        return back()->with('success', 'Detail quotation berhasil dihapus.');
    }

    public function store(Request $request)
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $allowed = config('tenants.databases', []);
        $rawPrefix = in_array($database, $allowed, true) ? $database : 'SJA';
        $labelPrefix = config("tenants.labels.$rawPrefix");
        $prefixSource = $labelPrefix ?: $rawPrefix;
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $prefixSource));
        if (str_starts_with($prefix, 'DB')) {
            $prefix = substr($prefix, 2);
        }
        if ($prefix === '') {
            $prefix = 'SJA';
        }

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $maxAttempts = 10;
        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use ($request, $materials, $prefix) {
                    $counter = DB::table('tb_counter')
                        ->select('nomor_terakhir')
                        ->where('nama_tabel', 'tb_penawaran')
                        ->first();

                    if (!$counter) {
                        throw new \RuntimeException('Data counter tb_penawaran tidak ditemukan.');
                    }

                    $oldNumber = (int) $counter->nomor_terakhir;
                    $newNumber = $oldNumber + 1;

                    $updated = DB::table('tb_counter')
                        ->where('nama_tabel', 'tb_penawaran')
                        ->where('nomor_terakhir', $oldNumber)
                        ->update(['nomor_terakhir' => $newNumber]);

                    if ($updated === 0) {
                        throw new \RuntimeException('counter_tb_penawaran_dipakai');
                    }

                    $noPenawaran = $prefix.str_pad((string) $newNumber, 7, '0', STR_PAD_LEFT);

                    if (DB::table('tb_penawaran')->where('No_penawaran', $noPenawaran)->exists()) {
                        throw new \RuntimeException('duplicate_no_penawaran');
                    }

                    DB::table('tb_penawaran')->insert([
                        'No_penawaran' => $noPenawaran,
                        'Tgl_penawaran' => $request->input('tgl_penawaran') ?? Carbon::today()->toDateString(),
                        'Tgl_Posting' => Carbon::today()->toDateString(),
                        'Customer' => $this->valueOrSpace($request->input('customer')),
                        'Alamat' => $this->valueOrSpace($request->input('alamat')),
                        'Telp' => $this->valueOrSpace($request->input('telp')),
                        'Fax' => $this->valueOrSpace($request->input('fax')),
                        'Email' => $this->valueOrSpace($request->input('email')),
                        'Attend' => $this->valueOrSpace($request->input('attend')),
                        'Payment' => $this->valueOrSpace($request->input('payment')),
                        'Validity' => $this->valueOrSpace($request->input('validity')),
                        'Delivery' => $this->valueOrSpace($request->input('delivery')),
                        'Franco' => $this->valueOrSpace($request->input('franco')),
                        'Note1' => $this->valueOrSpace($request->input('note1')),
                        'Note2' => $this->valueOrSpace($request->input('note2')),
                        'Note3' => $this->valueOrSpace($request->input('note3')),
                    ]);

                    $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
                    $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
                    $insertData = [];
                    
                    foreach ($materials as $item) {
                        // Logika untuk menambahkan % pada Margin
                        $marginInput = $item['margin'] ?? null;
                        if ($marginInput !== null && trim($marginInput) !== '' && !str_contains($marginInput, '%')) {
                            $marginInput = trim($marginInput) . '%';
                        }

                        $insertData[] = [
                            $noPenawaranColumn => $noPenawaran,
                            'Material' => $item['material'] ?? null,
                            'Qty' => $item['quantity'] ?? null,
                            'Harga' => $item['harga_penawaran'] ?? null,
                            $hargaModalColumn => $item['harga_modal'] ?? null,
                            'Satuan' => $item['satuan'] ?? null,
                            'Margin' => $marginInput, // Margin sudah difilter dengan %
                            'Remark' => $this->valueOrSpace($item['remark'] ?? null),
                        ];
                    }
                    
                    if (!empty($insertData)) {
                        DB::table('tb_penawarandetail')->insert($insertData);
                    }
                });
                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isCounterConflict = str_contains($message, 'counter_tb_penawaran_dipakai');
                $isDuplicate = str_contains($message, 'duplicate_no_penawaran')
                    || str_contains($message, 'duplicate')
                    || ($exception instanceof \Illuminate\Database\QueryException
                        && $exception->getCode() === '23000');

                if ($attempt < $maxAttempts && ($isCounterConflict || $isDuplicate)) {
                    continue;
                }

                if ($isCounterConflict) {
                    return back()->with('error', 'Nomor sedang dipakai user lain.');
                }

                return back()->with('error', $exception->getMessage());
            }
        }

        Cache::tags(['quotation_data'])->flush();

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil disimpan.');
    }

    public function suggestFranco(Request $request)
    {
        $customerName = $request->query('customer');
        
        $franco = Cache::tags(['quotation_data'])->remember('quotation_dss_franco_' . md5($customerName), 86400, function () use ($customerName) {
            $dss = new \App\Services\Marketing\QuotationDss();
            return $dss->suggestFranco($customerName ?: '');
        });

        return response()->json(['franco' => $franco]);
    }
}
