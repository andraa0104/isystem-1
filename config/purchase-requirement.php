<?php

return [
    'clickhouse' => [
        'enabled' => env('PR_CLICKHOUSE_ENABLED', true),
        'connect_timeout' => env('PR_CLICKHOUSE_CONNECT_TIMEOUT', 1),
        'timeout' => env('PR_CLICKHOUSE_TIMEOUT', 3),
        // Map MySQL tenant databases to ClickHouse databases if names differ.
        'databases' => json_decode(env('PR_CLICKHOUSE_DATABASES', '{}'), true) ?: [],
        // Enable only for replicated table engines that support FINAL.
        'final' => env('PR_CLICKHOUSE_FINAL', false),
    ],
];
