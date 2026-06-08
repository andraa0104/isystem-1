import OverdueInvoiceWarningDialog from '@/components/OverdueInvoiceWarningDialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Review Tagihan', href: '/penjualan/review-tagihan' },
];

const overdueRanges = [
    { value: '30', label: '30 hari' },
    { value: '60', label: '60 hari' },
    { value: '90', label: '90 hari' },
    { value: '180', label: '180 hari' },
    { value: '360', label: '360 hari' },
    { value: '720', label: '720 hari' },
    { value: 'gt720', label: '> 720 hari' },
    { value: 'all', label: 'Semua data' },
];

const pageSizes = [5, 10, 25, 50, 100];
const sortOptions = [
    { value: 'oldest_due', label: 'Jatuh tempo terlama' },
    { value: 'shortest_due', label: 'Jatuh tempo pendek' },
    { value: 'largest_balance', label: 'Saldo piutang terbesar' },
    { value: 'smallest_balance', label: 'Saldo piutang terkecil' },
    { value: 'most_invoices', label: 'Total faktur terbanyak' },
    { value: 'fewest_invoices', label: 'Total faktur sedikit' },
];

const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatRupiah = (value) =>
    `Rp. ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(toNumber(value)))}`;

const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
}).format(new Date());

export default function ReviewTagihanIndex() {
    const [summary, setSummary] = useState({
        near_due_customers: 0,
        near_due_invoices: 0,
        current_month_customers: 0,
        current_month_invoices: 0,
        overdue_customers: 0,
        overdue_invoices: 0,
    });
    const [overdueRange, setOverdueRange] = useState('30');
    const [customers, setCustomers] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [sort, setSort] = useState('oldest_due');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [modalTitle, setModalTitle] = useState('Review Tagihan');
    const [invoicePaymentFilter, setInvoicePaymentFilter] = useState('all');

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(customerTotal / pageSize)),
        [customerTotal, pageSize],
    );

    const loadSummary = async () => {
        const params = new URLSearchParams();
        params.set('overdue_range', overdueRange);

        const response = await fetch(
            `/penjualan/review-tagihan/summary?${params.toString()}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) return;
        setSummary(await response.json());
    };

    const loadCustomers = async (page = currentPage) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(pageSize));
            params.set('sort', sort);
            if (search.trim()) {
                params.set('search', search.trim());
            }

            const response = await fetch(
                `/penjualan/review-tagihan/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) throw new Error('Request failed');
            const data = await response.json();
            setCustomers(Array.isArray(data?.data) ? data.data : []);
            setCustomerTotal(Number(data?.total ?? 0));
        } finally {
            setLoading(false);
        }
    };

    const openInvoiceModal = async ({
        scope = 'overdue',
        customer = '',
        range = overdueRange,
        showPaymentFilter = false,
    }) => {
        const params = new URLSearchParams();
        params.set('scope', scope);
        params.set('overdue_range', range);
        if (customer) {
            params.set('customer', customer);
        }

        const response = await fetch(
            `/penjualan/review-tagihan/invoices?${params.toString()}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) return;
        const data = await response.json();
        setModalData({
            ...data,
            showPaymentFilter,
        });
        setInvoicePaymentFilter('all');
        setModalTitle(customer || data?.customer || 'Review Tagihan');
        setModalOpen(true);
    };

    const filteredModalData = useMemo(() => {
        const invoices = Array.isArray(modalData?.invoices)
            ? modalData.invoices
            : [];
        if (!modalData?.showPaymentFilter || invoicePaymentFilter === 'all') {
            return modalData;
        }

        const filteredInvoices = invoices.filter((invoice) => {
            const total = toNumber(invoice.g_total);
            const saldoPiutang = toNumber(invoice.saldo_piutang);

            if (invoicePaymentFilter === 'unpaid') {
                return total > 0 && saldoPiutang === total;
            }

            if (invoicePaymentFilter === 'partial') {
                return saldoPiutang > 0 && saldoPiutang < total;
            }

            return true;
        });

        return {
            ...modalData,
            invoices: filteredInvoices,
            total_overdue: filteredInvoices.reduce(
                (sum, invoice) => sum + toNumber(invoice.saldo_piutang),
                0,
            ),
            oldest_overdue_days: filteredInvoices.reduce(
                (max, invoice) => Math.max(max, toNumber(invoice.umur_tempo)),
                0,
            ),
        };
    }, [modalData, invoicePaymentFilter]);

    useEffect(() => {
        loadSummary();
    }, [overdueRange]);

    useEffect(() => {
        loadCustomers(currentPage);
    }, [currentPage, pageSize, sort]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (currentPage === 1) {
                loadCustomers(1);
            } else {
                setCurrentPage(1);
            }
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [search]);

    return (
        <>
            <Head title="Review Tagihan" />
            <div className="flex-1 space-y-6 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Review Tagihan</h1>
                    <p className="text-sm text-muted-foreground">
                        Monitoring saldo piutang berdasarkan jatuh tempo.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card
                        className="cursor-pointer transition hover:border-primary"
                        onClick={() =>
                            openInvoiceModal({ scope: 'near_due' })
                        }
                    >
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">
                                Dekat Jatuh Tempo
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {summary.near_due_customers}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                customer
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {summary.near_due_invoices} invoice
                            </p>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer transition hover:border-primary"
                        onClick={() =>
                            openInvoiceModal({ scope: 'current_month' })
                        }
                    >
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">
                                Jatuh Tempo Bulan {currentMonthName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {summary.current_month_customers}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                customer
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {summary.current_month_invoices} invoice
                            </p>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer transition hover:border-primary"
                        onClick={() => openInvoiceModal({ scope: 'overdue' })}
                    >
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle className="text-sm text-muted-foreground">
                                    Lewat Jatuh Tempo
                                </CardTitle>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={overdueRange}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                        setOverdueRange(event.target.value)
                                    }
                                >
                                    {overdueRanges.map((range) => (
                                        <option
                                            key={range.value}
                                            value={range.value}
                                        >
                                            {range.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {summary.overdue_customers}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                customer
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {summary.overdue_invoices} invoice
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle>Customer Lewat Jatuh Tempo</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={pageSize}
                                    onChange={(event) => {
                                        setPageSize(Number(event.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    {pageSizes.map((size) => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={sort}
                                    onChange={(event) => {
                                        setSort(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {sortOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    className="w-72"
                                    placeholder="Cari nama customer..."
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow>
                                        <TableHead>Nama Customer</TableHead>
                                        <TableHead>Total Faktur</TableHead>
                                        <TableHead>Total Saldo Piutang</TableHead>
                                        <TableHead>
                                            Umur Jatuh Tempo Terlama
                                        </TableHead>
                                        <TableHead className="w-[80px]">
                                            Aksi
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center"
                                            >
                                                Memuat data...
                                            </TableCell>
                                        </TableRow>
                                    ) : customers.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center"
                                            >
                                                Tidak ada data.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        customers.map((customer) => (
                                            <TableRow key={customer.nm_cs}>
                                                <TableCell className="font-medium">
                                                    {customer.nm_cs || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {customer.total_faktur}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(
                                                        customer.total_saldo_piutang,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {
                                                        customer.umur_tempo_terlama
                                                    }{' '}
                                                    hari
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openInvoiceModal({
                                                                scope: 'overdue',
                                                                range: 'all',
                                                                showPaymentFilter:
                                                                    true,
                                                                customer:
                                                                    customer.nm_cs,
                                                            })
                                                        }
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <div>Total {customerTotal} customer</div>
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
                                    disabled={currentPage <= 1}
                                >
                                    Prev
                                </Button>
                                <span>
                                    Page {currentPage} of {totalPages}
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
                                    disabled={currentPage >= totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <OverdueInvoiceWarningDialog
                open={modalOpen}
                onOpenChange={setModalOpen}
                data={filteredModalData}
                showActions={false}
                title={modalTitle}
                description="Daftar faktur penjualan yang masih memiliki saldo piutang."
                extraFilters={
                    modalData?.showPaymentFilter ? (
                        <label>
                            Status
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={invoicePaymentFilter}
                                onChange={(event) =>
                                    setInvoicePaymentFilter(event.target.value)
                                }
                            >
                                <option value="all">Semua data</option>
                                <option value="unpaid">Belum lunas</option>
                                <option value="partial">Lunas sebagian</option>
                            </select>
                        </label>
                    ) : null
                }
            />
        </>
    );
}

ReviewTagihanIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
