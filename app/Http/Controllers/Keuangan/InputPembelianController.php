<?php

namespace App\Http\Controllers\Keuangan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class InputPembelianController
{
    private ?string $pythonSuggestError = null;

    private function n(float|int|string|null $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function scalar(string $table, string $selectRaw, ?callable $where = null): float
    {
        if (!Schema::hasTable($table)) return 0.0;

        try {
            $q = DB::table($table);
            if ($where) $where($q);
            return $this->n($q->selectRaw($selectRaw . ' as v')->value('v'));
        } catch (\Throwable) {
            return 0.0;
        }
    }

    private function nabbSaldo(string $akun): float
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Saldo')) return 0.0;
        return $this->n(DB::table('tb_nabb')->where('Kode_Akun', $akun)->value('Saldo'));
    }

    private function neracaValue(string $akun, string $column): float
    {
        if (!Schema::hasTable('tb_neracalajur') || !Schema::hasColumn('tb_neracalajur', $column)) return 0.0;
        return $this->n(DB::table('tb_neracalajur')->where('Kode_Akun', $akun)->value($column));
    }

    private function latestKasByType(string $type): array
    {
        if (!Schema::hasTable('tb_kas')) return ['saldo' => 0.0, 'tgl' => null];
        try {
            $row = DB::table('tb_kas')
                ->whereRaw('MID(Kode_Voucher, 5, 2) = ?', [$type])
                ->orderByDesc('Kode_Voucher')
                ->first(['Saldo', 'Tgl_Voucher']);
            return [
                'saldo' => $this->n($row->Saldo ?? 0),
                'tgl' => $row->Tgl_Voucher ?? null,
            ];
        } catch (\Throwable) {
            return ['saldo' => 0.0, 'tgl' => null];
        }
    }

    private function getInfoHuSummary(): array
    {
        $huPo = $this->scalar('tb_kdinvin', 'SUM(sisa_bayar)');
        $huBkp = $this->scalar('tb_biayakirimbeli', 'SUM(sisa)');
        $huBkj = $this->scalar('tb_biayakirimjual', 'SUM(sisa)');
        $hutangBb = $this->nabbSaldo('2101AK');

        $mi = [
            'mis' => $this->scalar('tb_mi', 'SUM(harga_mis)'),
            'mib' => $this->scalar('tb_mi', 'SUM(harga_mib)'),
            'mibs' => $this->scalar('tb_mib', 'SUM(total_price)'),
            'material' => $this->scalar('tb_material', 'SUM(stok * harga)'),
            'do_outstanding' => $this->scalar('tb_do', 'SUM(total)', fn ($q) => $q->whereRaw('COALESCE(Val_inv,0) <> 1')),
            'dob' => $this->scalar('tb_dobi', 'SUM(total)', fn ($q) => $q->whereRaw('COALESCE(status,0) = 0')),
            'dot' => $this->scalar('tb_dob', 'SUM(total)', fn ($q) => $q->whereRaw('COALESCE(status,0) = 0')),
            'buku' => $this->nabbSaldo('1105AD'),
        ];
        $mi['fisik'] = $mi['mis'] + $mi['mib'] + $mi['mibs'] + $mi['material'] + $mi['do_outstanding'] + $mi['dob'] + $mi['dot'];
        $mi['balance'] = $mi['fisik'] - $mi['buku'];

        $kasTunai = $this->latestKasByType('CV');
        $kasBank = $this->latestKasByType('BV');
        $kasGiro = $this->latestKasByType('GV');

        $belum = [
            'invin' => $this->scalar('tb_kdinvin', 'SUM(sisa_bayar)', fn ($q) => $q->whereNull('ref_vc')->where('sisa_bayar', '>', 0)),
            'faktur_jual' => $this->scalar('tb_kdfakturpenjualan', 'SUM(saldo_piutang)', fn ($q) => $q->whereRaw("TRIM(COALESCE(trx_jurnal,'')) = ''")->where('saldo_piutang', '>', 0)),
            'do_tambah' => $mi['dot'],
            'do_biaya' => $mi['dob'],
            'bkb' => $this->scalar('tb_biayakirimbeli', 'SUM(sisa)', fn ($q) => $q->where('sisa', '>', 0)->whereRaw("TRIM(COALESCE(trx_kas,'')) = ''")),
            'bkj' => $this->scalar('tb_biayakirimjual', 'SUM(sisa)', fn ($q) => $q->where('sisa', '>', 0)->whereRaw("TRIM(COALESCE(jurnal,'')) = ''")),
            'lainnya' => $this->scalar('tb_bayar', 'SUM(sisa)', fn ($q) => $q->where('sisa', '>', 0)),
        ];
        $belum['total'] = array_sum($belum);

        return [
            'hutang' => [
                'po' => $huPo,
                'bkp' => $huBkp,
                'bkj' => $huBkj,
                'total' => $huPo + $huBkp + $huBkj,
                'buku_besar' => $hutangBb,
                'balance' => ($huPo + $huBkp + $huBkj) - $hutangBb,
            ],
            'persediaan' => $mi,
            'dana' => [
                'kas_tunai' => $kasTunai,
                'kas_bank' => $kasBank,
                'kas_giro' => $kasGiro,
                'total_kas' => $kasTunai['saldo'] + $kasBank['saldo'] + $kasGiro['saldo'],
                'piutang' => $this->nabbSaldo('1109AD'),
                'pdo' => $this->scalar('tb_kdpdo', 'SUM(sisa_pdo)'),
                'pdb' => $this->scalar('tb_kdpdb', 'SUM(sisa)'),
            ],
            'belum_jurnal' => $belum,
            'laba_rugi' => [
                'penjualan' => $this->nabbSaldo('4101AK'),
                'penjualan_bl' => $this->neracaValue('4101AK', 'RL_Kredit'),
                'hpp' => $this->nabbSaldo('6100AD'),
                'hpp_bl' => $this->neracaValue('6100AD', 'RL_Debit'),
            ],
        ];
    }

    private function normalizeJenisBeban(?string $jenis): string
    {
        $j = strtoupper(trim((string) $jenis));
        return $j === 'KREDIT' ? 'Kredit' : 'Debit';
    }

    private function buildDefaultKeterangan(object $fi): string
    {
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        $vendor = trim((string) ($fi->nm_vdr ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        $ket = 'Pembelian/FI ' . $noDoc;
        if ($vendor !== '') $ket .= ' — ' . $vendor;
        if ($refPo !== '') $ket .= ' (PO ' . $refPo . ')';
        return $ket;
    }

    private function buildKeteranganTemplate(string $keterangan): string
    {
        $k = trim($keterangan);
        if ($k === '') return '';

        // Normalize whitespace
        $k = preg_replace('/\\s+/', ' ', $k) ?? $k;

        // Replace FI tokens with placeholder
        $k = preg_replace('/\\b(No\\.)?\\s*FI\\s*[-:]?\\s*[A-Z0-9]+\\b/i', '{FI}', $k) ?? $k;
        $k = preg_replace('/\\bFI\\s*[-:]?\\s*[A-Z0-9]+\\b/i', '{FI}', $k) ?? $k;

        // Replace PO tokens with placeholder
        $k = preg_replace('/\\bPO\\s*[-:]?\\s*[A-Z0-9\\.\\-\\/]+\\b/i', 'PO {PO}', $k) ?? $k;

        return trim($k);
    }

    private function renderKeteranganFromTemplate(string $template, object $fi): string
    {
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        $out = $template !== '' ? $template : $this->buildDefaultKeterangan($fi);
        $out = str_replace('{FI}', $noDoc !== '' ? $noDoc : '{FI}', $out);
        $out = str_replace('{PO}', $refPo !== '' ? $refPo : '{PO}', $out);
        $out = preg_replace('/\\s+/', ' ', $out) ?? $out;

        return trim($out);
    }

    private function suggestKeterangan(object $fi): string
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Keterangan')) {
            return $this->buildDefaultKeterangan($fi);
        }

        $vendorKey = $this->buildVendorKey((string) ($fi->nm_vdr ?? ''));
        $refPo = trim((string) ($fi->ref_po ?? ''));

        // Candidate from historical tb_kas.
        $q = DB::table('tb_kas as k')
            ->where('k.Keterangan', 'like', '%FI%')
            ->orderByDesc('k.Tgl_Voucher')
            ->orderByDesc('k.Kode_Voucher')
            ->limit(200)
            ->get(['k.Keterangan', 'k.Tgl_Voucher']);

        $bestTemplate = '';
        $bestScore = -1;

        foreach ($q as $r) {
            $ket = trim((string) ($r->Keterangan ?? ''));
            if ($ket === '') continue;

            $score = 0;
            $lower = strtolower($ket);
            if ($vendorKey !== '' && str_contains($lower, $vendorKey)) $score += 3;
            if ($refPo !== '' && str_contains($lower, strtolower($refPo))) $score += 3;
            if (str_contains($lower, 'pembelian')) $score += 1;

            $tpl = $this->buildKeteranganTemplate($ket);
            if ($tpl === '') continue;

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestTemplate = $tpl;
            }
        }

        $rendered = $this->renderKeteranganFromTemplate($bestTemplate, $fi);

        // Ensure FI number appears
        $noDoc = trim((string) ($fi->no_doc ?? ''));
        if ($noDoc !== '' && !str_contains(strtoupper($rendered), strtoupper($noDoc))) {
            $rendered = $this->buildDefaultKeterangan($fi);
        }

        return $rendered;
    }

    private function getDatabaseCode(Request $request): string
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');

        $db = is_string($database) ? trim($database) : '';
        if ($db === '') return 'SJA';

        // Common patterns: "dbsja" => "SJA", "SJA" => "SJA"
        $db = preg_replace('/[^a-zA-Z0-9]/', '', $db);
        $db = preg_replace('/^db/i', '', $db);
        $db = strtoupper($db);

        return $db !== '' ? $db : 'SJA';
    }

    private function guessVoucherType(string $kodeAkun): string
    {
        $a = strtoupper(trim((string) $kodeAkun));
        if (str_starts_with($a, '1101')) return 'CV';
        if (str_starts_with($a, '1102')) return 'GV';
        if (str_starts_with($a, '1103')) return 'BV';
        if (str_starts_with($a, '1104')) return 'SC';
        return 'BV';
    }

    private function nextKodeJurnal(string $dbCode): string
    {
        if (!Schema::hasTable('tb_jurnal') || !Schema::hasColumn('tb_jurnal', 'Kode_Jurnal')) {
            return '';
        }

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

    private function journalAvailable(): bool
    {
        if (!Schema::hasTable('tb_jurnal') || !Schema::hasTable('tb_jurnaldetail')) return false;
        foreach (['Kode_Jurnal', 'Tgl_Jurnal'] as $c) {
            if (!Schema::hasColumn('tb_jurnal', $c)) return false;
        }
        foreach (['Kode_Jurnal', 'Kode_Akun', 'Debit', 'Kredit'] as $c) {
            if (!Schema::hasColumn('tb_jurnaldetail', $c)) return false;
        }
        return true;
    }

    private function insertJurnalHeader(string $kodeJurnal, string $kodeVoucher, string $tglVoucher, string $keterangan): void
    {
        if ($kodeJurnal === '' || !Schema::hasTable('tb_jurnal')) return;

        $cols = Schema::getColumnListing('tb_jurnal');
        $row = ['Kode_Jurnal' => $kodeJurnal, 'Tgl_Jurnal' => $tglVoucher];
        if (in_array('Kode_Voucher', $cols, true)) $row['Kode_Voucher'] = $kodeVoucher;
        if (in_array('Tgl_Buat', $cols, true)) $row['Tgl_Buat'] = Carbon::now()->toDateString();
        if (in_array('Remark', $cols, true)) $row['Remark'] = $keterangan;

        DB::table('tb_jurnal')->updateOrInsert(['Kode_Jurnal' => $kodeJurnal], $row);
    }

    /**
     * @param array<int,array{akun:string,debit:float,kredit:float,saldo:float}> $details
     */
    private function insertJurnalDetailsAndUpdateNabb(string $kodeJurnal, array $details): void
    {
        if ($kodeJurnal === '' || !Schema::hasTable('tb_jurnaldetail')) return;

        foreach ($details as $d) {
            $akun = trim((string) ($d['akun'] ?? ''));
            if ($akun === '') continue;

            $debit = round(max(0.0, (float) ($d['debit'] ?? 0)), 2);
            $kredit = round(max(0.0, (float) ($d['kredit'] ?? 0)), 2);

            DB::table('tb_jurnaldetail')->updateOrInsert(
                ['Kode_Jurnal' => $kodeJurnal, 'Kode_Akun' => $akun],
                ['Debit' => $debit > 0 ? $debit : null, 'Kredit' => $kredit > 0 ? $kredit : null]
            );

            $this->updateNabbBalance($akun, $debit, $kredit, (float) ($d['saldo'] ?? 0));
        }
    }

    private function updateNabbBalance(string $kodeAkun, float $debit, float $kredit, float $saldo): void
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) return;

        $cols = Schema::getColumnListing('tb_nabb');
        $row = [];
        if (in_array('BB_Debit', $cols, true)) {
            $row['BB_Debit'] = DB::raw('COALESCE(BB_Debit,0) + ' . round($debit, 2));
        }
        if (in_array('BB_Kredit', $cols, true)) {
            $row['BB_Kredit'] = DB::raw('COALESCE(BB_Kredit,0) + ' . round($kredit, 2));
        }
        if (in_array('Saldo', $cols, true)) {
            $row['Saldo'] = round($saldo, 2);
        }
        if (count($row) === 0) return;

        DB::table('tb_nabb')->where('Kode_Akun', $kodeAkun)->update($row);
    }

    private function saldoAfterJournalLine(string $kodeAkun, string $jenis, float $nominal): float
    {
        $saldo = 0.0;
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun') && Schema::hasColumn('tb_nabb', 'Saldo')) {
            $saldo = (float) (DB::table('tb_nabb')->where('Kode_Akun', $kodeAkun)->value('Saldo') ?? 0);
        }

        $isDebit = $this->normalizeJenisBeban($jenis) === 'Debit';
        $isCreditNormal = strtoupper(substr($kodeAkun, 4, 2)) === 'AK';
        if ($isDebit) return $saldo + ($isCreditNormal ? -abs($nominal) : abs($nominal));
        return $saldo + ($isCreditNormal ? abs($nominal) : -abs($nominal));
    }

    private function buildKasSelect(): array
    {
        $cols = Schema::getColumnListing('tb_kas');
        $hasTglBuat = in_array('Tgl_Buat', $cols, true);

        return [
            'k.Kode_Voucher',
            'k.Kode_Akun',
            'k.Tgl_Voucher',
            $hasTglBuat ? 'k.Tgl_Buat' : DB::raw("'' as Tgl_Buat"),
            'k.Keterangan',
            DB::raw('COALESCE(k.Mutasi_Kas,0) as Mutasi_Kas'),
            DB::raw('COALESCE(k.Saldo,0) as Saldo'),
        ];
    }

    private function nabbNameAvailable(): bool
    {
        return Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Nama_Akun');
    }

    private function getAccountOptions(): array
    {
        if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', 'Kode_Akun')) {
            return [];
        }

        $nabbName = $this->nabbNameAvailable();
        try {
            $codes = DB::table('tb_kas as k')
                ->selectRaw('DISTINCT k.Kode_Akun as Kode_Akun')
                ->whereNotNull('k.Kode_Akun')
                ->orderBy('Kode_Akun', 'asc')
                ->pluck('Kode_Akun')
                ->map(fn ($c) => (string) $c)
                ->filter()
                ->values()
                ->all();

            if (!$nabbName || count($codes) === 0) {
                return array_map(fn ($c) => ['value' => $c, 'label' => $c], $codes);
            }

            $names = DB::table('tb_nabb')
                ->whereIn('Kode_Akun', $codes)
                ->pluck('Nama_Akun', 'Kode_Akun');

            return array_map(function ($c) use ($names) {
                $name = (string) ($names[$c] ?? '');
                return [
                    'value' => $c,
                    'label' => $name !== '' ? ($c . ' — ' . $name) : $c,
                ];
            }, $codes);
        } catch (\Throwable) {
            return [];
        }
    }

    private function getDefaultAccount(): ?string
    {
        $preferred = ['1101AD', '1102AD', '1103AD', '1104AD'];
        $opts = $this->getAccountOptions();
        $values = collect($opts)->pluck('value')->map(fn ($v) => (string) $v)->all();

        foreach ($preferred as $code) {
            if (in_array($code, $values, true)) {
                return $code;
            }
        }

        return $opts[0]['value'] ?? null;
    }

    private function getExpenseAccountOptions(): array
    {
        // Prefer chart of accounts table if available.
        if (Schema::hasTable('tb_nabb') && Schema::hasColumn('tb_nabb', 'Kode_Akun')) {
            $hasName = Schema::hasColumn('tb_nabb', 'Nama_Akun');
            try {
                $q = DB::table('tb_nabb')
                    ->select([
                        'Kode_Akun',
                        $hasName ? 'Nama_Akun' : DB::raw("'' as Nama_Akun"),
                    ])
                    ->whereNotNull('Kode_Akun')
                    ->orderBy('Kode_Akun', 'asc')
                    ->limit(5000);

                return $q->get()->map(function ($r) {
                    $code = trim((string) ($r->Kode_Akun ?? ''));
                    if ($code === '') return null;
                    $name = trim((string) ($r->Nama_Akun ?? ''));
                    return [
                        'value' => $code,
                        'label' => $name !== '' ? ($code . ' — ' . $name) : $code,
                    ];
                })->filter()->values()->all();
            } catch (\Throwable) {
                // fallback below
            }
        }

        // Fallback: reuse cash/bank options if NABB not present.
        return $this->getAccountOptions();
    }

    public function index(Request $request)
    {
        $defaultAccount = $this->getDefaultAccount();

        return Inertia::render('keuangan/input-pembelian/index', [
            'filters' => [
                'search' => (string) $request->query('search', ''),
                // Default to 'all' so user can see historical data even if it was posted to bank accounts.
                'account' => (string) $request->query('account', 'all'),
                'period' => (string) $request->query('period', Carbon::now()->format('Ym')),
                'pageSize' => (int) $request->query('pageSize', 10),
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $defaultAccount,
        ]);
    }

    public function create()
    {
        return Inertia::render('keuangan/input-pembelian/create', [
            'filters' => [
                'search' => '',
                'status' => 'belum_dijurnal',
                'pageSize' => 10,
            ],
            'accountOptions' => $this->getAccountOptions(),
            'defaultAccount' => $this->getDefaultAccount(),
            'expenseAccountOptions' => $this->getExpenseAccountOptions(),
            'infoHu' => $this->getInfoHuSummary(),
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['rows' => [], 'total' => 0, 'error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $account = (string) $request->query('account', 'all');
            $period = trim((string) $request->query('period', ''));
            $pageSizeRaw = $request->query('pageSize', 10);
            $pageRaw = $request->query('page', 1);

            $page = max(1, (int) $pageRaw);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

            $cols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $cols, true)) {
                    return response()->json(['rows' => [], 'total' => 0, 'error' => "Kolom tb_kas.$col tidak ditemukan."], 500);
                }
            }

            $start = null;
            $end = null;
            if ($period !== '') {
                if (preg_match('/^\\d{6}$/', $period)) {
                    $month = Carbon::createFromFormat('Ym', $period)->startOfMonth();
                    $start = $month->copy()->startOfMonth()->toDateString();
                    $end = $month->copy()->endOfMonth()->toDateString();
                } elseif (preg_match('/^\\d{4}$/', $period)) {
                    $year = Carbon::createFromFormat('Y', $period)->startOfYear();
                    $start = $year->copy()->startOfYear()->toDateString();
                    $end = $year->copy()->endOfYear()->toDateString();
                }
            }

            $q = DB::table('tb_kas as k');

            if ($start && $end) {
                $q->whereBetween('k.Tgl_Voucher', [$start, $end]);
            }

            if ($account !== '' && $account !== 'all') {
                $q->where('k.Kode_Akun', '=', $account);
            }

            // "Input Pembelian" dikenali dari voucher type (GV/BV) + keterangan pembelian FI.
            // Catatan: data historis bisa memakai prefix berbeda (tanpa kode DB), jadi jangan dikunci ke $dbCode saja.
            $q->where(function ($qq) {
                $qq->where('k.Kode_Voucher', 'like', '%/CV/%')
                    ->orWhere('k.Kode_Voucher', 'like', '%/GV/%')
                    ->orWhere('k.Kode_Voucher', 'like', '%/BV/%')
                    ->orWhere('k.Kode_Voucher', 'like', 'CV%')
                    ->orWhere('k.Kode_Voucher', 'like', 'GV%')
                    ->orWhere('k.Kode_Voucher', 'like', 'BV%');
            });
            // Historical data sometimes uses "No.FIxxxx" instead of "Pembelian/FI ...".
            $q->where(function ($qq) {
                $qq->where('k.Keterangan', 'like', '%Pembelian/FI%')
                    ->orWhere('k.Keterangan', 'like', '%FI%');
            });

            if ($search !== '') {
                $term = '%' . $search . '%';
                $q->where(function ($qq) use ($term) {
                    $qq->where('k.Kode_Voucher', 'like', $term)
                        ->orWhere('k.Keterangan', 'like', $term);
                });
            }

            $total = (int) (clone $q)->count();

            $q->orderByDesc('k.Tgl_Voucher')->orderByDesc('k.Kode_Voucher');

            if ($pageSize !== 'all') {
                $q->forPage($page, $pageSize);
            }

            $rows = $q->get($this->buildKasSelect());

            return response()->json([
                'rows' => $rows,
                'total' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function fiRows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['rows' => [], 'total' => 0, 'error' => 'Tabel tb_kdinvin tidak ditemukan.'], 500);
            }

            $search = trim((string) $request->query('search', ''));
            $status = (string) $request->query('status', 'belum_dijurnal');
            $pageSizeRaw = $request->query('pageSize', 10);
            $pageRaw = $request->query('page', 1);

            $page = max(1, (int) $pageRaw);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);

            $q = DB::table('tb_kdinvin');

            if ($search !== '') {
                $term = '%' . $search . '%';
                $q->where(function ($qq) use ($term) {
                    $qq->where('no_doc', 'like', $term)
                        ->orWhere('ref_po', 'like', $term)
                        ->orWhere('nm_vdr', 'like', $term);
                });
            }

            if ($status === 'belum_dijurnal') {
                $q->where(function ($qq) {
                    $qq->whereNull('jurnal')
                        ->orWhereRaw("TRIM(COALESCE(jurnal,'')) = ''");
                });
            } elseif ($status === 'sudah_dijurnal') {
                $q->whereRaw("TRIM(COALESCE(jurnal,'')) <> ''");
            }

            $total = (int) (clone $q)->count();

            $q->orderByDesc('no_doc');

            if ($pageSize !== 'all') {
                $q->forPage($page, $pageSize);
            }

            $rows = $q->get([
                'no_doc',
                'doc_rec',
                'inv_d',
                'ref_po',
                'nm_vdr',
                'total',
                'pembayaran',
                'sisa_bayar',
                'tgl_bayar',
                'jurnal',
            ]);

            return response()->json([
                'rows' => $rows,
                'total' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['rows' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function fiDetail(string $noDoc)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['header' => null, 'ppn_percent' => null, 'error' => 'Tabel tb_kdinvin tidak ditemukan.'], 404);
            }

            $header = DB::table('tb_kdinvin')
                ->where('no_doc', $noDoc)
                ->first();

            if (!$header) {
                return response()->json(['header' => null, 'ppn_percent' => null, 'error' => 'FI tidak ditemukan.'], 404);
            }

            $ppnPercent = null;
            $refPo = trim((string) ($header->ref_po ?? ''));
            if ($refPo !== '' && Schema::hasTable('tb_po') && Schema::hasColumn('tb_po', 'no_po') && Schema::hasColumn('tb_po', 'ppn')) {
                $val = DB::table('tb_po')->where('no_po', $refPo)->value('ppn');
                if ($val !== null && $val !== '') {
                    $ppnPercent = (float) $val;
                }
            }

            return response()->json([
                'header' => [
                    'no_doc' => (string) ($header->no_doc ?? ''),
                    'ref_po' => (string) ($header->ref_po ?? ''),
                    'nm_vdr' => (string) ($header->nm_vdr ?? ''),
                    'total' => (float) ($header->total ?? 0),
                    'tax' => (float) ($header->tax ?? 0),
                    'pembayaran' => (float) ($header->pembayaran ?? 0),
                    'tgl_bayar' => (string) ($header->tgl_bayar ?? ''),
                    'inv_d' => (string) ($header->inv_d ?? ''),
                    'jurnal' => (string) ($header->jurnal ?? ''),
                ],
                'ppn_percent' => $ppnPercent,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['header' => null, 'ppn_percent' => null, 'error' => $e->getMessage()], 500);
        }
    }

    private function computeAllocation(object $fiHeader, float $cashNominal): array
    {
        $headerTotal = (float) ($fiHeader->total ?? 0);
        $headerTax = max(0.0, (float) ($fiHeader->tax ?? 0));
        $headerDpp = max(0.0, $headerTotal - $headerTax);

        $cashNominal = max(0.0, $cashNominal);
        $ratio = ($headerTotal > 0) ? min(1.0, max(0.0, $cashNominal / $headerTotal)) : 1.0;

        return [
            'cash' => $cashNominal,
            'dpp' => round($headerDpp * $ratio, 2),
            'tax' => round($headerTax * $ratio, 2),
        ];
    }

    private function buildVendorKey(?string $vendor): string
    {
        $vendor = strtolower(trim((string) $vendor));
        $vendor = preg_replace('/\\s+/', ' ', $vendor);
        return $vendor;
    }

    private function suggestFromPython(object $fi, array $alloc, bool $hasPpn): ?array
    {
        $this->pythonSuggestError = null;

        try {
            $base = rtrim((string) env('KAS_DSS_PYTHON_URL', 'http://127.0.0.1:8000'), '/');
            $resp = Http::timeout(8)->acceptJson()->post($base . '/predict-input-pembelian', [
                'no_doc' => (string) ($fi->no_doc ?? ''),
                'vendor' => (string) ($fi->nm_vdr ?? ''),
                'ref_po' => (string) ($fi->ref_po ?? ''),
                'total' => (float) ($fi->total ?? 0),
                'tax' => (float) ($alloc['tax'] ?? 0),
                'cashNominal' => (float) ($alloc['cash'] ?? 0),
                'dppTarget' => (float) ($alloc['dpp'] ?? 0),
                'hasPpn' => $hasPpn,
            ]);
            if (!$resp->ok()) {
                $this->pythonSuggestError = 'AI Python HTTP ' . $resp->status() . ': ' . substr($resp->body(), 0, 500);
                return null;
            }

            $j = $resp->json();
            if (!is_array($j)) {
                $this->pythonSuggestError = 'AI Python mengembalikan response yang bukan JSON.';
                return null;
            }
            $lines = is_array($j['beban_lines'] ?? null) ? $j['beban_lines'] : [];
            $ppnAkun = (string) ($j['ppn_akun'] ?? '');
            if ($hasPpn && (float) ($alloc['tax'] ?? 0) > 0) {
                $ppnAkun = $this->normalizePpnMasukanAccount($ppnAkun);
            }

            return [
                'kode_akun' => (string) ($j['kode_akun'] ?? ''),
                'voucher_type' => (string) ($j['voucher_type'] ?? ''),
                'ppn_akun' => $ppnAkun,
                'beban_lines' => collect($lines)->map(fn ($l) => [
                    'akun' => trim((string) ($l['akun'] ?? '')),
                    'jenis' => $this->normalizeJenisBeban((string) ($l['jenis'] ?? 'Debit')),
                    'nominal' => (float) ($l['nominal'] ?? 0),
                ])->values()->all(),
                'confidence' => $j['confidence'] ?? null,
                'evidence' => $j['evidence'] ?? [],
            ];
        } catch (\Throwable $e) {
            $this->pythonSuggestError = $e->getMessage();
            return null;
        }
    }

    private function normalizePpnMasukanAccount(?string $akun): string
    {
        $akun = trim((string) $akun);
        if ($akun !== '' && $this->isPpnMasukanAccount($akun)) {
            return $akun;
        }

        return $this->getDefaultPpnMasukanAccount();
    }

    private function isPpnMasukanAccount(string $akun): bool
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) return false;
        if (!Schema::hasColumn('tb_nabb', 'Nama_Akun')) return false;

        $row = DB::table('tb_nabb')
            ->where('Kode_Akun', $akun)
            ->first(['Kode_Akun', 'Nama_Akun']);
        if (!$row) return false;

        $nama = strtoupper((string) ($row->Nama_Akun ?? ''));
        if (!str_contains($nama, 'PPN')) return false;
        if (str_contains($nama, 'KELUARAN') || str_contains($nama, 'HUTANG')) return false;
        if (str_contains($nama, 'PERSEDIAAN')) return false;

        return true;
    }

    private function getDefaultPpnMasukanAccount(): string
    {
        if (!Schema::hasTable('tb_nabb') || !Schema::hasColumn('tb_nabb', 'Kode_Akun')) return '';
        if (!Schema::hasColumn('tb_nabb', 'Nama_Akun')) return '';

        $row = DB::table('tb_nabb')
            ->whereRaw("UPPER(COALESCE(Nama_Akun,'')) LIKE '%PPN%'")
            ->whereRaw("UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%KELUARAN%'")
            ->whereRaw("UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%HUTANG%'")
            ->whereRaw("UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%PERSEDIAAN%'")
            ->orderByRaw("
                CASE
                    WHEN UPPER(COALESCE(Nama_Akun,'')) LIKE '%MASUKAN%' THEN 0
                    WHEN TRIM(COALESCE(Kode_Akun,'')) LIKE '11%' THEN 1
                    ELSE 2
                END
            ")
            ->orderBy('Kode_Akun')
            ->first(['Kode_Akun']);

        return trim((string) ($row->Kode_Akun ?? ''));
    }

    public function suggest(Request $request, string $noDoc)
    {
        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return response()->json(['error' => 'Tabel tb_kdinvin tidak ditemukan.'], 500);
            }
            if (!Schema::hasTable('tb_kas')) {
                return response()->json(['error' => 'Tabel tb_kas tidak ditemukan.'], 500);
            }

            $fi = DB::table('tb_kdinvin')->where('no_doc', $noDoc)->first();
            if (!$fi) {
                return response()->json(['error' => 'FI tidak ditemukan.'], 404);
            }

            $cashNominal = $request->query('nominal');
            $cashNominal = $cashNominal === null || $cashNominal === '' ? null : (float) $cashNominal;
            if ($cashNominal === null) {
                $cashNominal = (float) (($fi->pembayaran ?? 0) > 0 ? $fi->pembayaran : ($fi->total ?? 0));
            }

            $alloc = $this->computeAllocation($fi, (float) $cashNominal);
            $hasPpn = ($alloc['tax'] ?? 0) > 0;
            $pythonSuggest = $this->suggestFromPython($fi, $alloc, $hasPpn);
            $keteranganDisplay = $this->suggestKeterangan($fi);

            if (!$pythonSuggest) {
                return response()->json([
                    'error' => 'AI Python tidak bisa dihubungi atau endpoint Python error. Pastikan service Python aktif dan KAS_DSS_PYTHON_URL benar.',
                    'detail' => $this->pythonSuggestError,
                    'allocation' => $alloc,
                    'keterangan' => $keteranganDisplay,
                    'source' => 'python',
                ], 503);
            }

            if (count($pythonSuggest['beban_lines'] ?? []) === 0) {
                return response()->json([
                    'warning' => 'AI Python aktif, tetapi belum menemukan pola histori pembelian yang cocok untuk FI ini.',
                    'allocation' => $alloc,
                    'kode_akun' => (string) ($pythonSuggest['kode_akun'] ?? ''),
                    'voucher_type' => (string) ($pythonSuggest['voucher_type'] ?? ''),
                    'ppn_akun' => (string) ($pythonSuggest['ppn_akun'] ?? ''),
                    'beban_lines' => [],
                    'keterangan' => $keteranganDisplay,
                    'confidence' => $pythonSuggest['confidence'] ?? null,
                    'evidence' => $pythonSuggest['evidence'] ?? [],
                    'source' => 'python',
                ]);
            }

            return response()->json([
                'allocation' => $alloc,
                'kode_akun' => (string) ($pythonSuggest['kode_akun'] ?? ''),
                'voucher_type' => (string) ($pythonSuggest['voucher_type'] ?? ''),
                'ppn_akun' => (string) ($pythonSuggest['ppn_akun'] ?? ''),
                'beban_lines' => $pythonSuggest['beban_lines'] ?? [],
                'keterangan' => $keteranganDisplay,
                'confidence' => $pythonSuggest['confidence'] ?? null,
                'evidence' => $pythonSuggest['evidence'] ?? [],
                'source' => 'python',
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'no_doc' => ['required', 'string'],
            'kode_akun' => ['required', 'string'],
            'tgl_voucher' => ['required', 'date'],
            'voucher_type' => ['nullable', 'string'],
            'ppn_akun' => ['nullable', 'string'],
            'beban_lines' => ['required', 'array', 'min:1', 'max:3'],
            'beban_lines.*.akun' => ['required', 'string'],
            'beban_lines.*.jenis' => ['nullable', 'string'],
            'beban_lines.*.nominal' => ['required', 'numeric', 'min:0'],
            'keterangan' => ['nullable', 'string'],
            'nominal' => ['nullable', 'numeric'],
        ]);

        try {
            if (!Schema::hasTable('tb_kdinvin')) {
                return redirect()->back()->with('error', 'Tabel tb_kdinvin tidak ditemukan.');
            }
            if (!Schema::hasTable('tb_kas')) {
                return redirect()->back()->with('error', 'Tabel tb_kas tidak ditemukan.');
            }

            $kasCols = Schema::getColumnListing('tb_kas');
            foreach (['Kode_Voucher', 'Kode_Akun', 'Tgl_Voucher', 'Keterangan', 'Mutasi_Kas', 'Saldo'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan.");
                }
            }
            // Breakdown wajib untuk standar akuntansi (beban + PPN).
            foreach (['Kode_Akun1', 'Nominal1', 'Kode_Akun2', 'Nominal2', 'Kode_Akun3', 'Nominal3'] as $col) {
                if (!in_array($col, $kasCols, true)) {
                    return redirect()->back()->with('error', "Kolom tb_kas.$col tidak ditemukan (dibutuhkan untuk Beban Akun).");
                }
            }

            $header = DB::table('tb_kdinvin')->where('no_doc', $payload['no_doc'])->first();
            if (!$header) {
                return redirect()->back()->with('error', 'Data pembelian (FI) tidak ditemukan.');
            }

            $existingJurnal = trim((string) ($header->jurnal ?? ''));

            $kodeAkun = (string) $payload['kode_akun'];
            $ppnAkun = trim((string) ($payload['ppn_akun'] ?? ''));
            $bebanLines = is_array($payload['beban_lines'] ?? null) ? $payload['beban_lines'] : [];
            $tglVoucher = Carbon::parse($payload['tgl_voucher'])->toDateString();

            $nominal = array_key_exists('nominal', $payload) && $payload['nominal'] !== null
                ? (float) $payload['nominal']
                : (float) (($header->pembayaran ?? 0) > 0 ? $header->pembayaran : ($header->total ?? 0));
            $nominal = max(0.0, $nominal);

            if ($nominal <= 0) {
                return redirect()->back()->with('error', 'Nominal harus > 0.');
            }

            $headerTotal = (float) ($header->total ?? 0);
            $headerTax = (float) ($header->tax ?? 0);
            $headerTax = max(0.0, $headerTax);
            $headerDpp = max(0.0, $headerTotal - $headerTax);

            // If payment is partial, allocate proportionally.
            $ratio = ($headerTotal > 0) ? min(1.0, max(0.0, $nominal / $headerTotal)) : 1.0;
            $dppNominal = round($headerDpp * $ratio, 2);
            $taxNominal = round($headerTax * $ratio, 2);

            if ($taxNominal > 0 && $ppnAkun === '') {
                return redirect()->back()->with('error', 'Akun PPN wajib diisi karena FI memiliki PPN.');
            }
            if ($taxNominal > 0) {
                $normalizedPpnAkun = $this->normalizePpnMasukanAccount($ppnAkun);
                if ($normalizedPpnAkun === '') {
                    return redirect()->back()->with('error', 'Akun PPN Masukan tidak ditemukan di master akun.');
                }
                $ppnAkun = $normalizedPpnAkun;
            }

            // Validasi beban lines: total beban harus sama dengan DPP (alokasi proporsional bila bayar parsial).
            $sumBeban = 0.0;
            $cleanBeban = [];
            foreach ($bebanLines as $line) {
                $akun = trim((string) ($line['akun'] ?? ''));
                $jenis = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                $nom = (float) ($line['nominal'] ?? 0);
                if ($akun === '') {
                    return redirect()->back()->with('error', 'Akun beban wajib dipilih.');
                }
                if ($nom < 0) {
                    return redirect()->back()->with('error', 'Nominal beban tidak boleh negatif.');
                }
                $sumBeban += $nom;
                $cleanBeban[] = ['akun' => $akun, 'jenis' => $jenis, 'nominal' => $nom];
            }

            $sumBeban = round($sumBeban, 2);
            if (round($dppNominal, 2) !== $sumBeban) {
                return redirect()->back()->with('error', 'Total beban (DPP) harus sama dengan DPP: ' . $dppNominal);
            }

            // Standar perusahaan: PPN selalu di Kode_Akun2.
            if ($taxNominal > 0 && count($cleanBeban) > 2) {
                return redirect()->back()->with('error', 'Saat ada PPN, maksimal beban DPP adalah 2 baris (karena Kode_Akun2 dipakai untuk PPN).');
            }

            $keterangan = trim((string) ($payload['keterangan'] ?? ''));
            if ($keterangan === '') {
                $vendor = trim((string) ($header->nm_vdr ?? ''));
                $refPo = trim((string) ($header->ref_po ?? ''));
                $keterangan = 'Pembelian/FI ' . (string) $header->no_doc
                    . ($vendor !== '' ? (' — ' . $vendor) : '')
                    . ($refPo !== '' ? (' (PO ' . $refPo . ')') : '');
            }

            return DB::transaction(function () use ($request, $kasCols, $kodeAkun, $ppnAkun, $cleanBeban, $tglVoucher, $nominal, $taxNominal, $keterangan, $header, $existingJurnal) {
                $dbCode = $this->getDatabaseCode($request);
                $voucherType = strtoupper(trim((string) $request->input('voucher_type', '')));
                $voucherType = in_array($voucherType, ['CV', 'GV', 'BV', 'SC'], true) ? $voucherType : $this->guessVoucherType($kodeAkun);

                $prefix = $dbCode . '/' . $voucherType . '/';
                $last = '';
                if (Schema::hasTable('tb_kas') && Schema::hasColumn('tb_kas', 'Kode_Voucher')) {
                    $last = (string) (DB::table('tb_kas')
                        ->where('Kode_Voucher', 'like', $prefix . '%')
                        ->orderByDesc('Kode_Voucher')
                        ->value('Kode_Voucher') ?? '');
                }

                $seq = 0;
                if ($last !== '' && str_starts_with($last, $prefix)) {
                    $tail = substr($last, strlen($prefix));
                    if (preg_match('/^\\d{8}$/', $tail)) {
                        $seq = (int) $tail;
                    }
                }

                $seq++;
                $kodeVoucher = $prefix . str_pad((string) $seq, 8, '0', STR_PAD_LEFT);

                $lastRow = DB::table('tb_kas')
                    ->where('Kode_Akun', $kodeAkun)
                    ->orderByDesc('Tgl_Voucher')
                    ->orderByDesc('Kode_Voucher')
                    ->select(['Saldo'])
                    ->first();

                $lastSaldo = (float) ($lastRow->Saldo ?? 0);
                $mutasi = -1 * abs($nominal);
                $saldo = $lastSaldo + $mutasi;

                $row = [
                    'Kode_Voucher' => $kodeVoucher,
                    'Kode_Akun' => $kodeAkun,
                    'Tgl_Voucher' => $tglVoucher,
                    'Keterangan' => $keterangan,
                    'Mutasi_Kas' => $mutasi,
                    'Saldo' => $saldo,
                ];

                if (in_array('Tgl_Buat', $kasCols, true)) {
                    $row['Tgl_Buat'] = Carbon::now()->toDateString();
                }

                // Breakdown mengikuti pola BukuKasController.
                // Standar perusahaan: PPN selalu di slot 2 (Kode_Akun2/Nominal2).
                // Beban DPP:
                // - Jika ada PPN: beban[0] -> slot1, beban[1] -> slot3
                // - Jika tidak ada PPN: beban[0] -> slot1, beban[1] -> slot2, beban[2] -> slot3
                $hasB1 = in_array('Kode_Akun1', $kasCols, true) && in_array('Nominal1', $kasCols, true);
                $hasB2 = in_array('Kode_Akun2', $kasCols, true) && in_array('Nominal2', $kasCols, true);
                $hasB3 = in_array('Kode_Akun3', $kasCols, true) && in_array('Nominal3', $kasCols, true);
                $hasJ1 = in_array('Jenis_Beban1', $kasCols, true);
                $hasJ2 = in_array('Jenis_Beban2', $kasCols, true);
                $hasJ3 = in_array('Jenis_Beban3', $kasCols, true);

                $assign = function (int $slot, array $line) use (&$row, $hasB1, $hasB2, $hasB3, $hasJ1, $hasJ2, $hasJ3) {
                    $kodeKey = 'Kode_Akun' . $slot;
                    $nomKey = 'Nominal' . $slot;
                    $jenisKey = 'Jenis_Beban' . $slot;
                    $hasB = $slot === 1 ? $hasB1 : ($slot === 2 ? $hasB2 : $hasB3);
                    $hasJ = $slot === 1 ? $hasJ1 : ($slot === 2 ? $hasJ2 : $hasJ3);
                    if ($hasB) {
                        $row[$kodeKey] = (string) $line['akun'];
                        $row[$nomKey] = (float) $line['nominal'];
                    }
                    if ($hasJ) {
                        $row[$jenisKey] = $this->normalizeJenisBeban((string) ($line['jenis'] ?? ''));
                    }
                };

                if ($taxNominal > 0) {
                    if (isset($cleanBeban[0])) $assign(1, $cleanBeban[0]);
                    if (isset($cleanBeban[1])) $assign(3, $cleanBeban[1]);

                    if ($ppnAkun !== '' && $hasB2) {
                        $row['Kode_Akun2'] = $ppnAkun;
                        $row['Nominal2'] = (float) $taxNominal;
                    }
                    if ($hasJ2) {
                        $row['Jenis_Beban2'] = 'Debit';
                    }
                } else {
                    if (isset($cleanBeban[0])) $assign(1, $cleanBeban[0]);
                    if (isset($cleanBeban[1])) $assign(2, $cleanBeban[1]);
                    if (isset($cleanBeban[2])) $assign(3, $cleanBeban[2]);
                }

                DB::table('tb_kas')->insert($row);

                if ($this->journalAvailable()) {
                    $kodeJurnal = $this->nextKodeJurnal($dbCode);
                    $this->insertJurnalHeader($kodeJurnal, $kodeVoucher, $tglVoucher, $keterangan);

                    $details = [[
                        'akun' => $kodeAkun,
                        'debit' => 0,
                        'kredit' => abs($nominal),
                        'saldo' => $this->saldoAfterJournalLine($kodeAkun, 'Kredit', abs($nominal)),
                    ]];

                    foreach ($cleanBeban as $line) {
                        $jenis = $this->normalizeJenisBeban((string) ($line['jenis'] ?? 'Debit'));
                        $nom = abs((float) ($line['nominal'] ?? 0));
                        $details[] = [
                            'akun' => (string) $line['akun'],
                            'debit' => $jenis === 'Debit' ? $nom : 0,
                            'kredit' => $jenis === 'Kredit' ? $nom : 0,
                            'saldo' => $this->saldoAfterJournalLine((string) $line['akun'], $jenis, $nom),
                        ];
                    }

                    if ($taxNominal > 0 && $ppnAkun !== '') {
                        $details[] = [
                            'akun' => $ppnAkun,
                            'debit' => abs($taxNominal),
                            'kredit' => 0,
                            'saldo' => $this->saldoAfterJournalLine($ppnAkun, 'Debit', abs($taxNominal)),
                        ];
                    }

                    $debitTotal = round(array_sum(array_map(fn ($d) => (float) $d['debit'], $details)), 2);
                    $kreditTotal = round(array_sum(array_map(fn ($d) => (float) $d['kredit'], $details)), 2);
                    if ($debitTotal !== $kreditTotal) {
                        throw new \RuntimeException('Jurnal tidak balance. Debit: ' . $debitTotal . ', Kredit: ' . $kreditTotal);
                    }

                    $this->insertJurnalDetailsAndUpdateNabb($kodeJurnal, $details);
                }

                $fiCols = Schema::getColumnListing('tb_kdinvin');
                $sisaBayar = (float) ($header->sisa_bayar ?? $header->total ?? 0);
                $wasHutang = in_array(strtoupper($existingJurnal), ['2101', '2101AK'], true);
                $isFullPayment = abs($nominal) + 0.01 >= max(0.0, $sisaBayar);
                $ketJurnalFi = (!$isFullPayment || $wasHutang) ? '2101AK' : '';

                $updates = [];
                if (in_array('jurnal', $fiCols, true)) $updates['jurnal'] = $ketJurnalFi;
                if (in_array('pembayaran', $fiCols, true)) {
                    $updates['pembayaran'] = DB::raw('COALESCE(pembayaran,0) + ' . round(abs($nominal), 2));
                }
                if (in_array('sisa_bayar', $fiCols, true)) {
                    $updates['sisa_bayar'] = DB::raw('GREATEST(COALESCE(sisa_bayar,0) - ' . round(abs($nominal), 2) . ', 0)');
                }
                if (in_array('tgl_bayar', $fiCols, true)) $updates['tgl_bayar'] = $tglVoucher;
                if (!$wasHutang && in_array('ref_vc', $fiCols, true)) {
                    $updates['ref_vc'] = Carbon::parse($tglVoucher)->format('Y-m-01');
                }

                if (count($updates) > 0) {
                    DB::table('tb_kdinvin')
                        ->where('no_doc', (string) $header->no_doc)
                        ->update($updates);
                }

                return redirect()
                    ->route('keuangan.input-pembelian.index', [
                        'account' => $kodeAkun,
                        'period' => Carbon::parse($tglVoucher)->format('Ym'),
                        'search' => $kodeVoucher,
                    ])
                    ->with('success', 'Berhasil simpan ke Buku Kas: ' . $kodeVoucher);
            });
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
