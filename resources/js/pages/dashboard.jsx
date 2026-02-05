import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import useCachedRequest from '@/hooks/use-cached-request';
import useInView from '@/hooks/use-in-view';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useMemo, useState } from 'react';

const breadcrumbs = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const resolveMax = (values) =>
    values.reduce((max, item) => Math.max(max, item.total), 0);

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        value ?? 0,
    );

const formatCompactNumber = (value) => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return formatNumber(0);
    try {
        return new Intl.NumberFormat('id-ID', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1,
        }).format(numericValue);
    } catch {
        return formatNumber(numericValue);
    }
};

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

export default function Dashboard({
    quotationStats = [],
    saldoStats = [],
    pdbStats = {},
    pdoStats = {},
    salesHppStats: initialSalesHppStats = { summary: {}, series: [] },
}) {
    const [quotationRange, setQuotationRange] = useState('1_week'); // 1_week|1_month|3_months|5_months|1_year
    const [selectedSaldo, setSelectedSaldo] = useState(null);
    const [activeDeliveryTab, setActiveDeliveryTab] = useState('pdb');

    // Sales HPP State
    const [salesHppRange, setSalesHppRange] = useState('1_week'); // 1_week|1_month|3_months|5_months|1_year
    const [salesHppHover, setSalesHppHover] = useState(null);

    const quotationView = useInView();
    const saldoView = useInView();
    const deliveryView = useInView();
    const salesHppView = useInView();

    const quotationRequest = useCachedRequest({
        key: `quotation:v2:${quotationRange}`,
        enabled: quotationView.inView,
        ttlMs: 120_000,
        initialData: Array.isArray(quotationStats) && quotationStats.length > 0 ? quotationStats : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/quotation-stats', {
                params: { range: quotationRange },
            });
            return response.data;
        },
    });

    const saldoRequest = useCachedRequest({
        key: 'saldo',
        enabled: saldoView.inView,
        ttlMs: 120_000,
        initialData: Array.isArray(saldoStats) && saldoStats.length > 0 ? saldoStats : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/saldo-stats');
            return response.data;
        },
    });

    const deliveryRequest = useCachedRequest({
        key: 'delivery',
        enabled: deliveryView.inView,
        ttlMs: 120_000,
        initialData:
            (pdbStats && Object.keys(pdbStats).length > 0) ||
            (pdoStats && Object.keys(pdoStats).length > 0)
                ? { pdb: pdbStats, pdo: pdoStats }
                : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/delivery-stats');
            return response.data;
        },
    });

    const salesHppRequest = useCachedRequest({
        key: `salesHpp:v2:${salesHppRange}`,
        enabled: salesHppView.inView,
        ttlMs: 120_000,
        initialData:
            salesHppRange === '3_months' &&
            Array.isArray(initialSalesHppStats?.series) &&
            initialSalesHppStats.series.length > 0
                ? initialSalesHppStats
                : null,
        fetcher: async () => {
            const response = await axios.get(
                `/dashboard/sales-hpp-stats/${salesHppRange}`,
            );
            return response.data;
        },
    });

    const quotationSeries = Array.isArray(quotationRequest.data)
        ? quotationRequest.data
        : [];

    const saldoSeries = Array.isArray(saldoRequest.data) ? saldoRequest.data : [];

    const deliveryData = deliveryRequest.data ?? {};
    const pdbData = deliveryData?.pdb ?? {};
    const pdoData = deliveryData?.pdo ?? {};

    const salesHppData =
        salesHppRequest.data ?? initialSalesHppStats ?? { summary: {}, series: [] };

    const displayedStats = useMemo(
        () => (Array.isArray(quotationSeries) ? quotationSeries : []),
        [quotationSeries],
    );

    const maxTotal = useMemo(
        () => resolveMax(displayedStats),
        [displayedStats],
    );
    const isDenseQuotation = displayedStats.length > 8;
    const maxSaldo = useMemo(
        () => Math.max(1, ...saldoSeries.map((item) => item.saldo ?? 0)),
        [saldoSeries],
    );
    const quotationTotal = useMemo(
        () =>
            displayedStats.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
        [displayedStats],
    );

    const handleSalesHppRangeChange = (nextRange) => {
        setSalesHppHover(null);
        setSalesHppRange(nextRange);
    };

    const quotationGranularityLabel =
        quotationRange === '1_week'
            ? 'hari'
            : quotationRange === '1_month'
              ? 'minggu'
              : 'bulan';

    const salesHppGranularityLabel =
        salesHppRange === '1_week'
            ? 'hari'
            : salesHppRange === '1_month'
              ? 'minggu'
              : 'bulan';

    // Prepare chart data for Sales/HPP Series
    const salesHppChartData = useMemo(() => {
        const series = salesHppData?.series || [];
        if (series.length === 0) return { max: 1, series: [] };

        const max = Math.max(1, ...series.map((d) => Math.max(d.sales, d.hpp)));
        return { max, series };
    }, [salesHppData]);

    const salesHppDerived = useMemo(() => {
        const series = salesHppChartData.series ?? [];
        const totalSales = series.reduce(
            (sum, item) => sum + Number(item.sales ?? 0),
            0,
        );
        const totalHpp = series.reduce(
            (sum, item) => sum + Number(item.hpp ?? 0),
            0,
        );
        const grossProfit = totalSales - totalHpp;
        return {
            max: salesHppChartData.max ?? 1,
            series,
            totalSales,
            totalHpp,
            grossProfit,
        };
    }, [salesHppChartData]);
    const isDenseSalesHpp = salesHppDerived.series.length > 8;
    const isVeryShortSalesHpp =
        salesHppDerived.series.length > 0 && salesHppDerived.series.length <= 3;
    const isShortSalesHpp =
        salesHppDerived.series.length > 0 && salesHppDerived.series.length <= 5;
    const denseLabelParts = (label) => {
        const raw = String(label ?? '').trim();
        if (!raw) return { top: '-', bottom: '' };

        // common: "Mar 2025"
        if (raw.includes(' ')) {
            const parts = raw.split(/\s+/);
            if (parts.length >= 2) {
                return { top: parts[0], bottom: parts.slice(1).join(' ') };
            }
        }

        // fallback: detect trailing 4-digit year like "Mar2025"
        const match = raw.match(/^(.*?)(\d{4})$/);
        if (match) {
            return { top: match[1] || raw, bottom: match[2] };
        }

        return { top: raw, bottom: '' };
    };

    const DashboardCardError = ({ message, onRetry }) => (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-medium">Gagal memuat data.</div>
            <div className="mt-1 text-xs text-destructive/80">{message}</div>
            <div className="mt-3">
                <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                    Coba lagi
                </Button>
            </div>
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
                    <div ref={quotationView.ref} className="min-w-0">
                        <Card className="flex h-full flex-col">
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle>Jumlah Quotation</CardTitle>
                                    <select
                                        className="w-auto rounded-full border border-sidebar-border/70 bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm sm:px-3 sm:py-1.5"
                                        value={quotationRange}
                                        onChange={(event) =>
                                            setQuotationRange(
                                                event.target.value,
                                            )
                                        }
                                        disabled={
                                            quotationRequest.status ===
                                            'loading'
                                        }
                                    >
                                        <option value="1_week">1 Minggu</option>
                                        <option value="1_month">1 Bulan</option>
                                        <option value="3_months">3 Bulan</option>
                                        <option value="5_months">5 Bulan</option>
                                        <option value="1_year">1 Tahun</option>
                                    </select>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Ringkasan jumlah quotation per{' '}
                                    {quotationGranularityLabel}.
                                </p>

                                {quotationRequest.status === 'success' ? (
                                    <div className="flex flex-wrap gap-2">
                                        <div className="rounded-full border border-sidebar-border/70 bg-muted/30 px-3 py-1 text-xs">
                                            <span className="text-muted-foreground">
                                                Total:{' '}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                {formatNumber(quotationTotal)}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        <div className="h-7 w-28 rounded-full border border-sidebar-border/70 bg-muted/30" />
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col">
                                {quotationRequest.status === 'error' ? (
                                    <DashboardCardError
                                        message={quotationRequest.error}
                                        onRetry={quotationRequest.retry}
                                    />
                                ) : quotationRequest.status !== 'success' ? (
                                    <div className="space-y-3">
                                        {/* Mobile skeleton */}
                                        <div className="sm:hidden space-y-3">
                                            {Array.from({ length: 5 }).map(
                                                (_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-3"
                                                    >
                                                        <div className="h-3 w-24 rounded bg-muted" />
                                                        <div className="mt-3 space-y-2">
                                                            <div className="h-2 w-full rounded bg-muted" />
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>

                                        {/* Desktop skeleton */}
                                        <div className="hidden sm:flex items-end gap-3 pb-2">
                                            {Array.from({ length: 6 }).map(
                                                (_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex flex-1 flex-col items-center gap-2"
                                                    >
                                                        <div className="flex h-36 w-full items-end">
                                                            <div className="h-[55%] w-full rounded-lg bg-muted" />
                                                        </div>
                                                        <div className="h-3 w-14 rounded bg-muted" />
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ) : displayedStats.length === 0 ? (
                                    <div className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                        Data quotation belum tersedia.
                                    </div>
                                ) : (
                                    <>
                                        {/* Mobile: list (no horizontal scroll) */}
                                        <div
                                            className={`sm:hidden space-y-3 ${
                                                displayedStats.length > 10
                                                    ? 'max-h-[360px] overflow-y-auto pr-1'
                                                    : ''
                                            }`}
                                        >
                                            {displayedStats.map((item) => {
                                                const width =
                                                    maxTotal > 0
                                                        ? Math.min(
                                                              100,
                                                              (Number(
                                                                  item.total ??
                                                                      0,
                                                              ) /
                                                                  maxTotal) *
                                                                  100,
                                                          )
                                                        : 0;
                                                return (
                                                    <div
                                                        key={item.period}
                                                        className="rounded-lg border border-sidebar-border/70 bg-muted/10 p-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="truncate text-sm font-semibold text-foreground">
                                                                {item.label}
                                                            </div>
                                                            <div className="shrink-0 text-sm font-bold text-foreground">
                                                                {item.total}
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 h-2 w-full rounded bg-muted/40">
                                                            <div
                                                                className="h-2 rounded bg-emerald-500/80"
                                                                style={{
                                                                    width: `${Math.max(
                                                                        2,
                                                                        width,
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop: bar chart (no scroll) */}
                                        <div
                                            className={`hidden sm:flex items-end pb-2 ${
                                                isDenseQuotation
                                                    ? 'gap-2'
                                                    : 'gap-3'
                                            }`}
                                        >
                                            {displayedStats.map((item) => {
                                                const heightRaw =
                                                    maxTotal > 0
                                                        ? (Number(item.total ?? 0) /
                                                              maxTotal) *
                                                          100
                                                        : 0;
                                                const valueNumber = Number(
                                                    item.total ?? 0,
                                                );
                                                const barHeight =
                                                    valueNumber > 0
                                                        ? Math.max(
                                                              heightRaw,
                                                              6,
                                                          )
                                                        : 4;
                                                const labelParts =
                                                    denseLabelParts(item.label);
                                                return (
                                                    <div
                                                        key={item.period}
                                                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                                                    >
                                                        <div
                                                            className={`h-5 min-w-0 text-center font-semibold tabular-nums leading-none text-foreground ${
                                                                isDenseQuotation
                                                                    ? 'text-[10px]'
                                                                    : 'text-xs'
                                                            }`}
                                                        >
                                                            {formatNumber(
                                                                item.total,
                                                            )}
                                                        </div>
                                                        <div className="flex h-36 w-full items-end">
                                                            <div className="relative flex h-full w-full items-end rounded-lg bg-muted/30 p-1">
                                                                <div
                                                                    className="w-full rounded-md bg-emerald-500/80"
                                                                    style={{
                                                                        height: `${Math.max(
                                                                            barHeight,
                                                                            4,
                                                                        )}%`,
                                                                    }}
                                                                >
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span
                                                            className="h-8 w-full min-w-0 text-center text-[11px] leading-tight text-muted-foreground"
                                                            title={item.label}
                                                        >
                                                            <span className="inline-flex flex-col items-center">
                                                                <span>
                                                                    {
                                                                        labelParts.top
                                                                    }
                                                                </span>
                                                                {labelParts.bottom ? (
                                                                    <span className="text-[10px] font-normal text-muted-foreground/80">
                                                                        {
                                                                            labelParts.bottom
                                                                        }
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div ref={saldoView.ref} className="min-w-0">
                        <Card className="flex h-full flex-col">
                            <CardHeader className="space-y-2">
                                <CardTitle>Saldo Kas</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Posisi saldo per akun kas & transaksi terakhir.
                                </p>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col">
                                {saldoRequest.status === 'error' ? (
                                    <DashboardCardError
                                        message={saldoRequest.error}
                                        onRetry={saldoRequest.retry}
                                    />
                                ) : saldoRequest.status !== 'success' ? (
                                    <div className="flex flex-1 items-end gap-3 overflow-x-auto pb-2">
                                        {Array.from({ length: 4 }).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className="flex min-w-[80px] flex-col items-center gap-2"
                                            >
                                                <div className="flex h-32 w-full items-end">
                                                    <div className="h-[55%] w-full rounded-md bg-muted" />
                                                </div>
                                                <div className="h-3 w-16 rounded bg-muted" />
                                                <div className="h-3 w-14 rounded bg-muted" />
                                            </div>
                                        ))}
                                    </div>
                                ) : saldoSeries.length === 0 ? (
                                    <div className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                        Data saldo belum tersedia.
                                    </div>
                                ) : (
                                    <div className="flex flex-1 items-end gap-3 overflow-x-auto pb-2">
                                        {saldoSeries.map((item) => {
                                            const height =
                                                maxSaldo > 0
                                                    ? Math.round(
                                                          ((item.saldo ?? 0) /
                                                              maxSaldo) *
                                                              100,
                                                      )
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
                                                            prev?.code === item.code
                                                                ? null
                                                                : item,
                                                        )
                                                    }
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === 'Enter' ||
                                                            e.key === ' '
                                                        ) {
                                                            e.preventDefault();
                                                            setSelectedSaldo(
                                                                (prev) =>
                                                                    prev?.code ===
                                                                    item.code
                                                                        ? null
                                                                        : item,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <div className="flex h-32 w-full items-end">
                                                        <div
                                                            className="flex w-full items-end justify-center rounded-md bg-blue-500/80 text-[12px] font-semibold text-black dark:text-white"
                                                            style={{
                                                                height: `${Math.max(
                                                                    height,
                                                                    8,
                                                                )}%`,
                                                            }}
                                                        >
                                                            <span className="pb-1">
                                                                {formatNumber(
                                                                    item.saldo,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-center text-[11px] font-medium text-foreground">
                                                        {item.label}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Last:{' '}
                                                        {formatDate(
                                                            item.last_voucher,
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {selectedSaldo && (
                                    <div className="mt-3 rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 text-sm">
                                        <div className="font-semibold text-foreground">
                                            {selectedSaldo.label} (
                                            {selectedSaldo.code})
                                        </div>
                                        <div className="text-muted-foreground">
                                            Saldo:{' '}
                                            <span className="font-medium text-foreground">
                                                {formatNumber(selectedSaldo.saldo)}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            Transaksi terakhir:{' '}
                                            {formatDate(selectedSaldo.last_voucher)}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div ref={deliveryView.ref} className="min-w-0 lg:col-span-2 xl:col-span-1">
                        <Card className="flex h-full flex-col">
                            <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <CardTitle>Sisa Delivery</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {activeDeliveryTab === 'pdb'
                                                ? 'Total sisa Permintaan Dana Biaya yang belum lunas.'
                                                : 'Total sisa Permintaan Dana Operasional yang belum lunas.'}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                                activeDeliveryTab === 'pdb'
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                            aria-pressed={
                                                activeDeliveryTab === 'pdb'
                                            }
                                            onClick={() =>
                                                setActiveDeliveryTab('pdb')
                                            }
                                        >
                                            PDB
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                                activeDeliveryTab === 'pdo'
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                            aria-pressed={
                                                activeDeliveryTab === 'pdo'
                                            }
                                            onClick={() =>
                                                setActiveDeliveryTab('pdo')
                                            }
                                        >
                                            PDO
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col">
                                {deliveryRequest.status === 'error' ? (
                                    <DashboardCardError
                                        message={deliveryRequest.error}
                                        onRetry={deliveryRequest.retry}
                                    />
                                ) : deliveryRequest.status !== 'success' ? (
                                    <div className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-4">
                                        <div className="mb-2 h-4 w-32 rounded bg-muted" />
                                        <div className="h-10 w-48 rounded bg-muted" />
                                        <div className="mt-3 h-3 w-40 rounded bg-muted" />
                                    </div>
                                ) : activeDeliveryTab === 'pdb' ? (
                                    <>
                                        <div className="rounded-xl border border-sidebar-border/70 bg-muted/30 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Total Sisa PDB
                                                    </div>
                                                    <div className="mt-2 text-2xl font-bold tracking-tight">
                                                        Rp{' '}
                                                        {formatNumber(
                                                            pdbData?.total ?? 0,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-muted-foreground">
                                            Last update:{' '}
                                            {formatDate(pdbData?.last_update)}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="rounded-xl border border-sidebar-border/70 bg-muted/30 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Total Sisa PDO
                                                    </div>
                                                    <div className="mt-2 text-2xl font-bold tracking-tight">
                                                        Rp{' '}
                                                        {formatNumber(
                                                            pdoData?.total ?? 0,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-muted-foreground">
                                            Last update:{' '}
                                            {formatDate(pdoData?.last_update)}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sales & HPP Card */}
                    <div ref={salesHppView.ref} className="min-w-0 lg:col-span-2 xl:col-span-3">
                    <Card className="flex h-full flex-col">
                        <CardHeader className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <CardTitle>Penjualan &amp; HPP</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Perbandingan Total Penjualan dan HPP per{' '}
                                        {salesHppGranularityLabel}{' '}
                                        berdasarkan periode.
                                    </p>
                                </div>

                                {/* Mobile: select */}
                                <select
                                    className="w-full rounded-md border border-sidebar-border/70 bg-background px-2 py-2 text-sm text-muted-foreground sm:hidden"
                                    value={salesHppRange}
                                    disabled={salesHppRequest.status === 'loading'}
                                    onChange={(event) =>
                                        handleSalesHppRangeChange(
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="1_week">1 Minggu</option>
                                    <option value="1_month">1 Bulan</option>
                                    <option value="3_months">3 Bulan</option>
                                    <option value="5_months">5 Bulan</option>
                                    <option value="1_year">1 Tahun</option>
                                </select>

                                {/* Desktop: segmented buttons */}
                                <div className="hidden items-center gap-2 sm:flex">
                                    {[
                                        { key: '1_week', label: '1 Minggu' },
                                        { key: '1_month', label: '1 Bulan' },
                                        { key: '3_months', label: '3 Bulan' },
                                        { key: '5_months', label: '5 Bulan' },
                                        { key: '1_year', label: '1 Tahun' },
                                    ].map((opt) => (
                                        <Button
                                            key={opt.key}
                                            type="button"
                                            size="sm"
                                            variant={
                                                salesHppRange === opt.key
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                            aria-pressed={
                                                salesHppRange === opt.key
                                            }
                                            disabled={salesHppRequest.status === 'loading'}
                                            onClick={() =>
                                                handleSalesHppRangeChange(opt.key)
                                            }
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                {salesHppRequest.status !== 'success' ? (
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from({ length: 3 }).map(
                                            (_, idx) => (
                                                <div
                                                    key={idx}
                                                    className="h-7 w-32 rounded-full border border-sidebar-border/70 bg-muted/30"
                                                />
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        <div className="rounded-full border border-sidebar-border/70 bg-muted/30 px-3 py-1 text-xs">
                                            <span className="text-muted-foreground">
                                                Total Sales:{' '}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                Rp{' '}
                                                {formatNumber(
                                                    salesHppDerived.totalSales,
                                                )}
                                            </span>
                                        </div>
                                        <div className="rounded-full border border-sidebar-border/70 bg-muted/30 px-3 py-1 text-xs">
                                            <span className="text-muted-foreground">
                                                Total HPP:{' '}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                Rp{' '}
                                                {formatNumber(
                                                    salesHppDerived.totalHpp,
                                                )}
                                            </span>
                                        </div>
                                        <div className="rounded-full border border-sidebar-border/70 bg-muted/30 px-3 py-1 text-xs">
                                            <span className="text-muted-foreground">
                                                Gross Profit:{' '}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                Rp{' '}
                                                {formatNumber(
                                                    salesHppDerived.grossProfit,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500" />
                                        <span>Sales</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        <span>HPP</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex flex-1 flex-col gap-4">
                            {salesHppRequest.status === 'error' && (
                                <DashboardCardError
                                    message={salesHppRequest.error}
                                    onRetry={salesHppRequest.retry}
                                />
                            )}

                            {salesHppHover &&
                                salesHppRequest.status === 'success' && (
                                <div
                                    className="pointer-events-none fixed z-[60] w-max max-w-[240px] rounded-lg border border-sidebar-border/70 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl"
                                    style={{
                                        left: Math.min(
                                            window.innerWidth - 260,
                                            Math.max(12, salesHppHover.x + 12),
                                        ),
                                        top: Math.min(
                                            window.innerHeight - 120,
                                            Math.max(12, salesHppHover.y - 12),
                                        ),
                                    }}
                                >
                                    <div className="max-w-[220px] truncate font-medium">
                                        {salesHppHover.label}
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                            Sales
                                        </span>
                                        <span className="font-semibold">
                                            {formatNumber(salesHppHover.sales)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-semibold text-red-600 dark:text-red-400">
                                            HPP
                                        </span>
                                        <span className="font-semibold">
                                            {formatNumber(salesHppHover.hpp)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {salesHppRequest.status !== 'error' && (
                                <>
                            {/* Mobile: horizontal list bars */}
                            <div className="sm:hidden">
                                {salesHppRequest.status !== 'success' && (
                                    <div className="space-y-3">
                                        {Array.from({ length: 6 }).map(
                                            (_, idx) => (
                                                <div
                                                    key={idx}
                                                    className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-3"
                                                >
                                                    <div className="h-3 w-24 rounded bg-muted" />
                                                    <div className="mt-3 space-y-2">
                                                        <div className="h-2 w-full rounded bg-muted" />
                                                        <div className="h-2 w-4/5 rounded bg-muted" />
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                                {salesHppRequest.status === 'success' &&
                                    salesHppDerived.series.length === 0 && (
                                        <div className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                            Tidak ada data pada periode ini.
                                        </div>
                                    )}

                                {salesHppRequest.status === 'success' &&
                                    salesHppDerived.series.length > 0 && (
                                        <div
                                            className={`space-y-3 ${
                                                salesHppDerived.series.length >
                                                10
                                                    ? 'max-h-[420px] overflow-y-auto pr-1'
                                                    : ''
                                            }`}
                                        >
                                            {salesHppDerived.series.map(
                                                (item) => {
                                                    const salesWidth =
                                                        salesHppDerived.max > 0
                                                            ? Math.min(
                                                                  100,
                                                                  (Number(
                                                                      item.sales ??
                                                                          0,
                                                                  ) /
                                                                      salesHppDerived.max) *
                                                                      100,
                                                              )
                                                            : 0;
                                                    const hppWidth =
                                                        salesHppDerived.max > 0
                                                            ? Math.min(
                                                                  100,
                                                                  (Number(
                                                                      item.hpp ??
                                                                          0,
                                                                  ) /
                                                                      salesHppDerived.max) *
                                                                      100,
                                                              )
                                                            : 0;
                                                    return (
                                                        <div
                                                            key={item.period}
                                                            className="rounded-lg border border-sidebar-border/70 bg-muted/10 p-3"
                                                        >
                                                            <div className="flex min-w-0 items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-foreground">
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </div>
                                                                </div>
                                                                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                                                                    <div>
                                                                        Sales:{' '}
                                                                        <span className="font-medium text-foreground">
                                                                            {formatNumber(
                                                                                item.sales,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        HPP:{' '}
                                                                        <span className="font-medium text-foreground">
                                                                            {formatNumber(
                                                                                item.hpp,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 space-y-2">
                                                                <div className="h-2 w-full rounded bg-muted/40">
                                                                    <div
                                                                        className="h-2 rounded bg-green-500/80"
                                                                        style={{
                                                                            width: `${Math.max(
                                                                                2,
                                                                                salesWidth,
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="h-2 w-full rounded bg-muted/40">
                                                                    <div
                                                                        className="h-2 rounded bg-red-500/80"
                                                                        style={{
                                                                            width: `${Math.max(
                                                                                2,
                                                                                hppWidth,
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}
                            </div>

                            {/* Desktop: bar chart */}
                            <div className="hidden sm:block">
                                <div
                                    className={`grid min-h-[260px] flex-1 grid-flow-col items-end gap-4 overflow-x-auto px-2 py-4 ${
                                        isDenseSalesHpp
                                            ? 'auto-cols-[minmax(84px,1fr)] pb-10'
                                            : 'auto-cols-[minmax(56px,1fr)] lg:auto-cols-[minmax(72px,1fr)]'
                                    }`}
                                >
                                    {salesHppRequest.status !== 'success' && (
                                        <>
                                            {Array.from({ length: 10 }).map(
                                                (_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex min-w-[56px] flex-col items-center gap-2"
                                                    >
                                                        <div className="flex h-48 w-full items-end justify-center gap-2">
                                                            <div className="h-[40%] w-full rounded-t-sm bg-muted" />
                                                            <div className="h-[65%] w-full rounded-t-sm bg-muted" />
                                                        </div>
                                                        <div className="h-3 w-10 rounded bg-muted" />
                                                    </div>
                                                ),
                                            )}
                                        </>
                                    )}

                                    {salesHppRequest.status === 'success' &&
                                        salesHppDerived.series.length === 0 && (
                                            <div className="col-span-full flex h-full items-center justify-center text-sm text-muted-foreground">
                                                Tidak ada data pada periode ini.
                                            </div>
                                        )}

                                    {salesHppRequest.status === 'success' &&
                                        salesHppDerived.series.map((item) => (
                                            <div
                                                key={item.period}
                                                className={`group flex flex-col items-center gap-2 ${
                                                    isDenseSalesHpp
                                                        ? 'min-w-[84px]'
                                                        : 'min-w-[56px]'
                                                }`}
                                                onMouseEnter={(event) => {
                                                    setSalesHppHover({
                                                        x: event.clientX,
                                                        y: event.clientY,
                                                        label: item.label,
                                                        sales: item.sales,
                                                        hpp: item.hpp,
                                                    });
                                                }}
                                                onMouseMove={(event) => {
                                                    setSalesHppHover((prev) =>
                                                        prev
                                                            ? {
                                                                  ...prev,
                                                                  x: event.clientX,
                                                                  y: event.clientY,
                                                              }
                                                            : null,
                                                    );
                                                }}
                                                onMouseLeave={() =>
                                                    setSalesHppHover(null)
                                                }
                                            >
                                                <div className="relative flex h-48 w-full items-end justify-center gap-2">
                                                    <div
                                                        className="relative flex w-full flex-col items-center justify-end rounded-t-sm bg-green-500/80 transition-colors hover:bg-green-500"
                                                        style={{
                                                            height: `${Math.max(
                                                                12,
                                                                (Number(
                                                                    item.sales ??
                                                                        0,
                                                                ) /
                                                                    salesHppDerived.max) *
                                                                    100,
                                                            )}%`,
                                                        }}
                                                    >
                                                        {!isDenseSalesHpp &&
                                                            Number(
                                                                item.sales ?? 0,
                                                            ) > 0 && (
                                                                <span
                                                                    className={`mb-1 px-1 text-center font-bold tabular-nums leading-none text-black dark:text-white ${
                                                                        isVeryShortSalesHpp
                                                                            ? 'block text-base sm:text-lg md:text-xl'
                                                                            : isShortSalesHpp
                                                                              ? 'block text-xs sm:text-sm'
                                                                              : 'hidden text-[12px] md:block'
                                                                    }`}
                                                                >
                                                                    {isShortSalesHpp &&
                                                                    !isVeryShortSalesHpp
                                                                        ? formatCompactNumber(
                                                                              item.sales,
                                                                          )
                                                                        : formatNumber(
                                                                              item.sales,
                                                                          )}
                                                                </span>
                                                            )}
                                                    </div>

                                                    <div
                                                        className="relative flex w-full flex-col items-center justify-end rounded-t-sm bg-red-500/80 transition-colors hover:bg-red-500"
                                                        style={{
                                                            height: `${Math.max(
                                                                12,
                                                                (Number(
                                                                    item.hpp ??
                                                                        0,
                                                                ) /
                                                                    salesHppDerived.max) *
                                                                    100,
                                                            )}%`,
                                                        }}
                                                    >
                                                        {!isDenseSalesHpp &&
                                                            Number(
                                                                item.hpp ?? 0,
                                                            ) > 0 && (
                                                                <span
                                                                    className={`mb-1 px-1 text-center font-bold tabular-nums leading-none text-black dark:text-white ${
                                                                        isVeryShortSalesHpp
                                                                            ? 'block text-base sm:text-lg md:text-xl'
                                                                            : isShortSalesHpp
                                                                              ? 'block text-xs sm:text-sm'
                                                                              : 'hidden text-[12px] md:block'
                                                                    }`}
                                                                >
                                                                    {isShortSalesHpp &&
                                                                    !isVeryShortSalesHpp
                                                                        ? formatCompactNumber(
                                                                              item.hpp,
                                                                          )
                                                                        : formatNumber(
                                                                              item.hpp,
                                                                          )}
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                                {isDenseSalesHpp ? (
                                                    <span
                                                        className="w-full text-center text-[11px] leading-tight font-medium text-foreground/80 drop-shadow-sm"
                                                        title={item.label}
                                                    >
                                                        {(() => {
                                                            const {
                                                                top,
                                                                bottom,
                                                            } = denseLabelParts(
                                                                item.label,
                                                            );
                                                            return (
                                                                <span className="inline-flex flex-col items-center">
                                                                    <span>
                                                                        {top}
                                                                    </span>
                                                                    {bottom ? (
                                                                        <span className="text-[10px] font-normal text-muted-foreground">
                                                                            {
                                                                                bottom
                                                                            }
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            );
                                                        })()}
                                                    </span>
                                                ) : (
                                                    <span className="w-full truncate text-center text-xs text-muted-foreground">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>

                                </>
                            )}
                        </CardContent>
                    </Card>
                    </div>
                </div>

                <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-sidebar-border/70 sm:min-h-[260px] md:min-h-[320px] lg:min-h-[360px] dark:border-sidebar-border">
                    <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                </div>
            </div>
        </AppLayout>
    );
}
