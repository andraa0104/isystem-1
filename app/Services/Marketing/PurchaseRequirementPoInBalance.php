<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;

/** Bulk PO In reads and atomic balance changes inside the caller's transaction. */
class PurchaseRequirementPoInBalance
{
    public static function key(mixed $reference, mixed $material): string
    {
        return json_encode([mb_strtolower(trim((string) $reference)), mb_strtolower(trim((string) $material))], JSON_THROW_ON_ERROR);
    }

    public function quantities(array $references): array
    {
        $result = [];
        foreach (array_chunk($this->normalize($references), 500) as $chunk) {
            $rows = DB::table('tb_detailpoin as d')
                ->join('tb_poin as p', 'p.kode_poin', '=', 'd.kode_poin')
                ->whereIn(DB::raw('lower(trim(p.no_poin))'), $chunk)
                ->orderBy('d.id')
                ->lockForUpdate()
                ->get(['p.no_poin', 'd.kd_material', 'd.qty', 'd.sisa_qtypr']);
            foreach ($rows as $row) {
                // Preserve the existing first matching PO In line validation.
                $result[self::key($row->no_poin, $row->kd_material)] ??= $row;
            }
        }

        return $result;
    }

    /** Operations: ref_po + kd_material, or id; qty is a signed delta. */
    public function adjust(array $operations, string $limit = 'none'): void
    {
        if ($operations === []) {
            return;
        }
        $byId = [];
        $byReference = [];
        $references = [];
        foreach ($operations as $operation) {
            if (isset($operation['id'])) {
                $id = (int) $operation['id'];
                $byId[$id] = ($byId[$id] ?? 0) + $operation['qty'];
            } else {
                $key = self::key($operation['ref_po'], $operation['kd_material']);
                $byReference[$key] = ($byReference[$key] ?? 0) + $operation['qty'];
                $references[] = $operation['ref_po'];
            }
        }
        foreach (array_chunk($this->normalize($references), 500) as $chunk) {
            $headers = DB::table('tb_poin')->whereIn(DB::raw('lower(trim(no_poin))'), $chunk)->get(['no_poin', 'kode_poin']);
            $byCode = $headers->groupBy(fn ($row) => mb_strtolower(trim((string) $row->kode_poin)));
            $materials = array_unique(array_map(fn ($key) => json_decode($key, true)[1], array_keys($byReference)));
            $rows = DB::table('tb_detailpoin')
                ->whereIn(DB::raw('lower(trim(kode_poin))'), $byCode->keys()->all())
                ->whereIn(DB::raw('lower(trim(kd_material))'), $materials)
                ->get(['id', 'kode_poin', 'kd_material']);
            foreach ($rows as $row) {
                foreach ($byCode->get(mb_strtolower(trim((string) $row->kode_poin)), collect())
                    ->unique(fn ($header) => mb_strtolower(trim((string) $header->no_poin))) as $header) {
                    $delta = $byReference[self::key($header->no_poin, $row->kd_material)] ?? 0;
                    $byId[$row->id] = ($byId[$row->id] ?? 0) + $delta;
                }
            }
        }
        $connection = DB::connection();
        $table = $connection->getQueryGrammar()->wrapTable('tb_detailpoin');
        ksort($byId);
        foreach (array_chunk($byId, 100, true) as $chunk) {
            $cases = [];
            $bindings = [];
            foreach ($chunk as $id => $delta) {
                $value = $limit === 'none' ? 'sisa_qtypr + ?' : 'coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + ?';
                if ($limit === 'floor') {
                    $value = "greatest({$value}, 0)";
                } elseif ($limit === 'cap') {
                    $value = "case when cast(qty as decimal(18,4)) > 0 then least(cast(qty as decimal(18,4)), {$value}) else {$value} end";
                }
                $cases[] = "when ? then {$value}";
                array_push($bindings, $id, $delta);
                if ($limit === 'cap') {
                    $bindings[] = $delta;
                }
            }
            $ids = array_keys($chunk);
            $connection->update("update {$table} set sisa_qtypr = case id ".implode(' ', $cases).' else sisa_qtypr end where id in ('.implode(',', array_fill(0, count($ids), '?')).')', [...$bindings, ...$ids]);
        }
    }

    private function normalize(array $values): array
    {
        return array_values(array_unique(array_filter(array_map(fn ($value) => mb_strtolower(trim((string) $value)), $values), fn ($value) => $value !== '')));
    }
}
