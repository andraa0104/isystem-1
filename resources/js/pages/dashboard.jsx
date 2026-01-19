import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
const breadcrumbs = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];
const resolveMax = (values) => values.reduce((max, item) => Math.max(max, item.total), 0);

export default function Dashboard({ quotationStats = [] }) {
    const [range, setRange] = useState(3);

    const displayedStats = useMemo(() => {
        const fallback = quotationStats.slice(-range);
        return fallback.length > 0 ? fallback : [];
    }, [quotationStats, range]);

    const maxTotal = useMemo(() => resolveMax(displayedStats), [displayedStats]);

    return (<AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard"/>
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <Card className="flex flex-col">
                        <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle>Jumlah Quotation</CardTitle>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm text-muted-foreground"
                                    value={range}
                                    onChange={(event) => setRange(Number(event.target.value))}
                                >
                                    <option value={3}>3 Bulan</option>
                                    <option value={5}>5 Bulan</option>
                                    <option value={12}>1 Tahun</option>
                                </select>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Ringkasan jumlah quotation per bulan.
                            </p>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col">
                            <div className="flex flex-1 items-end gap-3 overflow-x-auto pb-2">
                                {displayedStats.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Data quotation belum tersedia.
                                    </p>
                                )}
                                {displayedStats.map((item) => {
                                    const height = maxTotal > 0
                                        ? Math.round((item.total / maxTotal) * 100)
                                        : 0;
                                    return (
                                        <div
                                            key={item.period}
                                            className="flex min-w-[70px] flex-col items-center gap-2"
                                        >
                                            <div className="flex h-28 w-full items-end">
                                                <div
                                                    className="flex w-full items-end justify-center rounded-md bg-emerald-500/80 text-[10px] font-semibold text-white"
                                                    style={{ height: `${Math.max(height, 8)}%` }}
                                                >
                                                    <span className="pb-1">
                                                        {item.total}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-center text-[11px] text-muted-foreground">
                                                {item.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20"/>
                    </div>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20"/>
                    </div>
                </div>
                <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border">
                    <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20"/>
                </div>
            </div>
        </AppLayout>);
}
