import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShadcnTableStateRows } from '@/components/data-states/TableStateRows';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Keuangan', href: '#' },
    { title: 'Penyesuaian', href: '/keuangan/penyesuaian' },
];

const formatRupiah = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(n)}`;
};

const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
};

const getPeriodLabel = (periodType, period) => {
    if (periodType === 'year') {
        if (!period || !/^\d{4}$/.test(period)) return period || '';
        return `FY ${period} (Jan–Des)`;
    }
    if (!period || !/^\d{6}$/.test(period)) return period || '';
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(4, 6));
    const d = new Date(y, Math.max(0, m - 1), 1);
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
};

export default function KeuanganPenyesuaianIndex({
    initialQuery = {},
    periodOptions = [],
    defaultPeriod = '',
    yearOptions = [],
    defaultYear = '',
    bootstrapError = '',
}) {
    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(
        initialQuery?.period ??
            (periodType === 'year' ? defaultYear ?? '' : defaultPeriod ?? ''),
    );
    const [balance, setBalance] = useState(initialQuery?.balance ?? 'all'); // all|balanced|unbalanced
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Periode');
    const [sortDir, setSortDir] = useState((initialQuery?.sortDir ?? 'desc').toLowerCase());
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all'
            ? 'all'
            : Number(initialQuery?.pageSize ?? 10) || 10,
    );
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_dokumen: 0,
        sum_debit: 0,
        sum_kredit: 0,
        balanced_count: 0,
        unbalanced_count: 0,
        sum_selisih_abs: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [openMap, setOpenMap] = useState({});
    const [detailMap, setDetailMap] = useState({});
    const [detailLoading, setDetailLoading] = useState({});
    const [detailError, setDetailError] = useState({});

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, sortBy, sortDir, period, periodType, balance]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', periodType);
            params.set('period', period);
            params.set('balance', balance);
            params.set('search', debouncedSearch);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));

            const res = await fetch(`/keuangan/penyesuaian/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = String(data?.error ?? 'Gagal memuat data.');
                setError(msg);
                throw new Error(msg);
            }

            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
            setSummary({
                total_dokumen: Number(data?.summary?.total_dokumen ?? 0),
                sum_debit: Number(data?.summary?.sum_debit ?? 0),
                sum_kredit: Number(data?.summary?.sum_kredit ?? 0),
                balanced_count: Number(data?.summary?.balanced_count ?? 0),
                unbalanced_count: Number(data?.summary?.unbalanced_count ?? 0),
                sum_selisih_abs: Number(data?.summary?.sum_selisih_abs ?? 0),
            });

            setOpenMap({});
            setDetailMap({});
            setDetailLoading({});
            setDetailError({});
        } catch {
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (bootstrapError) return;
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodType, period, balance, debouncedSearch, pageSize, page, sortBy, sortDir]);

    const loadDetailsIfNeeded = async ({ kodeJurnal, periodeDoc }) => {
        const docKey = `${kodeJurnal}|${periodeDoc}`;
        if (detailMap[docKey] || detailLoading[docKey]) return;

        setDetailLoading((s) => ({ ...s, [docKey]: true }));
        setDetailError((s) => ({ ...s, [docKey]: '' }));
        try {
            const params = new URLSearchParams();
            params.set('kodeJurnal', kodeJurnal);
            params.set('periode', periodeDoc);
            const res = await fetch(`/keuangan/penyesuaian/details?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(String(data?.error ?? 'Gagal memuat detail.'));

            setDetailMap((s) => ({ ...s, [docKey]: data }));
        } catch (e) {
            setDetailError((s) => ({ ...s, [docKey]: String(e?.message ?? 'Gagal memuat detail.') }));
        } finally {
            setDetailLoading((s) => ({ ...s, [docKey]: false }));
        }
    };

    const onToggleRow = async (row) => {
        const kodeJurnal = String(row?.Kode_Jurnal ?? '');
        const periodeDoc = String(row?.Periode ?? '');
        const docKey = `${kodeJurnal}|${periodeDoc}`;
        const next = !openMap[docKey];
        setOpenMap((s) => ({ ...s, [docKey]: next }));
        if (next) {
            await loadDetailsIfNeeded({ kodeJurnal, periodeDoc });
        }
    };

    const balanceChip = useMemo(() => {
        const balanced = Number(summary.balanced_count ?? 0);
        const unbalanced = Number(summary.unbalanced_count ?? 0);
        if (unbalanced > 0) {
            return {
                label: `${new Intl.NumberFormat('id-ID').format(balanced)} seimbang • ${new Intl.NumberFormat('id-ID').format(unbalanced)} tidak`,
                className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
            };
        }
        return {
            label: `${new Intl.NumberFormat('id-ID').format(balanced)} seimbang`,
            className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
        };
    }, [summary]);

    const periodLabel = useMemo(() => getPeriodLabel(periodType, period), [periodType, period]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penyesuaian - Keuangan" />

            <div className="space-y-4 p-4">
                <Card>
                    <CardHeader className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle>Penyesuaian (Jurnal Penyesuaian)</CardTitle>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Sumber data: <span className="font-mono">tb_jurnalpenyesuaian</span>. Periode: {periodLabel}.
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.visit('/keuangan/penyesuaian/create')}
                                >
                                    Penyesuaian Baru
                                </Button>
                                <Button type="button" onClick={fetchRows} disabled={loading || !!bootstrapError}>
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {bootstrapError ? (
                            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                {bootstrapError}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                            <div className="md:col-span-2">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari kode jurnal / remark / akun..."
                                />
                            </div>

                            <Select value={periodType} onValueChange={setPeriodType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Mode periode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Bulan</SelectItem>
                                    <SelectItem value="year">Tahun</SelectItem>
                                </SelectContent>
                            </Select>

                            {periodType === 'year' ? (
                                <Select value={period} onValueChange={setPeriod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(yearOptions ?? []).map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Select value={period} onValueChange={setPeriod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Periode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(periodOptions ?? []).map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {getPeriodLabel('month', p)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            <div className="flex items-center justify-between gap-2">
                                <Select value={balance} onValueChange={setBalance}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Balance" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        <SelectItem value="balanced">Seimbang</SelectItem>
                                        <SelectItem value="unbalanced">Tidak seimbang</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div className="rounded-xl border bg-card p-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Dokumen</div>
                                <div className="mt-1 text-lg font-semibold">
                                    {new Intl.NumberFormat('id-ID').format(summary.total_dokumen ?? 0)}
                                </div>
                            </div>
                            <div className="rounded-xl border bg-card p-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Debit</div>
                                <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.sum_debit ?? 0)}</div>
                            </div>
                            <div className="rounded-xl border bg-card p-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Kredit</div>
                                <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.sum_kredit ?? 0)}</div>
                            </div>
                            <div className="rounded-xl border bg-card p-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                                <div className="mt-2 inline-flex items-center rounded-full px-2 py-1 text-xs ring-1 ring-inset">
                                    <span className={balanceChip.className}>{balanceChip.label}</span>
                                </div>
                            </div>
                        </div>

                        {error ? (
                            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        ) : null}

                        <div className="overflow-x-auto rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[36px]" />
                                        <TableHead>Kode Jurnal</TableHead>
                                        <TableHead>Periode</TableHead>
                                        <TableHead>Posting</TableHead>
                                        <TableHead className="min-w-[420px]">Remark</TableHead>
                                        <TableHead className="text-right">Total Debit</TableHead>
                                        <TableHead className="text-right">Total Kredit</TableHead>
                                        <TableHead className="text-right">Lines</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <ShadcnTableStateRows
                                        columns={9}
                                        loading={loading}
                                        error={error}
                                        onRetry={fetchRows}
                                        isEmpty={!loading && !error && rows.length === 0}
                                        emptyTitle="Belum ada data."
                                        emptyDescription='Klik "Penyesuaian Baru" untuk membuat jurnal penyesuaian.'
                                    />

                                    {!loading &&
                                        !error &&
                                        rows.map((row) => {
                                            const kodeJurnal = String(row?.Kode_Jurnal ?? '');
                                            const periodeDoc = String(row?.Periode ?? '');
                                            const docKey = `${kodeJurnal}|${periodeDoc}`;
                                            const isOpen = Boolean(openMap[docKey]);
                                            const isBalanced = Boolean(row?.is_balanced);
                                            const detail = detailMap[docKey];
                                            const dErr = detailError[docKey];
                                            const dLoading = detailLoading[docKey];

                                            return (
                                                <Fragment key={docKey}>
                                                    <TableRow
                                                        className="cursor-pointer"
                                                        onClick={() => onToggleRow(row)}
                                                    >
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {isOpen ? '−' : '+'}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs whitespace-nowrap">
                                                            {kodeJurnal}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            {formatDate(periodeDoc)}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            {row?.Posting_Date ? formatDate(row.Posting_Date) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-sm break-words whitespace-normal">
                                                            {String(row?.Remark ?? '') || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {formatRupiah(row?.total_debit ?? 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {formatRupiah(row?.total_kredit ?? 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {new Intl.NumberFormat('id-ID').format(row?.lines ?? 0)}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            <Badge variant={isBalanced ? 'default' : 'destructive'}>
                                                                {isBalanced ? 'Seimbang' : 'Tidak'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>

                                                    {isOpen ? (
                                                        <TableRow key={`${docKey}:detail`}>
                                                            <TableCell colSpan={9} className="bg-muted/20">
                                                                {dLoading ? (
                                                                    <div className="p-3 text-sm text-muted-foreground">
                                                                        Memuat detail...
                                                                    </div>
                                                                ) : dErr ? (
                                                                    <div className="p-3 text-sm text-destructive">
                                                                        {dErr}
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-3">
                                                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                                            <div className="rounded-lg border bg-background p-3">
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Total Debit
                                                                                </div>
                                                                                <div className="mt-1 text-base font-semibold">
                                                                                    {formatRupiah(detail?.totals?.total_debit ?? 0)}
                                                                                </div>
                                                                            </div>
                                                                            <div className="rounded-lg border bg-background p-3">
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Total Kredit
                                                                                </div>
                                                                                <div className="mt-1 text-base font-semibold">
                                                                                    {formatRupiah(detail?.totals?.total_kredit ?? 0)}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-3 overflow-x-auto rounded-lg border bg-background">
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow>
                                                                                        <TableHead>Akun</TableHead>
                                                                                        <TableHead className="text-right">
                                                                                            Debit
                                                                                        </TableHead>
                                                                                        <TableHead className="text-right">
                                                                                            Kredit
                                                                                        </TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {(detail?.details ?? []).map((d, i) => (
                                                                                        <TableRow key={`${docKey}:d:${i}`}>
                                                                                            <TableCell className="text-sm">
                                                                                                <div className="font-mono text-xs">
                                                                                                    {String(d?.Kode_Akun ?? '')}
                                                                                                </div>
                                                                                                <div className="text-xs text-muted-foreground">
                                                                                                    {String(d?.Nama_Akun ?? '')}
                                                                                                </div>
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right whitespace-nowrap">
                                                                                                {formatRupiah(d?.Debit ?? 0)}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right whitespace-nowrap">
                                                                                                {formatRupiah(d?.Kredit ?? 0)}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Total data: {new Intl.NumberFormat('id-ID').format(total)}
                            </div>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={pageSize === 'all' ? 'all' : String(pageSize)}
                                    onValueChange={(v) => {
                                        setPageSize(v === 'all' ? 'all' : Number(v));
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Per halaman" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="all">Semua</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page <= 1 || pageSize === 'all'}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Prev
                                </Button>
                                <div className="text-sm tabular-nums">
                                    {page}/{totalPages}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page >= totalPages || pageSize === 'all'}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
