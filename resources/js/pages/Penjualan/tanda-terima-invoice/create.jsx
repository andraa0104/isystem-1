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
import { Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Tanda Terima Invoice', href: '/penjualan/tanda-terima-invoice' },
    { title: 'Buat Tanda Terima', href: '/penjualan/tanda-terima-invoice/create' },
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

export default function TandaTerimaInvoiceCreate() {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [invoiceRows, setInvoiceRows] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [invoicePageSize, setInvoicePageSize] = useState(5);
    const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);

    const [dateDoc, setDateDoc] = useState(new Date().toISOString().slice(0, 10));
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [saving, setSaving] = useState(false);

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

    const handleSelectInvoice = (row) => {
        const exists = selectedInvoices.some(
            (item) => item.no_inv === row.no_fakturpenjualan,
        );
        if (exists) {
            Swal.fire({
                icon: 'info',
                title: 'Invoice sudah ada di tabel.',
                timer: 1200,
                showConfirmButton: false,
            });
            return;
        }
        setSelectedInvoices((prev) => [
            ...prev,
            {
                no_inv: row.no_fakturpenjualan ?? '',
                no_faktur: row.no_fakturpajak ?? '',
                tgl: row.tgl_doc ?? '',
                nm_cs: row.nm_cs ?? '',
                ref_po: row.ref_po ?? '',
                total: row.g_total ?? 0,
                remark: '-',
            },
        ]);
        setIsSearchOpen(false);
    };

    const handleRemoveInvoice = (noInv) => {
        setSelectedInvoices((prev) =>
            prev.filter((item) => item.no_inv !== noInv),
        );
    };

    const handleRemarkChange = (noInv, value) => {
        setSelectedInvoices((prev) =>
            prev.map((item) =>
                item.no_inv === noInv ? { ...item, remark: value } : item,
            ),
        );
    };

    const grandTotal = useMemo(() => {
        return selectedInvoices.reduce(
            (sum, item) => sum + toNumber(item.total),
            0,
        );
    }, [selectedInvoices]);

    const handleSave = () => {
        if (saving) return;
        if (selectedInvoices.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Data invoice belum diisi.',
            });
            return;
        }
        setSaving(true);
        fetch('/penjualan/tanda-terima-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                date: dateDoc,
                grand_total: grandTotal,
                invoices: selectedInvoices,
            }),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.message || 'Gagal menyimpan data.');
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Tanda terima berhasil dibuat.',
                    timer: 1500,
                    showConfirmButton: false,
                }).then(() => {
                    window.location.href = '/penjualan/tanda-terima-invoice';
                });
            })
            .catch((error) => {
                Swal.fire({
                    icon: 'error',
                    title: error?.message || 'Gagal menyimpan data.',
                });
            })
            .finally(() => setSaving(false));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buat Tanda Terima Invoice" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Buat Tanda Terima Invoice</h1>
                        <p className="text-sm text-muted-foreground">
                            Input data tanda terima invoice.
                        </p>
                    </div>
                    <Button type="button" onClick={() => setIsSearchOpen(true)}>
                        <Search className="mr-2 h-4 w-4" />
                        Cari Invoice
                    </Button>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="text-sm font-medium">Date</div>
                    <Input
                        type="date"
                        value={dateDoc}
                        onChange={(event) => setDateDoc(event.target.value)}
                        className="mt-2"
                    />
                </div>

                <div className="rounded-xl border border-border/60 bg-card">
                    <div className="border-b border-border/60 px-4 py-3">
                        <div className="text-base font-semibold">Data Invoice</div>
                    </div>
                    <div className="px-4 pb-4">
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
                                        <TableHead className="text-right">
                                            Aksi
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedInvoices.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8}>
                                                Belum ada data invoice.
                                            </TableCell>
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
                                                        handleRemarkChange(
                                                            row.no_inv,
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleRemoveInvoice(row.no_inv)
                                                    }
                                                    aria-label="Hapus"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-card p-4">
                        <div className="text-sm font-medium">Grand Total Price</div>
                        <div className="mt-2 text-xl font-semibold">
                            {formatRupiah(grandTotal)}
                        </div>
                    </div>
                    <div className="flex items-end justify-end">
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            {saving ? 'Menyimpan...' : 'Simpan Data'}
                        </Button>
                    </div>
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
                                            setInvoiceCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
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
