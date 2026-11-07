<?php

namespace App\Http\Controllers\Laporan;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NabbRekapController
{
    /**
     * Helper SQL untuk mengekstrak YYYY-MM dari tb_nabbrekap.End_date
     * (dengan fallback cerdas ke Kode_NaBB jika End_date kosong).
     *
     * Menggunakan CONVERT(... USING utf8mb4) COLLATE utf8mb4_unicode_ci
     * untuk mencegah error MySQL 1267 (Illegal mix of collations antara latin1 dan utf8mb4).
     */
    private function getRekapYmSql(?string $endDateCol, ?string $kodeNabbCol = 'Kode_NaBB'): string
    {
        $kodeNabbClean = "CONVERT(NULLIF(TRIM(tb_nabbrekap.{$kodeNabbCol}), '') USING utf8mb4)";
        $nabbCodeExprUtf8 = "CASE 
            WHEN LENGTH({$kodeNabbClean}) >= 6 
            THEN CONCAT(SUBSTRING(RIGHT({$kodeNabbClean}, 6), 1, 4), '-', SUBSTRING(RIGHT({$kodeNabbClean}, 6), 5, 2))
            ELSE NULL
        END";

        if ($endDateCol) {
            $endDateClean = "CONVERT(NULLIF(TRIM(tb_nabbrekap.{$endDateCol}), '') USING utf8mb4)";

            $dateExpr = "COALESCE(
                CASE 
                    WHEN {$endDateClean} REGEXP '^[0-9]{4}-[0-9]{2}' 
                    THEN SUBSTRING({$endDateClean}, 1, 7)
                    WHEN {$endDateClean} REGEXP '^[0-9]{4}/[0-9]{2}' 
                    THEN CONCAT(SUBSTRING({$endDateClean}, 1, 4), '-', SUBSTRING({$endDateClean}, 6, 2))
                    WHEN LENGTH({$endDateClean}) = 6 AND {$endDateClean} REGEXP '^[0-9]{6}$'
                    THEN CONCAT(SUBSTRING({$endDateClean}, 1, 4), '-', SUBSTRING({$endDateClean}, 5, 2))
                    ELSE NULL
                END,
                DATE_FORMAT(STR_TO_DATE({$endDateClean}, '%d.%m.%Y'), '%Y-%m'),
                DATE_FORMAT(STR_TO_DATE({$endDateClean}, '%d-%m-%Y'), '%Y-%m'),
                DATE_FORMAT({$endDateClean}, '%Y-%m')
            )";

            return "CONVERT(COALESCE({$dateExpr}, {$nabbCodeExprUtf8}) USING utf8mb4) COLLATE utf8mb4_unicode_ci";
        }

        return "CONVERT({$nabbCodeExprUtf8} USING utf8mb4) COLLATE utf8mb4_unicode_ci";
    }

    /**
     * Helper SQL untuk mengekstrak YYYY-MM dari tb_jurnalpenyesuaian.Periode
     * Menggunakan regex & substring terdepan agar format YYYY-MM, YYYY-MM-DD, maupun YYYY/MM tidak menghasilkan NULL pada DATE_FORMAT MySQL.
     * Dipastikan utf8mb4_unicode_ci agar kompatibel saat JOIN & WHERE.
     */
    private function getAjpYmSql(): string
    {
        $periodeClean = "CONVERT(NULLIF(TRIM(tb_jurnalpenyesuaian.Periode), '') USING utf8mb4)";
        return "CONVERT(COALESCE(
            CASE 
                WHEN {$periodeClean} REGEXP '^[0-9]{4}-[0-9]{2}' 
                THEN SUBSTRING({$periodeClean}, 1, 7)
                WHEN {$periodeClean} REGEXP '^[0-9]{4}/[0-9]{2}' 
                THEN CONCAT(SUBSTRING({$periodeClean}, 1, 4), '-', SUBSTRING({$periodeClean}, 6, 2))
                WHEN LENGTH({$periodeClean}) = 6 AND {$periodeClean} REGEXP '^[0-9]{6}$'
                THEN CONCAT(SUBSTRING({$periodeClean}, 1, 4), '-', SUBSTRING({$periodeClean}, 5, 2))
                ELSE NULL
            END,
            DATE_FORMAT(STR_TO_DATE({$periodeClean}, '%d.%m.%Y'), '%Y-%m'),
            DATE_FORMAT(STR_TO_DATE({$periodeClean}, '%d-%m-%Y'), '%Y-%m'),
            DATE_FORMAT({$periodeClean}, '%Y-%m')
        ) USING utf8mb4) COLLATE utf8mb4_unicode_ci";
    }

    private function pickNameColumn(array $rekapCols): array
    {
        // 1. Jika tb_nabbrekap sendiri memiliki kolom Nama_Akun
        $rekapNameCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'nama_akun');
        if ($rekapNameCol) {
            return [
                'join_type' => 'none',
                'name_select' => "tb_nabbrekap.{$rekapNameCol} as Nama_Akun",
                'name_where' => "CONVERT(tb_nabbrekap.{$rekapNameCol} USING utf8mb4) COLLATE utf8mb4_unicode_ci",
                'name_sort' => "tb_nabbrekap.{$rekapNameCol}",
            ];
        }

        // 2. Hubungkan dengan tb_nabb (Master Akun)
        if (Schema::hasTable('tb_nabb')) {
            $cols = Schema::getColumnListing('tb_nabb');
            $nabbNameCol = collect($cols)->first(fn ($c) => strtolower($c) === 'nama_akun');
            $nabbKodeCol = collect($cols)->first(fn ($c) => strtolower($c) === 'kode_akun') ?? 'Kode_Akun';
            if ($nabbNameCol) {
                return [
                    'join_type' => 'nabb',
                    'nabb_kode_col' => $nabbKodeCol,
                    'name_select' => "tb_nabb.{$nabbNameCol} as Nama_Akun",
                    'name_where' => "CONVERT(tb_nabb.{$nabbNameCol} USING utf8mb4) COLLATE utf8mb4_unicode_ci",
                    'name_sort' => "tb_nabb.{$nabbNameCol}",
                ];
            }
        }

        return [
            'join_type' => 'none',
            'name_select' => DB::raw("'' as Nama_Akun"),
            'name_where' => null,
            'name_sort' => null,
        ];
    }

    /**
     * Ambil daftar opsi periode YYYY-MM dari tb_nabbrekap.End_date dan tb_jurnalpenyesuaian.Periode
     */
    private function getPeriodOptions(): array
    {
        $options = [];

        // 1. Dari tb_nabbrekap
        if (Schema::hasTable('tb_nabbrekap')) {
            try {
                $rekapCols = Schema::getColumnListing('tb_nabbrekap');
                $endDateCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'end_date');
                $kodeNabbCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'kode_nabb') ?? 'Kode_NaBB';
                $rekapYmExpr = $this->getRekapYmSql($endDateCol, $kodeNabbCol);

                $rekapPeriods = DB::table('tb_nabbrekap')
                    ->selectRaw("DISTINCT {$rekapYmExpr} as ym")
                    ->whereNotNull(DB::raw($rekapYmExpr))
                    ->pluck('ym')
                    ->filter(fn ($p) => is_string($p) && preg_match('/^\d{4}-\d{2}$/', $p))
                    ->all();

                $options = array_merge($options, $rekapPeriods);
            } catch (\Throwable) {
                // abaikan jika gagal baca
            }
        }

        // 2. Dari tb_jurnalpenyesuaian
        if (Schema::hasTable('tb_jurnalpenyesuaian') && Schema::hasColumn('tb_jurnalpenyesuaian', 'Periode')) {
            try {
                $ajpYmExpr = $this->getAjpYmSql();
                $ajpPeriods = DB::table('tb_jurnalpenyesuaian')
                    ->selectRaw("DISTINCT {$ajpYmExpr} as ym")
                    ->whereNotNull('Periode')
                    ->pluck('ym')
                    ->filter(fn ($p) => is_string($p) && preg_match('/^\d{4}-\d{2}$/', $p))
                    ->all();

                $options = array_merge($options, $ajpPeriods);
            } catch (\Throwable) {
                // abaikan jika gagal baca
            }
        }

        $unique = array_values(array_unique(array_filter($options)));
        rsort($unique); // Urutkan periode terbaru di atas (ex: 2026-10, 2026-09, ...)

        return $unique;
    }

    private function getDefaultPeriod(): ?string
    {
        $opts = $this->getPeriodOptions();
        return $opts[0] ?? null;
    }

    private function getYearOptions(): array
    {
        return collect($this->getPeriodOptions())
            ->map(fn ($p) => substr((string) $p, 0, 4))
            ->filter(fn ($y) => is_string($y) && preg_match('/^\d{4}$/', $y))
            ->unique()
            ->values()
            ->all();
    }

    private function getDefaultYear(): ?string
    {
        $defaultPeriod = $this->getDefaultPeriod();
        if ($defaultPeriod && preg_match('/^\d{4}-\d{2}$/', $defaultPeriod)) {
            return substr($defaultPeriod, 0, 4);
        }

        $years = $this->getYearOptions();
        return $years[0] ?? null;
    }

    /**
     * Format label periode ramah pengguna (misal: "Oktober 2026" atau "Tahun 2026")
     */
    private function formatPeriodLabel(string $period, string $compareType = 'month'): string
    {
        if ($compareType === 'year') {
            return "Tahun {$period}";
        }
        if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
            $months = [
                1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
            ];
            $monthNum = (int) $m[2];
            $monthName = $months[$monthNum] ?? $m[2];
            return "{$monthName} {$m[1]}";
        }
        return $period;
    }

    public function index(Request $request)
    {
        $periodOptions = $this->getPeriodOptions();
        $yearOptions = $this->getYearOptions();
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $compareType = (string) $request->query('compareType', 'month');
        $compareType = in_array($compareType, ['month', 'year'], true) ? $compareType : 'month';

        // Parse periode komparasi dinamis
        $rawPeriods = $request->query('periods');
        $comparePeriods = [];
        if (is_array($rawPeriods)) {
            $comparePeriods = $rawComparePeriods;
        } elseif (is_string($rawPeriods) && trim($rawPeriods) !== '') {
            $comparePeriods = explode(',', $rawPeriods);
        }

        // Fallback backward-compatible period1 & period2
        if (empty($comparePeriods)) {
            $p1 = (string) $request->query('period1', '');
            $p2 = (string) $request->query('period2', '');
            if ($p1 !== '') $comparePeriods[] = $p1;
            if ($p2 !== '' && $p2 !== $p1) $comparePeriods[] = $p2;
        }

        $comparePeriods = array_values(array_unique(array_filter(array_map('trim', $comparePeriods))));

        if (count($comparePeriods) < 2) {
            if ($compareType === 'year') {
                $comparePeriods = array_slice($yearOptions, 0, min(2, count($yearOptions)));
            } else {
                $comparePeriods = array_slice($periodOptions, 0, min(2, count($periodOptions)));
            }
        }
        sort($comparePeriods);

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year', 'all'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = match ($periodType) {
            'year' => ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: '')),
            'all' => '',
            default => ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: '')),
        };

        return Inertia::render('laporan/nabb-rekap/index', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'isCompare' => $request->query('isCompare') === 'true' || $request->query('isCompare') === '1' || $request->query('mode') === 'compare',
                'compareType' => $compareType,
                'comparePeriods' => $comparePeriods,
                'period1' => $comparePeriods[0] ?? ($periodOptions[1] ?? ''),
                'period2' => $comparePeriods[count($comparePeriods) - 1] ?? ($periodOptions[0] ?? ''),
                'changeFilter' => (string) $request->query('changeFilter', 'all'),
                'search' => (string) $request->query('search', ''),
                'accountGroup' => (string) $request->query('accountGroup', 'all'),
                'ajpFilter' => (string) $request->query('ajpFilter', 'all'),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'saldoSign' => (string) $request->query('saldoSign', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
                'pageSize' => (int) $request->query('pageSize', 10),
            ],
            'periodOptions' => $periodOptions,
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $yearOptions,
            'defaultYear' => $defaultYear,
        ]);
    }

    public function print(Request $request)
    {
        $periodOptions = $this->getPeriodOptions();
        $yearOptions = $this->getYearOptions();
        $defaultPeriod = $this->getDefaultPeriod();
        $defaultYear = $this->getDefaultYear();

        $compareType = (string) $request->query('compareType', 'month');
        $compareType = in_array($compareType, ['month', 'year'], true) ? $compareType : 'month';

        $rawPeriods = $request->query('periods');
        $comparePeriods = [];
        if (is_array($rawPeriods)) {
            $comparePeriods = $rawPeriods;
        } elseif (is_string($rawPeriods) && trim($rawPeriods) !== '') {
            $comparePeriods = explode(',', $rawPeriods);
        }

        if (empty($comparePeriods)) {
            $p1 = (string) $request->query('period1', '');
            $p2 = (string) $request->query('period2', '');
            if ($p1 !== '') $comparePeriods[] = $p1;
            if ($p2 !== '' && $p2 !== $p1) $comparePeriods[] = $p2;
        }

        $comparePeriods = array_values(array_unique(array_filter(array_map('trim', $comparePeriods))));
        if (count($comparePeriods) < 2) {
            if ($compareType === 'year') {
                $comparePeriods = array_slice($yearOptions, 0, min(2, count($yearOptions)));
            } else {
                $comparePeriods = array_slice($periodOptions, 0, min(2, count($periodOptions)));
            }
        }
        sort($comparePeriods);

        $periodType = (string) $request->query('periodType', 'month');
        $periodType = in_array($periodType, ['month', 'year', 'all'], true) ? $periodType : 'month';
        $requestedPeriod = (string) $request->query('period', '');

        $initialPeriod = match ($periodType) {
            'year' => ($requestedPeriod !== '' ? $requestedPeriod : ($defaultYear ?: '')),
            'all' => '',
            default => ($requestedPeriod !== '' ? $requestedPeriod : ($defaultPeriod ?: '')),
        };

        $database = $request->session()->get('tenant.database') ?? $request->cookie('tenant_database');
        
        $companyNameMap = [
            'dbsja' => 'CV. Semesta Jaya Abadi',
            'dbbbbs' => 'CV. Bangun Banua Bersama Sejahtera',
            'dbstg' => 'CV. Surya Teknik Gemilang',
            'dbati' => 'PT. Allstar Tekstil Indonesia',
            'dbarm' => 'AR-MART',
            'dbjms' => 'CV. JLX Makmur Sentosa',
        ];

        $companyConfig = config("tenants.companies.{$database}", []);
        $companyName = $companyConfig['name']
            ?? ($companyNameMap[$database] ?? null)
            ?? config("tenants.labels.{$database}")
            ?? 'CV. Semesta Jaya Abadi';

        return Inertia::render('laporan/nabb-rekap/print', [
            'initialQuery' => [
                'periodType' => $periodType,
                'period' => $initialPeriod,
                'isCompare' => $request->query('isCompare') === 'true' || $request->query('isCompare') === '1' || $request->query('mode') === 'compare',
                'compareType' => $compareType,
                'comparePeriods' => $comparePeriods,
                'period1' => $comparePeriods[0] ?? ($periodOptions[1] ?? ''),
                'period2' => $comparePeriods[count($comparePeriods) - 1] ?? ($periodOptions[0] ?? ''),
                'changeFilter' => (string) $request->query('changeFilter', 'all'),
                'search' => (string) $request->query('search', ''),
                'accountGroup' => (string) $request->query('accountGroup', 'all'),
                'ajpFilter' => (string) $request->query('ajpFilter', 'all'),
                'saldoFilter' => (string) $request->query('saldoFilter', 'all'),
                'saldoSign' => (string) $request->query('saldoSign', 'all'),
                'sortBy' => (string) $request->query('sortBy', 'Kode_Akun'),
                'sortDir' => (string) $request->query('sortDir', 'asc'),
            ],
            'companyName' => $companyName,
            'periodOptions' => $periodOptions,
            'defaultPeriod' => $defaultPeriod,
            'yearOptions' => $yearOptions,
            'defaultYear' => $defaultYear,
        ]);
    }

    public function rows(Request $request)
    {
        try {
            if (!Schema::hasTable('tb_nabbrekap')) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => $this->emptySummary(),
                    'error' => 'Tabel tb_nabbrekap tidak ditemukan di database.',
                ], 500);
            }

            $rekapCols = Schema::getColumnListing('tb_nabbrekap');
            $kodeAkunCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'kode_akun');
            $saldoCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'saldo');
            $endDateCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'end_date');
            $kodeNabbCol = collect($rekapCols)->first(fn ($c) => strtolower($c) === 'kode_nabb') ?? 'Kode_NaBB';

            if (!$kodeAkunCol) {
                return response()->json([
                    'rows' => [],
                    'total' => 0,
                    'summary' => $this->emptySummary(),
                    'error' => 'Kolom Kode_Akun tidak ditemukan pada tabel tb_nabbrekap.',
                ], 500);
            }

            $hasAjpTable = Schema::hasTable('tb_jurnalpenyesuaian')
                && Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun')
                && Schema::hasColumn('tb_jurnalpenyesuaian', 'Periode')
                && Schema::hasColumn('tb_jurnalpenyesuaian', 'Debit')
                && Schema::hasColumn('tb_jurnalpenyesuaian', 'Kredit');

            $nameInfo = $this->pickNameColumn($rekapCols);

            // Cek apakah permintaan dalam Mode Komparasi Antar Bulan / Antar Tahun Dinamis
            $isCompare = $request->query('isCompare') === 'true' || $request->query('isCompare') === '1' || $request->query('mode') === 'compare';
            if ($isCompare) {
                return $this->getDynamicComparisonRows($request, $rekapCols, $kodeAkunCol, $saldoCol, $endDateCol, $kodeNabbCol, $hasAjpTable, $nameInfo);
            }

            // Filtering parameters (Single Period Mode)
            $periodType = (string) $request->query('periodType', 'month');
            $period = trim((string) $request->query('period', ''));
            $search = trim((string) $request->query('search', ''));
            $accountGroup = (string) $request->query('accountGroup', 'all');
            $ajpFilter = (string) $request->query('ajpFilter', 'all');
            $saldoFilter = (string) $request->query('saldoFilter', 'all');
            $saldoSign = (string) $request->query('saldoSign', 'all');

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $rekapYmSql = $this->getRekapYmSql($endDateCol, $kodeNabbCol);
            $ajpYmSql = $this->getAjpYmSql();
            $rekapKodeAkunUtf8 = "CONVERT(TRIM(tb_nabbrekap.{$kodeAkunCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci";

            // 1. Subquery agregasi tb_jurnalpenyesuaian per Kode_Akun dan Periode (YYYY-MM)
            $ajpSub = null;
            if ($hasAjpTable) {
                $ajpKodeCol = Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun') ? 'Kode_Akun' : 'kode_akun';

                $ajpSub = DB::table('tb_jurnalpenyesuaian')
                    ->selectRaw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci as ajp_kode_akun")
                    ->selectRaw("{$ajpYmSql} as ajp_ym")
                    ->selectRaw('COALESCE(SUM(Debit), 0) as total_debit')
                    ->selectRaw('COALESCE(SUM(Kredit), 0) as total_kredit');

                if ($periodType === 'month' && $period !== '') {
                    $ajpSub->whereRaw("{$ajpYmSql} = ?", [$period]);
                } elseif ($periodType === 'year' && $period !== '') {
                    $ajpSub->whereRaw("{$ajpYmSql} LIKE ?", [$period . '-%']);
                }

                $ajpSub->groupBy(
                    DB::raw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                    DB::raw($ajpYmSql)
                );
            }

            // 2. Query utama dari tb_nabbrekap
            $query = DB::table('tb_nabbrekap');

            if (($nameInfo['join_type'] ?? '') === 'nabb') {
                $nabbKodeCol = $nameInfo['nabb_kode_col'] ?? 'Kode_Akun';
                $query->leftJoin('tb_nabb', function ($join) use ($rekapKodeAkunUtf8, $nabbKodeCol) {
                    $join->on(
                        DB::raw("CONVERT(TRIM(tb_nabb.{$nabbKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                        '=',
                        DB::raw($rekapKodeAkunUtf8)
                    );
                });
            }

            // Left Join dengan hasil agregasi tb_jurnalpenyesuaian dicompare per Kode_Akun dan YYYY-MM
            if ($ajpSub) {
                $query->leftJoinSub($ajpSub, 'ajp', function ($join) use ($rekapKodeAkunUtf8, $rekapYmSql) {
                    $join->on(DB::raw($rekapKodeAkunUtf8), '=', 'ajp.ajp_kode_akun')
                         ->on(DB::raw($rekapYmSql), '=', 'ajp.ajp_ym');
                });
            }

            // Period Filter pada tb_nabbrekap.End_date (YYYY-MM)
            if ($period !== '') {
                if ($periodType === 'month') {
                    $query->whereRaw("{$rekapYmSql} = ?", [$period]);
                } elseif ($periodType === 'year') {
                    $query->whereRaw("{$rekapYmSql} LIKE ?", [$period . '-%']);
                }
            }

            // Account Group Filter
            if ($accountGroup !== 'all' && preg_match('/^[1-9]$/', $accountGroup)) {
                $query->whereRaw("LEFT({$rekapKodeAkunUtf8}, 1) = ?", [$accountGroup]);
            }

            // Search
            if ($search !== '') {
                $query->where(function ($q) use ($search, $rekapKodeAkunUtf8, $nameInfo, $kodeNabbCol) {
                    $q->whereRaw("{$rekapKodeAkunUtf8} LIKE ?", ['%' . $search . '%']);
                    if ($nameInfo['name_where']) {
                        $q->orWhereRaw("{$nameInfo['name_where']} LIKE ?", ['%' . $search . '%']);
                    }
                    if (Schema::hasColumn('tb_nabbrekap', $kodeNabbCol)) {
                        $q->orWhereRaw("CONVERT(tb_nabbrekap.{$kodeNabbCol} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?", ['%' . $search . '%']);
                    }
                });
            }

            // 3. Formula penyesuaian saldo: Debit > Kredit -> Saldo berkurang, Kredit > Debit -> Saldo bertambah
            $rawSaldoSql = $saldoCol ? "COALESCE(tb_nabbrekap.{$saldoCol}, 0)" : '0';
            $debitAjpSql = $hasAjpTable ? 'COALESCE(ajp.total_debit, 0)' : '0';
            $kreditAjpSql = $hasAjpTable ? 'COALESCE(ajp.total_kredit, 0)' : '0';

            $adjustedSaldoSql = "CASE
                WHEN {$debitAjpSql} > {$kreditAjpSql}
                    THEN ({$rawSaldoSql} - ({$debitAjpSql} - {$kreditAjpSql}))
                WHEN {$kreditAjpSql} > {$debitAjpSql}
                    THEN ({$rawSaldoSql} + ({$kreditAjpSql} - {$debitAjpSql}))
                ELSE {$rawSaldoSql}
            END";

            // Filter AJP
            if ($ajpFilter === 'adjusted') {
                $query->whereRaw("({$debitAjpSql} > 0 OR {$kreditAjpSql} > 0)");
            } elseif ($ajpFilter === 'unadjusted') {
                $query->whereRaw("({$debitAjpSql} = 0 AND {$kreditAjpSql} = 0)");
            }

            // Saldo Filters
            if ($saldoFilter === 'nonzero') {
                $query->whereRaw("({$adjustedSaldoSql}) <> 0");
            } elseif ($saldoFilter === 'zero') {
                $query->whereRaw("({$adjustedSaldoSql}) = 0");
            }

            if ($saldoSign === 'positive') {
                $query->whereRaw("({$adjustedSaldoSql}) > 0");
            } elseif ($saldoSign === 'negative') {
                $query->whereRaw("({$adjustedSaldoSql}) < 0");
            } elseif ($saldoSign === 'zero') {
                $query->whereRaw("({$adjustedSaldoSql}) = 0");
            }

            // 4. Hitung ringkasan agregat (Summary)
            $summaryRow = (clone $query)
                ->selectRaw('COUNT(*) as total_accounts')
                ->selectRaw("COALESCE(SUM({$rawSaldoSql}), 0) as total_saldo_awal")
                ->selectRaw("COALESCE(SUM({$debitAjpSql}), 0) as total_ajp_debit")
                ->selectRaw("COALESCE(SUM({$kreditAjpSql}), 0) as total_ajp_kredit")
                ->selectRaw("COALESCE(SUM({$adjustedSaldoSql}), 0) as total_saldo")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '1' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_aset")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '2' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_liabilitas")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '3' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_ekuitas")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '4' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_pendapatan")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '5' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_biaya_operasional")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) = '6' THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_hpp")
                ->selectRaw("COALESCE(SUM(CASE WHEN LEFT({$rekapKodeAkunUtf8}, 1) IN ('5','6','7','8','9') THEN ABS({$adjustedSaldoSql}) ELSE 0 END), 0) as total_beban")
                ->selectRaw("COALESCE(SUM(CASE WHEN ({$adjustedSaldoSql}) > 0 THEN 1 ELSE 0 END), 0) as positive_count")
                ->selectRaw("COALESCE(SUM(CASE WHEN ({$adjustedSaldoSql}) < 0 THEN 1 ELSE 0 END), 0) as negative_count")
                ->selectRaw("COALESCE(SUM(CASE WHEN ({$adjustedSaldoSql}) = 0 THEN 1 ELSE 0 END), 0) as zero_count")
                ->selectRaw("COALESCE(SUM(CASE WHEN ({$debitAjpSql} > 0 OR {$kreditAjpSql} > 0) THEN 1 ELSE 0 END), 0) as adjusted_count")
                ->first();

            $total = (int) ($summaryRow->total_accounts ?? 0);

            // 5. Select fields yang komprehensif
            $diffSql = "({$adjustedSaldoSql} - {$rawSaldoSql})";
            $diffPercentSql = "CASE
                WHEN {$rawSaldoSql} = 0 AND {$adjustedSaldoSql} = 0 THEN 0
                WHEN {$rawSaldoSql} = 0 AND {$adjustedSaldoSql} > 0 THEN 100
                WHEN {$rawSaldoSql} = 0 AND {$adjustedSaldoSql} < 0 THEN -100
                ELSE ROUND((({$adjustedSaldoSql} - {$rawSaldoSql}) / ABS({$rawSaldoSql})) * 100, 2)
            END";

            $selectFields = [
                "tb_nabbrekap.{$kodeAkunCol} as Kode_Akun",
                $nameInfo['name_select'],
                DB::raw("{$rawSaldoSql} as Saldo_Awal"),
                DB::raw("{$debitAjpSql} as Ajp_Debit"),
                DB::raw("{$kreditAjpSql} as Ajp_Kredit"),
                DB::raw("({$kreditAjpSql} - {$debitAjpSql}) as Ajp_Selisih"),
                DB::raw("{$adjustedSaldoSql} as Saldo"),
                DB::raw("{$diffSql} as Diff_Nominal"),
                DB::raw("{$diffPercentSql} as Diff_Percent"),
                DB::raw("{$rekapYmSql} as Periode_YM"),
            ];

            if (Schema::hasColumn('tb_nabbrekap', $kodeNabbCol)) {
                $selectFields[] = "tb_nabbrekap.{$kodeNabbCol} as Kode_NaBB";
            }
            if ($endDateCol) {
                $selectFields[] = "tb_nabbrekap.{$endDateCol} as End_Date";
            }

            $allowedSortBy = [
                'Kode_Akun' => 'tb_nabbrekap.' . $kodeAkunCol,
                'Nama_Akun' => $nameInfo['name_sort'] ?: ('tb_nabbrekap.' . $kodeAkunCol),
                'Saldo' => 'Saldo',
                'Saldo_Awal' => 'Saldo_Awal',
                'Ajp_Debit' => 'Ajp_Debit',
                'Ajp_Kredit' => 'Ajp_Kredit',
                'Diff_Nominal' => 'Diff_Nominal',
                'Diff_Percent' => 'Diff_Percent',
                'Periode_YM' => 'Periode_YM',
            ];
            $sortBy = $allowedSortBy[$sortByRaw] ?? ('tb_nabbrekap.' . $kodeAkunCol);

            $rowsQuery = (clone $query)->select($selectFields);

            if ($sortByRaw === 'Saldo') {
                $rowsQuery->orderByRaw("({$adjustedSaldoSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Saldo_Awal') {
                $rowsQuery->orderByRaw("({$rawSaldoSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Ajp_Debit') {
                $rowsQuery->orderByRaw("({$debitAjpSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Ajp_Kredit') {
                $rowsQuery->orderByRaw("({$kreditAjpSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Diff_Nominal') {
                $rowsQuery->orderByRaw("({$diffSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Diff_Percent') {
                $rowsQuery->orderByRaw("({$diffPercentSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Periode_YM') {
                $rowsQuery->orderByRaw("({$rekapYmSql}) {$sortDir}");
            } else {
                $rowsQuery->orderBy($sortBy, $sortDir);
            }

            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();

            // Hitung selisih neraca: Aset - (Liabilitas + Ekuitas)
            $totAset = (float) ($summaryRow->total_aset ?? 0);
            $totLiab = (float) ($summaryRow->total_liabilitas ?? 0);
            $totEku = (float) ($summaryRow->total_ekuitas ?? 0);
            $selisihNeraca = round($totAset - ($totLiab + $totEku), 2);

            $totAwal = (float) ($summaryRow->total_saldo_awal ?? 0);
            $totAkhir = (float) ($summaryRow->total_saldo ?? 0);
            $totDiff = round($totAkhir - $totAwal, 2);
            $totDiffPct = $totAwal != 0.0 ? round(($totDiff / abs($totAwal)) * 100, 2) : ($totAkhir != 0.0 ? 100.0 : 0.0);

            return response()->json([
                'isCompare' => false,
                'rows' => $rawRows,
                'total' => $total,
                'summary' => [
                    'total_accounts' => $total,
                    'total_saldo_awal' => $totAwal,
                    'total_ajp_debit' => (float) ($summaryRow->total_ajp_debit ?? 0),
                    'total_ajp_kredit' => (float) ($summaryRow->total_ajp_kredit ?? 0),
                    'total_saldo' => $totAkhir,
                    'total_diff_nominal' => $totDiff,
                    'total_diff_percent' => $totDiffPct,
                    'total_aset' => $totAset,
                    'total_liabilitas' => $totLiab,
                    'total_ekuitas' => $totEku,
                    'total_pendapatan' => (float) ($summaryRow->total_pendapatan ?? 0),
                    'total_biaya_operasional' => (float) ($summaryRow->total_biaya_operasional ?? 0),
                    'total_hpp' => (float) ($summaryRow->total_hpp ?? 0),
                    'total_beban' => (float) ($summaryRow->total_beban ?? 0),
                    'selisih_neraca' => $selisihNeraca,
                    'is_balanced' => abs($selisihNeraca) < 1.0,
                    'positive_count' => (int) ($summaryRow->positive_count ?? 0),
                    'negative_count' => (int) ($summaryRow->negative_count ?? 0),
                    'zero_count' => (int) ($summaryRow->zero_count ?? 0),
                    'adjusted_count' => (int) ($summaryRow->adjusted_count ?? 0),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'rows' => [],
                'total' => 0,
                'summary' => $this->emptySummary(),
                'error' => 'Gagal memproses data NABB Rekap: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Memproses data perbandingan dinamis antar periode (2 bulan, 3 bulan, dst. atau antar tahun).
     */
    private function getDynamicComparisonRows(
        Request $request,
        array $rekapCols,
        string $kodeAkunCol,
        ?string $saldoCol,
        ?string $endDateCol,
        string $kodeNabbCol,
        bool $hasAjpTable,
        array $nameInfo
    ) {
        try {
            $periodOptions = $this->getPeriodOptions();
            $yearOptions = $this->getYearOptions();

            $compareType = (string) $request->query('compareType', 'month');
            $compareType = in_array($compareType, ['month', 'year'], true) ? $compareType : 'month';

            // Ekstraksi list periode komparasi
            $rawPeriods = $request->query('periods');
            $periods = [];
            if (is_array($rawPeriods)) {
                $periods = $rawPeriods;
            } elseif (is_string($rawPeriods) && trim($rawPeriods) !== '') {
                $periods = explode(',', $rawPeriods);
            }

            // Fallback backward-compatible period1 & period2
            if (empty($periods)) {
                $p1 = (string) $request->query('period1', '');
                $p2 = (string) $request->query('period2', '');
                if ($p1 !== '') $periods[] = $p1;
                if ($p2 !== '' && $p2 !== $p1) $periods[] = $p2;
            }

            $periods = array_values(array_unique(array_filter(array_map('trim', $periods))));

            // Jika kurang dari 2 periode, sediakan default
            if (count($periods) < 2) {
                if ($compareType === 'year') {
                    $periods = array_slice($yearOptions, 0, min(2, count($yearOptions)));
                } else {
                    $periods = array_slice($periodOptions, 0, min(2, count($periodOptions)));
                }
            }

            // Urutkan periode secara kronologis (dari periode paling lama ke paling baru)
            sort($periods);

            $firstIdx = 0;
            $lastIdx = max(0, count($periods) - 1);

            $search = trim((string) $request->query('search', ''));
            $accountGroup = (string) $request->query('accountGroup', 'all');
            $changeFilter = (string) $request->query('changeFilter', 'all'); // all, up, down, same, changed

            $sortByRaw = (string) $request->query('sortBy', 'Kode_Akun');
            $sortDirRaw = strtolower((string) $request->query('sortDir', 'asc'));
            $sortDir = in_array($sortDirRaw, ['asc', 'desc'], true) ? $sortDirRaw : 'asc';

            $pageSizeRaw = $request->query('pageSize', 10);
            $pageSize = $pageSizeRaw === 'all' ? 'all' : max(1, (int) $pageSizeRaw);
            $page = max(1, (int) $request->query('page', 1));

            $rekapYmSql = $this->getRekapYmSql($endDateCol, $kodeNabbCol);
            $ajpYmSql = $this->getAjpYmSql();
            $rawSaldoSql = $saldoCol ? "COALESCE(tb_nabbrekap.{$saldoCol}, 0)" : '0';

            // 1. Bangun subquery agregasi untuk setiap periode yang dipilih
            $periodSubqueries = [];
            foreach ($periods as $idx => $p) {
                $periodSubqueries[$idx] = $this->buildPeriodAggregationQuery(
                    $p,
                    $compareType,
                    $rekapYmSql,
                    $ajpYmSql,
                    $rawSaldoSql,
                    $hasAjpTable
                );
            }

            // 2. Base Accounts: gabungan semua Kode_Akun yang ada di seluruh periode terpilih (baik di tb_nabbrekap maupun tb_jurnalpenyesuaian)
            $rekapAccounts = DB::table('tb_nabbrekap')
                ->selectRaw("DISTINCT CONVERT(TRIM(Kode_Akun) USING utf8mb4) COLLATE utf8mb4_unicode_ci as kode_akun")
                ->where(function ($q) use ($periods, $compareType, $rekapYmSql) {
                    foreach ($periods as $p) {
                        if ($compareType === 'year') {
                            $q->orWhereRaw("{$rekapYmSql} LIKE ?", [$p . '-%']);
                        } else {
                            $q->orWhereRaw("{$rekapYmSql} = ?", [$p]);
                        }
                    }
                });

            if ($hasAjpTable) {
                $ajpKodeCol = Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun') ? 'Kode_Akun' : 'kode_akun';
                $ajpAccounts = DB::table('tb_jurnalpenyesuaian')
                    ->selectRaw("DISTINCT CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci as kode_akun")
                    ->where(function ($q) use ($periods, $compareType, $ajpYmSql) {
                        foreach ($periods as $p) {
                            if ($compareType === 'year') {
                                $q->orWhereRaw("{$ajpYmSql} LIKE ?", [$p . '-%']);
                            } else {
                                $q->orWhereRaw("{$ajpYmSql} = ?", [$p]);
                            }
                        }
                    });
                $allAccounts = $rekapAccounts->union($ajpAccounts);
            } else {
                $allAccounts = $rekapAccounts;
            }

            $query = DB::query()->fromSub($allAccounts, 'acc');

            // Left Join setiap subquery periode dengan collation aman
            foreach ($periodSubqueries as $idx => $sub) {
                $query->leftJoinSub($sub, "p{$idx}", function ($join) use ($idx) {
                    $join->on(
                        DB::raw("CONVERT(acc.kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                        '=',
                        DB::raw("CONVERT(p{$idx}.kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci")
                    );
                });
            }

            // Left Join master akun (Nama_Akun)
            if (($nameInfo['join_type'] ?? '') === 'nabb') {
                $nabbKodeCol = $nameInfo['nabb_kode_col'] ?? 'Kode_Akun';
                $query->leftJoin('tb_nabb', function ($join) use ($nabbKodeCol) {
                    $join->on(
                        DB::raw("CONVERT(TRIM(tb_nabb.{$nabbKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                        '=',
                        'acc.kode_akun'
                    );
                });
            }

            // Filter Kategori Akun
            if ($accountGroup !== 'all' && preg_match('/^[1-9]$/', $accountGroup)) {
                $query->whereRaw("LEFT(acc.kode_akun, 1) = ?", [$accountGroup]);
            }

            // Filter Pencarian
            if ($search !== '') {
                $query->where(function ($q) use ($search, $nameInfo) {
                    $q->where('acc.kode_akun', 'like', '%' . $search . '%');
                    if ($nameInfo['name_where']) {
                        $q->orWhereRaw("{$nameInfo['name_where']} LIKE ?", ['%' . $search . '%']);
                    }
                });
            }

            // Selisih antara periode akhir dan periode awal (overall net shift)
            $firstSaldoSql = "COALESCE(p{$firstIdx}.saldo, 0)";
            $lastSaldoSql = "COALESCE(p{$lastIdx}.saldo, 0)";
            $diffSql = "({$lastSaldoSql} - {$firstSaldoSql})";

            // Filter Arah Perubahan
            if ($changeFilter === 'up') {
                $query->whereRaw("{$diffSql} > 0");
            } elseif ($changeFilter === 'down') {
                $query->whereRaw("{$diffSql} < 0");
            } elseif ($changeFilter === 'same') {
                $query->whereRaw("{$diffSql} = 0");
            } elseif ($changeFilter === 'changed') {
                $query->whereRaw("{$diffSql} <> 0");
            }

            // Persentase Perubahan
            $diffPercentSql = "CASE
                WHEN {$firstSaldoSql} = 0 AND {$lastSaldoSql} = 0 THEN 0
                WHEN {$firstSaldoSql} = 0 AND {$lastSaldoSql} > 0 THEN 100
                WHEN {$firstSaldoSql} = 0 AND {$lastSaldoSql} < 0 THEN -100
                ELSE ROUND((({$lastSaldoSql} - {$firstSaldoSql}) / ABS({$firstSaldoSql})) * 100, 2)
            END";

            // 3. Ringkasan Eksekutif Dinamis
            $summarySelects = [
                DB::raw('COUNT(*) as total_accounts'),
                DB::raw("COALESCE(SUM({$diffSql}), 0) as total_diff_nominal"),
                DB::raw("COALESCE(SUM(CASE WHEN {$diffSql} > 0 THEN 1 ELSE 0 END), 0) as count_up"),
                DB::raw("COALESCE(SUM(CASE WHEN {$diffSql} < 0 THEN 1 ELSE 0 END), 0) as count_down"),
                DB::raw("COALESCE(SUM(CASE WHEN {$diffSql} = 0 THEN 1 ELSE 0 END), 0) as count_same"),
            ];

            foreach ($periods as $idx => $p) {
                $sSql = "COALESCE(p{$idx}.saldo, 0)";
                $summarySelects[] = DB::raw("COALESCE(SUM({$sSql}), 0) as total_saldo_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '1' THEN ABS({$sSql}) ELSE 0 END), 0) as total_aset_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '2' THEN ABS({$sSql}) ELSE 0 END), 0) as total_liabilitas_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '3' THEN ABS({$sSql}) ELSE 0 END), 0) as total_ekuitas_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '4' THEN ABS({$sSql}) ELSE 0 END), 0) as total_pendapatan_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '5' THEN ABS({$sSql}) ELSE 0 END), 0) as total_biaya_operasional_{$idx}");
                $summarySelects[] = DB::raw("COALESCE(SUM(CASE WHEN LEFT(acc.kode_akun, 1) = '6' THEN ABS({$sSql}) ELSE 0 END), 0) as total_hpp_{$idx}");
            }

            $summaryRow = (clone $query)->select($summarySelects)->first();
            $total = (int) ($summaryRow->total_accounts ?? 0);

            // 4. Select Fields untuk Baris Data
            $rowSelects = [
                'acc.kode_akun as Kode_Akun',
                $nameInfo['name_select'],
                DB::raw("{$diffSql} as Diff_Nominal"),
                DB::raw("{$diffPercentSql} as Diff_Percent"),
            ];

            foreach ($periods as $idx => $p) {
                $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo_awal, 0) as Saldo_Awal_{$idx}");
                $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_debit, 0) as Ajp_Debit_{$idx}");
                $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_kredit, 0) as Ajp_Kredit_{$idx}");
                $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo, 0) as Saldo_{$idx}");

                // Kompatibilitas dengan 2 periode (period 1 & 2)
                if ($idx === 0) {
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo_awal, 0) as Saldo_Awal_1");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_debit, 0) as Ajp_Debit_1");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_kredit, 0) as Ajp_Kredit_1");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo, 0) as Saldo_1");
                }
                if ($idx === $lastIdx) {
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo_awal, 0) as Saldo_Awal_2");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_debit, 0) as Ajp_Debit_2");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.ajp_kredit, 0) as Ajp_Kredit_2");
                    $rowSelects[] = DB::raw("COALESCE(p{$idx}.saldo, 0) as Saldo_2");
                }
            }

            $rowsQuery = (clone $query)->select($rowSelects);

            // Sorting dinamis
            if (preg_match('/^Saldo_(\d+)$/', $sortByRaw, $matches)) {
                $tIdx = (int) $matches[1];
                if (isset($periods[$tIdx])) {
                    $rowsQuery->orderByRaw("COALESCE(p{$tIdx}.saldo, 0) {$sortDir}");
                } else {
                    $rowsQuery->orderBy('acc.kode_akun', $sortDir);
                }
            } elseif ($sortByRaw === 'Saldo_1') {
                $rowsQuery->orderByRaw("COALESCE(p{$firstIdx}.saldo, 0) {$sortDir}");
            } elseif ($sortByRaw === 'Saldo_2') {
                $rowsQuery->orderByRaw("COALESCE(p{$lastIdx}.saldo, 0) {$sortDir}");
            } elseif ($sortByRaw === 'Diff_Nominal') {
                $rowsQuery->orderByRaw("({$diffSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Diff_Percent') {
                $rowsQuery->orderByRaw("({$diffPercentSql}) {$sortDir}");
            } elseif ($sortByRaw === 'Nama_Akun') {
                $rowsQuery->orderBy($nameInfo['name_sort'] ?: 'acc.kode_akun', $sortDir);
            } else {
                $rowsQuery->orderBy('acc.kode_akun', $sortDir);
            }

            if ($pageSize !== 'all') {
                $rowsQuery->offset(($page - 1) * $pageSize)->limit($pageSize);
            }

            $rawRows = $rowsQuery->get();

            // Total per periode
            $periodTotals = [];
            $periodLabels = [];
            foreach ($periods as $idx => $p) {
                $lbl = $this->formatPeriodLabel($p, $compareType);
                $periodLabels[] = $lbl;
                $periodTotals[] = [
                    'index' => $idx,
                    'period' => $p,
                    'label' => $lbl,
                    'total_saldo' => (float) ($summaryRow->{"total_saldo_{$idx}"} ?? 0),
                    'total_aset' => (float) ($summaryRow->{"total_aset_{$idx}"} ?? 0),
                    'total_liabilitas' => (float) ($summaryRow->{"total_liabilitas_{$idx}"} ?? 0),
                    'total_ekuitas' => (float) ($summaryRow->{"total_ekuitas_{$idx}"} ?? 0),
                    'total_pendapatan' => (float) ($summaryRow->{"total_pendapatan_{$idx}"} ?? 0),
                    'total_biaya_operasional' => (float) ($summaryRow->{"total_biaya_operasional_{$idx}"} ?? 0),
                    'total_hpp' => (float) ($summaryRow->{"total_hpp_{$idx}"} ?? 0),
                ];
            }

            $totStart = (float) ($summaryRow->{"total_saldo_{$firstIdx}"} ?? 0);
            $totEnd = (float) ($summaryRow->{"total_saldo_{$lastIdx}"} ?? 0);
            $totDiff = (float) ($summaryRow->total_diff_nominal ?? ($totEnd - $totStart));
            $totDiffPct = $totStart != 0.0 ? round(($totDiff / abs($totStart)) * 100, 2) : ($totEnd != 0.0 ? 100.0 : 0.0);

            return response()->json([
                'isCompare' => true,
                'compareType' => $compareType,
                'periods' => $periods,
                'periodLabels' => $periodLabels,
                'period1' => $periods[$firstIdx] ?? '',
                'period2' => $periods[$lastIdx] ?? '',
                'rows' => $rawRows,
                'total' => $total,
                'summary' => [
                    'total_accounts' => $total,
                    'compareType' => $compareType,
                    'periods' => $periods,
                    'periodLabels' => $periodLabels,
                    'period_totals' => $periodTotals,
                    'total_saldo_start' => $totStart,
                    'total_saldo_end' => $totEnd,
                    'total_diff_nominal' => $totDiff,
                    'total_diff_percent' => $totDiffPct,
                    'count_up' => (int) ($summaryRow->count_up ?? 0),
                    'count_down' => (int) ($summaryRow->count_down ?? 0),
                    'count_same' => (int) ($summaryRow->count_same ?? 0),
                    // Backward-compatible keys
                    'total_saldo_1' => $totStart,
                    'total_saldo_2' => $totEnd,
                    'total_aset_1' => (float) ($summaryRow->{"total_aset_{$firstIdx}"} ?? 0),
                    'total_aset_2' => (float) ($summaryRow->{"total_aset_{$lastIdx}"} ?? 0),
                    'diff_aset' => (float) (($summaryRow->{"total_aset_{$lastIdx}"} ?? 0) - ($summaryRow->{"total_aset_{$firstIdx}"} ?? 0)),
                    'total_liabilitas_1' => (float) ($summaryRow->{"total_liabilitas_{$firstIdx}"} ?? 0),
                    'total_liabilitas_2' => (float) ($summaryRow->{"total_liabilitas_{$lastIdx}"} ?? 0),
                    'diff_liabilitas' => (float) (($summaryRow->{"total_liabilitas_{$lastIdx}"} ?? 0) - ($summaryRow->{"total_liabilitas_{$firstIdx}"} ?? 0)),
                    'total_ekuitas_1' => (float) ($summaryRow->{"total_ekuitas_{$firstIdx}"} ?? 0),
                    'total_ekuitas_2' => (float) ($summaryRow->{"total_ekuitas_{$lastIdx}"} ?? 0),
                    'diff_ekuitas' => (float) (($summaryRow->{"total_ekuitas_{$lastIdx}"} ?? 0) - ($summaryRow->{"total_ekuitas_{$firstIdx}"} ?? 0)),
                    'total_biaya_operasional_1' => (float) ($summaryRow->{"total_biaya_operasional_{$firstIdx}"} ?? 0),
                    'total_biaya_operasional_2' => (float) ($summaryRow->{"total_biaya_operasional_{$lastIdx}"} ?? 0),
                    'diff_biaya_operasional' => (float) (($summaryRow->{"total_biaya_operasional_{$lastIdx}"} ?? 0) - ($summaryRow->{"total_biaya_operasional_{$firstIdx}"} ?? 0)),
                    'total_hpp_1' => (float) ($summaryRow->{"total_hpp_{$firstIdx}"} ?? 0),
                    'total_hpp_2' => (float) ($summaryRow->{"total_hpp_{$lastIdx}"} ?? 0),
                    'diff_hpp' => (float) (($summaryRow->{"total_hpp_{$lastIdx}"} ?? 0) - ($summaryRow->{"total_hpp_{$firstIdx}"} ?? 0)),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'isCompare' => true,
                'rows' => [],
                'total' => 0,
                'summary' => [],
                'error' => 'Gagal memproses komparasi NABB Rekap: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Membangun subquery agregasi saldo disesuaikan per akun untuk 1 periode (bulan atau tahun).
     */
    private function buildPeriodAggregationQuery(
        string $period,
        string $compareType,
        string $rekapYmSql,
        string $ajpYmSql,
        string $rawSaldoSql,
        bool $hasAjpTable
    ) {
        $rekapKodeAkunUtf8 = "CONVERT(TRIM(tb_nabbrekap.Kode_Akun) USING utf8mb4) COLLATE utf8mb4_unicode_ci";

        if ($compareType === 'year') {
            // Mode Tahunan: cari snapshot bulan terakhir di tahun tersebut
            $latestYmInYear = DB::table('tb_nabbrekap')
                ->whereRaw("{$rekapYmSql} LIKE ?", [$period . '-%'])
                ->selectRaw("MAX({$rekapYmSql}) as max_ym")
                ->value('max_ym');

            $rekapAgg = DB::table('tb_nabbrekap')
                ->selectRaw("{$rekapKodeAkunUtf8} as agg_kode_akun")
                ->selectRaw("COALESCE(SUM({$rawSaldoSql}), 0) as saldo_awal");

            if ($latestYmInYear) {
                $rekapAgg->whereRaw("{$rekapYmSql} = ?", [$latestYmInYear]);
            } else {
                $rekapAgg->whereRaw("{$rekapYmSql} LIKE ?", [$period . '-%']);
            }
            $rekapAgg->groupBy(DB::raw($rekapKodeAkunUtf8));

            // AJP untuk tahun bersangkutan: akumulasi seluruh penyesuaian di tahun tersebut
            $ajpSub = null;
            if ($hasAjpTable) {
                $ajpKodeCol = Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun') ? 'Kode_Akun' : 'kode_akun';
                $ajpSub = DB::table('tb_jurnalpenyesuaian')
                    ->selectRaw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci as ajp_kode_akun")
                    ->selectRaw('COALESCE(SUM(Debit), 0) as total_debit')
                    ->selectRaw('COALESCE(SUM(Kredit), 0) as total_kredit')
                    ->whereRaw("{$ajpYmSql} LIKE ?", [$period . '-%'])
                    ->groupBy(DB::raw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci"));
            }
        } else {
            // Mode Bulanan (YYYY-MM)
            $rekapAgg = DB::table('tb_nabbrekap')
                ->selectRaw("{$rekapKodeAkunUtf8} as agg_kode_akun")
                ->selectRaw("COALESCE(SUM({$rawSaldoSql}), 0) as saldo_awal")
                ->whereRaw("{$rekapYmSql} = ?", [$period])
                ->groupBy(DB::raw($rekapKodeAkunUtf8));

            $ajpSub = null;
            if ($hasAjpTable) {
                $ajpKodeCol = Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun') ? 'Kode_Akun' : 'kode_akun';
                $ajpSub = DB::table('tb_jurnalpenyesuaian')
                    ->selectRaw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci as ajp_kode_akun")
                    ->selectRaw('COALESCE(SUM(Debit), 0) as total_debit')
                    ->selectRaw('COALESCE(SUM(Kredit), 0) as total_kredit')
                    ->whereRaw("{$ajpYmSql} = ?", [$period])
                    ->groupBy(DB::raw("CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci"));
            }
        }

        // Kumpulkan daftar akun unik yang aktif di periode ini (dari tb_nabbrekap dan tb_jurnalpenyesuaian)
        $periodAccounts = DB::table('tb_nabbrekap')
            ->selectRaw("DISTINCT {$rekapKodeAkunUtf8} as kode_akun");

        if ($compareType === 'year') {
            if ($latestYmInYear) {
                $periodAccounts->whereRaw("{$rekapYmSql} = ?", [$latestYmInYear]);
            } else {
                $periodAccounts->whereRaw("{$rekapYmSql} LIKE ?", [$period . '-%']);
            }
        } else {
            $periodAccounts->whereRaw("{$rekapYmSql} = ?", [$period]);
        }

        if ($hasAjpTable) {
            $ajpKodeCol = Schema::hasColumn('tb_jurnalpenyesuaian', 'Kode_Akun') ? 'Kode_Akun' : 'kode_akun';
            $periodAjpAcc = DB::table('tb_jurnalpenyesuaian')
                ->selectRaw("DISTINCT CONVERT(TRIM({$ajpKodeCol}) USING utf8mb4) COLLATE utf8mb4_unicode_ci as kode_akun");
            if ($compareType === 'year') {
                $periodAjpAcc->whereRaw("{$ajpYmSql} LIKE ?", [$period . '-%']);
            } else {
                $periodAjpAcc->whereRaw("{$ajpYmSql} = ?", [$period]);
            }
            $periodAccounts = $periodAccounts->union($periodAjpAcc);
        }

        $basePeriod = DB::query()->fromSub($periodAccounts, 'bp');

        $basePeriod->leftJoinSub($rekapAgg, 'r', function ($join) {
            $join->on(
                DB::raw("CONVERT(bp.kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                '=',
                DB::raw("CONVERT(r.agg_kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci")
            );
        });

        if ($ajpSub) {
            $basePeriod->leftJoinSub($ajpSub, 'ajp', function ($join) {
                $join->on(
                    DB::raw("CONVERT(bp.kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci"),
                    '=',
                    DB::raw("CONVERT(ajp.ajp_kode_akun USING utf8mb4) COLLATE utf8mb4_unicode_ci")
                );
            });
        }

        $debitSql = $hasAjpTable ? 'COALESCE(ajp.total_debit, 0)' : '0';
        $kreditSql = $hasAjpTable ? 'COALESCE(ajp.total_kredit, 0)' : '0';

        // Formula: Debit > Kredit -> Saldo berkurang, Kredit > Debit -> Saldo bertambah
        $adjustedSql = "CASE
            WHEN {$debitSql} > {$kreditSql}
                THEN (COALESCE(r.saldo_awal, 0) - ({$debitSql} - {$kreditSql}))
            WHEN {$kreditSql} > {$debitSql}
                THEN (COALESCE(r.saldo_awal, 0) + ({$kreditSql} - {$debitSql}))
            ELSE COALESCE(r.saldo_awal, 0)
        END";

        $basePeriod->select([
            'bp.kode_akun as kode_akun',
            DB::raw("COALESCE(r.saldo_awal, 0) as saldo_awal"),
            DB::raw("{$debitSql} as ajp_debit"),
            DB::raw("{$kreditSql} as ajp_kredit"),
            DB::raw("{$adjustedSql} as saldo"),
        ]);

        return $basePeriod;
    }

    private function emptySummary(): array
    {
        return [
            'total_accounts' => 0,
            'total_saldo_awal' => 0,
            'total_ajp_debit' => 0,
            'total_ajp_kredit' => 0,
            'total_saldo' => 0,
            'total_aset' => 0,
            'total_liabilitas' => 0,
            'total_ekuitas' => 0,
            'total_pendapatan' => 0,
            'total_biaya_operasional' => 0,
            'total_hpp' => 0,
            'total_beban' => 0,
            'selisih_neraca' => 0,
            'is_balanced' => true,
            'positive_count' => 0,
            'negative_count' => 0,
            'zero_count' => 0,
            'adjusted_count' => 0,
        ];
    }
}
