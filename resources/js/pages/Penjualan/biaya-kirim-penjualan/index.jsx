import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Pencil, Printer, Trash } from 'lucide-react';
import Swal from 'sweetalert2';

const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua data' },
    { value: 'belum_dibayar', label: 'Invoice belum dibayar' },
    { value: 'sisa_bayar', label: 'Invoice sisa bayar' },
    { value: 'belum_dijurnal', label: 'Invoice belum di jurnal' },
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

const formatRupiah = (value) => `Rp ${formatNumber(value)}`;

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
};

export default function BiayaKirimPenjualanIndex({ items = [], summary = {}, filters = {} }) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [pageSize, setPageSize] = useState(filters.pageSize || 5);
    const [currentPage, setCurrentPage] = useState(1);
    const [remoteItems, setRemoteItems] = useState(items);
    const [remoteSummary, setRemoteSummary] = useState(summary);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [unpaidModalOpen, setUnpaidModalOpen] = useState(false);
    const [unpaidData, setUnpaidData] = useState([]);
    const [unpaidSearch, setUnpaidSearch] = useState('');
    const [unpaidPageSize, setUnpaidPageSize] = useState(5);
    const [unpaidCurrentPage, setUnpaidCurrentPage] = useState(1);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState('');
    const [viewHeader, setViewHeader] = useState(null);
    const [detailRows, setDetailRows] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [materialRows, setMaterialRows] = useState([]);
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [activeDetailTab, setActiveDetailTab] = useState('po');
    const [isNavigating, setIsNavigating] = useState(false);

    const fetchItems = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                search: searchTerm,
                status: statusFilter,
            });
            const res = await fetch(`/penjualan/biaya-kirim-penjualan/data?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Gagal memuat data biaya kirim penjualan.');
            const data = await res.json();
            setRemoteItems(Array.isArray(data?.items) ? data.items : []);
            setRemoteSummary(data?.summary ?? { unpaid_count: 0, unpaid_total: 0 });
        } catch (err) {
            setError(err.message || 'Gagal memuat data biaya kirim penjualan.');
            setRemoteItems([]);
            setRemoteSummary({ unpaid_count: 0, unpaid_total: 0 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        setCurrentPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, statusFilter]);

    const sortedItems = useMemo(() => {
        return [...remoteItems].sort((a, b) =>
            String(b.no_bkj ?? '').localeCompare(String(a.no_bkj ?? ''))
        );
    }, [remoteItems]);

    const filteredUnpaidItems = useMemo(() => {
        const term = unpaidSearch.trim().toLowerCase();
        if (!term) return unpaidData;
        return unpaidData.filter((row) =>
            [row.no_bkj, row.nama_vendor, row.no_inv]
                .map((val) => String(val ?? '').toLowerCase())
                .some((val) => val.includes(term))
        );
    }, [unpaidData, unpaidSearch]);

    const unpaidTotalPages = useMemo(() => {
        if (unpaidPageSize === Infinity) return 1;
        const size = unpaidPageSize || 5;
        return Math.max(1, Math.ceil(filteredUnpaidItems.length / size));
    }, [filteredUnpaidItems.length, unpaidPageSize]);

    const displayedUnpaidItems = useMemo(() => {
        if (unpaidPageSize === Infinity) return filteredUnpaidItems;
        const size = unpaidPageSize || 5;
        const start = (unpaidCurrentPage - 1) * size;
        return filteredUnpaidItems.slice(start, start + size);
    }, [filteredUnpaidItems, unpaidPageSize, unpaidCurrentPage]);

    const filteredDetailRows = useMemo(() => {
        const term = detailSearch.trim().toLowerCase();
        if (!term) return detailRows;
        return detailRows.filter((row) =>
            [row.no_do, row.customer]
                .map((val) => String(val ?? '').toLowerCase())
                .some((val) => val.includes(term))
        );
    }, [detailRows, detailSearch]);

    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) return 1;
        const size = detailPageSize || 5;
        return Math.max(1, Math.ceil(filteredDetailRows.length / size));
    }, [filteredDetailRows.length, detailPageSize]);

    const displayedDetailRows = useMemo(() => {
        if (detailPageSize === Infinity) return filteredDetailRows;
        const size = detailPageSize || 5;
        const start = (detailCurrentPage - 1) * size;
        return filteredDetailRows.slice(start, start + size);
    }, [filteredDetailRows, detailPageSize, detailCurrentPage]);

    const filteredMaterialRows = useMemo(() => {
        const term = materialSearch.trim().toLowerCase();
        if (!term) return materialRows;
        return materialRows.filter((row) =>
            String(row.mat ?? '').toLowerCase().includes(term)
        );
    }, [materialRows, materialSearch]);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        const size = materialPageSize || 5;
        return Math.max(1, Math.ceil(filteredMaterialRows.length / size));
    }, [filteredMaterialRows.length, materialPageSize]);

    const displayedMaterialRows = useMemo(() => {
        if (materialPageSize === Infinity) return filteredMaterialRows;
        const size = materialPageSize || 5;
        const start = (materialCurrentPage - 1) * size;
        return filteredMaterialRows.slice(start, start + size);
    }, [filteredMaterialRows, materialPageSize, materialCurrentPage]);

    const grandTotalBuy = useMemo(() => {
        return filteredMaterialRows.reduce(
            (sum, row) => sum + toNumber(row.harga_beli) * toNumber(row.qty),
            0
        );
    }, [filteredMaterialRows]);

    const grandTotalSell = useMemo(() => {
        return filteredMaterialRows.reduce(
            (sum, row) => sum + toNumber(row.harga_jual) * toNumber(row.qty),
            0
        );
    }, [filteredMaterialRows]);

    useEffect(() => {
        if (!unpaidModalOpen) return;
        setUnpaidData(
            sortedItems.filter(
                (row) => String(row.jumlah_bayar ?? '') === String(row.sisa ?? '')
            )
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unpaidModalOpen, sortedItems]);

    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        const size = pageSize || 5;
        return Math.max(1, Math.ceil(sortedItems.length / size));
    }, [sortedItems.length, pageSize]);

    const displayedItems = useMemo(() => {
        if (pageSize === Infinity) return sortedItems;
        const size = pageSize || 5;
        const start = (currentPage - 1) * size;
        return sortedItems.slice(start, start + size);
    }, [sortedItems, pageSize, currentPage]);

    const handlePageSizeChange = (value) => {
        if (value === 'all') {
            setPageSize(Infinity);
        } else {
            const parsed = Number(value);
            setPageSize(Number.isNaN(parsed) ? 5 : parsed);
        }
        setCurrentPage(1);
    };

    const handleOpenViewModal = async (noBkp) => {
        if (!noBkp) return;
        setViewModalOpen(true);
        setViewLoading(true);
        setViewError('');
        setViewHeader(null);
        setDetailRows([]);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setSelectedDetail(null);
        setMaterialRows([]);
        setMaterialSearch('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);
        setActiveDetailTab('po');
        try {
            const [headerRes, detailRes] = await Promise.allSettled([
                fetch(`/penjualan/biaya-kirim-penjualan/${encodeURIComponent(noBkp)}`, {
                    headers: { Accept: 'application/json' },
                }),
                fetch(`/penjualan/biaya-kirim-penjualan/${encodeURIComponent(noBkp)}/details`, {
                    headers: { Accept: 'application/json' },
                }),
            ]);

            if (headerRes.status === 'fulfilled' && headerRes.value.ok) {
                const headerData = await headerRes.value.json();
                setViewHeader(headerData?.header ?? null);
            } else {
                setViewError('Gagal memuat detail BKJ.');
            }

            if (detailRes.status === 'fulfilled' && detailRes.value.ok) {
                const detailData = await detailRes.value.json();
                setDetailRows(Array.isArray(detailData?.details) ? detailData.details : []);
            } else {
                setDetailRows([]);
            }
        } catch (err) {
            setViewError(err.message || 'Gagal memuat detail BKJ.');
        } finally {
            setViewLoading(false);
        }
    };

    const handleSelectDetail = async (row) => {
        if (!row?.no_do || !viewHeader?.no_bkj) return;
        setSelectedDetail(row);
        setActiveDetailTab('material');
        setMaterialRows([]);
        setMaterialSearch('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);
        try {
            const res = await fetch(
                `/penjualan/biaya-kirim-penjualan/${encodeURIComponent(viewHeader.no_bkj)}/materials?no_do=${encodeURIComponent(row.no_do)}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!res.ok) throw new Error('Gagal memuat material.');
            const data = await res.json();
            setMaterialRows(Array.isArray(data?.materials) ? data.materials : []);
        } catch (err) {
            setViewError(err.message || 'Gagal memuat material.');
        }
    };

    const handleDeleteBkp = async (noBkp) => {
        if (!noBkp) return;
        const prevBodyPointerEvents = document.body.style.pointerEvents;
        const result = await Swal.fire({
            title: 'Hapus BKJ?',
            text: 'Data BKJ yang dihapus tidak bisa dikembalikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            heightAuto: false,
            didOpen: () => {
                const container = Swal.getContainer();
                if (container) {
                    container.style.zIndex = '9999';
                    container.style.pointerEvents = 'auto';
                }
                document.body.style.pointerEvents = 'auto';
            },
            willClose: () => {
                document.body.style.pointerEvents = prevBodyPointerEvents || '';
            },
        });

        if (!result.isConfirmed) return;

        router.delete(`/pembelian/biaya-kirim-pembelian/${encodeURIComponent(noBkp)}`, {
            preserveScroll: true,
            onSuccess: () => {
                fetchItems();
                setUnpaidCurrentPage(1);
            },
        });
    };


    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Biaya Kirim Penjualan', href: '/penjualan/biaya-kirim-penjualan' }]}>
            <Head title="Biaya Kirim Penjualan" />
            <div className="relative flex flex-col gap-4 p-4">
                {isNavigating && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
                        <div className="text-sm font-medium text-muted-foreground">Memuat halaman...</div>
                    </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                            setUnpaidModalOpen(true);
                            setUnpaidData([]);
                            setUnpaidSearch('');
                            setUnpaidPageSize(5);
                            setUnpaidCurrentPage(1);
                        }}
                    >
                        <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">BKJ belum dibayar</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-end justify-between gap-4">
                            <div>
                                <div className="text-xs text-muted-foreground">Jumlah BKJ</div>
                                <div className="text-2xl font-semibold">
                                    {remoteSummary?.unpaid_count ?? 0}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-muted-foreground">Grand total</div>
                                <div className="text-lg font-bold">
                                    {formatRupiah(remoteSummary?.unpaid_total ?? 0)}
                                </div>
                            </div>
                        </CardContent>
                        </Card>
                    </button>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Data Biaya Kirim Penjualan</CardTitle>
                            <Button
                                variant="default"
                                onClick={() => {
                                    setIsNavigating(true);
                                    router.visit('/penjualan/biaya-kirim-penjualan/create', {
                                        onFinish: () => setIsNavigating(false),
                                    });
                                }}
                            >
                                Tambah BKJ
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Input
                                placeholder="Cari No BKJ, Vendor Ekspedisi, No Inv..."
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
                            <Select
                                value={pageSize === Infinity ? 'all' : String(pageSize)}
                                onValueChange={handlePageSizeChange}
                            >
                                <SelectTrigger className="w-full max-w-[160px]">
                                    <SelectValue placeholder="Tampil" />
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
                    <CardContent className="space-y-3">
                        {error ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </div>
                        ) : null}
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No BKJ</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vendor Ekspedisi</TableHead>
                                        <TableHead>Biaya Kirim</TableHead>
                                        <TableHead>No Inv</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                                Memuat data...
                                            </TableCell>
                                        </TableRow>
                                    ) : displayedItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                                Tidak ada data.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        displayedItems.map((row) => (
                                            <TableRow key={row.no_bkj}>
                                                <TableCell>{renderValue(row.no_bkj)}</TableCell>
                                                <TableCell>{formatDate(row.tanggal)}</TableCell>
                                                <TableCell>{renderValue(row.nama_vendor)}</TableCell>
                                                <TableCell>{formatRupiah(row.jumlah_bayar)}</TableCell>
                                                <TableCell>{renderValue(row.no_inv)}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Lihat"
                                                            onClick={() => handleOpenViewModal(row.no_bkj)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" title="Cetak">
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="text-muted-foreground">
                                Total data: {sortedItems.length}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1 || pageSize === Infinity}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || pageSize === Infinity}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={unpaidModalOpen} onOpenChange={setUnpaidModalOpen}>
                <DialogContent className="fixed inset-0 !left-0 !top-0 z-[210] !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !p-0 !flex !flex-col overflow-hidden">
                    <div className="flex h-full w-full flex-col bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(255,255,255,0.06),transparent),radial-gradient(900px_500px_at_90%_-20%,rgba(255,255,255,0.04),transparent)]">
                        <div className="flex h-full w-full flex-col min-h-0">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl font-semibold sm:text-2xl">
                                        Daftar BKJ Belum Dibayar
                                    </DialogTitle>
                                </div>
                            </div>

                            <div className="grid gap-3 border-b bg-background/70 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                                <Input
                                    placeholder="Cari No BKJ, Vendor Ekspedisi, No Inv..."
                                    value={unpaidSearch}
                                    onChange={(e) => setUnpaidSearch(e.target.value)}
                                    className="w-full sm:max-w-lg"
                                />
                                <Select
                                    value={unpaidPageSize === Infinity ? 'all' : String(unpaidPageSize)}
                                    onValueChange={(value) => {
                                        if (value === 'all') {
                                            setUnpaidPageSize(Infinity);
                                        } else {
                                            const parsed = Number(value);
                                            setUnpaidPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                        }
                                        setUnpaidCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-[160px]">
                                        <SelectValue placeholder="Tampil" />
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

                            <div className="flex-1 min-h-0 h-full overflow-y-auto px-4 py-4 sm:px-6">
                                <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                                    <div className="w-full overflow-x-auto">
                                        <Table className="min-w-[720px]">
                                        <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
                                            <TableRow>
                                                <TableHead className="w-[180px]">No BKJ</TableHead>
                                                <TableHead className="w-[140px]">Date</TableHead>
                                                <TableHead>Vendor Ekspedisi</TableHead>
                                                <TableHead className="w-[140px]">Biaya Kirim</TableHead>
                                                <TableHead>No Inv</TableHead>
                                                <TableHead className="w-[120px] text-center">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {displayedUnpaidItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                                        Tidak ada data.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                displayedUnpaidItems.map((row, idx) => (
                                                    <TableRow
                                                        key={`unpaid-${row.no_bkj}`}
                                                        className={idx % 2 === 0 ? 'bg-muted/10' : undefined}
                                                    >
                                                        <TableCell className="font-medium">{renderValue(row.no_bkj)}</TableCell>
                                                        <TableCell>{formatDate(row.tanggal)}</TableCell>
                                                        <TableCell>{renderValue(row.nama_vendor)}</TableCell>
                                                        <TableCell>{formatRupiah(row.jumlah_bayar)}</TableCell>
                                                        <TableCell>{renderValue(row.no_inv)}</TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit"
                                                            onClick={() => {
                                                                setIsNavigating(true);
                                                                router.visit(`/penjualan/biaya-kirim-penjualan/${row.no_bkj}/edit`, {
                                                                    onFinish: () => setIsNavigating(false),
                                                                });
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Hapus"
                                                                    onClick={() => handleDeleteBkp(row.no_bkj)}
                                                                >
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/80 px-4 py-3 text-sm backdrop-blur sm:px-6">
                                <div className="text-muted-foreground">
                                    Total data: {filteredUnpaidItems.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUnpaidCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={unpaidCurrentPage === 1 || unpaidPageSize === Infinity}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {unpaidCurrentPage} / {unpaidTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUnpaidCurrentPage((prev) => Math.min(unpaidTotalPages, prev + 1))}
                                        disabled={unpaidCurrentPage === unpaidTotalPages || unpaidPageSize === Infinity}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
                <DialogContent className="fixed inset-0 !left-0 !top-0 z-[210] !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !p-0 !flex !flex-col overflow-hidden">
                    <div className="flex h-full w-full flex-col bg-background">
                        <div className="flex h-full w-full flex-col min-h-0">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-background/80 px-4 py-4 backdrop-blur sm:px-6">
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl font-semibold sm:text-2xl">
                                        Detail Biaya Kirim Penjualan
                                    </DialogTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {viewHeader?.no_bkj ? `No BKJ: ${viewHeader.no_bkj}` : 'Memuat data...'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 h-full overflow-y-auto px-4 py-4 sm:px-6 pb-32">
                                {viewError ? (
                                    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                        {viewError}
                                    </div>
                                ) : null}

                                <div className="flex flex-col gap-6 pb-24">
                                    <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="rounded-xl border bg-card p-4 lg:col-span-2">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <div className="text-xs text-muted-foreground">No Biaya Kirim Beli</div>
                                                <div className="font-semibold">{renderValue(viewHeader?.no_bkj)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Date</div>
                                                <div className="font-semibold">{formatDate(viewHeader?.tanggal)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Vendor Ekspedisi</div>
                                                <div className="font-semibold">{renderValue(viewHeader?.nama_vendor)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">No Invoice In</div>
                                                <div className="font-semibold">{renderValue(viewHeader?.no_inv)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Tanggal Invoice In</div>
                                                <div className="font-semibold">{formatDate(viewHeader?.tgl_inv)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Total Jual</div>
                                                <div className="font-semibold">{formatRupiah(viewHeader?.gtotal_jual)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Margin</div>
                                                <div className="font-semibold">{renderValue(viewHeader?.margin_final)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border bg-card p-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Biaya Kirim</span>
                                                <span className="font-semibold">{formatRupiah(viewHeader?.jumlah_bayar)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Total Beli</span>
                                                <span className="font-semibold">{formatRupiah(viewHeader?.gtotal_beli)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {formatRupiah(toNumber(viewHeader?.gtotal_beli))}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Pembayaran</span>
                                                <span className="font-semibold">{formatRupiah(viewHeader?.jumlah_bayar)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Sisa Bayar</span>
                                                <span className="font-semibold">{formatRupiah(viewHeader?.sisa)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant={activeDetailTab === 'po' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setActiveDetailTab('po')}
                                        >
                                            Detail DO
                                        </Button>
                                        <Button
                                            variant={activeDetailTab === 'material' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setActiveDetailTab('material')}
                                        >
                                            Detail Material
                                        </Button>
                                    </div>

                                    {activeDetailTab === 'po' ? (
                                        <div className="rounded-xl border bg-card">
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                                                <div className="font-semibold">Detail DO</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Input
                                                        placeholder="Cari No DO, Customer..."
                                                        value={detailSearch}
                                                        onChange={(e) => setDetailSearch(e.target.value)}
                                                        className="w-full sm:w-64"
                                                    />
                                                    <Select
                                                        value={detailPageSize === Infinity ? 'all' : String(detailPageSize)}
                                                        onValueChange={(value) => {
                                                            if (value === 'all') {
                                                                setDetailPageSize(Infinity);
                                                            } else {
                                                                const parsed = Number(value);
                                                                setDetailPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                                            }
                                                            setDetailCurrentPage(1);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full sm:w-[160px]">
                                                            <SelectValue placeholder="Tampil" />
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
                                            </div>
                                            <div className="w-full overflow-x-auto">
                                                <Table className="min-w-[720px]">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[60px]">No</TableHead>
                                                        <TableHead>No DO</TableHead>
                                                        <TableHead>Date DO</TableHead>
                                                        <TableHead>Customer</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {viewLoading ? (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                                                    Memuat data...
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : displayedDetailRows.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                                                    Tidak ada data.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            displayedDetailRows.map((row, idx) => (
                                                                <TableRow
                                                                    key={`${row.no_do}-${idx}`}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    className={`cursor-pointer transition hover:bg-muted/40 focus:bg-muted/40 focus:outline-none ${selectedDetail?.no_do === row.no_do ? 'bg-muted/30' : ''}`}
                                                                    onClick={() => handleSelectDetail(row)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                            e.preventDefault();
                                                                            handleSelectDetail(row);
                                                                        }
                                                                    }}
                                                                >
                                                                    <TableCell>{idx + 1 + (detailPageSize === Infinity ? 0 : (detailCurrentPage - 1) * detailPageSize)}</TableCell>
                                                                    <TableCell>{renderValue(row.no_do)}</TableCell>
                                                                    <TableCell>{formatDate(row.tgl_do)}</TableCell>
                                                                    <TableCell>{renderValue(row.customer)}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                                                <div className="text-muted-foreground">Total data: {filteredDetailRows.length}</div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setDetailCurrentPage((prev) => Math.max(1, prev - 1))}
                                                        disabled={detailCurrentPage === 1 || detailPageSize === Infinity}
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span>
                                                        Halaman {detailCurrentPage} / {detailTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setDetailCurrentPage((prev) => Math.min(detailTotalPages, prev + 1))}
                                                        disabled={detailCurrentPage === detailTotalPages || detailPageSize === Infinity}
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border bg-card">
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                                                <div className="font-semibold">Detail Material</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Input
                                                        placeholder="Cari material..."
                                                        value={materialSearch}
                                                        onChange={(e) => setMaterialSearch(e.target.value)}
                                                        className="w-full sm:w-64"
                                                    />
                                                    <Select
                                                        value={materialPageSize === Infinity ? 'all' : String(materialPageSize)}
                                                        onValueChange={(value) => {
                                                            if (value === 'all') {
                                                                setMaterialPageSize(Infinity);
                                                            } else {
                                                                const parsed = Number(value);
                                                                setMaterialPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                                            }
                                                            setMaterialCurrentPage(1);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full sm:w-[160px]">
                                                            <SelectValue placeholder="Tampil" />
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
                                            </div>
                                            <div className="w-full overflow-x-auto">
                                                <Table className="min-w-[720px]">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[60px]">No</TableHead>
                                                            <TableHead>Material</TableHead>
                                                            <TableHead className="w-[120px]">Qty</TableHead>
                                                            <TableHead className="w-[120px]">Satuan</TableHead>
                                                            <TableHead className="w-[140px]">Buy Price</TableHead>
                                                            <TableHead className="w-[140px]">Sell Price</TableHead>
                                                            <TableHead className="w-[140px]">Gross Margin</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {!selectedDetail ? (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                                                                    Pilih salah satu data DO untuk melihat material.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : displayedMaterialRows.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                                                                    Tidak ada data.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            displayedMaterialRows.map((row, idx) => (
                                                                <TableRow key={`${row.mat}-${idx}`}>
                                                                    <TableCell>{idx + 1 + (materialPageSize === Infinity ? 0 : (materialCurrentPage - 1) * materialPageSize)}</TableCell>
                                                                    <TableCell>{renderValue(row.mat)}</TableCell>
                                                                    <TableCell>{renderValue(row.qty)}</TableCell>
                                                            <TableCell>{renderValue(row.unit)}</TableCell>
                                                                    <TableCell>{formatRupiah(row.harga_beli)}</TableCell>
                                                                    <TableCell>{formatRupiah(row.harga_jual)}</TableCell>
                                                                    <TableCell>{renderValue(row.margin_sbkj)}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                                                <div className="text-muted-foreground">Total data: {filteredMaterialRows.length}</div>
                                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Grand Total Buy:</span>{' '}
                                                        <span className="font-medium">{formatRupiah(grandTotalBuy)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Grand Total Sell:</span>{' '}
                                                        <span className="font-medium">{formatRupiah(grandTotalSell)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setMaterialCurrentPage((prev) => Math.max(1, prev - 1))}
                                                        disabled={materialCurrentPage === 1 || materialPageSize === Infinity}
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span>
                                                        Halaman {materialCurrentPage} / {materialTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setMaterialCurrentPage((prev) => Math.min(materialTotalPages, prev + 1))}
                                                        disabled={materialCurrentPage === materialTotalPages || materialPageSize === Infinity}
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
