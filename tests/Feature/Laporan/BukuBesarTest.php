<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BukuBesarTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_buku_besar_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.buku-besar.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.buku-besar.rows'));
        $res->assertOk();
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'total_accounts',
                'na_debit',
                'na_kredit',
            ],
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.buku-besar.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'desc',
        ]))->assertOk();
    }
}
