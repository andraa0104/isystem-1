import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order' },
    { title: 'Purchase Order', href: '/marketing/purchase-order' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const getRawValue = (source, keys) => {
    if (!source) {
        return undefined;
    }

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

const isOutstanding = (item) => {
    const hasOutstanding = getRawValue(item, [
        'has_outstanding',
        'hasOutstanding',
        'has_outstanding',
    ]);
    return Number(hasOutstanding) === 1;
};

const isRealized = (item) => !isOutstanding(item);

export default function PurchaseOrderIndex({
    purchaseOrders = [],
    purchaseOrderDetails = [],
    detailNo = null,
    outstandingCount = 0,
    outstandingTotal = 0,
    realizedCount = 0,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPo, setSelectedPo] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(10);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);

    const filteredPurchaseOrders = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = purchaseOrders.filter((item) => {
            if (statusFilter === 'outstanding' && !isOutstanding(item)) {
                return false;
            }
            if (statusFilter === 'realized' && !isRealized(item)) {
                return false;
            }

            if (!term) {
                return true;
            }

            const values = [
                item.no_po,
                item.tgl,
                item.Tgl,
                item.ref_pr,
                item.refPR,
                item.no_pr,
                item.noPR,
                item.for_cus,
                item.for_cust,
                item.For_cus,
                item.For_cust,
                item.nm_vdr,
                item.Nm_vdr,
            ];

            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });

        return filtered.sort((a, b) =>
            String(b.no_po ?? '').localeCompare(String(a.no_po ?? ''))
        );
    }, [purchaseOrders, searchTerm, statusFilter]);

    const totalItems = filteredPurchaseOrders.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPurchaseOrders = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredPurchaseOrders;
        }

        const startIndex = (currentPage - 1) * pageSize;
        return filteredPurchaseOrders.slice(startIndex, startIndex + pageSize);
    }, [currentPage, filteredPurchaseOrders, pageSize]);

    const outstandingPurchaseOrders = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        return purchaseOrders
            .filter((item) => {
                if (!isOutstanding(item)) {
                    return false;
                }

                if (!term) {
                    return true;
                }

                const values = [
                    item.no_po,
                    item.tgl,
                    item.Tgl,
                    item.ref_pr,
                    item.refPR,
                    item.no_pr,
                    item.noPR,
                    item.for_cus,
                    item.for_cust,
                    item.For_cus,
                    item.For_cust,
                    item.nm_vdr,
                    item.Nm_vdr,
                ];

                return values.some((value) =>
                    String(value ?? '').toLowerCase().includes(term)
                );
            })
            .sort((a, b) =>
                String(b.no_po ?? '').localeCompare(String(a.no_po ?? ''))
            );
    }, [outstandingSearchTerm, purchaseOrders]);

    const outstandingTotalItems = outstandingPurchaseOrders.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(outstandingTotalItems / outstandingPageSize));
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstandingPurchaseOrders = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return outstandingPurchaseOrders;
        }

        const startIndex = (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingPurchaseOrders.slice(
            startIndex,
            startIndex + outstandingPageSize
        );
    }, [
        outstandingCurrentPage,
        outstandingPageSize,
        outstandingPurchaseOrders,
    ]);

    const selectedDetails = useMemo(() => {
        if (!selectedPo) {
            return [];
        }

        if (detailNo !== selectedPo.no_po) {
            return [];
        }

        return purchaseOrderDetails;
    }, [detailNo, purchaseOrderDetails, selectedPo]);

    const selectedDetail = selectedDetails[0] ?? null;

    const handlePageSizeChange = (event) => {
        const value = event.target.value;
        setPageSize(value === 'all' ? Infinity : Number(value));
    };

    const handleOpenModal = (item) => {
        setSelectedPo(item);
        setIsModalOpen(true);

        if (detailNo !== item.no_po) {
            router.get(
                '/marketing/purchase-order',
                { detail_no: item.no_po },
                {
                    preserveState: true,
                    preserveScroll: true,
                    only: ['purchaseOrderDetails', 'detailNo'],
                }
            );
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Purchase Order" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Purchase Order</h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar PO
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => router.visit('/marketing/purchase-order/create')}
                    >
                        Tambah PO
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setIsOutstandingModalOpen(true)}
                        className="text-left"
                    >
                        <Card className="transition hover:border-primary/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription>PO Outstanding</CardDescription>
                                <CardTitle className="text-2xl">
                                    {outstandingCount}
                                </CardTitle>
                                <div className="text-sm text-muted-foreground">
                                    {formatRupiah(outstandingTotal)}
                                </div>
                            </CardHeader>
                        </Card>
                    </button>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>PO Terealisasi</CardDescription>
                            <CardTitle className="text-2xl">
                                {realizedCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={pageSize === Infinity ? 'all' : pageSize}
                                onChange={handlePageSizeChange}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Status
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="outstanding">PO Outstanding</option>
                                <option value="realized">PO Terealisasi</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </label>
                    </div>
                    <label className="text-sm text-muted-foreground">
                        Cari
                        <input
                            type="search"
                            className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                            placeholder="Cari no PO, no PR, customer, vendor..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">No PO</th>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-left">Nama Vendor</th>
                                <th className="px-4 py-3 text-left">Total Price</th>
                                <th className="px-4 py-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedPurchaseOrders.length === 0 && (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-center text-muted-foreground"
                                        colSpan={6}
                                    >
                                        Belum ada data PO.
                                    </td>
                                </tr>
                            )}
                            {displayedPurchaseOrders.map((item) => (
                                <tr
                                    key={item.no_po}
                                    className="border-t border-sidebar-border/70"
                                >
                                    <td className="px-4 py-3">{item.no_po}</td>
                                    <td className="px-4 py-3">
                                        {getValue(item, ['tgl', 'Tgl', 'TGL', 'date', 'Date'])}
                                    </td>
                                    <td className="px-4 py-3">
                                        {getValue(item, [
                                            'for_cus',
                                            'For_cus',
                                            'FOR_CUS',
                                            'for_cust',
                                            'For_cust',
                                            'FOR_CUST',
                                            'for_customer',
                                        ])}
                                    </td>
                                    <td className="px-4 py-3">
                                        {getValue(item, [
                                            'nm_vdr',
                                            'Nm_vdr',
                                            'NM_VDR',
                                            'vendor',
                                            'Vendor',
                                        ])}
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatRupiah(
                                            getValue(item, [
                                                'g_total',
                                                'G_total',
                                                'G_TOTAL',
                                                'total',
                                                'Total',
                                            ])
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenModal(item)}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Lihat"
                                                title="Lihat"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                            <a
                                                href={`/marketing/purchase-order/${encodeURIComponent(
                                                    item.no_po
                                                )}/print`}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Cetak"
                                                title="Cetak"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <Printer className="size-4" />
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pageSize !== Infinity && totalItems > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>
                            Menampilkan{' '}
                            {Math.min((currentPage - 1) * pageSize + 1, totalItems)}-
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
                            <span className="text-sm text-muted-foreground">
                                Halaman {currentPage} dari {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.min(totalPages, page + 1)
                                    )
                                }
                                disabled={currentPage === totalPages}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                )}

                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            setSelectedPo(null);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Purchase Order</DialogTitle>
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
                                                    {getValue(selectedDetail, [
                                                        'del_time',
                                                        'delivery_time',
                                                    ])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Payment Terms
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, [
                                                        'payment_terms',
                                                    ])}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Franco Loco
                                                </span>
                                                <span>
                                                    {getValue(selectedDetail, [
                                                        'franco_loco',
                                                    ])}
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
                                    <h3 className="text-base font-semibold">
                                        Data Material
                                    </h3>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">
                                                        No
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Material
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Qty
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Satuan
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Price
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Total Price
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedDetails.length === 0 && (
                                                    <tr>
                                                        <td
                                                            className="px-4 py-6 text-center text-muted-foreground"
                                                            colSpan={6}
                                                        >
                                                            Tidak ada detail PO.
                                                        </td>
                                                    </tr>
                                                )}
                                                {selectedDetails.map((detail, index) => (
                                                    <tr
                                                        key={`${detail.no ?? index}`}
                                                        className="border-t border-sidebar-border/70"
                                                    >
                                                        <td className="px-4 py-3">
                                                            {renderValue(detail.no ?? index + 1)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, [
                                                                'material',
                                                                'Material',
                                                            ])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, [
                                                                'qty',
                                                                'Qty',
                                                            ])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {getValue(detail, [
                                                                'unit',
                                                                'Unit',
                                                            ])}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(
                                                                getRawValue(detail, [
                                                                    'price',
                                                                    'Price',
                                                                ])
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(
                                                                getRawValue(detail, [
                                                                    'total_price',
                                                                    'Total_price',
                                                                ])
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isOutstandingModalOpen}
                    onOpenChange={(open) => {
                        setIsOutstandingModalOpen(open);
                        if (!open) {
                            setOutstandingSearchTerm('');
                            setOutstandingPageSize(10);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>PO Outstanding</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        outstandingPageSize === Infinity
                                            ? 'all'
                                            : outstandingPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setOutstandingPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value)
                                        );
                                        setOutstandingCurrentPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari no PO, no PR, customer, vendor..."
                                    value={outstandingSearchTerm}
                                    onChange={(event) =>
                                        setOutstandingSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">No PO</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Nama Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Total Price
                                        </th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedOutstandingPurchaseOrders.length ===
                                        0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={6}
                                            >
                                                Tidak ada PO outstanding.
                                            </td>
                                        </tr>
                                    )}
                                    {displayedOutstandingPurchaseOrders.map(
                                        (item) => (
                                            <tr
                                                key={`outstanding-${item.no_po}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {item.no_po}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getValue(item, [
                                                        'tgl',
                                                        'Tgl',
                                                        'date',
                                                        'Date',
                                                    ])}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getValue(item, [
                                                        'for_cus',
                                                        'for_cust',
                                                        'for_customer',
                                                    ])}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getValue(item, [
                                                        'nm_vdr',
                                                        'Nm_vdr',
                                                        'vendor',
                                                        'Vendor',
                                                    ])}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {formatRupiah(
                                                        getValue(item, [
                                                            'g_total',
                                                            'G_total',
                                                            'total',
                                                            'Total',
                                                        ])
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/marketing/purchase-order/${encodeURIComponent(
                                                            item.no_po
                                                        )}/edit`}
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Edit"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {outstandingPageSize !== Infinity &&
                            outstandingTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (outstandingCurrentPage - 1) *
                                                outstandingPageSize +
                                                1,
                                            outstandingTotalItems
                                        )}
                                        -
                                        {Math.min(
                                            outstandingCurrentPage *
                                                outstandingPageSize,
                                            outstandingTotalItems
                                        )}{' '}
                                        dari {outstandingTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage((page) =>
                                                    Math.max(1, page - 1)
                                                )
                                            }
                                            disabled={outstandingCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {outstandingCurrentPage} dari{' '}
                                            {outstandingTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage((page) =>
                                                    Math.min(
                                                        outstandingTotalPages,
                                                        page + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage ===
                                                outstandingTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
