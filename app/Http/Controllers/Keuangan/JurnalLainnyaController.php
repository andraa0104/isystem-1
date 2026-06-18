<?php

namespace App\Http\Controllers\Keuangan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class JurnalLainnyaController
{
    private array $types = [
        'DOB' => ['label' => 'DO Biaya / Pemakaian Material', 'table' => 'tb_dobi', 'key' => 'no_alokasi', 'status' => 'status', 'main' => '1105AD', 'main_name' => 'PERSEDIAAN BARANG DAGANGAN', 'main_side' => 'Kredit'],
        'DOT' => ['label' => 'DO Tambah', 'table' => 'tb_dob', 'key' => 'no_dob', 'status' => 'status', 'main' => '1105AD', 'main_name' => 'PERSEDIAAN BARANG DAGANGAN', 'main_side' => 'Kredit'],
        'BKP' => ['label' => 'Biaya Kirim Pembelian', 'table' => 'tb_biayakirimbeli', 'key' => 'no_bkp', 'status' => 'trx_kas', 'main' => '5123AD', 'main_name' => 'BIAYA ANGKUT PEMBELIAN', 'main_side' => 'Debit'],
        'BKJ' => ['label' => 'Biaya Kirim Penjualan', 'table' => 'tb_biayakirimjual', 'key' => 'no_bkj', 'status' => 'jurnal', 'main' => '5124AD', 'main_name' => 'BIAYA ANGKUT PENJUALAN', 'main_side' => 'Debit'],
    ];

    private function getDatabaseCode(Request $request): string
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $db = is_string($database) ? trim($database) : '';
        $db = preg_replace('/[^a-zA-Z0-9]/', '', $db);
        $db = preg_replace('/^db/i', '', $db);
        $db = strtoupper($db);
        return $db !== '' ? $db : 'SJA';
    }

    private function nextKodeJurnal(string $dbCode): string
    {
        $unitUsaha = substr(strtoupper(trim($dbCode)), 0, 3);
        $prefix = $unitUsaha . '/JR/';
        $last = (string) (DB::table('tb_jurnal')
            ->orderByDesc('Kode_Jurnal')
            ->lockForUpdate()
            ->value('Kode_Jurnal') ?? '');

        $seq = 0;
        if ($last !== '') {
            $tail = substr($last, -8);
            if (preg_match('/^\d+$/', $tail)) $seq = (int) $tail;
        }
        return $prefix . str_pad((string) ($seq + 1), 8, '0', STR_PAD_LEFT);
    }

    private function accountName(string $akun): string
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Nama_Akun')) return '';
        return (string) (DB::table('tb_nabb')->where('Kode_Akun', $akun)->value('Nama_Akun') ?? '');
    }

    private function accountSaldo(string $akun): float
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Saldo')) return 0.0;
        return (float) (DB::table('tb_nabb')->where('Kode_Akun', $akun)->value('Saldo') ?? 0);
    }

    private function saldoAfter(string $akun, string $jenis, float $nominal): float
    {
        $saldo = $this->accountSaldo($akun);
        $isDebit = strtolower($jenis) === 'debit';
        $normalCredit = strtoupper(substr($akun, 4, 2)) === 'AK';
        if ($isDebit) return $saldo + ($normalCredit ? -abs($nominal) : abs($nominal));
        return $saldo + ($normalCredit ? abs($nominal) : -abs($nominal));
    }

    private function updateNabb(string $akun, float $debit, float $kredit, float $saldo): void
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) return;
        $cols = Schema::getColumnListing('tb_nabb');
        $row = [];
        if (in_array('BB_Debit', $cols, true)) $row['BB_Debit'] = DB::raw('COALESCE(BB_Debit,0) + ' . round($debit, 2));
        if (in_array('BB_Kredit', $cols, true)) $row['BB_Kredit'] = DB::raw('COALESCE(BB_Kredit,0) + ' . round($kredit, 2));
        if (in_array('Saldo', $cols, true)) $row['Saldo'] = round($saldo, 2);
        if ($row) DB::table('tb_nabb')->where('Kode_Akun', $akun)->update($row);
    }

    private function accountOptions(): array
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) return [];
        $hasName = Schema::hasColumn('tb_nabb', 'Nama_Akun');
        return DB::table('tb_nabb')
            ->select(['Kode_Akun', $hasName ? 'Nama_Akun' : DB::raw("'' as Nama_Akun")])
            ->whereNotNull('Kode_Akun')
            ->orderBy('Kode_Akun')
            ->limit(5000)
            ->get()
            ->map(fn ($r) => [
                'value' => trim((string) $r->Kode_Akun),
                'label' => trim((string) $r->Nama_Akun) !== '' ? trim((string) $r->Kode_Akun) . ' - ' . trim((string) $r->Nama_Akun) : trim((string) $r->Kode_Akun),
            ])
            ->filter(fn ($r) => $r['value'] !== '')
            ->values()
            ->all();
    }

    private function amountExpression(string $table): string
    {
        $cols = Schema::hasTable($table) ? Schema::getColumnListing($table) : [];
        foreach (['total', 'sisa', 'jumlah', 'nilai', 'nominal', 'harga', 'total_price'] as $c) {
            if (in_array($c, $cols, true)) return "COALESCE($c,0)";
        }
        return '0';
    }

    private function refQuery(string $type)
    {
        $cfg = $this->types[$type] ?? null;
        if (!$cfg || !Schema::hasTable($cfg['table'])) return null;
        $cols = Schema::getColumnListing($cfg['table']);
        if (!in_array($cfg['key'], $cols, true)) return null;

        $amount = $this->amountExpression($cfg['table']);
        $q = DB::table($cfg['table'])
            ->selectRaw($cfg['key'] . ' as ref_no')
            ->selectRaw('SUM(' . $amount . ') as nominal')
            ->groupBy($cfg['key'])
            ->orderByDesc($cfg['key']);

        if ($type === 'DOB' || $type === 'DOT') {
            if (in_array('status', $cols, true)) $q->whereRaw('COALESCE(status,0) = 0');
        } elseif ($type === 'BKP') {
            if (in_array('trx_kas', $cols, true)) $q->whereRaw("TRIM(COALESCE(trx_kas,'')) = ''");
        } elseif ($type === 'BKJ') {
            if (in_array('jurnal', $cols, true)) $q->whereRaw("TRIM(COALESCE(jurnal,'')) = ''");
        }

        return $q;
    }

    public function index(Request $request)
    {
        return Inertia::render('keuangan/jurnal-lainnya/index', [
            'types' => $this->types,
            'filters' => ['search' => (string) $request->query('search', '')],
        ]);
    }

    public function create()
    {
        return Inertia::render('keuangan/jurnal-lainnya/create', [
            'types' => $this->types,
            'accountOptions' => $this->accountOptions(),
        ]);
    }

    public function rows(Request $request)
    {
        if (!Schema::hasTable('tb_jurnal')) return response()->json(['rows' => [], 'total' => 0]);
        $page = max(1, (int) $request->query('page', 1));
        $pageSize = (int) $request->query('pageSize', 10);
        $pageSize = max(5, min(100, $pageSize));

        $detailAgg = DB::table('tb_jurnaldetail as d')
            ->selectRaw('d.Kode_Jurnal')
            ->selectRaw('SUM(COALESCE(d.Debit,0)) as total_debit')
            ->selectRaw('SUM(COALESCE(d.Kredit,0)) as total_kredit')
            ->selectRaw('COUNT(*) as akun_count')
            ->selectRaw("GROUP_CONCAT(d.Kode_Akun ORDER BY d.Kode_Akun SEPARATOR ', ') as akun_list")
            ->groupBy('d.Kode_Jurnal');

        $q = DB::table('tb_jurnal as j')
            ->leftJoinSub($detailAgg, 'a', 'a.Kode_Jurnal', '=', 'j.Kode_Jurnal');
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $q->where(function ($qq) use ($search) {
                $qq->where('j.Kode_Jurnal', 'like', '%' . $search . '%')
                    ->orWhere('j.Kode_Voucher', 'like', '%' . $search . '%')
                    ->orWhere('j.Remark', 'like', '%' . $search . '%')
                    ->orWhere('a.akun_list', 'like', '%' . $search . '%');
            });
        }
        $q->where(function ($qq) {
            $qq->where('j.Kode_Voucher', 'PENJUALAN')
                ->orWhere('j.Remark', 'like', '%PEMBEBANAN%')
                ->orWhere('j.Remark', 'like', '%HUTANG BIAYA ANGKUT%');
        });
        $total = (clone $q)->count();
        $rows = $q->select([
                'j.Kode_Jurnal',
                'j.Kode_Voucher',
                'j.Tgl_Jurnal',
                'j.Tgl_Buat',
                'j.Remark',
                DB::raw('COALESCE(a.total_debit,0) as total_debit'),
                DB::raw('COALESCE(a.total_kredit,0) as total_kredit'),
                DB::raw('COALESCE(a.akun_count,0) as akun_count'),
                DB::raw("COALESCE(a.akun_list,'') as akun_list"),
            ])
            ->orderByDesc('j.Tgl_Jurnal')
            ->orderByDesc('j.Kode_Jurnal')
            ->forPage($page, $pageSize)
            ->get();

        return response()->json([
            'rows' => $rows,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
        ]);
    }

    public function refRows(Request $request)
    {
        $type = strtoupper(trim((string) $request->query('type', 'DOB')));
        if (!isset($this->types[$type])) return response()->json(['rows' => [], 'total' => 0]);
        $q = $this->refQuery($type);
        if (!$q) return response()->json(['rows' => [], 'total' => 0]);
        $rows = $q->limit(500)->get()->map(fn ($r) => [
            'ref_no' => (string) ($r->ref_no ?? ''),
            'nominal' => (float) ($r->nominal ?? 0),
        ])->values()->all();
        return response()->json(['rows' => $rows, 'total' => count($rows)]);
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'type' => ['required', 'string'],
            'ref_no' => ['required', 'string'],
            'tgl_jurnal' => ['required', 'date'],
            'keterangan' => ['required', 'string'],
            'nominal' => ['required', 'numeric', 'min:0.01'],
            'akun_lawan' => ['required', 'string'],
            'jenis_lawan' => ['required', 'string'],
            'invoice_no' => ['nullable', 'string'],
            'hppdot_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        $type = strtoupper(trim((string) $payload['type']));
        if (!isset($this->types[$type])) return back()->with('error', 'Tipe jurnal tidak valid.');
        if (!Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnaldetail')) return back()->with('error', 'Tabel jurnal belum lengkap.');

        $cfg = $this->types[$type];
        $nominal = round((float) $payload['nominal'], 2);
        $tgl = Carbon::parse($payload['tgl_jurnal'])->toDateString();
        $remark = trim((string) $payload['keterangan']);
        $akunLawan = trim((string) $payload['akun_lawan']);
        $jenisLawan = strtolower((string) $payload['jenis_lawan']) === 'kredit' ? 'Kredit' : 'Debit';
        $jenisMain = (string) $cfg['main_side'];

        $lines = [
            [
                'akun' => $cfg['main'],
                'nama' => $cfg['main_name'],
                'jenis' => $jenisMain,
                'debit' => $jenisMain === 'Debit' ? $nominal : 0,
                'kredit' => $jenisMain === 'Kredit' ? $nominal : 0,
            ],
            [
                'akun' => $akunLawan,
                'nama' => $this->accountName($akunLawan),
                'jenis' => $jenisLawan,
                'debit' => $jenisLawan === 'Debit' ? $nominal : 0,
                'kredit' => $jenisLawan === 'Kredit' ? $nominal : 0,
            ],
        ];

        $sumDebit = round(array_sum(array_column($lines, 'debit')), 2);
        $sumKredit = round(array_sum(array_column($lines, 'kredit')), 2);
        if ($sumDebit !== $sumKredit) return back()->with('error', 'Jurnal tidak balance.');

        return DB::transaction(function () use ($request, $type, $cfg, $payload, $tgl, $remark, $lines) {
            $kodeJurnal = $this->nextKodeJurnal($this->getDatabaseCode($request));
            DB::table('tb_jurnal')->updateOrInsert(
                ['Kode_Jurnal' => $kodeJurnal],
                ['Kode_Voucher' => 'PENJUALAN', 'Tgl_Jurnal' => $tgl, 'Tgl_Buat' => Carbon::now()->toDateString(), 'Remark' => $remark]
            );

            foreach ($lines as $line) {
                DB::table('tb_jurnaldetail')->updateOrInsert(
                    ['Kode_Jurnal' => $kodeJurnal, 'Kode_Akun' => $line['akun']],
                    ['Debit' => $line['debit'] > 0 ? $line['debit'] : null, 'Kredit' => $line['kredit'] > 0 ? $line['kredit'] : null]
                );
                $this->updateNabb($line['akun'], (float) $line['debit'], (float) $line['kredit'], $this->saldoAfter($line['akun'], $line['jenis'], max((float) $line['debit'], (float) $line['kredit'])));
            }

            if (Schema::hasTable($cfg['table']) && Schema::hasColumn($cfg['table'], $cfg['key'])) {
                if ($type === 'DOB' && Schema::hasColumn($cfg['table'], 'status')) {
                    DB::table($cfg['table'])->where($cfg['key'], $payload['ref_no'])->update(['status' => 1]);
                } elseif ($type === 'DOT' && Schema::hasColumn($cfg['table'], 'status')) {
                    DB::table($cfg['table'])->where($cfg['key'], $payload['ref_no'])->update(['status' => 1]);
                    $invoice = trim((string) ($payload['invoice_no'] ?? ''));
                    if ($invoice !== '' && Schema::hasTable('tb_kdfakturpenjualan') && Schema::hasColumn('tb_kdfakturpenjualan', 'HPPDOT')) {
                        DB::table('tb_kdfakturpenjualan')->where('no_fakturpenjualan', $invoice)->update(['HPPDOT' => (float) ($payload['hppdot_total'] ?? 0)]);
                    }
                } elseif ($type === 'BKP' && Schema::hasColumn($cfg['table'], 'trx_kas')) {
                    DB::table($cfg['table'])->where($cfg['key'], $payload['ref_no'])->update(['trx_kas' => '2101AK']);
                } elseif ($type === 'BKJ' && Schema::hasColumn($cfg['table'], 'jurnal')) {
                    DB::table($cfg['table'])->where($cfg['key'], $payload['ref_no'])->update(['jurnal' => '2101AK']);
                }
            }

            return redirect()->route('keuangan.jurnal-lainnya.index', ['search' => $kodeJurnal])
                ->with('success', 'Jurnal lainnya tersimpan: ' . $kodeJurnal);
        });
    }
}
