<?php

namespace App\Services\Marketing;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class PurchaseRequirementPageQuery
{
    private const PO_DATE = "coalesce(date(tgl), str_to_date(tgl, '%Y-%m-%d'), str_to_date(tgl, '%Y/%m/%d'), str_to_date(tgl, '%d/%m/%Y'), str_to_date(tgl, '%d-%m-%Y'), str_to_date(tgl, '%d.%m.%Y'))";

    private function statusQuery(): Builder
    {
        return DB::table('tb_detailpr')->select('no_pr')
            ->selectRaw('count(*) as total_items')
            ->selectRaw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), cast(qty as decimal(18,4)), 0) >= coalesce(cast(qty as decimal(18,4)), 0) and coalesce(cast(qty as decimal(18,4)), 0) > 0 then 1 else 0 end) as untouched_items')
            ->selectRaw('sum(case when coalesce(cast(sisa_pr as decimal(18,4)), cast(qty as decimal(18,4)), 0) <= 0 then 1 else 0 end) as realized_items')
            ->groupBy('no_pr');
    }

    public function query(array $filters): Builder
    {
        $status = $filters['status'] ?? 'all';
        $material = ($filters['view'] ?? 'customer') === 'material';
        $query = DB::table('tb_pr as pr')
            ->select('pr.no_pr', 'pr.date', 'pr.for_customer', 'pr.ref_po', 'pr.jenis_pr', 'pr.payment')
            ->selectRaw('case when exists (select 1 from tb_po linked_po where linked_po.ref_pr = pr.no_pr) then 0 else 1 end as can_delete');
        if ($material) {
            $query->join('tb_detailpr as d', 'd.no_pr', '=', 'pr.no_pr')
                ->addSelect('d.no', 'd.material', 'd.qty', 'd.unit', 'd.sisa_pr', 'd.ref_po', 'd.for_customer');
            $remaining = 'coalesce(cast(d.sisa_pr as decimal(18,4)), cast(d.qty as decimal(18,4)), 0)';
            $qty = 'coalesce(cast(d.qty as decimal(18,4)), 0)';
            if ($status === 'outstanding') {
                $query->whereRaw("{$remaining} >= {$qty} and {$qty} > 0");
            } elseif ($status === 'sisa_po') {
                $query->whereRaw("{$remaining} > 0 and {$remaining} < {$qty}");
            } elseif ($status === 'realized') {
                $query->whereRaw("{$remaining} <= 0");
            }
        } elseif (in_array($status, ['outstanding', 'sisa_po'], true)) {
            // Local EXPLAIN/timings favor one grouped status scan over multiple
            // correlated lookups for these two document filters.
            $query->joinSub($this->statusQuery(), 'detail', 'detail.no_pr', '=', 'pr.no_pr');
            if ($status === 'outstanding') {
                $query->whereColumn('detail.untouched_items', 'detail.total_items');
            } else {
                $query->whereColumn('detail.untouched_items', '<', 'detail.total_items')
                    ->whereColumn('detail.realized_items', '<', 'detail.total_items');
            }
        } else {
            $query->whereExists(fn ($q) => $q->selectRaw('1')->from('tb_detailpr as present')->whereColumn('present.no_pr', 'pr.no_pr'));
            $remaining = 'coalesce(cast(candidate.sisa_pr as decimal(18,4)), cast(candidate.qty as decimal(18,4)), 0)';
            $candidate = fn ($q) => $q->selectRaw('1')->from('tb_detailpr as candidate')->whereColumn('candidate.no_pr', 'pr.no_pr');
            if ($status === 'realized') {
                $query->whereNotExists(fn ($q) => $candidate($q)->whereRaw("{$remaining} > 0"));
            }
        }
        if ($status === 'realized') {
            $poDates = DB::table('tb_detailpo')->select('ref_pr')->selectRaw('max('.self::PO_DATE.') as latest_po_date')->groupBy('ref_pr');
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
        $query = $this->query($filters);
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
        $ids = $rows->pluck('no_pr')->unique()->values()->all();
        if ($ids !== []) {
            $knownStatus = ($filters['view'] ?? 'customer') !== 'material' && ($filters['status'] ?? 'all') !== 'all';
            $stats = $knownStatus ? collect() : $this->statusQuery()->whereIn('no_pr', $ids)
                ->selectRaw('case when exists (select 1 from tb_detailpo linked_detail_po where linked_detail_po.ref_pr = tb_detailpr.no_pr and '.self::PO_DATE.' is not null) then 1 else 0 end as has_po_date')
                ->get()->keyBy('no_pr');
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
