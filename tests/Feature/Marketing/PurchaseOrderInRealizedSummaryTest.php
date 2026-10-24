<?php

namespace Tests\Feature\Marketing;

use App\Http\Controllers\Marketing\PurchaseOrderInController;
use App\Services\Marketing\PurchaseOrderInService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use ReflectionMethod;
use Tests\TestCase;

class PurchaseOrderInRealizedSummaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.connections.poin_realized_test' => [
                'driver' => 'mysql', 'database' => 'tenant_test',
                'host' => 'unused', 'prefix' => '',
            ],
            'database.connections.clickhouse' => [
                'host' => 'http://clickhouse.test', 'port' => 8123,
                'username' => 'reader', 'password' => 'test',
            ],
            'purchase-requirement.clickhouse.enabled' => true,
        ]);
        DB::setDefaultConnection('poin_realized_test');
        $this->app->instance('request', Request::create('/marketing/purchase-order-in/data', 'GET'));
        Http::preventStrayRequests();
    }

    public function test_do_realized_card_recalculates_completion_from_delivery_rows(): void
    {
        Http::fake(function ($request) {
            return str_contains($request->body(), 'as realized_do')
                ? Http::response(['data' => [['realized_do' => '17']]])
                : Http::response(['data' => [['realized_pr' => '8']]]);
        });

        $method = new ReflectionMethod(PurchaseOrderInController::class, 'getPurchaseOrderInData');
        $result = $method->invoke(
            new PurchaseOrderInController(new PurchaseOrderInService()),
            '', 5, 'all', 1, false, true, 'realized', false, false,
            'today', '', '', 'STG', 'all', null,
        );

        $this->assertSame(8, $result['summary']['realized_pr']);
        $this->assertSame(17, $result['summary']['realized_do']);
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => str_contains($request->body(), 'as realized_do')
            && str_contains($request->body(), '`tb_do` as `delivered_line`')
            && ! str_contains($request->body(), 'sisa_qtydo')
            && str_contains($request->body(), 'kdo.pos_tgl between'));
    }
}
