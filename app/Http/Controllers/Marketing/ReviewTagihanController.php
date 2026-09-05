<?php

namespace App\Http\Controllers\Marketing;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ReviewTagihanController
{
    private function dueDateExpr(): string
    {
        return "coalesce(date(jth_tempo), str_to_date(jth_tempo, '%Y-%m-%d'), str_to_date(jth_tempo, '%Y/%m/%d'), str_to_date(jth_tempo, '%d/%m/%Y'), str_to_date(jth_tempo, '%d-%m-%Y'), str_to_date(jth_tempo, '%d.%m.%Y'))";
    }

    private function baseInvoiceQuery()
    {
        return DB::table('tb_kdfakturpenjualan')
            ->whereRaw('coalesce(cast(saldo_piutang as decimal(18,4)), 0) > 0')
            ->whereRaw("trim(coalesce(nm_cs, '')) <> ''");
    }

    private function applyDueScope($query, string $scope, ?string $overdueRange = null): void
    {
        $today = Carbon::today();
        $dueDateExpr = $this->dueDateExpr();

        if ($scope === 'near_due') {
            $query->whereRaw("{$dueDateExpr} between ? and ?", [
                $today->copy()->addDay()->toDateString(),
                $today->copy()->addDays(7)->toDateString(),
            ]);
            return;
        }

        if ($scope === 'current_month') {
            $query->whereRaw("{$dueDateExpr} between ? and ?", [
                $today->copy()->startOfMonth()->toDateString(),
                $today->copy()->endOfMonth()->toDateString(),
            ]);
            return;
        }

        if ($scope === 'overdue') {
            $query->whereRaw("{$dueDateExpr} < ?", [$today->toDateString()]);
            $this->applyOverdueRange($query, $overdueRange ?? '30');
        }
    }

    private function applyOverdueRange($query, string $range): void
    {
        if ($range === 'all') {
            return;
        }

        $ageExpr = "datediff(?, {$this->dueDateExpr()})";
        $today = Carbon::today()->toDateString();

        if ($range === 'gt720') {
            $query->whereRaw("{$ageExpr} > 720", [$today]);
            return;
        }

        $days = (int) $range;
        if ($days > 0) {
            $query->whereRaw("{$ageExpr} between 1 and ?", [$today, $days]);
        }
    }

    public function index()
    {
        return Inertia::render('penjualan/review-tagihan/index');
    }

    public function summary(Request $request)
    {
        $overdueRange = (string) $request->query('overdue_range', '30');

        $nearDue = $this->baseInvoiceQuery();
        $this->applyDueScope($nearDue, 'near_due');

        $currentMonth = $this->baseInvoiceQuery();
        $this->applyDueScope($currentMonth, 'current_month');

        $overdue = $this->baseInvoiceQuery();
        $this->applyDueScope($overdue, 'overdue', $overdueRange);

        return response()->json([
            'near_due_customers' => (int) (clone $nearDue)->selectRaw('count(distinct nm_cs) as total')->value('total'),
            'near_due_invoices' => (int) (clone $nearDue)->count(),
            'current_month_customers' => (int) (clone $currentMonth)->selectRaw('count(distinct nm_cs) as total')->value('total'),
            'current_month_invoices' => (int) (clone $currentMonth)->count(),
            'overdue_customers' => (int) (clone $overdue)->selectRaw('count(distinct nm_cs) as total')->value('total'),
            'overdue_invoices' => (int) (clone $overdue)->count(),
        ]);
    }

    public function customers(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $sort = (string) $request->query('sort', 'oldest_due');
        $perPageInput = $request->query('per_page', 5);
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $perPageInput);
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();

        $query = $this->baseInvoiceQuery()
            ->whereRaw("{$dueDateExpr} < ?", [$today]);

        if ($search !== '') {
            $query->whereRaw('lower(nm_cs) like ?', ['%' . Str::lower($search) . '%']);
        }

        $rowsQuery = $query
            ->select(
                'nm_cs',
                DB::raw('count(*) as total_faktur'),
                DB::raw('sum(coalesce(cast(saldo_piutang as decimal(18,4)), 0)) as total_saldo_piutang'),
                DB::raw("max(datediff('{$today}', {$dueDateExpr})) as umur_tempo_terlama")
            )
            ->groupBy('nm_cs');

        match ($sort) {
            'shortest_due' => $rowsQuery->orderBy('umur_tempo_terlama'),
            'largest_balance' => $rowsQuery->orderByDesc('total_saldo_piutang'),
            'smallest_balance' => $rowsQuery->orderBy('total_saldo_piutang'),
            'most_invoices' => $rowsQuery->orderByDesc('total_faktur'),
            'fewest_invoices' => $rowsQuery->orderBy('total_faktur'),
            default => $rowsQuery->orderByDesc('umur_tempo_terlama'),
        };

        $rows = $rowsQuery->get()->map(function ($row) {
            $maxAge = (int) ($row->umur_tempo_terlama ?? 0);
            $saldo = (float) ($row->total_saldo_piutang ?? 0);

            if ($maxAge > 90 || $saldo >= 50000000) {
                $priority = 'CRITICAL';
                $priorityLabel = 'Kritis';
                $badgeClass = 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
            } elseif ($maxAge > 45 || $saldo >= 25000000) {
                $priority = 'HIGH';
                $priorityLabel = 'Tinggi';
                $badgeClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
            } elseif ($maxAge > 20) {
                $priority = 'MEDIUM';
                $priorityLabel = 'Sedang';
                $badgeClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
            } else {
                $priority = 'LOW';
                $priorityLabel = 'Rendah';
                $badgeClass = 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30';
            }
            $row->priority_tier = $priority;
            $row->priority_label = $priorityLabel;
            $row->badge_class = $badgeClass;
            return $row;
        });

        $total = $rows->count();

        return response()->json([
            'data' => $rows->forPage($page, $perPage)->values(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function overdueCustomerNames()
    {
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();
        $ageExpr = "datediff(?, {$dueDateExpr})";

        $customers = $this->baseInvoiceQuery()
            ->whereRaw("{$dueDateExpr} < ?", [$today])
            ->whereRaw("{$ageExpr} > 90", [$today])
            ->select('nm_cs')
            ->distinct()
            ->orderBy('nm_cs')
            ->pluck('nm_cs')
            ->values();

        return response()->json([
            'customers' => $customers,
        ]);
    }

    public function invoices(Request $request)
    {
        $scope = (string) $request->query('scope', 'overdue');
        $overdueRange = (string) $request->query('overdue_range', '30');
        $customer = trim((string) $request->query('customer', ''));
        $today = Carbon::today()->toDateString();
        $dueDateExpr = $this->dueDateExpr();
        $ageSelectExpr = $scope === 'near_due'
            ? "datediff('{$today}', {$dueDateExpr})"
            : "greatest(datediff('{$today}', {$dueDateExpr}), 0)";

        $query = $this->baseInvoiceQuery()
            ->select(
                'no_fakturpenjualan',
                'tgl_doc',
                'ref_po',
                'harga',
                'h_ppn',
                'g_total',
                'tgl_terimainv',
                'tgl_bayar',
                'total_bayaran',
                'saldo_piutang',
                'jth_tempo',
                'nm_cs',
                DB::raw("{$ageSelectExpr} as umur_tempo")
            );

        if ($customer !== '') {
            $query->whereRaw('lower(trim(nm_cs)) = ?', [Str::lower(trim($customer))]);
        }

        $this->applyDueScope($query, $scope, $overdueRange);

        $rows = $query
            ->orderByDesc('umur_tempo')
            ->orderBy('jth_tempo')
            ->get();

        return response()->json([
            'customer' => $customer !== '' ? $customer : $this->scopeLabel($scope, $overdueRange),
            'total_overdue' => (float) $rows->sum(fn ($row) => (float) ($row->saldo_piutang ?? 0)),
            'oldest_overdue_days' => (int) ($rows->max('umur_tempo') ?? 0),
            'invoices' => $rows,
        ]);
    }

    public function aiAnalyze(Request $request, \App\Services\Marketing\CollectionAnalyticsService $analyticsService)
    {
        $scope = (string) $request->input('scope', 'all');
        $overdueRange = (string) $request->input('overdue_range', 'all');
        $customer = trim((string) $request->input('customer', ''));

        $query = $this->baseInvoiceQuery()
            ->select(
                'no_fakturpenjualan',
                'nm_cs',
                'kd_cs',
                'tgl_doc',
                'jth_tempo',
                'tgl_terimainv',
                'ref_po',
                'g_total',
                'total_bayaran',
                'saldo_piutang'
            );

        if ($customer !== '') {
            $query->whereRaw('lower(trim(nm_cs)) = ?', [Str::lower(trim($customer))]);
        }

        if ($scope !== 'all') {
            $this->applyDueScope($query, $scope, $overdueRange);
        }

        $invoices = $query->get()->map(fn ($row) => (array) $row)->toArray();

        $result = $analyticsService->analyzeCollections($invoices, Carbon::today()->toDateString());

        return response()->json($result);
    }

    private function scopeLabel(string $scope, string $overdueRange): string
    {
        return match ($scope) {
            'near_due' => 'Dekat Jatuh Tempo',
            'current_month' => 'Jatuh Tempo Bulan Sekarang',
            default => $overdueRange === 'all' ? 'Lewat Jatuh Tempo' : "Lewat Jatuh Tempo {$overdueRange} Hari",
        };
    }
}
