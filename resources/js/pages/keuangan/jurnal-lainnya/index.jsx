import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value ?? 0),
    );

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

export default function JurnalLainnyaIndex({ filters = {} }) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const fetchRows = async (nextPage = page) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('page', String(nextPage));
        params.set('pageSize', String(pageSize));
        try {
            const res = await fetch(`/keuangan/jurnal-lainnya/rows?${params}`);
            const json = await res.json();
            setRows(Array.isArray(json?.rows) ? json.rows : []);
            setTotal(Number(json?.total ?? 0));
            setPage(Number(json?.page ?? nextPage));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    return (
        <>
            <Head title="Jurnal Lainnya" />
            <div className="flex flex-col gap-4 p-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle>Jurnal Lainnya</CardTitle>
                        <Button
                            type="button"
                            onClick={() =>
                                router.visit('/keuangan/jurnal-lainnya/create')
                            }
                        >
                            Input Baru
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari kode jurnal / keterangan..."
                                className="max-w-sm"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fetchRows(1)}
                                disabled={loading}
                            >
                                Cari
                            </Button>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(v) => {
                                    setPage(1);
                                    setPageSize(Number(v));
                                }}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZE_OPTIONS.map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} baris
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="ml-auto text-sm text-muted-foreground">
                                Total {total.toLocaleString('id-ID')} data
                            </div>
                        </div>
                        <div className="overflow-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode Jurnal</TableHead>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Akun</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="text-right">
                                            Debit
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Kredit
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Selisih
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length ? (
                                        rows.map((row) => {
                                            const debit = Number(
                                                row.total_debit ?? 0,
                                            );
                                            const kredit = Number(
                                                row.total_kredit ?? 0,
                                            );
                                            const selisih =
                                                Math.round(
                                                    (debit - kredit) * 100,
                                                ) / 100;
                                            const balanced = selisih === 0;
                                            return (
                                                <TableRow
                                                    key={row.Kode_Jurnal}
                                                >
                                                    <TableCell className="font-mono font-medium">
                                                        {row.Kode_Jurnal}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            row.Tgl_Jurnal,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="min-w-44">
                                                        <div className="font-mono text-xs">
                                                            {row.akun_list ||
                                                                '-'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {Number(
                                                                row.akun_count ??
                                                                    0,
                                                            )}{' '}
                                                            baris akun
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="min-w-[360px] whitespace-normal">
                                                        {row.Remark || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        Rp{' '}
                                                        {formatNumber(debit)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        Rp{' '}
                                                        {formatNumber(kredit)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right ${balanced ? 'text-emerald-600' : 'text-destructive'}`}
                                                    >
                                                        Rp{' '}
                                                        {formatNumber(selisih)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                                                                balanced
                                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                                    : 'bg-destructive/10 text-destructive'
                                                            }`}
                                                        >
                                                            {balanced
                                                                ? 'Balance'
                                                                : 'Tidak balance'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={8}
                                                className="h-24 text-center text-muted-foreground"
                                            >
                                                {loading
                                                    ? 'Memuat...'
                                                    : 'Belum ada data.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={loading || page <= 1}
                                onClick={() => fetchRows(Math.max(1, page - 1))}
                            >
                                Sebelumnya
                            </Button>
                            <div className="min-w-20 text-center text-sm text-muted-foreground">
                                {page}/{totalPages}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={loading || page >= totalPages}
                                onClick={() =>
                                    fetchRows(Math.min(totalPages, page + 1))
                                }
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

JurnalLainnyaIndex.layout = (page) => (
    <AppLayout
        breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Keuangan', href: '#' },
            { title: 'Jurnal Lainnya', href: '/keuangan/jurnal-lainnya' },
        ]}
    >
        {page}
    </AppLayout>
);
