<?php

namespace App\Services\Marketing;

use Illuminate\Database\Query\Builder;

/** SQL equivalents of CollectionAnalytics.py for paginated drill-downs. */
class CollectionDetailQuery
{
    public function risk(Builder $invoices, string $tier): Builder
    {
        $connection = $invoices->getConnection();
        $customers = $connection->query()->fromSub($invoices, 'invoices')
            ->selectRaw('cast(trim(nm_cs) as binary) as nm_cs, count(*) as invoice_count')
            ->selectRaw('sum(saldo_piutang) as total_saldo, sum(g_total) as total_g_total, sum(total_bayaran) as total_bayar')
            ->selectRaw('max(greatest(umur_tempo, 0)) as max_overdue_days')
            ->groupByRaw('cast(trim(nm_cs) as binary)');
        $z = '-2.4 + (0.038 * least(180, max_overdue_days)) + (0.75 * ln(1 + greatest(0, total_saldo)) / 16.0) - (2.2 * total_bayar / greatest(1.0, total_g_total))';
        $probabilities = $connection->query()->fromSub($customers, 'customers')->select('*')
            ->selectRaw("round(100.0 / (1.0 + exp(-({$z}))), 1) as default_prob");
        $classified = $connection->query()->fromSub($probabilities, 'probabilities')->select('*')
            ->selectRaw("case when default_prob >= 70 or max_overdue_days > 90 then 'critical_risk'
                when default_prob >= 45 or max_overdue_days > 45 then 'high_risk'
                when default_prob >= 20 or max_overdue_days > 15 then 'moderate_risk'
                else 'low_risk' end as risk_tier");

        // Filter after aggregating the full customer balance, never individual invoices.
        return $connection->query()->fromSub($classified, 'risk')->where('risk_tier', $tier);
    }

    public function cashflow(Builder $invoices, int $horizon): Builder
    {
        $ratio = 'least(1.0, greatest(0.0, 1.0 * total_bayaran / greatest(1.0, g_total)))';
        $probability = match ($horizon) {
            7 => "case when umur_tempo <= 0 then case when umur_tempo >= -7 then 0.65 else 0.20 end
                when umur_tempo <= 30 then 0.40 + 0.20 * {$ratio}
                when umur_tempo <= 60 then 0.20 + 0.15 * {$ratio}
                when umur_tempo <= 90 then 0.10 else 0.03 end",
            14 => "case when umur_tempo <= 0 then case when umur_tempo >= -14 then 0.85 else 0.45 end
                when umur_tempo <= 30 then 0.65 + 0.20 * {$ratio}
                when umur_tempo <= 60 then 0.38 + 0.18 * {$ratio}
                when umur_tempo <= 90 then 0.20 else 0.07 end",
            30 => "case when umur_tempo <= 0 then 0.95
                when umur_tempo <= 30 then 0.82 + 0.12 * {$ratio}
                when umur_tempo <= 60 then 0.58 + 0.20 * {$ratio}
                when umur_tempo <= 90 then 0.35 else 0.15 end",
        };
        $connection = $invoices->getConnection();
        $probabilities = $connection->query()->fromSub($invoices, 'invoices')->select('*')
            ->selectRaw("({$probability}) * 100.0 as payment_probability")
            ->selectRaw("saldo_piutang * ({$probability}) as expected_recovery");

        // Every active invoice contributes to the forecast, including future-due invoices.
        return $connection->query()->fromSub($probabilities, 'forecast');
    }
}
