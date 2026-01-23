import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Eye, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Tanda Terima Invoice', href: '/penjualan/tanda-terima-invoice' },
];

const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
    const raw = String(value).trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const number = Number(normalized);
        return Number.isNaN(number) ? 0 : number;
    }
    const normalized = cleaned.replace(',', '.');
    const number = Number(normalized);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;

const isBlank = (value) => {
    const raw = String(value ?? '').trim();
    return raw === '' || raw.toUpperCase() === 'NULL';
};

export default function TandaTerimaInvoiceIndex() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('pending');

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailHeader, setDetailHeader] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailGrandTotal, setDetailGrandTotal] = useState(0);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);

    const [isPendingOpen, setIsPendingOpen] = useState(false);
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingPageSize, setPendingPageSize] = useState(5);
    const [pendingCurrentPage, setPendingCurrentPage] = useState(1);

    const [isReceiveOpen, setIsReceiveOpen] = useState(false);
    const [receiveLoading, setReceiveLoading] = useState(false);
    const [receiveForm, setReceiveForm] = useState({
        no_ttinv: '',
        tgl_doc: '',
        g_total: 0,
        nm_penerima: '',
        tgl_terima: new Date().toISOString().slice(0, 10),
    });
    const [receiveSaving, setReceiveSaving] = useState(false);

    const fetchRows = () => {
        setLoading(true);
        setError('');
        fetch('/penjualan/tanda-terima-invoice/data', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setRows(Array.isArray(data?.data) ? data.data : []);
            })
            .catch(() => {
                setError('Gagal memuat data tanda terima.');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchRows();
    }, []);

    const pendingCount = useMemo(() => {
        return rows.filter((row) => isBlank(row.nm_penerima)).length;
    }, [rows]);

    const filteredDetailItems = useMemo(() => {
        const term = detailSearch.trim().toLowerCase();
        if (!term) return detailItems;
        return detailItems.filter((item) => {
            const noInv = String(item.no_inv || '').toLowerCase();
            const refPo = String(item.ref_po || '').toLowerCase();
            return noInv.includes(term) || refPo.includes(term);
        });
    }, [detailItems, detailSearch]);

    const detailTotalItems = filteredDetailItems.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) return filteredDetailItems;
        const startIndex = (detailCurrentPage - 1) * detailPageSize;
        return filteredDetailItems.slice(startIndex, startIndex + detailPageSize);
    }, [filteredDetailItems, detailCurrentPage, detailPageSize]);

    useEffect(() => {
        setDetailCurrentPage(1);
    }, [detailPageSize, detailSearch, isDetailOpen]);

    useEffect(() => {
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

    const pendingRows = useMemo(() => {
        return rows.filter((row) => isBlank(row.nm_penerima));
    }, [rows]);

    const filteredPendingRows = useMemo(() => {
        const term = pendingSearch.trim().toLowerCase();
        if (!term) return pendingRows;
        return pendingRows.filter((row) =>
            String(row.no_ttinv || '').toLowerCase().includes(term),
        );
    }, [pendingRows, pendingSearch]);

    const pendingTotalItems = filteredPendingRows.length;
    const pendingTotalPages = useMemo(() => {
        if (pendingPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(pendingTotalItems / pendingPageSize));
    }, [pendingPageSize, pendingTotalItems]);

    const displayedPendingRows = useMemo(() => {
        if (pendingPageSize === Infinity) return filteredPendingRows;
        const startIndex = (pendingCurrentPage - 1) * pendingPageSize;
        return filteredPendingRows.slice(startIndex, startIndex + pendingPageSize);
    }, [filteredPendingRows, pendingCurrentPage, pendingPageSize]);

    useEffect(() => {
        setPendingCurrentPage(1);
    }, [pendingPageSize, pendingSearch]);

    useEffect(() => {
        if (pendingCurrentPage > pendingTotalPages) {
            setPendingCurrentPage(pendingTotalPages);
        }
    }, [pendingCurrentPage, pendingTotalPages]);

    const filteredRows = useMemo(() => {
        let filtered = rows;
        if (statusFilter === 'pending') {
            filtered = filtered.filter((row) => isBlank(row.nm_penerima));
        }
        if (statusFilter === 'received') {
            filtered = filtered.filter((row) => !isBlank(row.nm_penerima));
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            filtered = filtered.filter((row) => {
                return (
                    String(row.no_ttinv ?? '').toLowerCase().includes(term) ||
                    String(row.nm_cs ?? '').toLowerCase().includes(term)
                );
            });
        }
        return filtered;
    }, [rows, statusFilter, searchTerm]);

    const totalItems = filteredRows.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedRows = useMemo(() => {
        if (pageSize === Infinity) return filteredRows;
        const startIndex = (currentPage - 1) * pageSize;
        return filteredRows.slice(startIndex, startIndex + pageSize);
    }, [filteredRows, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const openDetail = (noTtInv) => {
        if (!noTtInv) return;
        setIsDetailOpen(true);
        setDetailLoading(true);
        setDetailError('');
        setDetailHeader(null);
        setDetailItems([]);
        setDetailGrandTotal(0);

        fetch(
            `/penjualan/tanda-terima-invoice/details?no_ttinv=${encodeURIComponent(
                noTtInv,
            )}`,
            {
            headers: { Accept: 'application/json' },
        },
        )
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setDetailHeader(data?.header ?? null);
                setDetailItems(Array.isArray(data?.items) ? data.items : []);
                setDetailGrandTotal(toNumber(data?.grand_total));
            })
            .catch(() => setDetailError('Gagal memuat detail tanda terima.'))
            .finally(() => setDetailLoading(false));
    };

    const openReceive = (noTtInv) => {
        if (!noTtInv) return;
        setIsReceiveOpen(true);
        setReceiveLoading(true);
        fetch(
            `/penjualan/tanda-terima-invoice/receive?no_ttinv=${encodeURIComponent(
                noTtInv,
            )}`,
            {
            headers: { Accept: 'application/json' },
        },
        )
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                const info = data?.data ?? {};
                setReceiveForm({
                    no_ttinv: info?.no_ttinv ?? noTtInv,
                    tgl_doc: info?.tgl_doc ?? '',
                    g_total: info?.g_total ?? 0,
                    nm_penerima: '',
                    tgl_terima: new Date().toISOString().slice(0, 10),
                });
            })
            .catch(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal memuat data penerimaan.',
                });
                setIsReceiveOpen(false);
            })
            .finally(() => setReceiveLoading(false));
    };

    const handleSaveReceive = () => {
        if (receiveSaving) return;
        setReceiveSaving(true);
        fetch('/penjualan/tanda-terima-invoice/receive', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(receiveForm),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.message || 'Gagal menyimpan data.');
                }
                setIsReceiveOpen(false);
                fetchRows();
                Swal.fire({
                    icon: 'success',
                    title: 'Invoice berhasil diterima.',
                    timer: 1500,
                    showConfirmButton: false,
                });
            })
            .catch((error) => {
                Swal.fire({
                    icon: 'error',
                    title: error?.message || 'Gagal menyimpan data.',
                });
            })
            .finally(() => setReceiveSaving(false));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tanda Terima Invoice" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tanda Terima Invoice</h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan tanda terima invoice.
                        </p>
                    </div>
                    <Button asChild type="button" variant="outline">
                        <Link href="/penjualan/tanda-terima-invoice/create">
                            Buat Tanda Terima
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div
                        className="cursor-pointer rounded-xl border border-border/60 bg-card p-4 transition hover:border-primary/60 hover:shadow-md"
                        onClick={() => setIsPendingOpen(true)}
                    >
                        <div className="text-sm font-medium">
                            Invoice Belum Diterima
                        </div>
                        <div className="mt-2 text-3xl font-semibold">
                            {formatNumber(pendingCount)} Invoice
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                        <div>
                            <div className="text-base font-semibold">Daftar Tanda Terima</div>
                            <div className="text-sm text-muted-foreground">
                                Data tanda terima invoice.
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <select
                            className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                            value={pageSize === Infinity ? 'all' : pageSize}
                            onChange={(event) => {
                                const value = event.target.value;
                                setPageSize(value === 'all' ? Infinity : Number(value));
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value="all">Semua</option>
                        </select>
                        <select
                            className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="pending">Belum diterima</option>
                            <option value="received">Sudah diterima</option>
                            <option value="all">Semua data</option>
                        </select>
                        <Input
                            placeholder="Cari nomor tanda terima atau customer..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="min-w-[220px]"
                        />
                    </div>
                    <div className="px-4 pb-4">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nomor Tanda Terima</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Qty Invoice</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                Memuat data...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!loading && error && (
                                        <TableRow>
                                            <TableCell colSpan={5}>{error}</TableCell>
                                        </TableRow>
                                    )}
                                    {!loading && !error && displayedRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>Tidak ada data.</TableCell>
                                        </TableRow>
                                    )}
                                    {!loading &&
                                        !error &&
                                        displayedRows.map((row, index) => (
                                            <TableRow
                                                key={`${row.no_ttinv}-${row.tgl}-${row.nm_cs}-${index}`}
                                            >
                                                <TableCell>{row.no_ttinv}</TableCell>
                                                <TableCell>{row.tgl_doc}</TableCell>
                                                <TableCell>{formatNumber(row.qty_invoice)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="inline-flex items-center justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openDetail(row.no_ttinv)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <a
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
                                                            href={`/penjualan/tanda-terima-invoice/print?no_ttinv=${encodeURIComponent(
                                                                row.no_ttinv ?? '',
                                                            )}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>

                        {pageSize !== Infinity && totalItems > 0 && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {(currentPage - 1) * pageSize + 1} -{' '}
                                    {Math.min(currentPage * pageSize, totalItems)} dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) => Math.max(1, page - 1))
                                        }
                                        disabled={currentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {currentPage} dari {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) => Math.min(totalPages, page + 1))
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:h-[92vh] sm:w-[92vw] sm:max-w-[92vw]">
                    <DialogHeader>
                        <DialogTitle>Detail Tanda Terima</DialogTitle>
                        <DialogDescription>Informasi tanda terima invoice.</DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="py-6 text-sm text-muted-foreground">Memuat detail...</div>
                    ) : detailError ? (
                        <div className="py-6 text-sm text-destructive">{detailError}</div>
                    ) : detailHeader ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2 text-sm">
                                <div className="space-y-2">
                                    <div className="flex justify-between gap-3">
                                        <span>No. Tanda Terima Invoice</span>
                                        <span className="font-medium">{detailHeader.no_ttinv}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Date</span>
                                        <span className="font-medium">{detailHeader.tgl}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Document Date</span>
                                        <span className="font-medium">{detailHeader.tgl_doc}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between gap-3">
                                        <span>Post Date</span>
                                        <span className="font-medium">{detailHeader.tgl_pos}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Customer</span>
                                        <span className="font-medium">{detailHeader.nm_cs}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Nama Penerima</span>
                                        <span className="font-medium">
                                            {detailHeader.nm_penerima || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Tanggal Terima</span>
                                        <span className="font-medium">
                                            {detailHeader.tgl_terima || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Grand Total</span>
                                        <span className="font-medium">{formatRupiah(detailGrandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Data Invoice</div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                        value={detailPageSize === Infinity ? 'all' : detailPageSize}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setDetailPageSize(
                                                value === 'all' ? Infinity : Number(value),
                                            );
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                    <Input
                                        placeholder="Cari no invoice atau ref po..."
                                        value={detailSearch}
                                        onChange={(event) => setDetailSearch(event.target.value)}
                                        className="min-w-[220px]"
                                    />
                                </div>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No Invoice</TableHead>
                                                <TableHead>No Faktur</TableHead>
                                                <TableHead>Ref PO</TableHead>
                                                <TableHead>Total Price</TableHead>
                                                <TableHead>Remark</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {detailTotalItems === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5}>
                                                        Tidak ada data invoice.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {displayedDetailItems.map((item) => (
                                                <TableRow key={`${item.no_inv}-${item.ref_po}`}>
                                                    <TableCell>{item.no_inv}</TableCell>
                                                    <TableCell>{item.no_faktur}</TableCell>
                                                    <TableCell>{item.ref_po}</TableCell>
                                                    <TableCell>{formatRupiah(item.total)}</TableCell>
                                                    <TableCell>{item.remark}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {detailPageSize !== Infinity && detailTotalItems > 0 && (
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {(detailCurrentPage - 1) * detailPageSize + 1} -{' '}
                                            {Math.min(
                                                detailCurrentPage * detailPageSize,
                                                detailTotalItems,
                                            )}{' '}
                                            dari {detailTotalItems} data
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setDetailCurrentPage((page) => Math.max(1, page - 1))
                                                }
                                                disabled={detailCurrentPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span>
                                                Halaman {detailCurrentPage} dari {detailTotalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setDetailCurrentPage((page) =>
                                                        Math.min(detailTotalPages, page + 1),
                                                    )
                                                }
                                                disabled={detailCurrentPage === detailTotalPages}
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-sm text-muted-foreground">Tidak ada data.</div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isPendingOpen} onOpenChange={setIsPendingOpen}>
                <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:h-[92vh] sm:w-[92vw] sm:max-w-[92vw]">
                    <DialogHeader>
                        <DialogTitle>Invoice Belum Diterima</DialogTitle>
                        <DialogDescription>Daftar invoice yang belum diterima.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                            value={pendingPageSize === Infinity ? 'all' : pendingPageSize}
                            onChange={(event) => {
                                const value = event.target.value;
                                setPendingPageSize(value === 'all' ? Infinity : Number(value));
                            }}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value="all">Semua</option>
                        </select>
                        <Input
                            placeholder="Cari nomor tanda terima..."
                            value={pendingSearch}
                            onChange={(event) => setPendingSearch(event.target.value)}
                            className="min-w-[220px]"
                        />
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nomor Tanda Terima</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Qty Invoice</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingTotalItems === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>Tidak ada data.</TableCell>
                                    </TableRow>
                                )}
                                {displayedPendingRows.map((row, index) => (
                                        <TableRow
                                            key={`pending-${row.no_ttinv}-${row.tgl}-${row.nm_cs}-${index}`}
                                        >
                                            <TableCell>{row.no_ttinv}</TableCell>
                                            <TableCell>{row.tgl_doc}</TableCell>
                                            <TableCell>{formatNumber(row.qty_invoice)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openReceive(row.no_ttinv)}
                                                    >
                                                        Terima Invoice
                                                    </Button>
                                                    <Button asChild type="button" variant="ghost" size="sm">
                                                        <Link
                                                            href={`/penjualan/tanda-terima-invoice/edit?no_ttinv=${encodeURIComponent(
                                                                row.no_ttinv ?? '',
                                                            )}`}
                                                        >
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                    {pendingPageSize !== Infinity && pendingTotalItems > 0 && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                                Menampilkan {(pendingCurrentPage - 1) * pendingPageSize + 1} -{' '}
                                {Math.min(
                                    pendingCurrentPage * pendingPageSize,
                                    pendingTotalItems,
                                )}{' '}
                                dari {pendingTotalItems} data
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPendingCurrentPage((page) => Math.max(1, page - 1))
                                    }
                                    disabled={pendingCurrentPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {pendingCurrentPage} dari {pendingTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPendingCurrentPage((page) =>
                                            Math.min(pendingTotalPages, page + 1),
                                        )
                                    }
                                    disabled={pendingCurrentPage === pendingTotalPages}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Terima Invoice</DialogTitle>
                        <DialogDescription>
                            Input penerimaan invoice.
                        </DialogDescription>
                    </DialogHeader>
                    {receiveLoading ? (
                        <div className="py-6 text-sm text-muted-foreground">Memuat data...</div>
                    ) : (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Tanda Terima</label>
                                <Input value={receiveForm.no_ttinv} readOnly />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Document Date</label>
                                <Input value={receiveForm.tgl_doc} readOnly />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Total Price</label>
                                <Input value={formatRupiah(receiveForm.g_total)} readOnly />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Nama Penerima</label>
                                <Input
                                    value={receiveForm.nm_penerima}
                                    onChange={(event) =>
                                        setReceiveForm((prev) => ({
                                            ...prev,
                                            nm_penerima: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Tanggal Terima</label>
                                <Input
                                    type="date"
                                    value={receiveForm.tgl_terima}
                                    onChange={(event) =>
                                        setReceiveForm((prev) => ({
                                            ...prev,
                                            tgl_terima: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <Button
                                    type="button"
                                    onClick={handleSaveReceive}
                                    disabled={receiveSaving}
                                >
                                    {receiveSaving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
