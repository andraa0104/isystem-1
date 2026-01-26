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
const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);
const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

export default function Dashboard({ quotationStats = [], saldoStats = [] }) {
    const [range, setRange] = useState(3);
    const [selectedSaldo, setSelectedSaldo] = useState(null);

    const displayedStats = useMemo(() => {
        const fallback = quotationStats.slice(-range);
        return fallback.length > 0 ? fallback : [];
    }, [quotationStats, range]);

    const maxTotal = useMemo(() => resolveMax(displayedStats), [displayedStats]);
    const maxSaldo = useMemo(
        () => Math.max(1, ...saldoStats.map((item) => item.saldo ?? 0)),
        [saldoStats]
    );

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
                                                    className="flex w-full items-end justify-center rounded-md bg-emerald-500/80 text-[15px] font-extrabold text-black dark:text-white"
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
                    <Card className="flex flex-col">
                        <CardHeader className="space-y-2">
                            <CardTitle>Saldo Kas</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Posisi saldo per akun kas & transaksi terakhir.
                            </p>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col">
                            <div className="flex flex-1 items-end gap-3 overflow-x-auto pb-2">
                                {saldoStats.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Data saldo belum tersedia.
                                    </p>
                                )}
                                {saldoStats.map((item) => {
                                    const height = maxSaldo > 0
                                        ? Math.round(((item.saldo ?? 0) / maxSaldo) * 100)
                                        : 0;
                                    const tooltip = `${item.label}\nSaldo: ${formatNumber(item.saldo)}\nTransaksi terakhir: ${formatDate(item.last_voucher)}`;
                                    return (
                                        <div
                                            key={item.code}
                                            className="flex min-w-[80px] flex-col items-center gap-2"
                                            title={tooltip}
                                            role="button"
                                            onClick={() =>
                                                setSelectedSaldo((prev) =>
                                                    prev?.code === item.code ? null : item
                                                )
                                            }
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedSaldo((prev) =>
                                                        prev?.code === item.code ? null : item
                                                    );
                                                }
                                            }}
                                        >
                                            <div className="flex h-32 w-full items-end">
                                                <div
                                                    className="flex w-full items-end justify-center rounded-md bg-blue-500/80 text-[12px] font-semibold text-black dark:text-white"
                                                    style={{ height: `${Math.max(height, 8)}%` }}
                                                >
                                                    <span className="pb-1">
                                                        {formatNumber(item.saldo)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-center text-[11px] font-medium text-foreground">
                                                {item.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                Last: {formatDate(item.last_voucher)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {selectedSaldo && (
                                <div className="mt-3 rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 text-sm">
                                    <div className="font-semibold text-foreground">
                                        {selectedSaldo.label} ({selectedSaldo.code})
                                    </div>
                                    <div className="text-muted-foreground">
                                        Saldo: <span className="font-medium text-foreground">{formatNumber(selectedSaldo.saldo)}</span>
                                    </div>
                                    <div className="text-muted-foreground">
                                        Transaksi terakhir: {formatDate(selectedSaldo.last_voucher)}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
