<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use App\Services\Marketing\QuotationDss;
use App\Services\Marketing\QuotationService;

class QuotationController
{
    private array $columnCache = [];

    public function __construct(
        private QuotationService $quotationService
    ) {}

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
        try {
            $this->quotationService->deleteQuotation((string) $noPenawaran);
        } catch (\Throwable $e) {
            $status = $e->getCode() ?: 500;
            return response()->json(['message' => $e->getMessage()], $status);
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

        $cacheKey = 'quotation_materials_tb_barang_v2_' . md5(json_encode([
            'search' => $search,
            'page' => $page,
            'pageSize' => $pageSizeRaw,
        ]));

        $data = Cache::tags(['material_data'])->remember($cacheKey, 86400, function () use ($search, $page, $pageSize) {
            $codeColumn = $this->resolveColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode'], 'kd_material');
            $nameColumn = $this->resolveColumn('tb_barang', ['material', 'nama_barang', 'nm_barang', 'barang'], 'material');
            $unitColumn = $this->resolveColumn('tb_barang', ['unit', 'satuan'], 'unit');

            $query = DB::table('tb_barang')->selectRaw("
                {$codeColumn} as kd_material,
                {$nameColumn} as material,
                {$unitColumn} as unit,
                cast(coalesce(cast(stok_g1 as decimal(65,4)), 0) as signed) as stok_g1,
                cast(coalesce(cast(stok_g2 as decimal(65,4)), 0) as signed) as stok_g2,
                cast(coalesce(cast(stok_g3 as decimal(65,4)), 0) as signed) as stok_g3,
                cast(coalesce(cast(stok_g4 as decimal(65,4)), 0) as signed) as stok_g4,
                cast((
                    coalesce(cast(stok_g1 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g2 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g3 as decimal(65,4)), 0) +
                    coalesce(cast(stok_g4 as decimal(65,4)), 0)
                ) as signed) as stok
            ");

            if ($search !== '') {
                $query->where(function ($q) use ($search, $codeColumn, $nameColumn, $unitColumn) {
                    $q->where($codeColumn, 'like', '%' . $search . '%')
                        ->orWhere($nameColumn, 'like', '%' . $search . '%')
                        ->orWhere($unitColumn, 'like', '%' . $search . '%');
                });
            }

            $total = (clone $query)->count();
            $query->orderBy($nameColumn);

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
        try {
            $this->quotationService->updateQuotation($noPenawaran, $request->all());
        } catch (\Throwable $exception) {
            $status = $exception->getCode();
            if ($status === 404) {
                return redirect()
                    ->route('marketing.quotation.index')
                    ->with('error', $exception->getMessage());
            }
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noPenawaran, $detailId)
    {
        try {
            $this->quotationService->updateQuotationDetail($noPenawaran, (int) $detailId, $request->all());
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Detail quotation berhasil diperbarui.');
    }

    public function destroyDetail($noPenawaran, $detailId)
    {
        try {
            $this->quotationService->deleteQuotationDetail($noPenawaran, (int) $detailId);
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }
        
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

        try {
            $this->quotationService->createQuotation($request->all(), $prefix);
        } catch (\Throwable $exception) {
            if ($request->expectsJson()) {
                $status = $exception->getCode() ?: 422;
                return response()->json([
                    'message' => $exception->getMessage(),
                ], $status);
            }
            return back()->with('error', $exception->getMessage());
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Data quotation berhasil disimpan.',
                'redirect' => route('marketing.quotation.index'),
            ]);
        }

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
