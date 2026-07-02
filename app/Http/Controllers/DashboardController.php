<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController
{
    private const DASHBOARD_CACHE_TAGS = ['dashboard_data'];
    private const DASHBOARD_CACHE_TTL = 300;
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
        if (!$kdUser || !Storage::disk('local')->exists('privileges.json')) {
            return null;
        }

        $decoded = json_decode(Storage::disk('local')->get('privileges.json'), true);
        if (!is_array($decoded)) {
            return null;
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $cards = $decoded['databases'][$database]['users'][$kdUser]['dashboard_cards'] ?? null;
        return is_array($cards) ? $cards : null;
    }

    private function canViewDashboardCard(Request $request, string $card): bool
    {
        if (!in_array($card, self::DASHBOARD_CARD_KEYS, true)) {
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

    private function tenantCachePrefix(?Request $request = null): string
    {
        $request ??= request();
        $database = (string) (
            $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database')
            ?? config('database.connections.'.config('database.default').'.database')
            ?? ''
        );

        return preg_replace('/[^A-Za-z0-9_.:-]/', '_', strtolower($database)) ?: 'default';
    }

    private function dashboardCacheKey(string $scope, array $parts = [], ?Request $request = null): string
    {
        return 'dashboard:' . $this->tenantCachePrefix($request) . ':' . $scope . ':' . md5(json_encode($parts));
    }

    private function hasKasBreakdownColumns(): array
    {
        if (!Schema::hasTable('tb_kas')) {
            return [
                'has_breakdown' => false,
                'has_b1' => false,
                'has_b2' => false,
                'has_b3' => false,
                'has_jenis1' => false,
                'has_jenis2' => false,
                'has_jenis3' => false,
            ];
        }

        $cols = Schema::getColumnListing('tb_kas');
        $hasB1 = in_array('Kode_Akun1', $cols, true) && in_array('Nominal1', $cols, true);
        $hasB2 = in_array('Kode_Akun2', $cols, true) && in_array('Nominal2', $cols, true);
        $hasB3 = in_array('Kode_Akun3', $cols, true) && in_array('Nominal3', $cols, true);
        $hasJenis1 = in_array('Jenis_Beban1', $cols, true);
        $hasJenis2 = in_array('Jenis_Beban2', $cols, true);
        $hasJenis3 = in_array('Jenis_Beban3', $cols, true);

        return [
            'has_breakdown' => $hasB1 || $hasB2 || $hasB3,
            'has_b1' => $hasB1,
            'has_b2' => $hasB2,
            'has_b3' => $hasB3,
            'has_jenis1' => $hasJenis1,
            'has_jenis2' => $hasJenis2,
            'has_jenis3' => $hasJenis3,
        ];
    }

    private function biayaSelectSumSql(array $flags): string
    {
        // Prefer breakdown columns (Kode_Akun1..3 + Nominal1..3). Fallback to tb_kas.Kode_Akun + Mutasi_Kas.
        $parts = [];

        if (!empty($flags['has_b1'])) {
            $parts[] = "CASE WHEN k.Kode_Akun1 LIKE '51%' THEN COALESCE(k.Nominal1,0) ELSE 0 END";
        }
        if (!empty($flags['has_b2'])) {
            $parts[] = "CASE WHEN k.Kode_Akun2 LIKE '51%' THEN COALESCE(k.Nominal2,0) ELSE 0 END";
        }
        if (!empty($flags['has_b3'])) {
            $parts[] = "CASE WHEN k.Kode_Akun3 LIKE '51%' THEN COALESCE(k.Nominal3,0) ELSE 0 END";
        }

        // Some datasets store expense "51" into Jenis_Beban* instead of Kode_Akun*.
        if (!empty($flags['has_jenis1']) && !empty($flags['has_b1'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban1 LIKE '51%' THEN COALESCE(k.Nominal1,0) ELSE 0 END";
        }
        if (!empty($flags['has_jenis2']) && !empty($flags['has_b2'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban2 LIKE '51%' THEN COALESCE(k.Nominal2,0) ELSE 0 END";
        }
        if (!empty($flags['has_jenis3']) && !empty($flags['has_b3'])) {
            $parts[] = "CASE WHEN k.Jenis_Beban3 LIKE '51%' THEN COALESCE(k.Nominal3,0) ELSE 0 END";
        }

        if (count($parts) > 0) {
            return implode(' + ', $parts);
        }

        return "CASE WHEN k.Kode_Akun LIKE '51%' AND COALESCE(k.Mutasi_Kas,0) < 0 THEN -COALESCE(k.Mutasi_Kas,0) ELSE 0 END";
    }

    private function tbKasBiayaQuery()
    {
        foreach (['Tgl_Voucher', 'Kode_Akun1', 'Jenis_Beban1', 'Nominal1'] as $column) {
            if (!Schema::hasTable('tb_kas') || !Schema::hasColumn('tb_kas', $column)) {
                return null;
            }
        }

        return DB::table('tb_kas as k')
            ->whereRaw("TRIM(COALESCE(k.Kode_Akun1,'')) LIKE '51%'")
            ->whereRaw("UPPER(TRIM(COALESCE(k.Jenis_Beban1,''))) = 'DEBIT'");
    }

    private function tbDoHppQuery()
    {
        foreach (['pos_tgl', 'total'] as $column) {
            if (!Schema::hasTable('tb_do') || !Schema::hasColumn('tb_do', $column)) {
                return null;
            }
        }

        return DB::table('tb_do as d');
    }

    private function normalizedDateSql(string $column): string
    {
        return "COALESCE(
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%Y-%m-%d'),
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%d.%m.%Y'),
            STR_TO_DATE(NULLIF(TRIM($column), ''), '%d-%m-%Y')
        )";
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
            $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('quotation.range', [
                'range' => $range,
                'today' => Carbon::now()->toDateString(),
            ], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->buildQuotationStatsRange($range));

            return response()->json($stats);
        }

        $months = (int) $request->query('months', 12);
        $months = max(1, min(24, $months));

        $group = strtolower((string) $request->query('group', 'week'));
        if (!in_array($group, ['week', 'month'], true)) {
            $group = 'week';
        }

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('quotation', [
            'months' => $months,
            'group' => $group,
            'today' => Carbon::now()->toDateString(),
        ], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->buildQuotationStats($months, $group));

        return response()->json($stats);
    }

    public function saldoStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'saldo');

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('saldo', [], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->buildSaldoStats());

        return response()->json($stats);
    }

    public function receivablePayableStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'receivable_payable');

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('receivable-payable', [
            'source' => 'latest-nabbrekap-v2',
        ], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->buildReceivablePayableStats());

        return response()->json($stats);
    }

    public function deliveryStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'delivery');

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('delivery', [
            'date_parser' => 2,
        ], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->buildDeliveryStats());

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
        Log::info("UserNote SAVE: User ID $userId, Length " . strlen($content));

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
            Log::error("UserNote SAVE ERROR: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan catatan: ' . $e->getMessage()], 500);
        }
    }

    private function buildQuotationStats(int $months = 12, string $group = 'week'): array
    {
        if (!Schema::hasTable('tb_penawaran')) {
            return [];
        }

        if ($group === 'month') {
            $end = Carbon::now()->startOfMonth();
            $start = $end->copy()->subMonths($months - 1);

            $rawStats = DB::table('tb_penawaran')
                ->selectRaw("DATE_FORMAT(Tgl_penawaran, '%Y-%m') as period, COUNT(*) as total")
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
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

        $rawStats = DB::table('tb_penawaran')
            ->selectRaw('YEARWEEK(Tgl_penawaran, 1) as week_key, COUNT(*) as total')
            ->whereNotNull('Tgl_penawaran')
            ->where('Tgl_penawaran', '>=', $startWeekStart->toDateString())
            ->where('Tgl_penawaran', '<=', Carbon::now()->toDateString())
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
        if (!Schema::hasTable('tb_penawaran')) {
            return [];
        }

        if ($range === '1_week') {
            $end = Carbon::now()->startOfDay();
            $start = $end->copy()->subDays(6);

            $raw = DB::table('tb_penawaran')
                ->selectRaw("DATE_FORMAT(Tgl_penawaran, '%Y-%m-%d') as period, COUNT(*) as total")
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $start->toDateString())
                ->where('Tgl_penawaran', '<=', $end->copy()->endOfDay()->toDateTimeString())
                ->groupBy('period')
                ->orderBy('period')
                ->pluck('total', 'period');

            $stats = [];
            for ($i = 0; $i < 7; $i += 1) {
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

            $raw = DB::table('tb_penawaran')
                ->selectRaw('YEARWEEK(Tgl_penawaran, 1) as week_key, COUNT(*) as total')
                ->whereNotNull('Tgl_penawaran')
                ->where('Tgl_penawaran', '>=', $startWeek->toDateString())
                ->where('Tgl_penawaran', '<=', Carbon::now()->endOfDay()->toDateTimeString())
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

        if ($range === '3_months') return $this->buildQuotationStats(3, 'month');
        if ($range === '5_months') return $this->buildQuotationStats(5, 'month');
        if ($range === '1_year') return $this->buildQuotationStats(12, 'month');

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

        if (Schema::hasTable('tb_kas')
            && Schema::hasColumn('tb_kas', 'Saldo')
            && Schema::hasColumn('tb_kas', 'Tgl_Voucher')
            && Schema::hasColumn('tb_kas', 'Kode_Voucher')
            && Schema::hasColumn('tb_kas', 'Kode_Akun')) {

            $codes = array_keys($accountMap);
            $query = null;
            foreach ($codes as $code) {
                $q = DB::table('tb_kas')
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

        return $saldoStats;
    }

    private function buildReceivablePayableStats(): array
    {
        $result = [
            'piutang' => ['total' => 0.0, 'last_update' => null],
            'hutang' => ['total' => 0.0, 'last_update' => null],
            'meta' => ['source' => 'tb_nabbrekap.latest_saldo'],
        ];

        $accountCodes = [
            'piutang' => '1109AD',
            'hutang' => '2101AK',
        ];

        if (Schema::hasTable('tb_nabbrekap')) {
            $rekapCols = Schema::getColumnListing('tb_nabbrekap');
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

                $orderDateSql = count($dateOrderParts) > 0
                    ? 'COALESCE(' . implode(',', $dateOrderParts) . ')'
                    : 'Kode_Akun';

                foreach ($accountCodes as $key => $code) {
                    $row = DB::table('tb_nabbrekap')
                        ->whereRaw('LOWER(TRIM(Kode_Akun)) = ?', [strtolower($code)])
                        ->select('Saldo')
                        ->when(in_array('End_Date', $rekapCols, true), fn ($query) => $query->addSelect('End_Date'))
                        ->when(in_array('Posting_Date', $rekapCols, true), fn ($query) => $query->addSelect('Posting_Date'))
                        ->orderByRaw("{$orderDateSql} desc")
                        ->when(in_array('Posting_Date', $rekapCols, true), fn ($query) => $query->orderByDesc('Posting_Date'))
                        ->when(in_array('Kode_NaBB', $rekapCols, true), fn ($query) => $query->orderByDesc('Kode_NaBB'))
                        ->first();

                    if ($row) {
                        $result[$key] = [
                            'total' => (float) ($row->Saldo ?? 0),
                            'last_update' => $row->Posting_Date ?? $row->End_Date ?? null,
                        ];
                    }
                }

                if (($result['piutang']['total'] ?? 0) !== 0.0 || ($result['hutang']['total'] ?? 0) !== 0.0) {
                    return $result;
                }
            }
        }

        $result['meta']['source'] = 'tb_nabb.saldo + tb_kas.tgl_voucher';

        if (!Schema::hasTable('tb_nabb')) {
            return $result;
        }

        $nabbCols = Schema::getColumnListing('tb_nabb');
        $kasCols = Schema::hasTable('tb_kas') ? Schema::getColumnListing('tb_kas') : [];
        $lastUpdateAccountColumns = array_values(array_filter(
            ['Kode_Akun1', 'Kode_Akun2', 'Kode_Akun3'],
            fn (string $col) => in_array($col, $kasCols, true)
        ));

        $hasRequired = in_array('Kode_Akun', $nabbCols, true)
            && in_array('Saldo', $nabbCols, true)
            && (
                !Schema::hasTable('tb_kas')
                || (
                    in_array('Tgl_Voucher', $kasCols, true)
                    && count($lastUpdateAccountColumns) > 0
                )
            );

        if (!$hasRequired) {
            return $result;
        }

        $stats = DB::table('tb_nabb')
            ->whereIn('Kode_Akun', ['1109AD', '2101AK'])
            ->selectRaw("SUM(CASE WHEN LOWER(TRIM(Kode_Akun)) = '1109ad' THEN COALESCE(Saldo, 0) ELSE 0 END) as piutang_total")
            ->selectRaw("SUM(CASE WHEN LOWER(TRIM(Kode_Akun)) = '2101ak' THEN COALESCE(Saldo, 0) ELSE 0 END) as hutang_total")
            ->first();

        $piutangTotal = (float) ($stats->piutang_total ?? 0);
        $hutangTotal = (float) ($stats->hutang_total ?? 0);

        $lastUpdateFromKas = function (array $accountCodes) use ($lastUpdateAccountColumns): ?string {
            if (!Schema::hasTable('tb_kas') || count($accountCodes) === 0 || count($lastUpdateAccountColumns) === 0) {
                return null;
            }

            $lastUpdate = DB::table('tb_kas')
                ->where(function ($query) use ($lastUpdateAccountColumns, $accountCodes) {
                    foreach ($lastUpdateAccountColumns as $index => $col) {
                        if ($index === 0) {
                            $query->whereIn($col, $accountCodes);
                            continue;
                        }
                        $query->orWhereIn($col, $accountCodes);
                    }
                })
                ->max('Tgl_Voucher');

            return $lastUpdate ?: null;
        };

        try {
            $result['piutang'] = [
                'total' => $piutangTotal,
                'last_update' => $lastUpdateFromKas(['1109AD']),
            ];

            $result['hutang'] = [
                'total' => $hutangTotal,
                'last_update' => $lastUpdateFromKas(['2101AK']),
            ];
            return $result;
        } catch (\Throwable) {
            return $result;
        }
    }

    private function buildDeliveryStats(): array
    {
        return [
            'pdb' => $this->getPdbStats(),
            'pdo' => $this->getPdoStats(),
        ];
    }

    private function getPdbStats()
    {
        if (!Schema::hasTable('tb_kdpdb')) {
            return ['total' => 0, 'count' => 0, 'last_update' => null];
        }

        // Single query: sum, count, and max date in one pass
        $dateSql = $this->normalizedDateSql('Tgl_Posting');
        $row = DB::table('tb_kdpdb')
            ->where('Sisa', '>', 0)
            ->selectRaw("SUM(Sisa) as total, COUNT(*) as cnt, MAX($dateSql) as last_update")
            ->first();

        return [
            'total'       => (float) ($row->total ?? 0),
            'count'       => (int)   ($row->cnt ?? 0),
            'last_update' => $row->last_update ?? null,
        ];
    }

    private function getPdoStats()
    {
        if (!Schema::hasTable('tb_kdpdo')) {
            return ['total' => 0, 'count' => 0, 'last_update' => null];
        }

        // Single query: sum, count, and max date in one pass
        $dateSql = $this->normalizedDateSql('posting_date');
        $row = DB::table('tb_kdpdo')
            ->where('sisa_pdo', '>', 0)
            ->selectRaw("SUM(sisa_pdo) as total, COUNT(*) as cnt, MAX($dateSql) as last_update")
            ->first();

        return [
            'total'       => (float) ($row->total ?? 0),
            'count'       => (int)   ($row->cnt ?? 0),
            'last_update' => $row->last_update ?? null,
        ];
    }

    public function getSalesHppStats(Request $request, $period = null) {
        $this->authorizeDashboardCard($request, 'sales_hpp');

        // Prioritize route param -> query param -> default
        if (!$period) {
             $period = $request->input('period', '3_months');
        }

        $group = strtolower((string) $request->query('group', 'month'));
        if (!in_array($group, ['week', 'month'], true)) {
            $group = 'month';
        }

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember($this->dashboardCacheKey('sales-hpp', [
            'period' => $period,
            'group' => $group,
            'today' => Carbon::now()->toDateString(),
        ], $request), self::DASHBOARD_CACHE_TTL, fn () => $this->getSalesHppStatsData($period, $group));

        return response()->json($stats);
    }

    private function getSalesHppStatsData(string $period, string $group = 'week')
    {
        if ($period === '1_week') {
            return $this->getSalesHppDailyStats();
        }
        if ($period === '1_month') {
            return $this->getSalesHppWeeklyStatsForMonth();
        }

        $now = Carbon::now()->endOfMonth();
        $months = 3;

        if ($period === '5_months') {
            $months = 5;
        } elseif ($period === '1_year') {
            $months = 12;
        }

        // We want to go back $months - 1 from current month to include current month
        // e.g., 3 months: Current, Current-1, Current-2
        $start = $now->copy()->startOfMonth()->subMonths($months - 1);

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'debug' => [
                'received_period' => $period,
                'calculated_months' => $months,
            ],
            'series' => [],
        ];

        $salesLastUpdate = null;
        $hppLastUpdate = null;
        $biayaLastUpdate = null;

        if ($group === 'week') {
            $endWeekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
            $startWeekStart = Carbon::now()
                ->startOfMonth()
                ->subMonths($months - 1)
                ->startOfWeek(Carbon::MONDAY);

            // Sales grouped by week
            $salesData = [];
            if (Schema::hasTable('tb_kdfakturpenjualan')) {
                $salesData = DB::table('tb_kdfakturpenjualan')
                    ->selectRaw('YEARWEEK(tgl_doc, 1) as week_key, SUM(harga) as total')
                    ->where('tgl_doc', '>=', $startWeekStart->toDateString())
                    ->where('tgl_doc', '<=', Carbon::now()->toDateString())
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                    ->selectRaw('MAX(tgl_doc) as last_update')
                    ->where('tgl_doc', '>=', $startWeekStart->toDateString())
                    ->value('last_update');
            }

            // HPP grouped by week
            $hppData = [];
            $hppQuery = $this->tbDoHppQuery();
            if ($hppQuery) {
                $hppData = $hppQuery
                    ->selectRaw("YEARWEEK(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y'), 1) as week_key, SUM(COALESCE(d.total,0)) as total")
                    ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$startWeekStart->toDateString()])
                    ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') <= ?", [Carbon::now()->toDateString()])
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $hppLastUpdateRaw = $this->tbDoHppQuery()
                    ->selectRaw("MAX(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y')) as last_update")
                    ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$startWeekStart->toDateString()])
                    ->value('last_update');
                $hppLastUpdate = $hppLastUpdateRaw;
            }

            // Biaya (Beban) from tb_kas: Kode_Akun1 starts with 51, Jenis_Beban1 Debit.
            $biayaData = [];
            $biayaQuery = $this->tbKasBiayaQuery();
            if ($biayaQuery) {
                $biayaData = $biayaQuery
                    ->selectRaw("YEARWEEK(k.Tgl_Voucher, 1) as week_key, SUM(COALESCE(k.Nominal1,0)) as total")
                    ->where('k.Tgl_Voucher', '>=', $startWeekStart->toDateString())
                    ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                    ->groupBy('week_key')
                    ->pluck('total', 'week_key');

                $biayaLastUpdate = $this->tbKasBiayaQuery()
                    ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                    ->where('k.Tgl_Voucher', '>=', $startWeekStart->toDateString())
                    ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                    ->value('last_update');
            }

            // Build series by week
            $cursor = $startWeekStart->copy();
            while ($cursor->lte($endWeekStart)) {
                $isoYear = (int) $cursor->isoWeekYear();
                $isoWeek = (int) $cursor->isoWeek();
                $weekKey = ($isoYear * 100) + $isoWeek;
                $key = sprintf('%d-W%02d', $isoYear, $isoWeek);

                $sales = (float) ($salesData[$weekKey] ?? 0);
                $hpp = (float) ($hppData[$weekKey] ?? 0);
                $biaya = (float) ($biayaData[$weekKey] ?? 0);

                $result['series'][] = [
                    'period' => $key,
                    'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                    'sales' => $sales,
                    'hpp' => $hpp,
                    'biaya' => $biaya,
                ];

                $result['summary']['sales_total'] += $sales;
                $result['summary']['hpp_total'] += $hpp;
                $result['summary']['biaya_total'] += $biaya;

                $cursor->addWeek();
            }

            $lastUpdate = $salesLastUpdate;
            if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
                $lastUpdate = $hppLastUpdate;
            }
            if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
                $lastUpdate = $biayaLastUpdate;
            }
            $result['summary']['last_update'] = $lastUpdate;

            return $result;
        }

        // Pre-fetch all relevant data grouped by month to avoid N+1 queries in loop
        // Sales: tgl_doc is DATE type (YYYY-MM-DD)
        $salesData = [];
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("DATE_FORMAT(tgl_doc, '%Y-%m') as month_key, SUM(harga) as total")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->where('tgl_doc', '<=', $now->toDateString())
                ->groupBy('month_key')
                ->pluck('total', 'month_key');
            
             $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("MAX(tgl_doc) as last_update")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->value('last_update');
        }

        $hppData = [];
        $hppQuery = $this->tbDoHppQuery();
        if ($hppQuery) {
            $hppData = $hppQuery
                ->selectRaw("DATE_FORMAT(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y'), '%Y-%m') as month_key, SUM(COALESCE(d.total,0)) as total")
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') <= ?", [$now->toDateString()])
                ->groupBy('month_key')
                ->pluck('total', 'month_key');

            $hppLastUpdateRaw = $this->tbDoHppQuery()
                 ->selectRaw("MAX(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y')) as last_update")
                 ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$start->toDateString()])
                 ->value('last_update');
            $hppLastUpdate = $hppLastUpdateRaw;
        }

        // Biaya (Beban) from tb_kas: Kode_Akun1 starts with 51, Jenis_Beban1 Debit.
        $biayaData = [];
        $biayaQuery = $this->tbKasBiayaQuery();
        if ($biayaQuery) {
            $biayaData = $biayaQuery
                ->selectRaw("DATE_FORMAT(k.Tgl_Voucher, '%Y-%m') as month_key, SUM(COALESCE(k.Nominal1,0)) as total")
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $now->toDateString())
                ->groupBy('month_key')
                ->pluck('total', 'month_key');

            $biayaLastUpdate = $this->tbKasBiayaQuery()
                ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $now->toDateString())
                ->value('last_update');
        }

        // Build series
        for ($i = 0; $i < $months; $i++) {
            $currentMonth = $start->copy()->addMonths($i);
            $key = $currentMonth->format('Y-m');
            
            $sales = (float) ($salesData[$key] ?? 0);
            $hpp = (float) ($hppData[$key] ?? 0);
            $biaya = (float) ($biayaData[$key] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => $currentMonth->locale('id')->translatedFormat('M Y'),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];

            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;
        }

        // Determine overall last update
        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }

    private function getSalesHppDailyStats(): array
    {
        $end = Carbon::now()->startOfDay();
        $start = $end->copy()->subDays(6);

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'series' => [],
        ];

        $salesData = [];
        $salesLastUpdate = null;
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw("DATE_FORMAT(tgl_doc, '%Y-%m-%d') as day_key, SUM(harga) as total")
                ->where('tgl_doc', '>=', $start->toDateString())
                ->where('tgl_doc', '<=', $end->toDateString())
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('MAX(tgl_doc) as last_update')
                ->where('tgl_doc', '>=', $start->toDateString())
                ->value('last_update');
        }

        $hppData = [];
        $hppLastUpdate = null;
        $hppQuery = $this->tbDoHppQuery();
        if ($hppQuery) {
            $hppData = $hppQuery
                ->selectRaw("DATE_FORMAT(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y'), '%Y-%m-%d') as day_key, SUM(COALESCE(d.total,0)) as total")
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') <= ?", [$end->toDateString()])
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $hppLastUpdate = $this->tbDoHppQuery()
                ->selectRaw("MAX(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y')) as last_update")
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$start->toDateString()])
                ->value('last_update');
        }

        $biayaData = [];
        $biayaLastUpdate = null;
        $biayaQuery = $this->tbKasBiayaQuery();
        if ($biayaQuery) {
            $biayaData = $biayaQuery
                ->selectRaw("DATE_FORMAT(k.Tgl_Voucher, '%Y-%m-%d') as day_key, SUM(COALESCE(k.Nominal1,0)) as total")
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $end->toDateString())
                ->groupBy('day_key')
                ->pluck('total', 'day_key');

            $biayaLastUpdate = $this->tbKasBiayaQuery()
                ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                ->where('k.Tgl_Voucher', '>=', $start->toDateString())
                ->where('k.Tgl_Voucher', '<=', $end->toDateString())
                ->value('last_update');
        }

        for ($i = 0; $i < 7; $i += 1) {
            $day = $start->copy()->addDays($i);
            $key = $day->format('Y-m-d');
            $sales = (float) ($salesData[$key] ?? 0);
            $hpp = (float) ($hppData[$key] ?? 0);
            $biaya = (float) ($biayaData[$key] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => $day->locale('id')->translatedFormat('d M'),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];
            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;
        }

        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }

    // Tambahkan method ini di dalam class DashboardController

    private function buildStockSummary(): array
    {
        $result = [
            'physical' => null,
            'physical_last_update' => null,
            'book' => null,
            'book_last_update' => null,
            'difference' => null,
        ];

        // 1. HITUNG STOK BUKU & LAST UPDATE STOK BUKU
        if (Schema::hasTable('tb_kas')) {
            $kasCols = Schema::getColumnListing('tb_kas');
            // Ubah semua kolom menjadi lowercase untuk menghindari kegagalan case-sensitivity
            $kasColsLower = array_map('strtolower', $kasCols);
            
            $accountField = in_array('kode_akun1', $kasColsLower, true) ? 'Kode_Akun1' : 'Kode_Akun';
            
            // Cari kolom tanggal buat secara dinamis (case-insensitive)
            $tglBuatField = 'Tgl_Buat'; 
            if (in_array('tgl_buat', $kasColsLower, true)) {
                $tglBuatField = $kasCols[array_search('tgl_buat', $kasColsLower, true)];
            } elseif (in_array('tgl_voucher', $kasColsLower, true)) {
                $tglBuatField = $kasCols[array_search('tgl_voucher', $kasColsLower, true)];
            }

            // Ambil saldo buku dari baris terakhir akun 1105AD
            $lastKasRow = DB::table('tb_kas')
                ->where($accountField, '1105AD')
                ->orderByDesc(in_array('tgl_voucher', $kasColsLower, true) ? 'Tgl_Voucher' : 'id')
                ->orderByDesc(in_array('kode_voucher', $kasColsLower, true) ? 'Kode_Voucher' : 'id')
                ->first();

            if ($lastKasRow) {
                $result['book'] = (float) ($lastKasRow->Saldo ?? 0);
            } else {
                $result['book'] = 0.0;
            }

            // Ambil nilai MAX dari kolom tanggal buat khusus untuk Last Update Stok Buku
            $bookDateSql = $this->normalizedDateSql($tglBuatField);
            $maxBookDate = DB::table('tb_kas')
                ->where($accountField, '1105AD')
                ->selectRaw("MAX($bookDateSql) as last_update")
                ->value('last_update');
            if ($maxBookDate) {
                $result['book_last_update'] = $this->normalizeDate($maxBookDate);
            }
        }

        // 2. HITUNG NOMINAL STOK FISIK (Logika Kode VB6)
        $hmis = 0; $hmib = 0; $hmibs = 0; $hmi = 0; $hdo = 0; $hdob = 0; $hdot = 0;
        $hasAnyPhysicalTable = false;

        if (Schema::hasTable('tb_mi')) {
            $hasAnyPhysicalTable = true;
            $rowMi = DB::table('tb_mi')->selectRaw('SUM(harga_mis) as mis, SUM(harga_mib) as mib')->first();
            $hmis = (float) ($rowMi->mis ?? 0);
            $hmib = (float) ($rowMi->mib ?? 0);
        }

        if (Schema::hasTable('tb_mib')) {
            $hasAnyPhysicalTable = true;
            $hmibs = (float) DB::table('tb_mib')->sum('total_price');
        }

        if (Schema::hasTable('tb_barang')) {
            $hasAnyPhysicalTable = true;
            $hmi = (float) DB::table('tb_barang')->selectRaw('SUM(
                (coalesce(cast(stok_g1 as decimal(18,4)), 0) * coalesce(cast(harga_stokg1 as decimal(18,4)), 0)) +
                (coalesce(cast(stok_g2 as decimal(18,4)), 0) * coalesce(cast(harga_stokg2 as decimal(18,4)), 0)) +
                (coalesce(cast(stok_g3 as decimal(18,4)), 0) * coalesce(cast(harga_stokg3 as decimal(18,4)), 0)) +
                (coalesce(cast(stok_g4 as decimal(18,4)), 0) * coalesce(cast(harga_stokg4 as decimal(18,4)), 0))
            ) as total_value')->value('total_value');
        }

        if (Schema::hasTable('tb_do')) {
            $hasAnyPhysicalTable = true;
            $hdo = (float) DB::table('tb_do')->where('Val_inv', '<>', 1)->orWhereNull('Val_inv')->sum('total');
        }

        if (Schema::hasTable('tb_dobi')) {
            $hasAnyPhysicalTable = true;
            $hdob = (float) DB::table('tb_dobi')->where('status', 0)->sum('total');
        }

        if (Schema::hasTable('tb_dob')) {
            $hasAnyPhysicalTable = true;
            $hdot = (float) DB::table('tb_dob')->where('status', 0)->sum('total');
        }

        if ($hasAnyPhysicalTable) {
            $result['physical'] = $hmis + $hmib + $hmibs + $hmi + $hdo + $hdob + $hdot;
        }

        // 3. HITUNG LAST UPDATE KHUSUS STOK FISIK
        $physicalDates = [];

        if (Schema::hasTable('tb_mi')) {
            $postingTglSql = $this->normalizedDateSql('posting_tgl');
            $lastUpdateMi = DB::table('tb_mi')
                ->selectRaw("MAX($postingTglSql) as last_update")
                ->value('last_update');
            if ($lastUpdateMi) {
                $physicalDates[] = $this->normalizeDate($lastUpdateMi);
            }
        }

        if (Schema::hasTable('tb_kdmib') && Schema::hasTable('tb_mib')) {
            $postingTglSql = $this->normalizedDateSql('tb_kdmib.posting_tgl');
            $lastUpdateMib = DB::table('tb_kdmib')
                ->join('tb_mib', 'tb_kdmib.no_doc', '=', 'tb_mib.no_doc')
                ->selectRaw("MAX($postingTglSql) as last_update")
                ->value('last_update');
            if ($lastUpdateMib) {
                $physicalDates[] = $this->normalizeDate($lastUpdateMib);
            }
        }

        if (Schema::hasTable('tb_barang') && Schema::hasColumn('tb_barang', 'tgl_buat')) {
            $tglBuatSql = $this->normalizedDateSql('tgl_buat');
            $lastUpdateMaterial = DB::table('tb_barang')
                ->selectRaw("MAX($tglBuatSql) as last_update")
                ->value('last_update');
            if ($lastUpdateMaterial) {
                $physicalDates[] = $this->normalizeDate($lastUpdateMaterial);
            }
        }

        if (Schema::hasTable('tb_do') && Schema::hasColumn('tb_do', 'pos_tgl')) {
            $posTglSql = $this->normalizedDateSql('pos_tgl');
            $lastUpdateDo = DB::table('tb_do')
                ->where(function ($query) {
                    $query->where('Val_inv', '<>', 1)->orWhereNull('Val_inv');
                })
                ->selectRaw("MAX($posTglSql) as last_update")
                ->value('last_update');
            if ($lastUpdateDo) {
                $physicalDates[] = $this->normalizeDate($lastUpdateDo);
            }
        }

        if (Schema::hasTable('tb_dobi') && Schema::hasColumn('tb_dobi', 'pos_tgl')) {
            $posTglSql = $this->normalizedDateSql('pos_tgl');
            $lastUpdateDobi = DB::table('tb_dobi')
                ->where('status', 0)
                ->selectRaw("MAX($posTglSql) as last_update")
                ->value('last_update');
            if ($lastUpdateDobi) {
                $physicalDates[] = $this->normalizeDate($lastUpdateDobi);
            }
        }

        if (Schema::hasTable('tb_dob') && Schema::hasColumn('tb_dob', 'pos_tgl')) {
            $posTglSql = $this->normalizedDateSql('pos_tgl');
            $lastUpdateDob = DB::table('tb_dob')
                ->where('status', 0)
                ->selectRaw("MAX($posTglSql) as last_update")
                ->value('last_update');
            if ($lastUpdateDob) {
                $physicalDates[] = $this->normalizeDate($lastUpdateDob);
            }
        }

        $physicalDates = array_filter($physicalDates);
        if (!empty($physicalDates)) {
            rsort($physicalDates); // Urutkan dari yang paling baru
            $result['physical_last_update'] = $physicalDates[0];
        }

        // 4. HITUNG SELISIH (STOK FISIK - STOK BUKU)
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
        if (!$dateString) return null;
        $dateString = trim($dateString);
        try {
            // Deteksi jika format menggunakan dot/strip di awal (ex: 25.12.2025 atau 25-12-2025)
            if (preg_match('/^\d{2}[\.\-]\d{2}[\.\-]\d{4}/', $dateString)) {
                $separator = str_contains($dateString, '.') ? '.' : '-';
                $parts = explode(' ', $dateString);
                $datePart = $parts[0];
                return \Illuminate\Support\Carbon::createFromFormat("d{$separator}m{$separator}Y", $datePart)->toDateString();
            }
            return \Illuminate\Support\Carbon::parse($dateString)->toDateString();
        } catch (\Exception $e) {
            return $dateString; // Kembalikan string asli jika gagal di-parse
        }
    }

    // Tambahkan method ini ke dalam DashboardController untuk menyediakan API endpoint
    public function stockSummaryStats(Request $request)
    {
        $this->authorizeDashboardCard($request, 'stock_summary');

        $stats = Cache::tags(self::DASHBOARD_CACHE_TAGS)->remember(
            $this->dashboardCacheKey('stock-summary', [
                'date_parser' => 2,
            ], $request),
            self::DASHBOARD_CACHE_TTL, 
            fn () => $this->buildStockSummary()
        );

        return response()->json($stats);
    }

    private function getSalesHppWeeklyStatsForMonth(): array
    {
        // 4 minggu berjalan (termasuk minggu ini)
        $endWeek = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $startWeek = $endWeek->copy()->subWeeks(3);

        $result = [
            'summary' => [
                'sales_total' => 0,
                'hpp_total' => 0,
                'biaya_total' => 0,
                'last_update' => null,
            ],
            'series' => [],
        ];

        $salesData = [];
        $salesLastUpdate = null;
        if (Schema::hasTable('tb_kdfakturpenjualan')) {
            $salesData = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('YEARWEEK(tgl_doc, 1) as week_key, SUM(harga) as total')
                ->where('tgl_doc', '>=', $startWeek->toDateString())
                ->where('tgl_doc', '<=', Carbon::now()->toDateString())
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $salesLastUpdate = DB::table('tb_kdfakturpenjualan')
                ->selectRaw('MAX(tgl_doc) as last_update')
                ->where('tgl_doc', '>=', $startWeek->toDateString())
                ->value('last_update');
        }

        $hppData = [];
        $hppLastUpdate = null;
        $hppQuery = $this->tbDoHppQuery();
        if ($hppQuery) {
            $hppData = $hppQuery
                ->selectRaw("YEARWEEK(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y'), 1) as week_key, SUM(COALESCE(d.total,0)) as total")
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$startWeek->toDateString()])
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') <= ?", [Carbon::now()->toDateString()])
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $hppLastUpdate = $this->tbDoHppQuery()
                ->selectRaw("MAX(STR_TO_DATE(d.pos_tgl, '%d.%m.%Y')) as last_update")
                ->whereRaw("STR_TO_DATE(d.pos_tgl, '%d.%m.%Y') >= ?", [$startWeek->toDateString()])
                ->value('last_update');
        }

        $biayaData = [];
        $biayaLastUpdate = null;
        $biayaQuery = $this->tbKasBiayaQuery();
        if ($biayaQuery) {
            $biayaData = $biayaQuery
                ->selectRaw("YEARWEEK(k.Tgl_Voucher, 1) as week_key, SUM(COALESCE(k.Nominal1,0)) as total")
                ->where('k.Tgl_Voucher', '>=', $startWeek->toDateString())
                ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                ->groupBy('week_key')
                ->pluck('total', 'week_key');

            $biayaLastUpdate = $this->tbKasBiayaQuery()
                ->selectRaw('MAX(k.Tgl_Voucher) as last_update')
                ->where('k.Tgl_Voucher', '>=', $startWeek->toDateString())
                ->where('k.Tgl_Voucher', '<=', Carbon::now()->toDateString())
                ->value('last_update');
        }

        $cursor = $startWeek->copy();
        while ($cursor->lte($endWeek)) {
            $isoYear = (int) $cursor->isoWeekYear();
            $isoWeek = (int) $cursor->isoWeek();
            $weekKey = ($isoYear * 100) + $isoWeek;
            $key = sprintf('%d-W%02d', $isoYear, $isoWeek);

            $sales = (float) ($salesData[$weekKey] ?? 0);
            $hpp = (float) ($hppData[$weekKey] ?? 0);
            $biaya = (float) ($biayaData[$weekKey] ?? 0);

            $result['series'][] = [
                'period' => $key,
                'label' => sprintf('W%02d %d', $isoWeek, $isoYear),
                'sales' => $sales,
                'hpp' => $hpp,
                'biaya' => $biaya,
            ];

            $result['summary']['sales_total'] += $sales;
            $result['summary']['hpp_total'] += $hpp;
            $result['summary']['biaya_total'] += $biaya;

            $cursor->addWeek();
        }

        $lastUpdate = $salesLastUpdate;
        if ($hppLastUpdate && (!$lastUpdate || $hppLastUpdate > $lastUpdate)) {
            $lastUpdate = $hppLastUpdate;
        }
        if ($biayaLastUpdate && (!$lastUpdate || $biayaLastUpdate > $lastUpdate)) {
            $lastUpdate = $biayaLastUpdate;
        }
        $result['summary']['last_update'] = $lastUpdate;

        return $result;
    }
}
