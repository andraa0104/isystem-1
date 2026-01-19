import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Eye, Pencil, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/delivery-order' },
    { title: 'Delivery Order', href: '/marketing/delivery-order' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

const getStatusValue = (item) => {
    const value = item?.val_inv ?? item?.Val_inv ?? item?.valInv;
    return Number(value);
};

export default function DeliveryOrderIndex({
    deliveryOrders = [],
    outstandingCount = 0,
    realizedCount = 0,
    outstandingTotal = 0,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedDo, setSelectedDo] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(10);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [selectedDetails, setSelectedDetails] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');

    const filteredDeliveryOrders = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = deliveryOrders.filter((item) => {
            const statusValue = getStatusValue(item);
            const isOutstanding = statusValue === 0;
            const isRealized = statusValue === 1;

            if (statusFilter === 'outstanding' && !isOutstanding) {
                return false;
            }
            if (statusFilter === 'realized' && !isRealized) {
                return false;
            }

            if (!term) {
                return true;
            }

            const values = [item.no_do, item.ref_po, item.nm_cs];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });

        return filtered.sort((a, b) => {
            const dateCompare = String(b.date ?? '').localeCompare(
                String(a.date ?? '')
            );
            if (dateCompare !== 0) {
                return dateCompare;
            }
            return String(b.no_do ?? '').localeCompare(String(a.no_do ?? ''));
        });
    }, [deliveryOrders, searchTerm, statusFilter]);

    const totalItems = filteredDeliveryOrders.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedDeliveryOrders = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredDeliveryOrders;
        }

        const startIndex = (currentPage - 1) * pageSize;
        return filteredDeliveryOrders.slice(startIndex, startIndex + pageSize);
    }, [currentPage, filteredDeliveryOrders, pageSize]);

    const outstandingDeliveryOrders = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        return outstandingList
            .filter((item) => {
                if (getStatusValue(item) !== 0) {
                    return false;
                }

                if (!term) {
                    return true;
                }

                const values = [item.no_do, item.ref_po, item.nm_cs];
                return values.some((value) =>
                    String(value ?? '').toLowerCase().includes(term)
                );
            })
            .sort((a, b) => {
                const dateCompare = String(b.date ?? '').localeCompare(
                    String(a.date ?? '')
                );
                if (dateCompare !== 0) {
                    return dateCompare;
                }
                return String(b.no_do ?? '').localeCompare(String(a.no_do ?? ''));
            });
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = outstandingDeliveryOrders.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return 1;
        }

        return Math.max(
            1,
            Math.ceil(outstandingTotalItems / outstandingPageSize)
        );
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstandingDeliveryOrders = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return outstandingDeliveryOrders;
        }

        const startIndex = (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingDeliveryOrders.slice(
            startIndex,
            startIndex + outstandingPageSize
        );
    }, [
        outstandingCurrentPage,
        outstandingDeliveryOrders,
        outstandingPageSize,
    ]);

    const handleOpenDetailModal = (item) => {
        setSelectedDo(item);
        setIsDetailModalOpen(true);
        setSelectedDetails([]);
        setSelectedAddress('');
        setDetailError('');
        setDetailLoading(true);
        fetch(
            `/marketing/delivery-order/details?no_do=${encodeURIComponent(
                item.no_do
            )}`,
            { headers: { Accept: 'application/json' } }
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setSelectedDetails(
                    Array.isArray(data?.deliveryOrderDetails)
                        ? data.deliveryOrderDetails
                        : []
                );
                setSelectedAddress(data?.customerAddress ?? '');
            })
            .catch(() => {
                setDetailError('Gagal memuat detail DO.');
            })
            .finally(() => {
                setDetailLoading(false);
            });
    };

    const loadOutstanding = () => {
        if (outstandingLoading || outstandingList.length > 0) {
            return;
        }
        setOutstandingLoading(true);
        setOutstandingError('');
        fetch('/marketing/delivery-order/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setOutstandingList(
                    Array.isArray(data?.deliveryOrders)
                        ? data.deliveryOrders
                        : []
                );
            })
            .catch(() => {
                setOutstandingError('Gagal memuat data DO outstanding.');
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    const selectedGrandTotal = useMemo(
        () =>
            selectedDetails.reduce((total, detail) => {
                const value = detail?.total ?? detail?.Total;
                return total + toNumber(value);
            }, 0),
        [selectedDetails]
    );

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
            <Head title="Delivery Order" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Delivery Order</h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar DO
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/marketing/delivery-order/create">
                            Tambah DO
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOutstandingModalOpen(true);
                            loadOutstanding();
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-primary/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription>DO Outstanding</CardDescription>
                                <CardTitle className="text-2xl">
                                    {outstandingCount}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Grand total outstanding
                                </p>
                                <p className="text-sm font-semibold">
                                    Rp {formatNumber(outstandingTotal)}
                                </p>
                            </CardContent>
                        </Card>
                    </button>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>DO Terealisasi</CardDescription>
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
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPageSize(
                                        value === 'all' ? Infinity : Number(value)
                                    );
                                }}
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
                                <option value="outstanding">
                                    DO Outstanding
                                </option>
                                <option value="realized">DO Terealisasi</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </label>
                    </div>
                    <label className="text-sm text-muted-foreground">
                        Cari
                        <input
                            type="search"
                            className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                            placeholder="Cari nomor DO, ref PO, customer..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">No DO</th>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Ref PO</th>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedDeliveryOrders.length === 0 && (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-center text-muted-foreground"
                                        colSpan={5}
                                    >
                                        Belum ada data DO.
                                    </td>
                                </tr>
                            )}
                            {displayedDeliveryOrders.map((item) => (
                                <tr
                                    key={item.no_do}
                                    className="border-t border-sidebar-border/70"
                                >
                                    <td className="px-4 py-3">{item.no_do}</td>
                                    <td className="px-4 py-3">{item.date}</td>
                                    <td className="px-4 py-3">{item.ref_po}</td>
                                    <td className="px-4 py-3">{item.nm_cs}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleOpenDetailModal(item)
                                                }
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Lihat"
                                                title="Lihat"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                            <a
                                                href={`/marketing/delivery-order/${encodeURIComponent(
                                                    item.no_do
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
                            {Math.min((currentPage - 1) * pageSize + 1, totalItems)}
                            -{Math.min(currentPage * pageSize, totalItems)} dari{' '}
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
                    open={isDetailModalOpen}
                    onOpenChange={(open) => {
                        setIsDetailModalOpen(open);
                        if (!open) {
                            setSelectedDo(null);
                            setSelectedDetails([]);
                            setSelectedAddress('');
                            setDetailError('');
                            setDetailLoading(false);
                        }
                    }}
                >
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Detail Delivery Order</DialogTitle>
                        </DialogHeader>

                        {selectedDo && (
                            <div className="space-y-5">
                                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <div>Nomor DO</div>
                                        <div className="font-semibold text-foreground">
                                            {renderValue(selectedDo.no_do)}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div>Date</div>
                                        <div className="font-semibold text-foreground">
                                            {renderValue(selectedDo.date)}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div>Ref. PO</div>
                                        <div className="font-semibold text-foreground">
                                            {renderValue(selectedDo.ref_po)}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div>Nama Customer</div>
                                        <div className="font-semibold text-foreground">
                                            {renderValue(selectedDo.nm_cs)}
                                        </div>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <div>Alamat</div>
                                        <div className="font-semibold text-foreground">
                                            {renderValue(selectedAddress)}
                                        </div>
                                    </div>
                                </div>

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
                                                    Harga
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Total
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Remark
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
                                                        {detailLoading
                                                            ? 'Memuat detail DO...'
                                                            : detailError ||
                                                              'Tidak ada detail DO.'}
                                                    </td>
                                                </tr>
                                            )}
                                            {selectedDetails.map((detail, index) => (
                                                <tr
                                                    key={`${detail.no_do}-${index}`}
                                                    className="border-t border-sidebar-border/70"
                                                >
                                                    <td className="px-4 py-3">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(detail.mat)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(detail.qty)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatNumber(detail.harga)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatNumber(detail.total)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(detail.remark)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="text-right text-sm text-muted-foreground">
                                    Grand Total:{' '}
                                    <span className="font-semibold text-foreground">
                                        Rp {formatNumber(selectedGrandTotal)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isOutstandingModalOpen}
                    onOpenChange={(open) => {
                        setIsOutstandingModalOpen(open);
                        if (open) {
                            loadOutstanding();
                        } else {
                            setOutstandingSearchTerm('');
                            setOutstandingPageSize(10);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>DO Outstanding</DialogTitle>
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
                                    placeholder="Cari nomor DO, ref PO, customer..."
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
                                        <th className="px-4 py-3 text-left">
                                            No DO
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Ref PO
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedOutstandingDeliveryOrders.length ===
                                        0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {outstandingLoading
                                                    ? 'Memuat data DO...'
                                                    : outstandingError ||
                                                      'Tidak ada DO outstanding.'}
                                            </td>
                                        </tr>
                                    )}
                                    {displayedOutstandingDeliveryOrders.map(
                                        (item) => (
                                            <tr
                                                key={`outstanding-${item.no_do}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {item.no_do}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.date}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.ref_po}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.nm_cs}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/marketing/delivery-order/${encodeURIComponent(
                                                            item.no_do,
                                                        )}/edit`}
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Edit"
                                                        title="Edit"
                                                        onClick={() => {
                                                            setIsOutstandingModalOpen(false);
                                                        }}
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
