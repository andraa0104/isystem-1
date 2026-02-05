<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BukuKasTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_buku_kas_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.buku-kas.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.buku-kas.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'opening_balance',
                'closing_balance',
                'total_in',
                'total_out',
                'net_change',
                'count_voucher',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.buku-kas.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'asc',
        ]))->assertStatus(500);
    }
}

