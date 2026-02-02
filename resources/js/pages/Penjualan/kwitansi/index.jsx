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
import { Head } from '@inertiajs/react';
import { Printer, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Kwitansi', href: '/penjualan/faktur-penjualan/kwitansi' },
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

export default function KwitansiIndex() {
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [kwitansiData, setKwitansiData] = useState([]);
    const [kwitansiLoading, setKwitansiLoading] = useState(false);
    const [kwitansiError, setKwitansiError] = useState('');

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailInvoice, setDetailInvoice] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);

    const [isKwitansiOpen, setIsKwitansiOpen] = useState(false);
    const [kwitansiSaving, setKwitansiSaving] = useState(false);
    const [kwitansiForm, setKwitansiForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        ref_faktur: '',
        customer: '',
        total_price: 0,
    });

    const [isNoReceiptOpen, setIsNoReceiptOpen] = useState(false);
    const [noReceiptPageSize, setNoReceiptPageSize] = useState(5);
    const [noReceiptCurrentPage, setNoReceiptCurrentPage] = useState(1);
    const [noReceiptSearch, setNoReceiptSearch] = useState('');
    const [noReceiptLoading, setNoReceiptLoading] = useState(false);
    const [noReceiptError, setNoReceiptError] = useState('');
    const [noReceiptInvoices, setNoReceiptInvoices] = useState([]);

    useEffect(() => {
        let isMounted = true;
        setKwitansiLoading(true);
        setKwitansiError('');
        fetch('/penjualan/faktur-penjualan/kwitansi/data', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                setKwitansiData(Array.isArray(data?.data) ? data.data : []);
            })
            .catch(() => {
                if (!isMounted) return;
                setKwitansiError('Gagal memuat data kwitansi.');
            })
            .finally(() => {
                if (!isMounted) return;
                setKwitansiLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const filteredKwitansi = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return kwitansiData;
        return kwitansiData.filter((item) => {
            return (
                String(item.no_kwitansi ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_faktur ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.cs ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });
    }, [kwitansiData, searchTerm]);

    const totalItems = filteredKwitansi.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedKwitansi = useMemo(() => {
        if (pageSize === Infinity) return filteredKwitansi;
        const startIndex = (currentPage - 1) * pageSize;
        return filteredKwitansi.slice(startIndex, startIndex + pageSize);
    }, [filteredKwitansi, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleOpenDetail = (refFaktur) => {
        if (!refFaktur) return;
        setIsDetailOpen(true);
        setDetailLoading(true);
        setDetailError('');
        setDetailInvoice(null);
        setDetailItems([]);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);

        fetch(
            `/penjualan/faktur-penjualan/${encodeURIComponent(
                refFaktur,
            )}/details`,
            {
                headers: { Accept: 'application/json' },
            },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setDetailInvoice(data?.invoice ?? null);
                setDetailItems(Array.isArray(data?.items) ? data.items : []);
            })
            .catch(() => {
                setDetailError('Gagal memuat detail invoice.');
            })
            .finally(() => setDetailLoading(false));
    };

    const filteredDetailItems = useMemo(() => {
        const term = detailSearch.trim().toLowerCase();
        if (!term) return detailItems;
        return detailItems.filter((item) => {
            return (
                String(item.no_do ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.material ?? '')
                    .toLowerCase()
                    .includes(term)
            );
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
    }, [detailPageSize, detailSearch]);

    useEffect(() => {
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

    const detailHargaPokok = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.HPP) + toNumber(detailInvoice.HPPDOT);
    }, [detailInvoice]);

    const detailTotalPrice = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.g_total);
    }, [detailInvoice]);

    const detailMargin = useMemo(() => {
        if (!detailTotalPrice) return 0;
        return ((detailTotalPrice - detailHargaPokok) / detailTotalPrice) * 100;
    }, [detailTotalPrice, detailHargaPokok]);

    const detailSaldoPiutang = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.saldo_piutang);
    }, [detailInvoice]);

    const detailTotalBayar = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.total_bayaran);
    }, [detailInvoice]);


    const openKwitansiModal = () => {
        setKwitansiForm({
            date: new Date().toISOString().slice(0, 10),
            ref_faktur: '',
            customer: '',
            total_price: 0,
        });
        setIsKwitansiOpen(true);
    };

    useEffect(() => {
        if (!isNoReceiptOpen) return;
        if (noReceiptInvoices.length > 0) return;
        setNoReceiptLoading(true);
        setNoReceiptError('');
        fetch('/penjualan/faktur-penjualan/kwitansi/no-receipt', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setNoReceiptInvoices(
                    Array.isArray(data?.data) ? data.data : [],
                );
            })
            .catch(() => {
                setNoReceiptError('Gagal memuat invoice tanpa kwitansi.');
            })
            .finally(() => setNoReceiptLoading(false));
    }, [isNoReceiptOpen, noReceiptInvoices.length]);

    const handleSaveKwitansi = () => {
        if (kwitansiSaving) return;
        setKwitansiSaving(true);
        fetch('/penjualan/faktur-penjualan/kwitansi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(kwitansiForm),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.message || 'Gagal menyimpan kwitansi.');
                }
                setIsKwitansiOpen(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Kwitansi berhasil disimpan.',
                    timer: 1500,
                    showConfirmButton: false,
                }).then(() => {
                    window.location.reload();
                });
            })
            .catch((error) => {
                Swal.fire({
                    icon: 'error',
                    title: error?.message || 'Gagal menyimpan kwitansi.',
                });
            })
            .finally(() => setKwitansiSaving(false));
    };

    const filteredNoReceipt = useMemo(() => {
        const term = noReceiptSearch.trim().toLowerCase();
        if (!term) return noReceiptInvoices;
        return noReceiptInvoices.filter((item) => {
            return (
                String(item.no_fakturpenjualan ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_po ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.nm_cs ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });
    }, [noReceiptInvoices, noReceiptSearch]);

    const noReceiptTotalItems = filteredNoReceipt.length;
    const noReceiptTotalPages = useMemo(() => {
        if (noReceiptPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(noReceiptTotalItems / noReceiptPageSize));
    }, [noReceiptPageSize, noReceiptTotalItems]);

    const displayedNoReceiptItems = useMemo(() => {
        if (noReceiptPageSize === Infinity) return filteredNoReceipt;
        const startIndex = (noReceiptCurrentPage - 1) * noReceiptPageSize;
        return filteredNoReceipt.slice(
            startIndex,
            startIndex + noReceiptPageSize,
        );
    }, [filteredNoReceipt, noReceiptCurrentPage, noReceiptPageSize]);

    useEffect(() => {
        setNoReceiptCurrentPage(1);
    }, [noReceiptPageSize, noReceiptSearch]);

    useEffect(() => {
        if (noReceiptCurrentPage > noReceiptTotalPages) {
            setNoReceiptCurrentPage(noReceiptTotalPages);
        }
    }, [noReceiptCurrentPage, noReceiptTotalPages]);

    const handleSelectInvoice = (item) => {
        setKwitansiForm({
            date: kwitansiForm.date,
            ref_faktur: item.no_fakturpenjualan ?? '',
            customer: item.nm_cs ?? '',
            total_price: item.g_total ?? 0,
        });
        setIsNoReceiptOpen(false);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kwitansi" />
            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Kwitansi</h1>
                        <p className="text-sm text-muted-foreground">
                            Daftar kwitansi penjualan.
                        </p>
                    </div>
                    <Button type="button" onClick={openKwitansiModal}>
                        <ReceiptText className="mr-2 h-4 w-4" />
                        Buat Kwitansi
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        value={pageSize === Infinity ? 'all' : pageSize}
                        onChange={(event) => {
                            const value = event.target.value;
                            setPageSize(value === 'all' ? Infinity : Number(value));
                        }}
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value="all">Semua data</option>
                    </select>
                    <Input
                        className="min-w-[240px]"
                        placeholder="Cari no kwitansi, invoice, customer..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>

                <div className="rounded-xl border border-border/60 bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No Kwitansi</TableHead>
                                <TableHead>Ref Invoice</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Total Price</TableHead>
                                <TableHead className="text-right">
                                    Aksi
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {kwitansiLoading && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        Memuat data kwitansi...
                                    </TableCell>
                                </TableRow>
                            )}
                            {!kwitansiLoading && kwitansiError && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        {kwitansiError}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!kwitansiLoading &&
                                !kwitansiError &&
                                displayedKwitansi.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        Tidak ada data kwitansi.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!kwitansiLoading &&
                                !kwitansiError &&
                                displayedKwitansi.map((item) => (
                                <TableRow
                                    key={`kwitansi-${item.no_kwitansi}`}
                                >
                                    <TableCell>{item.no_kwitansi}</TableCell>
                                    <TableCell>
                                        <button
                                            type="button"
                                            className="text-primary hover:underline"
                                            onClick={() =>
                                                handleOpenDetail(item.ref_faktur)
                                            }
                                        >
                                            {item.ref_faktur}
                                        </button>
                                    </TableCell>
                                    <TableCell>{item.tgl}</TableCell>
                                    <TableCell>{item.cs}</TableCell>
                                    <TableCell>
                                        {formatRupiah(item.ttl_faktur)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <a
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
                                            href={`/penjualan/faktur-penjualan/kwitansi/${encodeURIComponent(
                                                item.no_kwitansi ?? '',
                                            )}/print`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Print"
                                            title="Print"
                                        >
                                            <Printer className="size-4" />
                                        </a>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {pageSize !== Infinity && totalItems > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>
                            Menampilkan {(currentPage - 1) * pageSize + 1} -{' '}
                            {Math.min(currentPage * pageSize, totalItems)} dari{' '}
                            {totalItems} data
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
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:h-[92vh] sm:w-[92vw] sm:max-w-[92vw]">
                    <DialogHeader>
                        <DialogTitle>Detail Invoice</DialogTitle>
                        <DialogDescription>
                            Detail data invoice dan material.
                        </DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="py-6 text-sm text-muted-foreground">
                            Memuat detail invoice...
                        </div>
                    ) : detailError ? (
                        <div className="py-6 text-sm text-destructive">
                            {detailError}
                        </div>
                    ) : detailInvoice ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span>No Invoice</span>
                                        <span className="font-medium">
                                            {detailInvoice.no_fakturpenjualan}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Date</span>
                                        <span className="font-medium">
                                            {detailInvoice.tgl_doc}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Customer</span>
                                        <span className="font-medium">
                                            {detailInvoice.nm_cs}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Ref PO</span>
                                        <span className="font-medium">
                                            {detailInvoice.ref_po}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>PPN</span>
                                        <span className="font-medium">
                                            {detailInvoice.ppn}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Price</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailInvoice.harga)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Harga PPN</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailInvoice.h_ppn)}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span>Total Price</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailInvoice.g_total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Tanggal Terima Invoice</span>
                                        <span className="font-medium">
                                            {detailInvoice.tgl_terimainv || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Tanggal Bayar</span>
                                        <span className="font-medium">
                                            {detailInvoice.tgl_bayar || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Jatuh Tempo</span>
                                        <span className="font-medium">
                                            {detailInvoice.jth_tempo}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Saldo Piutang/Sisa Bayar</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailSaldoPiutang)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Total Bayar</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailTotalBayar)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Harga Pembelian Pokok</span>
                                        <span className="font-medium">
                                            {formatRupiah(detailHargaPokok)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Margin</span>
                                        <span className="font-medium">
                                            {detailMargin.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                        value={
                                            detailPageSize === Infinity
                                                ? 'all'
                                                : detailPageSize
                                        }
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setDetailPageSize(
                                                value === 'all'
                                                    ? Infinity
                                                    : Number(value),
                                            );
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua data</option>
                                    </select>
                                    <Input
                                        className="min-w-[220px]"
                                        placeholder="Cari no DO atau material..."
                                        value={detailSearch}
                                        onChange={(event) =>
                                            setDetailSearch(event.target.value)
                                        }
                                    />
                                </div>

                                <div className="rounded-lg border border-border/60">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No DO</TableHead>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Satuan</TableHead>
                                                <TableHead>Price</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {displayedDetailItems.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5}>
                                                        Tidak ada data material.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {displayedDetailItems.map((item) => (
                                                <TableRow
                                                    key={`detail-${item.no_do}-${item.material}`}
                                                >
                                                    <TableCell>
                                                        {item.no_do}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.material}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatNumber(item.qty)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.unit}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatRupiah(item.ttl_price)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {detailPageSize !== Infinity &&
                                    detailTotalItems > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <span>
                                                Menampilkan{' '}
                                                {(detailCurrentPage - 1) *
                                                    detailPageSize +
                                                    1}{' '}
                                                -{' '}
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
                                                        setDetailCurrentPage((page) =>
                                                            Math.max(1, page - 1),
                                                        )
                                                    }
                                                    disabled={detailCurrentPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span>
                                                    Halaman {detailCurrentPage} dari{' '}
                                                    {detailTotalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDetailCurrentPage((page) =>
                                                            Math.min(
                                                                detailTotalPages,
                                                                page + 1,
                                                            ),
                                                        )
                                                    }
                                                    disabled={
                                                        detailCurrentPage ===
                                                        detailTotalPages
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-sm text-muted-foreground">
                            Tidak ada data invoice.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isKwitansiOpen} onOpenChange={setIsKwitansiOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Buat Kwitansi</DialogTitle>
                        <DialogDescription>
                            Form pembuatan kwitansi dari invoice.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Date</label>
                            <Input
                                type="date"
                                value={kwitansiForm.date}
                                onChange={(event) =>
                                    setKwitansiForm((prev) => ({
                                        ...prev,
                                        date: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                No Invoice
                            </label>
                            <Input value={kwitansiForm.ref_faktur} readOnly />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Customer
                            </label>
                            <Input value={kwitansiForm.customer} readOnly />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Total Price
                            </label>
                            <Input
                                value={formatRupiah(kwitansiForm.total_price)}
                                readOnly
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsNoReceiptOpen(true)}
                            >
                                Cari Invoice
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveKwitansi}
                                disabled={
                                    kwitansiSaving ||
                                    !kwitansiForm.ref_faktur
                                }
                            >
                                {kwitansiSaving ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isNoReceiptOpen} onOpenChange={setIsNoReceiptOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] xl:max-w-[75vw]">
                    <DialogHeader>
                        <DialogTitle>Invoice Belum Bikin Kwitansi</DialogTitle>
                        <DialogDescription>
                            Pilih invoice yang belum memiliki kwitansi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                value={
                                    noReceiptPageSize === Infinity
                                        ? 'all'
                                        : noReceiptPageSize
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setNoReceiptPageSize(
                                        value === 'all'
                                            ? Infinity
                                            : Number(value),
                                    );
                                }}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua data</option>
                            </select>
                            <Input
                                className="min-w-[220px]"
                                placeholder="Cari no invoice, ref po, customer..."
                                value={noReceiptSearch}
                                onChange={(event) =>
                                    setNoReceiptSearch(event.target.value)
                                }
                            />
                        </div>

                        <div className="rounded-lg border border-border/60">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No Invoice</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Total Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {noReceiptLoading && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                Memuat invoice...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!noReceiptLoading && noReceiptError && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                {noReceiptError}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!noReceiptLoading &&
                                        !noReceiptError &&
                                        displayedNoReceiptItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                Tidak ada data invoice.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!noReceiptLoading &&
                                        !noReceiptError &&
                                        displayedNoReceiptItems.map((item) => (
                                        <TableRow
                                            key={`select-no-receipt-${item.no_fakturpenjualan}`}
                                            className="cursor-pointer"
                                            onClick={() =>
                                                handleSelectInvoice(item)
                                            }
                                        >
                                            <TableCell>
                                                {item.no_fakturpenjualan}
                                            </TableCell>
                                            <TableCell>{item.tgl_doc}</TableCell>
                                            <TableCell>{item.nm_cs}</TableCell>
                                            <TableCell>{item.ref_po}</TableCell>
                                            <TableCell>
                                                {formatRupiah(item.g_total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {noReceiptPageSize !== Infinity &&
                            noReceiptTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {(noReceiptCurrentPage - 1) *
                                            noReceiptPageSize +
                                            1}{' '}
                                        -{' '}
                                        {Math.min(
                                            noReceiptCurrentPage * noReceiptPageSize,
                                            noReceiptTotalItems,
                                        )}{' '}
                                        dari {noReceiptTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setNoReceiptCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={noReceiptCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span>
                                            Halaman {noReceiptCurrentPage} dari{' '}
                                            {noReceiptTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setNoReceiptCurrentPage((page) =>
                                                    Math.min(
                                                        noReceiptTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                noReceiptCurrentPage ===
                                                noReceiptTotalPages
                                            }
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
