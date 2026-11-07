<?php

namespace App\Http\Controllers;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DashboardController
{
    /** @var \WeakMap<Connection, array<string, array>> */
    private \WeakMap $schemaCache;

    public function __construct()
    {
        $this->schemaCache = new \WeakMap;
    }

    private function hasTable(string $table): bool
    {
        $connection = $this->getDbConnection();
        $database = $connection->getDatabaseName();
        $metadata = $this->schemaCache[$connection] ?? [];
        if (! isset($metadata[$database]['tables'])) {
            $metadata[$database]['tables'] = array_fill_keys(
                $connection->getSchemaBuilder()->getTableListing(schemaQualified: false), true,
            );
            $this->schemaCache[$connection] = $metadata;
        }

        return isset($metadata[$database]['tables'][$connection->getTablePrefix().$table]);
    }

    private function columnsForTable(string $table): array
    {
        if (! $this->hasTable($table)) {
            return [];
        }
        $connection = $this->getDbConnection();
        $database = $connection->getDatabaseName();
        $metadata = $this->schemaCache[$connection];
        if (! isset($metadata[$database]['columns'][$table])) {
            $metadata[$database]['columns'][$table] = $connection->getSchemaBuilder()->getColumnListing($table);
            $this->schemaCache[$connection] = $metadata;
        }

        return $metadata[$database]['columns'][$table];
    }

    private function hasColumn(string $table, string $column): bool
    {
        return in_array(strtolower($column), array_map('strtolower', $this->columnsForTable($table)), true);
    }

    private const DASHBOARD_CARD_KEYS = [
        'quotation',
        'saldo',
        'receivable_payable',
        'stock_summary',
        'delivery',
        'sales_hpp',
        'user_note',
    ];

    private function dashboardCardAccess(Request $request): ?array
    {
        $kdUser = $request->user()?->kd_user;
        if (! $kdUser || ! Storage::disk('local')->exists('privileges.json')) {
            return null;
        }

        $decoded = json_decode(Storage::disk('local')->get('privileges.json'), true);
        if (! is_array($decoded)) {
            return null;
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $cards = $decoded['databases'][$database]['users'][$kdUser]['dashboard_cards']
            ?? $decoded['users'][$kdUser]['dashboard_cards']
            ?? null;

        return is_array($cards) ? $cards : null;
    }

    private function canViewDashboardCard(Request $request, string $card): bool
    {
        if (! in_array($card, self::DASHBOARD_CARD_KEYS, true)) {
            return false;
        }

        $access = $this->dashboardCardAccess($request);
        if ($access === null) {
            return true;
        }

        return (bool) ($access[$card] ?? false);
    }

    private function authorizeDashboardCard(Request $request, string $card): void
    {
        abort_unless($this->canViewDashboardCard($request, $card), 403);
    }

    private function tbKasBiayaQuery()
    {
        foreach (['Tgl_Voucher', 'Kode_Akun1', 'Jenis_Beban1', 'Nominal1'] as $column) {
            if (! $this->hasTable('tb_kas') || ! $this->hasColumn('tb_kas', $column)) {
                return null;
            }
        }

        return $this->getDbConnection()->table('tb_kas as k')
            ->whereRaw("TRIM(COALESCE(k.Kode_Akun1,'')) LIKE '51%'")
            ->whereRaw("UPPER(TRIM(COALESCE(k.Jenis_Beban1,''))) = 'DEBIT'");
    }

    private function tbDoHppQuery()
    {
        $hasDo = $this->hasTable('tb_do') && $this->hasColumn('tb_do', 'pos_tgl') && $this->hasColumn('tb_do', 'total');
        $hasDob = $this->hasTable('tb_dob') && $this->hasColumn('tb_dob', 'pos_tgl') && $this->hasColumn('tb_dob', 'total');

        if (! $hasDo && ! $hasDob) {
            return null;
        }

        $queries = [];
        if ($hasDo) {
            $queries[] = $this->getDbConnection()->table('tb_do')->select('pos_tgl', 'total');
        }
        if ($hasDob) {
            $queries[] = $this->getDbConnection()->table('tb_dob')->select('pos_tgl', 'total');
        }

        $first = array_shift($queries);
        foreach ($queries as $q) {
            $first->unionAll($q);
        }

        return $this->getDbConnection()->query()->fromSub($first, 'd');
    }

    private function normalizedDateSql(string $column): string
    {
        return "COALESCE(
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%Y-%m-%d'),
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%d.%m.%Y'),
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%d-%m-%Y')
        )";
    }

    private function getDbConnection(): Connection
    {
        return DB::connection();
    }

    private function sqlYw(string $col): string
    {
        return "YEARWEEK($col, 1)";
    }

    private function sqlDf(string $col, string $fmt): string
    {
        return "DATE_FORMAT($col, '$fmt')";
    }

    private function sqlStd(string $col, string $fmt): string
    {
        return "STR_TO_DATE($col, '$fmt')";
    }

    public function index(Request $request)
    {
        $access = $this->dashboardCardAccess($request);

        // Initial props dikosongkan untuk mempercepat load. Data akan di-fetch per-card.
        return Inertia::render('dashboard', [
            'quotationStats' => [],
            'saldoStats' => [],
            'pdbStats' => (object) [],
            'pdoStats' => (object) [],
            'salesHppStats' => ['summary' => (object) [], 'series' => []],
            'dashboardCardAccess' => $access,
        ]);
    }

    public function quotationStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'quotation');

        $range = strtolower((string) $request->query('range', ''));
        if (in_array($range, ['1_week', '1_month', '3_months', '5_months', '1_year'], true)) {
            $stats = $this->buildQuotationStatsRange($range);

            return response()->json($stats);
        }

        $months = (int) $request->query('months', 12);
        $months = max(1, min(24, $months));

        $group = strtolower((string) $request->query('group', 'week'));
        if (! in_array($group, ['week', 'month'], true)) {
            $group = 'week';
        }

        $stats = $this->buildQuotationStats($months, $group);

        return response()->json($stats);
    }

    public function saldoStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'saldo');

        $stats = $this->buildSaldoStats();

        return response()->json($stats);
    }

    public function receivablePayableStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'receivable_payable');

        $stats = $this->buildReceivablePayableStats();

        return response()->json($stats);
    }

    public function deliveryStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'delivery');

        $stats = $this->buildDeliveryStats();

        return response()->json($stats);
    }

    public function getUserNote(Request $request)
    {
        $this->authorizeDashboardCard($request, 'user_note');

        $userId = $request->user()->id;
        $path = storage_path('app/user_notes.json');

        $notes = [];
        if (file_exists($path)) {
            $notes = json_decode(file_get_contents($path), true) ?: [];
        }

        return response()->json([
            'content' => $notes[$userId] ?? '',
        ]);
    }

    public function saveUserNote(Request $request)
    {
        $this->authorizeDashboardCard($request, 'user_note');

        $userId = $request->user()->id;
        $content = $request->input('content');
        $path = storage_path('app/user_notes.json');

        // Logging for audit
        Log::info("UserNote SAVE: User ID $userId, Length ".strlen($content));

        $notes = [];
        if (file_exists($path)) {
            $notes = json_decode(file_get_contents($path), true) ?: [];
        }

        $notes[$userId] = $content;

        try {
            file_put_contents($path, json_encode($notes, JSON_PRETTY_PRINT));
            chmod($path, 0777); // Ensure it stays writable

            return response()->json(['message' => 'Catatan berhasil disimpan.']);
        } catch (\Exception $e) {
            Log::error('UserNote SAVE ERROR: '.$e->getMessage());

            return response()->json(['message' => 'Gagal menyimpan catatan: '.$e->getMessage()], 500);
        }
    }

    private function buildQuotationStats(int $months = 12, string $group = 'week'): array
    {
        if (! $this->hasTable('tb_penawaran')) {
            return [];
        }

        if ($group === 'month') {
            $end = Carbon::now()->startOfMonth();
            $start = $end->copy()->subMonths($months - 1);

            $rawStats = $this->getDbConnection()->table('tb_penawaran')
                ->selectRaw(''.$this->sqlDf('Tgl_penawaran', '%Y-%m').' as period, COUNT(*) as total')
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
                ->where('Tgl_penawaran', '<', $end->copy()->addMonth()->toDateString())
                ->groupBy('period')
                ->orderBy('period')
                ->get()
                ->keyBy('period');

            $quotationStats = [];
            for ($i = 0; $i < $months; $i += 1) {
                $month = $start->copy()->addMonths($i);
                $period = $month->format('Y-m');
                $total = (int) ($rawStats[$period]->total ?? 0);
                $quotationStats[] = [
                    'period' => $period,
                    'label' => $month->locale('id')->translatedFormat('M Y'),
                    'total' => $total,
                ];
            }

            return $quotationStats;
        }

        // Week (ISO / Monday start)
        $endWeekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $startWeekStart = Carbon::now()
            ->startOfMonth()
            ->subMonths($months - 1)
            ->startOfWeek(Carbon::MONDAY);

        $rawStats = $this->getDbConnection()->table('tb_penawaran')
            ->selectRaw(''.$this->sqlYw('Tgl_penawaran').' as week_key, COUNT(*) as total')
            ->whereNotNull('Tgl_penawaran')
            ->where('Tgl_penawaran', '>=', $startWeekStart->toDateString())
            ->where('Tgl_penawaran', '<', Carbon::now()->startOfDay()->addDay()->toDateTimeString())
            ->groupBy('week_key')
            ->orderBy('week_key')
            ->pluck('total', 'week_key');

        $quotationStats = [];
        $cursor = $startWeekStart->copy();
        while ($cursor->lte($endWeekStart)) {
            $isoYear = (int) $cursor->isoWeekYear();
            $isoWeek = (int) $cursor->isoWeek();
            $weekKey = ($isoYear * 100) + $isoWeek; // aligns with YEARWEEK(..., 1)
            $period = sprintf('%d-W%02d', $isoYear, $isoWeek);
            $total = (int) ($rawStats[$weekKey] ?? 0);
            $quotationStats[] = [
                'period' => $period,
                'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                'total' => $total,
            ];
            $cursor->addWeek();
        }

        return $quotationStats;
    }

    private function buildQuotationStatsRange(string $range): array
    {
        if (! $this->hasTable('tb_penawaran')) {
            return [];
        }

        if ($range === '1_week') {
            $end = Carbon::now()->startOfDay();
            $start = $end->copy()->subDays(5);

            $raw = $this->getDbConnection()->table('tb_penawaran')
                ->selectRaw(''.$this->sqlDf('Tgl_penawaran', '%Y-%m-%d').' as period, COUNT(*) as total')
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
                ->where('Tgl_penawaran', '<', $end->copy()->addDay()->toDateTimeString())
                ->groupBy('period')
                ->orderBy('period')
                ->pluck('total', 'period');

            $stats = [];
            for ($i = 0; $i < 6; $i += 1) {
                $day = $start->copy()->addDays($i);
                $key = $day->format('Y-m-d');
                $stats[] = [
                    'period' => $key,
                    'label' => $day->locale('id')->translatedFormat('d M'),
                    'total' => (int) ($raw[$key] ?? 0),
                ];
            }

            return $stats;
        }

        if ($range === '1_month') {
            // 4 minggu berjalan (termasuk minggu ini)
            $endWeek = Carbon::now()->startOfWeek(Carbon::MONDAY);
            $startWeek = $endWeek->copy()->subWeeks(3);

            $raw = $this->getDbConnection()->table('tb_penawaran')
                ->selectRaw(''.$this->sqlYw('Tgl_penawaran').' as week_key, COUNT(*) as total')
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $startWeek->toDateString())
                ->where('Tgl_penawaran', '<', Carbon::now()->startOfDay()->addDay()->toDateTimeString())
                ->groupBy('week_key')
                ->orderBy('week_key')
                ->pluck('total', 'week_key');

            $stats = [];
            $cursor = $startWeek->copy();
            while ($cursor->lte($endWeek)) {
                $isoYear = (int) $cursor->isoWeekYear();
                $isoWeek = (int) $cursor->isoWeek();
                $weekKey = ($isoYear * 100) + $isoWeek;
                $stats[] = [
                    'period' => sprintf('%d-W%02d', $isoYear, $isoWeek),
                    'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                    'total' => (int) ($raw[$weekKey] ?? 0),
                ];
                $cursor->addWeek();
            }

            return $stats;
        }

        if ($range === '3_months') {
            return $this->buildQuotationStats(3, 'month');
        }
        if ($range === '5_months') {
            return $this->buildQuotationStats(5, 'month');
        }
        if ($range === '1_year') {
            return $this->buildQuotationStats(12, 'month');
        }

        return $this->buildQuotationStats(3, 'month');
    }

    private function buildSaldoStats(): array
    {
        $accountMap = [
            '1101AD' => 'Kas Tunai',
            '1102AD' => 'Kas Giro',
            '1103AD' => 'Kas Bank 1',
            '1104AD' => 'Kas Bank 2',
        ];

        $saldoByCode = collect();
        $lastVoucherByCode = collect();
        $historySeries = [];

        if ($this->hasTable('tb_kas')
            && $this->hasColumn('tb_kas', 'Saldo')
            && $this->hasColumn('tb_kas', 'Tgl_Voucher')
            && $this->hasColumn('tb_kas', 'Kode_Voucher')
            && $this->hasColumn('tb_kas', 'Kode_Akun')) {

            $codes = array_keys($accountMap);
            $query = null;
            foreach ($codes as $code) {
                $q = $this->getDbConnection()->table('tb_kas')
                    ->where('Kode_Akun', $code)
                    ->orderByDesc('Tgl_Voucher')
                    ->orderByDesc('Kode_Voucher')
                    ->select(['Saldo', 'Tgl_Voucher', 'Kode_Akun'])
                    ->limit(1);

                $query = $query ? $query->unionAll($q) : $q;
            }

            $rows = $query ? $query->get()->keyBy('Kode_Akun') : collect();

            foreach ($codes as $code) {
                $lastRow = $rows->get($code);
                $saldoByCode[$code] = (float) ($lastRow?->Saldo ?? 0);
                $lastVoucherByCode[$code] = $lastRow?->Tgl_Voucher ?? null;
            }

            // Ambil riwayat total saldo kas harian dari transaksi terakhir untuk sparkline riil
            try {
                $historyRows = $this->getDbConnection()->table('tb_kas')
                    ->whereIn('Kode_Akun', $codes)
                    ->whereNotNull('Tgl_Voucher')
                    ->select('Tgl_Voucher')
                    ->selectRaw('SUM(Saldo) as total_saldo')
                    ->groupBy('Tgl_Voucher')
                    ->orderByDesc('Tgl_Voucher')
                    ->limit(7)
                    ->get()
                    ->reverse()
                    ->values();

                foreach ($historyRows as $h) {
                    $historySeries[] = [
                        'date' => $h->Tgl_Voucher,
                        'value' => (float) ($h->total_saldo ?? 0),
                    ];
                }
            } catch (\Throwable) {
                $historySeries = [];
            }
        } else {
            foreach (array_keys($accountMap) as $code) {
                $saldoByCode[$code] = 0;
                $lastVoucherByCode[$code] = null;
            }
        }

        $saldoStats = [];
        foreach ($accountMap as $code => $label) {
            $saldoStats[] = [
                'code' => $code,
                'label' => $label,
                'saldo' => (float) ($saldoByCode[$code] ?? 0),
                'last_voucher' => $lastVoucherByCode[$code] ?? null,
            ];
        }

        return [
            'accounts' => $saldoStats,
            'history' => $historySeries,
        ];
    }

    private function buildReceivablePayableStats(): array
    {
        $result = [
            'piutang' => ['total' => 0.0, 'last_update' => null, 'history' => []],
            'hutang' => ['total' => 0.0, 'last_update' => null, 'history' => []],
            'meta' => ['source' => 'tb_nabbrekap.latest_saldo'],
        ];

        $accountCodes = [
            'piutang' => '1109AD',
            'hutang' => '2101AK',
        ];

        if ($this->hasTable('tb_nabbrekap')) {
            $rekapCols = $this->columnsForTable('tb_nabbrekap');
            $hasRekapRequired = in_array('Kode_Akun', $rekapCols, true)
                && in_array('Saldo', $rekapCols, true);

            if ($hasRekapRequired) {
                $dateOrderParts = [];
                if (in_array('End_Date', $rekapCols, true)) {
                    $dateOrderParts[] = 'End_Date';
                }
                if (in_array('Posting_Date', $rekapCols, true)) {
                    $dateOrderParts[] = 'Posting_Date';
                }

                $orderDateSql = match (count($dateOrderParts)) {
                    0 => 'Kode_Akun',
                    1 => $dateOrderParts[0],
                    default => 'COALESCE('.implode(',', $dateOrderParts).')',
                };

                $latestAccounts = null;
                foreach ($accountCodes as $key => $code) {
                    $query = $this->getDbConnection()->table('tb_nabbrekap')
                        ->whereRaw('LOWER(TRIM(Kode_Akun)) = ?', [strtolower($code)])
                        ->select('Saldo')
                        ->selectRaw('? as account_key', [$key])
                        ->when(in_array('End_Date', $rekapCols, true), fn ($query) => $query->addSelect('End_Date'))
                        ->when(in_array('Posting_Date', $rekapCols, true), fn ($query) => $query->addSelect('Posting_Date'))
                        ->orderByRaw("{$orderDateSql} desc")
                        ->when(in_array('Posting_Date', $rekapCols, true), fn ($query) => $query->orderByDesc('Posting_Date'))
                        ->when(in_array('Kode_NaBB', $rekapCols, true), fn ($query) => $query->orderByDesc('Kode_NaBB'))
                        ->limit(1);
                    $latestAccounts = $latestAccounts ? $latestAccounts->unionAll($query) : $query;
                }
                $rows = $latestAccounts->get()->keyBy('account_key');

                foreach ($accountCodes as $key => $code) {
                    $row = $rows->get($key);
                    if ($row) {
                        $result[$key]['total'] = (float) ($row->Saldo ?? 0);
                        $result[$key]['last_update'] = $row->Posting_Date ?? $row->End_Date ?? null;
                    }
                }

                // Ambil riwayat historis saldo piutang & hutang per snapshot dari tb_nabbrekap
                try {
                    foreach ($accountCodes as $key => $code) {
                        $history = $this->getDbConnection()->table('tb_nabbrekap')
                            ->whereRaw('LOWER(TRIM(Kode_Akun)) = ?', [strtolower($code)])
                            ->select('Saldo')
                            ->when(in_array('End_Date', $rekapCols, true), fn ($query) => $query->addSelect('End_Date'))
                            ->when(in_array('Posting_Date', $rekapCols, true), fn ($query) => $query->addSelect('Posting_Date'))
                            ->orderByRaw("{$orderDateSql} desc")
                            ->when(in_array('Kode_NaBB', $rekapCols, true), fn ($query) => $query->orderByDesc('Kode_NaBB'))
                            ->limit(7)
                            ->get()
                            ->reverse()
                            ->values();

                        $result[$key]['history'] = $history->map(fn ($r) => [
                            'date' => $r->Posting_Date ?? $r->End_Date ?? null,
                            'value' => (float) ($r->Saldo ?? 0),
                        ])->all();
                    }
                } catch (\Throwable) {
                    // ignore history failure
                }

                if (($result['piutang']['total'] ?? 0) !== 0.0 || ($result['hutang']['total'] ?? 0) !== 0.0) {
                    return $result;
                }
            }
        }

        $result['meta']['source'] = 'tb_nabb.saldo + tb_kas.tgl_voucher';

        if (! $this->hasTable('tb_nabb')) {
            return $result;
        }

        $nabbCols = $this->columnsForTable('tb_nabb');
        $kasCols = $this->hasTable('tb_kas') ? $this->columnsForTable('tb_kas') : [];
        $lastUpdateAccountColumns = array_values(array_filter(
            ['Kode_Akun1', 'Kode_Akun2', 'Kode_Akun3'],
            fn (string $col) => in_array($col, $kasCols, true)
        ));

        $hasRequired = in_array('Kode_Akun', $nabbCols, true)
            && in_array('Saldo', $nabbCols, true)
            && (
                ! $this->hasTable('tb_kas')
                || (
                    in_array('Tgl_Voucher', $kasCols, true)
                    && count($lastUpdateAccountColumns) > 0
                )
            );

        if (! $hasRequired) {
            return $result;
        }

        $stats = $this->getDbConnection()->table('tb_nabb')
            ->whereIn('Kode_Akun', ['1109AD', '2101AK'])
            ->selectRaw("SUM(CASE WHEN LOWER(TRIM(Kode_Akun)) = '1109ad' THEN COALESCE(Saldo, 0) ELSE 0 END) as piutang_total")
            ->selectRaw("SUM(CASE WHEN LOWER(TRIM(Kode_Akun)) = '2101ak' THEN COALESCE(Saldo, 0) ELSE 0 END) as hutang_total")
            ->first();

        $piutangTotal = (float) ($stats->piutang_total ?? 0);
        $hutangTotal = (float) ($stats->hutang_total ?? 0);

        try {
            $lastUpdates = null;
            if ($this->hasTable('tb_kas') && $lastUpdateAccountColumns !== []) {
                $query = $this->getDbConnection()->table('tb_kas');
                foreach ($accountCodes as $key => $code) {
                    $conditions = implode(' OR ', array_map(fn ($column) => $column.' = ?', $lastUpdateAccountColumns));
                    $query->selectRaw('MAX(CASE WHEN '.$conditions.' THEN Tgl_Voucher END) as '.$key.'_last_update',
                        array_fill(0, count($lastUpdateAccountColumns), $code));
                }
                $query->where(function ($query) use ($lastUpdateAccountColumns, $accountCodes) {
                    foreach ($lastUpdateAccountColumns as $column) {
                        $query->orWhereIn($column, array_values($accountCodes));
                    }
                });
                $lastUpdates = $query->first();
            }
            $result['piutang'] = [
                'total' => $piutangTotal,
                'last_update' => $lastUpdates?->piutang_last_update ?: null,
                'history' => $result['piutang']['history'] ?? [],
            ];

            $result['hutang'] = [
                'total' => $hutangTotal,
                'last_update' => $lastUpdates?->hutang_last_update ?: null,
                'history' => $result['hutang']['history'] ?? [],
            ];

            return $result;
        } catch (\Throwable) {
            return $result;
        }
    }

    private function buildDeliveryStats(): array
    {
        $counters = $this->hasTable('tb_counter')
            ? $this->getDbConnection()->table('tb_counter')->whereIn('nama_tabel', ['saldo_pdb', 'saldo_pdo'])
                ->pluck('nomor_terakhir', 'nama_tabel')
            : collect();

        return [
            'pdb' => ['total' => (float) ($counters['saldo_pdb'] ?? 0)],
            'pdo' => ['total' => (float) ($counters['saldo_pdo'] ?? 0)],
        ];
    }

    public function getSalesHppStats(Request $request, $period = null)
    {
        $this->authorizeDashboardCard($request, 'sales_hpp');

        // Prioritize route param -> query param -> default
        if (! $period) {
            $period = $request->input('period', '3_months');
        }

        $group = strtolower((string) $request->query('group', 'month'));
        if (! in_array($group, ['week', 'month'], true)) {
            $group = 'month';
        }

        $stats = $this->getSalesHppStatsData($period, $group);

        return response()->json($stats);
    }

    /** Fetch each source once, including both bucket totals and its latest date. */
    private function groupedTotals(
        Builder $query,
        string $date,
        string $amount,
        string $bucket,
        string $start,
        string $end,
        bool $unboundedLastUpdate = false,
    ): array {
        $query->whereRaw("{$date} >= ?", [$start])->selectRaw("{$bucket} as period_key");
        if ($unboundedLastUpdate) {
            // Preserve the existing last-update rule, which also considers later-dated sales/HPP.
            $query->selectRaw("SUM(CASE WHEN {$date} <= ? THEN {$amount} ELSE 0 END) as total", [$end]);
        } else {
            $query->whereRaw("{$date} <= ?", [$end])->selectRaw("SUM({$amount}) as total");
        }
        $rows = $query->selectRaw("MAX({$date}) as last_update")->groupBy('period_key')->get();

        return [$rows->pluck('total', 'period_key'), $rows->max('last_update')];
    }

    private function getSalesHppStatsData(string $period, string $group = 'week'): array
    {
        $now = Carbon::now();
        $months = match ($period) {
            '5_months' => 5,
            '1_year' => 12,
            default => 3,
        };
        $mode = match ($period) {
            '1_week' => 'day',
            '1_month' => 'week',
            default => $group,
        };
        if ($mode === 'day') {
            $start = $now->copy()->startOfDay()->subDays(5);
            $lastBucket = $now->copy()->startOfDay();
        } elseif ($mode === 'week') {
            $lastBucket = $now->copy()->startOfWeek(Carbon::MONDAY);
            $start = $period === '1_month'
                ? $lastBucket->copy()->subWeeks(3)
                : $now->copy()->startOfMonth()->subMonths($months - 1)->startOfWeek(Carbon::MONDAY);
        } else {
            $start = $now->copy()->startOfMonth()->subMonths($months - 1);
            $lastBucket = $now->copy()->startOfMonth();
        }
        $end = $mode === 'month' ? $now->copy()->endOfMonth()->toDateString() : $now->toDateString();
        $bucket = fn (string $date): string => match ($mode) {
            'day' => $this->sqlDf($date, '%Y-%m-%d'),
            'month' => $this->sqlDf($date, '%Y-%m'),
            default => $this->sqlYw($date),
        };
        $sources = [];
        $latest = [];
        if ($this->hasTable('tb_kdfakturpenjualan')) {
            [$sources['sales'], $latest['sales']] = $this->groupedTotals(
                $this->getDbConnection()->table('tb_kdfakturpenjualan'),
                'tgl_doc', 'harga', $bucket('tgl_doc'), $start->toDateString(), $end, unboundedLastUpdate: true,
            );
        }
        if ($hpp = $this->tbDoHppQuery()) {
            $date = $this->sqlStd('d.pos_tgl', '%d.%m.%Y');
            [$sources['hpp'], $latest['hpp']] = $this->groupedTotals(
                $hpp, $date, 'COALESCE(d.total, 0)', $bucket($date), $start->toDateString(), $end, unboundedLastUpdate: true,
            );
        }
        if ($biaya = $this->tbKasBiayaQuery()) {
            [$sources['biaya'], $latest['biaya']] = $this->groupedTotals(
                $biaya, 'k.Tgl_Voucher', 'COALESCE(k.Nominal1, 0)', $bucket('k.Tgl_Voucher'), $start->toDateString(), $end,
            );
        }
        $result = [
            'summary' => ['sales_total' => 0, 'hpp_total' => 0, 'biaya_total' => 0, 'last_update' => null],
            'series' => [],
        ];
        if (! in_array($period, ['1_week', '1_month'], true)) {
            $result['debug'] = ['received_period' => $period, 'calculated_months' => $months];
        }
        for ($cursor = $start->copy(); $cursor->lte($lastBucket);) {
            $key = match ($mode) {
                'day' => $cursor->format('Y-m-d'),
                'month' => $cursor->format('Y-m'),
                default => ((int) $cursor->isoWeekYear() * 100) + (int) $cursor->isoWeek(),
            };
            $row = [
                'period' => $mode === 'week' ? sprintf('%d-W%02d', $cursor->isoWeekYear(), $cursor->isoWeek()) : $key,
                'label' => match ($mode) {
                    'day' => $cursor->copy()->locale('id')->translatedFormat('d M'),
                    'month' => $cursor->copy()->locale('id')->translatedFormat('M Y'),
                    default => sprintf('W%02d %d', $cursor->isoWeek(), $cursor->isoWeekYear()),
                },
            ];
            foreach (['sales', 'hpp', 'biaya'] as $metric) {
                $row[$metric] = (float) ($sources[$metric][$key] ?? 0);
                $result['summary'][$metric.'_total'] += $row[$metric];
            }
            $result['series'][] = $row;
            match ($mode) {
                'day' => $cursor->addDay(),
                'month' => $cursor->addMonth(),
                default => $cursor->addWeek(),
            };
        }
        $dates = array_filter($latest);
        $result['summary']['last_update'] = $dates === [] ? null : max($dates);

        // Data Penjualan Bulan Berjalan (Current Month & Year)
        $currentMonthStart = $now->copy()->startOfMonth()->toDateString();
        $currentMonthEnd = $now->copy()->endOfMonth()->toDateString();
        $currentMonthSales = 0.0;
        $currentMonthHpp = 0.0;
        $currentMonthBiaya = 0.0;

        if ($this->hasTable('tb_kdfakturpenjualan')) {
            $currentMonthSales = (float) $this->getDbConnection()->table('tb_kdfakturpenjualan')
                ->whereRaw("tgl_doc >= ? AND tgl_doc <= ?", [$currentMonthStart, $currentMonthEnd])
                ->sum('harga');
        }

        if ($hpp = $this->tbDoHppQuery()) {
            $date = $this->sqlStd('d.pos_tgl', '%d.%m.%Y');
            $currentMonthHpp = (float) $hpp
                ->whereRaw("{$date} >= ? AND {$date} <= ?", [$currentMonthStart, $currentMonthEnd])
                ->sum(DB::raw('COALESCE(d.total, 0)'));
        }

        if ($biaya = $this->tbKasBiayaQuery()) {
            $currentMonthBiaya = (float) $biaya
                ->whereRaw("k.Tgl_Voucher >= ? AND k.Tgl_Voucher <= ?", [$currentMonthStart, $currentMonthEnd])
                ->sum(DB::raw('COALESCE(k.Nominal1, 0)'));
        }

        // Margin dihitung dari Total Penjualan - HPP - Biaya Operasional (Laba Bersih)
        $currentNetProfit = $currentMonthSales - $currentMonthHpp - $currentMonthBiaya;
        if ($currentMonthSales > 0) {
            $currentNetMarginPct = ($currentNetProfit / $currentMonthSales) * 100;
        } elseif ($currentNetProfit < 0) {
            $currentNetMarginPct = -100.0;
        } else {
            $currentNetMarginPct = 0.0;
        }

        $result['current_month'] = [
            'month' => $now->copy()->locale('id')->translatedFormat('F'),
            'year' => (int) $now->year,
            'label' => $now->copy()->locale('id')->translatedFormat('F Y'),
            'sales' => $currentMonthSales,
            'hpp' => $currentMonthHpp,
            'biaya' => $currentMonthBiaya,
            'net_profit' => $currentNetProfit,
            'gross_profit' => $currentMonthSales - $currentMonthHpp,
            'net_margin_pct' => $currentNetMarginPct,
            'gross_margin_pct' => $currentNetMarginPct,
        ];

        return $result;
    }

    // Tambahkan method ini di dalam class DashboardController

    private function buildStockSummary(): array
    {
        $result = ['physical' => null, 'physical_last_update' => null, 'book' => null,
            'book_last_update' => null, 'difference' => null];
        if ($this->hasTable('tb_nabb')) {
            $columns = $this->columnsForTable('tb_nabb');
            $actual = array_change_key_case(array_combine($columns, $columns), CASE_LOWER);
            $account = $actual['kode_akun'] ?? 'Kode_Akun';
            $saldo = $actual['saldo'] ?? 'Saldo';
            $dates = array_values(array_intersect(['tgl_update', 'tgl_buat', 'posting_date', 'end_date', 'tgl'], array_keys($actual)));
            $selected = [$account, $saldo, ...array_map(fn ($column) => $actual[$column], $dates)];
            $row = $this->getDbConnection()->table('tb_nabb')
                ->whereRaw('LOWER(TRIM('.$account.')) = ?', ['1105ad'])->first($selected);
            $result['book'] = (float) ($row->{$saldo} ?? 0);
            foreach ($dates as $date) {
                if ($value = $row->{$actual[$date]} ?? null) {
                    $result['book_last_update'] = $this->normalizeDate($value);
                    break;
                }
            }
        }

        $stock = [];
        for ($warehouse = 1; $warehouse <= 4; $warehouse++) {
            $stock[] = "(COALESCE(CAST(stok_g{$warehouse} AS DECIMAL(18,4)), 0) * COALESCE(CAST(harga_stokg{$warehouse} AS DECIMAL(18,4)), 0))";
        }
        $sources = [
            'tb_mi' => ['COALESCE(SUM(harga_mis), 0) + COALESCE(SUM(harga_mib), 0)', 'posting_tgl'],
            'tb_barang' => ['SUM('.implode(' + ', $stock).')', 'tgl_buat'],
            'tb_do' => ['SUM(total)', 'pos_tgl'],
            'tb_dobi' => ['SUM(total)', 'pos_tgl'],
            'tb_dob' => ['SUM(total)', 'pos_tgl'],
        ];
        // Preserve the legacy formula: tb_mib's nominal was read but never added to physical stock.
        $hasPhysicalSource = $this->hasTable('tb_mib');
        $physical = 0.0;
        $physicalDates = [];
        foreach ($sources as $table => [$totalSql, $dateColumn]) {
            if (! $this->hasTable($table)) {
                continue;
            }
            $hasPhysicalSource = true;
            $query = $this->getDbConnection()->table($table)->selectRaw($totalSql.' as total_value');
            if ($table === 'tb_do') {
                $query->where(fn ($query) => $query->where('Val_inv', '<>', 1)->orWhereNull('Val_inv'));
            } elseif (in_array($table, ['tb_dobi', 'tb_dob'], true)) {
                $query->where('status', 0);
            }
            if ($this->hasColumn($table, $dateColumn)) {
                $query->selectRaw('MAX('.$this->normalizedDateSql($dateColumn).') as last_update');
            }
            $row = $query->first();
            $physical += (float) ($row->total_value ?? 0);
            if ($date = $row->last_update ?? null) {
                $physicalDates[] = $this->normalizeDate($date);
            }
        }
        if ($hasPhysicalSource) {
            $result['physical'] = $physical;
        }
        $physicalDates = array_filter($physicalDates);
        $result['physical_last_update'] = $physicalDates === [] ? null : max($physicalDates);
        if ($result['physical'] !== null && $result['book'] !== null) {
            $result['difference'] = $result['physical'] - $result['book'];
        }

        return $result;
    }

    /**
     * Fungsi Helper untuk membersihkan dan mengubah segala jenis format string tanggal database
     * (seperti dd.mm.yyyy atau dd-mm-yyyy) menjadi YYYY-MM-DD standar ISO.
     */
    private function normalizeDate($dateString): ?string
    {
        if (! $dateString) {
            return null;
        }
        $dateString = trim($dateString);
        try {
            // Deteksi jika format menggunakan dot/strip di awal (ex: 25.12.2025 atau 25-12-2025)
            if (preg_match('/^\d{2}[\.\-]\d{2}[\.\-]\d{4}/', $dateString)) {
                $separator = str_contains($dateString, '.') ? '.' : '-';
                $parts = explode(' ', $dateString);
                $datePart = $parts[0];

                return Carbon::createFromFormat("d{$separator}m{$separator}Y", $datePart)->toDateString();
            }

            return Carbon::parse($dateString)->toDateString();
        } catch (\Exception $e) {
            return $dateString; // Kembalikan string asli jika gagal di-parse
        }
    }

    // Tambahkan method ini ke dalam DashboardController untuk menyediakan API endpoint
    public function stockSummaryStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'stock_summary');

        $stats = $this->buildStockSummary();

        return response()->json($stats);
    }
}
