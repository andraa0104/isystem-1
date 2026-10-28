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
import { subscribeToPoInChanges } from '@/lib/po-in-realtime';
import {
    createLatestRequest,
    createPoInPaginationCache,
    getBusinessDate,
    getPaginationRange,
    readPoInResponse,
} from '@/lib/purchase-order-in';
import { cn } from '@/lib/utils';
import { Head, router, usePage } from '@inertiajs/react';
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
import {
    Profiler,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import Swal from 'sweetalert2';
import {
    formatRupiah,
    SummaryLoadError,
    SummaryMetric,
} from './summary-metric';
import TrackingDialog from './tracking-dialog';

const MOBILE_QUERY = '(max-width: 767px)';

const subscribeToMobileViewport = (onChange) => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
};

const getIsMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerMobileViewport = () => false;

const logPerformanceDuration = (label, startedAt) => {
    if (
        !import.meta.env.DEV ||
        typeof window === 'undefined' ||
        !new URLSearchParams(window.location.search).has('poin_perf')
    ) {
        return;
    }

    console.info(
        `[PO In performance] ${label}: ${(performance.now() - startedAt).toFixed(1)} ms`,
    );
};

const reportRenderProfile = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
) => {
    if (
        !import.meta.env.DEV ||
        typeof window === 'undefined' ||
        !new URLSearchParams(window.location.search).has('poin_perf')
    ) {
        return;
    }

    console.info('[PO In render profile]', {
        id,
        phase,
        actualDuration: Number(actualDuration.toFixed(1)),
        baseDuration: Number(baseDuration.toFixed(1)),
        startTime: Number(startTime.toFixed(1)),
        commitTime: Number(commitTime.toFixed(1)),
    });
};

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
];

const SUMMARY_SCOPE_METRICS = {
    operational: ['outstanding_pr', 'outstanding_do', 'sisa_pr', 'sisa_do'],
    outstanding: ['outstanding_pr', 'outstanding_do'],
    sisa: ['sisa_pr', 'sisa_do'],
    realized: ['realized_pr', 'realized_do'],
    total: ['total'],
};

const SUMMARY_AMOUNT_HINTS = {
    outstanding:
        'Jumlah grand total dokumen PO yang belum diproses, termasuk PPN sesuai dokumen.',
    sisa_pr:
        'Jumlah sisa kuantitas PR × harga material pada detail PO IN, tanpa tambahan PPN.',
    sisa_do:
        'Jumlah sisa kuantitas DO × harga material pada detail PO IN, tanpa tambahan PPN.',
};

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

const getDeliveryUrgency = (value) => {
    const deliveryDate = toDate(value);
    if (!deliveryDate) return null;

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    const deliveryStart = new Date(
        deliveryDate.getFullYear(),
        deliveryDate.getMonth(),
        deliveryDate.getDate(),
    );
    const daysRemaining = Math.ceil(
        (deliveryStart.getTime() - todayStart.getTime()) / 86400000,
    );

    if (daysRemaining <= 0) return 'overdue';
    if (daysRemaining <= 5) return 'soon';
    return null;
};

const getRowUrgency = (item) =>
    item.sisa_qtydo !== undefined &&
        item.sisa_qtydo !== null &&
        Number(item.sisa_qtydo) !== 0
        ? getDeliveryUrgency(item.delivery_date)
        : null;

const toDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }

    const dotDate = text.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s.*)?$/);
    if (dotDate) {
        return new Date(
            Number(dotDate[3]),
            Number(dotDate[2]) - 1,
            Number(dotDate[1]),
        );
    }

    const slashDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s.*)?$/);
    if (slashDate) {
        return new Date(
            Number(slashDate[3]),
            Number(slashDate[2]) - 1,
            Number(slashDate[1]),
        );
    }

    const dashDate = text.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s.*)?$/);
    if (dashDate) {
        return new Date(
            Number(dashDate[3]),
            Number(dashDate[2]) - 1,
            Number(dashDate[1]),
        );
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

export default function PurchaseOrderInIndex({
    purchaseOrderIns: initialPurchaseOrderIns = [],
    summary: initialSummary = {},
    filters = {},
    pagination: initialPagination = {},
    realtimeChannel = null,
}) {
    const today = getBusinessDate();
    const isMobile = useSyncExternalStore(
        subscribeToMobileViewport,
        getIsMobileViewport,
        getServerMobileViewport,
    );
    const monthStart = `${today.slice(0, 8)}01`;
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportStartDate, setExportStartDate] = useState(monthStart);
    const [exportEndDate, setExportEndDate] = useState(today);
    const [exportStatus, setExportStatus] = useState('all');
    const [exportDateFilter, setExportDateFilter] = useState('today');
    const [exportDeadlineFilter, setExportDeadlineFilter] = useState('all');
    const { auth } = usePage().props;
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';
    const user = auth?.user ?? {};
    const userLevel = String(user.level ?? '').toLowerCase();
    const isAdmin = userLevel === 'admin';
    const menuAccess =
        user.menu_access?.['Marketing:Purchase Order In (PO In)'] ?? {};
    const hasPrivileges = user.has_privileges ?? false;
    const canCreate = isAdmin || (hasPrivileges && menuAccess.create === true);
    const canUpdate = isAdmin || (hasPrivileges && menuAccess.update === true);
    const canDelete = isAdmin || (hasPrivileges && menuAccess.delete === true);

    const [search, setSearch] = useState(filters.search ?? '');
    const [activeDataTab, setActiveDataTab] = useState('customer');
    const [materialSearch, setMaterialSearch] = useState('');
    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

    const handleOpenTrackingModal = () => {
        setIsTrackingModalOpen(true);
    };
    const [perPage, setPerPage] = useState(String(filters.per_page ?? '5'));
    const [materialPerPage, setMaterialPerPage] = useState('5');
    const [statusFilter, setStatusFilter] = useState(
        filters.status ?? 'outstanding_do',
    );
    const [materialStatusFilter, setMaterialStatusFilter] =
        useState('outstanding_do');
    const [tableDateFilter, setTableDateFilter] = useState('all');
    const [materialDateFilter, setMaterialDateFilter] = useState('all');
    const [tableStartDate, setTableStartDate] = useState('');
    const [tableEndDate, setTableEndDate] = useState('');
    const [materialStartDate, setMaterialStartDate] = useState('');
    const [materialEndDate, setMaterialEndDate] = useState('');
    const [deadlineFilter, setDeadlineFilter] = useState('all');
    const [materialDeadlineFilter, setMaterialDeadlineFilter] = useState('all');
    const [realizedPeriod, setRealizedPeriod] = useState('today');
    const [dataPoInPeriod, setDataPoInPeriod] = useState('today');
    const [dataPoInStart, setDataPoInStart] = useState('');
    const [dataPoInEnd, setDataPoInEnd] = useState('');
    const [activeModal, setActiveModal] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('do');

    const [purchaseOrderIns, setPurchaseOrderIns] = useState(
        initialPurchaseOrderIns,
    );
    const [materialRows, setMaterialRows] = useState([]);
    const [materialPagination, setMaterialPagination] = useState({
        total: 0,
        page: 1,
        per_page: 5,
        total_pages: 1,
    });
    const [materialLoading, setMaterialLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const [paginationLoading, setPaginationLoading] = useState(false);
    const [tableError, setTableError] = useState('');
    const [paginationError, setPaginationError] = useState('');
    const [materialError, setMaterialError] = useState('');
    const [summary, setSummary] = useState(initialSummary);
    const [summaryErrors, setSummaryErrors] = useState({});
    const [summaryLoading, setSummaryLoading] = useState({
        outstanding_pr: true,
        outstanding_do: true,
        sisa_pr: true,
        sisa_do: true,
        realized_pr: true,
        realized_do: true,
        total: true,
    });
    const [pagination, setPagination] = useState(initialPagination);

    const [modalSearch, setModalSearch] = useState('');
    const [modalPageSize, setModalPageSize] = useState(5);
    const [modalPage, setModalPage] = useState(1);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState('');
    const [modalRows, setModalRows] = useState([]);
    const [modalPagination, setModalPagination] = useState({
        total: 0,
        total_pages: 1,
    });
    const [modalDeadlineFilter, setModalDeadlineFilter] = useState('all');

    useEffect(() => {
        setModalDeadlineFilter('all');
    }, [activeModal, activeModalTab]);
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

    const tableAbortControllers = useRef({});
    const beginTableRequest = (key) => {
        tableAbortControllers.current[key]?.abort();
        const controller = new AbortController();
        tableAbortControllers.current[key] = controller;
        return controller.signal;
    };
    useEffect(() => () => {
        Object.values(tableAbortControllers.current).forEach(controller => controller.abort());
    }, []);
    const rowsRequestId = useRef(0);
    const paginationRequestId = useRef(0);
    const paginationCache = useRef(createPoInPaginationCache());
    const materialRequestId = useRef(0);
    const summaryRequestIds = useRef({});
    const modalRequest = useRef(createLatestRequest());
    const detailRequest = useRef(createLatestRequest());
    const lastTableParams = useRef({});
    const lastMaterialParams = useRef({});
    const isInitialTableLoad = useRef(true);
    const isInitialRealizedSummaryLoad = useRef(true);
    const isInitialTotalSummaryLoad = useRef(true);

    const openSummaryModal = (modal, tab = 'do') => {
        setActiveModal(modal);
        if (modal !== 'all_data') setActiveModalTab(tab);
        setModalSearch('');
        setModalPageSize(5);
        setModalPage(1);
    };

    const buildTableQueryParams = (params = {}) => {
        const queryParams = new URLSearchParams({
            search: params.search ?? search,
            per_page: params.per_page ?? perPage,
            status: params.status ?? statusFilter,
            date_filter: params.dateFilter ?? tableDateFilter,
            deadline_filter: params.deadlineFilter ?? deadlineFilter,
            page:
                params.page ??
                (params.isPartial ? pagination.page : (pagination.page ?? 1)),
        });

        queryParams.append('is_partial', '1');
        queryParams.set('_request', `${Date.now()}-${Math.random()}`);
        if ((params.dateFilter ?? tableDateFilter) === 'range') {
            queryParams.set('start_date', params.startDate ?? tableStartDate);
            queryParams.set('end_date', params.endDate ?? tableEndDate);
        }

        return queryParams;
    };

    const responseMatchesFilters = (data, params) => {
        const appliedFilters = data.applied_filters ?? {};
        const expectedDateFilter = params.dateFilter ?? tableDateFilter;
        const expectedStatus = params.status ?? statusFilter;
        const expectedDeadlineFilter = params.deadlineFilter ?? deadlineFilter;

        return (
            appliedFilters.date_filter === expectedDateFilter &&
            appliedFilters.status === expectedStatus &&
            appliedFilters.deadline_filter === expectedDeadlineFilter
        );
    };

    const fetchPoInRows = async (params = {}) => {
        const signal = beginTableRequest('rows');
        const requestId = ++rowsRequestId.current;
        const nextParams = { ...params, isPartial: true };
        const startedAt = performance.now();
        setTableLoading(true);
        setTableError('');
        if (!params.background) setPurchaseOrderIns([]);

        try {
            const queryParams = buildTableQueryParams(nextParams);
            queryParams.set('rows_only', '1');
            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                {
                    cache: 'no-store',
                    signal,
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat data PO In.',
            );
            if (!Array.isArray(data.purchaseOrderIns)) {
                throw new Error('Respons data PO In tidak lengkap.');
            }

            if (
                requestId === rowsRequestId.current &&
                responseMatchesFilters(data, nextParams)
            ) {
                setPurchaseOrderIns(data.purchaseOrderIns || []);
            }
        } catch (error) {
            if (signal.aborted) return;
            if (requestId === rowsRequestId.current) {
                setTableError(error?.message || 'Gagal memuat data PO In.');
            }
        } finally {
            logPerformanceDuration('customer rows request', startedAt);
            if (requestId === rowsRequestId.current) {
                setTableLoading(false);
            }
        }
    };

    const fetchPoInPagination = async (params = {}) => {
        const signal = beginTableRequest('pagination');
        const requestId = ++paginationRequestId.current;
        const nextParams = { ...params, isPartial: true };
        const startedAt = performance.now();
        setPaginationLoading(true);
        setPaginationError('');

        try {
            const queryParams = buildTableQueryParams(nextParams);
            queryParams.set('pagination_only', '1');
            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                {
                    cache: 'no-store',
                    signal,
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat jumlah dan halaman PO In.',
            );
            if (
                !(
                    data.pagination &&
                    Number.isFinite(Number(data.pagination.total))
                )
            ) {
                throw new Error('Respons data PO In tidak lengkap.');
            }

            if (
                requestId === paginationRequestId.current &&
                responseMatchesFilters(data, nextParams)
            ) {
                paginationCache.current.remember(queryParams, data.pagination);
                setPagination(data.pagination || {});
            }
        } catch (error) {
            if (signal.aborted) return;
            if (requestId === paginationRequestId.current) {
                setPaginationError(
                    error?.message || 'Gagal memuat jumlah dan halaman PO In.',
                );
            }
        } finally {
            logPerformanceDuration('customer pagination request', startedAt);
            if (requestId === paginationRequestId.current) {
                setPaginationLoading(false);
            }
        }
    };

    const fetchPoInData = (params = {}, reusePagination = false) => {
        lastTableParams.current = {
            ...params,
            page: params.page ?? pagination.page ?? 1,
        };
        const cachedPagination = reusePagination
            ? paginationCache.current.read(buildTableQueryParams(lastTableParams.current))
            : null;
        fetchPoInRows(lastTableParams.current);
        if (cachedPagination) {
            tableAbortControllers.current.pagination?.abort();
            paginationRequestId.current += 1;
            setPagination(cachedPagination);
            setPaginationLoading(false);
            setPaginationError('');
        } else {
            paginationCache.current.clear();
            fetchPoInPagination(lastTableParams.current);
        }
    };

    const fetchMaterialData = async (params = {}) => {
        const signal = beginTableRequest('material');
        const requestId = ++materialRequestId.current;
        const startedAt = performance.now();
        lastMaterialParams.current = params;
        setMaterialLoading(true);
        setMaterialError('');
        if (!params.background) setMaterialRows([]);

        try {
            const queryParams = new URLSearchParams({
                search: params.search ?? materialSearch,
                per_page: params.per_page ?? materialPerPage,
                status: params.status ?? materialStatusFilter,
                date_filter: params.dateFilter ?? materialDateFilter,
                deadline_filter:
                    params.deadlineFilter ?? materialDeadlineFilter,
                page: params.page ?? 1,
                _request: `${Date.now()}-${Math.random()}`,
            });
            if ((params.dateFilter ?? materialDateFilter) === 'range') {
                queryParams.set(
                    'start_date',
                    params.startDate ?? materialStartDate,
                );
                queryParams.set('end_date', params.endDate ?? materialEndDate);
            }

            const response = await fetch(
                `/marketing/purchase-order-in/material-data?${queryParams.toString()}`,
                { cache: 'no-store',
                    signal, headers: { Accept: 'application/json' } },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat data material PO In.',
            );
            if (!Array.isArray(data.materials) || !data.pagination) {
                throw new Error('Respons data material PO In tidak lengkap.');
            }
            if (requestId === materialRequestId.current) {
                setMaterialRows(data.materials || []);
                setMaterialPagination(data.pagination || {});
            }
        } catch (error) {
            if (signal.aborted) return;
            if (requestId === materialRequestId.current) {
                setMaterialError(
                    error?.message || 'Gagal memuat data material PO In.',
                );
            }
        } finally {
            logPerformanceDuration(
                'material rows and pagination request',
                startedAt,
            );
            if (requestId === materialRequestId.current) {
                setMaterialLoading(false);
            }
        }
    };

    const fetchPoInSummaryScope = async (
        scope,
        dateFilterVal = 'all',
        startDateVal = '',
        endDateVal = '',
    ) => {
        const signal = beginTableRequest(`summary:${scope}`);
        const metrics = SUMMARY_SCOPE_METRICS[scope] ?? [scope];
        const startedAt = performance.now();
        const requestId = (summaryRequestIds.current[scope] ?? 0) + 1;
        summaryRequestIds.current[scope] = requestId;
        const isCurrentRequest = () =>
            summaryRequestIds.current[scope] === requestId;
        const metricFlags = (value) =>
            Object.fromEntries(metrics.map((metric) => [metric, value]));

        setSummaryLoading((prev) => ({ ...prev, ...metricFlags(true) }));
        setSummaryErrors((prev) => ({ ...prev, ...metricFlags(false) }));

        try {
            const queryParams = new URLSearchParams({
                search: '',
                per_page: '5',
                status: 'all',
                date_filter: dateFilterVal,
                page: '1',
                summary_only: '1',
                summary_scope: scope,
            });

            if (dateFilterVal === 'range' && (startDateVal || endDateVal)) {
                queryParams.set('start_date', startDateVal);
                queryParams.set('end_date', endDateVal);
            }

            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                {
                    cache: 'no-store',
                    signal,
                    headers: { Accept: 'application/json' },
                },
            );
            if (!response.ok) {
                throw new Error(`Summary request failed: ${response.status}`);
            }
            const data = await response.json();
            const requiredFields = [...metrics];
            if (
                scope === 'operational' ||
                scope === 'outstanding' ||
                scope === 'sisa'
            ) {
                requiredFields.push(
                    ...metrics.map((metric) => `${metric}_amount`),
                    ...metrics.flatMap((metric) => [
                        `${metric}_soon`,
                        `${metric}_overdue`,
                    ]),
                );
            } else if (scope === 'total') {
                requiredFields.push('total_amount');
            }
            if (
                !data?.summary ||
                !requiredFields.every((field) => {
                    const value = data.summary[field];
                    return (
                        (typeof value === 'number' ||
                            (typeof value === 'string' &&
                                value.trim() !== '')) &&
                        Number.isFinite(Number(value))
                    );
                })
            ) {
                throw new Error('Invalid PO IN summary response');
            }
            if (isCurrentRequest()) {
                setSummary((prev) => ({ ...prev, ...data.summary }));
            }
        } catch (error) {
            if (signal.aborted) return;
            if (isCurrentRequest()) {
                setSummaryErrors((prev) => ({ ...prev, ...metricFlags(true) }));
                console.error(`Error fetching PO In ${scope} summary:`, error);
            }
        } finally {
            logPerformanceDuration(`summary ${scope}`, startedAt);
            if (isCurrentRequest()) {
                setSummaryLoading((prev) => ({
                    ...prev,
                    ...metricFlags(false),
                }));
            }
        }
    };

    const fetchPoInSummary = (scopes) => {
        const scopesToFetch = new Set(
            (scopes ?? ['operational', 'realized', 'total']).map((scope) => {
                if (scope === 'outstanding' || scope === 'sisa') {
                    return 'operational';
                }
                return (
                    Object.keys(SUMMARY_SCOPE_METRICS).find((group) =>
                        SUMMARY_SCOPE_METRICS[group].includes(scope),
                    ) ?? scope
                );
            }),
        );
        scopesToFetch.forEach((scope) => {
            if (scope === 'realized') {
                fetchPoInSummaryScope(scope, realizedPeriod);
            } else if (scope === 'total') {
                fetchPoInSummaryScope(
                    scope,
                    dataPoInPeriod,
                    dataPoInStart,
                    dataPoInEnd,
                );
            } else {
                fetchPoInSummaryScope(scope, 'all');
            }
        });
    };

    useEffect(() => {
        fetchPoInSummary();
    }, []);

    useEffect(() => {
        const invalidateRequests = () => {
            ['rows', 'pagination', 'material'].forEach(key => tableAbortControllers.current[key]?.abort());
            rowsRequestId.current += 1;
            paginationRequestId.current += 1;
            materialRequestId.current += 1;
        };
        invalidateRequests();
        if (activeDataTab === 'material') {
            setMaterialLoading(true);
            setMaterialError('');
            setMaterialRows([]);
        } else {
            setTableLoading(true);
            setPaginationLoading(true);
            setTableError('');
            setPaginationError('');
            setPurchaseOrderIns([]);
        }
        const loadTable = () => {
            const isMaterialTab = activeDataTab === 'material';
            const params = {
                search: isMaterialTab ? materialSearch : search,
                per_page: isMaterialTab ? materialPerPage : perPage,
                status: isMaterialTab ? materialStatusFilter : statusFilter,
                dateFilter: isMaterialTab
                    ? materialDateFilter
                    : tableDateFilter,
                startDate: isMaterialTab ? materialStartDate : tableStartDate,
                endDate: isMaterialTab ? materialEndDate : tableEndDate,
                deadlineFilter: isMaterialTab
                    ? materialDeadlineFilter
                    : deadlineFilter,
                page: 1,
                isPartial: true,
            };
            if (activeDataTab === 'material') {
                fetchMaterialData(params);
            } else {
                fetchPoInData(params);
            }
        };

        // Muat tabel langsung saat halaman dibuka. Perubahan filter berikutnya
        // tetap diberi debounce agar pencarian tidak mengirim request per ketik.
        if (isInitialTableLoad.current) {
            isInitialTableLoad.current = false;
            loadTable();
            return invalidateRequests;
        }

        const timer = setTimeout(() => {
            loadTable();
        }, 250);

        return () => {
            clearTimeout(timer);
            invalidateRequests();
        };
    }, [
        search,
        materialSearch,
        perPage,
        materialPerPage,
        statusFilter,
        materialStatusFilter,
        tableDateFilter,
        materialDateFilter,
        tableStartDate,
        tableEndDate,
        materialStartDate,
        materialEndDate,
        deadlineFilter,
        materialDeadlineFilter,
        activeDataTab,
    ]);

    useEffect(() => {
        if (statusFilter === 'realized_pr' || statusFilter === 'realized_do') {
            setDeadlineFilter('all');
        }
    }, [statusFilter]);

    useEffect(() => {
        if (
            materialStatusFilter === 'realized_pr' ||
            materialStatusFilter === 'realized_do'
        ) {
            setMaterialDeadlineFilter('all');
        }
    }, [materialStatusFilter]);

    const realizedPrCount = Number(summary.realized_pr ?? 0);
    const realizedDoCount = Number(summary.realized_do ?? 0);

    // Re-fetch only these specific counts when period changes
    useEffect(() => {
        // Initial request sudah dijalankan bersama kartu ringkasan lainnya.
        // Hindari dua request PR/DO terealisasi saat halaman pertama dibuka.
        if (isInitialRealizedSummaryLoad.current) {
            isInitialRealizedSummaryLoad.current = false;
            return;
        }

        fetchPoInSummary(['realized']);
        // fetchModalData takes care of the actual rows separately because it reacts to realizedPeriod changes
    }, [realizedPeriod]);

    // Re-fetch total summary count and amount when PO IN period filter changes
    useEffect(() => {
        if (isInitialTotalSummaryLoad.current) {
            isInitialTotalSummaryLoad.current = false;
            return;
        }

        if (dataPoInPeriod === 'range' && (!dataPoInStart || !dataPoInEnd)) {
            return;
        }

        fetchPoInSummary(['total']);
    }, [dataPoInPeriod, dataPoInStart, dataPoInEnd]);

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
        const { signal, isCurrent } = modalRequest.current.start();
        setModalLoading(true);
        setModalError('');
        setModalRows([]);
        try {
            const queryParams = new URLSearchParams({
                search: modalSearch,
                per_page:
                    modalPageSize === Infinity ? 'all' : String(modalPageSize),
                status: modalStatus,
                date_filter:
                    activeModal === 'all_data'
                        ? dataPoInPeriod
                        : activeModal === 'realized'
                          ? realizedPeriod
                          : 'all',
                deadline_filter: ['outstanding', 'sisa'].includes(activeModal)
                    ? modalDeadlineFilter
                    : 'all',
                page: String(modalPage),
                is_partial: '1',
            });
            if (activeModal === 'all_data' && dataPoInPeriod === 'range') {
                queryParams.set('start_date', dataPoInStart);
                queryParams.set('end_date', dataPoInEnd);
            }
            const response = await fetch(
                `/marketing/purchase-order-in/data?${queryParams.toString()}`,
                {
                    signal,
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat daftar PO In.',
            );
            if (!Array.isArray(data.purchaseOrderIns) || !data.pagination) {
                throw new Error('Respons daftar PO In tidak lengkap.');
            }
            if (!isCurrent()) return;
            const totalPages = Math.max(
                1,
                Number(data.pagination.total_pages) || 1,
            );
            setModalPagination(data.pagination);
            if (modalPage > totalPages) {
                setModalPage(totalPages);
                return;
            }
            setModalRows(data.purchaseOrderIns);
        } catch (error) {
            if (isCurrent())
                setModalError(error?.message || 'Gagal memuat daftar PO In.');
        } finally {
            if (isCurrent()) setModalLoading(false);
        }
    };

    useEffect(() => {
        modalRequest.current.cancel();
        if (!activeModal) return;
        setModalLoading(true);
        setModalRows([]);
        setModalError('');
        const timer = setTimeout(fetchModalData, 250);
        return () => {
            clearTimeout(timer);
            modalRequest.current.cancel();
        };
    }, [
        activeModal,
        activeModalTab,
        modalSearch,
        modalPage,
        modalPageSize,
        modalDeadlineFilter,
        dataPoInPeriod,
        dataPoInStart,
        dataPoInEnd,
        realizedPeriod,
        modalStatus,
    ]);

    useEffect(() => {
        setModalPage(1);
    }, [
        activeModal,
        activeModalTab,
        dataPoInPeriod,
        dataPoInStart,
        dataPoInEnd,
        realizedPeriod,
    ]);

    const periodLabelMap = {
        today: 'Hari Ini',
        this_week: 'Minggu Ini',
        this_month: 'Bulan Ini',
        this_year: 'Tahun Ini',
        range: 'Range Tanggal',
        all: 'Semua Data',
    };

    const dataPoInCount = useMemo(() => {
        if (dataPoInPeriod === 'all') return Number(summary.total ?? 0);
        const period =
            { this_week: 'week', this_month: 'month', this_year: 'year' }[
                dataPoInPeriod
            ] ?? dataPoInPeriod;
        return Number(summary.data_counts?.[period] ?? 0);
    }, [dataPoInPeriod, summary]);

    const dataPoInTotalAmount = useMemo(() => {
        if (dataPoInPeriod === 'all')
            return Number(
                summary.total_amount ?? summary.data_amounts?.all ?? 0,
            );
        const period =
            { this_week: 'week', this_month: 'month', this_year: 'year' }[
                dataPoInPeriod
            ] ?? dataPoInPeriod;
        return Number(summary.data_amounts?.[period] ?? 0);
    }, [dataPoInPeriod, summary]);

    const modalTotalItems = Number(modalPagination.total ?? 0);
    const modalTotalPages = Math.max(
        1,
        Number(modalPagination.total_pages) || 1,
    );
    const modalDisplayedItems = modalRows;
    const materialRange = getPaginationRange(
        materialPagination,
        materialPerPage,
    );

    const loadDetailModal = async (kodePoin, opts = {}) => {
        const { signal, isCurrent } = detailRequest.current.start();
        const isInitial = Boolean(opts.initial);
        setDetailItems([]);
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
            params.set('_ts', String(Date.now()));

            const response = await fetch(
                `/marketing/purchase-order-in/${encodeURIComponent(kodePoin)}/show?${params.toString()}`,
                {
                    signal,
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await readPoInResponse(
                response,
                'Gagal memuat detail PO In.',
            );
            if (
                !data.header ||
                !Array.isArray(data.items) ||
                !data.pagination
            ) {
                throw new Error('Respons detail PO In tidak lengkap.');
            }
            if (!isCurrent()) return;
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
            if (isCurrent())
                setDetailError(error?.message || 'Gagal memuat detail PO In.');
        } finally {
            if (isCurrent()) {
                if (isInitial) setDetailLoading(false);
                else setDetailTableLoading(false);
            }
        }
    };

    const openDetailModal = (kodePoin) => {
        detailRequest.current.cancel();
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

    // Keep event handlers connected to the current filters and pagination.
    const refreshPoInRef = useRef(null);
    const [pendingRealtimeRefresh, setPendingRealtimeRefresh] = useState(false);
    useEffect(() => {
        refreshPoInRef.current = (background = false) => {
            paginationCache.current.clear();
            fetchPoInSummary();
            if (activeDataTab === 'material') {
                fetchMaterialData({ ...lastMaterialParams.current, background });
            } else {
                fetchPoInData({ ...lastTableParams.current, background });
            }
            if (activeModal) fetchModalData();
            if (isDetailModalOpen && detailKodePoin) {
                loadDetailModal(detailKodePoin, { initial: false });
            }
        };
    });

    useEffect(
        () => subscribeToPoInChanges(
            realtimeChannel,
            () => setPendingRealtimeRefresh(true),
        ),
        [realtimeChannel],
    );

    useEffect(() => {
        // Keep events received during a request pending until that request ends.
        if (
            !pendingRealtimeRefresh || tableLoading || paginationLoading ||
            materialLoading || modalLoading || isDeleting ||
            Object.values(summaryLoading).some(Boolean)
        ) return;
        setPendingRealtimeRefresh(false);
        refreshPoInRef.current?.(true);
    }, [pendingRealtimeRefresh, tableLoading, paginationLoading,
        materialLoading, modalLoading, isDeleting, summaryLoading]);

    const handleDeletePoIn = () => {
        if (!confirmDeleteKode) {
            return;
        }

        if (!canDelete) {
            toastError('Akses delete tidak diizinkan untuk menu ini.');
            setIsConfirmDeleteOpen(false);
            setConfirmDeleteKode('');
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
                onSuccess: (page) => {
                    const flashError = page?.props?.flash?.error;
                    if (flashError) {
                        toastError(flashError);
                        return;
                    }
                    toastSuccess(
                        page?.props?.flash?.success ||
                        'Data PO In berhasil dihapus.',
                    );

                    setActiveModal(null);
                    setIsConfirmDeleteOpen(false);
                    setConfirmDeleteKode('');

                    fetchPoInSummary();
                    fetchPoInData({
                        search,
                        per_page: perPage,
                        status: statusFilter,
                        dateFilter: tableDateFilter,
                        startDate: tableStartDate,
                        endDate: tableEndDate,
                        page: pagination.page || 1,
                        isPartial: true,
                    });
                },
                onError: (errors) => {
                    setIsDeleting(false);
                    toastError(
                        errors?.message ||
                        errors?.error ||
                        'Akses delete tidak diizinkan untuk menu ini.',
                    );
                },
                onFinish: () => {
                    setIsDeleting(false);
                },
            },
        );
    };

    useEffect(() => {
        detailRequest.current.cancel();
        if (!isDetailModalOpen || !detailKodePoin) return;
        const initial = !detailHeader;
        setDetailLoading(initial);
        setDetailTableLoading(!initial);
        setDetailItems([]);
        setDetailError('');
        const timer = setTimeout(() => {
            loadDetailModal(detailKodePoin, {
                page: detailPage,
                perPage: detailPageSize,
                search: detailSearch,
                initial,
            });
        }, 300);
        return () => {
            clearTimeout(timer);
            detailRequest.current.cancel();
        };
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
            <Dialog
                open={isExportModalOpen}
                onOpenChange={setIsExportModalOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Range Tanggal Export</DialogTitle>
                        <DialogDescription>
                            Pilih range berdasarkan Date Doc.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label className="block space-y-2 text-sm">
                            <span className="font-medium">Status</span>
                            <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                value={exportStatus}
                                onChange={(event) =>
                                    setExportStatus(event.target.value)
                                }
                            >
                                <option value="all">Semua Data</option>
                                <option value="outstanding_pr">Belum PR</option>
                                <option value="outstanding_do">Belum DO</option>
                                <option value="sisa_pr">Sisa PR</option>
                                <option value="sisa_do">Sisa DO</option>
                                <option value="realized_pr">PR Selesai</option>
                                <option value="realized_do">DO Selesai</option>
                            </select>
                        </label>
                        <label className="block space-y-2 text-sm">
                            <span className="font-medium">Filter Tanggal</span>
                            <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                value={exportDateFilter}
                                onChange={(event) =>
                                    setExportDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </label>
                        <label className="block space-y-2 text-sm">
                            <span className="font-medium">Filter Deadline</span>
                            <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                value={exportDeadlineFilter}
                                onChange={(event) =>
                                    setExportDeadlineFilter(event.target.value)
                                }
                            >
                                <option value="all">Semua Deadline</option>
                                <option value="soon">≤ 5 Hari</option>
                                <option value="overdue">Lewat Deadline</option>
                            </select>
                        </label>
                        {exportDateFilter === 'range' && (
                            <div className="flex gap-4">
                                <label className="block flex-1 space-y-2 text-sm">
                                    <span className="font-medium">
                                        Tanggal Awal
                                    </span>
                                    <input
                                        type="date"
                                        className="h-10 w-full rounded-md border border-input bg-background px-3"
                                        value={exportStartDate}
                                        max={exportEndDate}
                                        onChange={(event) =>
                                            setExportStartDate(
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                                <label className="block flex-1 space-y-2 text-sm">
                                    <span className="font-medium">
                                        Tanggal Akhir
                                    </span>
                                    <input
                                        type="date"
                                        className="h-10 w-full rounded-md border border-input bg-background px-3"
                                        value={exportEndDate}
                                        min={exportStartDate}
                                        onChange={(event) =>
                                            setExportEndDate(event.target.value)
                                        }
                                    />
                                </label>
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsExportModalOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    exportDateFilter === 'range' &&
                                    (!exportStartDate || !exportEndDate)
                                }
                                onClick={() => {
                                    const params = new URLSearchParams({
                                        status: exportStatus,
                                        date_filter: exportDateFilter,
                                        deadline_filter: exportDeadlineFilter,
                                    });
                                    if (exportDateFilter === 'range') {
                                        params.set(
                                            'start_date',
                                            exportStartDate,
                                        );
                                        params.set('end_date', exportEndDate);
                                    }
                                    window.open(
                                        `/marketing/purchase-order-in/export?${params}`,
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                    setIsExportModalOpen(false);
                                }}
                            >
                                Export
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex h-full min-w-0 flex-1 flex-col gap-4 p-3 sm:gap-5 sm:p-4">
                {/* Header section with explicit hex background for maximum compatibility */}
                <section
                    className="rounded-xl border border-slate-700 bg-[#0f172a] p-4 text-white shadow-lg sm:rounded-2xl sm:p-5"
                    style={{ backgroundColor: '#0f172a' }}
                >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                            <p className="text-xs font-bold tracking-[0.22em] text-[#e2e8f0] uppercase">
                                Marketing Workspace
                            </p>
                            <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                                Purchase Order In (PO In)
                            </h1>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:justify-end">
                            <Button
                                className="w-full border-2 border-slate-700 bg-[#ffffff] font-bold text-[#0f172a] hover:bg-[#f1f5f9] md:w-auto"
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#0f172a',
                                }}
                                onClick={handleOpenTrackingModal}
                            >
                                Tracking PO Customer
                            </Button>
                            <Button
                                className="w-full border-2 border-slate-700 bg-[#ffffff] font-bold text-[#0f172a] hover:bg-[#f1f5f9] md:w-auto"
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#0f172a',
                                }}
                                onClick={() => {
                                    setExportDeadlineFilter(
                                        activeDataTab === 'material'
                                            ? materialDeadlineFilter
                                            : deadlineFilter,
                                    );
                                    setIsExportModalOpen(true);
                                }}
                            >
                                Export Data
                            </Button>
                            <Button
                                className="w-full border-2 border-slate-700 bg-[#ffffff] font-bold text-[#0f172a] hover:bg-[#f1f5f9] md:w-auto"
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#0f172a',
                                }}
                                onClick={() => {
                                    if (!canCreate) {
                                        toastError(
                                            'Akses create tidak diizinkan untuk menu ini.',
                                        );
                                        return;
                                    }

                                    router.visit(
                                        '/marketing/purchase-order-in/create',
                                    );
                                }}
                            >
                                Tambah PO IN
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Card PO IN Outstanding */}
                    <article
                        className={cn(
                            'rounded-xl border p-4 shadow-sm',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-amber-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-amber-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
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
                        <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                    isDark
                                        ? 'text-slate-400'
                                        : 'text-slate-600',
                            )}
                        >
                            PO IN Outstanding
                        </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="Belum PR"
                                value={summary.outstanding_pr ?? 0}
                                grandTotal={summary.outstanding_pr_amount ?? 0}
                                grandTotalHint={
                                    SUMMARY_AMOUNT_HINTS.outstanding
                                }
                                loading={summaryLoading.outstanding_pr}
                                error={summaryErrors.outstanding_pr}
                                onRetry={() =>
                                    fetchPoInSummary(['outstanding'])
                                }
                                soonCount={summary.outstanding_pr_soon}
                                overdueCount={summary.outstanding_pr_overdue}
                                onClick={() =>
                                    openSummaryModal('outstanding', 'pr')
                                }
                            />
                            <SummaryMetric
                                label="Belum DO"
                                value={summary.outstanding_do ?? 0}
                                grandTotal={summary.outstanding_do_amount ?? 0}
                                grandTotalHint={
                                    SUMMARY_AMOUNT_HINTS.outstanding
                                }
                                loading={summaryLoading.outstanding_do}
                                error={summaryErrors.outstanding_do}
                                onRetry={() =>
                                    fetchPoInSummary(['outstanding'])
                                }
                                soonCount={summary.outstanding_do_soon}
                                overdueCount={summary.outstanding_do_overdue}
                                onClick={() =>
                                    openSummaryModal('outstanding', 'do')
                                }
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
                            'rounded-xl border p-4 shadow-sm',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-rose-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-rose-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
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
                        <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                    isDark
                                        ? 'text-slate-400'
                                        : 'text-slate-600',
                            )}
                        >
                            PO IN Sisa
                        </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="Sisa PR"
                                value={summary.sisa_pr ?? 0}
                                grandTotal={summary.sisa_pr_amount ?? 0}
                                grandTotalHint={SUMMARY_AMOUNT_HINTS.sisa_pr}
                                loading={summaryLoading.sisa_pr}
                                error={summaryErrors.sisa_pr}
                                onRetry={() => fetchPoInSummary(['sisa'])}
                                soonCount={summary.sisa_pr_soon}
                                overdueCount={summary.sisa_pr_overdue}
                                onClick={() => openSummaryModal('sisa', 'pr')}
                            />
                            <SummaryMetric
                                label="Sisa DO"
                                value={summary.sisa_do ?? 0}
                                grandTotal={summary.sisa_do_amount ?? 0}
                                grandTotalHint={SUMMARY_AMOUNT_HINTS.sisa_do}
                                loading={summaryLoading.sisa_do}
                                error={summaryErrors.sisa_do}
                                onRetry={() => fetchPoInSummary(['sisa'])}
                                soonCount={summary.sisa_do_soon}
                                overdueCount={summary.sisa_do_overdue}
                                onClick={() => openSummaryModal('sisa', 'do')}
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
                            'rounded-xl border p-4 shadow-sm',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-emerald-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-emerald-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
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
                        <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                    isDark
                                        ? 'text-slate-400'
                                        : 'text-slate-600',
                            )}
                        >
                            PO IN Terealisasi
                        </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <SummaryMetric
                                label="PR Selesai"
                                value={realizedPrCount}
                                loading={summaryLoading.realized_pr}
                                error={summaryErrors.realized_pr}
                                onRetry={() => fetchPoInSummary(['realized'])}
                                onClick={() =>
                                    openSummaryModal('realized', 'pr')
                                }
                            />
                            <SummaryMetric
                                label="DO Selesai"
                                value={realizedDoCount}
                                loading={summaryLoading.realized_do}
                                error={summaryErrors.realized_do}
                                onRetry={() => fetchPoInSummary(['realized'])}
                                onClick={() =>
                                    openSummaryModal('realized', 'do')
                                }
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
                            'cursor-pointer rounded-xl border p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isDark
                                ? 'border-slate-800 bg-[#1e293b] text-white hover:border-blue-400/50'
                                : 'border-slate-200 bg-[#ffffff] text-slate-900 hover:border-blue-400/50',
                        )}
                        style={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Buka data PO IN"
                        onClick={(event) => {
                            if (event.target.closest('button, input, select, label, a')) return;
                            openSummaryModal('all_data');
                        }}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openSummaryModal('all_data');
                            }
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
                            <div className="mb-3 flex flex-wrap gap-2">
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
                        <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-xs font-bold tracking-wide uppercase',
                                    isDark
                                        ? 'text-slate-400'
                                        : 'text-slate-600',
                            )}
                        >
                            Total Data PO IN
                        </p>
                        </div>
                        {summaryErrors.total && !summaryLoading.total ? (
                            <div className="mt-2">
                                <SummaryLoadError
                                    label="Total Data PO IN"
                                    onRetry={() => fetchPoInSummary(['total'])}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <div className="text-2xl font-bold">
                                        {summaryLoading.total ? (
                                            <Skeleton className="h-8 w-12" />
                                        ) : (
                                            dataPoInCount
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'text-xs font-medium',
                                            isDark
                                                ? 'text-slate-400'
                                                : 'text-slate-500',
                                        )}
                                    >
                                        Document
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        'mt-2.5 flex flex-col gap-0.5 border-t pt-2',
                                        isDark
                                            ? 'border-slate-800'
                                            : 'border-slate-200/80',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'text-[10px] font-bold tracking-wider uppercase',
                                            isDark
                                                ? 'text-slate-400'
                                                : 'text-slate-500',
                                        )}
                                    >
                                        Total Nominal PO IN
                                    </span>
                                    <div
                                        className={cn(
                                            'text-sm font-bold',
                                            isDark
                                                ? 'text-emerald-400'
                                                : 'text-emerald-600',
                                        )}
                                    >
                                        {summaryLoading.total ? (
                                            <Skeleton className="h-5 w-32" />
                                        ) : (
                                            `Rp ${formatRupiah(dataPoInTotalAmount)}`
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </article>
                </section>

                <section className="min-w-0 rounded-xl border border-sidebar-border/70 bg-background p-3 shadow-sm sm:rounded-2xl sm:p-4">
                    <div className="mb-4 flex gap-2 border-b border-sidebar-border/70">
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                activeDataTab === 'customer'
                                    ? 'default'
                                    : 'ghost'
                            }
                            onClick={() => setActiveDataTab('customer')}
                        >
                            Data By Customer
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                activeDataTab === 'material'
                                    ? 'default'
                                    : 'ghost'
                            }
                            onClick={() => setActiveDataTab('material')}
                        >
                            Data By Material
                        </Button>
                    </div>
                    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-start">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pr-3 pl-9 text-sm"
                                placeholder={
                                    activeDataTab === 'material'
                                        ? 'Cari Ref PO atau material...'
                                        : 'Cari Nomor Document, Ref PO, atau nama customer...'
                                }
                                value={
                                    activeDataTab === 'material'
                                        ? materialSearch
                                        : search
                                }
                                onChange={(event) =>
                                    activeDataTab === 'material'
                                        ? setMaterialSearch(event.target.value)
                                        : setSearch(event.target.value)
                                }
                            />
                        </div>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                            <select
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                value={
                                    activeDataTab === 'material'
                                        ? materialStatusFilter
                                        : statusFilter
                                }
                                onChange={(event) => {
                                    if (activeDataTab === 'material') {
                                        setMaterialStatusFilter(
                                            event.target.value,
                                        );
                                    } else {
                                        setStatusFilter(event.target.value);
                                    }
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
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                value={
                                    activeDataTab === 'material'
                                        ? materialDateFilter
                                        : tableDateFilter
                                }
                                onChange={(event) =>
                                    activeDataTab === 'material'
                                        ? setMaterialDateFilter(
                                              event.target.value,
                                          )
                                        : setTableDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                            {!['realized_pr', 'realized_do'].includes(
                                activeDataTab === 'material'
                                    ? materialStatusFilter
                                    : statusFilter,
                            ) && (
                                    <select
                                        className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                        value={
                                            activeDataTab === 'material'
                                                ? materialDeadlineFilter
                                                : deadlineFilter
                                        }
                                        onChange={(event) =>
                                            activeDataTab === 'material'
                                            ? setMaterialDeadlineFilter(
                                                  event.target.value,
                                              )
                                            : setDeadlineFilter(
                                                  event.target.value,
                                              )
                                        }
                                    >
                                        <option value="all">Semua Deadline</option>
                                        <option value="soon">
                                            5 Hari Sebelum Deadline
                                        </option>
                                        <option value="overdue">
                                            Lewat Deadline
                                        </option>
                                    </select>
                                )}
                            {(activeDataTab === 'material'
                                ? materialDateFilter
                                : tableDateFilter) === 'range' && (
                                    <>
                                        <input
                                            type="date"
                                            className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                            value={
                                                activeDataTab === 'material'
                                                    ? materialStartDate
                                                    : tableStartDate
                                            }
                                            onChange={(event) =>
                                                activeDataTab === 'material'
                                                ? setMaterialStartDate(
                                                      event.target.value,
                                                  )
                                                : setTableStartDate(
                                                      event.target.value,
                                                  )
                                            }
                                        />
                                        <input
                                            type="date"
                                            className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                            value={
                                                activeDataTab === 'material'
                                                    ? materialEndDate
                                                    : tableEndDate
                                            }
                                            onChange={(event) =>
                                                activeDataTab === 'material'
                                                ? setMaterialEndDate(
                                                      event.target.value,
                                                  )
                                                : setTableEndDate(
                                                      event.target.value,
                                                  )
                                            }
                                        />
                                    </>
                                )}
                            <select
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm lg:w-auto"
                                value={
                                    activeDataTab === 'material'
                                        ? materialPerPage
                                        : perPage
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    if (activeDataTab === 'material') {
                                        setMaterialPerPage(value);
                                    } else {
                                        setPerPage(value);
                                    }
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
                    <div
                        className={cn(
                            'grid gap-3 md:hidden',
                            activeDataTab !== 'customer' && '!hidden',
                        )}
                    >
                        {isMobile &&
                            tableLoading &&
                            purchaseOrderIns.length === 0 && (
                            <>
                                {Array.from({
                                    length:
                                        perPage === 'all'
                                            ? 5
                                            : Number(perPage || 5),
                                }).map((_, index) => (
                                    <div
                                        key={`mobile-skeleton-${index}`}
                                        className="rounded-xl border border-sidebar-border/70 p-3"
                                    >
                                        <Skeleton className="h-4 w-36" />
                                        <Skeleton className="mt-3 h-4 w-full" />
                                        <Skeleton className="mt-2 h-4 w-28" />
                                    </div>
                                ))}
                            </>
                        )}
                        {isMobile && !tableLoading && tableError && (
                            <SummaryLoadError
                                label="tabel PO IN"
                                message={tableError}
                                onRetry={() =>
                                    fetchPoInData(lastTableParams.current)
                                }
                            />
                        )}
                        {isMobile &&
                            !tableLoading &&
                            !tableError &&
                            purchaseOrderIns.length === 0 && (
                            <div className="rounded-xl border border-sidebar-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                                Belum ada data PO In.
                            </div>
                        )}
                        <Profiler
                            id="PO IN customer mobile rows"
                            onRender={reportRenderProfile}
                        >
                            {isMobile &&
                                purchaseOrderIns.map((item, index) =>
                            (() => {
                                const urgency = getRowUrgency(item);
                                return (
                                    <div
                                        key={item.id ?? item.no_poin}
                                        className={cn(
                                            'rounded-xl border p-3 text-sm',
                                            urgency === 'overdue'
                                                ? 'border-red-500/40 bg-red-500/10'
                                                : urgency === 'soon'
                                                    ? 'border-yellow-500/40 bg-yellow-500/10'
                                                    : 'border-sidebar-border/70',
                                        )}
                                    >
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">
                                                    #
                                                    {pagination.per_page ===
                                                        'all'
                                                        ? index + 1
                                                        : (Number(
                                                            pagination.page ||
                                                            1,
                                                        ) -
                                                            1) *
                                                        Number(
                                                            pagination.per_page ||
                                                            5,
                                                        ) +
                                                        index +
                                                        1}
                                                </p>
                                                <p className="mt-1 font-semibold break-words">
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'animate-attention-glow mr-2 inline-block size-4 rounded-full align-middle',
                                                                urgency ===
                                                                    'overdue'
                                                                    ? 'bg-red-600 text-red-600'
                                                                    : 'bg-yellow-500 text-yellow-500',
                                                            )}
                                                            title="Segera dikirim"
                                                            aria-label="Segera dikirim"
                                                        />
                                                    )}
                                                    {item.kode_poin}
                                                </p>
                                                <p className="break-words text-muted-foreground">
                                                    Ref PO:{' '}
                                                            {item.no_poin ||
                                                                '-'}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
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
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <p className="text-xs text-muted-foreground">
                                                    Customer
                                                </p>
                                                <p className="font-medium break-words">
                                                            {item.customer_name ||
                                                                '-'}
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'ml-2 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                                                                urgency ===
                                                                    'overdue'
                                                                    ? 'border-red-600/40 bg-red-600/15 text-red-700'
                                                                    : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800',
                                                            )}
                                                        >
                                                                    Segera
                                                                    dikirim
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Delivery Date
                                                </p>
                                                <p className="font-medium">
                                                    {formatDateDisplay(
                                                        item.delivery_date ||
                                                        '-',
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Date Input
                                                </p>
                                                <p className="font-medium">
                                                    {formatDateDisplay(
                                                        item.created_at ||
                                                        item.date_poin,
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Grand Total
                                                </p>
                                                <p className="font-semibold">
                                                    {formatRupiah(
                                                        item.grand_total,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })(),
                        )}
                        </Profiler>
                    </div>

                    <div
                        className={cn(
                            'hidden overflow-x-auto rounded-xl border border-sidebar-border/70 md:block',
                            activeDataTab !== 'customer' && '!hidden',
                        )}
                    >
                        <table className="w-full min-w-[720px] table-auto text-sm">
                            <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="w-px px-1 py-2 text-left whitespace-nowrap">
                                        No
                                    </th>
                                    <th className="w-px px-1 py-2 text-left whitespace-nowrap">
                                        No Document
                                    </th>
                                    <th className="w-px px-1 py-2 text-left whitespace-nowrap">
                                        Ref PO
                                    </th>
                                    <th className="w-px px-1 py-2 text-left whitespace-nowrap">
                                        Delivery
                                    </th>
                                    <th className="w-px px-1 py-2 text-left whitespace-nowrap">
                                        Input
                                    </th>
                                    <th className="px-1 py-2 text-left">
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
                                    error={isMobile ? '' : tableError}
                                    onRetry={() =>
                                        fetchPoInData(lastTableParams.current)
                                    }
                                    loading={
                                        !isMobile &&
                                        tableLoading &&
                                        purchaseOrderIns.length === 0
                                    }
                                    columns={8}
                                    skeletonRows={
                                        perPage === 'all' ? 5 : Number(perPage)
                                    }
                                    isEmpty={
                                        !isMobile &&
                                        !tableLoading &&
                                        purchaseOrderIns.length === 0
                                    }
                                    emptyTitle="Belum ada data PO In."
                                />
                                <Profiler
                                    id="PO IN customer desktop rows"
                                    onRender={reportRenderProfile}
                                >
                                    {!isMobile &&
                                        purchaseOrderIns.map((item, index) =>
                                    (() => {
                                                const urgency =
                                                    getRowUrgency(item);
                                        return (
                                            <tr
                                                        key={
                                                            item.id ??
                                                            item.no_poin
                                                        }
                                                className={cn(
                                                    'border-t',
                                                            urgency ===
                                                                'overdue'
                                                        ? 'border-red-500/40 bg-red-500/10'
                                                                : urgency ===
                                                                    'soon'
                                                            ? 'border-yellow-500/40 bg-yellow-500/10'
                                                            : 'border-sidebar-border/70',
                                                )}
                                            >
                                                <td className="w-px px-1 py-2 whitespace-nowrap">
                                                    {pagination.per_page ===
                                                        'all'
                                                        ? index + 1
                                                        : (Number(
                                                            pagination.page ||
                                                            1,
                                                        ) -
                                                            1) *
                                                        Number(
                                                            pagination.per_page ||
                                                            5,
                                                        ) +
                                                        index +
                                                        1}
                                                </td>
                                                <td className="w-px px-1 py-2 font-semibold whitespace-nowrap">
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'animate-attention-glow mr-2 inline-block size-4 rounded-full align-middle',
                                                                urgency ===
                                                                    'overdue'
                                                                    ? 'bg-red-600 text-red-600'
                                                                    : 'bg-yellow-500 text-yellow-500',
                                                            )}
                                                            title="Segera dikirim"
                                                            aria-label="Segera dikirim"
                                                        />
                                                    )}
                                                    {item.kode_poin}
                                                </td>
                                                <td className="w-px px-1 py-2 font-semibold whitespace-nowrap">
                                                    {item.no_poin}
                                                </td>
                                                <td className="w-px px-1 py-2 whitespace-nowrap">
                                                    {formatDateDisplay(
                                                        item.delivery_date ||
                                                        '-',
                                                    )}
                                                </td>
                                                <td className="w-px px-1 py-2 whitespace-nowrap">
                                                    {formatDateDisplay(
                                                        item.created_at ||
                                                        item.date_poin,
                                                    )}
                                                </td>
                                                <td className="px-1 py-2">
                                                    {item.customer_name}
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'ml-2 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                                                                urgency ===
                                                                    'overdue'
                                                                    ? 'border-red-600/40 bg-red-600/15 text-red-700'
                                                                    : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800',
                                                            )}
                                                        >
                                                                    Segera
                                                                    dikirim
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                    {formatRupiah(
                                                        item.grand_total,
                                                    )}
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
                                        );
                                    })(),
                                )}
                                </Profiler>
                            </tbody>
                        </table>
                    </div>
                    {activeDataTab === 'customer' &&
                        paginationError &&
                        !paginationLoading && (
                        <div className="mt-3">
                                <SummaryLoadError
                                    label="pagination PO IN"
                                    message={paginationError}
                                    onRetry={() =>
                                        fetchPoInPagination(
                                            lastTableParams.current,
                                        )
                                    }
                                />
                        </div>
                    )}
                    {activeDataTab === 'customer' &&
                        !paginationError &&
                        !tableError &&
                        String(pagination.per_page) !== 'all' &&
                        (paginationLoading ||
                            Number(pagination.total || 0) > 0) && (
                            <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                {paginationLoading ? (
                                    <Skeleton className="h-5 w-48" />
                                ) : (
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (Number(pagination.page || 1) - 1) *
                                            Number(
                                                pagination.per_page || 5,
                                            ) +
                                            1,
                                            Number(pagination.total || 0),
                                        )}
                                        -
                                        {Math.min(
                                            Number(pagination.page || 1) *
                                            Number(
                                                pagination.per_page || 5,
                                            ),
                                            Number(pagination.total || 0),
                                        )}{' '}
                                        dari {pagination.total} data
                                    </span>
                                )}
                                <div className="grid grid-cols-2 items-center gap-2 sm:flex">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            paginationLoading ||
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
                                            }, true)
                                        }
                                    >
                                        Sebelumnya
                                    </Button>
                                    {paginationLoading ? (
                                        <Skeleton className="h-5 w-24" />
                                    ) : (
                                        <span className="col-span-2 text-center sm:col-span-1">
                                            Halaman {pagination.page || 1} /{' '}
                                            {pagination.total_pages || 1}
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            paginationLoading ||
                                            Number(pagination.page || 1) >=
                                            Number(
                                                pagination.total_pages || 1,
                                            )
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
                                            }, true)
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    {activeDataTab === 'material' && (
                        <>
                            <div className="grid gap-3 md:hidden">
                                {isMobile &&
                                materialLoading &&
                                materialRows.length === 0 ? (
                                    Array.from({
                                        length:
                                            materialPerPage === 'all'
                                                ? 5
                                                : Number(materialPerPage || 5),
                                    }).map((_, index) => (
                                        <div
                                            key={`material-skeleton-${index}`}
                                            className="rounded-xl border border-sidebar-border/70 p-3"
                                        >
                                            <Skeleton className="h-4 w-36" />
                                            <Skeleton className="mt-3 h-4 w-full" />
                                            <Skeleton className="mt-2 h-4 w-28" />
                                        </div>
                                    ))
                                ) : isMobile && materialError ? (
                                    <SummaryLoadError
                                        label="tabel material PO IN"
                                        message={materialError}
                                        onRetry={() =>
                                            fetchMaterialData(
                                                lastMaterialParams.current,
                                            )
                                        }
                                    />
                                ) : isMobile && materialRows.length === 0 ? (
                                    <div className="rounded-xl border border-sidebar-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                                        Belum ada data material PO In.
                                    </div>
                                ) : (
                                    isMobile && (
                                        <Profiler
                                            id="PO IN material mobile rows"
                                            onRender={reportRenderProfile}
                                        >
                                            {materialRows.map((item, index) => {
                                                const urgency =
                                                    Number(
                                                        item.sisa_qtydo ?? 0,
                                                    ) === 0
                                            ? null
                                            : getRowUrgency(item);
                                        return (
                                            <div
                                                        key={
                                                            item.id ??
                                                            `${item.no_poin}-${index}`
                                                        }
                                                className={cn(
                                                    'rounded-xl border p-3 text-sm',
                                                            urgency ===
                                                                'overdue'
                                                        ? 'border-red-500/40 bg-red-500/10'
                                                                : urgency ===
                                                                    'soon'
                                                            ? 'border-yellow-500/40 bg-yellow-500/10'
                                                            : 'border-sidebar-border/70',
                                                )}
                                            >
                                                <p className="text-xs text-muted-foreground">
                                                            #
                                                            {(Number(
                                                                materialPagination.page ||
                                                                    1,
                                                            ) -
                                                                1) *
                                                                Number(
                                                                    materialPagination.per_page ||
                                                                        5,
                                                                ) +
                                                                index +
                                                                1}
                                                </p>
                                                <p className="mt-1 font-semibold break-words">
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'animate-attention-glow mr-2 inline-block size-4 rounded-full align-middle',
                                                                        urgency ===
                                                                            'overdue'
                                                                    ? 'bg-red-600 text-red-600'
                                                                    : 'bg-yellow-500 text-yellow-500',
                                                            )}
                                                        />
                                                    )}
                                                            {item.material ||
                                                                '-'}
                                                </p>
                                                <p className="mt-2 break-words text-muted-foreground">
                                                            Ref PO:{' '}
                                                            {item.no_poin ||
                                                                '-'}
                                                </p>
                                                <p className="mt-1 break-words text-muted-foreground">
                                                            Customer:{' '}
                                                            {item.customer_name ||
                                                                '-'}
                                                    {urgency && (
                                                        <span
                                                            className={cn(
                                                                'ml-2 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                                                                        urgency ===
                                                                            'overdue'
                                                                    ? 'border-red-600/40 bg-red-600/15 text-red-700'
                                                                    : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800',
                                                            )}
                                                        >
                                                                    Segera
                                                                    dikirim
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="mt-3 grid grid-cols-3 gap-2">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Qty
                                                                </p>
                                                                <p className="font-medium">
                                                                    {item.qty ??
                                                                        0}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Sisa PR
                                                                </p>
                                                                <p className="font-medium">
                                                                    {item.sisa_qtypr ??
                                                                        item.qty ??
                                                                        0}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Sisa DO
                                                                </p>
                                                                <p className="font-medium">
                                                                    {item.sisa_qtydo ??
                                                                        item.qty ??
                                                                        0}
                                                                </p>
                                                            </div>
                                                </div>
                                                <div className="mt-3 flex gap-2">
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
                                            </div>
                                        );
                                            })}
                                        </Profiler>
                                    )
                                )}
                            </div>
                            <div className="hidden overflow-x-auto rounded-xl border border-sidebar-border/70 md:block">
                                <table className="w-full min-w-[860px] table-auto text-sm">
                                    <thead className="bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="w-px px-2 py-2 text-left whitespace-nowrap">
                                                No
                                            </th>
                                            <th className="px-2 py-2 text-left">
                                                Ref PO
                                            </th>
                                            <th className="px-2 py-2 text-left">
                                                Customer
                                            </th>
                                            <th className="px-2 py-2 text-left">
                                                Material
                                            </th>
                                            <th className="w-28 px-2 py-2 text-right">
                                                Qty
                                            </th>
                                            <th className="w-28 px-2 py-2 text-right">
                                                Sisa PR
                                            </th>
                                            <th className="w-28 px-2 py-2 text-right">
                                                Sisa DO
                                            </th>
                                            <th className="w-24 px-2 py-2 text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <PlainTableStateRows
                                            error={
                                                isMobile ? '' : materialError
                                            }
                                            onRetry={() =>
                                                fetchMaterialData(
                                                    lastMaterialParams.current,
                                                )
                                            }
                                            loading={
                                                !isMobile &&
                                                materialLoading &&
                                                materialRows.length === 0
                                            }
                                            columns={8}
                                            skeletonRows={
                                                materialPerPage === 'all'
                                                    ? 5
                                                    : Number(materialPerPage)
                                            }
                                            isEmpty={
                                                !isMobile &&
                                                !materialLoading &&
                                                materialRows.length === 0
                                            }
                                            emptyTitle="Belum ada data material PO In."
                                        />
                                        <Profiler
                                            id="PO IN material desktop rows"
                                            onRender={reportRenderProfile}
                                        >
                                            {!isMobile &&
                                                materialRows.map(
                                                    (item, index) => {
                                                        const urgency =
                                                            Number(
                                                                item.sisa_qtydo ??
                                                                    0,
                                                            ) === 0
                                                ? null
                                                                : getRowUrgency(
                                                                      item,
                                                                  );
                                            return (
                                                <tr
                                                                key={
                                                                    item.id ??
                                                                    `${item.no_poin}-${index}`
                                                                }
                                                    className={cn(
                                                        'border-t',
                                                                    urgency ===
                                                                        'overdue'
                                                            ? 'border-red-500/40 bg-red-500/10'
                                                                        : urgency ===
                                                                            'soon'
                                                                ? 'border-yellow-500/40 bg-yellow-500/10'
                                                                : 'border-sidebar-border/70',
                                                    )}
                                                >
                                                                <td className="px-2 py-2 whitespace-nowrap">
                                                                    {materialPagination.per_page ===
                                                                    'all'
                                                                        ? index +
                                                                          1
                                                                        : (Number(
                                                                              materialPagination.page ||
                                                                                  1,
                                                                          ) -
                                                                              1) *
                                                                              Number(
                                                                                  materialPagination.per_page ||
                                                                                      5,
                                                                              ) +
                                                                          index +
                                                                          1}
                                                                </td>
                                                    <td className="px-2 py-2 font-semibold whitespace-nowrap">
                                                        {urgency && (
                                                            <span
                                                                className={cn(
                                                                    'animate-attention-glow mr-2 inline-block size-4 rounded-full align-middle',
                                                                                urgency ===
                                                                                    'overdue'
                                                                        ? 'bg-red-600 text-red-600'
                                                                        : 'bg-yellow-500 text-yellow-500',
                                                                )}
                                                            />
                                                        )}
                                                                    {item.no_poin ||
                                                                        '-'}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                                    {item.customer_name ||
                                                                        '-'}
                                                        {urgency && (
                                                            <span
                                                                className={cn(
                                                                    'ml-2 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                                                                                urgency ===
                                                                                    'overdue'
                                                                        ? 'border-red-600/40 bg-red-600/15 text-red-700'
                                                                        : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800',
                                                                )}
                                                            >
                                                                            Segera
                                                                            dikirim
                                                            </span>
                                                        )}
                                                    </td>
                                                                <td className="px-2 py-2">
                                                                    {item.material ||
                                                                        '-'}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {item.qty ??
                                                                        0}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {item.sisa_qtypr ??
                                                                        item.qty ??
                                                                        0}
                                                                </td>
                                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                    {item.sisa_qtydo ??
                                                                        item.qty ??
                                                                        0}
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
                                            );
                                                    },
                                                )}
                                        </Profiler>
                                    </tbody>
                                </table>
                            </div>
                            {!materialError &&
                                (materialLoading ||
                                    Number(materialPagination.total || 0) >
                                        0) && (
                                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                        <span>
                                            {materialLoading
                                                ? 'Memuat...'
                                                : `Menampilkan ${materialRange.from}-${materialRange.to} dari ${materialRange.total} data`}
                                        </span>
                                        {materialPerPage !== 'all' && (
                                            <div className="grid grid-cols-2 items-center gap-2 sm:flex">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        materialLoading ||
                                                        Number(
                                                            materialPagination.page ||
                                                                1,
                                                        ) <= 1
                                                    }
                                                    onClick={() =>
                                                        fetchMaterialData({
                                                            page: Math.max(
                                                                1,
                                                                Number(
                                                                    materialPagination.page ||
                                                                        1,
                                                                ) - 1,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="col-span-2 text-center sm:col-span-1">
                                                    Halaman{' '}
                                                    {materialPagination.page ||
                                                        1}{' '}
                                                    /{' '}
                                                    {materialPagination.total_pages ||
                                                        1}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        materialLoading ||
                                                        Number(
                                                            materialPagination.page ||
                                                                1,
                                                        ) >=
                                                            Number(
                                                                materialPagination.total_pages ||
                                                                    1,
                                                            )
                                                    }
                                                    onClick={() =>
                                                        fetchMaterialData({
                                                            page: Math.min(
                                                                Number(
                                                                    materialPagination.total_pages ||
                                                                        1,
                                                                ),
                                                                Number(
                                                                    materialPagination.page ||
                                                                        1,
                                                                ) + 1,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                        </>
                    )}
                </section>

                <Dialog
                    open={isDetailModalOpen}
                    onOpenChange={(open) => {
                        setIsDetailModalOpen(open);
                        if (!open) {
                            detailRequest.current.cancel();
                            setDetailLoading(false);
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
                                <div className="py-10 text-center">
                                    <SummaryLoadError
                                        label="detail PO IN"
                                        message={detailError}
                                        onRetry={() =>
                                            loadDetailModal(detailKodePoin, {
                                                initial: !detailHeader,
                                            })
                                        }
                                    />
                                </div>
                            )}
                            {!detailLoading && !detailError && detailHeader && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        <div className="min-w-36 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                No Doc
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {detailHeader.kode_poin ?? '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                Ref PO
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
                                        <div className="min-w-40 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground">
                                                PIC PO Customer
                                            </p>
                                            <p className="text-sm font-semibold">
                                                {detailHeader.sender_name ??
                                                    '-'}
                                            </p>
                                        </div>
                                        <div className="min-w-32 rounded-lg border border-sidebar-border/70 px-2 py-1.5">
                                            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                Tgl Buat
                                            </p>
                                            <p className="text-sm font-semibold whitespace-nowrap">
                                                {formatDateDisplay(
                                                    detailHeader.created_at ||
                                                    detailHeader.date_poin,
                                                )}
                                            </p>
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
                                                        className="w-px px-1 py-2 text-left align-middle whitespace-nowrap"
                                                    >
                                                        No
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-1 py-2 text-left align-middle"
                                                    >
                                                        Material
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-px px-1 py-2 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Qty
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-px px-1 py-2 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Price
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-px px-1 py-2 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Total Price
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="px-1 py-2 text-center"
                                                    >
                                                        Sisa
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-1 py-2 text-left align-middle"
                                                    >
                                                        Remark
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                        PR
                                                    </th>
                                                    <th className="w-px px-1 py-2 text-right whitespace-nowrap">
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
                                                                <td className="w-px px-1 py-2 whitespace-nowrap">
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
                                                                <td className="px-1 py-2">
                                                                    {row.material ??
                                                                        '-'}
                                                                </td>
                                                                <td className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                                    {`${row.qty ?? 0} ${row.satuan ?? ''}`}
                                                                </td>
                                                                <td className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                                    {formatRupiah(
                                                                        row.price_po_in ??
                                                                        0,
                                                                    )}
                                                                </td>
                                                                <td className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                                    {formatRupiah(
                                                                        row.total_price_po_in ??
                                                                        0,
                                                                    )}
                                                                </td>
                                                                <td className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                                    {row.sisa_qtypr ??
                                                                        0}
                                                                </td>
                                                                <td className="w-px px-1 py-2 text-right whitespace-nowrap">
                                                                    {row.sisa_qtydo ??
                                                                        0}
                                                                </td>
                                                                <td className="px-1 py-2">
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
                            modalRequest.current.cancel();
                            setModalLoading(false);
                            setModalRows([]);
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
                            <div className="flex flex-wrap items-center gap-4">
                                {['outstanding', 'sisa'].includes(
                                    activeModal,
                                ) && (
                                        <select
                                            className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                            value={modalDeadlineFilter}
                                            onChange={(event) => {
                                                setModalDeadlineFilter(
                                                    event.target.value,
                                                );
                                                setModalPage(1);
                                            }}
                                        >
                                            <option value="all">
                                                Semua Deadline
                                            </option>
                                            <option value="soon">≤ 5 Hari</option>
                                            <option value="overdue">
                                                Lewat Deadline
                                            </option>
                                        </select>
                                    )}
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
                        </div>

                        <div className="max-h-[78vh] overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="w-12 px-2 py-2 text-left">
                                            No
                                        </th>
                                        <th className="w-44 px-2 py-2 text-left">
                                            No Doc
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
                                        error={modalError}
                                        onRetry={fetchModalData}
                                        columns={7}
                                        loading={modalLoading}
                                        isEmpty={
                                            !modalLoading &&
                                            modalDisplayedItems.length === 0
                                        }
                                        emptyTitle="Tidak ada data."
                                        skeletonRows={
                                            modalPageSize === Infinity
                                                ? 5
                                                : modalPageSize
                                        }
                                    />

                                    {modalDisplayedItems.map((item, index) => (
                                        <tr
                                            key={`${item.no_do || item.no_poin}-${index}`}
                                            className={cn(
                                                'border-t',
                                                getRowUrgency(item) ===
                                                    'overdue'
                                                    ? 'border-red-500/40 bg-red-500/10'
                                                    : getRowUrgency(item) ===
                                                        'soon'
                                                        ? 'border-yellow-500/40 bg-yellow-500/10'
                                                        : 'border-sidebar-border/70',
                                            )}
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
                                                {activeModal === 'realized' &&
                                                    activeModalTab === 'do'
                                                    ? item.no_do
                                                    : activeModal ===
                                                            'realized' &&
                                                        activeModalTab === 'pr'
                                                      ? item.no_pr ||
                                                        item.kode_poin
                                                        : item.kode_poin}
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
                                                {getRowUrgency(item) && (
                                                    <span
                                                        className={cn(
                                                            'ml-2 inline-block rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                                                            getRowUrgency(
                                                                item,
                                                            ) === 'overdue'
                                                                ? 'border-red-600/40 bg-red-600/15 text-red-700'
                                                                : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800',
                                                        )}
                                                    >
                                                        Segera dikirim
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {formatRupiah(item.grand_total)}
                                            </td>
                                            <td className="px-2 py-2">
                                                {activeModal ===
                                                    'outstanding' ||
                                                    activeModal === 'sisa' ? (
                                                    <div className="flex items-center gap-2">
                                                        {((activeModal ===
                                                            'outstanding' &&
                                                            activeModalTab ===
                                                            'pr') ||
                                                            !Number(
                                                                item.has_do ??
                                                                0,
                                                            ) ||
                                                            activeModal ===
                                                            'sisa') && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        if (
                                                                            !canUpdate
                                                                        ) {
                                                                            toastError(
                                                                                'Akses edit tidak diizinkan untuk menu ini.',
                                                                            );
                                                                            return;
                                                                        }

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
                                                            )}
                                                        {activeModal ===
                                                            'outstanding' && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    title="Hapus"
                                                                    onClick={() => {
                                                                        if (
                                                                            !canDelete
                                                                        ) {
                                                                            toastError(
                                                                                'Akses delete tidak diizinkan untuk menu ini.',
                                                                            );
                                                                            return;
                                                                        }

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
                                {modalLoading
                                    ? 'Memuat...'
                                    : modalError
                                      ? 'Jumlah data belum tersedia'
                                      : `Total ${modalTotalItems} data`}
                            </p>
                            {modalPageSize !== Infinity && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            modalLoading ||
                                            Boolean(modalError) ||
                                            modalPage === 1
                                        }
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
                                        disabled={
                                            modalLoading ||
                                            Boolean(modalError) ||
                                            modalPage >= modalTotalPages
                                        }
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

                <TrackingDialog
                    open={isTrackingModalOpen}
                    onOpenChange={setIsTrackingModalOpen}
                    onError={toastError}
                                />
            </div>
        </>
    );
}

PurchaseOrderInIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
