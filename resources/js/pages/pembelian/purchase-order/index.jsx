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
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { ActionIconButton } from '@/components/action-icon-button';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { readApiError, normalizeApiError } from '@/lib/api-error';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { formatDateId } from '@/lib/formatters';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembelian', href: '/pembelian/purchase-order' },
    { title: 'Purchase Order', href: '/pembelian/purchase-order' },
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

const getPoStatus = (item) => {
    if (isOutstanding(item)) {
        return { label: 'Outstanding', variant: 'secondary' };
    }
    return { label: 'Terealisasi', variant: 'default' };
};

export default function PurchaseOrderIndex({
    purchaseOrders = [],
    outstandingCount = 0,
    outstandingTotal = 0,
    realizedCount = 0,
    realizedTotal = 0,
    period = 'today',
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [poData, setPoData] = useState(purchaseOrders);
    const [poLoading, setPoLoading] = useState(false);
    const [poError, setPoError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [periodFilter, setPeriodFilter] = useState(period ?? 'today');
    const [realizedCountState, setRealizedCountState] = useState(realizedCount);
    const [realizedTotalState, setRealizedTotalState] = useState(realizedTotal);
    const [isRealizedLoading, setIsRealizedLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [realizedList, setRealizedList] = useState([]);
    const [realizedSearchTerm, setRealizedSearchTerm] = useState('');
    const [realizedPageSize, setRealizedPageSize] = useState(5);
    const [realizedCurrentPage, setRealizedCurrentPage] = useState(1);
    const [realizedLoading, setRealizedLoading] = useState(false);
    const [realizedError, setRealizedError] = useState(null);
    const [outstandingCountState, setOutstandingCountState] =
        useState(outstandingCount);
    const [outstandingTotalState, setOutstandingTotalState] =
        useState(outstandingTotal);
    const [realizedListPeriod, setRealizedListPeriod] = useState(periodFilter);
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPo, setSelectedPo] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isRealizedModalOpen, setIsRealizedModalOpen] = useState(false);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [selectedDetails, setSelectedDetails] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState(null);
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [detailSearch, setDetailSearch] = useState('');
    const [debouncedDetailSearch, setDebouncedDetailSearch] = useState('');

    const filteredPurchaseOrders = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = poData.filter((item) => {
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
    }, [poData, searchTerm, statusFilter]);

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
        return outstandingList
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
    }, [outstandingList, outstandingSearchTerm]);

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

    const selectedDetail = selectedDetails[0] ?? null;

    const realizedPurchaseOrders = useMemo(() => {
        const term = realizedSearchTerm.trim().toLowerCase();
        return realizedList
            .filter((item) => {
                if (!term) return true;
                const values = [
                    item.no_po,
                    item.tgl,
                    item.ref_pr,
                    item.for_cus,
                    item.nm_vdr,
                ];
                return values.some((value) =>
                    String(value ?? '').toLowerCase().includes(term)
                );
            })
            .sort((a, b) =>
                String(b.no_po ?? '').localeCompare(String(a.no_po ?? ''))
            );
    }, [realizedList, realizedSearchTerm]);

    const realizedTotalItems = realizedPurchaseOrders.length;
    const realizedTotalPages = useMemo(() => {
        if (realizedPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(realizedTotalItems / realizedPageSize));
    }, [realizedPageSize, realizedTotalItems]);

    const displayedRealizedPurchaseOrders = useMemo(() => {
        if (realizedPageSize === Infinity) return realizedPurchaseOrders;
        const startIndex = (realizedCurrentPage - 1) * realizedPageSize;
        return realizedPurchaseOrders.slice(
            startIndex,
            startIndex + realizedPageSize
        );
    }, [realizedPurchaseOrders, realizedCurrentPage, realizedPageSize]);
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

    const handlePageSizeChange = (event) => {
        const value = event.target.value;
        setPageSize(value === 'all' ? Infinity : Number(value));
    };

    const [isRealizedDetail, setIsRealizedDetail] = useState(false);

    const handleOpenModal = (item, realizedOnly = false) => {
        setSelectedPo(item);
        setIsRealizedDetail(realizedOnly);
        setIsModalOpen(true);
        setSelectedDetails([]);
        setDetailError(null);
        setDetailSearch('');
        setDebouncedDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);
        setDetailLoading(true);
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedDetailSearch(detailSearch);
        }, 500);
        return () => clearTimeout(handler);
    }, [detailSearch]);

    const fetchPurchaseOrders = () => {
        setPoLoading(true);
        setPoError(null);
        fetch('/pembelian/purchase-order/data', {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw await readApiError(response);
                }
                return response.json();
            })
            .then((data) => {
                setPoData(
                    Array.isArray(data?.purchaseOrders)
                        ? data.purchaseOrders
                        : []
                );
            })
            .catch((error) => {
                setPoError(
                    normalizeApiError(error, 'Gagal memuat data purchase order.')
                );
            })
            .finally(() => {
                setPoLoading(false);
            });
    };

    useEffect(() => {
        fetchPurchaseOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchPoDetails = () => {
        if (!selectedPo || !isModalOpen) {
            return;
        }
        setDetailError(null);
        setDetailLoading(true);
        const params = new URLSearchParams({
            no_po: selectedPo.no_po,
        });
        if (debouncedDetailSearch) {
            params.append('search', debouncedDetailSearch);
        }
        if (isRealizedDetail) {
            params.append('realized_only', '1');
        }
        fetch(`/pembelian/purchase-order/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw await readApiError(response);
                }
                return response.json();
            })
            .then((data) => {
                setSelectedDetails(
                    Array.isArray(data?.purchaseOrderDetails)
                        ? data.purchaseOrderDetails
                        : []
                );
                setDetailCurrentPage(1);
            })
            .catch((error) => {
                setDetailError(
                    normalizeApiError(error, 'Gagal memuat detail PO.')
                );
            })
            .finally(() => {
                setDetailLoading(false);
            });
    };

    useEffect(() => {
        fetchPoDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedDetailSearch, isModalOpen, selectedPo, isRealizedDetail]);

    const loadOutstanding = () => {
        if (outstandingLoading || outstandingList.length > 0) {
            return;
        }
        setOutstandingLoading(true);
        setOutstandingError(null);
        fetch('/pembelian/purchase-order/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw await readApiError(response);
                }
                return response.json();
            })
            .then((data) => {
                setOutstandingList(
                    Array.isArray(data?.purchaseOrders)
                        ? data.purchaseOrders
                        : []
                );
                const list = Array.isArray(data?.purchaseOrders)
                    ? data.purchaseOrders
                    : [];
                setOutstandingCountState(list.length);
                setOutstandingTotalState(sumOutstandingTotal(list));
            })
            .catch((error) => {
                setOutstandingError(
                    normalizeApiError(
                        error,
                        'Gagal memuat data PO outstanding.'
                    )
                );
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    const handleDeletePo = (noPo) => {
        if (!noPo || isDeleting) return;
        // tutup modal outstanding supaya overlay tidak menghalangi swal
        setIsOutstandingModalOpen(false);
        Swal.fire({
            title: 'Hapus PO?',
            text: `No PO: ${noPo}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) return;
            setIsDeleting(true);
            fetch(`/pembelian/purchase-order/${encodeURIComponent(noPo)}`, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name=\"csrf-token\"]')
                            ?.getAttribute('content') ?? '',
                },
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw await readApiError(response);
                    }
                    return response.json().catch(() => ({}));
                })
                .then((data) => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: data?.message || 'PO dihapus.',
                        timer: 1700,
                        showConfirmButton: false,
                    });
                    setOutstandingList((prev) => {
                        const next = prev.filter((item) => item.no_po !== noPo);
                        setOutstandingCountState(next.length);
                        setOutstandingTotalState(sumOutstandingTotal(next));
                        return next;
                    });
                    setPoData((prev) => prev.filter((item) => item.no_po !== noPo));
                })
                .catch((error) => {
                    const normalized = normalizeApiError(error, 'Gagal menghapus PO.');
                    const detail = normalized?.detail ? String(normalized.detail) : '';
                    const html = `
                        <div style="text-align:left; white-space:pre-wrap; word-break:break-word;">
                            <div>${String(normalized.summary || 'Gagal menghapus PO.')}</div>
                            ${
                                detail
                                    ? `<details style="margin-top:8px;"><summary style="cursor:pointer;">Detail error</summary><pre style="margin-top:8px; max-height:260px; overflow:auto;">${detail.replace(
                                          /</g,
                                          '&lt;',
                                      )}</pre></details>`
                                    : ''
                            }
                        </div>
                    `;
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        html,
                        width: 800,
                    });
                })
                .finally(() => setIsDeleting(false));
        });
    };

    const loadRealized = (customPeriod, force = false) => {
        const targetPeriod = customPeriod ?? periodFilter;
        if (realizedLoading) {
            return;
        }
        if (!force && realizedList.length > 0 && realizedListPeriod === targetPeriod) {
            return;
        }
        setRealizedLoading(true);
        setRealizedError(null);
        const params = new URLSearchParams({ period: targetPeriod });
        fetch(`/pembelian/purchase-order/realized?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw await readApiError(response);
                }
                return response.json();
            })
            .then((data) => {
                setRealizedList(
                    Array.isArray(data?.purchaseOrders)
                        ? data.purchaseOrders
                        : []
                );
                setRealizedListPeriod(targetPeriod);
            })
            .catch((error) => {
                setRealizedError(
                    normalizeApiError(
                        error,
                        'Gagal memuat data PO terealisasi.'
                    )
                );
            })
            .finally(() => {
                setRealizedLoading(false);
            });
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
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    const handlePeriodChange = (event) => {
        const value = event.target.value;
        setPeriodFilter(value);
        setRealizedList([]);
        setRealizedCurrentPage(1);
        setRealizedListPeriod(value);
        setIsRealizedLoading(true);
        const params = new URLSearchParams({ period: value });
        fetch(`/pembelian/purchase-order?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw await readApiError(response);
                }
                return response.json();
            })
            .then((data) => {
                setRealizedCountState(data?.realizedCount ?? 0);
                setRealizedTotalState(data?.realizedTotal ?? 0);
                if (isRealizedModalOpen) {
                    loadRealized(value, true);
                }
            })
            .catch((error) => {
                setRealizedCountState(0);
                setRealizedTotalState(0);
                setRealizedError(
                    normalizeApiError(error, 'Gagal memuat ringkasan PO.')
                );
            })
            .finally(() => setIsRealizedLoading(false));
    };

    useEffect(() => {
        setRealizedCountState(realizedCount);
        setRealizedTotalState(realizedTotal);
        setOutstandingCountState(outstandingCount);
        setOutstandingTotalState(outstandingTotal);
    }, [realizedCount, realizedTotal, outstandingCount, outstandingTotal]);

    const sumOutstandingTotal = (list) =>
        list.reduce((sum, item) => {
            const raw = getRawValue(item, ['g_total', 'G_total', 'total', 'Total']);
            const num = Number(String(raw ?? '').replace(/,/g, '').trim());
            return Number.isFinite(num) ? sum + num : sum;
        }, 0);

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
                        onClick={() => router.visit('/pembelian/purchase-order/create')}
                    >
                        Tambah PO
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
                                        <CardDescription>PO Outstanding</CardDescription>
                                        <CardTitle className="text-2xl">
                                            {outstandingCountState}
                                        </CardTitle>
                                        <div className="text-sm text-muted-foreground">
                                            {formatRupiah(outstandingTotalState)}
                                        </div>
                                    </CardHeader>
                                </Card>
                            </button>
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardDescription>PO Terealisasi</CardDescription>
                                    <CardTitle className="text-2xl">
                                        {isRealizedLoading ? '...' : realizedCountState}
                                    </CardTitle>
                                    <div className="text-sm text-muted-foreground">
                                        {isRealizedLoading
                                            ? '...'
                                            : formatRupiah(realizedTotalState)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs shadow-sm"
                                        value={periodFilter}
                                        onChange={handlePeriodChange}
                                    >
                                        <option value="today">Hari Ini</option>
                                        <option value="this_week">Minggu Ini</option>
                                        <option value="this_month">Bulan Ini</option>
                                        <option value="this_year">Tahun Ini</option>
                                    </select>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            setIsRealizedModalOpen(true);
                                            loadRealized();
                                        }}
                                        title="Lihat daftar PO terealisasi"
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
                                onChange={handlePageSizeChange}
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
	                            <tr className="sticky top-0 z-10 bg-muted/50">
	                                <th className="px-4 py-3 text-left">No PO</th>
	                                <th className="px-4 py-3 text-left">Date</th>
	                                <th className="px-4 py-3 text-left">Status</th>
	                                <th className="px-4 py-3 text-left">Customer</th>
	                                <th className="px-4 py-3 text-left">Nama Vendor</th>
	                                <th className="px-4 py-3 text-right">Total Price</th>
	                                <th className="px-4 py-3 text-left">Action</th>
	                            </tr>
	                        </thead>
	                        <tbody>
	                            <PlainTableStateRows
	                                columns={7}
	                                loading={poLoading && poData.length === 0}
	                                error={poError}
	                                onRetry={fetchPurchaseOrders}
	                                isEmpty={
	                                    !poLoading &&
	                                    !poError &&
	                                    displayedPurchaseOrders.length === 0
	                                }
	                                emptyTitle="Belum ada data PO."
	                                emptyDescription="Silakan tambah PO baru atau ubah filter/pencarian."
	                                emptyActionLabel="Tambah PO"
	                                emptyActionHref="/pembelian/purchase-order/create"
	                            />
	                            {displayedPurchaseOrders.map((item) => (
	                                <tr
	                                    key={item.no_po}
	                                    className="border-t border-sidebar-border/70"
	                                >
	                                    <td className="px-4 py-3">{item.no_po}</td>
	                                    <td className="px-4 py-3">
	                                        {formatDateId(
	                                            getRawValue(item, ['tgl', 'Tgl', 'TGL', 'date', 'Date']),
	                                        )}
	                                    </td>
	                                    <td className="px-4 py-3">
	                                        {(() => {
	                                            const status = getPoStatus(item);
	                                            return (
	                                                <Badge variant={status.variant}>
	                                                    {status.label}
	                                                </Badge>
	                                            );
	                                        })()}
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
	                                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
	                                            <ActionIconButton
	                                                label="Detail"
	                                                onClick={() => handleOpenModal(item)}
	                                            >
	                                                <Eye className="size-4" />
	                                            </ActionIconButton>
	                                            <ActionIconButton
	                                                label="Cetak"
	                                                asChild
	                                            >
	                                                <a
	                                                    href={`/pembelian/purchase-order/${encodeURIComponent(
	                                                        item.no_po,
	                                                    )}/print`}
	                                                    target="_blank"
	                                                    rel="noreferrer"
	                                                >
	                                                    <Printer className="size-4" />
	                                                </a>
	                                            </ActionIconButton>
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
                            setSelectedDetails([]);
                            setDetailError('');
                            setDetailLoading(false);
                            setIsRealizedDetail(false);
                        }
                    }}
                >
                    <DialogContent
                        className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto"
                        aria-describedby="po-detail-desc"
                    >
                        <DialogHeader>
                            <DialogTitle>Detail Purchase Order</DialogTitle>
                            <DialogDescription id="po-detail-desc">
                                Menampilkan informasi header dan detail material PO.
                            </DialogDescription>
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
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-base font-semibold">
                                            Data Material
                                        </h3>
                                        <div className="flex items-center gap-2">
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
                                            <input
                                                type="text"
                                                placeholder="Cari material..."
                                                className="h-8 rounded-md border border-input bg-background px-3 text-xs shadow-sm w-40"
                                                value={detailSearch}
                                                onChange={(event) =>
                                                    setDetailSearch(event.target.value)
                                                }
                                            />
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
		                                                <PlainTableStateRows
		                                                    columns={6}
		                                                    loading={detailLoading}
		                                                    error={detailError}
		                                                    onRetry={fetchPoDetails}
		                                                    isEmpty={
		                                                        !detailLoading &&
		                                                        !detailError &&
		                                                        displayedDetailItems.length === 0
	                                                    }
	                                                    emptyTitle="Tidak ada detail PO."
	                                                />
	                                                {!detailLoading &&
	                                                    !detailError &&
	                                                    displayedDetailItems.map((detail) => (
	                                                        <tr
	                                                            key={detail.no}
	                                                            className="border-t border-sidebar-border/70"
	                                                        >
                                                            <td className="px-4 py-3">
                                                                {renderValue(detail.no)}
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

                                    {!detailLoading &&
                                        detailPageSize !== Infinity &&
                                        detailTotalItems > 0 && (
                                            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
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
                                                        detailCurrentPage *
                                                            detailPageSize,
                                                        detailTotalItems
                                                    )}{' '}
                                                    dari {detailTotalItems}
                                                </span>
                                                <div className="flex gap-2">
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
                    <DialogContent
                        className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto"
                        aria-describedby="po-outstanding-desc"
                    >
                        <DialogHeader>
                            <DialogTitle>PO Outstanding</DialogTitle>
                            <DialogDescription id="po-outstanding-desc">
                                Daftar PO yang belum terealisasi.
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
	                                    <tr className="sticky top-0 z-10 bg-muted/50">
	                                        <th className="px-4 py-3 text-left">No PO</th>
	                                        <th className="px-4 py-3 text-left">Date</th>
	                                        <th className="px-4 py-3 text-left">Status</th>
	                                        <th className="px-4 py-3 text-left">
	                                            Customer
	                                        </th>
	                                        <th className="px-4 py-3 text-left">
	                                            Nama Vendor
	                                        </th>
	                                        <th className="px-4 py-3 text-right">
	                                            Total Price
	                                        </th>
	                                        <th className="px-4 py-3 text-left">Action</th>
	                                    </tr>
	                                </thead>
	                                <tbody>
	                                    <PlainTableStateRows
	                                        columns={7}
	                                        loading={
	                                            outstandingLoading &&
	                                            displayedOutstandingPurchaseOrders.length === 0
	                                        }
	                                        error={
	                                            displayedOutstandingPurchaseOrders.length === 0
	                                                ? outstandingError
	                                                : null
	                                        }
	                                        onRetry={loadOutstanding}
	                                        isEmpty={
	                                            !outstandingLoading &&
	                                            !outstandingError &&
	                                            displayedOutstandingPurchaseOrders.length === 0
	                                        }
	                                        emptyTitle="Tidak ada PO outstanding."
	                                    />
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
	                                                    {formatDateId(
	                                                        getRawValue(item, [
	                                                            'tgl',
	                                                            'Tgl',
	                                                            'date',
	                                                            'Date',
	                                                        ]),
	                                                    )}
	                                                </td>
	                                                <td className="px-4 py-3">
	                                                    <Badge variant="secondary">
	                                                        Outstanding
	                                                    </Badge>
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
	                                                <td className="px-4 py-3 text-right whitespace-nowrap">
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
	                                                    <div className="flex items-center gap-2">
	                                                        <ActionIconButton label="Edit" asChild>
	                                                            <Link
	                                                                href={`/pembelian/purchase-order/${encodeURIComponent(
	                                                                    item.no_po,
	                                                                )}/edit`}
	                                                            >
	                                                                <Pencil className="size-4" />
	                                                            </Link>
	                                                        </ActionIconButton>
	                                                        {Number(item.can_delete ?? item.canDelete ?? 0) === 1 && (
	                                                            <ActionIconButton
	                                                                label="Hapus"
	                                                                onClick={() => handleDeletePo(item.no_po)}
	                                                                disabled={isDeleting}
	                                                            >
	                                                                <Trash2 className="size-4 text-destructive" />
	                                                            </ActionIconButton>
	                                                        )}
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
                            loadRealized();
                        } else {
                            setRealizedSearchTerm('');
                            setRealizedPageSize(5);
                            setRealizedCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent
                        className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto"
                        aria-describedby="po-realized-desc"
                    >
                        <DialogHeader>
                            <DialogTitle>PO Terealisasi</DialogTitle>
                            <DialogDescription id="po-realized-desc">
                                Daftar PO terealisasi sesuai periode yang dipilih.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
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
                                                : Number(value)
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
                                    placeholder="Cari no PO, no PR, customer, vendor..."
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
	                                    <tr className="sticky top-0 z-10 bg-muted/50">
	                                        <th className="px-4 py-3 text-left">No PO</th>
	                                        <th className="px-4 py-3 text-left">Date</th>
	                                        <th className="px-4 py-3 text-left">Status</th>
	                                        <th className="px-4 py-3 text-left">Customer</th>
	                                        <th className="px-4 py-3 text-left">Nama Vendor</th>
	                                        <th className="px-4 py-3 text-right">Total Price</th>
	                                        <th className="px-4 py-3 text-left">Action</th>
	                                    </tr>
	                                </thead>
	                                <tbody>
	                                    <PlainTableStateRows
	                                        columns={7}
	                                        loading={
	                                            realizedLoading &&
	                                            displayedRealizedPurchaseOrders.length === 0
	                                        }
	                                        error={
	                                            displayedRealizedPurchaseOrders.length === 0
	                                                ? realizedError
	                                                : null
	                                        }
	                                        onRetry={() => loadRealized(periodFilter, true)}
	                                        isEmpty={
	                                            !realizedLoading &&
	                                            !realizedError &&
	                                            displayedRealizedPurchaseOrders.length === 0
	                                        }
	                                        emptyTitle="Tidak ada PO terealisasi."
	                                    />
	                                    {displayedRealizedPurchaseOrders.map((item) => (
	                                        <tr
	                                            key={`realized-${item.no_po}`}
	                                            className="border-t border-sidebar-border/70"
	                                        >
	                                            <td className="px-4 py-3">
	                                                {item.no_po}
	                                            </td>
	                                            <td className="px-4 py-3">
	                                                {formatDateId(
	                                                    getRawValue(item, [
	                                                        'tgl',
	                                                        'Tgl',
	                                                        'date',
	                                                        'Date',
	                                                    ]),
	                                                )}
	                                            </td>
	                                            <td className="px-4 py-3">
	                                                <Badge variant="default">
	                                                    Terealisasi
	                                                </Badge>
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
	                                            <td className="px-4 py-3 text-right whitespace-nowrap">
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
	                                                <ActionIconButton
	                                                    label="Detail"
	                                                    onClick={() => {
	                                                        setIsRealizedModalOpen(false);
	                                                        handleOpenModal(item, true);
	                                                    }}
	                                                >
	                                                    <Eye className="size-4" />
	                                                </ActionIconButton>
	                                            </td>
                                        </tr>
                                    ))}
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
                                                    Math.min(
                                                        realizedTotalPages,
                                                        page + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                realizedCurrentPage ===
                                                realizedTotalPages
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
