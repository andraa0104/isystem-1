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
import { Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Tanda Terima Invoice', href: '/penjualan/tanda-terima-invoice' },
    { title: 'Edit Tanda Terima', href: '/penjualan/tanda-terima-invoice/edit' },
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

export default function TandaTerimaInvoiceEdit({ noTtInv }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dateDoc, setDateDoc] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [deletingAll, setDeletingAll] = useState(false);

    const fireSwal = (options) => {
        const customClass = {
            popup: 'ttinv-swal-popup',
            ...(options?.customClass || {}),
        };
        return Swal.fire({
            width: 'min(92vw, 420px)',
            ...options,
            customClass,
        });
    };

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [invoiceRows, setInvoiceRows] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [invoicePageSize, setInvoicePageSize] = useState(5);
    const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);

    useEffect(() => {
        if (!noTtInv) return;
        setLoading(true);
        setError('');
        fetch(`/penjualan/tanda-terima-invoice/edit-data?no_ttinv=${encodeURIComponent(noTtInv)}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                const items = Array.isArray(data?.items) ? data.items : [];
                setSelectedInvoices(
                    items.map((item) => ({
                        no_inv: item.no_inv ?? '',
                        no_faktur: item.no_faktur ?? '',
                        tgl: item.tgl ?? '',
                        nm_cs: item.nm_cs ?? '',
                        ref_po: item.ref_po ?? '',
                        total: item.total ?? 0,
                        remark: item.remark ?? '-',
                    })),
                );
                setDateDoc(data?.header?.tgl_doc ?? '');
            })
            .catch(() => {
                setError('Gagal memuat data tanda terima.');
            })
            .finally(() => setLoading(false));
    }, [noTtInv]);

    useEffect(() => {
        if (!isSearchOpen) return;
        if (invoiceRows.length > 0) return;
        setInvoiceLoading(true);
        setInvoiceError('');
        fetch('/penjualan/tanda-terima-invoice/invoices', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setInvoiceRows(Array.isArray(data?.data) ? data.data : []);
            })
            .catch(() => {
                setInvoiceError('Gagal memuat data invoice.');
            })
            .finally(() => setInvoiceLoading(false));
    }, [isSearchOpen, invoiceRows.length]);

    const filteredInvoiceRows = useMemo(() => {
        const term = invoiceSearch.trim().toLowerCase();
        if (!term) return invoiceRows;
        return invoiceRows.filter((row) => {
            return (
                String(row.no_fakturpenjualan ?? '').toLowerCase().includes(term) ||
                String(row.ref_po ?? '').toLowerCase().includes(term) ||
                String(row.nm_cs ?? '').toLowerCase().includes(term)
            );
        });
    }, [invoiceRows, invoiceSearch]);

    const invoiceTotalItems = filteredInvoiceRows.length;
    const invoiceTotalPages = useMemo(() => {
        if (invoicePageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(invoiceTotalItems / invoicePageSize));
    }, [invoicePageSize, invoiceTotalItems]);

    const displayedInvoiceRows = useMemo(() => {
        if (invoicePageSize === Infinity) return filteredInvoiceRows;
        const startIndex = (invoiceCurrentPage - 1) * invoicePageSize;
        return filteredInvoiceRows.slice(startIndex, startIndex + invoicePageSize);
    }, [filteredInvoiceRows, invoiceCurrentPage, invoicePageSize]);

    useEffect(() => {
        setInvoiceCurrentPage(1);
    }, [invoicePageSize, invoiceSearch]);

    useEffect(() => {
        if (invoiceCurrentPage > invoiceTotalPages) {
            setInvoiceCurrentPage(invoiceTotalPages);
        }
    }, [invoiceCurrentPage, invoiceTotalPages]);

    const grandTotal = useMemo(() => {
        return selectedInvoices.reduce(
            (sum, item) => sum + toNumber(item.total),
            0,
        );
    }, [selectedInvoices]);

    const handleRemoveInvoice = (row) => {
        fireSwal({
            icon: 'warning',
            title: 'Hapus data invoice?',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;
            fetch('/penjualan/tanda-terima-invoice/delete-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    no_ttinv: noTtInv,
                    no_inv: row.no_inv,
                    no_faktur: row.no_faktur,
                    ref_po: row.ref_po,
                }),
            })
                .then(async (response) => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload?.message || 'Gagal menghapus data.');
                    }
                    setSelectedInvoices((prev) =>
                        prev.filter((item) => item.no_inv !== row.no_inv),
                    );
                })
                .catch((err) => {
                    fireSwal({
                        icon: 'error',
                        title: err?.message || 'Gagal menghapus data.',
                    });
                });
        });
    };

    const handleDeleteTandaTerima = () => {
        if (deletingAll) return;
        fireSwal({
            icon: 'warning',
            title: 'Hapus tanda terima ini?',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;
            setDeletingAll(true);
            fetch('/penjualan/tanda-terima-invoice/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ no_ttinv: noTtInv }),
            })
                .then(async (response) => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload?.message || 'Gagal menghapus data.');
                    }
                    fireSwal({
                        icon: 'success',
                        title: 'Tanda terima dihapus.',
                        timer: 1500,
                        showConfirmButton: false,
                    }).then(() => {
                        window.location.href = '/penjualan/tanda-terima-invoice';
                    });
                })
                .catch((err) => {
                    fireSwal({
                        icon: 'error',
                        title: err?.message || 'Gagal menghapus data.',
                    });
                })
                .finally(() => setDeletingAll(false));
        });
    };

    const handleRemarkChange = (noInv, value) => {
        setSelectedInvoices((prev) =>
            prev.map((item) =>
                item.no_inv === noInv ? { ...item, remark: value } : item,
            ),
        );
    };

    const handleSaveRemark = (row) => {
        fetch('/penjualan/tanda-terima-invoice/update-remark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                no_ttinv: noTtInv,
                no_inv: row.no_inv,
                no_faktur: row.no_faktur,
                ref_po: row.ref_po,
                remark: row.remark,
            }),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.message || 'Gagal menyimpan remark.');
                }
                fireSwal({
                    icon: 'success',
                    title: 'Remark diperbarui.',
                    timer: 1200,
                    showConfirmButton: false,
                });
            })
            .catch((err) => {
                fireSwal({
                    icon: 'error',
                    title: err?.message || 'Gagal menyimpan remark.',
                });
            });
    };

    const reloadEditData = () => {
        if (!noTtInv) return;
        setLoading(true);
        setError('');
        fetch(`/penjualan/tanda-terima-invoice/edit-data?no_ttinv=${encodeURIComponent(noTtInv)}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                const items = Array.isArray(data?.items) ? data.items : [];
                setSelectedInvoices(
                    items.map((item) => ({
                        no_inv: item.no_inv ?? '',
                        no_faktur: item.no_faktur ?? '',
                        tgl: item.tgl ?? '',
                        nm_cs: item.nm_cs ?? '',
                        ref_po: item.ref_po ?? '',
                        total: item.total ?? 0,
                        remark: item.remark ?? '-',
                    })),
                );
                setDateDoc(data?.header?.tgl_doc ?? '');
            })
            .catch(() => {
                setError('Gagal memuat data tanda terima.');
            })
            .finally(() => setLoading(false));
    };

    const handleSelectInvoice = (row) => {
        const exists = selectedInvoices.some(
            (item) => item.no_inv === row.no_fakturpenjualan,
        );
        if (exists) {
            fireSwal({
                icon: 'info',
                title: 'Invoice sudah ada di tabel.',
                timer: 1200,
                showConfirmButton: false,
            });
            return;
        }
        fetch('/penjualan/tanda-terima-invoice/add-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                no_ttinv: noTtInv,
                no_inv: row.no_fakturpenjualan ?? '',
                no_faktur: row.no_fakturpajak ?? '',
                tgl: row.tgl_doc ?? '',
                tgl_doc: dateDoc || row.tgl_doc || '',
                nm_cs: row.nm_cs ?? '',
                ref_po: row.ref_po ?? '',
                total: row.g_total ?? 0,
                remark: '-',
            }),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.message || 'Gagal menambahkan data.');
                }
                setIsSearchOpen(false);
                reloadEditData();
                fireSwal({
                    icon: 'success',
                    title: 'Data invoice ditambahkan.',
                    timer: 1200,
                    showConfirmButton: false,
                });
            })
            .catch((err) => {
                fireSwal({
                    icon: 'error',
                    title: err?.message || 'Gagal menambahkan data.',
                });
            });
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Tanda Terima Invoice" />
            <style>{`
                .ttinv-swal-popup { padding: 1.25rem !important; }
                @media (max-width: 640px) {
                    .ttinv-swal-popup { padding: 1rem !important; }
                    .ttinv-swal-popup .swal2-title { font-size: 1rem; }
                    .ttinv-swal-popup .swal2-html-container { font-size: 0.875rem; }
                    .ttinv-swal-popup .swal2-actions { flex-wrap: wrap; gap: 0.5rem; }
                    .ttinv-swal-popup .swal2-actions > button { flex: 1 1 auto; }
                }
            `}</style>
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit Tanda Terima Invoice</h1>
                        <p className="text-sm text-muted-foreground">{noTtInv}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsSearchOpen(true)}>
                            <Search className="mr-2 h-4 w-4" />
                            Cari Invoice
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteTandaTerima}
                            disabled={deletingAll}
                        >
                            {deletingAll ? 'Menghapus...' : 'Hapus Tanda Terima'}
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="text-sm font-medium">Date</div>
                    <Input value={dateDoc} readOnly className="mt-2" />
                </div>

                <div className="rounded-xl border border-border/60 bg-card">
                    <div className="border-b border-border/60 px-4 py-3">
                        <div className="text-base font-semibold">Data Invoice</div>
                    </div>
                    <div className="px-4 pb-4">
                        {loading && <div className="text-sm text-muted-foreground">Memuat data...</div>}
                        {error && <div className="text-sm text-destructive">{error}</div>}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No</TableHead>
                                        <TableHead>No Invoice</TableHead>
                                        <TableHead>No Faktur Pajak</TableHead>
                                        <TableHead>Date Doc</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Total Price</TableHead>
                                        <TableHead>Remark</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedInvoices.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={9}>Tidak ada data.</TableCell>
                                        </TableRow>
                                    )}
                                    {selectedInvoices.map((row, index) => (
                                        <TableRow key={`${row.no_inv}-${index}`}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{row.no_inv}</TableCell>
                                            <TableCell>{row.no_faktur}</TableCell>
                                            <TableCell>{row.tgl}</TableCell>
                                            <TableCell>{row.nm_cs}</TableCell>
                                            <TableCell>{row.ref_po}</TableCell>
                                            <TableCell>{formatRupiah(row.total)}</TableCell>
                                            <TableCell>
                                                <Input
                                                    value={row.remark ?? '-'}
                                                    onChange={(event) =>
                                                        handleRemarkChange(row.no_inv, event.target.value)
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleSaveRemark(row)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveInvoice(row)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="text-sm font-medium">Grand Total Price</div>
                    <div className="mt-2 text-xl font-semibold">{formatRupiah(grandTotal)}</div>
                </div>
            </div>

            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:h-[92vh] sm:w-[92vw] sm:max-w-[92vw]">
                    <DialogHeader>
                        <DialogTitle>Cari Invoice</DialogTitle>
                        <DialogDescription>
                            Pilih invoice untuk tanda terima.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                value={invoicePageSize === Infinity ? 'all' : invoicePageSize}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setInvoicePageSize(value === 'all' ? Infinity : Number(value));
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
                                className="min-w-[220px]"
                                placeholder="Cari no invoice, ref po, customer..."
                                value={invoiceSearch}
                                onChange={(event) => setInvoiceSearch(event.target.value)}
                            />
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No Invoice</TableHead>
                                        <TableHead>Date Doc</TableHead>
                                        <TableHead>No Faktur Pajak</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoiceLoading && (
                                        <TableRow>
                                            <TableCell colSpan={6}>Memuat data...</TableCell>
                                        </TableRow>
                                    )}
                                    {!invoiceLoading && invoiceError && (
                                        <TableRow>
                                            <TableCell colSpan={6}>{invoiceError}</TableCell>
                                        </TableRow>
                                    )}
                                    {!invoiceLoading &&
                                        !invoiceError &&
                                        displayedInvoiceRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    Tidak ada data invoice.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    {!invoiceLoading &&
                                        !invoiceError &&
                                        displayedInvoiceRows.map((row) => (
                                            <TableRow
                                                key={row.no_fakturpenjualan}
                                                className="cursor-pointer"
                                                onClick={() => handleSelectInvoice(row)}
                                            >
                                                <TableCell>{row.no_fakturpenjualan}</TableCell>
                                                <TableCell>{row.tgl_doc}</TableCell>
                                                <TableCell>{row.no_fakturpajak}</TableCell>
                                                <TableCell>{row.ref_po}</TableCell>
                                                <TableCell>{row.nm_cs}</TableCell>
                                                <TableCell>{formatRupiah(row.g_total)}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                        {invoicePageSize !== Infinity && invoiceTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {(invoiceCurrentPage - 1) * invoicePageSize + 1} -{' '}
                                    {Math.min(
                                        invoiceCurrentPage * invoicePageSize,
                                        invoiceTotalItems,
                                    )}{' '}
                                    dari {invoiceTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setInvoiceCurrentPage((page) => Math.max(1, page - 1))
                                        }
                                        disabled={invoiceCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {invoiceCurrentPage} dari {invoiceTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setInvoiceCurrentPage((page) =>
                                                Math.min(invoiceTotalPages, page + 1),
                                            )
                                        }
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
        </AppLayout>
    );
}
