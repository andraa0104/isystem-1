# Detail PR: ClickHouse with MySQL fallback

The Detail Purchase Requirement endpoint reads `tb_detailpr` from ClickHouse through its HTTP interface. This does not require a Laravel ClickHouse database driver. Existing `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`, `CLICKHOUSE_USERNAME`, and `CLICKHOUSE_PASSWORD` settings are used. The port must be an HTTP/HTTPS port, normally 8123/8443, rather than the native TCP port 9000.

The selected database defaults to the active MySQL tenant database name. It deliberately does not use a single global `CLICKHOUSE_DATABASE` for every tenant. If replica names differ, configure a mapping:

```dotenv
PR_CLICKHOUSE_DATABASES='{"dbsja":"replica_sja","dbstg":"replica_stg"}'
```

The PR number is a typed query parameter, not interpolated SQL. Reads have a one-second connection timeout and a three-second overall timeout by default. Adjust these with `PR_CLICKHOUSE_CONNECT_TIMEOUT` and `PR_CLICKHOUSE_TIMEOUT` if needed.

MySQL is used when ClickHouse is unavailable, returns a query/authentication error, returns invalid data, or has no rows for the requested PR. Fallback always uses the active tenant connection. A successful nonempty replica response is accepted; this cannot detect an otherwise valid but outdated replica snapshot.

`PR_CLICKHOUSE_FINAL=true` enables `FINAL` for replica engines that require and support it, such as ReplacingMergeTree. Leave it disabled for engines that do not support it. `PR_CLICKHOUSE_ENABLED=false` disables this reader and uses MySQL directly.

The response keeps the existing JSON shape. The `X-Data-Source` HTTP header indicates `clickhouse` or `mysql`. The detail endpoint also accepts `source=mysql`; the inline customer/PO removal flow uses this to read the latest primary data immediately after a successful change. Other PR lists and transaction writes retain their current data sources.

After changing environment settings in production, rebuild configuration with `php artisan config:cache`. Verify a detail request in the browser Network panel: the `X-Data-Source` header should be `clickhouse` when the replica is available.

Protocol reference: [ClickHouse HTTP interface](https://clickhouse.com/docs/interfaces/http).
