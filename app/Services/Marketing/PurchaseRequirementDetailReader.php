<?php

namespace App\Services\Marketing;

use GuzzleHttp\Psr7\Uri;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class PurchaseRequirementDetailReader
{
    private const COLUMNS = [
        'no_pr', 'no', 'kd_material', 'material', 'qty', 'unit', 'sisa_pr',
        'payment', 'renmark', 'ref_po', 'for_customer', 'price_po', 'unit_price', 'margin', 'stok',
    ];

    public function read(string $number, bool $fresh = false): array
    {
        $mysql = DB::connection();
        if (! $fresh && config('purchase-requirement.clickhouse.enabled', true)) {
            try {
                $settings = config('database.connections.clickhouse');
                $tenant = $mysql->getDatabaseName();
                $databases = config('purchase-requirement.clickhouse.databases', []);
                $database = $databases[$tenant] ?? $tenant;
                if (! $database || ! $settings) {
                    throw new RuntimeException('Missing ClickHouse configuration.');
                }

                $host = (string) $settings['host'];
                $uri = new Uri(str_contains($host, '://') ? $host : ($settings['options']['protocol'] ?? 'http').'://'.$host);
                $uri = $uri->withPort($uri->getPort() ?? (int) $settings['port'])->withPath('/');
                $final = config('purchase-requirement.clickhouse.final', false) ? ' FINAL' : '';
                $sql = 'SELECT '.implode(', ', self::COLUMNS).' FROM tb_detailpr'.$final
                    .' WHERE no_pr = {pr_number:String} ORDER BY no FORMAT JSON';
                $response = Http::connectTimeout((float) config('purchase-requirement.clickhouse.connect_timeout', 1))
                    ->timeout((float) config('purchase-requirement.clickhouse.timeout', 3))
                    ->withBasicAuth($settings['username'], $settings['password'])
                    ->get((string) $uri, [
                        'database' => $database,
                        'query' => $sql,
                        'param_pr_number' => $number,
                        'readonly' => 1,
                        'max_execution_time' => 2,
                        'wait_end_of_query' => 1,
                    ]);
                $response->throw();
                $rows = $response->json('data');
                if (! is_array($rows) || ! array_is_list($rows)) {
                    throw new RuntimeException('Invalid ClickHouse response.');
                }
                foreach ($rows as $row) {
                    if (! is_array($row) || array_diff(self::COLUMNS, array_keys($row)) || ($row['no_pr'] ?? null) !== $number) {
                        throw new RuntimeException('Invalid ClickHouse detail row.');
                    }
                }
                if ($rows !== []) {
                    return ['rows' => $rows, 'source' => 'clickhouse'];
                }
            } catch (Throwable $error) {
                Log::warning('PR detail ClickHouse read failed; using active MySQL tenant.', [
                    'exception' => class_basename($error),
                ]);
            }
        }

        return [
            'rows' => $mysql->table('tb_detailpr')->select(self::COLUMNS)->where('no_pr', $number)->orderBy('no')->get(),
            'source' => 'mysql',
        ];
    }
}
