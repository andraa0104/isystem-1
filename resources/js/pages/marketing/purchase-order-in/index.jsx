import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppearance } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    ClipboardCheck,
    Eye,
    Pencil,
    Printer,
    Search,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
];

const formatRupiah = (value) =>
    `${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const toastSuccess = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: message,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
    });
};

const toastError = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: message,
        showConfirmButton: false,
        timer: 3600,
        timerProgressBar: true,
    });
};

const formatDateDisplay = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return '-';
    }
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return `${iso[3]}-${iso[2]}-${iso[1]}`;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return text;
    }
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const toDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }

    const dotDate = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dotDate) {
        return new Date(
            Number(dotDate[3]),
            Number(dotDate[2]) - 1,
            Number(dotDate[1]),
        );
    }

    const slashDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashDate) {
        return new Date(
            Number(slashDate[3]),
            Number(slashDate[2]) - 1,
            Number(slashDate[1]),
        );
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isInPeriod = (value, period, startCustom, endCustom) => {
    const date = toDate(value);
    if (!date) {
        return false;
    }

    if (period === 'all') {
        return true;
    }

    const now = new Date();
    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    );
    const startOfDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );

    if (period === 'today') {
        return startOfDate.getTime() === startOfToday.getTime();
    }

    if (period === 'this_week') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const weekStart = new Date(startOfToday);
        weekStart.setDate(startOfToday.getDate() - diffToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return startOfDate >= weekStart && startOfDate <= weekEnd;
    }

    if (period === 'this_month') {
        return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
        );
    }

    if (period === 'this_year') {
        return date.getFullYear() === now.getFullYear();
    }

    if (period === 'range') {
        const s = toDate(startCustom);
        const e = toDate(endCustom);
        if (!s || !e) {
            return true;
        }
        const start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        return startOfDate >= start && startOfDate <= end;
    }

    return true;
};

const SummaryMetric = ({ label, value, loading, onClick }) => (
    <button
        type="button"
        className="rounded-lg border border-sidebar-border/70 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/40"
        onClick={(event) => {
            event.stopPropagation();
            onClick?.();
        }}
    >
        <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            {label}
        </p>
        <div className="mt-1 text-xl font-bold">
            {loading ? <Skeleton className="h-6 w-10" /> : value}
        </div>
    </button>
);

export default function PurchaseOrderInIndex({
    purchaseOrderIns: initialPurchaseOrderIns = [],
    outstandingPurchaseOrderIns: initialOutstandingPoIns = [],
    belumPrPurchaseOrderIns: initialBelumPrPoIns = [],
    realizedPurchaseOrderIns: initialRealizedPoIns = [],
    allPurchaseOrderIns: initialAllPoIns = [],
    summary: initialSummary = {},
    filters = {},
    pagination: initialPagination = {},
}) {
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';

    const [search, setSearch] = useState(filters.search ?? '');
    const [perPage, setPerPage] = useState(String(filters.per_page ?? '5'));
    const [statusFilter, setStatusFilter] = useState(filters.status ?? 'all');
    const [tableDateFilter, setTableDateFilter] = useState('today');
    const [tableStartDate, setTableStartDate] = useState('');
    const [tableEndDate, setTableEndDate] = useState('');
    const [realizedPeriod, setRealizedPeriod] = useState('today');
    const [dataPoInPeriod, setDataPoInPeriod] = useState('today');
    const [dataPoInStart, setDataPoInStart] = useState('');
    const [dataPoInEnd, setDataPoInEnd] = useState('');
    const [activeModal, setActiveModal] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('do');

    const [purchaseOrderIns, setPurchaseOrderIns] = useState(
        initialPurchaseOrderIns,
    );
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [summary, setSummary] = useState(initialSummary);
    const [summaryLoading, setSummaryLoading] = useState({
        outstanding: true,
        sisa: true,
        realized: true,
        total: true,
    });
    const [outstandingPurchaseOrderIns, setOutstandingPurchaseOrderIns] =
        useState(initialOutstandingPoIns);
    const [outstandingDoPurchaseOrderIns, setOutstandingDoPurchaseOrderIns] =
        useState([]);
    const [belumPrPurchaseOrderIns, setBelumPrPurchaseOrderIns] =
        useState(initialBelumPrPoIns);
    const [sisaDoPurchaseOrderIns, setSisaDoPurchaseOrderIns] = useState([]);
    const [realizedPurchaseOrderIns, setRealizedPurchaseOrderIns] =
        useState(initialRealizedPoIns);
    const [realizedDoPurchaseOrderIns, setRealizedDoPurchaseOrderIns] =
        useState([]);
    const [allPurchaseOrderIns, setAllPurchaseOrderIns] =
        useState(initialAllPoIns);
    const [pagination, setPagination] = useState(initialPagination);

    const [modalSearch, setModalSearch] = useState('');
    const [modalPageSize, setModalPageSize] = useState(5);
    const [modalPage, setModalPage] = useState(1);
    const [modalLoading, setModalLoading] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTableLoading, setDetailTableLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailHeader, setDetailHeader] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailKodePoin, setDetailKodePoin] = useState('');
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailPage, setDetailPage] = useState(1);
    const [detailPagination, setDetailPagination] = useState({
        total: 0,
        page: 1,
        per_page: 5,
        total_pages: 1,
    });
    const [confirmDeleteKode, setConfirmDeleteKode] = useState('');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const isFirstRender = useRef(true);

    const fetchPoInData = async (params = {}) => {
        const isPartial = params.isPartial ?? false;

        if (isPartial) {
            setTableLoading(true);
        } else {
            setLoading(true);
            setTableLoading(true);
        }

        try {
            const queryParams = new URLSearchParams({
                search: params.search ?? search,
                per_page: params.per_page ?? perPage,
                status: params.status ?? statusFilter,
                date_filter: params.dateFilter ?? tableDateFilter,
                page:
                    params.page ??
                    (params.isPartial
                        ? pagination.page
                        : (pagination.page ?? 1)),
            });

            if (isPartial) {
                queryParams.append('is_partial', '1');
            }
            if ((params.dateFilter ?? tableDateFilter) === 'range') {
                queryParams.set(
                    'start_date',
                    params.startDate ?? tableStartDate,
                );
                queryParams.set('end_date', params.endDate ?? tableEndDate);
            }

            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await response.json();

            setPurchaseOrderIns(data.purchaseOrderIns || []);

            if (!isPartial) {
                setSummary(data.summary || {});
                setOutstandingPurchaseOrderIns(
                    data.outstandingPurchaseOrderIns || [],
                );
                setOutstandingDoPurchaseOrderIns(
                    data.outstandingDoPurchaseOrderIns || [],
                );
                setBelumPrPurchaseOrderIns(data.belumPrPurchaseOrderIns || []);
                setSisaDoPurchaseOrderIns(data.sisaDoPurchaseOrderIns || []);
                setRealizedPurchaseOrderIns(
                    data.realizedPurchaseOrderIns || [],
                );
                setRealizedDoPurchaseOrderIns(
                    data.realizedDoPurchaseOrderIns || [],
                );
                setAllPurchaseOrderIns(data.allPurchaseOrderIns || []);
            }

            setPagination(data.pagination || {});
        } catch (error) {
            console.error('Error fetching PO In data:', error);
        } finally {
            if (!isPartial) setLoading(false);
            setTableLoading(false);
        }
    };

    const fetchPoInSummaryScope = async (scope) => {
        setSummaryLoading((prev) => ({ ...prev, [scope]: true }));
        try {
            const queryParams = new URLSearchParams({
                search: '',
                per_page: '5',
                status: 'all',
                date_filter: 'all',
                page: '1',
                summary_only: '1',
                summary_scope: scope,
            });

            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json();
            setSummary((prev) => ({ ...prev, ...(data.summary || {}) }));
        } catch (error) {
            console.error(`Error fetching PO In ${scope} summary:`, error);
        } finally {
            setSummaryLoading((prev) => ({ ...prev, [scope]: false }));
        }
    };

    const fetchPoInSummary = () => {
        setLoading(false);
        ['outstanding', 'sisa', 'realized', 'total'].forEach((scope) => {
            fetchPoInSummaryScope(scope);
        });
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fetchPoInData({ isPartial: true });
            fetchPoInSummary();
        } else {
            fetchPoInData({ page: 1, isPartial: true });
        }
    }, [perPage, statusFilter, tableDateFilter, tableStartDate, tableEndDate]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isFirstRender.current) {
                fetchPoInData({ search, page: 1, isPartial: true });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const realizedPeriodKey = useMemo(() => {
        if (realizedPeriod === 'this_week') return 'week';
        if (realizedPeriod === 'this_month') return 'month';
        if (realizedPeriod === 'this_year') return 'year';
        return realizedPeriod;
    }, [realizedPeriod]);

    const realizedPrCount = Number(
        summary.realized_pr_counts?.[realizedPeriodKey] ?? 0,
    );
    const realizedDoCount = Number(
        summary.realized_do_counts?.[realizedPeriodKey] ?? 0,
    );

    const modalStatus = useMemo(() => {
        if (activeModal === 'outstanding') {
            return activeModalTab === 'pr'
                ? 'outstanding_pr'
                : 'outstanding_do';
        }
        if (activeModal === 'sisa') {
            return activeModalTab === 'pr' ? 'sisa_pr' : 'sisa_do';
        }
        if (activeModal === 'realized') {
            return activeModalTab === 'pr' ? 'realized_pr' : 'realized_do';
        }
        return 'all';
    }, [activeModal, activeModalTab]);

    const fetchModalData = async () => {
        if (!activeModal) return;

        setModalLoading(true);
        try {
            const queryParams = new URLSearchParams({
                search: modalSearch,
                per_page: 'all',
                status: activeModal === 'all_data' ? 'all' : modalStatus,
                date_filter:
                    activeModal === 'all_data' ? dataPoInPeriod : 'all',
                page: '1',
                is_partial: '1',
            });

            if (activeModal === 'all_data' && dataPoInPeriod === 'range') {
                queryParams.set('start_date', dataPoInStart);
                queryParams.set('end_date', dataPoInEnd);
            }

            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json();
            const rows = data.purchaseOrderIns || [];

            if (activeModal === 'all_data') {
                setAllPurchaseOrderIns(rows);
            } else if (modalStatus === 'outstanding_pr') {
                setOutstandingPurchaseOrderIns(rows);
            } else if (modalStatus === 'outstanding_do') {
                setOutstandingDoPurchaseOrderIns(rows);
            } else if (modalStatus === 'sisa_pr') {
                setBelumPrPurchaseOrderIns(rows);
            } else if (modalStatus === 'sisa_do') {
                setSisaDoPurchaseOrderIns(rows);
            } else if (modalStatus === 'realized_pr') {
                setRealizedPurchaseOrderIns(rows);
            } else if (modalStatus === 'realized_do') {
                setRealizedDoPurchaseOrderIns(rows);
            }
        } catch (error) {
            console.error('Error fetching PO In modal data:', error);
        } finally {
            setModalLoading(false);
        }
    };

    useEffect(() => {
        if (!activeModal) return;
        const timer = setTimeout(() => {
            fetchModalData();
        }, 250);
        return () => clearTimeout(timer);
    }, [
        activeModal,
        activeModalTab,
        modalSearch,
        dataPoInPeriod,
        dataPoInStart,
        dataPoInEnd,
        modalStatus,
    ]);

    const periodLabelMap = {
        today: 'Hari Ini',
        this_week: 'Minggu Ini',
        this_month: 'Bulan Ini',
        this_year: 'Tahun Ini',
        range: 'Range Tanggal',
        all: 'Semua Data',
    };

    const outstandingItems = useMemo(
        () => outstandingPurchaseOrderIns,
        [outstandingPurchaseOrderIns],
    );

    const outstandingDoItems = useMemo(
        () => outstandingDoPurchaseOrderIns,
        [outstandingDoPurchaseOrderIns],
    );

    const belumPrItems = useMemo(
        () => belumPrPurchaseOrderIns,
        [belumPrPurchaseOrderIns],
    );

    const sisaDoItems = useMemo(
        () => sisaDoPurchaseOrderIns,
        [sisaDoPurchaseOrderIns],
    );

    const realizedItemsByPeriod = useMemo(
        () =>
            realizedPurchaseOrderIns.filter((item) =>
                isInPeriod(item.last_pr_date, realizedPeriod),
            ),
        [realizedPurchaseOrderIns, realizedPeriod],
    );

    const realizedDoItemsByPeriod = useMemo(
        () =>
            realizedDoPurchaseOrderIns.filter((item) =>
                isInPeriod(item.last_do_date, realizedPeriod),
            ),
        [realizedDoPurchaseOrderIns, realizedPeriod],
    );

    const dataItemsByPeriod = useMemo(
        () =>
            allPurchaseOrderIns.filter((item) =>
                isInPeriod(
                    item.created_at || item.date_poin,
                    dataPoInPeriod,
                    dataPoInStart,
                    dataPoInEnd,
                ),
            ),
        [allPurchaseOrderIns, dataPoInPeriod, dataPoInStart, dataPoInEnd],
    );

    const dataPoInCount = useMemo(() => {
        if (dataPoInPeriod === 'all') {
            return Number(summary.total ?? 0);
        }
        if (dataPoInPeriod === 'today') {
            return Number(summary.data_counts?.today ?? 0);
        }
        if (dataPoInPeriod === 'this_week') {
            return Number(summary.data_counts?.week ?? 0);
        }
        if (dataPoInPeriod === 'this_month') {
            return Number(summary.data_counts?.month ?? 0);
        }
        if (dataPoInPeriod === 'this_year') {
            return Number(summary.data_counts?.year ?? 0);
        }
        return dataItemsByPeriod.length;
    }, [dataItemsByPeriod.length, dataPoInPeriod, summary]);

    // dataPoInTotalAmount removed for performance

    // dataPoInTotalAmount removed for performance

    const modalItems =
        activeModal === 'outstanding'
            ? activeModalTab === 'pr'
                ? outstandingItems
                : outstandingDoItems
            : activeModal === 'sisa'
              ? activeModalTab === 'pr'
                  ? belumPrItems
                  : sisaDoItems
              : activeModal === 'realized'
                ? activeModalTab === 'pr'
                    ? realizedItemsByPeriod
                    : realizedDoItemsByPeriod
                : activeModal === 'all_data'
                  ? dataItemsByPeriod
                  : [];

    const modalFilteredItems = useMemo(() => {
        const term = modalSearch.trim().toLowerCase();
        if (!term) {
            return modalItems;
        }
        return modalItems.filter((item) =>
            [item.kode_poin, item.no_poin, item.customer_name].some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            ),
        );
    }, [modalItems, modalSearch]);

    const modalTotalItems = modalFilteredItems.length;
    const modalTotalPages = useMemo(() => {
        if (modalPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(modalTotalItems / modalPageSize));
    }, [modalTotalItems, modalPageSize]);

    const modalDisplayedItems = useMemo(() => {
        if (modalPageSize === Infinity) {
            return modalFilteredItems;
        }
        const start = (modalPage - 1) * modalPageSize;
        return modalFilteredItems.slice(start, start + modalPageSize);
    }, [modalFilteredItems, modalPage, modalPageSize]);

    const loadDetailModal = async (kodePoin, opts = {}) => {
        const isInitial = Boolean(opts.initial);
        if (isInitial) {
            setDetailLoading(true);
        } else {
            setDetailTableLoading(true);
        }
        setDetailError('');
        try {
            const params = new URLSearchParams();
            const nextPage = opts.page ?? detailPage;
            const nextPerPage = opts.perPage ?? detailPageSize;
            const nextSearch = opts.search ?? detailSearch;
            params.set('page', String(nextPage));
            params.set(
                'per_page',
                nextPerPage === Infinity ? 'all' : String(nextPerPage),
            );
            if (String(nextSearch ?? '').trim()) {
                params.set('search', String(nextSearch).trim());
            }

            const response = await fetch(
                `/marketing/purchase-order-in/${encodeURIComponent(kodePoin)}/show?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Gagal memuat detail PO In.');
            }
            setDetailHeader(data?.header ?? null);
            setDetailItems(Array.isArray(data?.items) ? data.items : []);
            setDetailPagination({
                total: Number(data?.pagination?.total ?? 0),
                page: Number(data?.pagination?.page ?? 1),
                per_page:
                    data?.pagination?.per_page ??
                    (nextPerPage === Infinity ? 'all' : nextPerPage),
                total_pages: Number(data?.pagination?.total_pages ?? 1),
            });
        } catch (error) {
            setDetailError(error?.message || 'Gagal memuat detail PO In.');
        } finally {
            if (isInitial) {
                setDetailLoading(false);
            } else {
                setDetailTableLoading(false);
            }
        }
    };

    const openDetailModal = (kodePoin) => {
        setIsDetailModalOpen(true);
        setDetailHeader(null);
        setDetailItems([]);
        setDetailError('');
        setDetailKodePoin(kodePoin);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailPage(1);
        setDetailLoading(true);
    };

    const handleDeletePoIn = async () => {
        if (!confirmDeleteKode) {
            return;
        }

        setIsDeleting(true);
        router.delete(
            `/marketing/purchase-order-in/${encodeURIComponent(confirmDeleteKode)}`,
            {
                preserveScroll: true,
                headers: {
                    'X-Skip-Loading-Overlay': '1',
                },
                onSuccess: () => {
                    setActiveModal(null);
                    setIsConfirmDeleteOpen(false);
                    setConfirmDeleteKode('');
                },
                onError: () => setIsDeleting(false),
            },
        );
    };

    useEffect(() => {
        if (!isDetailModalOpen || !detailKodePoin) {
            return;
        }
        const timer = setTimeout(() => {
            loadDetailModal(detailKodePoin, {
                page: detailPage,
                perPage: detailPageSize,
                search: detailSearch,
                initial: !detailHeader,
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [
        detailKodePoin,
        detailPage,
        detailPageSize,
        detailSearch,
        isDetailModalOpen,
    ]);

    return (
        <>
            <Head title="Purchase Order In" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4">
                {/* Header section with explicit hex background for maximum compatibility */}
                <section
                    className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5 text-white shadow-lg"
                    style={{ backgroundColor: '#0f172a' }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold tracking-[0.22em] text-[#e2e8f0] uppercase">
                                Marketing Workspace
                            </p>
                            <h1 className="mt-1 text-2xl font-bold text-white">
                                Purchase Order In (PO In)
                            </h1>
                        </div>
                        <Button
                            className="border-2 border-slate-700 bg-[#ffffff] font-bold text-[#0f172a] hover:bg-[#f1f5f9]"
                            style={{
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                            }}
                            onClick={() =>
                                router.visit(
                                    '/marketing/purchase-order-in/create',
                                )
                            }
                        >
                            Tambah PO IN
                        </Button>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Card PO IN Outstanding */}
                    <article
                        className={cn(
                            'cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-amber-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-amber-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                        onClick={() => {
                            setActiveModal('outstanding');
                            setActiveModalTab('do');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div
                            className={cn(
                                'mb-3 inline-flex rounded-lg p-2',
                                isDark ? 'bg-slate-800' : 'bg-[#f1f5f9]',
                            )}
                        >
                            <ClipboardCheck className="size-4 text-amber-600" />
                        </div>
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                isDark ? 'text-slate-400' : 'text-slate-600',
                            )}
                        >
                            PO IN Outstanding
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="Belum PR"
                                value={summary.outstanding_pr ?? 0}
                                loading={summaryLoading.outstanding}
                                onClick={() => {
                                    setActiveModal('outstanding');
                                    setActiveModalTab('pr');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                            <SummaryMetric
                                label="Belum DO"
                                value={summary.outstanding_do ?? 0}
                                loading={summaryLoading.outstanding}
                                onClick={() => {
                                    setActiveModal('outstanding');
                                    setActiveModalTab('do');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                        </div>
                        <p
                            className={cn(
                                'mt-1 text-xs font-medium',
                                isDark ? 'text-slate-500' : 'text-slate-500',
                            )}
                        >
                            Dipisah berdasarkan dokumen yang belum dibuat
                        </p>
                    </article>

                    {/* Card PO IN Sisa */}
                    <article
                        className={cn(
                            'cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-rose-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-rose-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                        onClick={() => {
                            setActiveModal('sisa');
                            setActiveModalTab('do');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div
                            className={cn(
                                'mb-3 inline-flex rounded-lg p-2',
                                isDark ? 'bg-slate-800' : 'bg-[#f1f5f9]',
                            )}
                        >
                            <AlertCircle className="size-4 text-rose-600" />
                        </div>
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                isDark ? 'text-slate-400' : 'text-slate-600',
                            )}
                        >
                            PO IN Sisa
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="Sisa PR"
                                value={summary.sisa_pr ?? 0}
                                loading={summaryLoading.sisa}
                                onClick={() => {
                                    setActiveModal('sisa');
                                    setActiveModalTab('pr');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                            <SummaryMetric
                                label="Sisa DO"
                                value={summary.sisa_do ?? 0}
                                loading={summaryLoading.sisa}
                                onClick={() => {
                                    setActiveModal('sisa');
                                    setActiveModalTab('do');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                        </div>
                        <p
                            className={cn(
                                'mt-1 text-xs font-medium',
                                isDark ? 'text-slate-500' : 'text-slate-500',
                            )}
                        >
                            Sudah sebagian dibuat, masih ada sisa material
                        </p>
                    </article>

                    {/* Card PO IN Terealisasi */}
                    <article
                        className={cn(
                            'cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-emerald-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-emerald-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                        onClick={() => {
                            setActiveModal('realized');
                            setActiveModalTab('do');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <span
                                className={cn(
                                    'inline-flex rounded-lg p-2',
                                    isDark ? 'bg-slate-800' : 'bg-[#f1f5f9]',
                                )}
                            >
                                <ShieldCheck className="size-4 text-emerald-600" />
                            </span>
                            <select
                                className={cn(
                                    'h-8 rounded-md border px-2 text-xs font-bold ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    isDark
                                        ? 'border-slate-700 bg-slate-800 text-white'
                                        : 'border-slate-300 bg-[#ffffff] text-slate-900',
                                )}
                                value={realizedPeriod}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                    setRealizedPeriod(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </div>
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                isDark ? 'text-slate-400' : 'text-slate-600',
                            )}
                        >
                            PO IN Terealisasi
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="PR Selesai"
                                value={realizedPrCount}
                                loading={summaryLoading.realized}
                                onClick={() => {
                                    setActiveModal('realized');
                                    setActiveModalTab('pr');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                            <SummaryMetric
                                label="DO Selesai"
                                value={realizedDoCount}
                                loading={summaryLoading.realized}
                                onClick={() => {
                                    setActiveModal('realized');
                                    setActiveModalTab('do');
                                    setModalSearch('');
                                    setModalPageSize(5);
                                    setModalPage(1);
                                }}
                            />
                        </div>
                        <p
                            className={cn(
                                'mt-1 text-xs font-medium',
                                isDark ? 'text-slate-500' : 'text-slate-500',
                            )}
                        >
                            Semua material sudah dibuat DO —{' '}
                            {periodLabelMap[realizedPeriod]}
                        </p>
                    </article>

                    {/* Card Data PO IN (Total) */}
                    <article
                        className={cn(
                            'cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-blue-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-blue-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                        onClick={() => {
                            setActiveModal('all_data');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <span
                                className={cn(
                                    'inline-flex rounded-lg p-2',
                                    isDark ? 'bg-slate-800' : 'bg-[#f1f5f9]',
                                )}
                            >
                                <Search className="size-4 text-blue-600" />
                            </span>
                            <select
                                className={cn(
                                    'h-8 rounded-md border px-2 text-xs font-bold ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    isDark
                                        ? 'border-slate-700 bg-slate-800 text-white'
                                        : 'border-slate-300 bg-[#ffffff] text-slate-900',
                                )}
                                value={dataPoInPeriod}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                    setDataPoInPeriod(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </div>
                        {dataPoInPeriod === 'range' && (
                            <div
                                className="mb-3 flex flex-wrap gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-1 flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                                        Dari
                                    </label>
                                    <input
                                        type="date"
                                        className={cn(
                                            'h-8 w-full rounded-md border px-2 text-xs',
                                            isDark
                                                ? 'border-slate-700 bg-slate-800 text-white'
                                                : 'border-slate-300 bg-[#ffffff] text-slate-900',
                                        )}
                                        value={dataPoInStart}
                                        onChange={(e) =>
                                            setDataPoInStart(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="flex flex-1 flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                                        Sampai
                                    </label>
                                    <input
                                        type="date"
                                        className={cn(
                                            'h-8 w-full rounded-md border px-2 text-xs',
                                            isDark
                                                ? 'border-slate-700 bg-slate-800 text-white'
                                                : 'border-slate-300 bg-[#ffffff] text-slate-900',
                                        )}
                                        value={dataPoInEnd}
                                        onChange={(e) =>
                                            setDataPoInEnd(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                isDark ? 'text-slate-400' : 'text-slate-600',
                            )}
                        >
                            Total Data PO IN
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <div className="text-2xl font-bold">
                                {summaryLoading.total ? (
                                    <Skeleton className="h-8 w-12" />
                                ) : (
                                    dataPoInCount
                                )}
                            </div>
                            <p
                                className={cn(
                                    'text-sm font-semibold',
                                    isDark
                                        ? 'text-slate-400'
                                        : 'text-slate-500',
                                )}
                            ></p>
                        </div>
                        {/* Grand Total removed per user request for performance */}
                        <p
                            className={cn(
                                'mt-2 text-[10px] font-medium',
                                isDark ? 'text-slate-500' : 'text-slate-500',
                            )}
                        >
                            Laporan Keseluruhan PO IN
                        </p>
                    </article>
                </section>

                <section className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="relative w-full max-w-md">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pr-3 pl-9 text-sm"
                                placeholder="Cari kode PO IN, no PO IN, atau nama customer..."
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value);
                                    // The useEffect will handle the partial fetch
                                }}
                            >
                                <option value="all">Semua Data</option>
                                <option value="outstanding_pr">Belum PR</option>
                                <option value="outstanding_do">Belum DO</option>
                                <option value="sisa_pr">Sisa PR</option>
                                <option value="sisa_do">Sisa DO</option>
                                <option value="realized_pr">PR Selesai</option>
                                <option value="realized_do">DO Selesai</option>
                            </select>
                            <select
                                className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={tableDateFilter}
                                onChange={(event) =>
                                    setTableDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                            {tableDateFilter === 'range' && (
                                <>
                                    <input
                                        type="date"
                                        className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                        value={tableStartDate}
                                        onChange={(event) =>
                                            setTableStartDate(
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <input
                                        type="date"
                                        className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                        value={tableEndDate}
                                        onChange={(event) =>
                                            setTableEndDate(event.target.value)
                                        }
                                    />
                                </>
                            )}
                            <select
                                className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={perPage}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPerPage(value);
                                    // The useEffect will handle the partial fetch
                                }}
                            >
                                <option value="5">5 data</option>
                                <option value="10">10 data</option>
                                <option value="25">25 data</option>
                                <option value="50">50 data</option>
                                <option value="all">Semua data</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full min-w-[720px] table-auto text-sm">
                            <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="w-12 px-2 py-2 text-left">
                                        No
                                    </th>
                                    <th className="w-44 px-2 py-2 text-left">
                                        Kode PO In
                                    </th>
                                    <th className="w-40 px-2 py-2 text-left">
                                        No PO In
                                    </th>
                                    <th className="w-28 px-2 py-2 text-left">
                                        Date Input
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Customer
                                    </th>
                                    <th className="w-36 px-2 py-2 text-right">
                                        Grand Total (Rp.)
                                    </th>
                                    <th className="w-24 px-2 py-2 text-left">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <PlainTableStateRows
                                    loading={tableLoading}
                                    columns={7}
                                    skeletonRows={
                                        perPage === 'all' ? 5 : Number(perPage)
                                    }
                                    isEmpty={
                                        !tableLoading &&
                                        purchaseOrderIns.length === 0
                                    }
                                    emptyTitle="Belum ada data PO In."
                                />
                                {!tableLoading &&
                                    purchaseOrderIns.map((item, index) => (
                                        <tr
                                            key={item.id ?? item.no_poin}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                {pagination.per_page === 'all'
                                                    ? index + 1
                                                    : (Number(
                                                          pagination.page || 1,
                                                      ) -
                                                          1) *
                                                          Number(
                                                              pagination.per_page ||
                                                                  5,
                                                          ) +
                                                      index +
                                                      1}
                                            </td>
                                            <td className="px-2 py-2 font-semibold whitespace-nowrap">
                                                {item.kode_poin}
                                            </td>
                                            <td className="px-2 py-2 font-semibold whitespace-nowrap">
                                                {item.no_poin}
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                {formatDateDisplay(
                                                    item.created_at ||
                                                        item.date_poin,
                                                )}
                                            </td>
                                            <td className="px-2 py-2">
                                                {item.customer_name}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {formatRupiah(item.grand_total)}
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            openDetailModal(
                                                                item.kode_poin,
                                                            )
                                                        }
                                                        title="Lihat"
                                                    >
                                                        <Eye className="size-4" />
                                                    </Button>
                                                    {/* Edit icon removed from main table per user request */}
                                                    <a
                                                        href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                                        title="Print"
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
                    {String(pagination.per_page) !== 'all' &&
                        Number(pagination.total || 0) > 0 && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (Number(pagination.page || 1) - 1) *
                                            Number(pagination.per_page || 5) +
                                            1,
                                        Number(pagination.total || 0),
                                    )}
                                    -
                                    {Math.min(
                                        Number(pagination.page || 1) *
                                            Number(pagination.per_page || 5),
                                        Number(pagination.total || 0),
                                    )}{' '}
                                    dari {pagination.total} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            Number(pagination.page || 1) <= 1
                                        }
                                        onClick={() =>
                                            fetchPoInData({
                                                page: Math.max(
                                                    1,
                                                    Number(
                                                        pagination.page || 1,
                                                    ) - 1,
                                                ),
                                                isPartial: true,
                                            })
                                        }
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {pagination.page || 1} /{' '}
                                        {pagination.total_pages || 1}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            Number(pagination.page || 1) >=
                                            Number(pagination.total_pages || 1)
                                        }
                                        onClick={() =>
                                            fetchPoInData({
                                                page: Math.min(
                                                    Number(
                                                        pagination.total_pages ||
                                                            1,
                                                    ),
                                                    Number(
                                                        pagination.page || 1,
                                                    ) + 1,
                                                ),
                                                isPartial: true,
                                            })
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                </section>

                <Dialog
                    open={isDetailModalOpen}
                    onOpenChange={(open) => {
                        setIsDetailModalOpen(open);
                        if (!open) {
                            setDetailHeader(null);
                            setDetailItems([]);
                            setDetailError('');
                            setDetailKodePoin('');
                            setDetailTableLoading(false);
                        }
                    }}
                >
                    <DialogContent className="!top-[2vh] !left-[0.5vw] !h-[96vh] !w-[99vw] !max-w-[99vw] !translate-x-0 !translate-y-0 overflow-y-auto p-0">
                        <DialogHeader className="sticky top-0 z-20 border-b border-sidebar-border/70 bg-background px-4 py-3 pr-12">
                            <div className="flex items-center justify-between">
                                <DialogTitle>Detail PO In</DialogTitle>
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        title="Tutup"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </DialogClose>
                            </div>
                        </DialogHeader>
                        <div className="p-3">
                            {detailLoading && (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    Memuat detail PO In...
                                </div>
                            )}
                            {!detailLoading && detailError && (
                                <div className="py-10 text-center text-sm text-rose-600">
                                    {detailError}
                                </div>
                            )}
                            {!detailLoading && !detailError && detailHeader && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        <div className="min-w-36 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                Kode PO In
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.kode_poin ?? '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                No PO In
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.no_poin ?? '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-56 flex-1 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                Customer
                                            </p>
                                            <p className="text-sm font-semibold">
                                                {detailHeader.customer_name ??
                                                    '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Tgl Buat
                                            </p>
                                            <input
                                                type="date"
                                                className="h-5 w-full border-none bg-transparent p-0 text-sm font-semibold focus:ring-0"
                                                value={
                                                    detailHeader.created_at
                                                        ? detailHeader.created_at.split(
                                                              /[\sT]/,
                                                          )[0]
                                                        : detailHeader.date_poin &&
                                                            detailHeader.date_poin.includes(
                                                                '-',
                                                            )
                                                          ? detailHeader.date_poin
                                                          : ''
                                                }
                                                readOnly
                                            />
                                        </div>
                                        <div className="min-w-36 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Term of Payment
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.payment_term ??
                                                    '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-36 flex-1 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Franco / Loco
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.franco_loco ??
                                                    '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Date PO In
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {formatDateDisplay(
                                                    detailHeader.date_poin,
                                                )}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Delivery Date
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {formatDateDisplay(
                                                    detailHeader.delivery_date,
                                                )}
                                            </p>
                                        </div>
                                        <div className="min-w-20 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                PPN
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.ppn_input_percent ??
                                                    0}
                                                %
                                            </p>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                            Keterangan
                                        </p>
                                        <p className="text-sm font-semibold whitespace-pre-wrap">
                                            {String(
                                                detailHeader.note_doc ?? '',
                                            ).trim() || '-'}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="relative w-full max-w-md">
                                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="search"
                                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pr-3 pl-9 text-sm"
                                                placeholder="Cari material..."
                                                value={detailSearch}
                                                onChange={(event) => {
                                                    setDetailSearch(
                                                        event.target.value,
                                                    );
                                                    setDetailPage(1);
                                                }}
                                            />
                                        </div>
                                        <label className="text-sm text-muted-foreground">
                                            Tampilkan
                                            <select
                                                className="ml-2 h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                                value={
                                                    detailPageSize === Infinity
                                                        ? 'all'
                                                        : String(detailPageSize)
                                                }
                                                onChange={(event) => {
                                                    const value =
                                                        event.target.value;
                                                    setDetailPageSize(
                                                        value === 'all'
                                                            ? Infinity
                                                            : Number(value),
                                                    );
                                                    setDetailPage(1);
                                                }}
                                            >
                                                <option value="5">5</option>
                                                <option value="10">10</option>
                                                <option value="25">25</option>
                                                <option value="50">50</option>
                                                <option value="all">
                                                    Semua
                                                </option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full min-w-[860px] table-auto text-sm">
                                            <thead className="bg-muted/40 text-muted-foreground">
                                                <tr>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-12 px-2 py-2 text-left align-middle"
                                                    >
                                                        No
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-2 py-2 text-left align-middle"
                                                    >
                                                        Material
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-28 px-2 py-2 text-right align-middle"
                                                    >
                                                        Qty
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-32 px-2 py-2 text-right align-middle"
                                                    >
                                                        Price PO In
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-36 px-2 py-2 text-right align-middle"
                                                    >
                                                        Total Price
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="px-2 py-2 text-center"
                                                    >
                                                        Sisa
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-44 px-2 py-2 text-left align-middle"
                                                    >
                                                        Remark
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th className="w-24 px-2 py-2 text-right">
                                                        PR
                                                    </th>
                                                    <th className="w-24 px-2 py-2 text-right">
                                                        DO
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <PlainTableStateRows
                                                    columns={10}
                                                    loading={detailTableLoading}
                                                    error={detailError}
                                                    isEmpty={
                                                        !detailTableLoading &&
                                                        !detailError &&
                                                        detailItems.length === 0
                                                    }
                                                    emptyTitle="Tidak ada detail material."
                                                    skeletonRows={
                                                        detailPageSize
                                                    }
                                                />
                                                {!detailTableLoading &&
                                                    detailItems.map(
                                                        (row, index) => (
                                                            <tr
                                                                key={
                                                                    row.id ??
                                                                    `${row.kode_poin}-${index}`
                                                                }
                                                                className="border-t border-sidebar-border/70"
                                                            >
                                                                <td className="px-2 py-2 whitespace-nowrap">
                                                                    {detailPagination.per_page ===
                                                                    'all'
                                                                        ? index +
                                                                          1
                                                                        : (Number(
                                                                              detailPagination.page ||
                                                                                  1,
                                                                          ) -
                                                                              1) *
                                                                              Number(
                                                                                  detailPagination.per_page ||
                                                                                      5,
                                                                              ) +
                                                                          index +
                                                                          1}
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    {row.material ??
                                                                        '-'}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {`${row.qty ?? 0} ${row.satuan ?? ''}`}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {formatRupiah(
                                                                        row.price_po_in ??
                                                                            0,
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {formatRupiah(
                                                                        row.total_price_po_in ??
                                                                            0,
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {row.sisa_qtypr ??
                                                                        0}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {row.sisa_qtydo ??
                                                                        0}
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    {row.remark ||
                                                                        '-'}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                        <p className="text-muted-foreground">
                                            Total {detailPagination.total} data
                                        </p>
                                        {String(detailPagination.per_page) !==
                                            'all' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        Number(
                                                            detailPagination.page ||
                                                                1,
                                                        ) <= 1
                                                    }
                                                    onClick={() =>
                                                        setDetailPage((prev) =>
                                                            Math.max(
                                                                1,
                                                                prev - 1,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="text-muted-foreground">
                                                    Halaman{' '}
                                                    {detailPagination.page} /{' '}
                                                    {
                                                        detailPagination.total_pages
                                                    }
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        Number(
                                                            detailPagination.page,
                                                        ) >=
                                                        Number(
                                                            detailPagination.total_pages,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        setDetailPage((prev) =>
                                                            Math.min(
                                                                Number(
                                                                    detailPagination.total_pages ||
                                                                        1,
                                                                ),
                                                                prev + 1,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid gap-2 md:grid-cols-4">
                                        <div className="rounded-lg border border-sidebar-border/70 p-2">
                                            <p className="text-xs text-muted-foreground">
                                                Total Price
                                            </p>
                                            <p className="font-semibold">
                                                {formatRupiah(
                                                    detailHeader.total_price ??
                                                        0,
                                                )}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/70 p-2">
                                            <p className="text-xs text-muted-foreground">
                                                DPP
                                            </p>
                                            <p className="font-semibold">
                                                {formatRupiah(
                                                    detailHeader.dpp ?? 0,
                                                )}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/70 p-2">
                                            <p className="text-xs text-muted-foreground">
                                                PPN
                                            </p>
                                            <p className="font-semibold">
                                                {formatRupiah(
                                                    detailHeader.ppn_amount ??
                                                        0,
                                                )}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/70 p-2">
                                            <p className="text-xs text-muted-foreground">
                                                Grand Total
                                            </p>
                                            <p className="font-semibold">
                                                {formatRupiah(
                                                    detailHeader.grand_total ??
                                                        0,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={activeModal !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setActiveModal(null);
                        }
                    }}
                >
                    <DialogContent className="h-[96vh] w-[99vw] max-w-[99vw] p-4 sm:!max-w-[99vw]">
                        <DialogHeader>
                            <DialogTitle>
                                {activeModal === 'all_data'
                                    ? 'Data PO IN'
                                    : activeModal === 'outstanding'
                                      ? 'Data PO IN Outstanding'
                                      : activeModal === 'sisa'
                                        ? 'Data PO IN Sisa'
                                        : `Data PO IN Terealisasi (${periodLabelMap[realizedPeriod]})`}
                            </DialogTitle>
                        </DialogHeader>

                        {activeModal !== 'all_data' && (
                            <div className="mb-3 grid h-11 w-full max-w-sm grid-cols-2 rounded-lg border border-sidebar-border/70 bg-muted/30 p-1">
                                <button
                                    type="button"
                                    className={cn(
                                        'flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold whitespace-nowrap transition',
                                        activeModalTab === 'pr'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                    onClick={() => {
                                        setActiveModalTab('pr');
                                        setModalSearch('');
                                        setModalPage(1);
                                    }}
                                >
                                    {activeModal === 'outstanding'
                                        ? 'Outstanding PR'
                                        : activeModal === 'sisa'
                                          ? 'Sisa PR'
                                          : 'PR Selesai'}
                                </button>
                                <button
                                    type="button"
                                    className={cn(
                                        'flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold whitespace-nowrap transition',
                                        activeModalTab === 'do'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                    onClick={() => {
                                        setActiveModalTab('do');
                                        setModalSearch('');
                                        setModalPage(1);
                                    }}
                                >
                                    {activeModal === 'outstanding'
                                        ? 'Outstanding DO'
                                        : activeModal === 'sisa'
                                          ? 'Sisa DO'
                                          : 'DO Selesai'}
                                </button>
                            </div>
                        )}

                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="relative w-full max-w-md">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pr-3 pl-9 text-sm"
                                    placeholder="Cari data di modal..."
                                    value={modalSearch}
                                    onChange={(event) => {
                                        setModalSearch(event.target.value);
                                        setModalPage(1);
                                    }}
                                />
                            </div>
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                    value={
                                        modalPageSize === Infinity
                                            ? 'all'
                                            : String(modalPageSize)
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setModalPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setModalPage(1);
                                    }}
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                        </div>

                        <div className="max-h-[78vh] overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="w-12 px-2 py-2 text-left">
                                            No
                                        </th>
                                        <th className="w-44 px-2 py-2 text-left">
                                            Kode PO In
                                        </th>
                                        <th className="w-40 px-2 py-2 text-left">
                                            No PO In
                                        </th>
                                        <th className="w-32 px-2 py-2 text-left">
                                            {activeModal === 'realized' &&
                                            activeModalTab === 'do'
                                                ? 'Tgl DO Terakhir'
                                                : activeModal === 'realized' &&
                                                    activeModalTab === 'pr'
                                                  ? 'Tgl PR Terakhir'
                                                  : 'Date Input'}
                                        </th>
                                        <th className="px-2 py-2 text-left">
                                            Customer
                                        </th>
                                        <th className="w-36 px-2 py-2 text-right">
                                            Grand Total
                                        </th>
                                        <th className="w-24 px-2 py-2 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        columns={7}
                                        loading={modalLoading}
                                        isEmpty={
                                            !modalLoading &&
                                            modalDisplayedItems.length === 0
                                        }
                                        emptyTitle="Tidak ada data."
                                        skeletonRows={modalPageSize}
                                    />
                                    {modalDisplayedItems.map((item, index) => (
                                        <tr
                                            key={`${item.no_poin}-${index}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                {modalPageSize === Infinity
                                                    ? index + 1
                                                    : (modalPage - 1) *
                                                          modalPageSize +
                                                      index +
                                                      1}
                                            </td>
                                            <td className="px-2 py-2 font-semibold whitespace-nowrap">
                                                {item.kode_poin}
                                            </td>
                                            <td className="px-2 py-2 font-semibold whitespace-nowrap">
                                                {item.no_poin}
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                {formatDateDisplay(
                                                    activeModal ===
                                                        'realized' &&
                                                        activeModalTab === 'do'
                                                        ? item.last_do_date
                                                        : activeModal ===
                                                                'realized' &&
                                                            activeModalTab ===
                                                                'pr'
                                                          ? item.last_pr_date
                                                          : item.created_at ||
                                                            item.date_poin,
                                                )}
                                            </td>
                                            <td className="px-2 py-2">
                                                {item.customer_name}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {formatRupiah(item.grand_total)}
                                            </td>
                                            <td className="px-2 py-2">
                                                {activeModal ===
                                                    'outstanding' ||
                                                activeModal === 'sisa' ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setActiveModal(
                                                                    null,
                                                                );
                                                                router.visit(
                                                                    `/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/edit`,
                                                                );
                                                            }}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        {activeModal ===
                                                            'outstanding' && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                title="Hapus"
                                                                onClick={() => {
                                                                    setConfirmDeleteKode(
                                                                        item.kode_poin,
                                                                    );
                                                                    setIsConfirmDeleteOpen(
                                                                        true,
                                                                    );
                                                                }}
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setActiveModal(
                                                                    null,
                                                                );
                                                                openDetailModal(
                                                                    item.kode_poin,
                                                                );
                                                            }}
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                        <a
                                                            href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                                            title="Print"
                                                        >
                                                            <Printer className="size-4" />
                                                        </a>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                            <p className="text-muted-foreground">
                                Total {modalTotalItems} data
                            </p>
                            {modalPageSize !== Infinity && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={modalPage === 1}
                                        onClick={() =>
                                            setModalPage((prev) =>
                                                Math.max(1, prev - 1),
                                            )
                                        }
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-muted-foreground">
                                        Halaman {modalPage} / {modalTotalPages}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={modalPage >= modalTotalPages}
                                        onClick={() =>
                                            setModalPage((prev) =>
                                                Math.min(
                                                    modalTotalPages,
                                                    prev + 1,
                                                ),
                                            )
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isConfirmDeleteOpen}
                    onOpenChange={(open) => {
                        setIsConfirmDeleteOpen(open);
                        if (!open) {
                            setConfirmDeleteKode('');
                        }
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Hapus PO In?</DialogTitle>
                            <DialogDescription className="sr-only">
                                Konfirmasi penghapusan data Purchase Order In.
                            </DialogDescription>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            Data header dan detail material akan dihapus
                            permanen.
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsConfirmDeleteOpen(false);
                                    setConfirmDeleteKode('');
                                }}
                                disabled={isDeleting}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeletePoIn}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Menghapus...' : 'Ya, hapus'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

PurchaseOrderInIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
