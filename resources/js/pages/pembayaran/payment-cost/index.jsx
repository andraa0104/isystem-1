import { ActionIconButton } from '@/components/action-icon-button';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Eye, Loader2, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/payment-cost' },
    { title: 'Payment Cost', href: '/pembayaran/payment-cost' },
];

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

export default function PaymentCostIndex() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [filter, setFilter] = useState('belum'); // belum | sudah | all
    const [period, setPeriod] = useState('today'); // today | week | month | year | range | all
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [detailSummary, setDetailSummary] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedKode, setSelectedKode] = useState('');

    // Detail filters
    const [detailSearch, setDetailSearch] = useState('');
    const [detailDebouncedSearch, setDetailDebouncedSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailPage, setDetailPage] = useState(1);
    const [detailTotal, setDetailTotal] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setDetailDebouncedSearch(detailSearch), 400);
        return () => clearTimeout(t);
    }, [detailSearch]);

    useEffect(() => {
        setDetailPage(1);
    }, [detailDebouncedSearch, detailPageSize]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, filter, period, startDate, endDate]);

    const fetchRows = async (opts = {}) => {
        const nextSearch = opts.search ?? debouncedSearch;
        const nextPage = opts.page ?? page;
        const nextPageSize = opts.pageSize ?? pageSize;
        const nextFilter = opts.filter ?? filter;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('filter', nextFilter);
            params.set('period', period);
            params.set('startDate', startDate);
            params.set('endDate', endDate);
            params.set('search', nextSearch);
            params.set('page', String(nextPage));
            params.set(
                'pageSize',
                nextPageSize === 'all' ? 'all' : String(nextPageSize),
            );
            const res = await fetch(
                `/pembayaran/payment-cost/rows?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch {
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = (kode) => {
        setSelectedKode(kode);
        setIsDetailOpen(true);
        setDetailPage(1);
        setDetailSearch('');
    };

    const fetchDetailRows = async () => {
        if (!isDetailOpen || !selectedKode) return;

        setDetailLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('kode_bayar', selectedKode);
            params.set('search', detailDebouncedSearch);
            params.set('page', String(detailPage));
            params.set(
                'pageSize',
                detailPageSize === 'all' ? 'all' : String(detailPageSize),
            );

            const res = await fetch(
                `/pembayaran/payment-cost/details?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await res.json();
            setDetailRows(Array.isArray(data?.rows) ? data.rows : []);
            setDetailTotal(Number(data?.total ?? 0));
            setDetailSummary(data?.summary);
        } catch (err) {
            console.error(err);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        fetchDetailRows();
    }, [
        isDetailOpen,
        selectedKode,
        detailDebouncedSearch,
        detailPageSize,
        detailPage,
    ]);

    const detailTotalPages = useMemo(() => {
        if (detailPageSize === 'all') return 1;
        const size = Number(detailPageSize) || 5;
        return Math.max(1, Math.ceil(detailTotal / size));
    }, [detailPageSize, detailTotal]);

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page, filter, period, startDate, endDate]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 5;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payment Cost" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                                <ReceiptText className="h-5 w-5 text-white/80" />
                            </div>
                            <h1 className="text-xl font-semibold">
                                Payment Cost
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Daftar pembayaran biaya
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild className="sm:order-3">
                            <Link href="/pembayaran/payment-cost/create">
                                Add Payment
                            </Link>
                        </Button>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Pilih Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hari Ini</SelectItem>
                                <SelectItem value="week">Minggu Ini</SelectItem>
                                <SelectItem value="month">Bulan Ini</SelectItem>
                                <SelectItem value="year">Tahun Ini</SelectItem>
                                <SelectItem value="range">
                                    Range Tanggal
                                </SelectItem>
                                <SelectItem value="all">Semua Data</SelectItem>
                            </SelectContent>
                        </Select>

                        {period === 'range' && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) =>
                                        setStartDate(e.target.value)
                                    }
                                    className="w-40"
                                />
                                <span className="text-muted-foreground">
                                    s/d
                                </span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                        )}

                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="belum">
                                    Belum pembukuan
                                </SelectItem>
                                <SelectItem value="sudah">
                                    Sudah pembukuan
                                </SelectItem>
                                <SelectItem value="all">Semua data</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) =>
                                setPageSize(val === 'all' ? 'all' : Number(val))
                            }
                        >
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="all">Semua</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari Kode Bayar..."
                            className="w-full sm:w-64"
                        />
                    </div>
                </div>

                <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />{' '}
                                Memuat...
                            </div>
                        </div>
                    )}
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-white/5 text-[11px] tracking-wide text-muted-foreground uppercase">
                            <tr>
                                <th className="px-3 py-3">Kode Bayar</th>
                                <th className="px-3 py-3">Posting Date</th>
                                <th className="px-3 py-3 text-right">Total</th>
                                <th className="px-3 py-3 text-right">Bayar</th>
                                <th className="px-3 py-3 text-right">Sisa</th>
                                <th className="px-3 py-3 text-center">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <PlainTableStateRows
                                columns={6}
                                loading={loading}
                                isEmpty={!loading && rows.length === 0}
                                emptyTitle="Tidak ada data."
                            />
                            {rows.map((r, idx) => (
                                <tr
                                    key={`${r?.Kode_Bayar ?? idx}-${idx}`}
                                    className="border-t border-white/5"
                                >
                                    <td className="px-3 py-2">
                                        {r?.Kode_Bayar}
                                    </td>
                                    <td className="px-3 py-2">
                                        {r?.Tgl_Posting}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatRupiah(r?.Total)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatRupiah(r?.Bayar)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatRupiah(r?.Sisa)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <ActionIconButton
                                            label="View Detail"
                                            onClick={() =>
                                                handleViewDetail(r?.Kode_Bayar)
                                            }
                                        >
                                            <Eye className="h-4 w-4" />
                                        </ActionIconButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>
                        Total data:{' '}
                        {new Intl.NumberFormat('id-ID').format(total)}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={page === 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Sebelumnya
                        </Button>
                        <span>
                            Halaman {page} / {totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={page >= totalPages || loading}
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-h-[90vh] !w-[95vw] !max-w-none overflow-y-auto sm:max-w-none">
                    <DialogHeader>
                        <DialogTitle>
                            Detail Payment Cost - {selectedKode}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Tampilkan</span>
                            <Select
                                value={String(detailPageSize)}
                                onValueChange={(val) =>
                                    setDetailPageSize(
                                        val === 'all' ? 'all' : Number(val),
                                    )
                                }
                            >
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="all">Semua</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            value={detailSearch}
                            onChange={(e) => setDetailSearch(e.target.value)}
                            placeholder="Cari Keterangan atau Penanggung..."
                            className="w-full sm:w-80"
                        />
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-[10px] tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-3 py-3">Tgl Bayar</th>
                                    <th className="px-3 py-3">Keterangan</th>
                                    <th className="px-3 py-3">Penanggung</th>
                                    <th className="px-3 py-3 text-right">
                                        Total
                                    </th>
                                    <th className="px-3 py-3 text-right">
                                        Bayar
                                    </th>
                                    <th className="px-3 py-3 text-right">
                                        Sisa
                                    </th>
                                    <th className="px-3 py-3">Akun</th>
                                    <th className="px-3 py-3">No Doc</th>
                                </tr>
                            </thead>
                            <tbody>
                                <PlainTableStateRows
                                    columns={8}
                                    loading={detailLoading}
                                    isEmpty={
                                        !detailLoading &&
                                        detailRows.length === 0
                                    }
                                    emptyTitle="Tidak ada detail."
                                />
                                {detailRows.map((d, index) => (
                                    <tr
                                        key={index}
                                        className="border-t border-white/5 transition-colors hover:bg-white/5"
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {d.Tgl_Bayar}
                                        </td>
                                        <td className="px-3 py-2">
                                            {d.Keterangan}
                                        </td>
                                        <td className="px-3 py-2">
                                            {d.Penanggung}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {formatRupiah(d.Total)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-emerald-400">
                                            {formatRupiah(d.Bayar)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-rose-400">
                                            {formatRupiah(d.Sisa)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {d.beban_akun}
                                        </td>
                                        <td className="px-3 py-2">
                                            {d.noduk_beban}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-white/5 font-semibold">
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-3 py-3 text-right"
                                    >
                                        Summary Total:
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono">
                                        {detailLoading ? (
                                            <Skeleton className="ml-auto h-4 w-20" />
                                        ) : (
                                            formatRupiah(detailSummary?.total)
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-emerald-400">
                                        {detailLoading ? (
                                            <Skeleton className="ml-auto h-4 w-20" />
                                        ) : (
                                            formatRupiah(detailSummary?.bayar)
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-rose-400">
                                        {detailLoading ? (
                                            <Skeleton className="ml-auto h-4 w-20" />
                                        ) : (
                                            formatRupiah(detailSummary?.sisa)
                                        )}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                        <span>
                            Total detail:{' '}
                            {new Intl.NumberFormat('id-ID').format(detailTotal)}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={detailPage === 1 || detailLoading}
                                onClick={() =>
                                    setDetailPage((p) => Math.max(1, p - 1))
                                }
                            >
                                Sebelumnya
                            </Button>
                            <span>
                                Halaman {detailPage} / {detailTotalPages}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                    detailPage >= detailTotalPages ||
                                    detailLoading
                                }
                                onClick={() =>
                                    setDetailPage((p) =>
                                        Math.min(detailTotalPages, p + 1),
                                    )
                                }
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
