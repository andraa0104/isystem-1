<?php

namespace App\Services\Marketing;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use WeakMap;

/** Request-local metadata, isolated by connection and tenant database. */
class PurchaseRequirementSchema
{
    private WeakMap $metadata;

    public function __construct()
    {
        $this->metadata = new WeakMap;
    }

    public function columns(string $table, ?Connection $connection = null): array
    {
        $connection ??= DB::connection();
        $key = $connection->getDatabaseName().'.'.$table;
        $cached = $this->metadata[$connection] ?? [];
        if (! array_key_exists($key, $cached)) {
            $cached[$key] = $connection->getSchemaBuilder()->getColumns($table);
            $this->metadata[$connection] = $cached;
        }

        return $cached[$key];
    }

    public function names(string $table): array
    {
        return array_column($this->columns($table), 'name');
    }

    public function hasTable(string $table): bool
    {
        return $this->columns($table) !== [];
    }

    public function hasColumn(string $table, string $column): bool
    {
        return in_array(strtolower($column), array_map('strtolower', $this->names($table)), true);
    }
}
