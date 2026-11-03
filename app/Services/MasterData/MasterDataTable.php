<?php

namespace App\Services\MasterData;

use Illuminate\Database\Query\Builder;

class MasterDataTable
{
    public function search(Builder $query, array $columns, string $search): void
    {
        if ($search === '') {
            return;
        }

        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
        $query->where(function (Builder $matches) use ($columns, $pattern) {
            foreach ($columns as $column) {
                $wrapped = $matches->getGrammar()->wrap($column);
                $matches->orWhereRaw("{$wrapped} like ? escape '!'", [$pattern]);
            }
        });
    }

    public function paginate(Builder $query, array $filters): array
    {
        $perPage = $filters['per_page'] ?? 5;
        if ($perPage === 'all') {
            $rows = $query->get();

            return ['rows' => $rows, 'total' => $rows->count(), 'page' => 1, 'last_page' => 1];
        }

        $paginator = $query->paginate((int) $perPage, ['*'], 'page', (int) ($filters['page'] ?? 1));

        return [
            'rows' => $paginator->items(),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
