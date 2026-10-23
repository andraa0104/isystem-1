<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class PurchaseRequirementDetailReader
{
    private const COLUMNS = [
        'no_pr', 'no', 'kd_material', 'material', 'qty', 'unit', 'sisa_pr',
        'payment', 'renmark', 'ref_po', 'for_customer', 'price_po', 'unit_price', 'margin', 'stok',
    ];

    public function page(string $number, array $filters, bool $fresh = false): array
    {
        $mysql = DB::connection();
        if (! $fresh && config('purchase-requirement.clickhouse.enabled', true)) {
            try {
                $result = $this->queryPage(new ClickHouseReadConnection($mysql->getDatabaseName()), $number, $filters);
                // Empty documents can indicate replication lag; retry the whole page in MySQL.
                if ($result['customers'] !== []) {
                    return $result + ['source' => 'clickhouse'];
                }
            } catch (Throwable $error) {
                Log::warning('PR paginated ClickHouse read failed; using MySQL.', ['exception' => class_basename($error)]);
            }
        }

        return $this->queryPage($mysql, $number, $filters) + ['source' => 'mysql'];
    }

    private function queryPage($connection, string $number, array $filters): array
    {
        $base = $connection->table('tb_detailpr')->where('no_pr', $number);
        $customers = (clone $base)->select('ref_po', 'for_customer')->distinct()->orderBy('ref_po')->get()->all();
        foreach ($customers as $customer) {
            if (! property_exists($customer, 'ref_po') || ! property_exists($customer, 'for_customer')) {
                throw new RuntimeException('Invalid detail metadata.');
            }
        }
        $references = array_unique(array_filter(array_column($customers, 'ref_po')));
        $first = (clone $base)->orderBy('no')->first(['payment']);
        $query = (clone $base)->select(self::COLUMNS);
        if (($filters['ref_po'] ?? '') !== '') {
            $query->where('ref_po', $filters['ref_po']);
        } elseif (count($references) > 1) {
            // Choose the same first line as the old browser grouping, preserving its prices/unit.
            $groups = (clone $base)->selectRaw("coalesce(nullif(kd_material, ''), material) as material_key, min(no) as first_no")
                ->selectRaw('coalesce(sum(cast(qty as decimal(18,4))), 0) as grouped_qty, coalesce(sum(cast(sisa_pr as decimal(18,4))), 0) as grouped_sisa')
                ->groupByRaw("coalesce(nullif(kd_material, ''), material)");
            $query = $connection->table('tb_detailpr as d')->joinSub($groups, 'g', function ($join) {
                $join->on('d.no', '=', 'g.first_no');
                $join->on(\Illuminate\Support\Facades\DB::raw("coalesce(nullif(d.kd_material, ''), d.material)"), '=', 'g.material_key');
            })->where('d.no_pr', $number)
                ->select(array_map(fn ($column) => 'd.'.$column, array_diff(self::COLUMNS, ['qty', 'sisa_pr', 'ref_po', 'for_customer'])))
                ->selectRaw("g.grouped_qty as qty, g.grouped_sisa as sisa_pr, 'Multiple' as ref_po, 'Multiple' as for_customer");
        }
        // Search the final grouped values, not individual input lines.
        $query = $connection->query()->fromSub($query, 'details');
        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $castType = $connection instanceof ClickHouseReadConnection ? 'String' : 'char';
            $query->where(function ($q) use ($search, $castType) {
                foreach (['material', 'qty', 'unit', 'sisa_pr', 'renmark'] as $column) {
                    $q->orWhereRaw('lower(cast('.$column.' as '.$castType.')) like ?', ['%'.mb_strtolower($search).'%']);
                }
            });
        }
        $total = (clone $query)->count();
        $size = ($filters['per_page'] ?? 5) === 'all' ? null : min(100, max(1, (int) ($filters['per_page'] ?? 5)));
        $pages = $size === null ? 1 : max(1, (int) ceil($total / $size));
        $page = min($pages, max(1, (int) ($filters['page'] ?? 1)));
        $rows = $query->orderBy('no');
        if ($size !== null) {
            $rows->forPage($page, $size);
        }

        $items = $rows->get();
        foreach ($items as $item) {
            if (array_diff(self::COLUMNS, array_keys((array) $item)) || $item->no_pr !== $number) {
                throw new RuntimeException('Invalid detail row.');
            }
        }

        return ['rows' => $items, 'customers' => $customers, 'payment' => $first->payment ?? null,
            'pagination' => ['total' => $total, 'page' => $page, 'per_page' => $size ?? 'all', 'total_pages' => $pages]];
    }
}
