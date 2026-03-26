import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShadcnTableStateRows } from '@/components/data-states/TableStateRows';
import { normalizeApiError, readApiError } from '@/lib/api-error';

const PAGE_SIZE_OPTIONS = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: 'all', label: 'Semua data' },
];

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

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);

const directionBadge = (mutasi) => {
    const value = Number(mutasi ?? 0);
    if (value < 0) return { label: 'Keluar', variant: 'destructive' };
    if (value > 0) return { label: 'Masuk', variant: 'default' };
    return { label: 'Netral', variant: 'secondary' };
};

const formatPeriodLabel = (yyyymm) => {
    if (!yyyymm || !/^\d{6}$/.test(yyyymm)) return 'Semua Periode';
    const yyyy = Number(yyyymm.slice(0, 4));
    const mm = Number(yyyymm.slice(4, 6));
    const d = new Date(yyyy, Math.max(0, mm - 1), 1);
    if (Number.isNaN(d.getTime())) return yyyymm;
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
};

const MONTH_OPTIONS = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

export default function InputPembelianIndex({ filters = {}, accountOptions = [], defaultAccount = null }) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [account, setAccount] = useState(filters?.account ?? (defaultAccount ?? 'all'));
    const [period, setPeriod] = useState(filters?.period ?? new Date().toISOString().slice(0, 7).replace('-', ''));
    const [pageSize, setPageSize] = useState(filters?.pageSize ?? 10);
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const periodLabel = useMemo(() => formatPeriodLabel(period), [period]);
    const periodYear = period && (/^\d{6}$/.test(period) || /^\d{4}$/.test(period)) ? period.slice(0, 4) : '';
    const periodMonth = period && /^\d{6}$/.test(period) ? period.slice(4, 6) : 'all';

    const yearOptions = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const years = [];
        for (let y = currentYear + 1; y >= currentYear - 8; y -= 1) {
            years.push(String(y));
        }
        return years;
    }, []);

    const displayed = useMemo(() => {
        if (pageSize === Infinity) return rows;
        const start = (page - 1) * pageSize;
        return rows.slice(start, start + pageSize);
    }, [rows, page, pageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil((total ?? 0) / pageSize));
    }, [total, pageSize]);

    const emptyDescription = useMemo(() => {
        const bits = [];
        if (period) bits.push('periode');
        if (account && account !== 'all') bits.push('akun');
        if (search) bits.push('pencarian');
        if (bits.length === 0) return 'Klik Input Baru untuk membuat jurnal pembelian ke Buku Kas.';
        return `Coba ubah ${bits.join(', ')} atau pilih "Semua akun / Semua".`;
    }, [account, period, search]);

    const fetchRows = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (account && account !== 'all') params.set('account', account);
            if (period) params.set('period', period);
            params.set('pageSize', 'all');

            const res = await fetch(`/keuangan/input-pembelian/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                throw await normalizeApiError(res);
            }
            const json = await res.json();
            setRows(Array.isArray(json?.rows) ? json.rows : []);
            setTotal(Number(json?.total ?? 0));
        } catch (e) {
            setError(readApiError(e));
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setPage(1);
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account, period]);

    useEffect(() => {
        const t = window.setTimeout(() => {
            setPage(1);
            fetchRows();
        }, 350);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Input Pembelian', href: '/keuangan/input-pembelian' }]}>
            <Head title="Input Pembelian" />

            <div className="flex flex-col gap-4 p-4">
                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle>Input Pembelian (Buku Kas)</CardTitle>
                                <div className="text-xs text-muted-foreground">
                                    Menampilkan data yang sudah tersimpan di <span className="font-mono">tb_kas</span> (voucher <span className="font-mono">{'{DB}/{CV|GV|BV}/*'}</span>).
                                </div>
                            </div>
                            <Button type="button" onClick={() => router.visit('/keuangan/input-pembelian/create')}>
                                Input Baru
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
                            <div className="lg:col-span-4">
                                <Input
                                    placeholder="Cari kode voucher / keterangan..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return;
                                        setPage(1);
                                        fetchRows();
                                    }}
                                    className="w-full"
                                />
                            </div>
                            <div className="lg:col-span-4">
                                <Select value={account} onValueChange={setAccount}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Akun kas/bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua akun</SelectItem>
                                        {accountOptions?.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="lg:col-span-3 space-y-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={periodMonth}
                                        onValueChange={(v) => {
                                            const y = periodYear || yearOptions[0] || String(new Date().getFullYear());
                                            if (v === 'all') {
                                                setPeriod(y); // all months for a selected year
                                            } else {
                                                setPeriod(`${y}${v}`);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Bulan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua bulan</SelectItem>
                                            {MONTH_OPTIONS.map((m) => (
                                                <SelectItem key={m.value} value={m.value}>
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={periodYear || 'all'}
                                        onValueChange={(v) => {
                                            if (v === 'all') {
                                                setPeriod('');
                                                return;
                                            }
                                            if (periodMonth === 'all') {
                                                setPeriod(v);
                                            } else {
                                                const m = periodMonth || String(new Date().getMonth() + 1).padStart(2, '0');
                                                setPeriod(`${v}${m}`);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Tahun" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua tahun</SelectItem>
                                            {yearOptions.map((y) => (
                                                <SelectItem key={y} value={y}>
                                                    {y}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="lg:col-span-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setPage(1);
                                        fetchRows();
                                    }}
                                >
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead>Kode Voucher</TableHead>
                                    <TableHead>Tgl Voucher</TableHead>
                                    <TableHead>Akun</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-right">Mutasi</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <ShadcnTableStateRows
                                    columns={7}
                                    loading={loading}
                                    error={error}
                                    onRetry={fetchRows}
                                    isEmpty={!loading && !error && displayed.length === 0}
                                    emptyTitle="Belum ada input pembelian."
                                    emptyDescription={emptyDescription}
                                    emptyActionLabel="Input Baru"
                                    emptyActionHref="/keuangan/input-pembelian/create"
                                />
                                {!loading && !error && displayed.map((row) => {
                                    const badge = directionBadge(row?.Mutasi_Kas);
                                    return (
                                        <TableRow key={row?.Kode_Voucher ?? Math.random()}>
                                            <TableCell className="font-medium">{row?.Kode_Voucher ?? '-'}</TableCell>
                                            <TableCell>{formatDate(row?.Tgl_Voucher)}</TableCell>
                                            <TableCell>{row?.Kode_Akun ?? '-'}</TableCell>
                                            <TableCell className="min-w-[420px] whitespace-normal break-words">
                                                {row?.Keterangan ?? '-'}
                                            </TableCell>
                                            <TableCell className="text-right">{`Rp ${formatNumber(Math.abs(Number(row?.Mutasi_Kas ?? 0)))}`}</TableCell>
                                            <TableCell className="text-right">{`Rp ${formatNumber(row?.Saldo ?? 0)}`}</TableCell>
                                            <TableCell>
                                                <Badge variant={badge.variant}>{badge.label}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                                Total data: <span className="font-medium text-foreground">{total ?? 0}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={pageSize === Infinity ? 'all' : String(pageSize)}
                                    onValueChange={(val) => {
                                        setPage(1);
                                        setPageSize(val === 'all' ? Infinity : Number(val));
                                    }}
                                >
                                    <SelectTrigger className="w-36">
                                        <SelectValue placeholder="Tampilkan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={pageSize === Infinity || page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Prev
                                </Button>
                                <div className="min-w-[92px] text-center text-sm">
                                    {pageSize === Infinity ? 'All' : `${page}/${totalPages}`}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={pageSize === Infinity || page >= totalPages}
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
