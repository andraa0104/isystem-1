import { MenuAction } from '@/components/menu-action';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import InvoiceDetailDialog from '@/components/InvoiceDetailDialog';
import PrOrderHistory from '@/components/pr-order-history';
import OverdueInvoiceWarningDialog from '@/components/OverdueInvoiceWarningDialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { subscribeToPoInChanges } from '@/lib/po-in-realtime';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { createLatestRequest, readPoInResponse } from '@/lib/purchase-order-in';
import {
    applyKnownPrTotal,
    getPrProgress,
    readPrFilters,
} from '@/lib/purchase-requirement';
import {
    AlertCircle,
    AlertTriangle,
    BrainCircuit,
    ClipboardCheck,
    Eye,
    LayoutGrid,
    LayoutList,
    Pencil,
    Printer,
    Search,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Purchase Requirement', href: '/marketing/purchase-requirement' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const normalizeCustomerName = (value) =>
    String(value ?? '')
        .trim()
        .toLowerCase();

const splitMultiValue = (value) =>
    Array.isArray(value)
        ? value
        : String(value ?? '')
              .split(/\s*(?:,|\/)\s*/)
              .map((item) => item.trim())
              .filter(Boolean);

const getValue = (source, keys) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
    }
    return '-';
};

const formatRupiah = (value) => {
    const number = Number(
        typeof value === 'string' ? value.replace(/,/g, '').trim() : value,
    );
    if (Number.isNaN(number)) return '-';
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const formatNumber = (value) => {
    const number = Number(
        typeof value === 'string' ? value.replace(/,/g, '').trim() : value,
    );
    if (Number.isNaN(number)) return '-';
    return new Intl.NumberFormat('id-ID').format(number);
};

// ─── Helpers untuk InsightRecommendationPanel ────────────────────────────────

function getUrgencyBadge(type, item) {
    if (type === 'stock') {
        if (item.stock_matched !== false && item.current_stock !== undefined && item.current_stock <= 0) {
            return { label: 'Stok Habis', color: 'bg-destructive text-destructive-foreground' };
        }
        if (item.days_of_inventory !== undefined && item.days_of_inventory > 0 && item.days_of_inventory <= 7) {
            return { label: `Kritis ${item.days_of_inventory}h`, color: 'bg-destructive/10 text-destructive' };
        }
        if (item.days_of_inventory !== undefined && item.days_of_inventory > 0 && item.days_of_inventory <= 15) {
            return { label: `Menipis ${item.days_of_inventory}h`, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
        }
    }
    if (type === 'opex' && item.predicted_date !== undefined) {
        if (item.days_until < 0) {
            return { label: `Terlewat ${Math.abs(item.days_until)}h`, color: 'bg-destructive text-destructive-foreground' };
        }
        if (item.days_until === 0) {
            return { label: 'Hari Ini!', color: 'bg-destructive/10 text-destructive' };
        }
        if (item.days_until <= 7) {
            return { label: `${item.days_until}h lagi`, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
        }
    }
    return null;
}

function InsightRecommendationPanel({
    title,
    description,
    data = [],
    loading,
    error,
    onRetry,
    type,
}) {
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterConfidence, setFilterConfidence] = useState('all');
    const [filterUrgency, setFilterUrgency] = useState('all');
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'

    // ── 2 & 3: Filter + Search ───────────────────────────────────────────────
    const filteredData = useMemo(() => {
        let result = data;

        // Pencarian nama/kode material
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter(
                (item) =>
                    String(item.material ?? '').toLowerCase().includes(q) ||
                    String(item.material_code ?? '').toLowerCase().includes(q),
            );
        }

        // Filter keyakinan
        if (filterConfidence !== 'all') {
            result = result.filter((item) => item.confidence === filterConfidence);
        }

        // Filter urgensi
        if (filterUrgency !== 'all') {
            if (type === 'stock') {
                if (filterUrgency === 'critical') {
                    result = result.filter(
                        (item) =>
                            (item.stock_matched !== false && item.current_stock !== undefined && item.current_stock <= 0) ||
                            (item.days_of_inventory !== undefined && item.days_of_inventory > 0 && item.days_of_inventory <= 7),
                    );
                } else if (filterUrgency === 'low') {
                    result = result.filter(
                        (item) =>
                            item.days_of_inventory !== undefined &&
                            item.days_of_inventory > 7 &&
                            item.days_of_inventory <= 15,
                    );
                }
            }
            if (type === 'opex') {
                if (filterUrgency === 'critical') {
                    result = result.filter(
                        (item) => item.days_until !== undefined && item.days_until <= 0,
                    );
                } else if (filterUrgency === 'low') {
                    result = result.filter(
                        (item) => item.days_until !== undefined && item.days_until > 0 && item.days_until <= 7,
                    );
                }
            }
        }

        return result;
    }, [data, search, filterConfidence, filterUrgency, type]);

    const totalItems = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, totalPages);

    const displayedData = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, safePage, pageSize]);

    // ── 1: Estimasi Anggaran ─────────────────────────────────────────────────
    const budgetSummary = useMemo(() => {
        if (type !== 'stock') return null;
        let total = 0;
        let hasData = false;
        for (const item of data) {
            const qty = Number(item.suggested_qty);
            const cost = Number(item.latest_landed_cost);
            if (!Number.isNaN(qty) && qty > 0 && !Number.isNaN(cost) && cost > 0) {
                total += qty * cost;
                hasData = true;
            }
        }
        return hasData ? total : null;
    }, [data, type]);

    const resetFilters = () => {
        setSearch('');
        setFilterConfidence('all');
        setFilterUrgency('all');
        setCurrentPage(1);
    };

    const hasActiveFilter = search.trim() || filterConfidence !== 'all' || filterUrgency !== 'all';

    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BrainCircuit className="size-4 shrink-0" />
                            {title}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                        {/* ── 1: Total Estimasi Anggaran ── */}
                        {budgetSummary !== null && (
                            <p className="mt-1.5 text-xs font-medium text-primary">
                                Estimasi total anggaran:{' '}
                                <span className="font-semibold">{formatRupiah(budgetSummary)}</span>
                                <span className="ml-1 font-normal text-muted-foreground">
                                    (dari {data.filter((i) => Number(i.suggested_qty) > 0 && Number(i.latest_landed_cost) > 0).length} item)
                                </span>
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {/* ── 4: Toggle View ── */}
                        {!loading && !error && data.length > 0 && (
                            <div className="flex overflow-hidden rounded-md border border-sidebar-border/70">
                                <button
                                    type="button"
                                    title="Tampilan Kartu"
                                    onClick={() => setViewMode('card')}
                                    className={`p-1.5 text-xs transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                                >
                                    <LayoutGrid className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    title="Tampilan Tabel Ringkas"
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                                >
                                    <LayoutList className="size-3.5" />
                                </button>
                            </div>
                        )}
                        {!loading && !error && data.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>Tampilkan</span>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-xs"
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 2: Filter Bar ── */}
                {!loading && !error && data.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative flex-1" style={{ minWidth: '160px' }}>
                            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Cari material..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="h-7 w-full rounded-md border border-sidebar-border/70 bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        {/* Filter Keyakinan */}
                        <select
                            className="h-7 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs text-muted-foreground"
                            value={filterConfidence}
                            onChange={(e) => { setFilterConfidence(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all">Semua Keyakinan</option>
                            <option value="Tinggi">Keyakinan Tinggi</option>
                            <option value="Sedang">Keyakinan Sedang</option>
                            <option value="Rendah">Keyakinan Rendah</option>
                        </select>

                        {/* Filter Urgensi */}
                        <select
                            className="h-7 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs text-muted-foreground"
                            value={filterUrgency}
                            onChange={(e) => { setFilterUrgency(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all">Semua Status</option>
                            {type === 'stock' && <option value="critical">Kritis / Habis (≤7h)</option>}
                            {type === 'stock' && <option value="low">Menipis (8–15h)</option>}
                            {type === 'opex' && <option value="critical">Terlewat / Hari Ini</option>}
                            {type === 'opex' && <option value="low">Segera (≤7h)</option>}
                        </select>

                        {/* Reset Filter */}
                        {hasActiveFilter && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="flex h-7 items-center gap-1 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-3" />
                                Reset
                            </button>
                        )}

                        {/* Badge hasil filter */}
                        {hasActiveFilter && (
                            <span className="text-xs text-muted-foreground">
                                {totalItems} dari {data.length} item
                            </span>
                        )}
                    </div>
                )}
            </CardHeader>

            <CardContent className="flex-1 p-0">
                {loading && (
                    <div className="space-y-3 p-4">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                )}
                {!loading && error && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive">
                        <span>{error}</span>
                        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                            Coba lagi
                        </Button>
                    </div>
                )}
                {!loading && !error && data.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">
                        Belum ada histori yang cukup untuk membuat rekomendasi.
                    </p>
                )}
                {!loading && !error && data.length > 0 && totalItems === 0 && (
                    <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                        <Search className="size-8 opacity-30" />
                        <p>Tidak ada item yang cocok dengan filter.</p>
                        <button type="button" onClick={resetFilters} className="text-xs text-primary underline underline-offset-2">
                            Reset filter
                        </button>
                    </div>
                )}
                {!loading && !error && totalItems > 0 && (
                    <>
                        {/* ── 4: Card View ── */}
                        {viewMode === 'card' && (
                            <div className="divide-y">
                                {displayedData.map((item, index) => {
                                    const urgency = getUrgencyBadge(type, item);
                                    // ── 1: Estimasi biaya per item ──
                                    const estCost = (type === 'stock' && Number(item.suggested_qty) > 0 && Number(item.latest_landed_cost) > 0)
                                        ? Number(item.suggested_qty) * Number(item.latest_landed_cost)
                                        : null;
                                    return (
                                        <div
                                            key={`${type}-${item.material_code ?? item.material}-${(safePage - 1) * pageSize + index}`}
                                            className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium break-words">{item.material}</p>

                                                    {/* ── 3: Urgency badge ── */}
                                                    {urgency && (
                                                        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${urgency.color}`}>
                                                            <AlertTriangle className="size-3 shrink-0" />
                                                            {urgency.label}
                                                        </span>
                                                    )}

                                                    {item.stock_matched === false && (
                                                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                                            Stok belum terverifikasi
                                                        </span>
                                                    )}
                                                    {item.stock_matched !== false && item.current_stock !== undefined && (
                                                        <span
                                                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                                                item.current_stock <= 0
                                                                    ? 'bg-destructive/10 text-destructive'
                                                                    : (item.days_of_inventory !== undefined && item.days_of_inventory <= 15)
                                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                    : 'bg-muted text-muted-foreground'
                                                            }`}
                                                        >
                                                            Stok Gudang: {formatNumber(item.current_stock)} {item.unit}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {(item.reasons ?? []).join(' • ')}
                                                </p>
                                                {type === 'stock' && item.backtest_inventory_proxy && (
                                                    <p
                                                        className="mt-1 text-xs text-muted-foreground"
                                                        title="Selisih prediksi dan penjualan nyata pada periode uji 30 hari. Ini bukan kejadian stok habis atau stok berlebih yang terukur."
                                                    >
                                                        Uji {item.backtest_periods} periode: kurang prediksi{' '}
                                                        {formatNumber(item.backtest_inventory_proxy.under_units)} {item.unit}; lebih prediksi{' '}
                                                        {formatNumber(item.backtest_inventory_proxy.over_units)} {item.unit}.
                                                    </p>
                                                )}
                                                {type === 'stock' && item.historical_stock_pr?.events > 0 && (
                                                    <p
                                                        className="mt-1 text-xs text-muted-foreground"
                                                        title="Jumlah PR stok dibanding penjualan 30 hari berikutnya. Stok fisik pada tanggal PR tidak tersedia."
                                                    >
                                                        PR stok historis {item.historical_stock_pr.events} kali: diminta{' '}
                                                        {formatNumber(item.historical_stock_pr.requested_units)} {item.unit}; terjual 30 hari berikutnya{' '}
                                                        {formatNumber(item.historical_stock_pr.sales_next_30d_units)} {item.unit}.
                                                    </p>
                                                )}
                                                {type === 'stock' && item.latest_landed_cost > 0 && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Landed cost: {formatRupiah(item.latest_landed_cost)}
                                                        {item.saving_percent > 0 ? ` · ${item.saving_percent}% di bawah median` : ''}
                                                        {/* ── 1: Estimasi biaya per item ── */}
                                                        {estCost !== null && (
                                                            <span className="ml-2 font-medium text-primary">
                                                                → Est. {formatRupiah(estCost)}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                                {type === 'opex' && item.predicted_date && (
                                                    <p
                                                        className={`mt-1 text-xs ${
                                                            item.days_until < 0
                                                                ? 'font-medium text-destructive'
                                                                : item.days_until <= 7
                                                                ? 'font-medium text-amber-600 dark:text-amber-400'
                                                                : 'text-muted-foreground'
                                                        }`}
                                                    >
                                                        {item.days_until < 0
                                                            ? `Terlewat ${Math.abs(item.days_until)} hari dari siklus (${item.predicted_date})`
                                                            : item.days_until === 0
                                                            ? `Jatuh tempo HARI INI (${item.predicted_date})`
                                                            : `Prediksi kebutuhan: ${item.predicted_date} (${item.days_until} hari lagi)`}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-start gap-2 sm:flex-col sm:items-end">
                                                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                                    Skor {item.score}
                                                </span>
                                                {item.confidence && (
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                                                            item.confidence === 'Tinggi'
                                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                                : item.confidence === 'Sedang'
                                                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                                  : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        Keyakinan {item.confidence}
                                                    </span>
                                                )}
                                                <span className="text-sm font-semibold whitespace-nowrap">
                                                    Saran:{' '}
                                                    {item.suggested_qty === null || item.suggested_qty === undefined
                                                        ? 'Perlu ditinjau'
                                                        : `${formatNumber(item.suggested_qty)} ${item.unit}`}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── 4: Table View ── */}
                        {viewMode === 'table' && (
                            <div className="overflow-x-auto">
                                <table className="w-full table-auto text-xs">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Material</th>
                                            {type === 'stock' && <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Stok Gudang</th>}
                                            {type === 'stock' && <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Landed Cost</th>}
                                            {type === 'opex' && <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Prediksi Kebutuhan</th>}
                                            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Saran Qty</th>
                                            {type === 'stock' && <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Est. Anggaran</th>}
                                            <th className="px-3 py-2 text-center font-medium">Skor</th>
                                            <th className="px-3 py-2 text-center font-medium">Keyakinan</th>
                                            <th className="px-3 py-2 text-center font-medium">Urgensi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {displayedData.map((item, index) => {
                                            const urgency = getUrgencyBadge(type, item);
                                            const estCost = (type === 'stock' && Number(item.suggested_qty) > 0 && Number(item.latest_landed_cost) > 0)
                                                ? Number(item.suggested_qty) * Number(item.latest_landed_cost)
                                                : null;
                                            return (
                                                <tr
                                                    key={`${type}-tbl-${item.material_code ?? item.material}-${(safePage - 1) * pageSize + index}`}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="max-w-[200px] px-3 py-2">
                                                        <p className="truncate font-medium" title={item.material}>{item.material}</p>
                                                        {item.material_code && (
                                                            <p className="text-[10px] text-muted-foreground">{item.material_code}</p>
                                                        )}
                                                    </td>
                                                    {type === 'stock' && (
                                                        <td className={`px-3 py-2 text-right whitespace-nowrap ${item.current_stock <= 0 ? 'font-medium text-destructive' : ''}`}>
                                                            {item.current_stock !== undefined
                                                                ? `${formatNumber(item.current_stock)} ${item.unit}`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {type === 'stock' && (
                                                        <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                                                            {item.latest_landed_cost > 0 ? formatRupiah(item.latest_landed_cost) : '-'}
                                                        </td>
                                                    )}
                                                    {type === 'opex' && (
                                                        <td className={`px-3 py-2 text-center whitespace-nowrap ${item.days_until < 0 ? 'font-medium text-destructive' : item.days_until <= 7 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                                            {item.predicted_date
                                                                ? item.days_until < 0
                                                                    ? `Terlewat ${Math.abs(item.days_until)}h`
                                                                    : item.days_until === 0
                                                                    ? 'Hari Ini!'
                                                                    : `${item.predicted_date} (${item.days_until}h)`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                                        {item.suggested_qty === null || item.suggested_qty === undefined
                                                            ? 'Perlu ditinjau'
                                                            : `${formatNumber(item.suggested_qty)} ${item.unit}`}
                                                    </td>
                                                    {type === 'stock' && (
                                                        <td className="px-3 py-2 text-right font-medium text-primary whitespace-nowrap">
                                                            {estCost !== null ? formatRupiah(estCost) : '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-center">
                                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                            {item.score}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {item.confidence ? (
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                                    item.confidence === 'Tinggi'
                                                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                                        : item.confidence === 'Sedang'
                                                                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                                          : 'bg-muted text-muted-foreground'
                                                                }`}
                                                            >
                                                                {item.confidence}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {urgency ? (
                                                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${urgency.color}`}>
                                                                <AlertTriangle className="size-3 shrink-0" />
                                                                {urgency.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">–</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 p-3 text-xs text-muted-foreground">
                            <span>
                                Menampilkan{' '}
                                {Math.min((safePage - 1) * pageSize + 1, totalItems)}
                                –
                                {Math.min(safePage * pageSize, totalItems)}{' '}
                                dari {totalItems} data
                                {hasActiveFilter && ` (filter aktif dari ${data.length} total)`}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={safePage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span>Halaman {safePage} dari {totalPages}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={safePage >= totalPages}
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

const parseFlexibleDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;

    const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
        const date = new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3]),
        );
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dmy) {
        const year =
            String(dmy[3]).length === 2
                ? Number(`20${dmy[3]}`)
                : Number(dmy[3]);
        const date = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isInDateFilter = (value, filter, startDate, endDate) => {
    if (filter === 'all') return true;

    const date = parseFlexibleDate(value);
    if (!date) return false;

    const normalized = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'today') {
        return normalized.getTime() === today.getTime();
    }

    if (filter === 'this_week') {
        const day = today.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const start = new Date(today);
        start.setDate(today.getDate() - diffToMonday);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return normalized >= start && normalized <= end;
    }

    if (filter === 'this_month') {
        return (
            normalized.getMonth() === today.getMonth() &&
            normalized.getFullYear() === today.getFullYear()
        );
    }

    if (filter === 'this_year') {
        return normalized.getFullYear() === today.getFullYear();
    }

    if (filter === 'range') {
        const start = parseFlexibleDate(startDate);
        const end = parseFlexibleDate(endDate);
        if (!start || !end) return false;
        const normalizedStart = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
        );
        const normalizedEnd = new Date(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
        );
        return normalized >= normalizedStart && normalized <= normalizedEnd;
    }

    return true;
};

function PrFulfillmentPanel({ details }) {
    return (
        <section className="space-y-3 rounded-xl border border-sidebar-border/70 p-3">
            <h3 className="font-semibold">Progress PR ke PO</h3>
            <p className="text-xs text-muted-foreground">
                Kuantitas dipisahkan per material dan satuan. Progress mengikuti
                sisa PR yang tercatat.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
                {details.map((detail, index) => {
                    const progress = getPrProgress(detail);
                    return (
                        <div
                            key={`${detail.no}-${index}`}
                            className="rounded-lg border p-3 text-sm"
                        >
                            <p className="font-medium">
                                {detail.material || '-'}
                            </p>
                            <p>
                                Diproses {formatNumber(progress.processed)} /{' '}
                                {formatNumber(progress.qty)} {detail.unit} ?
                                Sisa {formatNumber(progress.remaining)}{' '}
                                {detail.unit}
                            </p>
                            <progress
                                className="mt-2 h-2 w-full"
                                value={progress.percent}
                                max={100}
                                aria-label={`Progress PO ${detail.material}`}
                            />
                            <p className="text-xs text-muted-foreground">
                                {progress.percent}% diproses
                            </p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default function PurchaseRequirementIndex({
    purchaseRequirements = [],
    outstandingCount = 0,
    sisaPoCount = 0,
    realizedCount = 0,
    outstandingTotal = 0,
    sisaPoTotal = 0,
    realizedTotal = 0,
    period = 'today',
    realtimeChannel = null,
}) {
    const { auth, tenant } = usePage().props;
    const preferenceKey = `pr-filters:${tenant?.database ?? auth?.user?.database ?? 'default'}:${auth?.user?.kd_user ?? auth?.user?.username ?? 'user'}`;
    const savedFilters = useMemo(() => {
        try {
            return readPrFilters(localStorage, preferenceKey);
        } catch {
            return {};
        }
    }, [preferenceKey]);
    const requests = useRef(Object.fromEntries(['table', 'summary', 'detail', 'outstanding', 'sisa', 'realized'].map(key => [key, createLatestRequest()])));
    const [tableError, setTableError] = useState('');
    const [summaryError, setSummaryError] = useState('');
    const [serverPages, setServerPages] = useState({});
    const paginationContexts = useRef({});
    const [searchTerm, setSearchTerm] = useState(String(savedFilters.search ?? ''));
    const [activeTab, setActiveTab] = useState('customer');
    const [stockInsights, setStockInsights] = useState([]);
    const [opexInsights, setOpexInsights] = useState([]);
    const [stockInsightLoading, setStockInsightLoading] = useState(false);
    const [opexInsightLoading, setOpexInsightLoading] = useState(false);
    const [stockInsightError, setStockInsightError] = useState('');
    const [opexInsightError, setOpexInsightError] = useState('');
    const insightLoadedRef = useRef({ stock: false, opex: false });
    const [realtimeRevision, setRealtimeRevision] = useState(0);

    useEffect(() => subscribeToPoInChanges(
        realtimeChannel,
        () => {
            // Known totals must be recomputed after another user's mutation.
            Object.values(requests.current).forEach((request) => request.cancel());
            paginationContexts.current = {};
            insightLoadedRef.current = { stock: false, opex: false };
            detailFresh.current = true;
            setRealtimeRevision((revision) => revision + 1);
        },
        'purchase-requirement.changed',
    ), [realtimeChannel]);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [purchaseRequirementsList, setPurchaseRequirementsList] = useState(
        [],
    );

    const [statusFilter, setStatusFilter] = useState(['all', 'outstanding', 'sisa_po', 'realized'].includes(savedFilters.status) ? savedFilters.status : 'outstanding');
    const [tableDateFilter, setTableDateFilter] = useState(['all', 'today', 'this_week', 'this_month', 'this_year', 'range'].includes(savedFilters.period) ? savedFilters.period : 'all');
    const [tableStartDate, setTableStartDate] = useState(savedFilters.startDate ?? '');
    const [tableEndDate, setTableEndDate] = useState(savedFilters.endDate ?? '');
    const [periodFilter, setPeriodFilter] = useState(period ?? 'today');

    const [outstandingCountState, setOutstandingCountState] =
        useState(outstandingCount);
    const [outstandingTotalState, setOutstandingTotalState] =
        useState(outstandingTotal);
    const [sisaPoCountState, setSisaPoCountState] = useState(sisaPoCount);
    const [sisaPoTotalState, setSisaPoTotalState] = useState(sisaPoTotal);
    const [realizedCountState, setRealizedCountState] = useState(realizedCount);
    const [realizedTotalState, setRealizedTotalState] = useState(realizedTotal);

    const [tableLoading, setTableLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [pageSize, setPageSize] = useState(savedFilters.size === 'all' ? Infinity : [5, 10, 25, 50, 100].includes(savedFilters.size) ? savedFilters.size : 5);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedPr, setSelectedPr] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const detailContext = useRef({});
    detailContext.current = { noPr: selectedPr?.no_pr, open: isModalOpen };
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isSisaPoModalOpen, setIsSisaPoModalOpen] = useState(false);
    const [isRealizedModalOpen, setIsRealizedModalOpen] = useState(false);

    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [debouncedOutstandingSearchTerm, setDebouncedOutstandingSearchTerm] =
        useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);

    const [sisaPoSearchTerm, setSisaPoSearchTerm] = useState('');
    const [debouncedSisaPoSearchTerm, setDebouncedSisaPoSearchTerm] =
        useState('');
    const [sisaPoPageSize, setSisaPoPageSize] = useState(5);
    const [sisaPoCurrentPage, setSisaPoCurrentPage] = useState(1);

    const [realizedSearchTerm, setRealizedSearchTerm] = useState('');
    const [debouncedRealizedSearchTerm, setDebouncedRealizedSearchTerm] =
        useState('');
    const [realizedPageSize, setRealizedPageSize] = useState(5);
    const [realizedCurrentPage, setRealizedCurrentPage] = useState(1);

    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [debouncedMaterialSearchTerm, setDebouncedMaterialSearchTerm] =
        useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);

    const [selectedDetails, setSelectedDetails] = useState([]);
    const [detailMeta, setDetailMeta] = useState({ customers: [], pagination: {}, payment: null });
    const [detailReload, setDetailReload] = useState(0);
    const detailFresh = useRef(false);
    const [activeMaterialTab, setActiveMaterialTab] = useState('All Data');
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');

    const [sisaPoList, setSisaPoList] = useState([]);
    const [sisaPoLoading, setSisaPoLoading] = useState(false);
    const [sisaPoError, setSisaPoError] = useState('');

    const [realizedList, setRealizedList] = useState([]);
    const [realizedLoading, setRealizedLoading] = useState(false);
    const [realizedError, setRealizedError] = useState('');

    const [isDeleting, setIsDeleting] = useState(false);
    const [overdueCustomers, setOverdueCustomers] = useState(new Set());
    const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
    const [overdueDialogData, setOverdueDialogData] = useState(null);
    const [overdueDialogLoading, setOverdueDialogLoading] = useState(false);
    const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
    const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

    const loadInsights = useCallback(async (type, force = false) => {
        if (insightLoadedRef.current[type] && !force) return;

        const isStock = type === 'stock';
        const setLoading = isStock
            ? setStockInsightLoading
            : setOpexInsightLoading;
        const setError = isStock ? setStockInsightError : setOpexInsightError;
        const setData = isStock ? setStockInsights : setOpexInsights;

        setLoading(true);
        setError('');
        try {
            const response = await fetch(
                `/marketing/purchase-requirement/insights/${type}`,
                { headers: { Accept: 'application/json' } },
            );
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Gagal memuat rekomendasi.');
            }
            setData(result.recommendations ?? []);
            insightLoadedRef.current[type] = true;
        } catch (error) {
            setError(error.message || 'Gagal memuat rekomendasi.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'insight') return;
        loadInsights('stock');
        loadInsights('opex');
    }, [activeTab, loadInsights, realtimeRevision]);

    const handleOpenOverdueDialog = useCallback(async (customer) => {
        const normalizedCustomer = String(customer ?? '').trim();
        if (!normalizedCustomer) return;

        setOverdueDialogOpen(true);
        setOverdueDialogLoading(true);
        setOverdueDialogData({
            customer: normalizedCustomer,
            total_overdue: 0,
            oldest_overdue_days: 0,
            invoices: [],
        });

        try {
            const params = new URLSearchParams({
                customer: normalizedCustomer,
            });
            const response = await fetch(
                `/marketing/purchase-requirement/overdue-invoices?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Failed to load overdue invoices.');
            }

            setOverdueDialogData(await response.json());
        } catch (error) {
            console.error('Error fetching overdue invoices:', error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal memuat tunggakan',
                text: 'Data tunggakan tagihan customer tidak dapat dimuat.',
            });
            setOverdueDialogOpen(false);
        } finally {
            setOverdueDialogLoading(false);
        }
    }, []);

    const renderCustomerWithOverdueMarker = (customer) => {
        const value = renderValue(customer);
        const hasOverdue = overdueCustomers.has(
            normalizeCustomerName(customer),
        );

        return (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 [overflow-wrap:anywhere] whitespace-normal">
                    {value}
                </span>
                {hasOverdue && (
                    <button
                        type="button"
                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase transition hover:border-red-300 hover:bg-red-100"
                        onClick={() => handleOpenOverdueDialog(customer)}
                        disabled={overdueDialogLoading}
                        title="Lihat tunggakan tagihan > 90 hari"
                    >
                        &gt; 90 hari
                    </button>
                )}
            </div>
        );
    };

    const renderCustomersWithOverdueMarkers = (customers) => {
        const rawList = splitMultiValue(customers);

        if (rawList.length === 0) {
            return renderCustomerWithOverdueMarker(customers);
        }

        // Jika ada lebih dari 1 dengan nama customer yang sama, tampilkan 1 saja
        const seen = new Set();
        const list = [];
        for (const customer of rawList) {
            const key = normalizeCustomerName(customer);
            if (key && !seen.has(key)) {
                seen.add(key);
                list.push(customer);
            }
        }

        return (
            <div className="flex min-w-0 flex-col gap-1">
                {list.map((customer, index) => (
                    <div key={`${customer}-${index}`} className="min-w-0">
                        {renderCustomerWithOverdueMarker(customer)}
                    </div>
                ))}
            </div>
        );
    };

    const renderSeparatedValues = (values) => {
        const list = splitMultiValue(values);

        if (list.length === 0) {
            return renderValue(values);
        }

        return (
            <div className="flex min-w-0 flex-col gap-1">
                {list.map((value, index) => (
                    <div
                        key={`${value}-${index}`}
                        className="min-w-0 [overflow-wrap:anywhere] whitespace-normal"
                    >
                        {value}
                    </div>
                ))}
            </div>
        );
    };

    const renderRefPoValues = (values) => {
        const list = Array.isArray(values)
            ? values
            : String(values ?? '')
                  .split(/\s*,\s*/)
                  .map((item) => item.trim())
                  .filter(Boolean);

        if (list.length === 0) {
            return renderValue(values);
        }

        return (
            <div className="flex min-w-max flex-col gap-1">
                {list.map((value, index) => (
                    <div
                        key={`${value}-${index}`}
                        className="whitespace-nowrap"
                    >
                        {value}
                    </div>
                ))}
            </div>
        );
    };

    useEffect(() => {
        fetch('/penjualan/review-tagihan/overdue-customer-names', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const names = Array.isArray(data?.customers)
                    ? data.customers
                    : [];
                setOverdueCustomers(
                    new Set(names.map((name) => normalizeCustomerName(name))),
                );
            })
            .catch(() => setOverdueCustomers(new Set()));
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedOutstandingSearchTerm(outstandingSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [outstandingSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedSisaPoSearchTerm(sisaPoSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [sisaPoSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedRealizedSearchTerm(realizedSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [realizedSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => {
                setDebouncedMaterialSearchTerm(materialSearchTerm);
                setMaterialCurrentPage(1);
            },
            300,
        );
        return () => clearTimeout(timer);
    }, [materialSearchTerm]);

    const fetchTableData = useCallback(
        async (newPeriod, currentStatus, startDate = '', endDate = '') => {
            const { signal, isCurrent } = requests.current.table.start();
            setTableLoading(true);
            setTableError('');
            setPurchaseRequirementsList([]);
            try {
                const params = new URLSearchParams({
                    period: newPeriod,
                    status: currentStatus,
                    view: activeTab === 'material' ? 'material' : 'customer',
                    fetch_type: 'table',
                    search: debouncedSearchTerm,
                    page: String(currentPage),
                    per_page: pageSize === Infinity ? 'all' : String(pageSize),
                });
                if (newPeriod === 'range') {
                    params.set('start_date', startDate);
                    params.set('end_date', endDate);
                }
                const paginationKey = applyKnownPrTotal(
                    params,
                    paginationContexts.current.table,
                );
                const data = await readPoInResponse(
                    await fetch(`/marketing/purchase-requirement/data?${params}`, {
                        signal,
                        headers: { Accept: 'application/json' },
                        cache: 'no-store',
                    }),
                    'Gagal memuat daftar PR.',
                );
                if (!Array.isArray(data.purchaseRequirements) || !data.pagination)
                    throw new Error('Respons daftar PR tidak lengkap.');
                if (!isCurrent()) return;
                setPurchaseRequirementsList(data.purchaseRequirements);
                paginationContexts.current.table = {
                    key: paginationKey,
                    page: Number(data.pagination.page),
                    total: Number(data.pagination.total),
                };
                setServerPages((prev) => ({ ...prev, table: data.pagination }));
                if (Number(data.pagination.page) !== currentPage)
                    setCurrentPage(Number(data.pagination.page));
            } catch (error) {
                if (isCurrent()) setTableError(error.message);
            } finally {
                if (isCurrent()) setTableLoading(false);
            }
        },
        [activeTab, debouncedSearchTerm, currentPage, pageSize],
    );

    const fetchSummaryData = useCallback(async (newPeriod) => {
        const { signal, isCurrent } = requests.current.summary.start();
        setSummaryError('');
        setSummaryLoading(true);
        try {
            const response = await fetch(
                `/marketing/purchase-requirement/data?period=${newPeriod}&fetch_type=summary`,
                { signal, headers: { Accept: 'application/json' }, cache: 'no-store' },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat ringkasan PR.',
            );
            if (
                ![
                    'outstandingCount',
                    'outstandingTotal',
                    'sisaPoCount',
                    'sisaPoTotal',
                    'realizedCount',
                    'realizedTotal',
                ].every(
                    (key) =>
                        typeof data[key] === 'number' && Number.isFinite(data[key]),
                )
            )
                throw new Error('Respons ringkasan PR tidak lengkap.');
            if (!isCurrent()) return;
            setOutstandingCountState(data.outstandingCount || 0);
            setOutstandingTotalState(data.outstandingTotal || 0);
            setSisaPoCountState(data.sisaPoCount || 0);
            setSisaPoTotalState(data.sisaPoTotal || 0);
            setRealizedCountState(data.realizedCount || 0);
            setRealizedTotalState(data.realizedTotal || 0);
        } catch (error) {
            if (isCurrent()) setSummaryError(error.message);
        } finally {
            if (isCurrent()) setSummaryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummaryData(periodFilter);
        return () => requests.current.summary.cancel();
    }, [periodFilter, fetchSummaryData, realtimeRevision]);

    useEffect(() => {
        requests.current.table.cancel();
        if (activeTab === 'insight') return;
        if (searchTerm !== debouncedSearchTerm) {
            setTableLoading(true);
            setTableError('');
            setPurchaseRequirementsList([]);
            return;
        }
        if (
            tableDateFilter === 'range' &&
            (!tableStartDate || !tableEndDate || tableEndDate < tableStartDate)
        ) {
            setPurchaseRequirementsList([]);
            setTableLoading(false);
            setTableError('Pilih rentang tanggal yang valid.');
            return;
        }
        fetchTableData(tableDateFilter, statusFilter, tableStartDate, tableEndDate);
        return () => requests.current.table.cancel();
    }, [
        activeTab,
        searchTerm,
        debouncedSearchTerm,
        tableDateFilter,
        statusFilter,
        tableStartDate,
        tableEndDate,
        fetchTableData,
        realtimeRevision,
    ]);

    useEffect(() => {
        try {
            localStorage.setItem(
                preferenceKey,
                JSON.stringify({
                    search: searchTerm,
                    status: statusFilter,
                    period: tableDateFilter,
                    startDate: tableStartDate,
                    endDate: tableEndDate,
                    size: pageSize === Infinity ? 'all' : pageSize,
                }),
            );
        } catch {
            /* Storage may be unavailable. */
        }
    }, [
        preferenceKey,
        searchTerm,
        statusFilter,
        tableDateFilter,
        tableStartDate,
        tableEndDate,
        pageSize,
    ]);

    useEffect(
        () => () =>
            Object.values(requests.current).forEach((request) => request.cancel()),
        [],
    );

    useEffect(() => {
        setOutstandingCountState(outstandingCount);
        setOutstandingTotalState(outstandingTotal);
        setSisaPoCountState(sisaPoCount);
        setSisaPoTotalState(sisaPoTotal);
    }, [outstandingCount, outstandingTotal, sisaPoCount, sisaPoTotal]);

    const totalItems = Number(serverPages.table?.total ?? 0);
    const totalPages = Number(serverPages.table?.total_pages ?? 1);
    const displayedPurchaseRequirements = purchaseRequirementsList;
    const outstandingTotalItems = Number(serverPages.outstanding?.total ?? 0);
    const outstandingTotalPages = Number(serverPages.outstanding?.total_pages ?? 1);
    const displayedOutstandingPurchaseRequirements = outstandingList.map(item => ({ ...item, _canDelete: Number(item.can_delete) === 1 }));
    const sisaPoTotalItems = Number(serverPages.sisa?.total ?? 0);
    const sisaPoTotalPages = Number(serverPages.sisa?.total_pages ?? 1);
    const displayedSisaPoPurchaseRequirements = sisaPoList.map(item => ({ ...item, _canDelete: Number(item.can_delete) === 1 }));
    const realizedTotalItems = Number(serverPages.realized?.total ?? 0);
    const realizedTotalPages = Number(serverPages.realized?.total_pages ?? 1);
    const displayedRealizedPurchaseRequirements = realizedList.map(item => ({ ...item, _canDelete: Number(item.can_delete) === 1 }));

    const uniqueCustomerPOs = (detailMeta.customers ?? []).filter(row => row.ref_po).map(row => ({ ref_po: row.ref_po, customer: row.for_customer }));
    const refs = [...new Set(uniqueCustomerPOs.map(row => row.ref_po).filter(Boolean))];
    const materialTabs = refs.length > 1 ? ['All Data', ...refs] : [];
    const materialTotalItems = Number(detailMeta.pagination?.total ?? 0);
    const materialTotalPages = Number(detailMeta.pagination?.total_pages ?? 1);
    const displayedMaterialDetails = selectedDetails;

    const handleOpenModal = (item, options = {}) => {
        requests.current.detail.cancel();
        detailFresh.current = Boolean(options.fresh);
        setSelectedPr(item);
        setIsModalOpen(true);
        setSelectedDetails([]);
        setDetailMeta({ customers: [], pagination: {}, payment: null });
        setActiveMaterialTab('All Data');
        setDetailError('');
        setDetailLoading(true);
        setMaterialSearchTerm('');
        setDebouncedMaterialSearchTerm('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);
        setDetailReload(value => value + 1);
    };

    useEffect(() => {
        if (!isModalOpen || !selectedPr) return;
        if (materialSearchTerm !== debouncedMaterialSearchTerm) {
            requests.current.detail.cancel();
            setDetailLoading(true);
            return;
        }
        const { signal, isCurrent } = requests.current.detail.start();
        setDetailLoading(true);
        setDetailError('');
        const params = new URLSearchParams({
            no_pr: selectedPr.no_pr,
            page: String(materialCurrentPage),
            per_page: materialPageSize === Infinity ? 'all' : String(materialPageSize),
            search: debouncedMaterialSearchTerm,
        });
        if (activeMaterialTab !== 'All Data') params.set('ref_po', activeMaterialTab);
        if (detailFresh.current) params.set('source', 'mysql');
        fetch(`/marketing/purchase-requirement/details?${params.toString()}`, {
            signal,
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                if (!isCurrent()) return;
                if (!Array.isArray(data.purchaseRequirementDetails))
                    throw new Error('Respons detail PR tidak lengkap.');
                setDetailMeta({ customers: data.customers ?? [], pagination: data.pagination ?? {}, payment: data.payment });
                if (data.pagination?.page) setMaterialCurrentPage(data.pagination.page);
                setSelectedDetails(
                    Array.isArray(data?.purchaseRequirementDetails)
                        ? data.purchaseRequirementDetails
                        : [],
                );
            })
            .catch(() => {
                if (isCurrent()) setDetailError('Gagal memuat detail PR.');
            })
            .finally(() => {
                if (isCurrent()) setDetailLoading(false);
            });
        return () => requests.current.detail.cancel();
    }, [isModalOpen, selectedPr?.no_pr, materialCurrentPage, materialPageSize, materialSearchTerm, debouncedMaterialSearchTerm, activeMaterialTab, detailReload, realtimeRevision]);

    const handleRemoveCustomerPo = (refPo) => {
        if (!selectedPr) return;

        Swal.fire({
            title: 'Hapus Customer / PO?',
            text: `Yakin ingin menghapus ${refPo} dari PR ini? Proses ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Memproses...',
                    text: 'Sedang menghapus data dari PR...',
                    didOpen: () => Swal.showLoading(),
                });

                fetch(
                    `/marketing/purchase-requirement/${selectedPr.no_pr}/remove-po/${refPo}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'X-CSRF-TOKEN': document.head.querySelector(
                                'meta[name="csrf-token"]',
                            )?.content,
                            Accept: 'application/json',
                        },
                    },
                )
                    .then((response) =>
                        response.json().then((data) => ({
                            status: response.status,
                            data,
                        })),
                    )
                    .then(({ status, data }) => {
                        if (status >= 400)
                            throw new Error(
                                data.message || 'Gagal menghapus Customer dari PR',
                            );
                        Swal.fire(
                            'Terhapus!',
                            'Customer/PO berhasil dihapus dari PR.',
                            'success',
                        );

                        // Refetch details
                        if (
                            detailContext.current.open &&
                            detailContext.current.noPr === selectedPr.no_pr
                        ) {
                            handleOpenModal(selectedPr, { fresh: true });
                        }
                        fetchSummaryData(periodFilter);
                        fetchTableData(
                            tableDateFilter,
                            statusFilter,
                            tableStartDate,
                            tableEndDate,
                        );
                    })
                    .catch((error) => {
                        Swal.fire('Gagal!', error.message, 'error');
                    });
            }
        });
    };

    const loadPrPage = async (
        group,
        status,
        page,
        size,
        search,
        targetPeriod = 'all',
    ) => {
        const { signal, isCurrent } = requests.current[group].start();
        const setters = {
            outstanding: [
                setOutstandingLoading,
                setOutstandingError,
                setOutstandingList,
                setOutstandingCurrentPage,
            ],
            sisa: [
                setSisaPoLoading,
                setSisaPoError,
                setSisaPoList,
                setSisaPoCurrentPage,
            ],
            realized: [
                setRealizedLoading,
                setRealizedError,
                setRealizedList,
                setRealizedCurrentPage,
            ],
        };
        const [setLoading, setError, setList, setPage] = setters[group];
        setLoading(true);
        setError('');
        setList([]);
        try {
            const params = new URLSearchParams({
                fetch_type: 'table',
                view: 'customer',
                status,
                period: targetPeriod,
                page: String(page),
                per_page: size === Infinity ? 'all' : String(size),
                search,
            });
            if (targetPeriod === 'range') {
                params.set('start_date', tableStartDate);
                params.set('end_date', tableEndDate);
            }
            const paginationKey = applyKnownPrTotal(
                params,
                paginationContexts.current[group],
            );
            const data = await readPoInResponse(
                await fetch(`/marketing/purchase-requirement/data?${params}`, {
                    signal,
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                }),
                'Gagal memuat daftar PR.',
            );
            if (!Array.isArray(data.purchaseRequirements) || !data.pagination)
                throw new Error('Respons daftar PR tidak lengkap.');
            if (!isCurrent()) return;
            setList(data.purchaseRequirements);
            paginationContexts.current[group] = {
                key: paginationKey,
                page: Number(data.pagination.page),
                total: Number(data.pagination.total),
            };
            setServerPages((prev) => ({ ...prev, [group]: data.pagination }));
            if (Number(data.pagination.page) !== page)
                setPage(Number(data.pagination.page));
        } catch (error) {
            if (isCurrent()) setError(error.message);
        } finally {
            if (isCurrent()) {
                setLoading(false);
            }
        }
    };
    const loadOutstanding = () =>
        loadPrPage(
            'outstanding',
            'outstanding',
            outstandingCurrentPage,
            outstandingPageSize,
            debouncedOutstandingSearchTerm,
        );
    const loadSisaPo = () =>
        loadPrPage(
            'sisa',
            'sisa_po',
            sisaPoCurrentPage,
            sisaPoPageSize,
            debouncedSisaPoSearchTerm,
        );
    const loadRealized = (customPeriod) => {
        const next = customPeriod ?? periodFilter;
        return loadPrPage(
            'realized',
            'realized',
            realizedCurrentPage,
            realizedPageSize,
            debouncedRealizedSearchTerm,
            next,
        );
    };
    useEffect(() => {
        if (isOutstandingModalOpen && outstandingSearchTerm !== debouncedOutstandingSearchTerm) {
            requests.current.outstanding.cancel();
            setOutstandingLoading(true);
            setOutstandingList([]);
            return;
        }
        if (isOutstandingModalOpen) loadOutstanding();
        return () => requests.current.outstanding.cancel();
    }, [
        isOutstandingModalOpen,
        outstandingCurrentPage,
        outstandingPageSize,
        outstandingSearchTerm,
        debouncedOutstandingSearchTerm,
        realtimeRevision,
    ]);
    useEffect(() => {
        if (isSisaPoModalOpen && sisaPoSearchTerm !== debouncedSisaPoSearchTerm) {
            requests.current.sisa.cancel();
            setSisaPoLoading(true);
            setSisaPoList([]);
            return;
        }
        if (isSisaPoModalOpen) loadSisaPo();
        return () => requests.current.sisa.cancel();
    }, [
        isSisaPoModalOpen,
        sisaPoCurrentPage,
        sisaPoPageSize,
        sisaPoSearchTerm,
        debouncedSisaPoSearchTerm,
        realtimeRevision,
    ]);
    useEffect(() => {
        if (isRealizedModalOpen && realizedSearchTerm !== debouncedRealizedSearchTerm) {
            requests.current.realized.cancel();
            setRealizedLoading(true);
            setRealizedList([]);
            return;
        }
        if (isRealizedModalOpen) loadRealized(periodFilter);
        return () => requests.current.realized.cancel();
    }, [
        isRealizedModalOpen,
        realizedCurrentPage,
        realizedPageSize,
        realizedSearchTerm,
        debouncedRealizedSearchTerm,
        periodFilter,
        realtimeRevision,
    ]);
    useEffect(() => {
        if (!isModalOpen) requests.current.detail.cancel();
    }, [isModalOpen]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        pageSize,
        searchTerm,
        statusFilter,
        tableDateFilter,
        tableStartDate,
        tableEndDate,
    ]);
    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);
    useEffect(() => {
        setSisaPoCurrentPage(1);
    }, [sisaPoPageSize, sisaPoSearchTerm]);
    useEffect(() => {
        setRealizedCurrentPage(1);
    }, [realizedPageSize, realizedSearchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages)
            setOutstandingCurrentPage(outstandingTotalPages);
    }, [outstandingCurrentPage, outstandingTotalPages]);
    useEffect(() => {
        if (sisaPoCurrentPage > sisaPoTotalPages)
            setSisaPoCurrentPage(sisaPoTotalPages);
    }, [sisaPoCurrentPage, sisaPoTotalPages]);
    useEffect(() => {
        if (realizedCurrentPage > realizedTotalPages)
            setRealizedCurrentPage(realizedTotalPages);
    }, [realizedCurrentPage, realizedTotalPages]);

    const showToast = (message, variant = 'error') => {
        if (!message) return;
        Swal.fire({
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false,
            icon: variant === 'success' ? 'success' : 'error',
            title: message,
        });
    };

    const handleDelete = (noPr) => {
        if (!noPr || isDeleting) return;

        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement) activeEl.blur();

        setIsOutstandingModalOpen(false);

        Swal.fire({
            title: 'Hapus PR?',
            text: `PR ${noPr} akan dipindahkan ke arsip lalu dihapus.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            allowEscapeKey: () => !Swal.isLoading(),
            preConfirm: () => {
                return new Promise((resolve) => {
                    let isSuccess = false;
                    router.delete(
                        `/marketing/purchase-requirement/${encodeURIComponent(noPr)}`,
                        {
                            preserveScroll: true,
                            onStart: () => setIsDeleting(true),
                            onSuccess: (page) => {
                                if (
                                    page.props?.flash?.error ||
                                    !page.props?.flash?.success
                                ) {
                                    Swal.showValidationMessage(
                                        page.props?.flash?.error ||
                                            'Server belum mengonfirmasi penghapusan PR.',
                                    );
                                    resolve(false);
                                    return;
                                }
                                isSuccess = true;
                                resolve(page.props);
                            },
                            onError: (errors) => {
                                const firstError = Object.values(errors)[0];
                                Swal.showValidationMessage(
                                    firstError || 'Gagal menghapus data PR.',
                                );
                                resolve(false);
                            },
                            onFinish: () => {
                                setIsDeleting(false);
                                if (!isSuccess) {
                                    Swal.showValidationMessage(
                                        'Penghapusan belum dikonfirmasi server. Silakan coba lagi.',
                                    );
                                    resolve(false);
                                }
                            },
                        },
                    );
                });
            },
        }).then((result) => {
            if (!result.isConfirmed) return;
            setOutstandingList((prev) =>
                prev.filter((item) => item.no_pr !== noPr),
            );
            setSisaPoList((prev) => prev.filter((item) => item.no_pr !== noPr));
            setPurchaseRequirementsList((prev) =>
                prev.filter((item) => item.no_pr !== noPr),
            );
            fetchSummaryData(periodFilter);
            fetchTableData(
                tableDateFilter,
                statusFilter,
                tableStartDate,
                tableEndDate,
            );
            showToast('PR berhasil dihapus.', 'success');
        });
    };

    return (
        <>
            <Head title="Purchase Requirement" />
            {summaryError && <div role="alert" className="m-4 rounded-lg border border-destructive/40 p-3 text-sm"><p>{summaryError}</p><Button variant="outline" size="sm" onClick={() => fetchSummaryData(periodFilter)}>Coba lagi ringkasan</Button></div>}
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Purchase Requirement
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar PR
                        </p>
                    </div>
                    <MenuAction
                        action="create"
                        type="button"
                        onClick={() =>
                            router.visit(
                                '/marketing/purchase-requirement/create',
                            )
                        }
                    >
                        Tambah PR
                    </MenuAction>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOutstandingModalOpen(true);
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-amber-500/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                    <ClipboardCheck className="size-4 text-amber-600" />
                                </div>
                                <CardDescription className="text-xs tracking-wide uppercase">
                                    PR Outstanding
                                </CardDescription>
                                <CardTitle className="text-2xl font-semibold">
                                    {summaryError ? '-' : summaryLoading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        outstandingCountState
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Belum ada material dibuat PO
                                </p>
                                <div className="mt-1 text-sm font-semibold">
                                    {summaryError ? '-' : summaryLoading ? (
                                        <Skeleton className="h-5 w-24" />
                                    ) : (
                                        formatRupiah(outstandingTotalState || 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsSisaPoModalOpen(true);
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-rose-500/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                    <AlertCircle className="size-4 text-rose-600" />
                                </div>
                                <CardDescription className="text-xs tracking-wide uppercase">
                                    PR Sisa PO
                                </CardDescription>
                                <CardTitle className="text-2xl font-semibold">
                                    {summaryError ? '-' : summaryLoading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        sisaPoCountState
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Masih ada sisa material belum dibuat PO
                                </p>
                                <div className="mt-1 text-sm font-semibold">
                                    {summaryError ? '-' : summaryLoading ? (
                                        <Skeleton className="h-5 w-24" />
                                    ) : (
                                        formatRupiah(sisaPoTotalState || 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </button>

                    <Card
                        className="cursor-pointer transition hover:border-emerald-500/60 hover:shadow-md"
                        onClick={() => {
                            setIsRealizedModalOpen(true);
                        }}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                        <ShieldCheck className="size-4 text-emerald-600" />
                                    </div>
                                    <CardDescription className="text-xs tracking-wide uppercase">
                                        PR Terealisasi
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold">
                                        {summaryError ? '-' : summaryLoading ? (
                                            <Skeleton className="h-8 w-16" />
                                        ) : (
                                            realizedCountState
                                        )}
                                    </CardTitle>
                                    <div className="mt-1 text-sm font-semibold">
                                        {summaryError ? '-' : summaryLoading ? (
                                            <Skeleton className="h-5 w-24" />
                                        ) : (
                                            formatRupiah(realizedTotalState)
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="flex flex-col items-end gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <select
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs shadow-sm"
                                        value={periodFilter}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPeriodFilter(val);
                                            setRealizedCurrentPage(1);
                                        }}
                                    >
                                        <option value="today">Hari Ini</option>
                                        <option value="this_week">
                                            Minggu Ini
                                        </option>
                                        <option value="this_month">
                                            Bulan Ini
                                        </option>
                                        <option value="this_year">
                                            Tahun Ini
                                        </option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsRealizedModalOpen(true);
                                                        }}
                                        title="Lihat daftar PR terealisasi"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                Semua material sudah dibuat PO
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex w-full gap-1 rounded-lg border border-sidebar-border/70 bg-muted/30 p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('customer')}
                            className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === 'customer' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            Data PR Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('material')}
                            className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === 'material' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            Data PR Material
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!insightLoadedRef.current.stock) {
                                    setStockInsightLoading(true);
                                }
                                if (!insightLoadedRef.current.opex) {
                                    setOpexInsightLoading(true);
                                }
                                setActiveTab('insight');
                            }}
                            className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === 'insight' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            Insight & Recommendation
                        </button>
                    </div>
                    <div
                        className={`flex flex-wrap items-center gap-3 ${
                            activeTab === 'insight' ? 'hidden' : ''
                        }`}
                    >
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={pageSize === Infinity ? 'all' : pageSize}
                                onChange={(e) =>
                                    setPageSize(
                                        e.target.value === 'all'
                                            ? Infinity
                                            : Number(e.target.value),
                                    )
                                }
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Status
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="all">Semua Data</option>
                                <option value="outstanding">
                                    PR Outstanding
                                </option>
                                <option value="sisa_po">PR Sisa PO</option>
                                <option value="realized">PR Terealisasi</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Tanggal
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={tableDateFilter}
                                onChange={(event) =>
                                    setTableDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </label>
                        {tableDateFilter === 'range' && (
                            <>
                                <label className="text-sm text-muted-foreground">
                                    Dari
                                    <input
                                        type="date"
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={tableStartDate}
                                        onChange={(event) =>
                                            setTableStartDate(
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                                <label className="text-sm text-muted-foreground">
                                    Sampai
                                    <input
                                        type="date"
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={tableEndDate}
                                        onChange={(event) =>
                                            setTableEndDate(event.target.value)
                                        }
                                    />
                                </label>
                            </>
                        )}
                    </div>
                    <label
                        className={`text-sm text-muted-foreground ${
                            activeTab === 'insight' ? 'hidden' : ''
                        }`}
                    >
                        Cari
                        <input
                            type="search"
                            className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                            placeholder={
                                activeTab === 'material'
                                    ? 'Cari material...'
                                    : 'Cari customer, no PR, ref PO...'
                            }
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                        />
                    </label>
                </div>

                {activeTab === 'insight' ? (
                    <section className="w-full space-y-4">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <h2 className="flex items-center gap-2 font-semibold">
                                <BrainCircuit className="size-5 text-primary" />
                                Rekomendasi Purchase Requirement
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Dihitung dari tren penjualan, landed cost PO
                                termasuk alokasi biaya kirim, dan pola pembelian
                                PR Opex.
                            </p>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                            <InsightRecommendationPanel
                                title="PR For Stock"
                                description="Material berpeluang dijadikan stok berdasarkan demand dan landed cost."
                                data={stockInsights}
                                loading={stockInsightLoading}
                                error={stockInsightError}
                                onRetry={() => loadInsights('stock', true)}
                                type="stock"
                            />
                            <InsightRecommendationPanel
                                title="PR For Opex"
                                description="Prediksi kebutuhan operasional dari pola interval pembelian Opex."
                                data={opexInsights}
                                loading={opexInsightLoading}
                                error={opexInsightError}
                                onRetry={() => loadInsights('opex', true)}
                                type="opex"
                            />
                        </div>
                    </section>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-px px-1 py-3 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-px px-1 py-3 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        {activeTab === 'material' ? (
                                            <>
                                                <th className="px-1 py-3 text-left">
                                                    Ref PO
                                                </th>
                                                <th className="px-1 py-3 text-left">
                                                    Customer
                                                </th>
                                                <th className="px-1 py-3 text-left">
                                                    Material
                                                </th>
                                                <th className="px-1 py-3 text-right">
                                                    Qty
                                                </th>
                                                <th className="px-1 py-3 text-right">
                                                    Sisa PR
                                                </th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="w-[40%] min-w-72 px-1 py-3 text-left">
                                                    Customer
                                                </th>
                                                <th className="w-max px-2 py-3 text-left whitespace-nowrap">
                                                    Ref PO
                                                </th>
                                                <th className="px-2 py-3 text-left">
                                                    Jenis PR
                                                </th>
                                                <th className="w-28 px-2 py-3 text-left">
                                                    Action
                                                </th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        error={tableError}
                                        onRetry={() => fetchTableData(tableDateFilter, statusFilter, tableStartDate, tableEndDate)}
                                        columns={
                                            activeTab === 'material' ? 8 : 5
                                        }
                                        loading={
                                            tableLoading &&
                                            displayedPurchaseRequirements.length ===
                                                0
                                        }
                                        isEmpty={
                                            !tableLoading &&
                                            displayedPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage="Belum ada data PR."
                                    />
                                    {displayedPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`${activeTab}-${item.no_pr}-${item.material ?? ''}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-px px-1 py-3 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-px px-1 py-3 whitespace-nowrap">
                                                    {item.date}
                                                </td>
                                                {activeTab === 'material' ? (
                                                    <>
                                                        <td className="px-1 py-3 whitespace-nowrap">
                                                            {item.ref_po ?? '-'}
                                                        </td>
                                                        <td className="px-1 py-3">
                                                            {renderCustomersWithOverdueMarkers(
                                                                item.for_customer,
                                                            )}
                                                        </td>
                                                        <td className="px-1 py-3">
                                                            {item.material ??
                                                                '-'}
                                                        </td>
                                                        <td className="px-1 py-3 text-right whitespace-nowrap">
                                                            {item.qty ?? 0}{' '}
                                                            {item.unit ?? ''}
                                                        </td>
                                                        <td className="px-1 py-3 text-right whitespace-nowrap">
                                                            {item.sisa_pr ?? 0}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="w-[40%] min-w-72 px-1 py-3 align-top [overflow-wrap:anywhere] whitespace-normal">
                                                            {renderCustomersWithOverdueMarkers(
                                                                item.for_customer,
                                                            )}
                                                        </td>
                                                        <td className="w-max px-2 py-3 align-top whitespace-nowrap">
                                                            {renderRefPoValues(
                                                                item.ref_po,
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-3 align-top text-sm [overflow-wrap:anywhere] whitespace-normal">
                                                            {item.jenis_pr ??
                                                                '-'}
                                                        </td>
                                                        <td className="w-28 px-2 py-3 align-top whitespace-nowrap">
                                                            <div className="flex min-w-max items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleOpenModal(
                                                                            item,
                                                                        )
                                                                    }
                                                                    className="text-muted-foreground transition hover:text-foreground"
                                                                    title="Lihat"
                                                                >
                                                                    <Eye className="size-4" />
                                                                </button>
                                                                <a
                                                                    href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/print`}
                                                                    className="text-muted-foreground transition hover:text-foreground"
                                                                    title="Cetak"
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    <Printer className="size-4" />
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {pageSize !== Infinity && totalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (currentPage - 1) * pageSize + 1,
                                        totalItems,
                                    )}
                                    -
                                    {Math.min(
                                        currentPage * pageSize,
                                        totalItems,
                                    )}{' '}
                                    dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={currentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {currentPage} dari {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.min(totalPages, page + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            requests.current.detail.cancel();
                            setSelectedPr(null);
                            setSelectedDetails([]);
                            setDetailError('');
                            setDetailLoading(false);
                            setMaterialPageSize(5);
                            setMaterialCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>
                                Detail Purchase Requirement
                            </DialogTitle>
                            <DialogDescription>
                                Menampilkan informasi header dan material pada
                                PR.
                            </DialogDescription>
                        </DialogHeader>

                        {!selectedPr && (
                            <p className="text-sm text-muted-foreground">
                                Data tidak tersedia.
                            </p>
                        )}

                        {selectedPr && (
                            <div className="flex flex-col gap-6 text-sm">
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            No PR
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.no_pr)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Date
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.date)}
                                        </span>
                                    </div>
                                    {uniqueCustomerPOs.length > 1 ? (
                                        <div className="mt-2 grid grid-cols-[150px_1fr] items-start gap-2">
                                            <span className="mt-2 text-muted-foreground">
                                                Customer / PO
                                            </span>
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {uniqueCustomerPOs.map((po) => (
                                                    <div
                                                        key={po.ref_po}
                                                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium break-words whitespace-normal">
                                                                {po.ref_po}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground uppercase">
                                                                {renderCustomerWithOverdueMarker(
                                                                    po.customer,
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Customer
                                                </span>
                                                <div>
                                                    {renderCustomersWithOverdueMarkers(
                                                        selectedPr.for_customer,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Ref PO
                                                </span>
                                                <span className="[overflow-wrap:anywhere] break-words whitespace-normal">
                                                    {renderValue(
                                                        selectedPr.ref_po,
                                                    )}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {selectedPr.jenis_pr && (
                                        <div className="grid grid-cols-[150px_1fr] gap-2">
                                            <span className="text-muted-foreground">
                                                Jenis PR
                                            </span>
                                            <span className="font-medium text-primary">
                                                {selectedPr.jenis_pr}
                                            </span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Payment Term
                                        </span>
                                        <span>
                                            {getValue(selectedPr, [
                                                'payment',
                                                'Payment',
                                                'payment_term',
                                            ]) !== '-'
                                                ? getValue(selectedPr, [
                                                      'payment',
                                                      'Payment',
                                                      'payment_term',
                                                  ])
                                                : getValue(
                                                      { payment: detailMeta.payment },
                                                      [
                                                          'payment',
                                                          'Payment',
                                                          'payment_term',
                                                      ],
                                                  )}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">
                                        Data Material
                                    </h3>
                                    {!detailLoading && !detailError && <>
                                        <PrFulfillmentPanel details={displayedMaterialDetails} />
                                        <PrOrderHistory key={selectedPr.no_pr} noPr={selectedPr.no_pr} />
                                    </>}
                                    {materialTabs.length > 0 && (
                                        <div className="mt-2 mb-2 flex border-b border-sidebar-border/70">
                                            {materialTabs.map((tab) => (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveMaterialTab(
                                                            tab,
                                                        );
                                                        setMaterialCurrentPage(
                                                            1,
                                                        );
                                                    }}
                                                    className={`-mb-[1px] border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                                                        activeMaterialTab ===
                                                        tab
                                                            ? 'border-primary text-foreground'
                                                            : 'border-transparent text-muted-foreground hover:border-sidebar-border hover:text-foreground'
                                                    }`}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-sm text-muted-foreground">
                                            Tampilkan
                                            <select
                                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                                value={
                                                    materialPageSize ===
                                                    Infinity
                                                        ? 'all'
                                                        : materialPageSize
                                                }
                                                onChange={(event) => {
                                                    const value =
                                                        event.target.value;
                                                    setMaterialPageSize(
                                                        value === 'all'
                                                            ? Infinity
                                                            : Number(value),
                                                    );
                                                    setMaterialCurrentPage(1);
                                                }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value="all">
                                                    Semua
                                                </option>
                                            </select>
                                        </label>
                                        <label className="text-sm text-muted-foreground">
                                            Cari Material
                                            <input
                                                type="search"
                                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                                placeholder="Cari material..."
                                                value={materialSearchTerm}
                                                onChange={(event) =>
                                                    setMaterialSearchTerm(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-14 px-2 py-3 text-left align-top"
                                                    >
                                                        No
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-2 py-3 text-left align-top"
                                                    >
                                                        Material
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-px px-2 py-3 text-left align-top whitespace-nowrap"
                                                    >
                                                        Qty
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-px px-2 py-3 text-left align-top whitespace-nowrap"
                                                    >
                                                        Sisa PR
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="border-b border-sidebar-border/70 px-2 py-2 text-center"
                                                    >
                                                        Price In
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-[1%] px-2 py-3 text-right align-top whitespace-nowrap"
                                                    >
                                                        Margin
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-[1%] px-2 py-3 text-right align-top whitespace-nowrap"
                                                    >
                                                        Stok
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-2 py-3 text-left align-top"
                                                    >
                                                        Remark
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th className="w-[1%] border-r border-sidebar-border/70 px-2 py-2 text-right whitespace-nowrap">
                                                        PO
                                                    </th>
                                                    <th className="w-[1%] px-2 py-2 text-right whitespace-nowrap">
                                                        Estimate
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <PlainTableStateRows
                                                    error={detailError}
                                                    onRetry={() => handleOpenModal(selectedPr)}
                                                    loading={detailLoading}
                                                    columns={9}
                                                    rows={5}
                                                    isEmpty={
                                                        !detailLoading &&
                                                        displayedMaterialDetails.length ===
                                                            0
                                                    }
                                                    emptyMessage={
                                                        detailError ||
                                                        'Belum ada data material.'
                                                    }
                                                />
                                                {displayedMaterialDetails.map(
                                                    (detail, index) => (
                                                        <tr
                                                            key={`${detail.no_pr}-${index}`}
                                                            className="border-t border-sidebar-border/70"
                                                        >
                                                            <td className="px-2 py-3">
                                                                {(materialPageSize ===
                                                                Infinity
                                                                    ? index
                                                                    : (materialCurrentPage -
                                                                          1) *
                                                                          materialPageSize +
                                                                      index) +
                                                                    1}
                                                            </td>
                                                            <td className="px-2 py-3">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'material',
                                                                        'Material',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3 whitespace-nowrap">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'qty',
                                                                        'Qty',
                                                                        'quantity',
                                                                        'Quantity',
                                                                    ],
                                                                )}{' '}
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'satuan',
                                                                        'Satuan',
                                                                        'unit',
                                                                        'Unit',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3 whitespace-nowrap">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'sisa_pr',
                                                                        'Sisa_pr',
                                                                        'Sisa_PR',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="w-[1%] border-r border-sidebar-border/70 px-2 py-3 text-right whitespace-nowrap">
                                                                {formatRupiah(
                                                                    getValue(
                                                                        detail,
                                                                        [
                                                                            'price_po',
                                                                        ],
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td className="w-[1%] px-2 py-3 text-right whitespace-nowrap">
                                                                {formatRupiah(
                                                                    getValue(
                                                                        detail,
                                                                        [
                                                                            'unit_price',
                                                                        ],
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td className="w-[1%] px-2 py-3 text-right whitespace-nowrap">
                                                                {renderValue(
                                                                    getValue(
                                                                        detail,
                                                                        [
                                                                            'margin',
                                                                        ],
                                                                    ),
                                                                )}{' '}
                                                                {getValue(
                                                                    detail,
                                                                    ['margin'],
                                                                )
                                                                    ? '%'
                                                                    : ''}
                                                            </td>
                                                            <td className="w-[1%] px-2 py-3 text-right whitespace-nowrap">
                                                                {formatNumber(
                                                                    getValue(
                                                                        detail,
                                                                        [
                                                                            'stok',
                                                                        ],
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'renmark',
                                                                        'Renmark',
                                                                        'remark',
                                                                        'Remark',
                                                                        'keterangan',
                                                                        'Keterangan',
                                                                    ],
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {materialPageSize !== Infinity &&
                                        materialTotalItems > 0 && (
                                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                                <span>
                                                    Menampilkan{' '}
                                                    {Math.min(
                                                        (materialCurrentPage -
                                                            1) *
                                                            materialPageSize +
                                                            1,
                                                        materialTotalItems,
                                                    )}
                                                    -
                                                    {Math.min(
                                                        materialCurrentPage *
                                                            materialPageSize,
                                                        materialTotalItems,
                                                    )}{' '}
                                                    dari {materialTotalItems}{' '}
                                                    data
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setMaterialCurrentPage(
                                                                (page) =>
                                                                    Math.max(
                                                                        1,
                                                                        page -
                                                                            1,
                                                                    ),
                                                            )
                                                        }
                                                        disabled={
                                                            materialCurrentPage ===
                                                            1
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span className="text-sm text-muted-foreground">
                                                        Halaman{' '}
                                                        {materialCurrentPage}{' '}
                                                        dari{' '}
                                                        {materialTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setMaterialCurrentPage(
                                                                (page) =>
                                                                    Math.min(
                                                                        materialTotalPages,
                                                                        page +
                                                                            1,
                                                                    ),
                                                            )
                                                        }
                                                        disabled={
                                                            materialCurrentPage ===
                                                            materialTotalPages
                                                        }
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isOutstandingModalOpen}
                    onOpenChange={(open) => {
                        setIsOutstandingModalOpen(open);
                        if (!open) {
                            setOutstandingSearchTerm('');
                            setOutstandingPageSize(5);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Outstanding</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang belum terealisasi sama sekali
                                (belum ada material dibuat PO).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        outstandingPageSize === Infinity
                                            ? 'all'
                                            : outstandingPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setOutstandingPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setOutstandingCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari customer, no PR, ref PO..."
                                    value={outstandingSearchTerm}
                                    onChange={(event) =>
                                        setOutstandingSearchTerm(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-max px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="px-2 py-2 text-left whitespace-nowrap">
                                            Jenis PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        error={outstandingError}
                                        onRetry={loadOutstanding}
                                        loading={outstandingLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !outstandingLoading &&
                                            displayedOutstandingPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            outstandingError ||
                                            'Tidak ada PR outstanding.'
                                        }
                                    />
                                    {displayedOutstandingPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`outstanding-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.date}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomersWithOverdueMarkers(
                                                            item.for_customer,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-max px-2 py-2 whitespace-nowrap">
                                                    {renderRefPoValues(
                                                        item.ref_po,
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-sm whitespace-nowrap">
                                                    {item.jenis_pr ?? '-'}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsOutstandingModalOpen(
                                                                    false,
                                                                );
                                                                handleOpenModal(
                                                                    item,
                                                                );
                                                            }}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <MenuAction
                                                            action="update"
                                                            as={Link}
                                                            href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/edit`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </MenuAction>
                                                        {item._canDelete && (
                                                            <MenuAction
                                                                action="delete"
                                                                as="button"
                                                                type="button"
                                                                className="text-muted-foreground transition hover:text-destructive"
                                                                title="Hapus"
                                                                disabled={
                                                                    isDeleting
                                                                }
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        item.no_pr,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </MenuAction>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {outstandingPageSize !== Infinity &&
                            outstandingTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (outstandingCurrentPage - 1) *
                                                outstandingPageSize +
                                                1,
                                            outstandingTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            outstandingCurrentPage *
                                                outstandingPageSize,
                                            outstandingTotalItems,
                                        )}{' '}
                                        dari {outstandingTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage(
                                                    (page) =>
                                                        Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage === 1
                                            }
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {outstandingCurrentPage}{' '}
                                            dari {outstandingTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage(
                                                    (page) =>
                                                        Math.min(
                                                            outstandingTotalPages,
                                                            page + 1,
                                                        ),
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage ===
                                                outstandingTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isSisaPoModalOpen}
                    onOpenChange={(open) => {
                        setIsSisaPoModalOpen(open);
                        if (!open) {
                            setSisaPoSearchTerm('');
                            setSisaPoPageSize(5);
                            setSisaPoCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Sisa PO</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang sudah mulai dibuat PO namun masih
                                memiliki sisa material.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        sisaPoPageSize === Infinity
                                            ? 'all'
                                            : sisaPoPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setSisaPoPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setSisaPoCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari customer, no PR, ref PO..."
                                    value={sisaPoSearchTerm}
                                    onChange={(event) =>
                                        setSisaPoSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-max px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="px-2 py-2 text-left whitespace-nowrap">
                                            Jenis PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        error={sisaPoError}
                                        onRetry={loadSisaPo}
                                        loading={sisaPoLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !sisaPoLoading &&
                                            displayedSisaPoPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            sisaPoError ||
                                            'Tidak ada PR sisa PO.'
                                        }
                                    />
                                    {displayedSisaPoPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`sisa-po-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.date}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomersWithOverdueMarkers(
                                                            item.for_customer,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-max px-2 py-2 whitespace-nowrap">
                                                    {renderRefPoValues(
                                                        item.ref_po,
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-sm whitespace-nowrap">
                                                    {item.jenis_pr ?? '-'}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsSisaPoModalOpen(
                                                                    false,
                                                                );
                                                                handleOpenModal(
                                                                    item,
                                                                );
                                                            }}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <MenuAction
                                                            action="update"
                                                            as={Link}
                                                            href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/edit`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </MenuAction>
                                                        {item._canDelete && (
                                                            <MenuAction
                                                                action="delete"
                                                                as="button"
                                                                type="button"
                                                                className="text-muted-foreground transition hover:text-destructive"
                                                                title="Hapus"
                                                                disabled={
                                                                    isDeleting
                                                                }
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        item.no_pr,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </MenuAction>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {sisaPoPageSize !== Infinity &&
                            sisaPoTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (sisaPoCurrentPage - 1) *
                                                sisaPoPageSize +
                                                1,
                                            sisaPoTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            sisaPoCurrentPage * sisaPoPageSize,
                                            sisaPoTotalItems,
                                        )}{' '}
                                        dari {sisaPoTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setSisaPoCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={sisaPoCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {sisaPoCurrentPage} dari{' '}
                                            {sisaPoTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setSisaPoCurrentPage((page) =>
                                                    Math.min(
                                                        sisaPoTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                sisaPoCurrentPage ===
                                                sisaPoTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isRealizedModalOpen}
                    onOpenChange={(open) => {
                        setIsRealizedModalOpen(open);
                        if (!open) {
                            setRealizedSearchTerm('');
                            setRealizedPageSize(5);
                            setRealizedCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Terealisasi</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang sudah terealisasi sesuai periode
                                terpilih.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        realizedPageSize === Infinity
                                            ? 'all'
                                            : realizedPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setRealizedPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setRealizedCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari no PR, customer, ref PO..."
                                    value={realizedSearchTerm}
                                    onChange={(event) =>
                                        setRealizedSearchTerm(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-max px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="px-2 py-2 text-left whitespace-nowrap">
                                            Jenis PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        error={realizedError}
                                        onRetry={() => loadRealized(periodFilter)}
                                        loading={realizedLoading}
                                        columns={6}
                                        rows={5}
                                        isEmpty={
                                            !realizedLoading &&
                                            displayedRealizedPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            realizedError ||
                                            'Tidak ada PR terealisasi.'
                                        }
                                    />
                                    {displayedRealizedPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`realized-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.date ||
                                                        item.pr_date ||
                                                        '-'}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomersWithOverdueMarkers(
                                                            getValue(item, [
                                                                'for_customer',
                                                            ]),
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-max px-2 py-2 whitespace-nowrap">
                                                    {renderRefPoValues(
                                                        item.ref_po,
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-sm whitespace-nowrap">
                                                    {item.jenis_pr ?? '-'}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        title="Lihat"
                                                        onClick={() => {
                                                            setIsRealizedModalOpen(
                                                                false,
                                                            );
                                                            handleOpenModal(
                                                                item,
                                                            );
                                                        }}
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {realizedPageSize !== Infinity &&
                            realizedTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (realizedCurrentPage - 1) *
                                                realizedPageSize +
                                                1,
                                            realizedTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            realizedCurrentPage *
                                                realizedPageSize,
                                            realizedTotalItems,
                                        )}{' '}
                                        dari {realizedTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setRealizedCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={realizedCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {realizedCurrentPage} from{' '}
                                            {realizedTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setRealizedCurrentPage((page) =>
                                                    Math.min(
                                                        realizedTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                realizedCurrentPage ===
                                                realizedTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>
                <OverdueInvoiceWarningDialog
                    open={overdueDialogOpen}
                    onOpenChange={setOverdueDialogOpen}
                    data={overdueDialogData}
                    onInvoiceClick={(invoice) => {
                        setSelectedInvoiceNo(invoice.no_fakturpenjualan);
                        setInvoiceDetailOpen(true);
                    }}
                    showActions={false}
                    title="Tunggakan Tagihan Customer"
                    description={
                        overdueDialogLoading
                            ? 'Memuat data tunggakan tagihan customer...'
                            : 'Daftar tagihan customer yang sudah melewati jatuh tempo.'
                    }
                />
                <InvoiceDetailDialog
                    open={invoiceDetailOpen}
                    onOpenChange={setInvoiceDetailOpen}
                    invoiceNo={selectedInvoiceNo}
                />
            </div>
        </>
    );
}

PurchaseRequirementIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
