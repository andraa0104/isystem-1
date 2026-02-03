import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, ReceiptText } from 'lucide-react';
import { Link } from '@inertiajs/react';

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
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, filter]);

    const fetchRows = async (opts = {}) => {
        const nextSearch = opts.search ?? debouncedSearch;
        const nextPage = opts.page ?? page;
        const nextPageSize = opts.pageSize ?? pageSize;
        const nextFilter = opts.filter ?? filter;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('filter', nextFilter);
            params.set('search', nextSearch);
            params.set('page', String(nextPage));
            params.set('pageSize', nextPageSize === 'all' ? 'all' : String(nextPageSize));
            const res = await fetch(`/pembayaran/payment-cost/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
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

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page, filter]);

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
                            <h1 className="text-xl font-semibold">Payment Cost</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Daftar pembayaran biaya
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild className="sm:order-3">
                            <Link href="/pembayaran/payment-cost/create">Add Payment</Link>
                        </Button>
                        <span className="text-sm text-muted-foreground">Filter</span>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="belum">Belum pembukuan</SelectItem>
                                <SelectItem value="sudah">Sudah pembukuan</SelectItem>
                                <SelectItem value="all">Semua data</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">Tampil</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) => setPageSize(val === 'all' ? 'all' : Number(val))}
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
                            placeholder="Cari Kode Bayar, Keterangan, Akun..."
                            className="w-full sm:w-80"
                        />
                    </div>
                </div>

                <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                            </div>
                        </div>
                    )}
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                            <tr>
                                <th className="px-3 py-3">Kode Bayar</th>
                                <th className="px-3 py-3">Tgl Bayar</th>
                                <th className="px-3 py-3">Posting Date</th>
                                <th className="px-3 py-3">Keterangan</th>
                                <th className="px-3 py-3">Penanggung</th>
                                <th className="px-3 py-3 text-right">Total</th>
                                <th className="px-3 py-3 text-right">Bayar</th>
                                <th className="px-3 py-3 text-right">Sisa</th>
                                <th className="px-3 py-3">Akun</th>
                                <th className="px-3 py-3">No Doc</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td
                                        colSpan={10}
                                        className="px-3 py-8 text-center text-muted-foreground"
                                    >
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => (
                                <tr key={`${r?.Kode_Bayar ?? idx}-${idx}`} className="border-t border-white/5">
                                    <td className="px-3 py-2">{r?.Kode_Bayar}</td>
                                    <td className="px-3 py-2">{r?.Tgl_Bayar}</td>
                                    <td className="px-3 py-2">{r?.Tgl_Posting}</td>
                                    <td className="px-3 py-2">{r?.Keterangan}</td>
                                    <td className="px-3 py-2">{r?.Penanggung}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(r?.Total)}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(r?.Bayar)}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(r?.Sisa)}</td>
                                    <td className="px-3 py-2">{r?.beban_akun}</td>
                                    <td className="px-3 py-2">{r?.noduk_beban}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>Total data: {new Intl.NumberFormat('id-ID').format(total)}</span>
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
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
