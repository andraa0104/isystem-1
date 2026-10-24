<?php

namespace App\Services\Marketing;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PurchaseRequirementPageQuery
{
    private const PO_DATE = "coalesce(date(tgl), str_to_date(tgl, '%Y-%m-%d'), str_to_date(tgl, '%Y/%m/%d'), str_to_date(tgl, '%d/%m/%Y'), str_to_date(tgl, '%d-%m-%Y'), str_to_date(tgl, '%d.%m.%Y'))";

    private function numberSql($connection, string $column): string
    {
        return $connection->getConfig('driver') === 'clickhouse'
            ? "toDecimal128OrNull(nullIf(trimBoth(toString({$column})), ''), 4)"
            : "cast({$column} as decimal(18,4))";
    }

    private function readOutstanding(callable $read): array
    {
        $mysql = DB::connection();
        if (config('purchase-requirement.clickhouse.enabled', true) && !Cache::has('pr_clickhouse_offline')) {
            try {
                return $read(new ClickHouseReadConnection($mysql->getDatabaseName())) + ['source' => 'clickhouse'];
            } catch (\Throwable $error) {
                Cache::put('pr_clickhouse_offline', true, 60);
                Log::warning('PR outstanding ClickHouse read failed; using MySQL.', ['exception' => class_basename($error)]);
            }
        }
        return $read($mysql) + ['source' => 'mysql'];
    }

    public function outstandingSummary(): array
    {
        return $this->readOutstanding(function ($connection) {
            $price = $this->numberSql($connection, 'total_price');
            $details = $this->statusQuery($connection)->selectRaw("sum(coalesce({$price}, 0)) as total_price_sum");
            $row = $connection->table('tb_pr as pr')
                ->joinSub($details, 'detail', 'detail.no_pr', '=', 'pr.no_pr')
                ->whereColumn('detail.untouched_items', 'detail.total_items')
                ->selectRaw('count(*) as outstanding_count, coalesce(sum(detail.total_price_sum), 0) as outstanding_total')
                ->first();
            return ['outstandingCount' => (int) ($row->outstanding_count ?? 0),
                'outstandingTotal' => (float) ($row->outstanding_total ?? 0)];
        });
    }

    private function statusQuery($connection): Builder
    {
        $qty = $this->numberSql($connection, 'qty');
        $remaining = $this->numberSql($connection, 'sisa_pr');
        return $connection->table('tb_detailpr')->select('no_pr')
            ->selectRaw('count(*) as total_items')
            ->selectRaw("sum(case when coalesce({$remaining}, {$qty}, 0) >= coalesce({$qty}, 0) and coalesce({$qty}, 0) > 0 then 1 else 0 end) as untouched_items")
            ->selectRaw("sum(case when coalesce({$remaining}, {$qty}, 0) <= 0 then 1 else 0 end) as realized_items")
            ->groupBy('no_pr');
    }

    public function query(array $filters, $connection = null): Builder
    {
        $connection ??= DB::connection();
        $clickhouse = $connection->getConfig('driver') === 'clickhouse';
        $status = $filters['status'] ?? 'all';
        $material = ($filters['view'] ?? 'customer') === 'material';
        // Explicit output aliases keep ClickHouse JOIN responses identical to
        // MySQL: the browser and document actions require `no_pr`, not `pr.no_pr`.
        $customerColumn = $material ? 'd.for_customer' : 'pr.for_customer';
        $referenceColumn = $material ? 'd.ref_po' : 'pr.ref_po';
        $query = $connection->table('tb_pr as pr')
            ->select(
                'pr.no_pr as no_pr',
                'pr.date as date',
                $customerColumn.' as for_customer',
                $referenceColumn.' as ref_po',
                'pr.jenis_pr as jenis_pr',
                'pr.payment as payment',
            );
        if ($clickhouse) {
            $linkedPo = $connection->table('tb_po')->select('ref_pr')->selectRaw('count(*) as linked_count')->groupBy('ref_pr');
            $query->leftJoinSub($linkedPo, 'linked_po', 'linked_po.ref_pr', '=', 'pr.no_pr')
                ->selectRaw('case when coalesce(linked_po.linked_count, 0) > 0 then 0 else 1 end as can_delete');
        } else {
            $query->selectRaw('case when exists (select 1 from tb_po linked_po where linked_po.ref_pr = pr.no_pr) then 0 else 1 end as can_delete');
        }
        if ($material) {
            $query->join('tb_detailpr as d', 'd.no_pr', '=', 'pr.no_pr')
                ->addSelect('d.no as no', 'd.material as material', 'd.qty as qty', 'd.unit as unit', 'd.sisa_pr as sisa_pr');
            $qtyValue = $this->numberSql($connection, 'd.qty');
            $remainingValue = $this->numberSql($connection, 'd.sisa_pr');
            $remaining = "coalesce({$remainingValue}, {$qtyValue}, 0)";
            $qty = "coalesce({$qtyValue}, 0)";
            if ($status === 'outstanding') {
                $query->whereRaw("{$remaining} >= {$qty} and {$qty} > 0");
            } elseif ($status === 'sisa_po') {
                $query->whereRaw("{$remaining} > 0 and {$remaining} < {$qty}");
            } elseif ($status === 'realized') {
                $query->whereRaw("{$remaining} <= 0");
            }
        } elseif ($clickhouse && in_array($status, ['outstanding', 'sisa_po'], true)) {
            // ClickHouse columnar engine executes grouped subquery hash-joins fast in memory.
            $query->joinSub($this->statusQuery($connection), 'detail', 'detail.no_pr', '=', 'pr.no_pr');
            if ($status === 'outstanding') {
                $query->whereColumn('detail.untouched_items', 'detail.total_items');
            } else {
                $query->whereColumn('detail.untouched_items', '<', 'detail.total_items')
                    ->whereColumn('detail.realized_items', '<', 'detail.total_items');
            }
        } else {
            // MySQL: use correlated subqueries backed by composite index idx_detailpr_status (no_pr, sisa_pr, qty)
            // to avoid full table scans of derived temporary tables.
            $query->whereExists(fn ($q) => $q->selectRaw('1')->from('tb_detailpr as present')->whereColumn('present.no_pr', 'pr.no_pr'));
            $remaining = 'coalesce(cast(candidate.sisa_pr as decimal(18,4)), cast(candidate.qty as decimal(18,4)), 0)';
            $qty = 'coalesce(cast(candidate.qty as decimal(18,4)), 0)';
            $candidate = fn ($q) => $q->selectRaw('1')->from('tb_detailpr as candidate')->whereColumn('candidate.no_pr', 'pr.no_pr');

            if ($status === 'outstanding') {
                $query->whereNotExists(fn ($q) => $candidate($q)->whereRaw("({$remaining} < {$qty} or {$qty} <= 0)"));
            } elseif ($status === 'sisa_po') {
                $query->whereExists(fn ($q) => $candidate($q)->whereRaw("{$remaining} < {$qty}"))
                    ->whereExists(fn ($q) => $candidate($q)->whereRaw("{$remaining} > 0"));
            } elseif ($status === 'realized') {
                $query->whereNotExists(fn ($q) => $candidate($q)->whereRaw("{$remaining} > 0"));
            }
        }
        if ($status === 'realized') {
            $poDates = $connection->table('tb_detailpo')->select('ref_pr')->selectRaw('max('.self::PO_DATE.') as latest_po_date')->groupBy('ref_pr');
            $query->leftJoinSub($poDates, 'po', 'po.ref_pr', '=', 'pr.no_pr');
            if (! $material) {
                $query->whereNotNull('po.latest_po_date');
            }
        }
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search, $material) {
                foreach (['pr.no_pr', 'pr.for_customer', 'pr.ref_po', ...($material ? ['d.material'] : [])] as $column) {
                    $q->orWhere($column, 'like', '%'.$search.'%');
                }
            });
        }
        $date = $status === 'realized' ? 'po.latest_po_date'
            : "coalesce(date(pr.date), str_to_date(pr.date, '%d.%m.%Y'), str_to_date(pr.date, '%d/%m/%Y'), str_to_date(pr.date, '%d-%m-%Y'))";
        if ($clickhouse && $status === 'outstanding') {
            $date = "coalesce(toDateOrNull(substring(toString(pr.date), 1, 10)), toDateOrNull(concat(substring(toString(pr.date), 7, 4), '-', substring(toString(pr.date), 4, 2), '-', substring(toString(pr.date), 1, 2))))";
        }
        $period = $filters['period'] ?? 'all';
        if ($period !== 'all') {
            $now = now();
            [$start, $end] = match ($period) {
                'today' => [$now->toDateString(), $now->toDateString()],
                'this_week' => [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()],
                'this_month' => [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()],
                'this_year' => [$now->copy()->startOfYear()->toDateString(), $now->copy()->endOfYear()->toDateString()],
                default => [$filters['start_date'], $filters['end_date']],
            };
            $query->whereRaw("{$date} between ? and ?", [$start, $end]);
        }

        return $query->orderByRaw("{$date} desc")->orderByDesc('pr.no_pr');
    }

    public function paginate(array $filters): array
    {
        if (($filters['status'] ?? 'all') === 'outstanding') {
            return $this->readOutstanding(fn ($connection) => $this->queryPage($filters, $connection));
        }
        return $this->queryPage($filters, DB::connection()) + ['source' => 'mysql'];
    }

    private function queryPage(array $filters, $connection): array
    {
        $query = $this->query($filters, $connection);
        $size = (string) ($filters['per_page'] ?? '5');
        $page = max(1, (int) ($filters['page'] ?? 1));
        if ($size === 'all') {
            $rows = $query->get();
            $total = $rows->count();
            $pages = $page = 1;
        } elseif ($page === 1) {
            $rows = (clone $query)->limit((int) $size + 1)->get();
            $total = $rows->count() <= (int) $size ? $rows->count() : (clone $query)->reorder()->count();
            $pages = max(1, (int) ceil($total / (int) $size));
            $rows = $rows->take((int) $size)->values();
        } else {
            $total = (clone $query)->reorder()->count();
            $pages = max(1, (int) ceil($total / (int) $size));
            $page = min($page, $pages);
            $rows = $query->forPage($page, (int) $size)->get();
        }
        foreach ($rows as $row) {
            if (!isset($row->no_pr) || !is_scalar($row->no_pr) || trim((string) $row->no_pr) === '') {
                throw new \RuntimeException('Invalid PR row: missing document number.');
            }
        }
        $ids = $rows->pluck('no_pr')->unique()->values()->all();
        if ($ids !== []) {
            $knownStatus = ($filters['view'] ?? 'customer') !== 'material' && ($filters['status'] ?? 'all') !== 'all';
            $stats = collect();
            if (!$knownStatus) {
                $statsQuery = $this->statusQuery($connection)->whereIn('no_pr', $ids);
                // An outstanding material has positive remaining quantity, so its
                // document cannot be fully realized. Avoid the legacy PO-date lookup.
                $statsQuery->selectRaw(($filters['status'] ?? 'all') === 'outstanding'
                    ? '0 as has_po_date'
                    : 'case when exists (select 1 from tb_detailpo linked_detail_po where linked_detail_po.ref_pr = tb_detailpr.no_pr and '.self::PO_DATE.' is not null) then 1 else 0 end as has_po_date');
                $stats = $statsQuery->get()->keyBy('no_pr');
            }
            foreach ($rows as $row) {
                if ($knownStatus) {
                    $row->outstanding_count = (int) ($filters['status'] === 'outstanding');
                    $row->sisa_po_count = (int) ($filters['status'] === 'sisa_po');
                    $row->realized_count = (int) ($filters['status'] === 'realized');
                } else {
                    $stat = $stats->get($row->no_pr);
                    $row->outstanding_count = (int) ($stat && $stat->untouched_items == $stat->total_items);
                    $row->sisa_po_count = (int) ($stat && $stat->untouched_items < $stat->total_items && $stat->realized_items < $stat->total_items);
                    $row->realized_count = (int) ($stat && $stat->realized_items == $stat->total_items && $stat->has_po_date);
                }
            }
        }

        return ['purchaseRequirements' => $rows, 'pagination' => [
            'total' => $total, 'page' => $page, 'per_page' => $size === 'all' ? 'all' : (int) $size, 'total_pages' => $pages,
        ]];
    }
}
