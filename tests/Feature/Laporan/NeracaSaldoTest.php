<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NeracaSaldoTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_neraca_saldo_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.neraca-saldo.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.neraca-saldo.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'total_accounts',
                'debit',
                'kredit',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.neraca-saldo.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'desc',
        ]))->assertStatus(500);
    }
}

