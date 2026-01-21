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
import { Head } from '@inertiajs/react';
import { Eye, Pencil, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/delivery-order-cost' },
    { title: 'Delivery Order Cost', href: '/marketing/delivery-order-cost' },
];

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const getStatusValue = (item) => {
    const value = item?.status ?? item?.Status ?? item?.statusValue;
    return Number(value);
};

export default function DeliveryOrderCostIndex({
    deliveryOrders = [],
    outstandingCount = 0,
    outstandingTotal = 0,
    realizedCount = 0,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailItems, setDetailItems] = useState([]);
    const [detailHeader, setDetailHeader] = useState(null);
    const [detailSearchTerm, setDetailSearchTerm] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');

    const filteredDeliveryOrders = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = deliveryOrders.filter((item) => {
            const statusValue = getStatusValue(item);
            if (statusFilter === 'outstanding' && statusValue !== 0) {
                return false;
            }
            if (statusFilter === 'realized' && statusValue !== 1) {
                return false;
            }

            if (!term) {
                return true;
            }

            return (
                String(item.no_alokasi ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_permintaan ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });

        return filtered;
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

    const filteredDetailItems = useMemo(() => {
        const term = detailSearchTerm.trim().toLowerCase();
        if (!term) {
            return detailItems;
        }
        return detailItems.filter((item) =>
            String(item.mat ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [detailItems, detailSearchTerm]);

    const detailTotalItems = filteredDetailItems.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) {
            return filteredDetailItems;
        }
        const startIndex = (detailCurrentPage - 1) * detailPageSize;
        return filteredDetailItems.slice(
            startIndex,
            startIndex + detailPageSize,
        );
    }, [detailCurrentPage, detailPageSize, filteredDetailItems]);

    const detailGrandTotal = useMemo(
        () =>
            detailItems.reduce((total, item) => {
                const value = item?.total ?? item?.Total;
                return total + toNumber(value);
            }, 0),
        [detailItems],
    );

    const outstandingFiltered = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        if (!term) {
            return outstandingList;
        }
        return outstandingList.filter((item) => {
            return (
                String(item.no_alokasi ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_permintaan ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = outstandingFiltered.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return 1;
        }
        return Math.max(
            1,
            Math.ceil(outstandingTotalItems / outstandingPageSize),
        );
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstanding = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return outstandingFiltered;
        }
        const startIndex =
            (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingFiltered.slice(
            startIndex,
            startIndex + outstandingPageSize,
        );
    }, [outstandingCurrentPage, outstandingFiltered, outstandingPageSize]);

    const handleOpenDetailModal = (item) => {
        setIsDetailModalOpen(true);
        setDetailItems([]);
        setDetailHeader(null);
        setDetailError('');
        setDetailSearchTerm('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setDetailLoading(true);
        fetch(
            `/marketing/delivery-order-cost/details?no_alokasi=${encodeURIComponent(
                item.no_alokasi,
            )}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setDetailItems(
                    Array.isArray(data?.details) ? data.details : [],
                );
                setDetailHeader(data?.header ?? null);
            })
            .catch(() => {
                setDetailError('Gagal memuat detail DOBi.');
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
        fetch('/marketing/delivery-order-cost/outstanding', {
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
                        : [],
                );
            })
            .catch(() => {
                setOutstandingError('Gagal memuat data DOBi.');
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        setDetailCurrentPage(1);
    }, [detailSearchTerm, detailPageSize]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Delivery Order Cost" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Delivery Order Cost
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar DO biaya
                        </p>
                    </div>
                    <Button asChild type="button">
                        <a href="/marketing/delivery-order-cost/create">
                            Tambah DO Biaya
                        </a>
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card
                        className="cursor-pointer transition hover:shadow-sm"
                        onClick={() => {
                            setIsOutstandingModalOpen(true);
                            loadOutstanding();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                setIsOutstandingModalOpen(true);
                                loadOutstanding();
                            }
                        }}
                    >
                        <CardHeader>
                            <CardTitle>DO Biaya Belum Dibebankan</CardTitle>
                            <CardDescription>
                                Jumlah DO biaya outstanding
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">
                                {outstandingCount}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Rp {formatNumber(outstandingTotal)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>DO Biaya Sudah Dibebankan</CardTitle>
                            <CardDescription>
                                Jumlah DO biaya selesai
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">
                                {realizedCount}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar DO Biaya</CardTitle>
                        <CardDescription>
                            Data DO biaya berdasarkan status
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        pageSize === Infinity ? 'all' : pageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setPageSize(
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
                            <label className="text-sm text-muted-foreground">
                                Filter
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                >
                                    <option value="outstanding">
                                        DO biaya belum dibebankan
                                    </option>
                                    <option value="realized">
                                        DO biaya sudah dibebankan
                                    </option>
                                    <option value="all">Semua data</option>
                                </select>
                            </label>
                            <label className="text-sm text-muted-foreground">
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari no alokasi, permintaan..."
                                    value={searchTerm}
                                    onChange={(event) =>
                                        setSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            No DOBi
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Permintaan
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Departemen
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedDeliveryOrders.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                Belum ada data DOBi.
                                            </td>
                                        </tr>
                                    )}
                                    {displayedDeliveryOrders.map((item) => (
                                        <tr
                                            key={item.no_alokasi}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {item.no_alokasi}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.ref_permintaan}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.kd_cs}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleOpenDetailModal(
                                                                item,
                                                            )
                                                        }
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Lihat"
                                                        title="Lihat"
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                    <a
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Cetak"
                                                        title="Cetak"
                                                        href={`/marketing/delivery-order-cost/${encodeURIComponent(
                                                            item.no_alokasi,
                                                        )}/print`}
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
                                    {Math.min(
                                        (currentPage - 1) * pageSize + 1,
                                        totalItems,
                                    )}
                                    -{Math.min(currentPage * pageSize, totalItems)}{' '}
                                    dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
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
                                                Math.min(totalPages, page + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Detail Delivery Order Cost</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-3">
                            <div>
                                <div className="text-muted-foreground">
                                    Nomor DO Biaya
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.no_alokasi)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Date</div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.date)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">
                                    Posting Date
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.pos_tgl)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">
                                    Permintaan
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.ref_permintaan)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">
                                    Departemen
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.kd_cs)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Nama</div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.nm_cs)}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
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
                            <label className="text-sm text-muted-foreground">
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari material..."
                                    value={detailSearchTerm}
                                    onChange={(event) =>
                                        setDetailSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
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
                                    {detailLoading ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                Memuat data...
                                            </td>
                                        </tr>
                                    ) : detailError ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                {detailError}
                                            </td>
                                        </tr>
                                    ) : displayedDetailItems.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedDetailItems.map((item, index) => (
                                            <tr
                                                key={`${item.no_alokasi}-${index}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {index +
                                                        1 +
                                                        (detailCurrentPage -
                                                            1) *
                                                            (detailPageSize ===
                                                            Infinity
                                                                ? 0
                                                                : detailPageSize)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.mat}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.qty}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.unit}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.harga}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.total}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.remark}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {detailPageSize !== Infinity && detailTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (detailCurrentPage - 1) *
                                            detailPageSize +
                                            1,
                                        detailTotalItems,
                                    )}
                                    -
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
                                    <span className="text-sm text-muted-foreground">
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
                                            detailCurrentPage === detailTotalPages
                                        }
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end text-sm font-semibold">
                            Grand Total: Rp {formatNumber(detailGrandTotal)}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isOutstandingModalOpen}
                onOpenChange={setIsOutstandingModalOpen}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>DO Biaya Belum Dibebankan</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                        <label className="text-sm text-muted-foreground">
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
                        <label className="text-sm text-muted-foreground">
                            Cari
                            <input
                                type="search"
                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                placeholder="Cari no alokasi, permintaan..."
                                value={outstandingSearchTerm}
                                onChange={(event) =>
                                    setOutstandingSearchTerm(event.target.value)
                                }
                            />
                        </label>
                    </div>
                    <div className="flex-1 overflow-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        No DOBi
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Permintaan
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Departemen
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {outstandingLoading ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            Memuat data...
                                        </td>
                                    </tr>
                                ) : outstandingError ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            {outstandingError}
                                        </td>
                                    </tr>
                                ) : displayedOutstanding.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedOutstanding.map((item) => (
                                        <tr
                                            key={`outstanding-${item.no_alokasi}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {item.no_alokasi}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.ref_permintaan}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.kd_cs}
                                            </td>
                                            <td className="px-4 py-3">
                                                <a
                                                    href={`/marketing/delivery-order-cost/${encodeURIComponent(
                                                        item.no_alokasi,
                                                    )}/edit`}
                                                    className="text-muted-foreground transition hover:text-foreground"
                                                    aria-label="Edit"
                                                    title="Edit"
                                                >
                                                    <Pencil className="size-4" />
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {outstandingPageSize !== Infinity &&
                        outstandingTotalItems > 0 && (
                            <div className="flex items-center justify-between pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setOutstandingCurrentPage((page) =>
                                            Math.max(1, page - 1),
                                        )
                                    }
                                    disabled={outstandingCurrentPage === 1}
                                >
                                    Prev
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {outstandingCurrentPage} of{' '}
                                    {outstandingTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setOutstandingCurrentPage((page) =>
                                            Math.min(
                                                outstandingTotalPages,
                                                page + 1,
                                            ),
                                        )
                                    }
                                    disabled={
                                        outstandingCurrentPage ===
                                        outstandingTotalPages
                                    }
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
