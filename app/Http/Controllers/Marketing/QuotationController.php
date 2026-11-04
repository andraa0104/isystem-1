<?php

namespace App\Http\Controllers\Marketing;

use App\Events\QuotationChanged;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Inertia;
use App\Services\Marketing\QuotationService;

class QuotationController
{
    private array $columnCache = [];

    public function __construct(
        private QuotationService $quotationService
    ) {}

    /**
     * Exception codes are not necessarily HTTP status codes. In particular,
     * SQLSTATE 23000 means an integrity/duplicate-key violation.
     */
    private function exceptionHttpStatus(\Throwable $exception, int $fallback = 422): int
    {
        $code = (int) $exception->getCode();

        if ($code === 23000) {
            return 409;
        }

        return $code >= 100 && $code <= 599 ? $code : $fallback;
    }

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
            $this->columnCache[$table] = DB::connection()->getSchemaBuilder()->getColumnListing($table);
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
        return DB::connection()->getQueryGrammar()->wrap($column);
    }

    public function getLastPrice(Request $request)
    {
        $materialName = $request->query('material');

        if (!$materialName) {
            return response()->json(['harga' => 0]);
        }

        try {
            // SELECT hanya kolom yang dibutuhkan, bukan SELECT *
            $lastRecord = DB::table('tb_invin')
                ->select('harga')
                ->where('mat', 'LIKE', '%' . trim($materialName) . '%')
                ->orderBy('id_invin', 'desc')
                ->first();

            return response()->json([
                'harga' => $lastRecord ? (int) round((float) $lastRecord->harga) : 0,
            ]);
        } catch (\Exception $e) {
            Log::error('Gagal mengambil harga terakhir: ' . $e->getMessage());
            
            return response()->json(['harga' => 0, 'message' => 'Terjadi kesalahan pada database'], 500);
        }
    }
    
    public function details($noPenawaran)
    {
        $detailNo = trim($noPenawaran);

        // SELECT kolom spesifik agar tidak kirim data tidak perlu ke frontend
        $details = DB::table('tb_penawarandetail')
            ->select('ID', 'No_Penawaran', 'Material', 'Qty', 'Satuan', 'Harga', 'Harga_Modal', 'Margin', 'Remark')
            ->where('No_Penawaran', $detailNo)
            ->orderBy('ID')
            ->get();

        return response()->json(['details' => $details]);
    }
    public function destroy(Request $request, $noPenawaran)
    {
        try {
            $this->quotationService->deleteQuotation((string) $noPenawaran);
        } catch (\Throwable $e) {
            $status = $this->exceptionHttpStatus($e, 500);
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
            'realtimeChannel' => QuotationChanged::currentChannel(),
        ]);
    }

    public function data(Request $request)
    {
        $period = $request->query('period', 'today');
        $search = trim((string) $request->query('search', ''));
        
        $page = max(1, (int) $request->query('page', 1));
        $perPage = $request->query('per_page', 5);
        $query = $this->getPenawaranQuery($period, $search);

        if ($perPage === 'all') {
            $penawaran = $query->get();
            $total = $penawaran->count();
        } else {
            $perPage = max(1, (int) $perPage);
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $penawaran = $paginator->items();
            $total = $paginator->total();
        }
    
        return response()->json([
            'penawaran' => $penawaran,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    private function getPenawaranQuery($period, string $search = '')
    {
        // Gunakan nama kolom yang sudah dipastikan ada (hardcode)
        $query = DB::table('tb_penawaran as p')
            ->select(
                'p.No_penawaran',
                'p.Tgl_Penawaran',
                'p.Tgl_Posting',
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
    
        // Batas akhir eksklusif mencakup seluruh jam pada hari terakhir.
        $range = match ($period) {
            'today' => [$now->copy()->startOfDay(), $now->copy()->startOfDay()->addDay()],
            'week' => [$now->copy()->startOfWeek(), $now->copy()->startOfWeek()->addWeek()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->startOfMonth()->addMonth()],
            'year' => [$now->copy()->startOfYear(), $now->copy()->startOfYear()->addYear()],
            default => null,
        };

        if ($range !== null) {
            $query->where('p.Tgl_Posting', '>=', $range[0]->toDateString())
                ->where('p.Tgl_Posting', '<', $range[1]->toDateString());
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
        try {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = $request->query('per_page', 5);
            $search = trim((string) $request->query('search', ''));
    
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
    
            if ($perPage === 'all') {
                $items = $query->get();
                $total = $items->count();
            } else {
                $perPage = max(1, (int) $perPage);
                $total = (clone $query)->count();
                $items = $query->forPage($page, $perPage)->get();
            }
    
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
            Log::error('Error in getQuotationMaterialsDetails: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json([
                'error' => 'Terjadi kesalahan: ' . $e->getMessage()
            ], 500);
        }
    }
 
    public function header($noPenawaran)
    {
        // SELECT kolom spesifik yang dibutuhkan frontend
        $header = DB::table('tb_penawaran')
            ->select(
                'No_Penawaran', 'Tgl_Penawaran', 'Tgl_Posting', 'Customer', 'Alamat',
                'Telp', 'Fax', 'Email', 'Attend', 'Payment', 'Validity',
                'Delivery', 'Franco', 'Note1', 'Note2', 'Note3'
            )
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
        $pageSizeRaw = request()->query('pageSize', 'all');
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

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

        $total = $pageSize === 'all' ? null : (clone $query)->count();
        $query->orderBy('nm_cs');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $customers = $query->get();

        return response()->json([
            'customers' => $customers,
            'total' => $total ?? $customers->count(),
        ]);
    }

    public function materials()
    {
        $search = trim((string) request()->query('search', ''));
        $page = max(1, (int) request()->query('page', 1));
        $pageSizeRaw = request()->query('pageSize', 'all');
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

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

        $total = $pageSize === 'all' ? null : (clone $query)->count();
        $query->orderBy($nameColumn);

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $materials = $query->get();

        return response()->json([
            'materials' => $materials,
            'total' => $total ?? $materials->count(),
        ]);
    }

    public function edit($noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran', 'Tgl_penawaran', 'Tgl_Posting', 'Customer', 'Alamat',
                'Telp', 'Fax', 'Email', 'Attend', 'Payment', 'Validity',
                'Delivery', 'Franco', 'Note1', 'Note2', 'Note3'
            )
            ->where('No_penawaran', trim($noPenawaran))
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        // Kolom tb_penawarandetail sudah diketahui pasti ada — hardcode langsung
        // untuk menghindari overhead resolveColumn (schema introspection per request).
        $quotationDetails = DB::table('tb_penawarandetail')
            ->select(
                DB::raw('ID, ID as id'),
                DB::raw('No_Penawaran, No_Penawaran as no_penawaran'),
                DB::raw('Material, Material as material'),
                DB::raw('Harga, Harga as harga_penawaran'),
                DB::raw('Qty, Qty as quantity'),
                DB::raw('Satuan, Satuan as satuan'),
                DB::raw('Harga_Modal as Harga_modal, Harga_Modal as harga_modal'),
                DB::raw('Margin, Margin as margin'),
                DB::raw('Remark, Remark as remark')
            )
            ->where('No_Penawaran', trim($noPenawaran))
            ->orderBy('ID')
            ->get();

        return Inertia::render('marketing/quotation/edit', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'customers' => [],
            'materials' => [],
        ]);
    }

    public function print(Request $request, $noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran', 'Tgl_penawaran', 'Customer', 'Alamat', 'Telp',
                'Email', 'Attend', 'Payment', 'Validity', 'Delivery', 'Franco',
                'Note1', 'Note2', 'Note3'
            )
            ->where('No_penawaran', trim($noPenawaran))
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        // Kolom tb_penawarandetail sudah diketahui ada — hardcode langsung
        // menghindari overhead schema introspection resolveColumn().
        $quotationDetails = DB::table('tb_penawarandetail')
            ->selectRaw(
                'ID, ID as id,'
                .' No_Penawaran, No_Penawaran as no_penawaran,'
                .' Material, Material as material,'
                .' CASE WHEN Harga_Modal > Harga THEN Harga_Modal ELSE Harga END as Harga,'
                .' CASE WHEN Harga_Modal > Harga THEN Harga_Modal ELSE Harga END as harga_penawaran,'
                .' Qty, Qty as quantity,'
                .' Satuan, Satuan as satuan,'
                .' CASE WHEN Harga_Modal > Harga THEN Harga ELSE Harga_Modal END as Harga_modal,'
                .' CASE WHEN Harga_Modal > Harga THEN Harga ELSE Harga_Modal END as harga_modal,'
                .' Margin, Margin as margin,'
                .' Remark, Remark as remark'
            )
            ->where('No_Penawaran', trim($noPenawaran))
            ->orderBy('ID')
            ->get();

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
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
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
                $status = $this->exceptionHttpStatus($exception);
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

    public function attends(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $search = trim($validated['search'] ?? '');
        $history = DB::table('tb_penawaran')
            ->whereNotNull('Attend')->selectRaw('cast(Attend as char) as attend')
            ->unionAll(DB::table('tb_cs')->whereNotNull('Attnd')->selectRaw('cast(Attnd as char) as attend'));
        $query = DB::query()->fromSub($history, 'attend_history')
            ->whereRaw("trim(attend) <> ''")
            ->selectRaw('min(trim(attend)) as attend')
            ->groupByRaw('lower(trim(attend))');

        // Group the complete history before searching/paging so aliases cannot
        // reappear on another page or become the representative during a search.
        $groups = [];
        $names = $query->get()->pluck('attend')->map(function ($attend) {
            $name = preg_replace('/\s+/u', ' ', trim($attend));

            return ['name' => $name, 'key' => $this->normalizeAttend($name)];
        })->sort(function ($left, $right) {
            return mb_strlen($left['key']) <=> mb_strlen($right['key'])
                ?: strcasecmp($left['name'], $right['name'])
                ?: strcmp($left['name'], $right['name']);
        });

        foreach ($names as $name) {
            $key = $name['key'];
            $groupKey = $key;
            $multiplePeople = preg_match('/[&\/]|\bdan\b/u', Str::lower($name['name'])) === 1;

            if (!$multiplePeople && $key !== '') {
                // Prefer the shortest name: marvel, marvelna, marvelna vidica.
                // Do not use very short prefixes (e.g. Al versus Alvin).
                for ($length = 4; $length < mb_strlen($key); $length++) {
                    $prefix = mb_substr($key, 0, $length);
                    if (isset($groups['single:'.$prefix])) {
                        $groupKey = $prefix;
                        break;
                    }
                }
            }

            $groupKey = ($multiplePeople ? 'multiple:' : 'single:').$groupKey;
            $groups[$groupKey] ??= ['name' => $name['name'], 'aliases' => []];
            $groups[$groupKey]['aliases'][] = $name;
        }

        $normalizedSearch = $this->normalizeAttend($search);
        $attends = collect($groups)->filter(function ($group) use ($search, $normalizedSearch) {
            if ($search === '') {
                return true;
            }

            foreach ($group['aliases'] as $alias) {
                if (str_contains(Str::lower($alias['name']), Str::lower($search))
                    || ($normalizedSearch !== '' && str_contains($alias['key'], $normalizedSearch))) {
                    return true;
                }
            }

            return false;
        })->pluck('name')->sort(SORT_NATURAL | SORT_FLAG_CASE)->values();
        $page = (int) ($validated['page'] ?? 1);
        $perPage = 30;

        return response()->json([
            'attends' => $attends->slice(($page - 1) * $perPage, $perPage)->values(),
            'has_more' => $attends->count() > $page * $perPage,
            'page' => $page,
        ]);
    }

    private function normalizeAttend(string $name): string
    {
        $name = Str::lower($name);
        $name = preg_replace('/\b(?:bapak|bpk|bp|pak|ibu|bu)\b\.?\s*/u', '', $name);

        // Keep person separators so a combined Attend stays distinct.
        return preg_replace('/[\s.]+/u', '', $name);
    }

    public function suggestFranco(Request $request)
    {
        $validated = $request->validate(['customer' => ['nullable', 'string']]);
        $customerName = trim($validated['customer'] ?? '');
        $franco = '';
        $attend = '';

        if ($customerName !== '') {
            $latest = DB::table('tb_penawaran')
                ->where('Customer', $customerName)
                ->orderByDesc('Tgl_Posting')
                ->orderByDesc('No_penawaran')
                ->first(['Franco', 'Attend']);
            $franco = trim((string) ($latest->Franco ?? ''));
            $attend = trim((string) ($latest->Attend ?? ''));
        }

        return response()->json([
            'franco' => $franco !== '' ? $franco : 'SAMARINDA',
            'attend' => $attend,
        ]);
    }
}
