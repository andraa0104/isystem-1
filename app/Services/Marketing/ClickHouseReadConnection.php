<?php

namespace App\Services\Marketing;

use GuzzleHttp\Psr7\Uri;
use Illuminate\Database\MySqlConnection;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** HTTP transport for the simple, read-only query-builder SQL used by PO IN. */
class ClickHouseReadConnection extends MySqlConnection
{
    public function __construct(string $tenant)
    {
        $mapping = config('purchase-requirement.clickhouse.databases', []);
        parent::__construct(null, $mapping[$tenant] ?? $tenant, '', ['driver' => 'clickhouse', 'name' => 'clickhouse-http']);
    }

    public function select($query, $bindings = [], $useReadPdo = true)
    {
        if (! preg_match('/^\s*select\b/i', $query)) {
            throw new RuntimeException('Only SELECT is supported.');
        }
        // Tokenize SQL literals/identifiers separately so question marks inside them stay literal.
        $params = [];
        $index = 0;
        $query = preg_replace_callback('/([\'"`])(?:\\\\.|(?!\1).)*?\1|\? /sx', function ($match) use ($bindings, &$params, &$index) {
            if ($match[0] !== '?') {
                return $match[0];
            }
            if (! array_key_exists($index, $bindings)) {
                throw new RuntimeException('Missing binding.');
            }
            $value = $bindings[$index];
            $name = 'binding_'.$index++;
            $type = is_int($value) ? 'Int64' : (is_float($value) ? 'Float64' : 'String');
            $params['param_'.$name] = (string) $value;

            return '{'.$name.':'.$type.'}';
        }, $query);
        if ($index !== count($bindings)) {
            throw new RuntimeException('Unexpected bindings.');
        }
        $settings = config('database.connections.clickhouse');
        $host = (string) $settings['host'];
        $uri = new Uri(str_contains($host, '://') ? $host : ($settings['options']['protocol'] ?? 'http').'://'.$host);
        $uri = $uri->withPort($uri->getPort() ?? (int) $settings['port'])->withPath('/');
        // Aggregation SQL can exceed URL limits; send SQL in the POST body.
        $uri = $uri->withQuery(http_build_query($params + [
            'database' => $this->getDatabaseName(),
            'final' => config('purchase-requirement.clickhouse.final', false) ? 1 : 0,
            'readonly' => 1, 'max_execution_time' => 2, 'wait_end_of_query' => 1,
        ]));
        $response = Http::connectTimeout((float) config('purchase-requirement.clickhouse.connect_timeout', 1))
            ->timeout((float) config('purchase-requirement.clickhouse.timeout', 3))
            ->withBasicAuth($settings['username'], $settings['password'])
            ->withBody($query.' FORMAT JSON', 'text/plain')
            ->post((string) $uri);
        $response->throw();
        $rows = $response->json('data');
        if (! is_array($rows) || ! array_is_list($rows)) {
            throw new RuntimeException('Invalid ClickHouse response.');
        }

        return array_map(function ($row) {
            if (! is_array($row)) {
                throw new RuntimeException('Invalid ClickHouse row.');
            }

            return (object) $row;
        }, $rows);
    }
}
