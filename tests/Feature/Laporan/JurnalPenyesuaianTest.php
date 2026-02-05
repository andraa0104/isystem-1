<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JurnalPenyesuaianTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_jurnal_penyesuaian_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.jurnal-penyesuaian.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.jurnal-penyesuaian.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'total_dokumen',
                'sum_debit',
                'sum_kredit',
                'balanced_count',
                'unbalanced_count',
                'sum_selisih_abs',
            ],
            'error',
        ]);
    }

    public function test_details_endpoint_returns_expected_shape()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.jurnal-penyesuaian.details', [
            'kodeJurnal' => 'X',
            'periode' => '2018-12-31',
        ]));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'kode_jurnal',
            'periode',
            'details',
            'totals' => [
                'total_debit',
                'total_kredit',
                'is_balanced',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.jurnal-penyesuaian.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'asc',
        ]))->assertStatus(500);
    }
}

