<?php

namespace App\Http\Controllers\Pembayaran;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class PermintaanDanaBiayaController
{
    private function tenantCompany(Request $request): array
    {
        $tenantDb = (string) ($request->cookie('tenant_database') ?? $request->session()->get('tenant.database', ''));
        if ($tenantDb === '') return [];
        return (array) config("tenants.companies.$tenantDb", []);
    }

    private function tenantPrefix(Request $request): string
    {
        $tenantDb = (string) ($request->cookie('tenant_database') ?? $request->session()->get('tenant.database', ''));
        if ($tenantDb === '') return 'SJA';
        // dbsja -> SJA, dbstg -> STG, etc.
        $trimmed = strtoupper(preg_replace('/^DB/i', '', $tenantDb));
        return $trimmed !== '' ? $trimmed : 'SJA';
    }

    public function index()
    {
        return Inertia::render('Pembayaran/permintaan-dana-biaya/index');
    }

    public function create()
    {
        return Inertia::render('Pembayaran/permintaan-dana-biaya/create');
    }

    public function payCostRows(Request $request)
    {
        if (!Schema::hasTable('tb_bayar')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $base = DB::table('tb_bayar');

        if ($search !== '') {
            $base->where(function ($q) use ($search) {
                $q->where('Kode_Bayar', 'like', '%' . $search . '%')
                    ->orWhere('Keterangan', 'like', '%' . $search . '%')
                    ->orWhere('Penanggung', 'like', '%' . $search . '%');
            });
        }

        // Use group-by for mysql only_full_group_by compatibility.
        $grouped = (clone $base)
            ->selectRaw('TRIM(Kode_Bayar) as kode_bayar')
            ->selectRaw('MAX(Tgl_Bayar) as tgl_bayar')
            ->selectRaw('MAX(Tgl_Posting) as tgl_posting')
            ->selectRaw('MAX(Penanggung) as penanggung')
            ->selectRaw('MAX(Keterangan) as keterangan')
            ->selectRaw('COALESCE(SUM(Total),0) as sum_total')
            ->selectRaw('COALESCE(SUM(Bayar),0) as sum_bayar')
            ->selectRaw('COALESCE(SUM(Sisa),0) as sum_sisa')
            ->groupBy(DB::raw('TRIM(Kode_Bayar)'));

        $total = DB::query()
            ->fromSub($grouped, 't')
            ->count();

        $paged = DB::query()
            ->fromSub($grouped, 't')
            ->orderByDesc('kode_bayar');

        if ($pageSize !== 'all') {
            $paged->forPage($page, $pageSize);
        }

        return response()->json([
            'rows' => $paged->get(),
            'total' => $total,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tgl_buat' => ['required', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.kode_bayar' => ['required', 'string'],
            'items.*.keterangan' => ['required', 'string'],
            'items.*.jumlah' => ['required', 'numeric', 'min:0.01'],
            // Optional: used to fill tb_kdpdb.Transfer & tb_kdpdb.Sisa.
            'items.*.bayar' => ['nullable', 'numeric', 'min:0'],
            'items.*.sisa' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (!Schema::hasTable('tb_kdpdb') || !Schema::hasTable('tb_pdb')) {
            return redirect()->back()->with('error', 'Tabel PDB belum tersedia di database.');
        }

        $prefix = $this->tenantPrefix($request);
        $tglBuat = Carbon::parse($validated['tgl_buat'])->toDateString();
        $tglPosting = Carbon::now()->toDateString();

        $items = collect($validated['items'])->values();
        $totalJumlah = $items->sum(function ($row) {
            return (float) $row['jumlah'];
        });
        $totalBayar = $items->sum(function ($row) {
            return (float) ($row['bayar'] ?? 0);
        });
        $totalSisa = $items->sum(function ($row) {
            return (float) ($row['sisa'] ?? 0);
        });

        $hasTbPdbBayar = Schema::hasColumn('tb_pdb', 'Bayar') || Schema::hasColumn('tb_pdb', 'bayar');
        $hasTbPdbSisa = Schema::hasColumn('tb_pdb', 'Sisa') || Schema::hasColumn('tb_pdb', 'sisa');

        DB::transaction(function () use ($prefix, $tglBuat, $tglPosting, $items, $totalJumlah, $totalBayar, $totalSisa, $hasTbPdbBayar, $hasTbPdbSisa) {
            $last = DB::table('tb_kdpdb')
                ->selectRaw('TRIM(No_PDB) as no_pdb')
                ->where('No_PDB', 'like', $prefix . '.PDB/%')
                ->orderByDesc('No_PDB')
                ->lockForUpdate()
                ->first();

            $lastNumber = 0;
            if ($last && isset($last->no_pdb)) {
                // PREFIX.PDB/0000001
                if (preg_match('/\/(\d+)$/', (string) $last->no_pdb, $m)) {
                    $lastNumber = (int) $m[1];
                }
            }

            $next = $lastNumber + 1;
            $noPdb = $prefix . '.PDB/' . str_pad((string) $next, 7, '0', STR_PAD_LEFT);

            DB::table('tb_kdpdb')->insert([
                'No_PDB' => $noPdb,
                'Tgl_Buat' => $tglBuat,
                'Tgl_Posting' => $tglPosting,
                'Kas_Bank' => 0,
                'Kas_Tunai' => 0,
                'Total' => $totalJumlah,
                'Transfer' => $totalBayar,
                'Sisa' => $totalSisa,
            ]);

            $detailRows = $items->map(function ($row, $idx) use ($noPdb, $hasTbPdbBayar, $hasTbPdbSisa) {
                $data = [
                    'No_PDB' => $noPdb,
                    'Kode_Bayar' => (string) $row['kode_bayar'],
                    'No' => $idx + 1,
                    'Keterangan' => (string) $row['keterangan'],
                    'Jumlah' => (float) $row['jumlah'],
                    // Some databases store Bayar/Sisa columns in tb_pdb; keep optional.
                    'Bayar' => isset($row['bayar']) ? (float) $row['bayar'] : null,
                    'Sisa' => isset($row['sisa']) ? (float) $row['sisa'] : null,
                ];

                if (! $hasTbPdbBayar) {
                    unset($data['Bayar']);
                }
                if (! $hasTbPdbSisa) {
                    unset($data['Sisa']);
                }

                return $data;
            })->all();

            DB::table('tb_pdb')->insert($detailRows);
        });

        return redirect('/pembayaran/permintaan-dana-biaya')
            ->with('success', 'Permintaan Dana Biaya berhasil disimpan.');
    }

    public function rows(Request $request)
    {
        if (!Schema::hasTable('tb_kdpdb')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_kdpdb');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('No_PDB', 'like', '%' . $search . '%')
                    ->orWhere('no_pdb', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            DB::raw('No_PDB as no_pdb'),
            DB::raw('Tgl_Buat as tgl_buat'),
            DB::raw('Tgl_Posting as tgl_posting'),
            DB::raw('Kas_Bank as kas_bank'),
            DB::raw('Kas_Tunai as kas_tunai'),
            DB::raw('Total as total'),
            DB::raw('Transfer as transfer'),
            DB::raw('Sisa as sisa'),
        ])->orderByDesc('no_pdb');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function detailRows(Request $request)
    {
        if (!Schema::hasTable('tb_pdb')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $noPdb = trim((string) $request->query('no_pdb', ''));
        if ($noPdb === '') {
            return response()->json(['message' => 'Parameter no_pdb wajib diisi.'], 422);
        }

        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_pdb')->whereRaw('TRIM(No_PDB) = ?', [$noPdb]);

        $total = (clone $query)->count();

        $query->select([
            DB::raw('No_PDB as no_pdb'),
            DB::raw('Kode_Bayar as kode_bayar'),
            DB::raw('No as no'),
            DB::raw('Keterangan as keterangan'),
            DB::raw('Jumlah as jumlah'),
        ])->orderBy('no');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function bayarDetail(Request $request)
    {
        if (!Schema::hasTable('tb_bayar')) {
            return response()->json(['rows' => []], 404);
        }

        $kodeBayar = trim((string) $request->query('kode_bayar', ''));
        if ($kodeBayar === '') {
            return response()->json(['message' => 'Parameter kode_bayar wajib diisi.'], 422);
        }

        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $where = function ($q) use ($kodeBayar) {
            $q->whereRaw('TRIM(Kode_Bayar) = ?', [$kodeBayar]);
        };

        $total = DB::table('tb_bayar')->where($where)->count();

        $sums = DB::table('tb_bayar')
            ->where($where)
            ->selectRaw(
                'COALESCE(SUM(Total),0) as sum_total, COALESCE(SUM(Bayar),0) as sum_bayar, COALESCE(SUM(Sisa),0) as sum_sisa'
            )
            ->first();

        $rowsQuery = DB::table('tb_bayar')
            ->where($where)
            ->select([
                'Kode_Bayar',
                'No',
                'Tgl_Bayar',
                'Tgl_Posting',
                'Keterangan',
                'Penanggung',
                'Total',
                'Bayar',
                'Sisa',
                'beban_akun',
                'noduk_beban',
            ])
            ->orderBy('No');

        if ($pageSize !== 'all') {
            $rowsQuery->forPage($page, $pageSize);
        }

        $rows = $rowsQuery->get();

        return response()->json([
            'rows' => $rows,
            'total' => $total,
            'sums' => [
                'total' => (float) ($sums->sum_total ?? 0),
                'bayar' => (float) ($sums->sum_bayar ?? 0),
                'sisa' => (float) ($sums->sum_sisa ?? 0),
            ],
        ]);
    }

    public function print(Request $request)
    {
        $company = $this->tenantCompany($request);

        if (!Schema::hasTable('tb_kdpdb') || !Schema::hasTable('tb_pdb')) {
            return Inertia::render('Pembayaran/permintaan-dana-biaya/print', [
                'header' => null,
                'details' => [],
                'totals' => [],
                'company' => $company,
                'printDate' => Carbon::now()->locale('id')->translatedFormat('d F Y'),
            ]);
        }

        $noPdb = trim((string) $request->query('no_pdb', ''));
        if ($noPdb === '') {
            return redirect()->back()->with('error', 'Parameter no_pdb wajib diisi.');
        }

        $header = DB::table('tb_kdpdb')
            ->select([
                DB::raw('No_PDB as no_pdb'),
                DB::raw('Tgl_Buat as tgl_buat'),
                DB::raw('Tgl_Posting as tgl_posting'),
                DB::raw('Kas_Bank as kas_bank'),
                DB::raw('Kas_Tunai as kas_tunai'),
            ])
            ->whereRaw('TRIM(No_PDB) = ?', [$noPdb])
            ->first();
        $details = DB::table('tb_pdb')
            ->whereRaw('TRIM(No_PDB) = ?', [$noPdb])
            ->select([
                DB::raw('No as no'),
                DB::raw('Kode_Bayar as kode_bayar'),
                DB::raw('Keterangan as keterangan'),
                DB::raw('Jumlah as jumlah'),
            ])
            ->orderBy('no')
            ->get();

        $totals = [
            'jumlah' => $details->sum('jumlah'),
        ];

        return Inertia::render('Pembayaran/permintaan-dana-biaya/print', [
            'header' => $header,
            'details' => $details,
            'totals' => $totals,
            'company' => $company,
            'printDate' => Carbon::now()->locale('id')->translatedFormat('d F Y'),
        ]);
    }
}
