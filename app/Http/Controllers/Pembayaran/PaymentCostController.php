<?php

namespace App\Http\Controllers\Pembayaran;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class PaymentCostController
{
    public function index()
    {
        return Inertia::render('Pembayaran/payment-cost/index');
    }

    public function create()
    {
        return Inertia::render('Pembayaran/payment-cost/create');
    }

    public function store(Request $request)
    {
        if (!Schema::hasTable('tb_bayar')) {
            return redirect()->back()->with('error', 'Tabel tb_bayar tidak ditemukan.');
        }

        $payload = $request->validate([
            'tgl_bayar' => ['required', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.keterangan' => ['required', 'string'],
            'items.*.penanggung' => ['required', 'string'],
            'items.*.jumlah' => ['required', 'numeric'],
            'items.*.alokasi' => ['required', 'string'],
            'items.*.dok' => ['required', 'string'],
            'items.*.tagihan' => ['nullable', 'numeric'],
            'items.*.sisaBayarSekarang' => ['nullable', 'numeric'],
        ]);

        try {
            $result = DB::transaction(function () use ($payload) {
                // Prefix from tenant DB name: dbsja -> SJA
                $dbName = (string) DB::connection()->getDatabaseName();
                $prefix = strtoupper(preg_replace('/^db/i', '', $dbName));
                if ($prefix === '') {
                    $prefix = 'UNK';
                }

                $codePrefix = $prefix . '/PC/';
                $last = DB::table('tb_bayar')
                    ->select('Kode_Bayar')
                    ->where('Kode_Bayar', 'like', $codePrefix . '%')
                    ->orderByDesc('Kode_Bayar')
                    ->limit(1)
                    ->lockForUpdate()
                    ->first();

                $lastNum = 0;
                $padWidth = 7;
                if ($last && isset($last->Kode_Bayar)) {
                    $parts = explode('/', (string) $last->Kode_Bayar);
                    $numStr = (string) end($parts);
                    $numStr = trim($numStr);
                    if ($numStr === '' || !ctype_digit($numStr)) {
                        throw new \RuntimeException('Format Kode_Bayar terakhir tidak valid: ' . (string) $last->Kode_Bayar);
                    }
                    $padWidth = strlen($numStr);
                    $lastNum = (int) $numStr;
                }
                $nextNum = $lastNum + 1;
                $kodeBayar = $codePrefix . str_pad((string) $nextNum, $padWidth, '0', STR_PAD_LEFT);

                $tglBayar = (string) $payload['tgl_bayar']; // Y-m-d
                $tglPosting = now()->toDateString(); // date column

                $rows = [];
                foreach ($payload['items'] as $idx => $it) {
                    $rows[] = [
                        'Kode_Bayar' => $kodeBayar,
                        'No' => $idx + 1,
                        'Tgl_Bayar' => $tglBayar,
                        'Tgl_Posting' => $tglPosting,
                        'Keterangan' => (string) $it['keterangan'],
                        'Penanggung' => (string) $it['penanggung'],
                        'Total' => (int) round((float) ($it['tagihan'] ?? 0)),
                        'Bayar' => (int) round((float) $it['jumlah']),
                        'Sisa' => (int) round((float) ($it['sisaBayarSekarang'] ?? 0)),
                        'beban_akun' => (string) $it['alokasi'],
                        'noduk_beban' => (string) $it['dok'],
                        'Status' => 'T',
                    ];
                }

                DB::table('tb_bayar')->insert($rows);

                // Update source docs (BKP/BKJ) based on dokumen beban
                foreach ($payload['items'] as $it) {
                    $dok = (string) $it['dok'];
                    $bayar = (float) $it['jumlah'];
                    $sisaNow = (float) ($it['sisaBayarSekarang'] ?? 0);

                    if (Schema::hasTable('tb_biayakirimbeli') && str_contains($dok, 'BKP')) {
                        DB::table('tb_biayakirimbeli')
                            ->where('no_bkp', $dok)
                            ->update([
                                'pembayaran' => (int) round($bayar),
                                'sisa' => (int) round($sisaNow),
                            ]);
                        continue;
                    }

                    if (Schema::hasTable('tb_biayakirimjual') && str_contains($dok, 'BKJ')) {
                        DB::table('tb_biayakirimjual')
                            ->where('no_bkj', $dok)
                            ->update([
                                'jumlah_bayar' => (int) round($bayar),
                                'sisa' => (int) round($sisaNow),
                            ]);
                        continue;
                    }
                }

                return ['kode_bayar' => $kodeBayar];
            });

            return redirect()->route('pembayaran.payment-cost.index')
                ->with('success', 'Berhasil menyimpan Payment Cost: ' . $result['kode_bayar']);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function bkpRows(Request $request)
    {
        if (!Schema::hasTable('tb_biayakirimbeli')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_biayakirimbeli');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('no_bkp', 'like', '%' . $search . '%')
                    ->orWhere('Vendor_Ekspedisi', 'like', '%' . $search . '%')
                    ->orWhere('no_inv', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            'no_bkp',
            'tanggal',
            'Vendor_Ekspedisi',
            'no_inv',
            'Total_Biaya',
            'pembayaran',
            'sisa',
            'trx_kas',
        ])->orderByDesc('no_bkp');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function bkjRows(Request $request)
    {
        if (!Schema::hasTable('tb_biayakirimjual')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_biayakirimjual');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('no_bkj', 'like', '%' . $search . '%')
                    ->orWhere('nama_vendor', 'like', '%' . $search . '%')
                    ->orWhere('no_inv', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            'no_bkj',
            'tanggal',
            'nama_vendor',
            'no_inv',
            'jumlah_inv',
            'jumlah_bayar',
            'sisa',
            'jurnal',
        ])->orderByDesc('no_bkj');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function rows(Request $request)
    {
        if (!Schema::hasTable('tb_bayar')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $filter = (string) $request->query('filter', 'belum'); // belum | sudah | all
        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_bayar');

        // Filter pembukuan:
        // - "belum pembukuan": beban_akun has content (TRIM <> '')
        // - "sudah pembukuan": beban_akun is effectively empty (stored as space), so TRIM = ''
        if ($filter === 'belum') {
            $query->whereRaw("TRIM(COALESCE(beban_akun,'')) <> ''");
        } elseif ($filter === 'sudah') {
            $query->whereRaw("TRIM(COALESCE(beban_akun,'')) = ''");
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('Kode_Bayar', 'like', '%' . $search . '%')
                    ->orWhere('Keterangan', 'like', '%' . $search . '%')
                    ->orWhere('beban_akun', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $select = [
            'Kode_Bayar',
            'Tgl_Bayar',
            'Tgl_Posting',
            'Keterangan',
            'Penanggung',
            'Total',
            'Bayar',
            'Sisa',
            'beban_akun',
            'noduk_beban',
        ];

        // Sort desc by kode bayar
        $query->select($select)->orderByDesc('Kode_Bayar');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        $rows = $query->get();

        return response()->json(['rows' => $rows, 'total' => $total]);
    }
}
