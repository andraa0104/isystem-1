<?php

namespace App\Http\Controllers\Pembayaran;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Carbon\Carbon;

class PermintaanDanaOperasionalController
{
    public function index()
    {
        return Inertia::render('Pembayaran/permintaan-dana-operasional/index');
    }

    public function create()
    {
        return Inertia::render('Pembayaran/permintaan-dana-operasional/create');
    }

    public function rows(Request $request)
    {
        if (!Schema::hasTable('tb_kdpdo')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_kdpdo');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('no_pdo', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            'no_pdo',
            'posting_date',
            'kas_bank',
            'kas_tunai',
            'jumlah_pdo',
            'jumlah_ditransfer',
            'sisa_pdo',
        ])->orderByDesc('no_pdo');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function pdoRows(Request $request, string $noPdo)
    {
        if (!Schema::hasTable('tb_pdo')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_pdo')->where('no_pdo', $noPdo);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('no_fi', 'like', '%' . $search . '%')
                    ->orWhere('ref_po', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            'no_pdo',
            'posting_date',
            'no_fi',
            'inv_date',
            'ref_po',
            'vendor',
            'jumlah_inv',
            'jumlah_bayar',
            'tgl_bayar',
            'pdo_now',
            'lastend_pdo',
            'remark',
        ])->orderByDesc('no_pdo');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function fiRows(Request $request)
    {
        if (!Schema::hasTable('tb_kdinvin')) {
            return response()->json(['rows' => [], 'total' => 0]);
        }

        $search = trim((string) $request->query('search', ''));
        $pageSizeRaw = $request->query('pageSize', 5);
        $pageRaw = $request->query('page', 1);

        $page = max(1, (int) $pageRaw);
        $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

        $query = DB::table('tb_kdinvin');

        // Hanya tampilkan FI yang sudah penuh PDO (Jumlah_PDO = total)
        if (Schema::hasColumn('tb_kdinvin', 'Jumlah_PDO') && Schema::hasColumn('tb_kdinvin', 'total')) {
            $query->whereRaw('COALESCE(Jumlah_PDO, 0) = COALESCE(total, 0)');
        }

        if ($search !== '') {
            // Search LIKE only for: no_doc, ref_po, nm_vdr
            $query->where(function ($q) use ($search) {
                $q->where('no_doc', 'like', '%' . $search . '%')
                    ->orWhere('ref_po', 'like', '%' . $search . '%')
                    ->orWhere('nm_vdr', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();

        $query->select([
            'no_doc',
            't_doc',
            'inv_d',
            'ref_po',
            'nm_vdr',
            'total',
            'pembayaran',
            'sisa_bayar',
            'tgl_bayar',
            'jurnal',
            'Jumlah_PDO',
        ])->orderByDesc('no_doc');

        if ($pageSize !== 'all') {
            $query->forPage($page, $pageSize);
        }

        return response()->json(['rows' => $query->get(), 'total' => $total]);
    }

    public function fiDetail(string $noDoc)
    {
        if (!Schema::hasTable('tb_kdinvin')) {
            return response()->json(['header' => null, 'last_pdo' => 0], 404);
        }

        $header = DB::table('tb_kdinvin')
            ->where('no_doc', $noDoc)
            ->first();

        if (!$header) {
            return response()->json(['header' => null, 'last_pdo' => 0], 404);
        }

        $lastPdo = 0;
        if (Schema::hasTable('tb_pdo')) {
            $lastQuery = DB::table('tb_pdo')->where('no_fi', $noDoc);
            if (Schema::hasColumn('tb_pdo', 'posting_date')) {
                $lastQuery->orderByDesc('posting_date');
            }
            if (Schema::hasColumn('tb_pdo', 'no_urut')) {
                $lastQuery->orderByDesc('no_urut');
            }
            $lastRow = $lastQuery->select(['lastend_pdo'])->first();
            if ($lastRow && isset($lastRow->lastend_pdo)) {
                $lastPdo = (float) $lastRow->lastend_pdo;
            }
        }

        return response()->json([
            'header' => $header,
            'last_pdo' => $lastPdo,
        ]);
    }

    public function store(Request $request)
    {
        if (!Schema::hasTable('tb_pdo')) {
            return redirect()->back()->with('error', 'Tabel tb_pdo tidak ditemukan.');
        }
        if (!Schema::hasTable('tb_kdinvin')) {
            return redirect()->back()->with('error', 'Tabel tb_kdinvin tidak ditemukan.');
        }

        $payload = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.no_fi' => ['required', 'string'],
            'items.*.no_inv' => ['nullable', 'string'],
            'items.*.inv_date' => ['nullable', 'string'],
            'items.*.ref_po' => ['nullable', 'string'],
            'items.*.vendor' => ['nullable', 'string'],
            'items.*.jumlah_inv' => ['nullable', 'numeric'],
            'items.*.jumlah_bayar' => ['nullable', 'numeric'],
            // format dd.mm.yyyy (we store as string). Jika jumlah_bayar=0 boleh kosong (akan dipaksa jadi spasi).
            'items.*.tgl_bayar' => ['nullable', 'string'],
            'items.*.last_pdo' => ['nullable', 'numeric'],
            'items.*.pdo_now' => ['required', 'numeric'],
            'items.*.lastend_pdo' => ['nullable', 'numeric'],
            'items.*.remark' => ['nullable', 'string'],
        ]);

        try {
            $result = DB::transaction(function () use ($payload) {
                $dbName = (string) DB::connection()->getDatabaseName();
                $prefix = strtoupper(preg_replace('/^db/i', '', $dbName));
                if ($prefix === '') {
                    $prefix = 'UNK';
                }

                $codePrefix = $prefix . '.PDO-';
                $last = DB::table('tb_pdo')
                    ->select('no_pdo')
                    ->where('no_pdo', 'like', $codePrefix . '%')
                    ->orderByDesc('no_pdo')
                    ->limit(1)
                    ->lockForUpdate()
                    ->first();

                $lastNum = 0;
                $padWidth = 7;
                if ($last && isset($last->no_pdo)) {
                    $str = (string) $last->no_pdo;
                    $pos = strrpos($str, '-');
                    $numStr = $pos === false ? '' : substr($str, $pos + 1);
                    $numStr = trim((string) $numStr);
                    if ($numStr === '' || !ctype_digit($numStr)) {
                        throw new \RuntimeException('Format No PDO terakhir tidak valid: ' . $str);
                    }
                    $padWidth = strlen($numStr);
                    $lastNum = (int) $numStr;
                }
                $nextNum = $lastNum + 1;
                $noPdo = $codePrefix . str_pad((string) $nextNum, $padWidth, '0', STR_PAD_LEFT);

                // posting_date diisi saat user klik simpan (format dd.mm.yyyy)
                $postingDate = now()->format('d.m.Y');

                $hasNoUrut = Schema::hasColumn('tb_pdo', 'no_urut');
                $hasNoFi = Schema::hasColumn('tb_pdo', 'no_fi');
                $hasNoInv = Schema::hasColumn('tb_pdo', 'no_inv');
                $hasInvDate = Schema::hasColumn('tb_pdo', 'inv_date');
                $hasRefPo = Schema::hasColumn('tb_pdo', 'ref_po');
                $hasVendor = Schema::hasColumn('tb_pdo', 'vendor');
                $hasJumlahInv = Schema::hasColumn('tb_pdo', 'jumlah_inv');
                $hasJumlahBayar = Schema::hasColumn('tb_pdo', 'jumlah_bayar');
                $hasTglBayar = Schema::hasColumn('tb_pdo', 'tgl_bayar');
                $hasLastPdo = Schema::hasColumn('tb_pdo', 'last_pdo');
                $hasPdoNow = Schema::hasColumn('tb_pdo', 'pdo_now');
                $hasLastEnd = Schema::hasColumn('tb_pdo', 'lastend_pdo');
                $hasRemark = Schema::hasColumn('tb_pdo', 'remark');

                $rows = [];
                foreach ($payload['items'] as $idx => $it) {
                    $pdoNow = (float) $it['pdo_now'];
                    if ($pdoNow < 0) {
                        throw new \RuntimeException('PDO Now tidak boleh minus.');
                    }

                    $jumlahInv = (float) ($it['jumlah_inv'] ?? 0);
                    $jumlahBayar = (float) ($it['jumlah_bayar'] ?? 0);

                    // Jika jumlah bayar = 0, tgl bayar isi spasi (kolom tidak boleh NULL)
                    $tglBayarRaw = ' ';
                    if ($jumlahBayar != 0.0) {
                        $tglBayarRaw = trim((string) $it['tgl_bayar']);
                        // normalize to dd.mm.yyyy
                        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $tglBayarRaw) === 1) {
                            $parts = explode('-', $tglBayarRaw);
                            $tglBayarRaw = $parts[2] . '.' . $parts[1] . '.' . $parts[0];
                        }
                        if (preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $tglBayarRaw) !== 1) {
                            throw new \RuntimeException('Tgl Bayar wajib format dd.mm.yyyy.');
                        }
                    }

                    $lastPdo = (float) ($it['last_pdo'] ?? 0);
                    $lastEnd = array_key_exists('lastend_pdo', $it) ? (float) $it['lastend_pdo'] : ($pdoNow + $jumlahBayar);

                    $row = [
                        'no_pdo' => $noPdo,
                        'posting_date' => $postingDate,
                    ];

                    if ($hasNoUrut) $row['no_urut'] = $idx + 1;
                    if ($hasNoFi) $row['no_fi'] = (string) $it['no_fi'];
                    if ($hasNoInv) $row['no_inv'] = (string) ($it['no_inv'] ?? '');
                    if ($hasInvDate) $row['inv_date'] = (string) ($it['inv_date'] ?? '');
                    if ($hasRefPo) $row['ref_po'] = (string) ($it['ref_po'] ?? '');
                    if ($hasVendor) $row['vendor'] = (string) ($it['vendor'] ?? '');
                    if ($hasJumlahInv) $row['jumlah_inv'] = $jumlahInv;
                    if ($hasJumlahBayar) $row['jumlah_bayar'] = $jumlahBayar;
                    if ($hasTglBayar) $row['tgl_bayar'] = $tglBayarRaw;
                    if ($hasLastPdo) $row['last_pdo'] = $lastPdo;
                    if ($hasPdoNow) $row['pdo_now'] = $pdoNow;
                    if ($hasLastEnd) $row['lastend_pdo'] = $lastEnd;
                    if ($hasRemark) $row['remark'] = (string) ($it['remark'] ?? '');

                    $rows[] = $row;
                }

                DB::table('tb_pdo')->insert($rows);

                // Update Jumlah_PDO in tb_kdinvin: add PDO Now per FI
                if (Schema::hasColumn('tb_kdinvin', 'Jumlah_PDO')) {
                    foreach ($rows as $row) {
                        if (!isset($row['no_fi']) || !isset($row['pdo_now'])) {
                            continue;
                        }
                        $noFi = (string) $row['no_fi'];
                        $pdoNow = (float) $row['pdo_now'];
                        DB::table('tb_kdinvin')
                            ->where('no_doc', $noFi)
                            ->update([
                                'Jumlah_PDO' => DB::raw('COALESCE(Jumlah_PDO, 0) + ' . (float) $pdoNow),
                            ]);
                    }
                }

                // Insert/update header tb_kdpdo (tanpa saldo kas bank/tunai, set 0 agar tidak NULL).
                if (Schema::hasTable('tb_kdpdo')) {
                    $sumJumlahInv = 0.0;
                    $sumJumlahBayar = 0.0;
                    $sumPdoNow = 0.0;

                    foreach ($rows as $row) {
                        $sumJumlahInv += (float) ($row['jumlah_inv'] ?? 0);
                        $sumJumlahBayar += (float) ($row['jumlah_bayar'] ?? 0);
                        $sumPdoNow += (float) ($row['pdo_now'] ?? 0);
                    }

                    $kdpdo = [
                        'no_pdo' => $noPdo,
                    ];

                    // Kolom yang benar: posting_date (tanpa fallback).
                    if (!Schema::hasColumn('tb_kdpdo', 'posting_date')) {
                        throw new \RuntimeException('Kolom posting_date tidak ditemukan di tb_kdpdo.');
                    }
                    $kdpdo['posting_date'] = $postingDate;

                    if (Schema::hasColumn('tb_kdpdo', 'kas_bank')) $kdpdo['kas_bank'] = 0;
                    if (Schema::hasColumn('tb_kdpdo', 'kas_tunai')) $kdpdo['kas_tunai'] = 0;
                    if (Schema::hasColumn('tb_kdpdo', 'jumlah_pdo')) $kdpdo['jumlah_pdo'] = $sumJumlahInv;
                    if (Schema::hasColumn('tb_kdpdo', 'jumlah_ditransfer')) $kdpdo['jumlah_ditransfer'] = $sumJumlahBayar;
                    if (Schema::hasColumn('tb_kdpdo', 'sisa_pdo')) $kdpdo['sisa_pdo'] = $sumPdoNow;

                    DB::table('tb_kdpdo')->updateOrInsert(
                        ['no_pdo' => $noPdo],
                        $kdpdo
                    );
                }

                return ['no_pdo' => $noPdo];
            });

            return redirect()->route('pembayaran.permintaan-dana-operasional.index')
                ->with('success', 'Berhasil menyimpan Permintaan Dana Operasional: ' . $result['no_pdo']);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function print(string $noPdo)
    {
        if (!Schema::hasTable('tb_pdo')) {
            abort(404);
        }

        $database = request()->session()->get('tenant.database')
            ?? request()->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
        }
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", $lookupKey)
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        $query = DB::table('tb_pdo')->where('no_pdo', $noPdo);
        if (Schema::hasColumn('tb_pdo', 'no_urut')) {
            $query->orderBy('no_urut');
        } else {
            $query->orderBy('no_inv')->orderBy('inv_date');
        }

        $details = $query->get();
        $header = $details->first();

        if (!$header) {
            abort(404);
        }

        $totals = [
            'jumlah_inv' => (int) $details->sum(function ($row) {
                return (float) ($row->jumlah_inv ?? 0);
            }),
            'jumlah_bayar' => (int) $details->sum(function ($row) {
                return (float) ($row->jumlah_bayar ?? 0);
            }),
            'pdo_now' => (int) $details->sum(function ($row) {
                return (float) ($row->pdo_now ?? 0);
            }),
            'lastend_pdo' => (int) $details->sum(function ($row) {
                return (float) ($row->lastend_pdo ?? 0);
            }),
        ];

        $printDate = Carbon::now()
            ->locale('id')
            ->translatedFormat('d F Y');

        return Inertia::render('Pembayaran/permintaan-dana-operasional/print', [
            'header' => $header,
            'details' => $details,
            'totals' => $totals,
            'company' => $company,
            'printDate' => $printDate,
        ]);
    }
}
