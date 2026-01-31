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
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/delivery-order-add' },
    { title: 'Delivery Order Add', href: '/marketing/delivery-order-add' },
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

export default function DeliveryOrderAddIndex({
    deliveryOrders = [],
    outstandingCount = 0,
    outstandingTotal = 0,
    realizedCount = 0,
    realizedTotal = 0,
    period = 'today',
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [periodFilter, setPeriodFilter] = useState(period ?? 'today');
    const [realizedCountState, setRealizedCountState] = useState(realizedCount);
    const [realizedTotalState, setRealizedTotalState] = useState(realizedTotal);
    const [isRealizedLoading, setIsRealizedLoading] = useState(false);
    const [outstandingCountState, setOutstandingCountState] =
        useState(outstandingCount);
    const [outstandingTotalState, setOutstandingTotalState] =
        useState(outstandingTotal);

    const [selectedDob, setSelectedDob] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailHeader, setDetailHeader] = useState(null);
    const [detailSearchTerm, setDetailSearchTerm] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [isDeletingDob, setIsDeletingDob] = useState(false);
    const [realizedList, setRealizedList] = useState([]);
    const [realizedLoading, setRealizedLoading] = useState(false);
    const [realizedError, setRealizedError] = useState('');
    const [isRealizedModalOpen, setIsRealizedModalOpen] = useState(false);
    const [realizedSearchTerm, setRealizedSearchTerm] = useState('');
    const [realizedPageSize, setRealizedPageSize] = useState(10);
    const [realizedCurrentPage, setRealizedCurrentPage] = useState(1);

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
                String(item.no_dob ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_do ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.nm_cs ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });

        return filtered;
    }, [deliveryOrders, searchTerm, statusFilter]);

    const realizedDeliveryOrders = useMemo(() => {
        const term = realizedSearchTerm.trim().toLowerCase();
        return realizedList
            .filter((item) => {
                if (!term) return true;
                const values = [item.no_dob, item.ref_do, item.nm_cs];
                return values.some((v) =>
                    String(v ?? '').toLowerCase().includes(term),
                );
            })
            .sort((a, b) =>
                String(b.no_dob ?? '').localeCompare(String(a.no_dob ?? '')),
            );
    }, [realizedList, realizedSearchTerm]);

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

    const realizedTotalItems = realizedDeliveryOrders.length;
    const realizedTotalPages = useMemo(() => {
        if (realizedPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(realizedTotalItems / realizedPageSize));
    }, [realizedPageSize, realizedTotalItems]);

    const displayedRealizedDeliveryOrders = useMemo(() => {
        if (realizedPageSize === Infinity) {
            return realizedDeliveryOrders;
        }
        const startIndex =
            (realizedCurrentPage - 1) * realizedPageSize;
        return realizedDeliveryOrders.slice(
            startIndex,
            startIndex + realizedPageSize,
        );
    }, [
        realizedCurrentPage,
        realizedDeliveryOrders,
        realizedPageSize,
    ]);

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

    const filteredOutstanding = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        return outstandingList
            .map((item) => ({
                ...item,
                _total: Number(item.total ?? item.g_total ?? item.total_price ?? 0) || 0,
            }))
            .filter((item) => {
                if (!term) return true;
                const values = [item.no_dob, item.ref_do, item.nm_cs];
                return values.some((v) =>
                    String(v ?? '').toLowerCase().includes(term),
                );
            });
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = filteredOutstanding.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) return 1;
        return Math.max(
            1,
            Math.ceil(outstandingTotalItems / outstandingPageSize),
        );
    }, [outstandingTotalItems, outstandingPageSize]);

    const displayedOutstanding = useMemo(() => {
        if (outstandingPageSize === Infinity) return filteredOutstanding;
        const start = (outstandingCurrentPage - 1) * outstandingPageSize;
        return filteredOutstanding.slice(
            start,
            start + outstandingPageSize,
        );
    }, [
        filteredOutstanding,
        outstandingCurrentPage,
        outstandingPageSize,
    ]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    const handleOpenDetailModal = (item, realizedOnly = false) => {
        setSelectedDob(item);
        setIsDetailModalOpen(true);
        setDetailItems([]);
        setDetailHeader(null);
        setDetailError('');
        setDetailSearchTerm('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setDetailLoading(true);
        const params = new URLSearchParams({
            no_dob: item.no_dob,
        });
        if (realizedOnly) {
            params.append('realized_only', '1');
        }
        fetch(`/marketing/delivery-order-add/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
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
                setDetailError('Gagal memuat detail DOB.');
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
        fetch('/marketing/delivery-order-add/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                const list = Array.isArray(data?.deliveryOrders)
                    ? data.deliveryOrders
                    : [];
                setOutstandingList(list);
                setOutstandingCountState(list.length);
                const sumTotal = list.reduce(
                    (sum, row) =>
                        sum +
                        (Number(row.total ?? row.g_total ?? row.total_price ?? 0) ||
                            0),
                    0,
                );
                setOutstandingTotalState(sumTotal);
            })
            .catch(() => {
                setOutstandingError('Gagal memuat data DOB.');
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    const loadRealized = (customPeriod, force = false) => {
        const targetPeriod = customPeriod ?? periodFilter;
        if (realizedLoading) return;
        if (!force && realizedList.length > 0 && periodFilter === targetPeriod) {
            return;
        }
        setIsRealizedLoading(true);
        setRealizedLoading(true);
        setRealizedError('');
        const params = new URLSearchParams({ period: targetPeriod });
        fetch(`/marketing/delivery-order-add/realized?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                const list = Array.isArray(data?.deliveryOrders)
                    ? data.deliveryOrders
                    : [];
                setRealizedList(list);
                setRealizedCountState(list.length);
                setRealizedTotalState(data?.realizedTotal ?? 0);
                setPeriodFilter(targetPeriod);
            })
            .catch(() => {
                setRealizedError('Gagal memuat data DOT terealisasi.');
            })
            .finally(() => {
                setRealizedLoading(false);
                setIsRealizedLoading(false);
            });
    };

    const handleDeleteDob = (item) => {
        if (isDeletingDob) return;
        setIsOutstandingModalOpen(false);
        Swal.fire({
            title: 'Hapus DOT?',
            text: `No DOT: ${item.no_dob}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;
            setIsDeletingDob(true);
                    router.delete(
                        `/marketing/delivery-order-add/${encodeURIComponent(
                            item.no_dob,
                        )}`,
                        {
                            preserveScroll: true,
                            preserveState: true,
                            onSuccess: () => {
                                setOutstandingList((prev) =>
                                    prev.filter((row) => row.no_dob !== item.no_dob),
                                );
                                setOutstandingCountState((prev) =>
                                    Math.max(0, (prev ?? 0) - 1),
                                );
                                setOutstandingTotalState((prev) =>
                                    Math.max(
                                        0,
                                        prev -
                                            (Number(item.total ?? item.g_total ?? 0) || 0),
                                    ),
                                );
                            },
                            onError: (errors) => {
                                const message =
                                    errors?.message ||
                                    (errors &&
                                typeof errors === 'object' &&
                                Object.values(errors)[0]) ||
                            'Gagal menghapus DOT.';
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'error',
                            title: String(message),
                            showConfirmButton: false,
                            timer: 2200,
                        });
                    },
                    onFinish: () => setIsDeletingDob(false),
                },
            );
        });
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        setDetailCurrentPage(1);
    }, [detailSearchTerm, detailPageSize]);

    useEffect(() => {
        setRealizedCurrentPage(1);
    }, [realizedSearchTerm, realizedPageSize]);

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
        if (realizedCurrentPage > realizedTotalPages) {
            setRealizedCurrentPage(realizedTotalPages);
        }
    }, [realizedCurrentPage, realizedTotalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Delivery Order Add" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Delivery Order Add</h1>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan dan daftar Delivery Order Bantu
                    </p>
                </div>
                <div className="flex justify-end">
                    <Button asChild type="button">
                        <Link href="/marketing/delivery-order-add/create">
                            Tambah DOT
                        </Link>
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
                                <CardTitle>DOT Belum Dibebankan</CardTitle>
                                <CardDescription>
                                    Jumlah DO bantu outstanding
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">
                                {outstandingCountState}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                Rp {formatNumber(outstandingTotalState)}
                                </div>
                            </CardContent>
                        </Card>
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardDescription>DOT Sudah Dibebankan</CardDescription>
                                    <CardTitle className="text-2xl">
                                        {isRealizedLoading ? '...' : realizedCountState}
                                    </CardTitle>
                                    <div className="text-sm text-muted-foreground">
                                        {isRealizedLoading
                                            ? '...'
                                            : `Rp ${formatNumber(realizedTotalState)}`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs shadow-sm"
                                        value={periodFilter}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPeriodFilter(val);
                                            loadRealized(val, true);
                                        }}
                                    >
                                        <option value="today">Hari Ini</option>
                                        <option value="this_week">Minggu Ini</option>
                                        <option value="this_month">Bulan Ini</option>
                                        <option value="this_year">Tahun Ini</option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            setIsRealizedModalOpen(true);
                                            loadRealized(periodFilter, true);
                                        }}
                                        title="Lihat daftar DOT terealisasi"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Delivery Order Bantu</CardTitle>
                        <CardDescription>
                            Data DO bantu berdasarkan status
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
                                        DO belum dibebankan
                                    </option>
                                    <option value="realized">
                                        DO sudah dibebankan
                                    </option>
                                    <option value="all">Semua data</option>
                                </select>
                            </label>
                            <label className="text-sm text-muted-foreground">
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari no DOB, ref DO, customer..."
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
                                            No DOT
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Ref DO
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
                                    {displayedDeliveryOrders.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={4}
                                            >
                                                Belum ada data DOB.
                                            </td>
                                        </tr>
                                    )}
                                    {displayedDeliveryOrders.map((item) => (
                                        <tr
                                            key={item.no_dob}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {item.no_dob}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.ref_do}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.nm_cs}
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
                                                        href={`/marketing/delivery-order-add/${encodeURIComponent(
                                                            item.no_dob,
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
                        <DialogTitle>Detail Delivery Order Bantu</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-3">
                            <div>
                                <div className="text-muted-foreground">
                                    Nomor DOB
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.no_dob)}
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
                                    Nama Customer
                                </div>
                                <div className="font-semibold">
                                    {renderValue(detailHeader?.nm_cs)}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">
                                    Ref DO
                                </div>
                                <div className="font-semibold">
                                    {detailHeader?.ref_do ? (
                                        <a
                                            href={`/marketing/delivery-order/${encodeURIComponent(
                                                detailHeader.ref_do,
                                            )}/print`}
                                            className="text-primary hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {detailHeader.ref_do}
                                        </a>
                                    ) : (
                                        renderValue(detailHeader?.ref_do)
                                    )}
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
                                    placeholder="Cari nama material..."
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
                                            Nama Material
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
                                                colSpan={6}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                Memuat data...
                                            </td>
                                        </tr>
                                    ) : detailError ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                {detailError}
                                            </td>
                                        </tr>
                                    ) : displayedDetailItems.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                Tidak ada data material.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedDetailItems.map((item, index) => (
                                            <tr
                                                key={`${item.no_dob}-${index}`}
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
                    {outstandingPageSize !== Infinity &&
                        outstandingTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground mt-3">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (outstandingCurrentPage - 1) *
                                            outstandingPageSize +
                                            1,
                                        outstandingTotalItems,
                                    )}
                                    -
                                    {Math.min(
                                        outstandingCurrentPage *
                                            outstandingPageSize,
                                        outstandingTotalItems,
                                    )}{' '}
                                    dari {outstandingTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
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
                                                    page + 1,
                                                ),
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

            <Dialog
                open={isRealizedModalOpen}
                onOpenChange={setIsRealizedModalOpen}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>DOT Terealisasi</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        realizedPageSize === Infinity
                                            ? 'all'
                                            : realizedPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setRealizedPageSize(
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
                        </div>
                        <label className="text-sm text-muted-foreground">
                            Cari
                            <input
                                type="search"
                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                placeholder="Cari no DOT, ref DO, customer..."
                                value={realizedSearchTerm}
                                onChange={(event) =>
                                    setRealizedSearchTerm(event.target.value)
                                }
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">No DOT</th>
                                    <th className="px-4 py-3 text-left">Date</th>
                                    <th className="px-4 py-3 text-left">Ref DO</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Total</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRealizedDeliveryOrders.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            {realizedLoading
                                                ? 'Memuat data DOT...'
                                                : realizedError || 'Tidak ada DOT terealisasi.'}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedRealizedDeliveryOrders.map((item) => (
                                        <tr
                                            key={`realized-${item.no_dob}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {item.no_dob}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.ref_do}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.nm_cs}
                                            </td>
                                            <td className="px-4 py-3">
                                                {formatNumber(item.total ?? item.g_total ?? 0)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    className="text-muted-foreground transition hover:text-foreground"
                                                    aria-label="Lihat"
                                                    title="Lihat"
                                                    onClick={() => {
                                                        setIsRealizedModalOpen(false);
                                                        handleOpenDetailModal(
                                                            { ...item, no_dob: item.no_dob },
                                                            true,
                                                        );
                                                    }}
                                                >
                                                    <Eye className="size-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {realizedPageSize !== Infinity &&
                        realizedTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (realizedCurrentPage - 1) *
                                            realizedPageSize +
                                            1,
                                        realizedTotalItems,
                                    )}
                                    -
                                    {Math.min(
                                        realizedCurrentPage * realizedPageSize,
                                        realizedTotalItems,
                                    )}{' '}
                                    dari {realizedTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setRealizedCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={realizedCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {realizedCurrentPage} dari{' '}
                                        {realizedTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setRealizedCurrentPage((page) =>
                                                Math.min(
                                                    realizedTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            realizedCurrentPage ===
                                            realizedTotalPages
                                        }
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isOutstandingModalOpen}
                onOpenChange={setIsOutstandingModalOpen}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>DOT Belum Dibebankan</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground px-1">
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
                                        value === 'all' ? Infinity : Number(value),
                                    );
                                    setOutstandingCurrentPage(1);
                                }}
                            >
                                <option value={5}>5</option>
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
                                placeholder="Cari no DOT, ref DO, customer..."
                                value={outstandingSearchTerm}
                                onChange={(event) => {
                                    setOutstandingSearchTerm(event.target.value);
                                    setOutstandingCurrentPage(1);
                                }}
                            />
                        </label>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        No DOT
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Ref DO
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
                                {outstandingLoading ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            Memuat data...
                                        </td>
                                    </tr>
                                ) : outstandingError ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            {outstandingError}
                                        </td>
                                    </tr>
                                ) : displayedOutstanding.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-muted-foreground"
                                        >
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedOutstanding.map((item) => (
                                        <tr
                                            key={`outstanding-${item.no_dob}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {item.no_dob}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.ref_do}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.nm_cs}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/marketing/delivery-order-add/${encodeURIComponent(
                                                            item.no_dob,
                                                        )}/edit`}
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Edit"
                                                        title="Edit"
                                                        onClick={() => setIsOutstandingModalOpen(false)}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="text-destructive transition hover:text-red-600"
                                                        aria-label="Hapus"
                                                        title="Hapus"
                                                        onClick={() => handleDeleteDob(item)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
