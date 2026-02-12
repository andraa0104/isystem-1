import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';

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
    realizedTotal = 0,
    period = 'today',
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [periodFilter, setPeriodFilter] = useState(period ?? 'today');
    const [realizedCountState, setRealizedCountState] = useState(realizedCount);
    const [realizedTotalState, setRealizedTotalState] = useState(realizedTotal);
    const [isRealizedLoading, setIsRealizedLoading] = useState(false);
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedDo, setSelectedDo] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isRealizedModalOpen, setIsRealizedModalOpen] = useState(false);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [realizedSearchTerm, setRealizedSearchTerm] = useState('');
    const [realizedPageSize, setRealizedPageSize] = useState(5);
    const [realizedCurrentPage, setRealizedCurrentPage] = useState(1);
    const [selectedDetails, setSelectedDetails] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [detailSearch, setDetailSearch] = useState('');
    const [debouncedDetailSearch, setDebouncedDetailSearch] = useState('');
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');
    const [isDeletingDo, setIsDeletingDo] = useState(false);
    const [realizedList, setRealizedList] = useState([]);
    const [realizedLoading, setRealizedLoading] = useState(false);
    const [realizedError, setRealizedError] = useState('');

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

    const realizedDeliveryOrders = useMemo(() => {
        const term = realizedSearchTerm.trim().toLowerCase();
        return realizedList
            .filter((item) => {
                if (!term) return true;
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
    }, [realizedList, realizedSearchTerm]);

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

        const startIndex = (realizedCurrentPage - 1) * realizedPageSize;
        return realizedDeliveryOrders.slice(
            startIndex,
            startIndex + realizedPageSize
        );
    }, [
        realizedCurrentPage,
        realizedPageSize,
        realizedDeliveryOrders,
    ]);

    const handleOpenDetailModal = (item, realizedOnly = false) => {
        setSelectedDo({ ...item, realizedOnly });
        setIsDetailModalOpen(true);
        setSelectedDetails([]);
        setSelectedAddress('');
        setDetailError('');
        setDetailSearch('');
        setDebouncedDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setDetailLoading(true);
        const params = new URLSearchParams({ no_do: item.no_do });
        if (realizedOnly) {
            params.append('realized_only', '1');
        }
        fetch(`/marketing/delivery-order/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
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

    const loadRealized = (customPeriod, force = false) => {
        const targetPeriod = customPeriod ?? periodFilter;
        if (realizedLoading) {
            return;
        }
        if (!force && realizedList.length > 0 && periodFilter === targetPeriod) {
            return;
        }
        setIsRealizedLoading(true);
        setRealizedLoading(true);
        setRealizedError('');
        const params = new URLSearchParams({ period: targetPeriod });
        fetch(`/marketing/delivery-order/realized?${params.toString()}`, {
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
                setRealizedList(list);
                setRealizedCountState(list.length);
                setRealizedTotalState(data?.realizedTotal ?? 0);
                setPeriodFilter(targetPeriod);
            })
            .catch(() => {
                setRealizedError('Gagal memuat data DO terealisasi.');
            })
            .finally(() => {
                setRealizedLoading(false);
                setIsRealizedLoading(false);
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
    const detailTotalItems = selectedDetails.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) {
            return selectedDetails;
        }
        const startIndex = (detailCurrentPage - 1) * detailPageSize;
        return selectedDetails.slice(startIndex, startIndex + detailPageSize);
    }, [detailCurrentPage, detailPageSize, selectedDetails]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        setRealizedCurrentPage(1);
    }, [realizedPageSize, realizedSearchTerm]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedDetailSearch(detailSearch);
        }, 500);
        return () => clearTimeout(handler);
    }, [detailSearch]);

    useEffect(() => {
        if (!selectedDo || !isDetailModalOpen) return;
        setDetailLoading(true);
        const params = new URLSearchParams({
            no_do: selectedDo.no_do,
        });
        if (debouncedDetailSearch) {
            params.append('search', debouncedDetailSearch);
        }
        if (selectedDo?.realizedOnly) {
            params.append('realized_only', '1');
        }
        fetch(`/marketing/delivery-order/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
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
                setDetailCurrentPage(1);
            })
            .catch(() => {
                setDetailError('Gagal memuat detail DO.');
            })
            .finally(() => {
                setDetailLoading(false);
            });
    }, [debouncedDetailSearch, isDetailModalOpen, selectedDo]);

    useEffect(() => {
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

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

    const handleDeleteDo = (item) => {
        if (isDeletingDo) return;
        // Tutup modal agar tidak ada focus trap Radix yang menahan klik SweetAlert
        setIsOutstandingModalOpen(false);
        Swal.fire({
            title: 'Hapus DO?',
            text: `No DO: ${item.no_do}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;
            setIsDeletingDo(true);
            router.delete(
                `/marketing/delivery-order/${encodeURIComponent(item.no_do)}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                onSuccess: () => {
                        setOutstandingList((prev) =>
                            prev.filter((row) => row.no_do !== item.no_do)
                        );
                        setPurchaseRequirementsList((prev) =>
                            prev.filter((row) => row.no_do !== item.no_do)
                        );
                        setOutstandingCount((prev) => Math.max(0, (prev ?? 0) - 1));
                        setOutstandingTotal((prev) =>
                            Math.max(
                                0,
                                prev -
                                    (parseFloat(item.total ?? 0) ||
                                        parseFloat(item.Total ?? 0) ||
                                        0)
                            )
                        );
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: 'Berhasil dihapus',
                            showConfirmButton: false,
                            timer: 1800,
                        });
                    },
                    onError: (errors) => {
                        const message =
                            errors?.message ||
                            (errors &&
                                typeof errors === 'object' &&
                                Object.values(errors)[0]) ||
                            'Gagal menghapus DO.';
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'error',
                            title: String(message),
                            showConfirmButton: false,
                            timer: 2200,
                        });
                    },
                    onFinish: () => setIsDeletingDo(false),
                }
            );
        });
    };

    useEffect(() => {
        if (realizedCurrentPage > realizedTotalPages) {
            setRealizedCurrentPage(realizedTotalPages);
        }
    }, [realizedCurrentPage, realizedTotalPages]);

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
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardDescription>DO Terealisasi</CardDescription>
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
                                    title="Lihat daftar DO terealisasi"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
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
                                <option value={5}>5</option>
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
                            <DialogDescription>
                                Ringkasan data dan item Delivery Order terpilih.
                            </DialogDescription>
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
                                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <span>Tampilkan</span>
                                            <select
                                                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
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
                                                            : Number(value)
                                                    );
                                                    setDetailCurrentPage(1);
                                                }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value="all">Semua</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span>Cari</span>
                                            <input
                                                type="text"
                                                placeholder="Cari material..."
                                                className="h-8 rounded-md border border-input bg-background px-3 text-xs shadow-sm w-44"
                                                value={detailSearch}
                                                onChange={(event) =>
                                                    setDetailSearch(event.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
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
                                            <PlainTableStateRows
                                                loading={detailLoading}
                                                columns={6}
                                                rows={5}
                                                isEmpty={
                                                    !detailLoading &&
                                                    displayedDetailItems.length === 0
                                                }
                                                emptyMessage={
                                                    detailError ||
                                                    'Tidak ada detail DO.'
                                                }
                                            />
                                            {!detailLoading && displayedDetailItems.map(
                                                    (detail, index) => (
                                                <tr
                                                    key={`${detail.no_do}-${index}`}
                                                    className="border-t border-sidebar-border/70"
                                                >
                                                    <td className="px-4 py-3">
                                                        {detailPageSize === Infinity
                                                            ? index + 1
                                                            : (detailCurrentPage - 1) *
                                                                  detailPageSize +
                                                              index +
                                                              1}
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
                                                    )
                                                )}
                                        </tbody>
                                    </table>
                                </div>

                                {!detailLoading &&
                                    detailPageSize !== Infinity &&
                                    detailTotalItems > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <span>
                                                Menampilkan{' '}
                                                {Math.min(
                                                    (detailCurrentPage - 1) *
                                                        detailPageSize +
                                                        1,
                                                    detailTotalItems
                                                )}
                                                -
                                                {Math.min(
                                                    detailCurrentPage * detailPageSize,
                                                    detailTotalItems
                                                )}{' '}
                                                dari {detailTotalItems} data
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDetailCurrentPage((page) =>
                                                            Math.max(1, page - 1)
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
                                                                page + 1
                                                            )
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
                            setOutstandingPageSize(5);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>DO Outstanding</DialogTitle>
                            <DialogDescription>
                                Pilih Delivery Order yang masih outstanding.
                            </DialogDescription>
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
                                    <PlainTableStateRows
                                        loading={outstandingLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !outstandingLoading &&
                                            displayedOutstandingDeliveryOrders.length === 0
                                        }
                                        emptyMessage={
                                            outstandingError ||
                                            'Tidak ada DO outstanding.'
                                        }
                                    />
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
                                                    <div className="flex items-center gap-2">
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
                                                        <button
                                                            type="button"
                                                            className="text-destructive transition hover:text-red-600"
                                                            aria-label="Hapus"
                                                            title="Hapus"
                                                            onClick={() => handleDeleteDo(item)}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
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

                <Dialog
                    open={isRealizedModalOpen}
                    onOpenChange={(open) => {
                        setIsRealizedModalOpen(open);
                        if (open) {
                            loadRealized(periodFilter, true);
                        } else {
                            setRealizedSearchTerm('');
                            setRealizedPageSize(5);
                            setRealizedCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>DO Terealisasi</DialogTitle>
                            <DialogDescription>
                                Daftar Delivery Order yang sudah terealisasi.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        realizedPageSize === Infinity ? 'all' : realizedPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setRealizedPageSize(
                                            value === 'all' ? Infinity : Number(value)
                                        );
                                        setRealizedCurrentPage(1);
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
                                    placeholder="Cari nomor DO, ref PO, customer..."
                                    value={realizedSearchTerm}
                                    onChange={(event) =>
                                        setRealizedSearchTerm(event.target.value)
                                    }
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
                                        <th className="px-4 py-3 text-left">Total</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={realizedLoading}
                                        columns={6}
                                        rows={5}
                                        isEmpty={
                                            !realizedLoading &&
                                            displayedRealizedDeliveryOrders.length === 0
                                        }
                                        emptyMessage={
                                            realizedError ||
                                            'Tidak ada DO terealisasi.'
                                        }
                                    />
                                    {displayedRealizedDeliveryOrders.map((item) => (
                                        <tr
                                            key={`realized-${item.no_do}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">{item.no_do}</td>
                                            <td className="px-4 py-3">{item.date}</td>
                                            <td className="px-4 py-3">{item.ref_po}</td>
                                            <td className="px-4 py-3">{item.nm_cs}</td>
                                            <td className="px-4 py-3">
                                                {formatNumber(item.g_total ?? item.total ?? 0)}
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
                                                            { ...item, realizedOnly: true },
                                                            true
                                                        );
                                                    }}
                                                >
                                                    <Eye className="size-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {realizedPageSize !== Infinity && realizedTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (realizedCurrentPage - 1) * realizedPageSize + 1,
                                        realizedTotalItems
                                    )}
                                    -
                                    {Math.min(
                                        realizedCurrentPage * realizedPageSize,
                                        realizedTotalItems
                                    )}{' '}
                                    dari {realizedTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setRealizedCurrentPage((page) =>
                                                Math.max(1, page - 1)
                                            )
                                        }
                                        disabled={realizedCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {realizedCurrentPage} dari {realizedTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setRealizedCurrentPage((page) =>
                                                Math.min(realizedTotalPages, page + 1)
                                            )
                                        }
                                        disabled={realizedCurrentPage === realizedTotalPages}
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
