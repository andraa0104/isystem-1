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
import { useEffect, useMemo, useState } from 'react';

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;

export default function InvoiceDetailDialog({ invoiceNo, open, onOpenChange }) {
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailInvoice, setDetailInvoice] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);

    useEffect(() => {
        if (!open || !invoiceNo) return;

        setDetailLoading(true);
        setDetailError('');
        setDetailInvoice(null);
        setDetailItems([]);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);

        const params = new URLSearchParams({ invoice_no: invoiceNo });

        fetch(`/penjualan/faktur-penjualan/detail-data?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
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
    }, [invoiceNo, open]);

    const filteredDetailItems = useMemo(() => {
        const term = detailSearch.trim().toLowerCase();
        if (!term) return detailItems;
        return detailItems.filter(
            (item) =>
                String(item.no_do ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.material ?? '')
                    .toLowerCase()
                    .includes(term),
        );
    }, [detailItems, detailSearch]);

    const detailTotalItems = filteredDetailItems.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) return filteredDetailItems;
        const startIndex = (detailCurrentPage - 1) * detailPageSize;
        return filteredDetailItems.slice(
            startIndex,
            startIndex + detailPageSize,
        );
    }, [detailCurrentPage, detailPageSize, filteredDetailItems]);

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
    }, [detailHargaPokok, detailTotalPrice]);

    const detailSaldoPiutang = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.saldo_piutang);
    }, [detailInvoice]);

    const detailTotalBayar = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.total_bayaran);
    }, [detailInvoice]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Detail Invoice</DialogTitle>
                    <DialogDescription className="sr-only">
                        Detail invoice dan daftar DO.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-6 px-6 pb-6">
                    {detailLoading && (
                        <p className="text-sm text-muted-foreground">
                            Memuat detail invoice...
                        </p>
                    )}
                    {detailError && (
                        <p className="text-sm text-destructive">
                            {detailError}
                        </p>
                    )}
                    {detailInvoice && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        No Invoice
                                    </span>
                                    <span>
                                        {detailInvoice.no_fakturpenjualan}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Date
                                    </span>
                                    <span>{detailInvoice.tgl_doc}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Customer
                                    </span>
                                    <span>{detailInvoice.nm_cs}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Ref PO
                                    </span>
                                    <span>{detailInvoice.ref_po}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        No Faktur Pajak
                                    </span>
                                    <span>
                                        {detailInvoice.no_fakturpajak ?? '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        PPN
                                    </span>
                                    <span>{detailInvoice.ppn}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Price
                                    </span>
                                    <span>
                                        {formatRupiah(detailInvoice.harga)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Harga PPN
                                    </span>
                                    <span>
                                        {formatRupiah(detailInvoice.h_ppn)}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Total Price
                                    </span>
                                    <span>
                                        {formatRupiah(detailInvoice.g_total)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Tanggal Terima Invoice
                                    </span>
                                    <span>
                                        {detailInvoice.tgl_terimainv ?? '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Tanggal Bayar
                                    </span>
                                    <span>
                                        {detailInvoice.tgl_bayar ?? '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Jatuh Tempo
                                    </span>
                                    <span>{detailInvoice.jth_tempo}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Saldo Piutang/Sisa Bayar
                                    </span>
                                    <span>
                                        {formatRupiah(detailSaldoPiutang)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Total Bayar
                                    </span>
                                    <span>
                                        {formatRupiah(detailTotalBayar)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Harga Pembelian Pokok
                                    </span>
                                    <span>
                                        {formatRupiah(detailHargaPokok)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        Margin
                                    </span>
                                    <span>{formatNumber(detailMargin)}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
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
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <Input
                                className="h-9 min-w-64 flex-1"
                                placeholder="Cari no DO atau material..."
                                value={detailSearch}
                                onChange={(event) =>
                                    setDetailSearch(event.target.value)
                                }
                            />
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="h-9 w-40 px-2 py-2">
                                            No DO
                                        </TableHead>
                                        <TableHead className="h-9 px-2 py-2">
                                            Material
                                        </TableHead>
                                        <TableHead className="h-9 w-32 px-2 py-2">
                                            Qty
                                        </TableHead>
                                        <TableHead className="h-9 w-40 px-2 py-2">
                                            Price
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedDetailItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4}>
                                                Tidak ada data DO.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {displayedDetailItems.map((item, index) => (
                                        <TableRow
                                            key={`invoice-detail-${item.no_do}-${index}`}
                                        >
                                            <TableCell className="px-2 py-2 whitespace-nowrap">
                                                {item.no_do}
                                            </TableCell>
                                            <TableCell className="px-2 py-2">
                                                {item.material}
                                            </TableCell>
                                            <TableCell className="px-2 py-2 whitespace-nowrap">
                                                {item.qty} {item.unit}
                                            </TableCell>
                                            <TableCell className="px-2 py-2 whitespace-nowrap">
                                                {formatNumber(item.ttl_price)}
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
                                            type="button"
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
                                            type="button"
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
            </DialogContent>
        </Dialog>
    );
}
