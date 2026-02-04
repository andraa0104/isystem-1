import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Loader2, Plus, Printer } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/permintaan-dana-operasional' },
    { title: 'Permintaan Dana Operasional', href: '/pembayaran/permintaan-dana-operasional' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

const getRawValue = (source, keys) => {
    if (!source) return undefined;
    const sourceKeys = Object.keys(source);
    for (const key of keys) {
        const value = source[key];
        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
        const matchKey = sourceKeys.find(
            (candidate) => candidate.toLowerCase() === key.toLowerCase()
        );
        if (matchKey) {
            const matched = source[matchKey];
            if (matched !== null && matched !== undefined && matched !== '') {
                return matched;
            }
        }
    }
    return undefined;
};

const getValue = (source, keys) => renderValue(getRawValue(source, keys));

const formatRupiah = (value) => {
    const normalized =
        value === null || value === undefined
            ? NaN
            : Number(String(value).replace(/,/g, '').trim());
    const number = Number.isNaN(normalized) ? Number(value) : normalized;
    if (Number.isNaN(number)) {
        return '-';
    }
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

export default function PermintaanDanaOperasionalIndex() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [pdoModalOpen, setPdoModalOpen] = useState(false);
    const [pdoRows, setPdoRows] = useState([]);
    const [pdoTotal, setPdoTotal] = useState(0);
    const [pdoLoading, setPdoLoading] = useState(false);
    const [pdoNo, setPdoNo] = useState('');
    const [pdoPageSize, setPdoPageSize] = useState(5);
    const [pdoPage, setPdoPage] = useState(1);
    const [pdoSearch, setPdoSearch] = useState('');
    const [pdoDebouncedSearch, setPdoDebouncedSearch] = useState('');

    // Invoice modal (copy pattern from invoice masuk page)
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');
    const [invoicePageSize, setInvoicePageSize] = useState(5);
    const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);
    const [invoiceSearch, setInvoiceSearch] = useState('');

    // PO modal (copy pattern from purchase order page)
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [selectedPo, setSelectedPo] = useState(null);
    const [selectedDetails, setSelectedDetails] = useState([]);
    const [poDetailLoading, setPoDetailLoading] = useState(false);
    const [poDetailError, setPoDetailError] = useState('');
    const [detailSearch, setDetailSearch] = useState('');
    const [debouncedDetailSearch, setDebouncedDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 450);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(() => setPdoDebouncedSearch(pdoSearch), 450);
        return () => clearTimeout(t);
    }, [pdoSearch]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize]);

    useEffect(() => {
        setPdoPage(1);
    }, [pdoDebouncedSearch, pdoPageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 5;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const loadRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('search', debouncedSearch);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));
            const res = await fetch(`/pembayaran/permintaan-dana-operasional/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Gagal memuat data.');
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch (e) {
            setRows([]);
            setTotal(0);
            setError(e?.message || 'Gagal memuat data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page]);

    const pdoTotalPages = useMemo(() => {
        if (pdoPageSize === 'all') return 1;
        const size = Number(pdoPageSize) || 5;
        return Math.max(1, Math.ceil(pdoTotal / size));
    }, [pdoPageSize, pdoTotal]);

    const loadPdoRows = async () => {
        if (!pdoModalOpen || !pdoNo) return;
        setPdoLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('search', pdoDebouncedSearch);
            params.set('page', String(pdoPage));
            params.set('pageSize', pdoPageSize === 'all' ? 'all' : String(pdoPageSize));
            const res = await fetch(
                `/pembayaran/permintaan-dana-operasional/${encodeURIComponent(pdoNo)}/rows?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!res.ok) throw new Error('Gagal memuat detail PDO.');
            const data = await res.json();
            setPdoRows(Array.isArray(data?.rows) ? data.rows : []);
            setPdoTotal(Number(data?.total ?? 0));
        } catch (e) {
            setPdoRows([]);
            setPdoTotal(0);
        } finally {
            setPdoLoading(false);
        }
    };

    useEffect(() => {
        loadPdoRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdoModalOpen, pdoNo, pdoPageSize, pdoPage, pdoDebouncedSearch]);

    const openInvoiceDetail = async (noFi) => {
        if (!noFi) return;
        setInvoiceModalOpen(true);
        setInvoiceLoading(true);
        setInvoiceError('');
        setInvoiceItems([]);
        setInvoiceDetail(null);
        setInvoiceCurrentPage(1);
        try {
            const res = await fetch(`/pembelian/invoice-masuk/${encodeURIComponent(noFi)}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Gagal memuat detail invoice.');
            const data = await res.json();
            setInvoiceDetail(data?.header ?? null);
            const items = Array.isArray(data?.items) ? data.items : [];
            const withNoGudang = items.map((row) => ({
                ...row,
                no_gudang: row.no_gudang ?? data?.header?.no_gudang ?? null,
            }));
            setInvoiceItems(withNoGudang);
            if (!data?.header) setInvoiceError('Data invoice tidak ditemukan.');
        } catch (e) {
            setInvoiceError(e?.message || 'Gagal memuat detail invoice.');
        } finally {
            setInvoiceLoading(false);
        }
    };

    const openPoDetail = (noPo) => {
        if (!noPo) return;
        setPoModalOpen(true);
        setSelectedPo({ no_po: noPo });
        setSelectedDetails([]);
        setPoDetailError('');
        setDetailSearch('');
        setDebouncedDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setPoDetailLoading(true);
    };

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedDetailSearch(detailSearch), 500);
        return () => clearTimeout(handler);
    }, [detailSearch]);

    useEffect(() => {
        if (!poModalOpen || !selectedPo?.no_po) return;
        setPoDetailLoading(true);
        setPoDetailError('');
        const params = new URLSearchParams({
            no_po: selectedPo.no_po,
            search: debouncedDetailSearch,
        });
        fetch(`/pembelian/purchase-order/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((res) => {
                if (!res.ok) throw new Error('Gagal memuat detail PO.');
                return res.json();
            })
            .then((data) => {
                setSelectedPo(data?.purchaseOrder ?? null);
                setSelectedDetails(Array.isArray(data?.purchaseOrderDetails) ? data.purchaseOrderDetails : []);
                if (!data?.purchaseOrder) setPoDetailError('Data PO tidak ditemukan.');
            })
            .catch((e) => {
                setSelectedPo(null);
                setSelectedDetails([]);
                setPoDetailError(e?.message || 'Gagal memuat detail PO.');
            })
            .finally(() => setPoDetailLoading(false));
    }, [poModalOpen, selectedPo?.no_po, debouncedDetailSearch]);

    const filteredInvoiceItems = useMemo(() => {
        const term = invoiceSearch.trim().toLowerCase();
        if (!term) return invoiceItems;
        return invoiceItems.filter((row) =>
            [row?.mat]
                .map((v) => String(v ?? '').toLowerCase())
                .some((v) => v.includes(term))
        );
    }, [invoiceItems, invoiceSearch]);

    const invoiceTotalPages = useMemo(() => {
        if (invoicePageSize === Infinity) return 1;
        const size = Number(invoicePageSize) || 5;
        return Math.max(1, Math.ceil(filteredInvoiceItems.length / size));
    }, [filteredInvoiceItems.length, invoicePageSize]);

    const displayedInvoiceItems = useMemo(() => {
        if (invoicePageSize === Infinity) return filteredInvoiceItems;
        const size = Number(invoicePageSize) || 5;
        const start = (invoiceCurrentPage - 1) * size;
        return filteredInvoiceItems.slice(start, start + size);
    }, [filteredInvoiceItems, invoiceCurrentPage, invoicePageSize]);

    const selectedDetail = selectedDetails[0] ?? null;
    const detailTotalItems = selectedDetails.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) return 1;
        const size = Number(detailPageSize) || 5;
        return Math.max(1, Math.ceil(detailTotalItems / size));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) return selectedDetails;
        const size = Number(detailPageSize) || 5;
        const start = (detailCurrentPage - 1) * size;
        return selectedDetails.slice(start, start + size);
    }, [selectedDetails, detailCurrentPage, detailPageSize]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permintaan Dana Operasional" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Permintaan Dana Operasional</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Monitoring permintaan dana operasional (PDO)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/pembayaran/permintaan-dana-operasional/create">
                            <Plus className="mr-2 h-4 w-4" />
                            Add PDO
                        </Link>
                    </Button>
                </div>

                <Card className="rounded-2xl border-white/10 bg-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Data PDO</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="w-full md:max-w-md">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari No PDO..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Tampil</span>
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
                            </div>
                        </div>

                        <div className="relative mt-4 overflow-x-auto rounded-xl border border-white/10 bg-card">
                            {loading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                                    </div>
                                </div>
                            )}
                            <table className="min-w-[1000px] w-full text-sm text-left">
                                <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                                    <tr>
                                        <th className="px-3 py-3">No PDO</th>
                                        <th className="px-3 py-3">Posting Date</th>
                                        <th className="px-3 py-3 text-right">Kas Bank</th>
                                        <th className="px-3 py-3 text-right">Kas Tunai</th>
                                        <th className="px-3 py-3 text-right">Jumlah PDO</th>
                                        <th className="px-3 py-3 text-right">Jumlah Ditransfer</th>
                                        <th className="px-3 py-3 text-right">Sisa PDO</th>
                                        <th className="px-3 py-3 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                                                {error ? error : 'Tidak ada data.'}
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((r, idx) => (
                                        <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                                            <td className="px-3 py-2 font-medium">{renderValue(r?.no_pdo)}</td>
                                            <td className="px-3 py-2">{renderValue(r?.posting_date)}</td>
                                            <td className="px-3 py-2 text-right">{formatRupiah(r?.kas_bank)}</td>
                                            <td className="px-3 py-2 text-right">{formatRupiah(r?.kas_tunai)}</td>
                                            <td className="px-3 py-2 text-right">{formatRupiah(r?.jumlah_pdo)}</td>
                                            <td className="px-3 py-2 text-right">{formatRupiah(r?.jumlah_ditransfer)}</td>
                                            <td className="px-3 py-2 text-right">{formatRupiah(r?.sisa_pdo)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                                                    onClick={() => {
                                                        setPdoNo(r.no_pdo);
                                                        setPdoPage(1);
                                                        setPdoPageSize(5);
                                                        setPdoModalOpen(true);
                                                    }}
                                                    title="Lihat Detail"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                                                    onClick={() =>
                                                        window.open(
                                                            `/pembayaran/permintaan-dana-operasional/${encodeURIComponent(
                                                                r.no_pdo,
                                                            )}/print`,
                                                            '_blank',
                                                        )
                                                    }
                                                    title="Print PDO"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
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
                    </CardContent>
                </Card>

                {/* Invoice detail modal (persis seperti halaman invoice masuk) */}
                <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-hidden">
                        <DialogHeader>
                            <DialogTitle>Detail Invoice</DialogTitle>
                            <DialogDescription>Informasi header dan detail invoice masuk.</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
                            <div className="grid gap-4 lg:grid-cols-2 rounded-lg border border-sidebar-border/70 p-4 text-sm overflow-auto">
                                {invoiceLoading && <p className="text-muted-foreground">Memuat detail...</p>}
                                {!invoiceLoading && invoiceError && (
                                    <p className="text-rose-600">{invoiceError}</p>
                                )}
                                {!invoiceLoading && !invoiceError && invoiceDetail && (
                                    <>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">No FI</span>
                                                <span>{invoiceDetail.no_doc ?? '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">No Invoice</span>
                                                <span>{invoiceDetail.t_doc ?? '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Ref PO</span>
                                                <span>{invoiceDetail.ref_po ?? '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Date</span>
                                                <span>{formatDate(invoiceDetail.doc_rec)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Invoice Date</span>
                                                <span>{formatDate(invoiceDetail.inv_d)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Posting Date</span>
                                                <span>{formatDate(invoiceDetail.post)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Payment Terms</span>
                                                <span>{invoiceDetail.p_term ?? '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Nama Vendor</span>
                                                <span>{invoiceDetail.nm_vdr ?? '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Total Price</span>
                                                <span>Rp {formatNumber(invoiceDetail.a_idr ?? 0)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Price PPN</span>
                                                <span>Rp {formatNumber(invoiceDetail.tax ?? 0)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Grand Total</span>
                                                <span className="font-semibold">Rp {formatNumber(invoiceDetail.total ?? 0)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Pembayaran</span>
                                                <span>Rp {formatNumber(invoiceDetail.pembayaran ?? 0)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Sisa Bayar</span>
                                                <span>Rp {formatNumber(invoiceDetail.sisa_bayar ?? 0)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Tanggal Bayar</span>
                                                <span>{formatDate(invoiceDetail.tgl_bayar)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">No Gudang</span>
                                                <span>{invoiceDetail.no_gudang ?? '-'}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Input
                                    placeholder="Cari material..."
                                    value={invoiceSearch}
                                    onChange={(e) => {
                                        setInvoiceSearch(e.target.value);
                                        setInvoiceCurrentPage(1);
                                    }}
                                    className="w-full max-w-xs"
                                />
                                <Select
                                    value={invoicePageSize === Infinity ? 'all' : String(invoicePageSize)}
                                    onValueChange={(val) => {
                                        setInvoiceCurrentPage(1);
                                        setInvoicePageSize(val === 'all' ? Infinity : Number(val));
                                    }}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Tampilkan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[5, 10, 25, 50].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="all">Semua data</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex-1 overflow-auto rounded-lg border border-sidebar-border/70">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Material</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right">Total Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedInvoiceItems.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    Tidak ada data.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {displayedInvoiceItems.map((item, idx) => (
                                            <TableRow key={`${item.no_doc}-${item.mat}-${idx}`}>
                                                <TableCell>{item.mat ?? '-'}</TableCell>
                                                <TableCell className="text-right">{formatNumber(item.qty_gr ?? 0)}</TableCell>
                                                <TableCell className="text-right">Rp {formatNumber(item.harga ?? 0)}</TableCell>
                                                <TableCell className="text-right">Rp {formatNumber(item.ttl_harga ?? 0)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {invoicePageSize !== Infinity && invoiceTotalPages > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>Total data: {filteredInvoiceItems.length}</span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setInvoiceCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={invoiceCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span>
                                            Halaman {invoiceCurrentPage} / {invoiceTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setInvoiceCurrentPage((p) => Math.min(invoiceTotalPages, p + 1))}
                                            disabled={invoiceCurrentPage === invoiceTotalPages}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Detail PDO modal */}
                <Dialog
                    open={pdoModalOpen}
                    onOpenChange={(open) => {
                        setPdoModalOpen(open);
                        if (!open) {
                            setPdoRows([]);
                            setPdoTotal(0);
                            setPdoNo('');
                            setPdoPage(1);
                            setPdoPageSize(5);
                            setPdoSearch('');
                            setPdoDebouncedSearch('');
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail PDO</DialogTitle>
                            <DialogDescription>
                                Menampilkan baris detail PDO untuk {pdoNo || '-'}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="w-full sm:max-w-md">
                                    <Input
                                        value={pdoSearch}
                                        onChange={(e) => setPdoSearch(e.target.value)}
                                        placeholder="Cari No FI atau Ref PO..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Tampil</span>
                                    <Select
                                        value={String(pdoPageSize)}
                                        onValueChange={(val) =>
                                            setPdoPageSize(val === 'all' ? 'all' : Number(val))
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
                            </div>

                            <div className="relative overflow-x-auto rounded-xl border border-white/10 bg-card">
                                {pdoLoading && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                                        </div>
                                    </div>
                                )}
                                <table className="min-w-[1200px] w-full text-sm text-left">
                                    <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                                        <tr>
                                            <th className="px-3 py-3">No FI</th>
                                            <th className="px-3 py-3">Posting Date</th>
                                            <th className="px-3 py-3">Inv Date</th>
                                            <th className="px-3 py-3">Ref PO</th>
                                            <th className="px-3 py-3">Vendor</th>
                                            <th className="px-3 py-3 text-right">Amount</th>
                                            <th className="px-3 py-3 text-right">Paid</th>
                                            <th className="px-3 py-3">Pay Date</th>
                                            <th className="px-3 py-3 text-right">PDO Now</th>
                                            <th className="px-3 py-3 text-right">Last End PDO</th>
                                            <th className="px-3 py-3">Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pdoRows.length === 0 && !pdoLoading && (
                                            <tr>
                                                <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                                                    Tidak ada data.
                                                </td>
                                            </tr>
                                        )}
                                        {pdoRows.map((r, idx) => (
                                            <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                                                <td className="px-3 py-2">
                                                    {r?.no_fi ? (
                                                        <button
                                                            type="button"
                                                            className="text-left underline-offset-4 hover:underline"
                                                            onClick={() => openInvoiceDetail(r.no_fi)}
                                                        >
                                                        {r.no_fi}
                                                    </button>
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                            <td className="px-3 py-2">{renderValue(r?.posting_date)}</td>
                                            <td className="px-3 py-2">{renderValue(r?.inv_date)}</td>
                                            <td className="px-3 py-2">
                                                {r?.ref_po ? (
                                                    <button
                                                            type="button"
                                                            className="text-left underline-offset-4 hover:underline"
                                                            onClick={() => openPoDetail(r.ref_po)}
                                                        >
                                                            {r.ref_po}
                                                        </button>
                                                    ) : (
                                                        ''
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">{renderValue(r?.vendor)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.jumlah_inv)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.jumlah_bayar)}</td>
                                                <td className="px-3 py-2">{renderValue(r?.tgl_bayar)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.pdo_now)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.lastend_pdo)}</td>
                                                <td className="px-3 py-2">{renderValue(r?.remark)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {pdoPageSize !== 'all' && pdoTotalPages > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>Total data: {new Intl.NumberFormat('id-ID').format(pdoTotal)}</span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pdoPage === 1 || pdoLoading}
                                            onClick={() => setPdoPage((p) => Math.max(1, p - 1))}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span>
                                            Halaman {pdoPage} / {pdoTotalPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pdoPage >= pdoTotalPages || pdoLoading}
                                            onClick={() => setPdoPage((p) => Math.min(pdoTotalPages, p + 1))}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* PO detail modal (full like purchase order page) */}
                <Dialog
                    open={poModalOpen}
                    onOpenChange={(open) => {
                        setPoModalOpen(open);
                        if (!open) {
                            setSelectedPo(null);
                            setSelectedDetails([]);
                            setPoDetailError('');
                            setPoDetailLoading(false);
                            setDetailSearch('');
                            setDebouncedDetailSearch('');
                            setDetailPageSize(5);
                            setDetailCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent
                        className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto"
                        aria-describedby="pdo-po-detail-desc"
                    >
                        <DialogHeader>
                            <DialogTitle>Detail Purchase Order</DialogTitle>
                            <DialogDescription id="pdo-po-detail-desc">
                                Menampilkan informasi header dan detail material PO.
                            </DialogDescription>
                        </DialogHeader>

                        {!selectedPo && (
                            <p className="text-sm text-muted-foreground">
                                Data tidak tersedia.
                            </p>
                        )}

                        {selectedPo && (
                            <div className="flex flex-col gap-6 text-sm">
                                <div className="grid gap-6 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Data PO
                                        </h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    No PO
                                                </span>
                                                <span>
                                                    {renderValue(selectedPo.no_po)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Date
                                                </span>
                                                <span>
                                                    {getValue(selectedPo, [
                                                        'tgl',
                                                        'Tgl',
                                                        'date',
                                                        'Date',
                                                    ])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Ref PR
                                                </span>
                                                <span>
                                                    {renderValue(selectedPo.ref_pr)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Ref Quota
                                                </span>
                                                <span>
                                                    {renderValue(selectedPo.ref_quota)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Customer
                                                </span>
                                                <span>
                                                    {getValue(selectedPo, [
                                                        'for_cust',
                                                        'for_cus',
                                                        'for_customer',
                                                    ])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Ref PO In
                                                </span>
                                                <span>
                                                    {renderValue(selectedPo.ref_poin)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Nama Vendor
                                                </span>
                                                <span>
                                                    {getValue(selectedPo, [
                                                        'nm_vdr',
                                                        'Nm_vdr',
                                                        'vendor',
                                                        'Vendor',
                                                    ])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    PPN
                                                </span>
                                                <span>
                                                    {getValue(selectedPo, ['ppn', 'Ppn', 'PPN', 'PPn'])}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Detail Pengiriman
                                        </h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Delivery Time
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['del_time'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Payment Terms
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['payment_terms'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Franco Loco
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['franco_loco'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 1
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['ket1'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 2
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['ket2'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 3
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['ket3'])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 4
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, ['ket4'])}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">
                                        Ringkasan Harga
                                    </h3>
                                    <div className="grid gap-2 max-w-xl">
                                        <div className="grid grid-cols-[200px_1fr] gap-2">
                                            <span className="text-muted-foreground">
                                                Sub Total
                                            </span>
                                            <span>
                                                {formatRupiah(
                                                    getValue(selectedPo, [
                                                        's_total',
                                                        'S_total',
                                                        'S_TOTAL',
                                                        'subtotal',
                                                        'Sub_total',
                                                    ])
                                                )}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[200px_1fr] gap-2">
                                            <span className="text-muted-foreground">
                                                Total PPN
                                            </span>
                                            <span>
                                                {formatRupiah(
                                                    getValue(selectedPo, [
                                                        'h_ppn',
                                                        'H_ppn',
                                                        'H_PPN',
                                                        'ppn',
                                                        'Ppn',
                                                        'PPN',
                                                    ])
                                                )}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[200px_1fr] gap-2">
                                            <span className="text-muted-foreground">
                                                Grand Total
                                            </span>
                                            <span>
                                                {formatRupiah(
                                                    getValue(selectedPo, [
                                                        'g_total',
                                                        'G_total',
                                                        'total',
                                                        'Total',
                                                    ])
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-base font-semibold">
                                            Data Material
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                                                value={detailPageSize === Infinity ? 'all' : detailPageSize}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setDetailPageSize(value === 'all' ? Infinity : Number(value));
                                                    setDetailCurrentPage(1);
                                                }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value="all">Semua</option>
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="Cari material..."
                                                className="h-8 rounded-md border border-input bg-background px-3 text-xs shadow-sm w-40"
                                                value={detailSearch}
                                                onChange={(event) => setDetailSearch(event.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">No</th>
                                                    <th className="px-4 py-3 text-left">Material</th>
                                                    <th className="px-4 py-3 text-left">Qty</th>
                                                    <th className="px-4 py-3 text-left">Satuan</th>
                                                    <th className="px-4 py-3 text-left">Price</th>
                                                    <th className="px-4 py-3 text-left">Total Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {poDetailLoading && (
                                                    <tr>
                                                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                                                            Memuat detail PO...
                                                        </td>
                                                    </tr>
                                                )}
                                                {!poDetailLoading && displayedDetailItems.length === 0 && (
                                                    <tr>
                                                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                                                            {poDetailError ? poDetailError : 'Tidak ada data.'}
                                                        </td>
                                                    </tr>
                                                )}
                                                {!poDetailLoading && displayedDetailItems.map((detail, idx) => (
                                                    <tr key={`${detail.no_po}-${detail.no}-${idx}`} className="border-t border-sidebar-border/70">
                                                        <td className="px-4 py-3">{renderValue(detail.no)}</td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, ['material', 'Material'])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, ['qty', 'Qty'])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, ['unit', 'Unit'])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(getRawValue(detail, ['price', 'Price']))}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(getRawValue(detail, ['total_price', 'Total_price']))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {!poDetailLoading && detailPageSize !== Infinity && detailTotalItems > 0 && (
                                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <span>
                                                Menampilkan {Math.min((detailCurrentPage - 1) * detailPageSize + 1, detailTotalItems)}-
                                                {Math.min(detailCurrentPage * detailPageSize, detailTotalItems)} dari {detailTotalItems}
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDetailCurrentPage((p) => Math.max(1, p - 1))}
                                                    disabled={detailCurrentPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="text-sm text-muted-foreground">
                                                    Halaman {detailCurrentPage} dari {detailTotalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDetailCurrentPage((p) => Math.min(detailTotalPages, p + 1))}
                                                    disabled={detailCurrentPage === detailTotalPages}
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
            </div>
        </AppLayout>
    );
}
