<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerubahanModalTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_perubahan_modal_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.perubahan-modal.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.perubahan-modal.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'opening_equity',
                'contributions',
                'withdrawals',
                'net_income',
                'computed_ending_equity',
                'snapshot_ending_equity',
                'diff',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.perubahan-modal.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'desc',
        ]))->assertStatus(500);
    }
}

