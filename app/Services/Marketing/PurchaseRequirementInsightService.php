<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class PurchaseRequirementInsightService
{
    public function stock(): array
    {
        return $this->run('stock', [
            'sales' => $this->salesHistory(),
            'costs' => $this->costHistory(),
            'stocks' => $this->stockInventory(),
            'stock_prs' => $this->stockPrHistory(),
        ]);
    }

    public function opex(): array
    {
        return $this->run('opex', [
            'opex' => $this->opexHistory(),
            'stocks' => $this->stockInventory(),
        ]);
    }

    private function run(string $mode, array $payload): array
    {
        $script = base_path('app/Intelligence/PurchaseRequirementInsight.py');
        if (!is_file($script)) {
            return ['success' => false, 'message' => 'Engine insight Python tidak ditemukan.', 'recommendations' => []];
        }

        try {
            $pythonBinary = config('services.purchase_requirement_python_binary')
                ?: (PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3');
            $process = new Process([$pythonBinary, $script, "--mode={$mode}"]);
            $process->setInput(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            $process->setTimeout(25);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::warning('Purchase requirement insight Python failed.', ['mode' => $mode, 'error' => $process->getErrorOutput()]);
                return ['success' => false, 'message' => 'Gagal memproses insight AI.', 'recommendations' => []];
            }

            $result = json_decode(trim($process->getOutput()), true);
            return is_array($result)
                ? $result + ['success' => true]
                : ['success' => false, 'message' => 'Respons engine insight tidak valid.', 'recommendations' => []];
        } catch (\Throwable $exception) {
            Log::warning('Purchase requirement insight exception.', ['mode' => $mode, 'error' => $exception->getMessage()]);
            return ['success' => false, 'message' => 'Engine insight tidak dapat dijalankan.', 'recommendations' => []];
        }
    }

    private function salesHistory(): array
    {
        if (!Schema::hasTable('tb_fakturpenjualan') || !Schema::hasTable('tb_do')) return [];

        $date = "coalesce(date(f.tgl_doc), str_to_date(f.tgl_doc, '%Y-%m-%d'), str_to_date(f.tgl_doc, '%d.%m.%Y'), str_to_date(f.tgl_doc, '%d/%m/%Y'))";
        return DB::table('tb_fakturpenjualan as f')
            ->join('tb_do as d', 'f.no_do', '=', 'd.no_do')
            // Keep multiple seasonal cycles where available; the forecasting engine
            // will backtest only the history each material actually has.
            ->whereRaw("{$date} >= date_sub(current_date(), interval 3 year)")
            ->whereRaw("{$date} <= current_date()")
            ->whereNotNull('d.mat')
            ->whereRaw("trim(d.mat) <> ''")
            ->select([
                DB::raw('d.kd_mat as material_code'), DB::raw('d.mat as material'), 'd.unit',
                DB::raw('sum(coalesce(cast(d.qty as decimal(18,4)), 0)) as qty'),
                DB::raw("{$date} as date"),
            ])
            ->groupBy('d.kd_mat', 'd.mat', 'd.unit')
            ->groupByRaw($date)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function stockPrHistory(): array
    {
        if (!Schema::hasTable('tb_pr') || !Schema::hasTable('tb_detailpr')) return [];

        return DB::table('tb_detailpr as d')
            ->join('tb_pr as pr', 'd.no_pr', '=', 'pr.no_pr')
            ->where(function ($query) {
                $type = "lower(coalesce(nullif(trim(pr.jenis_pr), ''), nullif(trim(d.jenis_pr), ''), ''))";
                $query->whereRaw("{$type} like '%stock%' or {$type} like '%stok%'")
                    ->orWhere(function ($legacy) {
                        $legacy->whereRaw("coalesce(nullif(trim(pr.jenis_pr), ''), nullif(trim(d.jenis_pr), '')) is null")
                            ->where(function ($reference) {
                                $reference->whereRaw("lower(coalesce(pr.ref_po, '')) like '%stock%'")
                                    ->orWhereRaw("lower(coalesce(pr.ref_po, '')) like '%stok%'");
                            });
                    });
            })
            ->whereNotNull('d.kd_material')
            ->whereRaw("trim(d.kd_material) <> ''")
            ->get(['d.no_pr', 'd.kd_material as material_code', 'd.unit', 'd.qty', 'd.date'])
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function costHistory(): array
    {
        if (!Schema::hasTable('tb_detailpo')) return [];

        $materialColumn = $this->firstExistingColumn('tb_detailpo', [
            'material', 'nama_material', 'mat', 'nama_barang', 'nm_barang',
        ]);
        if (!$materialColumn) return [];

        $details = DB::table('tb_detailpo')
            ->whereNotNull('kd_mat')
            ->whereRaw("trim(kd_mat) <> ''")
            ->orderByDesc('tgl')
            ->limit(5000)
            ->get([
                'no_po', 'kd_mat as material_code', DB::raw("`{$materialColumn}` as material"),
                'unit', 'qty', 'price', 'franco_loco', 'tgl',
            ])
            ->map(fn ($row) => (array) $row)
            ->all();

        $shipping = $this->shippingByPo();
        $poValues = [];
        foreach ($details as $detail) {
            $po = trim((string) ($detail['no_po'] ?? ''));
            $poValues[$po] = ($poValues[$po] ?? 0) + max(0, (float) ($detail['qty'] ?? 0)) * max(0, (float) ($detail['price'] ?? 0));
        }

        return array_map(function (array $detail) use ($shipping, $poValues): array {
            $po = trim((string) ($detail['no_po'] ?? ''));
            $lineValue = max(0, (float) ($detail['qty'] ?? 0)) * max(0, (float) ($detail['price'] ?? 0));
            $francoLoco = Str::lower(trim((string) ($detail['franco_loco'] ?? '')));
            // Franco: ongkir ditanggung vendor. Loco/kosong: biaya kirim aktual
            // dari tb_biayakirimdetail dibebankan proporsional nilai material.
            $shippingApplies = !str_contains($francoLoco, 'franco') || str_contains($francoLoco, 'loco');
            $shippingShare = $shippingApplies && ($poValues[$po] ?? 0) > 0
                ? (($shipping[$po] ?? 0) * $lineValue / $poValues[$po])
                : 0;
            $detail['shipping_allocated'] = $shippingShare;
            return $detail;
        }, $details);
    }

    private function shippingByPo(): array
    {
        if (!Schema::hasTable('tb_biayakirimdetail')) return [];

        $poColumn = $this->firstExistingColumn('tb_biayakirimdetail', ['no_po', 'ref_po', 'no_pembelian']);
        $costColumn = $this->firstExistingColumn('tb_biayakirimdetail', ['biaya_kirim', 'total_biaya_kirim', 'biaya', 'total_biaya', 'total', 'nominal', 'amount', 'harga']);
        if (!$poColumn || !$costColumn) return [];

        return DB::table('tb_biayakirimdetail')
            ->select($poColumn, DB::raw("sum(coalesce(cast(`{$costColumn}` as decimal(18,4)), 0)) as shipping_total"))
            ->groupBy($poColumn)
            ->pluck('shipping_total', $poColumn)
            ->map(fn ($value) => (float) $value)
            ->all();
    }

    private function firstExistingColumn(string $table, array $candidates): ?string
    {
        $columns = Schema::getColumnListing($table);
        foreach ($candidates as $candidate) {
            foreach ($columns as $column) {
                if (strtolower($column) === strtolower($candidate)) {
                    return $column;
                }
            }
        }
        return null;
    }

    private function stockInventory(): array
    {
        if (!Schema::hasTable('tb_barang')) return [];

        $codeCol = $this->firstExistingColumn('tb_barang', ['kd_material', 'kd_barang', 'kode_barang', 'kode']) ?? 'kd_material';
        $matCol = $this->firstExistingColumn('tb_barang', ['material', 'nama_material', 'mat', 'nama_barang']) ?? 'material';
        $unitCol = $this->firstExistingColumn('tb_barang', ['unit', 'satuan']) ?? 'unit';
        $stockColumns = array_filter(['stok_g1', 'stok_g2', 'stok_g3', 'stok_g4'], fn ($col) => Schema::hasColumn('tb_barang', $col));
        $stockExpr = !empty($stockColumns)
            ? implode(' + ', array_map(fn ($c) => "coalesce(cast(`{$c}` as decimal(18,4)), 0)", $stockColumns))
            : (Schema::hasColumn('tb_barang', 'stok') ? "coalesce(cast(`stok` as decimal(18,4)), 0)" : '0');

        $selects = [
            DB::raw("`{$codeCol}` as material_code"),
            DB::raw("`{$matCol}` as material"),
            DB::raw("`{$unitCol}` as unit"),
            DB::raw("({$stockExpr}) as current_stock"),
        ];

        $rows = DB::table('tb_barang')
            ->select($selects)
            ->get()
            ->map(fn ($row) => [
                'material_code' => (string) ($row->material_code ?? ''),
                'material' => (string) ($row->material ?? ''),
                'unit' => (string) ($row->unit ?? ''),
                'current_stock' => (float) ($row->current_stock ?? 0),
            ])
            ->all();

        $metrics = $this->stockMetricsByMaterial(array_column($rows, 'material_code'));

        return array_map(function (array $row) use ($metrics): array {
            $key = strtolower(trim($row['material_code']));
            $extra = $metrics[$key] ?? [];
            $physical = $row['current_stock'];
            $available = max(0, $physical
                + ($extra['mib'] ?? 0)
                + ($extra['mis'] ?? 0)
                + ($extra['mibs'] ?? 0)
                + ($extra['pr_outstanding'] ?? 0)
                + ($extra['po_outstanding'] ?? 0)
                - ($extra['do_outstanding'] ?? 0));

            return $row + $extra + ['available_stock' => $available];
        }, $rows);
    }

    /**
     * Match the inventory-position calculation already used by the PR material
     * selector, while keeping the physical balance sourced from tb_barang.
     */
    private function stockMetricsByMaterial(array $materialCodes): array
    {
        $codes = array_values(array_unique(array_filter(array_map(
            fn ($code) => trim((string) $code),
            $materialCodes,
        ))));
        if (!$codes) return [];

        $metrics = [];
        $add = function (string $table, string $codeColumn, string $metric, string $expression) use (&$metrics, $codes): void {
            if (!Schema::hasTable($table)
                || !Schema::hasColumn($table, $codeColumn)) {
                return;
            }
            $columns = Schema::getColumnListing($table);
            preg_match_all('/[a-zA-Z_][a-zA-Z0-9_]*/', $expression, $matches);
            foreach ($matches[0] as $column) {
                if (in_array(strtolower($column), ['sum', 'coalesce', 'cast', 'decimal'], true)) continue;
                if (!in_array(strtolower($column), array_map('strtolower', $columns), true)) return;
            }

            $rows = DB::table($table)
                ->whereIn($codeColumn, $codes)
                ->selectRaw("{$codeColumn} as material_code, sum({$expression}) as metric_value")
                ->groupBy($codeColumn)
                ->get();
            foreach ($rows as $row) {
                $key = strtolower(trim((string) $row->material_code));
                $metrics[$key][$metric] = (float) ($row->metric_value ?? 0);
            }
        };

        $add('tb_mi', 'kd_mat', 'mib', 'coalesce(cast(mib as decimal(18,4)), 0)');
        $add('tb_mi', 'kd_mat', 'mis', 'coalesce(cast(mis as decimal(18,4)), 0)');
        $add('tb_mib', 'kd_mat', 'mibs', 'coalesce(cast(qty as decimal(18,4)), 0) - coalesce(cast(transfer as decimal(18,4)), 0)');
        $add('tb_detailpr', 'kd_material', 'pr_outstanding', 'coalesce(cast(sisa_pr as decimal(18,4)), 0)');
        $add('tb_detailpo', 'kd_mat', 'po_outstanding', 'coalesce(cast(gr_mat as decimal(18,4)), 0)');
        $add('tb_detailpoin', 'kd_material', 'do_outstanding', 'coalesce(cast(sisa_qtydo as decimal(18,4)), 0)');

        return $metrics;
    }

    private function opexHistory(): array
    {
        if (!Schema::hasTable('tb_detailpr')) return [];

        $hasPrTable = Schema::hasTable('tb_pr');
        $query = DB::table('tb_detailpr as d');

        if ($hasPrTable) {
            $query->leftJoin('tb_pr as pr', 'd.no_pr', '=', 'pr.no_pr');
            // PO.ref_pr points to PR.no_pr. Keep one row per PR so multiple
            // PO lines cannot multiply the demand recorded in detail PR.
            if (Schema::hasTable('tb_detailpo') && Schema::hasColumn('tb_detailpo', 'ref_pr')) {
                $poReferences = DB::table('tb_detailpo')
                    ->whereNotNull('ref_pr')
                    ->selectRaw('lower(trim(ref_pr)) as pr_key')
                    ->groupByRaw('lower(trim(ref_pr))');
                $query->leftJoinSub($poReferences, 'po_ref', function ($join) {
                    $join->on(DB::raw('lower(trim(d.no_pr))'), '=', 'po_ref.pr_key');
                });
            }
            $query->where(function ($q) {
                $q->whereRaw("lower(coalesce(nullif(trim(pr.jenis_pr), ''), nullif(trim(d.jenis_pr), ''), '')) like '%opex%'")
                  ->orWhere(function ($legacy) {
                      $legacy->whereRaw("coalesce(nullif(trim(pr.jenis_pr), ''), nullif(trim(d.jenis_pr), '')) is null")
                          ->whereRaw("lower(coalesce(pr.ref_po, '')) not like '%stock%'")
                          ->whereRaw("lower(coalesce(pr.ref_po, '')) not like '%stok%'")
                          ->where(function ($hint) {
                              $hint->whereRaw("lower(coalesce(pr.ref_po, '')) like '%opex%'")
                                  ->orWhereRaw("lower(coalesce(pr.for_customer, d.for_customer, '')) like '%kantor%'")
                                  ->orWhereRaw("lower(coalesce(pr.for_customer, d.for_customer, '')) like '%dapur%'")
                                  ->orWhereRaw("lower(coalesce(pr.for_customer, d.for_customer, '')) like '%operasional%'")
                                  ->orWhereRaw("lower(coalesce(pr.for_customer, d.for_customer, '')) like '%perlengkapan%'");
                          });
                  });
            });
        } else {
            $query->where(function ($q) {
                $q->whereRaw("lower(coalesce(d.jenis_pr, '')) like '%opex%'")
                  ->orWhereRaw("lower(coalesce(d.for_customer, '')) like '%kantor%'")
                  ->orWhereRaw("lower(coalesce(d.for_customer, '')) like '%dapur%'")
                  ->orWhereRaw("lower(coalesce(d.for_customer, '')) like '%operasional%'");
            });
        }

        return $query
            ->whereNotNull('d.material')
            ->whereRaw("trim(d.material) <> ''")
            ->orderBy('d.date')
            ->get([
                'd.kd_material as material_code',
                'd.material',
                'd.unit',
                'd.qty',
                'd.date',
                'd.no_pr',
                DB::raw($hasPrTable ? "coalesce(pr.jenis_pr, d.jenis_pr, '') as jenis_pr" : "coalesce(d.jenis_pr, '') as jenis_pr"),
                DB::raw($hasPrTable ? "coalesce(pr.for_customer, d.for_customer, '') as for_customer" : "coalesce(d.for_customer, '') as for_customer"),
                DB::raw($hasPrTable && isset($poReferences) ? 'case when po_ref.pr_key is null then 0 else 1 end as has_po_reference' : '0 as has_po_reference'),
            ])
            ->map(fn ($row) => (array) $row)
            ->all();
    }
}
