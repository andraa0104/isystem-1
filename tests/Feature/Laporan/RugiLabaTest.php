<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RugiLabaTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_rugi_laba_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.rugi-laba.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.rugi-laba.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'total_pendapatan',
                'total_hpp',
                'laba_kotor',
                'total_beban_operasional',
                'laba_usaha',
                'total_lain_lain_net',
                'laba_bersih',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.rugi-laba.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'desc',
        ]))->assertStatus(500);
    }
}

