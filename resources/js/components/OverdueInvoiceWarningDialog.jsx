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
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useEffect, useMemo, useState } from 'react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(
        String(value ?? '')
            .replace(/,/g, '')
            .trim(),
    );
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value, showCurrencyPrefix = true) =>
    `${showCurrencyPrefix ? 'Rp. ' : ''}${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(toNumber(value)))}`;

const pageSizeOptions = [5, 10, 15, 25, 50];
const ageFilterOptions = [
    {
        value: 'all',
        label: 'Semua data',
        matches: () => true,
    },
    {
        value: '0-30',
        label: '0 - 30 hari',
        matches: (days) => days >= 0 && days <= 30,
    },
    ...[30, 60, 90, 180, 360, 720].map((days) => ({
        value: `gt-${days}`,
        label: `> ${days} hari`,
        matches: (value) => value > days,
    })),
];

export default function OverdueInvoiceWarningDialog({
    open,
    onOpenChange,
    data,
    onInvoiceClick = null,
    onConfirm,
    isSubmitting = false,
    showActions = true,
    title = 'Konfirmasi Tunggakan Tagihan',
    description = 'Customer ini memiliki tagihan yang sudah melewati jatuh tempo.',
    extraFilters = null,
    enableAgeFilter = true,
    showCurrencyPrefix = false,
    showOldestOverdue = false,
}) {
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [ageFilter, setAgeFilter] = useState('gt-90');

    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
    const selectedAgeFilter =
        ageFilterOptions.find((option) => option.value === ageFilter) ??
        ageFilterOptions[4];

    const filteredInvoices = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return invoices.filter((invoice) => {
            const matchesAge =
                !enableAgeFilter ||
                selectedAgeFilter.matches(toNumber(invoice.umur_tempo));
            const matchesSearch =
                !keyword ||
                String(invoice.no_fakturpenjualan ?? '')
                    .toLowerCase()
                    .includes(keyword);

            return matchesAge && matchesSearch;
        });
    }, [enableAgeFilter, invoices, search, selectedAgeFilter]);

    const filteredTotalOverdue = useMemo(
        () =>
            filteredInvoices.reduce(
                (total, invoice) => total + toNumber(invoice.saldo_piutang),
                0,
            ),
        [filteredInvoices],
    );

    const totalPages =
        pageSize === Infinity
            ? 1
            : Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const normalizedPage = Math.min(currentPage, totalPages);
    const visibleInvoices =
        pageSize === Infinity
            ? filteredInvoices
            : filteredInvoices.slice(
                  (normalizedPage - 1) * pageSize,
                  normalizedPage * pageSize,
              );

    useEffect(() => {
        setCurrentPage(1);
    }, [search, pageSize, ageFilter, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] !w-[96vw] !max-w-[1600px] flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div
                    className={`grid gap-3 rounded-md border bg-muted/30 p-4 text-sm ${showOldestOverdue ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
                >
                    <div>
                        <div className="text-muted-foreground">Customer</div>
                        <div className="font-semibold">
                            {renderValue(data?.customer)}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">
                            Jumlah Tunggakan
                            {enableAgeFilter
                                ? ` ${selectedAgeFilter.label}`
                                : ''}
                        </div>
                        <div className="font-semibold">
                            {formatAmount(
                                enableAgeFilter
                                    ? filteredTotalOverdue
                                    : data?.total_overdue,
                                showCurrencyPrefix,
                            )}
                        </div>
                    </div>
                    {showOldestOverdue && (
                        <div>
                            <div className="text-muted-foreground">
                                Umur Tempo Terlama
                            </div>
                            <div className="font-semibold">
                                {toNumber(data?.oldest_overdue_days)} hari
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <label>
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={pageSize === Infinity ? 'all' : pageSize}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPageSize(
                                        value === 'all'
                                            ? Infinity
                                            : Number(value),
                                    );
                                }}
                            >
                                {pageSizeOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                                <option value="all">Semua data</option>
                            </select>
                        </label>
                        {extraFilters}
                        {enableAgeFilter && (
                            <label>
                                Umur Tunggakan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={ageFilter}
                                    onChange={(event) =>
                                        setAgeFilter(event.target.value)
                                    }
                                >
                                    {ageFilterOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <Input
                        className="w-full md:w-80"
                        placeholder="Cari no faktur penjualan..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="relative min-h-0 flex-1 overflow-auto rounded-md border">
                    <table className="w-full min-w-[1650px] caption-bottom text-sm">
                        <TableHeader className="bg-muted [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                            <TableRow>
                                <TableHead className="sticky left-0 !z-20 bg-muted">
                                    No Faktur Penjualan
                                </TableHead>
                                <TableHead>Date Doc</TableHead>
                                <TableHead>Ref PO</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Tagihan</TableHead>
                                <TableHead>PPN</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Date Tempo</TableHead>
                                <TableHead>Date Receive Inv</TableHead>
                                <TableHead>Date Payment</TableHead>
                                <TableHead>Total Payment</TableHead>
                                <TableHead>Saldo Piutang</TableHead>
                                <TableHead>Umur Tempo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={13}
                                        className="text-center"
                                    >
                                        Tidak ada data tunggakan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleInvoices.map((invoice) => (
                                    <TableRow key={invoice.no_fakturpenjualan}>
                                        <TableCell className="sticky left-0 z-10 bg-background">
                                            {onInvoiceClick &&
                                            invoice.no_fakturpenjualan ? (
                                                <button
                                                    type="button"
                                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                                    onClick={() =>
                                                        onInvoiceClick(invoice)
                                                    }
                                                >
                                                    {invoice.no_fakturpenjualan}
                                                </button>
                                            ) : (
                                                renderValue(
                                                    invoice.no_fakturpenjualan,
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.tgl_doc)}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.ref_po)}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.nm_cs)}
                                        </TableCell>
                                        <TableCell>
                                            {formatAmount(
                                                invoice.harga,
                                                showCurrencyPrefix,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatAmount(
                                                invoice.h_ppn,
                                                showCurrencyPrefix,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatAmount(
                                                invoice.g_total,
                                                showCurrencyPrefix,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.jth_tempo)}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.tgl_terimainv)}
                                        </TableCell>
                                        <TableCell>
                                            {renderValue(invoice.tgl_bayar)}
                                        </TableCell>
                                        <TableCell>
                                            {formatAmount(
                                                invoice.total_bayaran,
                                                showCurrencyPrefix,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatAmount(
                                                invoice.saldo_piutang,
                                                showCurrencyPrefix,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {toNumber(invoice.umur_tempo)} hari
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>
                        Menampilkan {visibleInvoices.length} dari{' '}
                        {filteredInvoices.length} data
                    </div>
                    {pageSize !== Infinity && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                disabled={normalizedPage <= 1}
                            >
                                Prev
                            </Button>
                            <span>
                                Page {normalizedPage} of {totalPages}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.min(totalPages, page + 1),
                                    )
                                }
                                disabled={normalizedPage >= totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>

                {showActions && (
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={onConfirm}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Lanjut Simpan'}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
