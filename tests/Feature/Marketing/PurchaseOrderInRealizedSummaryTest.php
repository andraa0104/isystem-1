<?php

namespace Tests\Feature\Marketing;

use App\Http\Controllers\Marketing\PurchaseOrderInController;
use App\Services\Marketing\PurchaseOrderInService;
use Illuminate\Http\Request;
use Illuminate\Database\MySqlConnection;
use Mockery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use ReflectionMethod;
use Tests\TestCase;

class PurchaseOrderInRealizedSummaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance('request', Request::create('/marketing/purchase-order-in/data', 'GET'));
        Http::preventStrayRequests();
    }

    public function test_do_realized_card_recalculates_completion_from_delivery_rows(): void
    {
        $queries = [];
        $connection = Mockery::mock(MySqlConnection::class.'[select]', [null, 'tenant_test', '', ['driver' => 'mysql']])
            ->makePartial();
        $connection->shouldReceive('select')->twice()->andReturnUsing(function ($sql) use (&$queries) {
            $queries[] = $sql;
            return str_contains($sql, 'as realized_do')
                ? [(object) ['realized_do' => '17']]
                : [(object) ['realized_pr' => '8']];
        });
        DB::shouldReceive('connection')->andReturn($connection);
        DB::shouldReceive('raw')->andReturnUsing(fn ($value) => $connection->raw($value));

        $method = new ReflectionMethod(PurchaseOrderInController::class, 'getPurchaseOrderInData');
        $result = $method->invoke(
            new PurchaseOrderInController(new PurchaseOrderInService()),
            '', 5, 'all', 1, false, true, 'realized', false, false,
            'today', '', '', 'STG', 'all', null,
        );

        $this->assertSame(8, $result['summary']['realized_pr']);
        $this->assertSame(17, $result['summary']['realized_do']);
        Http::assertNothingSent();
        $doQuery = collect($queries)->first(fn ($sql) => str_contains($sql, 'as realized_do'));
        $this->assertNotNull($doQuery);
        $this->assertStringContainsString('`tb_do` as `delivered_line`', $doQuery);
        $this->assertStringNotContainsString('sisa_qtydo', $doQuery);
        $this->assertStringContainsString('delivered_line.ref_po as ref_po_key', $doQuery);
        $this->assertStringContainsString('delivered_line.kd_mat as material_key', $doQuery);
        $this->assertStringContainsString('group by delivered_line.ref_po, delivered_line.kd_mat', $doQuery);
        $this->assertStringContainsString('kdo.ref_po_key = CONVERT(p.no_poin USING latin1)', $doQuery);
        $this->assertStringNotContainsString('lower(trim(ref_po))', $doQuery);
        $this->assertStringNotContainsString('trim(cast(delivered_line.', $doQuery);
        $this->assertStringContainsString('kdo.pos_tgl', $doQuery);
        $this->assertStringContainsString('between ? and ?', $doQuery);
        $prQuery = collect($queries)->first(fn ($sql) => str_contains($sql, 'as realized_pr'));
        $this->assertNotNull($prQuery);
        $this->assertStringContainsString('ref_po as ref_po_key', $prQuery);
        $this->assertStringContainsString('dpr.ref_po_key = CONVERT(p.no_poin USING latin1)', $prQuery);
        $this->assertStringNotContainsString('lower(trim(ref_po))', $prQuery);

    }
    public function test_created_date_range_keeps_column_bare_and_includes_entire_last_day(): void
    {
        $connection = new MySqlConnection(null, 'tenant_test', '', ['driver' => 'mysql']);
        $query = $connection->table('tb_poin as p');
        $method = new ReflectionMethod(PurchaseOrderInController::class, 'applyCreatedDateFilter');
        $method->invoke(
            new PurchaseOrderInController(new PurchaseOrderInService()),
            $query, 'range', '2026-10-01', '2026-10-27',
        );

        $this->assertSame(
            'select * from `tb_poin` as `p` where `p`.`created_at` >= ? and `p`.`created_at` < ?',
            $query->toSql(),
        );
        $this->assertSame(
            ['2026-10-01 00:00:00', '2026-10-28 00:00:00'],
            $connection->prepareBindings($query->getBindings()),
        );
    }

}
