<?php

$file = '/root/isystem-1/app/Http/Controllers/Marketing/PurchaseOrderInController.php';
$content = file_get_contents($file);

$target = <<<EOD
                if (\$summaryScope === 'realized' || \$summaryScope === 'realized_pr' || \$summaryScope === 'realized_do') {
                    \$doCounts = DB::table('tb_kddo as kdo')
                        ->join('tb_poin as p', function (\$join) use (\$prefix) {
                            \$join->where('p.kode_poin', 'like', \$prefix . '.POIN-%');
                            \$join->whereRaw('lower(trim(kdo.ref_po)) = lower(trim(p.no_poin))');
                        })
                        ->joinSub(\$detailStats, 'do_ds', function (\$join) {
                            \$join->on('do_ds.kode_poin', '=', 'p.kode_poin');
                        })
                        ->whereRaw("trim(coalesce(kdo.ref_po, '')) <> ''")
                        ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                        ->whereRaw('coalesce(do_ds.total_items, 0) > 0')
                        ->whereRaw('coalesce(do_ds.do_unrealized_items, 0) = 0')
                        ->selectRaw('count(distinct lower(trim(kdo.no_do))) as realized_do')
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_today", [\$startToday, \$endToday])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_week", [\$startWeek, \$endWeek])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_month", [\$startMonth, \$endMonth])
                        ->selectRaw("count(distinct case when str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ? then lower(trim(kdo.no_do)) end) as realized_do_year", [\$startYear, \$endYear])
                        ->first();

                    \$row = DB::table('tb_poin as p')->where('p.kode_poin', 'like', \$prefix . '.POIN-%')
                        ->leftJoinSub(\$detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->leftJoinSub(\$prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                        ->selectRaw("count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date is not null then 1 end) as realized_pr")
                        ->selectRaw("count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_today", [\$startToday, \$endToday])
                        ->selectRaw("count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_week", [\$startWeek, \$endWeek])
                        ->selectRaw("count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_month", [\$startMonth, \$endMonth])
                        ->selectRaw("count(case when coalesce(ds.total_items, 0) > 0 and coalesce(ds.unrealized_items, 0) = 0 and prs.last_pr_date between ? and ? then 1 end) as realized_pr_year", [\$startYear, \$endYear])
                        ->first();

                    \$summary = [];
                    if (\$summaryScope === 'realized' || \$summaryScope === 'realized_pr') {
                        \$summary['realized_pr'] = (int) (\$row->realized_pr ?? 0);
                        \$summary['realized_pr_counts'] = [
                            'today' => (int) (\$row->realized_pr_today ?? 0),
                            'week' => (int) (\$row->realized_pr_week ?? 0),
                            'month' => (int) (\$row->realized_pr_month ?? 0),
                            'year' => (int) (\$row->realized_pr_year ?? 0),
                            'all' => (int) (\$row->realized_pr ?? 0),
                        ];
                    }
                    if (\$summaryScope === 'realized' || \$summaryScope === 'realized_do') {
                        \$summary['realized_do'] = (int) (\$doCounts->realized_do ?? 0);
                        \$summary['realized_do_counts'] = [
                            'today' => (int) (\$doCounts->realized_do_today ?? 0),
                            'week' => (int) (\$doCounts->realized_do_week ?? 0),
                            'month' => (int) (\$doCounts->realized_do_month ?? 0),
                            'year' => (int) (\$doCounts->realized_do_year ?? 0),
                            'all' => (int) (\$doCounts->realized_do ?? 0),
                        ];
                    }

                    return ['summary' => \$summary];
                }
EOD;

$replacement = <<<EOD
                if (\$summaryScope === 'realized' || \$summaryScope === 'realized_pr' || \$summaryScope === 'realized_do') {
                    \$doCountsQuery = DB::table('tb_kddo as kdo')
                        ->join('tb_poin as p', function (\$join) use (\$prefix) {
                            \$join->where('p.kode_poin', 'like', \$prefix . '.POIN-%');
                            \$join->whereRaw('lower(trim(kdo.ref_po)) = lower(trim(p.no_poin))');
                        })
                        ->joinSub(\$detailStats, 'do_ds', function (\$join) {
                            \$join->on('do_ds.kode_poin', '=', 'p.kode_poin');
                        })
                        ->whereRaw("trim(coalesce(kdo.ref_po, '')) <> ''")
                        ->whereRaw("trim(coalesce(kdo.no_do, '')) <> ''")
                        ->whereRaw('coalesce(do_ds.total_items, 0) > 0')
                        ->whereRaw('coalesce(do_ds.do_unrealized_items, 0) = 0');
                        
                    if (\$dateFilter === 'today') {
                        \$doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [\$startToday, \$endToday]);
                    } elseif (\$dateFilter === 'this_week') {
                        \$doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [\$startWeek, \$endWeek]);
                    } elseif (\$dateFilter === 'this_month') {
                        \$doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [\$startMonth, \$endMonth]);
                    } elseif (\$dateFilter === 'this_year') {
                        \$doCountsQuery->whereRaw("str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y') between ? and ?", [\$startYear, \$endYear]);
                    } elseif (\$dateFilter === 'range' && \$startDate !== '' && \$endDate !== '') {
                        \$doCountsQuery->whereRaw("date(str_to_date(trim(kdo.pos_tgl), '%d.%m.%Y')) between ? and ?", [\$startDate, \$endDate]);
                    }
                    
                    \$doCounts = \$doCountsQuery->selectRaw('count(distinct lower(trim(kdo.no_do))) as realized_do')->first();

                    \$rowQuery = DB::table('tb_poin as p')->where('p.kode_poin', 'like', \$prefix . '.POIN-%')
                        ->leftJoinSub(\$detailStats, 'ds', 'ds.kode_poin', '=', 'p.kode_poin')
                        ->leftJoinSub(\$prStats, 'prs', 'prs.ref_po', '=', 'p.no_poin')
                        ->whereRaw("coalesce(ds.total_items, 0) > 0")
                        ->whereRaw("coalesce(ds.unrealized_items, 0) = 0")
                        ->whereNotNull('prs.last_pr_date');

                    if (\$dateFilter === 'today') {
                        \$rowQuery->whereBetween('prs.last_pr_date', [\$startToday, \$endToday]);
                    } elseif (\$dateFilter === 'this_week') {
                        \$rowQuery->whereBetween('prs.last_pr_date', [\$startWeek, \$endWeek]);
                    } elseif (\$dateFilter === 'this_month') {
                        \$rowQuery->whereBetween('prs.last_pr_date', [\$startMonth, \$endMonth]);
                    } elseif (\$dateFilter === 'this_year') {
                        \$rowQuery->whereBetween('prs.last_pr_date', [\$startYear, \$endYear]);
                    } elseif (\$dateFilter === 'range' && \$startDate !== '' && \$endDate !== '') {
                        \$rowQuery->whereDate('prs.last_pr_date', '>=', \$startDate)->whereDate('prs.last_pr_date', '<=', \$endDate);
                    }
                    
                    \$row = \$rowQuery->selectRaw("count(*) as realized_pr")->first();

                    \$summary = [];
                    if (\$summaryScope === 'realized' || \$summaryScope === 'realized_pr') {
                        \$summary['realized_pr'] = (int) (\$row->realized_pr ?? 0);
                    }
                    if (\$summaryScope === 'realized' || \$summaryScope === 'realized_do') {
                        \$summary['realized_do'] = (int) (\$doCounts->realized_do ?? 0);
                    }

                    return ['summary' => \$summary];
                }
EOD;

$content = str_replace($target, $replacement, $content);
file_put_contents($file, $content);
echo "Replaced backend.\n";

