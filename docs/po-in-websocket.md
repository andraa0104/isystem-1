# PO In WebSocket

Untuk deploy melalui IP VPS menggunakan HTTP dan Bun, ikuti
[panduan deploy IP VPS](deploy-realtime-vps-ip.md).

PO In uses Laravel Reverb and Echo. Successful header and detail CRUD broadcasts
`purchase-order-in.changed` on a private channel scoped to the active tenant database.
The list re-fetches its current filters, pagination and summary when the event arrives.
There is no interval polling. A successful subscription also refreshes data to recover
changes missed during disconnection. Broadcast failure is logged without failing a
completed database write.

Purchase Requirement also subscribes to its own private tenant channel. Successful
PR create, update, delete, detail changes, customer removal and remaining-quantity
changes notify both PR and PO In. PR reloads its current table, summary and open
dialogs, discarding cached pagination totals. PO In refreshes its table, summary
(including remaining PR and realized PR), and open dialogs. The existing business
queries determine status; the notifications do not change quantity calculations.

## Run locally

1. Install dependencies with `composer install` and `bun install`.
2. Configure the Reverb variables shown in `.env.example`. Generate unique app keys
   and secrets; the secret must stay on the server. The local `.env` has been configured.
3. Run `php artisan config:clear` and `bun run build` (or restart Vite).
4. Run `php artisan reverb:start` alongside the web server. The default listen port is 8081.

If the default cache is `database` but the tenant has no `cache` table, use the file
cache for the Reverb process only: `CACHE_STORE=file php artisan reverb:start` on
Linux; on PowerShell set `$env:CACHE_STORE='file'` before starting it. Use the same
cache override for `reverb:restart` so both commands share the restart marker.

An empty `VITE_REVERB_HOST` connects to the hostname of the page, so browsers on
other machines connect to the application server instead of their own localhost.
That hostname and port must be reachable from both browsers. `REVERB_HOST` is the
address used by Laravel to publish events and can remain `127.0.0.1` on the server.

## Hosting

For the production VPS, use port **8081** internally so it does not conflict with
phpMyAdmin on 8080. Set these values in the VPS `.env` (keep the existing app ID,
key, and secret):

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_HOST=127.0.0.1
REVERB_PORT=8081
REVERB_SCHEME=http
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8081
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST=your-domain.example
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

Use the real application domain for `VITE_REVERB_HOST`. Configure the HTTPS reverse
proxy's WebSocket upstream as `http://127.0.0.1:8081`. For a direct HTTP connection
without an HTTPS proxy, use `REVERB_SERVER_HOST=0.0.0.0`, an empty
`VITE_REVERB_HOST`, `VITE_REVERB_PORT=8081`, and `VITE_REVERB_SCHEME=http` instead.

Install and build the frontend with Bun:

```sh
bun install
php artisan config:clear
bun run build
```

Update the process manager's Reverb command to
`php artisan reverb:start --host=127.0.0.1 --port=8081` for the HTTPS proxy setup,
then restart that process. Explicit old `--port=8080` arguments override `.env`
and must be changed. If required, set `CACHE_STORE=file` in that process's
environment as described above. Reverb itself runs on PHP; Bun manages frontend
dependencies and runs the build script.

Keep `php artisan reverb:start` running with the hosting process manager. For HTTPS,
proxy WebSocket upgrades and Reverb's `/app` and `/apps` paths to Reverb, configure
`VITE_REVERB_HOST`, `VITE_REVERB_PORT=443`, `VITE_REVERB_SCHEME=https`, and rebuild
the frontend. Laravel's publishing address can use the internal HTTP port independently.
Restart Reverb after deployment with `php artisan reverb:restart` under the process manager.

## Verify

Open PO In in two authenticated browsers using the same tenant database. Create,
edit, or delete a PO In in one browser. The other should update without a page
reload, subject to its active filters. A different tenant cannot subscribe to that
channel. Stop and restart Reverb to verify reconnection catches up with missed writes.
