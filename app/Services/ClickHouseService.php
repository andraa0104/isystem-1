<?php

namespace App\Services;

use ClickHouseDB\Client;

class ClickHouseService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = new Client([
            'host'     => env('CLICKHOUSE_HOST', '127.0.0.1'),
            'port'     => env('CLICKHOUSE_PORT', '9000'),
            'username' => env('CLICKHOUSE_USERNAME', 'default'),
            'password' => env('CLICKHOUSE_PASSWORD', ''),
        ]);

	$this->client->settings()->set('async_insert', 1);
        $this->client->settings()->set('wait_for_async_insert', 0);
    }

    public function select(string $sql, array $bindings = [])
    {
        return $this->client->select($sql, $bindings)->rows();
    }
    /**
     * Method bantuan untuk melakukan insert data ke ClickHouse
     */
    public function insert(string $table, array $values, array $columns = [])
    {
        return $this->client->insert($table, $values, $columns);
    }
}
