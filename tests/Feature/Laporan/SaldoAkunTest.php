<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaldoAkunTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_saldo_akun_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.saldo-akun.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape_when_table_missing()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.saldo-akun.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'rows',
            'total',
            'summary' => [
                'total_accounts',
                'na_debit',
                'na_kredit',
                'sum_saldo',
                'positive_count',
                'negative_count',
                'zero_count',
                'marked_00_count',
                'null_saldo_count',
                'na_nonzero_but_saldo_zero_count',
                'saldo_nonzero_but_na_zero_count',
                'top_positive',
                'top_negative',
            ],
            'error',
        ]);
    }

    public function test_rows_endpoint_ignores_invalid_sort_by()
    {
        $this->actingAs(User::factory()->create());

        $this->getJson(route('laporan.saldo-akun.rows', [
            'sortBy' => 'DROP_TABLE',
            'sortDir' => 'desc',
        ]))->assertStatus(500);
    }
}
