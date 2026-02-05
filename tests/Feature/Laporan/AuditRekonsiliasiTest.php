<?php

namespace Tests\Feature\Laporan;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditRekonsiliasiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_users_can_visit_audit_rekonsiliasi_page()
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('laporan.audit-rekonsiliasi.index'))->assertOk();
    }

    public function test_rows_endpoint_returns_expected_shape_when_tables_missing()
    {
        $this->actingAs(User::factory()->create());

        $res = $this->getJson(route('laporan.audit-rekonsiliasi.rows'));
        $res->assertStatus(500);
        $res->assertJsonStructure([
            'period_type',
            'period',
            'period_label',
            'effective_period',
            'effective_period_label',
            'kpis' => [
                'trx' => ['total', 'balanced', 'unbalanced', 'sum_selisih_abs'],
                'ajp' => ['total', 'balanced', 'unbalanced', 'sum_selisih_abs'],
                'neraca' => ['total_aset', 'total_liabilitas', 'total_ekuitas', 'selisih', 'tolerance', 'is_balanced'],
                'modal' => ['opening_equity', 'contributions', 'withdrawals', 'net_income', 'computed_ending_equity', 'snapshot_ending_equity', 'diff', 'tolerance', 'is_match'],
            ],
            'findings' => [
                'unbalanced_journals',
                'unbalanced_ajp_docs',
                'neraca_anomalies',
                'equity_movements_top',
            ],
            'error',
        ]);
    }
}

