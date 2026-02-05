import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ActionIconButton } from '@/components/action-icon-button';
import { Eye, Printer, Pencil, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { readApiError, normalizeApiError } from '@/lib/api-error';
import { ErrorState } from '@/components/data-states/ErrorState';
import { ShadcnTableStateRows } from '@/components/data-states/TableStateRows';

const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua data' },
    { value: 'belum_dibayar', label: 'Invoice belum dibayar (pembayaran = 0)' },
    { value: 'belum_lunas', label: 'Invoice belum lunas (sisa_bayar ≠ 0)' },
    { value: 'belum_dijurnal', label: 'Invoice belum dijurnal' },
];

const PAGE_SIZE_OPTIONS = [
    { value: '5', label: '5' },
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
const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;
const getValue = (source, keys) => {
    for (const key of keys) {
        const val = source?.[key];
        if (val !== null && val !== undefined && val !== '') {
            return val;
        }
    }
    return '-';
};

const getInvoiceStatus = (row) => {
    const pembayaran = Number(row?.pembayaran ?? 0);
    const sisa = Number(row?.sisa_bayar ?? 0);
    const jurnal = String(row?.jurnal ?? '').trim();

    if (pembayaran <= 0) {
        return { label: 'Belum dibayar', variant: 'destructive' };
    }
    if (!jurnal) {
        return { label: 'Belum dijurnal', variant: 'secondary' };
    }
    if (sisa === 0) {
        return { label: 'Lunas', variant: 'default' };
    }
    return { label: 'Belum lunas', variant: 'outline' };
};

export default function InvoiceMasukIndex({ invoices = [], summary = {}, filters = {} }) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [pageSize, setPageSize] = useState(5);
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [poDetails, setPoDetails] = useState([]);
    const [poHeader, setPoHeader] = useState(null);
    const [poDetailLoading, setPoDetailLoading] = useState(false);
    const [poDetailError, setPoDetailError] = useState(null);
    const [selectedRefPo, setSelectedRefPo] = useState(null);

    const [unbilledModalOpen, setUnbilledModalOpen] = useState(false);
    const [unbilledData, setUnbilledData] = useState([]);
    const [unbilledSearch, setUnbilledSearch] = useState('');
    const [unbilledPageSize, setUnbilledPageSize] = useState(5);
    const [unbilledCurrentPage, setUnbilledCurrentPage] = useState(1);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState(null);
    const [lastInvoiceNoDoc, setLastInvoiceNoDoc] = useState(null);
    const [invoicePageSize, setInvoicePageSize] = useState(5);
    const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [remoteInvoices, setRemoteInvoices] = useState(invoices);
    const [remoteSummary, setRemoteSummary] = useState(summary);

    const [paidPeriod, setPaidPeriod] = useState('today');
    const [paidSummary, setPaidSummary] = useState({ paid_count: 0, paid_total: 0 });
    const [paidModalOpen, setPaidModalOpen] = useState(false);
    const [paidData, setPaidData] = useState([]);
    const [paidSearch, setPaidSearch] = useState('');
    const [paidPageSize, setPaidPageSize] = useState(5);
    const [paidCurrentPage, setPaidCurrentPage] = useState(1);
    const [paidLoading, setPaidLoading] = useState(false);
    const [paidError, setPaidError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [error, setError] = useState(null);

    const openUnbilledModal = () => {
        setUnbilledData(
            remoteInvoices.filter((row) => Number(row.pembayaran) === 0)
        );
        setUnbilledCurrentPage(1);
        setUnbilledModalOpen(true);
    };

    const fetchInvoices = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                search: searchTerm,
                status: statusFilter,
                pageSize: pageSize === Infinity ? 'all' : pageSize,
            });
            const res = await fetch(`/pembelian/invoice-masuk/data?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await readApiError(res);
            const data = await res.json();
            setRemoteInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
            setRemoteSummary(data?.summary ?? { unbilled_count: 0, unbilled_total: 0 });
            setInitialLoaded(true);
        } catch (err) {
            setError(normalizeApiError(err, 'Gagal memuat data invoice.'));
            setRemoteInvoices([]);
            setRemoteSummary({ unbilled_count: 0, unbilled_total: 0 });
            setInitialLoaded(false);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchInvoices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pageSize, searchTerm]);

    const fetchPaid = async (period, search = '') => {
        setPaidLoading(true);
        setPaidError(null);
        try {
            const params = new URLSearchParams({
                period,
                search,
            });
            const res = await fetch(`/pembelian/invoice-masuk/paid?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await readApiError(res);
            const data = await res.json();
            const rows = Array.isArray(data?.invoices) ? data.invoices : [];
            setPaidData(rows);
            setPaidSummary(data?.summary ?? { paid_count: 0, paid_total: 0 });
        } catch (err) {
            setPaidError(normalizeApiError(err, 'Gagal memuat data invoice sudah dibayar.'));
            setPaidData([]);
            setPaidSummary({ paid_count: 0, paid_total: 0 });
        } finally {
            setPaidLoading(false);
        }
    };

    useEffect(() => {
        fetchPaid(paidPeriod, '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paidPeriod]);

    const filtered = useMemo(() => {
        let data = remoteInvoices;

        if (statusFilter === 'belum_dibayar') {
            data = data.filter((row) => Number(row.pembayaran) === 0);
        } else if (statusFilter === 'belum_lunas') {
            data = data.filter((row) => Number(row.sisa_bayar ?? 0) !== 0);
        } else if (statusFilter === 'belum_dijurnal') {
            data = data.filter((row) => !row.jurnal || row.jurnal.trim() === '' || row.jurnal === ' ');
        }

        const term = searchTerm.trim().toLowerCase();
        if (term) {
            data = data.filter((row) =>
                [row.no_doc, row.ref_po, row.nm_vdr]
                    .map((v) => String(v ?? '').toLowerCase())
                    .some((v) => v.includes(term))
            );
        }

        data = [...data].sort((a, b) => String(b.no_doc ?? '').localeCompare(String(a.no_doc ?? '')));
        return data;
    }, [remoteInvoices, searchTerm, statusFilter]);

    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        const size = pageSize || 5;
        return Math.max(1, Math.ceil(filtered.length / size));
    }, [filtered.length, pageSize]);

    const displayed = useMemo(() => {
        if (pageSize === Infinity) return filtered;
        const size = pageSize || 5;
        const start = (currentPage - 1) * size;
        return filtered.slice(start, start + size);
    }, [filtered, pageSize, currentPage]);


    const filteredUnbilled = useMemo(() => {
        const term = unbilledSearch.trim().toLowerCase();
        let data = unbilledData;
        if (term) {
            data = data.filter((row) =>
                [row.no_doc, row.ref_po, row.nm_vdr]
                    .map((v) => String(v ?? '').toLowerCase())
                    .some((v) => v.includes(term))
            );
        }
        return data;
    }, [unbilledData, unbilledSearch]);

    const unbilledTotalPages = useMemo(() => {
        if (unbilledPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(filteredUnbilled.length / unbilledPageSize));
    }, [filteredUnbilled.length, unbilledPageSize]);

    const displayedUnbilled = useMemo(() => {
        if (unbilledPageSize === Infinity) return filteredUnbilled;
        const start = (unbilledCurrentPage - 1) * unbilledPageSize;
        return filteredUnbilled.slice(start, start + unbilledPageSize);
    }, [filteredUnbilled, unbilledPageSize, unbilledCurrentPage]);

    const filteredPaid = useMemo(() => {
        const term = paidSearch.trim().toLowerCase();
        let data = paidData;
        if (term) {
            data = data.filter((row) =>
                [row.no_doc, row.ref_po, row.nm_vdr, row.tgl_bayar]
                    .map((v) => String(v ?? '').toLowerCase())
                    .some((v) => v.includes(term))
            );
        }
        return [...data].sort((a, b) =>
            String(b.tgl_bayar ?? '').localeCompare(String(a.tgl_bayar ?? ''))
        );
    }, [paidData, paidSearch]);

    const paidTotalPages = useMemo(() => {
        if (paidPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(filteredPaid.length / paidPageSize));
    }, [filteredPaid.length, paidPageSize]);

    const displayedPaid = useMemo(() => {
        if (paidPageSize === Infinity) return filteredPaid;
        const start = (paidCurrentPage - 1) * paidPageSize;
        return filteredPaid.slice(start, start + paidPageSize);
    }, [filteredPaid, paidPageSize, paidCurrentPage]);

    const filteredInvoiceItems = useMemo(() => {
        const term = invoiceSearch.trim().toLowerCase();
        let data = invoiceItems;
        if (term) {
            data = data.filter((row) =>
                String(row.mat ?? '').toLowerCase().includes(term)
            );
        }
        return data;
    }, [invoiceItems, invoiceSearch]);

    const invoiceTotalPages = useMemo(() => {
        if (invoicePageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(filteredInvoiceItems.length / invoicePageSize));
    }, [filteredInvoiceItems.length, invoicePageSize]);

    const displayedInvoiceItems = useMemo(() => {
        if (invoicePageSize === Infinity) return filteredInvoiceItems;
        const start = (invoiceCurrentPage - 1) * invoicePageSize;
        return filteredInvoiceItems.slice(start, start + invoicePageSize);
    }, [filteredInvoiceItems, invoicePageSize, invoiceCurrentPage]);
    const openPoDetail = async (refPo) => {
        if (!refPo) return;
        setSelectedRefPo(refPo);
        setPoModalOpen(true);
        setPoDetailLoading(true);
        setPoDetailError(null);
        try {
            const response = await fetch(
                `/pembelian/purchase-order/details?no_po=${encodeURIComponent(refPo)}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setPoHeader(data?.purchaseOrder ?? null);
            setPoDetails(Array.isArray(data?.purchaseOrderDetails) ? data.purchaseOrderDetails : []);
            if (!Array.isArray(data?.purchaseOrderDetails) || data.purchaseOrderDetails.length === 0) {
                setPoDetailError({ summary: 'Detail PO tidak ditemukan.', detail: undefined, status: 404 });
            }
        } catch (error) {
            setPoDetailError(normalizeApiError(error, 'Gagal memuat detail PO.'));
            setPoDetails([]);
            setPoHeader(null);
        } finally {
            setPoDetailLoading(false);
        }
    };

    const openInvoiceDetail = async (noDoc) => {
        if (!noDoc) return;
        setLastInvoiceNoDoc(noDoc);
        if (paidModalOpen) {
            setPaidModalOpen(false);
        }
        setInvoiceModalOpen(true);
        setInvoiceLoading(true);
        setInvoiceError(null);
        setInvoiceItems([]);
        setInvoiceDetail(null);
        setInvoiceCurrentPage(1);
        try {
            const res = await fetch(`/pembelian/invoice-masuk/${encodeURIComponent(noDoc)}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await readApiError(res);
            const data = await res.json();
            setInvoiceDetail(data?.header ?? null);
            const items = Array.isArray(data?.items) ? data.items : [];
            const withNoGudang = items.map((row) => ({...row, no_gudang: row.no_gudang ?? data?.header?.no_gudang ?? null}));
            setInvoiceItems(withNoGudang);
            if (!data?.header) {
                setInvoiceError({ summary: 'Data invoice tidak ditemukan.', detail: undefined, status: 404 });
            }
        } catch (err) {
            setInvoiceError(normalizeApiError(err, 'Gagal memuat detail invoice.'));
            setInvoiceDetail(null);
            setInvoiceItems([]);
        } finally {
            setInvoiceLoading(false);
        }
    };

    const handleDeleteInvoice = async (row) => {
        if (!row?.no_doc) return;
        if (unbilledModalOpen) {
            setUnbilledModalOpen(false);
        }
        const result = await Swal.fire({
            title: 'Hapus invoice?',
            text: `No FI ${row.no_doc} akan dihapus.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            customClass: {
                popup: 'invoice-swal-popup',
            },
        });

        if (!result.isConfirmed) return;
        router.post(
            `/pembelian/invoice-masuk/${row.no_doc}/delete`,
            { ref_po: row.ref_po },
            {
                preserveScroll: true,
                onSuccess: () => {
                    fetchInvoices();
                },
            }
        );
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Invoice Masuk', href: '/pembelian/invoice-masuk' }]}>
            <Head title="Invoice Masuk" />
            <div className="flex flex-col gap-4 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                    <button
                        type="button"
                        onClick={openUnbilledModal}
                        className="h-full w-full text-left"
                    >
                        <Card className="h-full transition hover:border-primary/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Invoice belum ditagihkan</CardTitle>
                                <div className="text-xs text-muted-foreground">Pembayaran = 0</div>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Jumlah invoice</div>
                                    <div className="text-3xl font-semibold leading-none">
                                        {initialLoaded ? remoteSummary.unbilled_count ?? 0 : '-'}
                                    </div>
                                </div>
                                <div className="space-y-1 sm:text-right">
                                    <div className="text-xs text-muted-foreground">Grand total sisa bayar</div>
                                    <div className="text-2xl font-bold leading-none text-foreground">
                                        {initialLoaded
                                            ? `Rp ${formatNumber(remoteSummary.unbilled_total ?? 0)}`
                                            : '-'}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </button>

                    <Card className="h-full transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="text-lg">Invoice sudah dibayar</CardTitle>
                                    <div className="text-xs text-muted-foreground">Berdasarkan tanggal bayar (tgl_bayar)</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={paidPeriod} onValueChange={setPaidPeriod}>
                                        <SelectTrigger className="h-8 w-[140px]">
                                            <SelectValue placeholder="Periode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="today">Hari Ini</SelectItem>
                                            <SelectItem value="this_week">Minggu Ini</SelectItem>
                                            <SelectItem value="this_month">Bulan Ini</SelectItem>
                                            <SelectItem value="this_year">Tahun Ini</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2"
                                        onClick={() => {
                                            setPaidModalOpen(true);
                                            setPaidSearch('');
                                            setPaidPageSize(5);
                                            setPaidCurrentPage(1);
                                            fetchPaid(paidPeriod, '');
                                        }}
                                    >
                                        <Eye className="h-4 w-4" />
                                        Lihat
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-4 pt-2 sm:grid-cols-2">
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Jumlah invoice</div>
                                <div className="text-3xl font-semibold leading-none">
                                    {paidLoading ? '...' : paidSummary?.paid_count ?? 0}
                                </div>
                            </div>
                            <div className="space-y-1 sm:text-right">
                                <div className="text-xs text-muted-foreground">Total pembayaran</div>
                                <div className="text-2xl font-bold leading-none text-foreground">
                                    {paidLoading ? '...' : `Rp ${formatNumber(paidSummary?.paid_total ?? 0)}`}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Data Invoice Masuk</CardTitle>
                            <Link href="/pembelian/invoice-masuk/create">
                                <Button variant="default">Tambah FI</Button>
                            </Link>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Input
                                placeholder="Cari no_doc, ref_po, vendor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full max-w-xs"
                            />
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full max-w-xs">
                                    <SelectValue placeholder="Filter status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={pageSize === Infinity ? 'all' : String(pageSize)} onValueChange={(val) => {
                                    setCurrentPage(1);
                                    setPageSize(val === 'all' ? Infinity : Number(val));
                                }}>
                                <SelectTrigger className="w-32">
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
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead>No FI</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Inv Date</TableHead>
                                    <TableHead>Ref PO</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total Invoice</TableHead>
                                    <TableHead className="text-center">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <ShadcnTableStateRows
                                    columns={8}
                                    loading={loading}
                                    error={error}
                                    onRetry={fetchInvoices}
                                    isEmpty={!loading && !error && displayed.length === 0}
                                    emptyTitle="Belum ada data invoice."
                                    emptyDescription="Silakan tambah FI baru atau ubah filter/pencarian."
                                    emptyActionLabel="Tambah FI"
                                    emptyActionHref="/pembelian/invoice-masuk/create"
                                />
                                {!loading && !error && displayed.map((row) => (
                                    <TableRow key={`${row.no_doc}-${row.doc_rec}`}>
                                        <TableCell>{row.no_doc ?? '-'}</TableCell>
                                        <TableCell>{formatDate(row.doc_rec)}</TableCell>
                                        <TableCell>{formatDate(row.inv_d)}</TableCell>
                                        <TableCell>
                                            {row.ref_po ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openPoDetail(row.ref_po)}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.ref_po}
                                                </button>
                                            ) : (
                                                '-' )}
                                        </TableCell>
                                        <TableCell>{row.nm_vdr ?? '-'}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                const status = getInvoiceStatus(row);
                                                return (
                                                    <Badge variant={status.variant}>
                                                        {status.label}
                                                    </Badge>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">Rp {formatNumber(row.total ?? 0)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <ActionIconButton
                                                    label="Detail"
                                                    variant="outline"
                                                    onClick={() => openInvoiceDetail(row.no_doc)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </ActionIconButton>
                                                <ActionIconButton
                                                    label="Cetak (belum tersedia)"
                                                    variant="outline"
                                                    disabled
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </ActionIconButton>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    {pageSize !== Infinity && filtered.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-4 text-sm text-muted-foreground">
                            <div>
                                Menampilkan {(currentPage - 1) * (pageSize || 5) + 1}
                                {' '} - {Math.min(currentPage * (pageSize || 5), filtered.length)} dari {filtered.length} data
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}

                    </CardContent>
                </Card>
            </div>

            <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Purchase Order</DialogTitle>
                        <DialogDescription>
                            {selectedRefPo ? `Ref PO: ${selectedRefPo}` : 'Pilih ref PO untuk melihat detail.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {poDetailLoading && (
                            <p className="text-sm text-muted-foreground">Memuat detail...</p>
                        )}
                        {!poDetailLoading && poDetailError && (
                            <ErrorState
                                error={poDetailError}
                                onRetry={
                                    selectedRefPo
                                        ? () => openPoDetail(selectedRefPo)
                                        : undefined
                                }
                            />
                        )}
                        {!poDetailLoading && !poDetailError && poDetails.length === 0 && (
                            <p className="text-sm text-muted-foreground">Detail tidak tersedia.</p>
                        )}
                        {!poDetailLoading && (poHeader || poDetails.length > 0) && (
                            <div className="flex flex-col gap-4">
                                {poHeader && (
                                    <div className="grid gap-6 lg:grid-cols-2 text-sm rounded-lg border border-sidebar-border/70 p-4">
                                        <div className="space-y-3">
                                            <h3 className="text-base font-semibold">Data PO</h3>
                                            <div className="grid gap-2">
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">No PO</span>
                                                    <span>{renderValue(poHeader.no_po)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Date</span>
                                                    <span>{formatDate(poHeader.tgl)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Ref PR</span>
                                                    <span>{renderValue(poHeader.ref_pr)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Ref Quota</span>
                                                    <span>{renderValue(poHeader.ref_quota)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Customer</span>
                                                    <span>{renderValue(poHeader.for_cus)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Vendor</span>
                                                    <span>{renderValue(poHeader.nm_vdr)}</span>
                                                </div>
                                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                                    <span className="text-muted-foreground">PPN</span>
                                                    <span>{renderValue(poHeader.ppn)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="text-base font-semibold">Detail Pengiriman</h3>
                                            <div className="grid gap-2">
                                                {(() => {
                                                    const d = poDetails?.[0] ?? {};
                                                    return (
                                                        <>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Delivery Time</span>
                                                                <span>{renderValue(d.del_time)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Payment Terms</span>
                                                                <span>{renderValue(d.payment_terms)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Franco Loco</span>
                                                                <span>{renderValue(d.franco_loco)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Note 1</span>
                                                                <span>{renderValue(d.ket1)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Note 2</span>
                                                                <span>{renderValue(d.ket2)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Note 3</span>
                                                                <span>{renderValue(d.ket3)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                                <span className="text-muted-foreground">Note 4</span>
                                                                <span>{renderValue(d.ket4)}</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {poDetails.length > 0 && (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No</TableHead>
                                                <TableHead>Material</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead className="text-right">Harga</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {poDetails.map((detail, idx) => (
                                                <TableRow key={`${detail.no_po}-${detail.no ?? idx}`}>
                                                    <TableCell>{detail.no ?? idx + 1}</TableCell>
                                                    <TableCell>{detail.material ?? '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(detail.qty ?? 0)}
                                                    </TableCell>
                                                    <TableCell>{detail.unit ?? '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(detail.price ?? 0)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(detail.total_price ?? 0)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={unbilledModalOpen} onOpenChange={setUnbilledModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Invoice belum ditagihkan</DialogTitle>
                        <DialogDescription>Pembayaran = 0</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 h-[calc(100vh-8rem)]">
                        <div className="flex flex-wrap gap-3">
                            <Input
                                placeholder="Cari No FI, Ref PO, Vendor..."
                                value={unbilledSearch}
                                onChange={(e) => {
                                    setUnbilledSearch(e.target.value);
                                    setUnbilledCurrentPage(1);
                                }}
                                className="w-full max-w-xs"
                            />
                            <Select
                                value={unbilledPageSize === Infinity ? 'all' : String(unbilledPageSize)}
                                onValueChange={(val) => {
                                    setUnbilledCurrentPage(1);
                                    setUnbilledPageSize(val === 'all' ? Infinity : Number(val));
                                }}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Tampilkan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[5,10,25,50].map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                    ))}
                                    <SelectItem value="all">Semua data</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 overflow-auto rounded-lg border border-sidebar-border/70">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead>No FI</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Inv Date</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Total Invoice</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <ShadcnTableStateRows
                                        columns={8}
                                        loading={false}
                                        error={null}
                                        isEmpty={unbilledModalOpen && displayedUnbilled.length === 0}
                                        emptyTitle="Tidak ada data."
                                    />
                                    {displayedUnbilled.map((row) => (
                                        <TableRow key={`${row.no_doc}-${row.doc_rec}`}>
                                            <TableCell>{row.no_doc ?? '-'}</TableCell>
                                            <TableCell>{formatDate(row.doc_rec)}</TableCell>
                                            <TableCell>{formatDate(row.inv_d)}</TableCell>
                                            <TableCell>{row.ref_po ?? '-'}</TableCell>
                                            <TableCell>{row.nm_vdr ?? '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">
                                                    Belum dibayar
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">Rp {formatNumber(row.total ?? 0)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <ActionIconButton label="Edit" variant="outline" asChild>
                                                        <Link href={`/pembelian/invoice-masuk/${row.no_doc}/edit`}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </ActionIconButton>
                                                    <ActionIconButton
                                                        label="Hapus"
                                                        variant="outline"
                                                        onClick={() => handleDeleteInvoice(row)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                                    </ActionIconButton>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {unbilledPageSize !== Infinity && filteredUnbilled.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((unbilledCurrentPage - 1) * unbilledPageSize + 1, filteredUnbilled.length)} -
                                    {Math.min(unbilledCurrentPage * unbilledPageSize, filteredUnbilled.length)} dari {filteredUnbilled.length} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUnbilledCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={unbilledCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>Halaman {unbilledCurrentPage} / {unbilledTotalPages}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUnbilledCurrentPage((p) => Math.min(unbilledTotalPages, p + 1))}
                                        disabled={unbilledCurrentPage === unbilledTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
                                <ErrorState
                                    error={invoiceError}
                                    onRetry={
                                        lastInvoiceNoDoc
                                            ? () => openInvoiceDetail(lastInvoiceNoDoc)
                                            : undefined
                                    }
                                />
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
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
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

                        {invoicePageSize !== Infinity && filteredInvoiceItems.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((invoiceCurrentPage - 1) * invoicePageSize + 1, filteredInvoiceItems.length)} -
                                    {Math.min(invoiceCurrentPage * invoicePageSize, filteredInvoiceItems.length)} dari {filteredInvoiceItems.length} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setInvoiceCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={invoiceCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>Halaman {invoiceCurrentPage} / {invoiceTotalPages}</span>
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

            <Dialog open={paidModalOpen} onOpenChange={setPaidModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Invoice sudah dibayar</DialogTitle>
                        <DialogDescription>
                            Berdasarkan tgl_bayar (periode terpilih).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 h-[calc(100vh-8rem)]">
                        <div className="flex flex-wrap gap-3">
                            <Input
                                placeholder="Cari No FI, Ref PO, Vendor, Tgl Bayar..."
                                value={paidSearch}
                                onChange={(e) => {
                                    setPaidSearch(e.target.value);
                                    setPaidCurrentPage(1);
                                }}
                                className="w-full max-w-xs"
                            />
                            <select
                                className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={paidPeriod}
                                onChange={(e) => setPaidPeriod(e.target.value)}
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                            </select>
                            <Select
                                value={paidPageSize === Infinity ? 'all' : String(paidPageSize)}
                                onValueChange={(val) => {
                                    setPaidCurrentPage(1);
                                    setPaidPageSize(val === 'all' ? Infinity : Number(val));
                                }}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Tampilkan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[5,10,25,50].map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                    ))}
                                    <SelectItem value="all">Semua data</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1 overflow-auto rounded-lg border border-sidebar-border/70">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead>No FI</TableHead>
                                        <TableHead>Tgl Bayar</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Inv Date</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Total Invoice</TableHead>
                                        <TableHead className="text-right">Pembayaran</TableHead>
                                        <TableHead className="text-right">Sisa</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <ShadcnTableStateRows
                                        columns={11}
                                        loading={paidLoading}
                                        error={paidError}
                                        onRetry={() => fetchPaid(paidPeriod, paidSearch)}
                                        isEmpty={!paidLoading && !paidError && displayedPaid.length === 0}
                                        emptyTitle="Tidak ada data."
                                    />
                                    {!paidLoading && !paidError && displayedPaid.map((row) => (
                                        <TableRow key={`${row.no_doc}-${row.tgl_bayar}`}>
                                            <TableCell>{row.no_doc ?? '-'}</TableCell>
                                            <TableCell>{formatDate(row.tgl_bayar)}</TableCell>
                                            <TableCell>{formatDate(row.doc_rec)}</TableCell>
                                            <TableCell>{formatDate(row.inv_d)}</TableCell>
                                            <TableCell>{row.ref_po ?? '-'}</TableCell>
                                            <TableCell>{row.nm_vdr ?? '-'}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const status = getInvoiceStatus(row);
                                                    return (
                                                        <Badge variant={status.variant}>
                                                            {status.label}
                                                        </Badge>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">Rp {formatNumber(row.total ?? 0)}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">Rp {formatNumber(row.pembayaran ?? 0)}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">Rp {formatNumber(row.sisa_bayar ?? 0)}</TableCell>
                                            <TableCell className="text-center">
                                                <ActionIconButton
                                                    label="Detail"
                                                    variant="outline"
                                                    onClick={() => openInvoiceDetail(row.no_doc)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </ActionIconButton>
                                            </TableCell>
                                        </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>

                        {paidPageSize !== Infinity && filteredPaid.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((paidCurrentPage - 1) * paidPageSize + 1, filteredPaid.length)} -
                                    {Math.min(paidCurrentPage * paidPageSize, filteredPaid.length)} dari {filteredPaid.length} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPaidCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={paidCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>Halaman {paidCurrentPage} / {paidTotalPages}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPaidCurrentPage((p) => Math.min(paidTotalPages, p + 1))}
                                        disabled={paidCurrentPage === paidTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
