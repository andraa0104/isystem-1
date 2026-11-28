import { MenuAction } from '@/components/menu-action';
import { canAccessMenuAction } from '@/lib/menu-permissions';
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
    BarChart3,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ClipboardCheck,
    Download,
    Eye,
    Filter,
    Package,
    Pencil,
    Plus,
    Printer,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    Truck,
    Users,
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
    if (daysRemaining <= 7) return 'soon';
    return null;
};

const getRowUrgency = (item) => {
    if (!item?.delivery_date) return null;
    if (
        item.sisa_qtydo !== undefined &&
        item.sisa_qtydo !== null &&
        item.sisa_qtydo !== '' &&
        Number(item.sisa_qtydo) === 0
    ) {
        return null;
    }
    return getDeliveryUrgency(item.delivery_date);
};

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
    const menuKey = 'Marketing:Purchase Order In (PO In)';
    const canCreate = canAccessMenuAction(user, menuKey, 'create');
    const canUpdate = canAccessMenuAction(user, menuKey, 'update');
    const canDelete = canAccessMenuAction(user, menuKey, 'delete');

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

    const handleResetCustomerFilters = () => {
        setSearch('');
        setStatusFilter('outstanding_do');
        setTableDateFilter('all');
        setTableStartDate('');
        setTableEndDate('');
        setDeadlineFilter('all');
        setPerPage('5');
    };

    const handleResetMaterialFilters = () => {
        setMaterialSearch('');
        setMaterialStatusFilter('outstanding_do');
        setMaterialDateFilter('all');
        setMaterialStartDate('');
        setMaterialEndDate('');
        setMaterialDeadlineFilter('all');
        setMaterialPerPage('5');
    };

    const isCustomerFiltered = Boolean(
        search ||
        statusFilter !== 'outstanding_do' ||
        tableDateFilter !== 'all' ||
        tableStartDate ||
        tableEndDate ||
        deadlineFilter !== 'all' ||
        perPage !== '5'
    );

    const isMaterialFiltered = Boolean(
        materialSearch ||
        materialStatusFilter !== 'outstanding_do' ||
        materialDateFilter !== 'all' ||
        materialStartDate ||
        materialEndDate ||
        materialDeadlineFilter !== 'all' ||
        materialPerPage !== '5'
    );
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
                <DialogContent className="sm:max-w-md rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xl">
                    <DialogHeader className="border-b border-sidebar-border/60 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Download className="size-4" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Export Data PO Customer
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Unduh rekapan dokumen PO Customer dalam format Excel.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-3.5 py-2 text-xs">
                        <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Status PO
                            </label>
                            <select
                                className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none"
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
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Periode Tanggal
                            </label>
                            <select
                                className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none"
                                value={exportDateFilter}
                                onChange={(event) =>
                                    setExportDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Rentang Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Filter Deadline
                            </label>
                            <select
                                className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none"
                                value={exportDeadlineFilter}
                                onChange={(event) =>
                                    setExportDeadlineFilter(event.target.value)
                                }
                            >
                                <option value="all">Semua Deadline</option>
                                <option value="soon">≤ 5 Hari</option>
                                <option value="overdue">Lewat Deadline</option>
                            </select>
                        </div>

                        {exportDateFilter === 'range' && (
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                        Tanggal Awal
                                    </label>
                                    <input
                                        type="date"
                                        className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background px-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                                        value={exportStartDate}
                                        max={exportEndDate}
                                        onChange={(event) =>
                                            setExportStartDate(
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                        Tanggal Akhir
                                    </label>
                                    <input
                                        type="date"
                                        className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background px-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                                        value={exportEndDate}
                                        min={exportStartDate}
                                        onChange={(event) =>
                                            setExportEndDate(event.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-sidebar-border/60">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-lg text-xs font-semibold"
                                onClick={() => setIsExportModalOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                                style={{ backgroundColor: '#059669', color: '#ffffff' }}
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
                                        params.set('start_date', exportStartDate);
                                        params.set('end_date', exportEndDate);
                                    }
                                    window.open(
                                        `/marketing/purchase-order-in/export?${params.toString()}`,
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                    setIsExportModalOpen(false);
                                }}
                            >
                                <Download className="size-3.5" />
                                <span>Export Excel</span>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex h-full min-w-0 flex-1 flex-col gap-3.5 p-3 sm:gap-4 sm:p-4">
                {/* ─── 1. Header Banner & Action Bar ────────────────────────────── */}
                <section className="rounded-xl border border-sidebar-border/70 bg-card p-4 sm:p-5 shadow-xs">
                    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <ClipboardCheck className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                                    Purchase Order In (PO In)
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Kelola pesanan masuk customer, kontrol sisa outstanding PR/DO, dan pantau status realisasi.
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons & Summary Toggle (Fully Responsive on 720px screens) */}
                        <div className="flex flex-wrap items-center gap-2">

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-sidebar-border/70 bg-background text-xs font-semibold shadow-xs hover:bg-muted/60"
                                onClick={handleOpenTrackingModal}
                            >
                                <Truck className="size-3.5 text-muted-foreground" />
                                <span>Tracking PO</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-sidebar-border/70 bg-background text-xs font-semibold shadow-xs hover:bg-muted/60"
                                onClick={() => {
                                    setExportDeadlineFilter(
                                        activeDataTab === 'material'
                                            ? materialDeadlineFilter
                                            : deadlineFilter,
                                    );
                                    setIsExportModalOpen(true);
                                }}
                            >
                                <Download className="size-3.5 text-muted-foreground" />
                                <span>Export Data</span>
                            </Button>
                            <MenuAction
                                action="create"
                                type="button"
                                className="inline-flex items-center justify-center h-9 px-4 gap-1.5 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                                style={{ backgroundColor: '#059669', color: '#ffffff' }}
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
                                <Plus className="size-4" />
                                <span>Tambah PO IN</span>
                            </MenuAction>
                        </div>
                    </div>
                </section>

                {/* ─── 2. KPI Summary Metric Cards ───────────────────────────────── */}
                
                    <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Card 1: PO IN Outstanding */}
                    <article className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 sm:p-4 shadow-xs hover:shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="inline-flex items-center justify-center size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <ClipboardCheck className="size-4" />
                                </span>
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                    Outstanding
                                </span>
                            </div>
                            <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                                PO IN Outstanding
                            </p>
                            <div className="mt-2.5 grid grid-cols-2 gap-2">
                                <SummaryMetric
                                    label="Belum PR"
                                    value={summary.outstanding_pr ?? 0}
                                    grandTotal={summary.outstanding_pr_amount ?? 0}
                                    grandTotalHint={SUMMARY_AMOUNT_HINTS.outstanding}
                                    loading={summaryLoading.outstanding_pr}
                                    error={summaryErrors.outstanding_pr}
                                    onRetry={() => fetchPoInSummary(['outstanding'])}
                                    soonCount={summary.outstanding_pr_soon}
                                    overdueCount={summary.outstanding_pr_overdue}
                                    onClick={() => openSummaryModal('outstanding', 'pr')}
                                />
                                <SummaryMetric
                                    label="Belum DO"
                                    value={summary.outstanding_do ?? 0}
                                    grandTotal={summary.outstanding_do_amount ?? 0}
                                    grandTotalHint={SUMMARY_AMOUNT_HINTS.outstanding}
                                    loading={summaryLoading.outstanding_do}
                                    error={summaryErrors.outstanding_do}
                                    onRetry={() => fetchPoInSummary(['outstanding'])}
                                    soonCount={summary.outstanding_do_soon}
                                    overdueCount={summary.outstanding_do_overdue}
                                    onClick={() => openSummaryModal('outstanding', 'do')}
                                />
                            </div>
                        </div>
                        <p className="mt-2.5 text-[11px] text-muted-foreground/80 border-t border-sidebar-border/40 pt-2">
                            Dipisah berdasarkan dokumen yang belum dibuat
                        </p>
                    </article>

                    {/* Card 2: PO IN Sisa */}
                    <article className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 sm:p-4 shadow-xs hover:shadow-sm hover:border-rose-500/40 transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="inline-flex items-center justify-center size-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <AlertCircle className="size-4" />
                                </span>
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400 border border-rose-500/20">
                                    Sisa Parsial
                                </span>
                            </div>
                            <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                                PO IN Sisa
                            </p>
                            <div className="mt-2.5 grid grid-cols-2 gap-2">
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
                        </div>
                        <p className="mt-2.5 text-[11px] text-muted-foreground/80 border-t border-sidebar-border/40 pt-2">
                            Sudah sebagian dibuat, masih ada sisa material
                        </p>
                    </article>

                    {/* Card 3: PO IN Terealisasi */}
                    <article className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 sm:p-4 shadow-xs hover:shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="inline-flex items-center justify-center size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <ShieldCheck className="size-4" />
                                </span>
                                <select
                                    className="h-7 rounded-md border border-sidebar-border/70 bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:border-emerald-500"
                                    value={realizedPeriod}
                                    onChange={(event) => setRealizedPeriod(event.target.value)}
                                >
                                    <option value="today">Hari Ini</option>
                                    <option value="this_week">Minggu Ini</option>
                                    <option value="this_month">Bulan Ini</option>
                                    <option value="this_year">Tahun Ini</option>
                                    <option value="all">Semua Data</option>
                                </select>
                            </div>
                            <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                                PO IN Terealisasi
                            </p>
                            <div className="mt-2.5 grid grid-cols-2 gap-2">
                                <SummaryMetric
                                    label="PR Selesai"
                                    value={realizedPrCount}
                                    loading={summaryLoading.realized_pr}
                                    error={summaryErrors.realized_pr}
                                    onRetry={() => fetchPoInSummary(['realized'])}
                                    onClick={() => openSummaryModal('realized', 'pr')}
                                />
                                <SummaryMetric
                                    label="DO Selesai"
                                    value={realizedDoCount}
                                    loading={summaryLoading.realized_do}
                                    error={summaryErrors.realized_do}
                                    onRetry={() => fetchPoInSummary(['realized'])}
                                    onClick={() => openSummaryModal('realized', 'do')}
                                />
                            </div>
                        </div>
                        <p className="mt-2.5 text-[11px] text-muted-foreground/80 border-t border-sidebar-border/40 pt-2 truncate">
                            Semua material selesai DO — {periodLabelMap[realizedPeriod]}
                        </p>
                    </article>

                    {/* Card 4: Total Data PO IN */}
                    <article
                        className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 sm:p-4 shadow-xs hover:shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="inline-flex items-center justify-center size-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                    <Search className="size-4" />
                                </span>
                                <select
                                    className="h-7 rounded-md border border-sidebar-border/70 bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:border-indigo-500"
                                    value={dataPoInPeriod}
                                    onChange={(event) => setDataPoInPeriod(event.target.value)}
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
                                <div className="mb-2.5 flex items-center gap-1.5">
                                    <input
                                        type="date"
                                        className="h-7 w-full rounded-md border border-sidebar-border/70 bg-background px-1.5 text-[10px] text-foreground"
                                        value={dataPoInStart}
                                        onChange={(e) => setDataPoInStart(e.target.value)}
                                    />
                                    <span className="text-[10px] text-muted-foreground">-</span>
                                    <input
                                        type="date"
                                        className="h-7 w-full rounded-md border border-sidebar-border/70 bg-background px-1.5 text-[10px] text-foreground"
                                        value={dataPoInEnd}
                                        onChange={(e) => setDataPoInEnd(e.target.value)}
                                    />
                                </div>
                            )}
                            <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                                Total Data PO IN
                            </p>
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
                                        <div className="text-2xl font-bold tracking-tight text-foreground">
                                            {summaryLoading.total ? (
                                                <Skeleton className="h-8 w-12" />
                                            ) : (
                                                dataPoInCount
                                            )}
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Dokumen
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border/50 pt-1.5">
                                        <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                                            Total Nominal PO IN
                                        </span>
                                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                            {summaryLoading.total ? (
                                                <Skeleton className="h-5 w-32" />
                                            ) : (
                                                `Rp ${formatRupiah(dataPoInTotalAmount)}`
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <p className="mt-2.5 text-[11px] text-muted-foreground/80 border-t border-sidebar-border/40 pt-2">
                            Klik card untuk melihat seluruh data
                        </p>
                    </article>
                </section>

                {/* ─── 3. Main Data Container ───────────────────────────────────── */}
                <section className="min-w-0 rounded-xl border border-sidebar-border/70 bg-card p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5">
                    {/* Top Row: Segmented Tab Switcher + Search Bar & Live Sync Indicator */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-sidebar-border/60 pb-3.5">
                        {/* Segmented Tab Switcher */}
                        <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-sidebar-border/60 shadow-xs">
                            <button
                                type="button"
                                onClick={() => setActiveDataTab('customer')}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                                    activeDataTab === 'customer'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                )}
                                style={
                                    activeDataTab === 'customer'
                                        ? { backgroundColor: '#059669', color: '#ffffff' }
                                        : undefined
                                }
                            >
                                <Users className="size-3.5" />
                                <span>PO By Customer</span>
                                {Number(pagination.total || 0) > 0 && (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.2 text-[10px] font-bold tabular-nums',
                                            activeDataTab === 'customer'
                                                ? 'bg-white/20 text-white'
                                                : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {pagination.total}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveDataTab('material')}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                                    activeDataTab === 'material'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                )}
                                style={
                                    activeDataTab === 'material'
                                        ? { backgroundColor: '#059669', color: '#ffffff' }
                                        : undefined
                                }
                            >
                                <Package className="size-3.5" />
                                <span>PO By Material</span>
                                {Number(materialPagination.total || 0) > 0 && (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.2 text-[10px] font-bold tabular-nums',
                                            activeDataTab === 'material'
                                                ? 'bg-white/20 text-white'
                                                : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {materialPagination.total}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search Input & Realtime Indicator */}
                        <div className="flex items-center gap-2.5 flex-1 max-w-md lg:justify-end">
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                                <input
                                    type="search"
                                    className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background pl-8.5 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                                    placeholder={
                                        activeDataTab === 'material'
                                            ? 'Cari Ref PO atau nama material...'
                                            : 'Cari No Document, Ref PO, atau customer...'
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
                                {(activeDataTab === 'material'
                                    ? materialSearch
                                    : search) && (
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground/60 hover:text-foreground cursor-pointer"
                                        onClick={() =>
                                            activeDataTab === 'material'
                                                ? setMaterialSearch('')
                                                : setSearch('')
                                        }
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </div>
                            <div
                                className="hidden sm:flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 select-none"
                                title="Realtime data sync aktif"
                            >
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Live</span>
                            </div>
                        </div>
                    </div>

                    {/* Dedicated Filter Toolbar Strip (Lighter, Clear Labels, Reset Action) */}
                    <div className="rounded-lg border border-sidebar-border/60 bg-muted/20 p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                        {/* Filter Controls Group */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 font-semibold text-muted-foreground mr-0.5">
                                <Filter className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[11px]">Filter:</span>
                            </div>

                            {/* Status Dropdown */}
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground hidden sm:inline">Status:</span>
                                <select
                                    className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                                    }}
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="outstanding_pr">Belum PR</option>
                                    <option value="outstanding_do">Belum DO</option>
                                    <option value="sisa_pr">Sisa PR</option>
                                    <option value="sisa_do">Sisa DO</option>
                                    <option value="realized_pr">PR Selesai</option>
                                    <option value="realized_do">DO Selesai</option>
                                </select>
                            </div>

                            {/* Periode Dropdown */}
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground hidden sm:inline">Periode:</span>
                                <select
                                    className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                                    <option value="range">Rentang Tanggal</option>
                                    <option value="all">Semua Periode</option>
                                </select>
                            </div>

                            {/* Range Date Inputs (if Rentang Tanggal) */}
                            {(activeDataTab === 'material'
                                ? materialDateFilter
                                : tableDateFilter) === 'range' && (
                                <div className="flex items-center gap-1 bg-background rounded-md border border-sidebar-border/70 px-1.5 py-0.5">
                                    <Calendar className="size-3 text-muted-foreground" />
                                    <input
                                        type="date"
                                        className="h-7 rounded border-none bg-transparent px-1 text-xs text-foreground focus:outline-none"
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
                                    <span className="text-muted-foreground">-</span>
                                    <input
                                        type="date"
                                        className="h-7 rounded border-none bg-transparent px-1 text-xs text-foreground focus:outline-none"
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
                                </div>
                            )}

                            {/* Deadline Dropdown (if not realized) */}
                            {!['realized_pr', 'realized_do'].includes(
                                activeDataTab === 'material'
                                    ? materialStatusFilter
                                    : statusFilter,
                            ) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-muted-foreground hidden sm:inline">Deadline:</span>
                                    <select
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                                            ≤ 5 Hari
                                        </option>
                                        <option value="overdue">
                                            Lewat Deadline
                                        </option>
                                    </select>
                                </div>
                            )}

                            {/* Quick Reset Filter Button */}
                            {((activeDataTab === 'customer' && isCustomerFiltered) ||
                                (activeDataTab === 'material' && isMaterialFiltered)) && (
                                <button
                                    type="button"
                                    onClick={
                                        activeDataTab === 'customer'
                                            ? handleResetCustomerFilters
                                            : handleResetMaterialFilters
                                    }
                                    className="inline-flex items-center gap-1 h-8 px-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                                    title="Kembalikan semua filter ke awal"
                                >
                                    <RotateCcw className="size-3" />
                                    <span>Reset</span>
                                </button>
                            )}
                        </div>

                        {/* Page Size Control */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <span className="text-[11px] text-muted-foreground">Tampilkan:</span>
                            <select
                                className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs font-medium text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
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
                                }}
                            >
                                <option value="5">5 baris</option>
                                <option value="10">10 baris</option>
                                <option value="25">25 baris</option>
                                <option value="50">50 baris</option>
                                <option value="all">Semua baris</option>
                            </select>
                        </div>
                    </div>

                    {/* ─── Customer Data View ─────────────────────────────── */}
                    {/* Mobile Card View (Customer) */}
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
                                        className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 space-y-2.5"
                                    >
                                        <Skeleton className="h-4 w-36" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-28" />
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
                            <div className="rounded-xl border border-sidebar-border/70 bg-card px-4 py-8 text-center text-xs text-muted-foreground">
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
                                const itemIndex =
                                    pagination.per_page === 'all'
                                        ? index + 1
                                        : (Number(pagination.page || 1) - 1) *
                                              Number(pagination.per_page || 5) +
                                          index +
                                          1;
                                return (
                                    <div
                                        key={item.id ?? item.no_poin}
                                        className={cn(
                                            'rounded-xl border p-3.5 text-xs shadow-xs transition-all',
                                            urgency === 'overdue'
                                                ? 'border-rose-500/40 bg-rose-500/5 border-l-4 border-l-rose-500'
                                                : urgency === 'soon'
                                                    ? 'border-amber-500/40 bg-amber-500/5 border-l-4 border-l-amber-500'
                                                    : 'border-sidebar-border/70 bg-card',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2 border-b border-sidebar-border/40 pb-2 mb-2.5">
                                            <div className="min-w-0">
                                                <span className="text-[10px] text-muted-foreground font-semibold">
                                                    #{itemIndex}
                                                </span>
                                                <p className="font-bold text-sm text-foreground break-words">
                                                    {item.kode_poin}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Ref PO: <span className="font-medium text-foreground">{item.no_poin || '-'}</span>
                                                </p>
                                            </div>
                                            {urgency && (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0',
                                                        urgency === 'overdue'
                                                            ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                                            : 'bg-amber-500/15 text-amber-600 border border-amber-500/30',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'size-1.5 rounded-full animate-ping',
                                                            urgency === 'overdue'
                                                                ? 'bg-rose-500'
                                                                : 'bg-amber-500',
                                                        )}
                                                    />
                                                    <span>Segera dikirim</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                                            <div>
                                                <span className="text-muted-foreground">Customer:</span>
                                                <p className="font-semibold text-foreground truncate">
                                                    {item.customer_name || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Delivery:</span>
                                                <p className="font-medium text-foreground">
                                                    {formatDateDisplay(item.delivery_date || '-')}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Tanggal Input:</span>
                                                <p className="font-medium text-foreground">
                                                    {formatDateDisplay(item.created_at || item.date_poin)}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Grand Total:</span>
                                                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    Rp {formatRupiah(item.grand_total)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 border-t border-sidebar-border/40 pt-2.5">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                                                onClick={() =>
                                                    openDetailModal(item.kode_poin)
                                                }
                                            >
                                                <Eye className="size-3.5" />
                                                <span>Detail</span>
                                            </Button>
                                            <a
                                                href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-semibold shadow-xs hover:bg-muted/60"
                                            >
                                                <Printer className="size-3.5" />
                                                <span>Print</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })(),
                        )}
                        </Profiler>
                    </div>

                    {/* Desktop Table View (Customer) */}
                    <div
                        className={cn(
                            'hidden overflow-x-auto rounded-xl border border-sidebar-border/70 md:block',
                            activeDataTab !== 'customer' && '!hidden',
                        )}
                    >
                        <table className="w-full text-xs border-collapse">
                            <thead className="bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b-2 border-slate-300 dark:border-slate-700">
                                <tr>
                                    <th className="w-10 px-2 py-2.5 text-center whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        No
                                    </th>
                                    <th className="w-px px-2 py-2.5 text-left whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        No Document
                                    </th>
                                    <th className="w-px px-2 py-2.5 text-left whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        Ref PO
                                    </th>
                                    <th className="w-px px-2 py-2.5 text-left whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        Delivery
                                    </th>
                                    <th className="w-px px-2 py-2.5 text-left whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        Input
                                    </th>
                                    <th className="px-2 py-2.5 text-left border-b border-slate-300 dark:border-slate-700">
                                        Customer
                                    </th>
                                    <th className="w-32 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        Grand Total
                                    </th>
                                    <th className="w-20 px-2 py-2.5 text-center whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
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
                                                    'border-b border-slate-300 dark:border-slate-700 transition-colors hover:bg-muted/40',
                                                    urgency === 'overdue'
                                                        ? 'bg-red-500/10 border-l-4 border-l-red-500'
                                                        : urgency === 'soon'
                                                            ? 'bg-yellow-500/10 border-l-4 border-l-yellow-500'
                                                            : '',
                                                )}
                                            >
                                                <td className="w-10 px-2 py-2.5 text-center text-muted-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
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
                                                <td className="w-px px-2 py-2.5 font-semibold text-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                    <span>{item.kode_poin}</span>
                                                </td>
                                                <td className="w-px px-2 py-2.5 font-medium text-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                    {item.no_poin || '-'}
                                                </td>
                                                <td className="w-px px-2 py-2.5 text-muted-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                    {formatDateDisplay(
                                                        item.delivery_date ||
                                                        '-',
                                                    )}
                                                </td>
                                                <td className="w-px px-2 py-2.5 text-muted-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                    {formatDateDisplay(
                                                        item.created_at ||
                                                        item.date_poin,
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5 font-medium text-foreground border-b border-slate-300 dark:border-slate-700">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>{item.customer_name}</span>
                                                        {urgency && (
                                                            <span
                                                                className={cn(
                                                                    'rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold shrink-0',
                                                                    urgency === 'overdue'
                                                                        ? 'border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400'
                                                                        : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800 dark:text-yellow-400',
                                                                )}
                                                            >
                                                                Segera dikirim
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-32 px-2 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                    Rp {formatRupiah(item.grand_total)}
                                                </td>
                                                <td className="w-20 px-2 py-2.5 whitespace-nowrap text-center border-b border-slate-300 dark:border-slate-700">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 rounded-md border-sidebar-border/70 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                                                            onClick={() =>
                                                                openDetailModal(
                                                                    item.kode_poin,
                                                                )
                                                            }
                                                            title="Lihat Detail"
                                                        >
                                                            <Eye className="size-3.5 text-muted-foreground" />
                                                        </Button>
                                                        <a
                                                            href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border/70 bg-background text-muted-foreground shadow-xs transition-colors hover:bg-teal-500/15 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                                                            title="Print Dokumen"
                                                        >
                                                            <Printer className="size-3.5" />
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

                    {/* Pagination (Customer) */}
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
                            <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground border-t border-sidebar-border/40 pt-3">
                                {paginationLoading ? (
                                    <Skeleton className="h-5 w-48" />
                                ) : (
                                    <span>
                                        Menampilkan{' '}
                                        <span className="font-semibold text-foreground">
                                            {Math.min(
                                                (Number(pagination.page || 1) - 1) *
                                                    Number(pagination.per_page || 5) +
                                                    1,
                                                Number(pagination.total || 0),
                                            )}
                                        </span>
                                        -
                                        <span className="font-semibold text-foreground">
                                            {Math.min(
                                                Number(pagination.page || 1) *
                                                    Number(pagination.per_page || 5),
                                                Number(pagination.total || 0),
                                            )}
                                        </span>{' '}
                                        dari{' '}
                                        <span className="font-semibold text-foreground">
                                            {pagination.total}
                                        </span>{' '}
                                        data
                                    </span>
                                )}
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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
                                        <Skeleton className="h-5 w-20" />
                                    ) : (
                                        <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
                                            {pagination.page || 1} /{' '}
                                            {pagination.total_pages || 1}
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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
                    {/* ─── Material Data View ─────────────────────────────── */}
                    {activeDataTab === 'material' && (
                        <>
                            {/* Mobile Card View (Material) */}
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
                                            className="rounded-xl border border-sidebar-border/70 bg-card p-3.5 space-y-2.5"
                                        >
                                            <Skeleton className="h-4 w-36" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-28" />
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
                                    <div className="rounded-xl border border-sidebar-border/70 bg-card px-4 py-8 text-center text-xs text-muted-foreground">
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
                                                const itemIndex =
                                                    (Number(
                                                        materialPagination.page ||
                                                            1,
                                                    ) -
                                                        1) *
                                                        Number(
                                                            materialPagination.per_page ||
                                                                5,
                                                        ) +
                                                    index +
                                                    1;
                                                return (
                                                    <div
                                                        key={
                                                            item.id ??
                                                            `${item.no_poin}-${index}`
                                                        }
                                                        className={cn(
                                                            'rounded-xl border p-3.5 text-xs shadow-xs transition-all',
                                                            urgency === 'overdue'
                                                                ? 'border-rose-500/40 bg-rose-500/5 border-l-4 border-l-rose-500'
                                                                : urgency === 'soon'
                                                                    ? 'border-amber-500/40 bg-amber-500/5 border-l-4 border-l-amber-500'
                                                                    : 'border-sidebar-border/70 bg-card',
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-2 border-b border-sidebar-border/40 pb-2 mb-2.5">
                                                            <div className="min-w-0">
                                                                <span className="text-[10px] text-muted-foreground font-semibold">
                                                                    #{itemIndex}
                                                                </span>
                                                                <p className="font-bold text-sm text-foreground break-words">
                                                                    {item.material || '-'}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    Ref PO: <span className="font-medium text-foreground">{item.no_poin || '-'}</span>
                                                                </p>
                                                            </div>
                                                            {urgency && (
                                                                <span
                                                                    className={cn(
                                                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0',
                                                                        urgency === 'overdue'
                                                                            ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                                                            : 'bg-amber-500/15 text-amber-600 border border-amber-500/30',
                                                                    )}
                                                                >
                                                                    <span
                                                                        className={cn(
                                                                            'size-1.5 rounded-full animate-ping',
                                                                            urgency === 'overdue'
                                                                                ? 'bg-rose-500'
                                                                                : 'bg-amber-500',
                                                                        )}
                                                                    />
                                                                    <span>Segera dikirim</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-[11px] text-muted-foreground mb-2">
                                                            Customer: <span className="font-semibold text-foreground">{item.customer_name || '-'}</span>
                                                        </p>

                                                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center text-[11px] mb-3">
                                                            <div>
                                                                <p className="text-muted-foreground text-[10px]">Qty PO</p>
                                                                <p className="font-bold text-foreground">{item.qty ?? 0}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-[10px]">Sisa PR</p>
                                                                <p className={cn(
                                                                    "font-bold",
                                                                    Number(item.sisa_qtypr ?? item.qty ?? 0) === 0 ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
                                                                )}>
                                                                    {item.sisa_qtypr ?? item.qty ?? 0}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-[10px]">Sisa DO</p>
                                                                <p className={cn(
                                                                    "font-bold",
                                                                    Number(item.sisa_qtydo ?? item.qty ?? 0) === 0 ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400"
                                                                )}>
                                                                    {item.sisa_qtydo ?? item.qty ?? 0}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-end gap-2 border-t border-sidebar-border/40 pt-2.5">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                                                                onClick={() =>
                                                                    openDetailModal(item.kode_poin)
                                                                }
                                                            >
                                                                <Eye className="size-3.5" />
                                                                <span>Detail</span>
                                                            </Button>
                                                            <a
                                                                href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-semibold shadow-xs hover:bg-muted/60"
                                                            >
                                                                <Printer className="size-3.5" />
                                                                <span>Print</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </Profiler>
                                    )
                                )}
                            </div>

                            {/* Desktop Table View (Material) */}
                            <div className="hidden overflow-x-auto rounded-xl border border-sidebar-border/70 md:block">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b-2 border-slate-300 dark:border-slate-700">
                                        <tr>
                                            <th className="w-10 px-2 py-2.5 text-center whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                No
                                            </th>
                                            <th className="w-px px-2 py-2.5 text-left whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                Ref PO
                                            </th>
                                            <th className="px-2 py-2.5 text-left border-b border-slate-300 dark:border-slate-700">
                                                Customer
                                            </th>
                                            <th className="px-2 py-2.5 text-left border-b border-slate-300 dark:border-slate-700">
                                                Material
                                            </th>
                                            <th className="w-20 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                Qty
                                            </th>
                                            <th className="w-20 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                Sisa PR
                                            </th>
                                            <th className="w-20 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                Sisa DO
                                            </th>
                                            <th className="w-20 px-2 py-2.5 text-center whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
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
                                                        'border-b border-slate-300 dark:border-slate-700 transition-colors hover:bg-muted/40',
                                                        urgency ===
                                                            'overdue'
                                                            ? 'bg-red-500/10 border-l-4 border-l-red-500'
                                                            : urgency ===
                                                                'soon'
                                                                ? 'bg-yellow-500/10 border-l-4 border-l-yellow-500'
                                                                : '',
                                                    )}
                                                >
                                                    <td className="w-10 px-2 py-2.5 text-center text-muted-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
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
                                                    <td className="w-px px-2 py-2.5 font-semibold text-foreground whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                        <span>{item.no_poin || '-'}</span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-foreground border-b border-slate-300 dark:border-slate-700">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span>{item.customer_name || '-'}</span>
                                                            {urgency && (
                                                                <span
                                                                    className={cn(
                                                                        'rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold shrink-0',
                                                                        urgency === 'overdue'
                                                                            ? 'border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400'
                                                                            : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800 dark:text-yellow-400',
                                                                    )}
                                                                >
                                                                    Segera dikirim
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2.5 font-medium text-foreground border-b border-slate-300 dark:border-slate-700">
                                                        {item.material || '-'}
                                                    </td>
                                                    <td className="w-20 px-2 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                        {item.qty ?? 0}
                                                    </td>
                                                    <td className="w-20 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                        <span
                                                            className={cn(
                                                                'font-bold tabular-nums px-2 py-0.5 rounded-md text-xs',
                                                                Number(
                                                                    item.sisa_qtypr ??
                                                                        item.qty ??
                                                                        0,
                                                                ) === 0
                                                                    ? 'bg-muted text-muted-foreground'
                                                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold',
                                                            )}
                                                        >
                                                            {item.sisa_qtypr ??
                                                                item.qty ??
                                                                0}
                                                        </span>
                                                    </td>
                                                    <td className="w-20 px-2 py-2.5 text-right whitespace-nowrap border-b border-slate-300 dark:border-slate-700">
                                                        <span
                                                            className={cn(
                                                                'font-bold tabular-nums px-2 py-0.5 rounded-md text-xs',
                                                                Number(
                                                                    item.sisa_qtydo ??
                                                                        item.qty ??
                                                                        0,
                                                                ) === 0
                                                                    ? 'bg-muted text-muted-foreground'
                                                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold',
                                                            )}
                                                        >
                                                            {item.sisa_qtydo ??
                                                                item.qty ??
                                                                0}
                                                        </span>
                                                    </td>
                                                    <td className="w-20 px-2 py-2.5 whitespace-nowrap text-center border-b border-slate-300 dark:border-slate-700">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 rounded-md border-sidebar-border/70 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                                                                onClick={() =>
                                                                    openDetailModal(
                                                                        item.kode_poin,
                                                                    )
                                                                }
                                                                title="Lihat Detail"
                                                            >
                                                                <Eye className="size-3.5 text-muted-foreground" />
                                                            </Button>
                                                            <a
                                                                href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border/70 bg-background text-muted-foreground shadow-xs transition-colors hover:bg-teal-500/15 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                                                                title="Print Dokumen"
                                                            >
                                                                <Printer className="size-3.5" />
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

                            {/* Pagination (Material) */}
                            {!materialError &&
                                (materialLoading ||
                                    Number(materialPagination.total || 0) >
                                        0) && (
                                    <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground border-t border-sidebar-border/40 pt-3">
                                        <span>
                                            {materialLoading ? (
                                                <Skeleton className="h-5 w-48" />
                                            ) : (
                                                <span>
                                                    Menampilkan{' '}
                                                    <span className="font-semibold text-foreground">
                                                        {materialRange.from}
                                                    </span>
                                                    -
                                                    <span className="font-semibold text-foreground">
                                                        {materialRange.to}
                                                    </span>{' '}
                                                    dari{' '}
                                                    <span className="font-semibold text-foreground">
                                                        {materialRange.total}
                                                    </span>{' '}
                                                    data
                                                </span>
                                            )}
                                        </span>
                                        {materialPerPage !== 'all' && (
                                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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
                                                <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
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
                                                    className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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
                    <DialogContent className="!top-[2vh] !left-[0.5vw] !h-[96vh] !w-[99vw] !max-w-[99vw] !translate-x-0 !translate-y-0 overflow-y-auto p-0 rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl flex flex-col">
                        <DialogHeader className="sticky top-0 z-20 border-b border-sidebar-border/70 bg-background/95 backdrop-blur-xs px-4 py-3 sm:px-6 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <ClipboardCheck className="size-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-base font-bold text-foreground">
                                            Detail Purchase Order In
                                        </DialogTitle>
                                        {detailHeader && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                No Document: <span className="font-semibold text-foreground">{detailHeader.kode_poin}</span> • Ref PO: <span className="font-semibold text-foreground">{detailHeader.no_poin || '-'}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {detailHeader && (
                                        <a
                                            href={`/marketing/purchase-order-in/${encodeURIComponent(detailHeader.kode_poin)}/print`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sidebar-border/70 bg-background px-3 text-xs font-semibold shadow-xs hover:bg-muted/60 text-muted-foreground hover:text-foreground cursor-pointer"
                                            title="Print Dokumen"
                                        >
                                            <Printer className="size-3.5" />
                                            <span className="hidden sm:inline">Print Dokumen</span>
                                        </a>
                                    )}
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="size-8 p-0 rounded-lg hover:bg-muted/60 cursor-pointer"
                                            title="Tutup"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </DialogClose>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-4 sm:p-6 flex-1 space-y-4">
                            {detailLoading && (
                                <div className="py-16 text-center text-sm text-muted-foreground">
                                    Memuat detail data PO In...
                                </div>
                            )}
                            {!detailLoading && detailError && (
                                <div className="py-16 text-center">
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
                                <div className="space-y-4">
                                    {/* Structured Header Metadata Cards */}
                                    <div className="rounded-xl border border-sidebar-border/70 bg-muted/20 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">No Document</span>
                                            <p className="font-bold text-foreground mt-0.5">{detailHeader.kode_poin ?? '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ref PO Customer</span>
                                            <p className="font-semibold text-foreground mt-0.5">{detailHeader.no_poin ?? '-'}</p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</span>
                                            <p className="font-semibold text-foreground mt-0.5 truncate" title={detailHeader.customer_name}>
                                                {detailHeader.customer_name ?? '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PIC PO Customer</span>
                                            <p className="font-semibold text-foreground mt-0.5">{detailHeader.sender_name ?? '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tgl Buat / Input</span>
                                            <p className="font-medium text-foreground mt-0.5">{formatDateDisplay(detailHeader.created_at || detailHeader.date_poin)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date PO In</span>
                                            <p className="font-medium text-foreground mt-0.5">{formatDateDisplay(detailHeader.date_poin)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Date</span>
                                            <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(detailHeader.delivery_date)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Term of Payment</span>
                                            <p className="font-medium text-foreground mt-0.5">{detailHeader.payment_term ?? '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Franco / Loco</span>
                                            <p className="font-medium text-foreground mt-0.5">{detailHeader.franco_loco ?? '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PPN</span>
                                            <p className="font-semibold text-foreground mt-0.5">{detailHeader.ppn_input_percent ?? 0}%</p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-3 lg:col-span-5 border-t border-sidebar-border/50 pt-2.5 mt-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keterangan:</span>
                                            <span className="font-medium text-foreground ml-2 whitespace-pre-wrap">{String(detailHeader.note_doc ?? '').trim() || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Material List Search & Filter Toolbar */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                        <div className="relative w-full max-w-sm">
                                            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="search"
                                                className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background pr-8 pl-8.5 text-xs placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none"
                                                placeholder="Cari nama material..."
                                                value={detailSearch}
                                                onChange={(event) => {
                                                    setDetailSearch(
                                                        event.target.value,
                                                    );
                                                    setDetailPage(1);
                                                }}
                                            />
                                            {detailSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDetailSearch('');
                                                        setDetailPage(1);
                                                    }}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Tampilkan:</span>
                                            <select
                                                className="h-8 rounded-lg border border-sidebar-border/70 bg-background px-2.5 text-xs font-medium text-foreground cursor-pointer focus:border-emerald-500 focus:outline-none"
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
                                                <option value="5">5 baris</option>
                                                <option value="10">10 baris</option>
                                                <option value="25">25 baris</option>
                                                <option value="50">50 baris</option>
                                                <option value="all">Semua</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Material Table with Crisp Horizontal Lines */}
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full min-w-[860px] text-xs border-collapse">
                                            <thead className="bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-sidebar-border/70">
                                                <tr>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-10 px-2 py-2.5 text-center align-middle whitespace-nowrap"
                                                    >
                                                        No
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-2.5 py-2.5 text-left align-middle"
                                                    >
                                                        Material / Part Name
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-24 px-2.5 py-2.5 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Qty PO
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-28 px-2.5 py-2.5 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Harga (Rp)
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-32 px-2.5 py-2.5 text-right align-middle whitespace-nowrap"
                                                    >
                                                        Total (Rp)
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="px-2.5 py-1.5 text-center border-b border-sidebar-border/50"
                                                    >
                                                        Sisa Realisasi
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="px-2.5 py-2.5 text-left align-middle"
                                                    >
                                                        Remark
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th className="w-20 px-2 py-1.5 text-right whitespace-nowrap">
                                                        Sisa PR
                                                    </th>
                                                    <th className="w-20 px-2 py-1.5 text-right whitespace-nowrap">
                                                        Sisa DO
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/70">
                                                <PlainTableStateRows
                                                    loading={detailTableLoading}
                                                    isEmpty={
                                                        !detailTableLoading &&
                                                        detailItems.length === 0
                                                    }
                                                    emptyTitle="Belum ada material untuk PO In ini."
                                                    columns={8}
                                                    skeletonRows={
                                                        detailPageSize ===
                                                        Infinity
                                                            ? 5
                                                            : Number(
                                                                  detailPageSize,
                                                              )
                                                    }
                                                />
                                                {!detailTableLoading &&
                                                    detailItems.map(
                                                        (row, index) => (
                                                            <tr
                                                                key={`${row.material}-${index}`}
                                                                className="border-b border-sidebar-border/70 hover:bg-muted/40 transition-colors"
                                                            >
                                                                <td className="w-10 px-2 py-2.5 text-center text-muted-foreground whitespace-nowrap">
                                                                    {detailPagination.per_page ===
                                                                    'all'
                                                                        ? index + 1
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
                                                                <td className="px-2.5 py-2.5 font-medium text-foreground">
                                                                    {row.material ?? '-'}
                                                                </td>
                                                                <td className="w-24 px-2.5 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                                                                    {`${row.qty ?? 0} ${row.satuan ?? ''}`}
                                                                </td>
                                                                <td className="w-28 px-2.5 py-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                                                                    {formatRupiah(row.price_po_in ?? 0)}
                                                                </td>
                                                                <td className="w-32 px-2.5 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                                                                    {formatRupiah(row.total_price_po_in ?? 0)}
                                                                </td>
                                                                <td className="w-20 px-2.5 py-2.5 text-right whitespace-nowrap">
                                                                    <span
                                                                        className={cn(
                                                                            'font-bold tabular-nums px-2 py-0.5 rounded-md text-xs',
                                                                            Number(row.sisa_qtypr ?? 0) === 0
                                                                                ? 'bg-muted text-muted-foreground'
                                                                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                                                                        )}
                                                                    >
                                                                        {row.sisa_qtypr ?? 0}
                                                                    </span>
                                                                </td>
                                                                <td className="w-20 px-2.5 py-2.5 text-right whitespace-nowrap">
                                                                    <span
                                                                        className={cn(
                                                                            'font-bold tabular-nums px-2 py-0.5 rounded-md text-xs',
                                                                            Number(row.sisa_qtydo ?? 0) === 0
                                                                                ? 'bg-muted text-muted-foreground'
                                                                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
                                                                        )}
                                                                    >
                                                                        {row.sisa_qtydo ?? 0}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2.5 py-2.5 text-muted-foreground">
                                                                    {row.remark || '-'}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Footer */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground border-t border-sidebar-border/40 pt-3">
                                        <p>
                                            Total <span className="font-semibold text-foreground">{detailPagination.total}</span> data material
                                        </p>
                                        {String(detailPagination.per_page) !== 'all' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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
                                                <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
                                                    {detailPagination.page} / {detailPagination.total_pages}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-2.5 text-xs font-semibold rounded-lg"
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

                                    {/* Financial Summary 4 KPI Blocks */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
                                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-3 shadow-xs">
                                            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Total Price</span>
                                            <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">
                                                Rp {formatRupiah(detailHeader.total_price ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-3 shadow-xs">
                                            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">DPP</span>
                                            <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">
                                                Rp {formatRupiah(detailHeader.dpp ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-3 shadow-xs">
                                            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">PPN</span>
                                            <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">
                                                Rp {formatRupiah(detailHeader.ppn_amount ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-xs">
                                            <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Grand Total</span>
                                            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                                                Rp {formatRupiah(detailHeader.grand_total ?? 0)}
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
                    <DialogContent className="!top-[2vh] !left-[0.5vw] !h-[96vh] !w-[99vw] !max-w-[99vw] !translate-x-0 !translate-y-0 overflow-y-auto p-0 rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl flex flex-col">
                        <DialogHeader className="sticky top-0 z-20 border-b border-sidebar-border/70 bg-background/95 backdrop-blur-xs px-4 py-3 sm:px-6 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <ClipboardCheck className="size-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-base font-bold text-foreground">
                                            {activeModal === 'all_data'
                                                ? 'Semua Data PO IN'
                                                : activeModal === 'outstanding'
                                                    ? 'Data PO IN Outstanding'
                                                    : activeModal === 'sisa'
                                                        ? 'Data PO IN Sisa Parsial'
                                                        : `Data PO IN Terealisasi (${periodLabelMap[realizedPeriod]})`}
                                        </DialogTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {activeModal === 'all_data'
                                                ? 'Daftar keseluruhan data Purchase Order Masuk'
                                                : activeModal === 'outstanding'
                                                    ? 'Daftar dokumen PO IN yang belum diproses'
                                                    : activeModal === 'sisa'
                                                        ? 'Daftar dokumen PO IN yang masih memiliki sisa kuantitas'
                                                        : 'Daftar dokumen PO IN yang telah selesai terealisasi'}
                                        </p>
                                    </div>
                                </div>
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="size-8 p-0 rounded-lg hover:bg-muted/60 cursor-pointer"
                                        title="Tutup"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </DialogClose>
                            </div>
                        </DialogHeader>

                        <div className="p-4 sm:p-6 flex-1 space-y-3.5">
                            {/* Segmented Tab Switcher (if not all_data) */}
                            {activeModal !== 'all_data' && (
                                <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-sidebar-border/60 shadow-xs">
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                                            activeModalTab === 'pr'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                        )}
                                        style={
                                            activeModalTab === 'pr'
                                                ? { backgroundColor: '#059669', color: '#ffffff' }
                                                : undefined
                                        }
                                        onClick={() => {
                                            setActiveModalTab('pr');
                                            setModalSearch('');
                                            setModalPage(1);
                                        }}
                                    >
                                        <span>
                                            {activeModal === 'outstanding'
                                                ? 'Outstanding PR'
                                                : activeModal === 'sisa'
                                                    ? 'Sisa PR'
                                                    : 'PR Selesai'}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                                            activeModalTab === 'do'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                        )}
                                        style={
                                            activeModalTab === 'do'
                                                ? { backgroundColor: '#059669', color: '#ffffff' }
                                                : undefined
                                        }
                                        onClick={() => {
                                            setActiveModalTab('do');
                                            setModalSearch('');
                                            setModalPage(1);
                                        }}
                                    >
                                        <span>
                                            {activeModal === 'outstanding'
                                                ? 'Outstanding DO'
                                                : activeModal === 'sisa'
                                                    ? 'Sisa DO'
                                                    : 'DO Selesai'}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Toolbar: Search & Filters */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="relative w-full max-w-sm">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="search"
                                        className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background pr-8 pl-8.5 text-xs placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none"
                                        placeholder="Cari No Doc, Ref PO, customer..."
                                        value={modalSearch}
                                        onChange={(event) => {
                                            setModalSearch(event.target.value);
                                            setModalPage(1);
                                        }}
                                    />
                                    {modalSearch && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setModalSearch('');
                                                setModalPage(1);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    {activeModal !== 'all_data' &&
                                        activeModal !== 'realized' && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[11px] text-muted-foreground hidden sm:inline">Deadline:</span>
                                                <select
                                                    className="h-8 rounded-lg border border-sidebar-border/70 bg-background px-2.5 text-xs font-medium text-foreground cursor-pointer focus:border-emerald-500 focus:outline-none"
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
                                            </div>
                                        )}
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <span className="text-[11px]">Tampilkan:</span>
                                        <select
                                            className="h-8 rounded-lg border border-sidebar-border/70 bg-background px-2.5 text-xs font-medium text-foreground cursor-pointer focus:border-emerald-500 focus:outline-none"
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
                                            <option value="5">5 baris</option>
                                            <option value="10">10 baris</option>
                                            <option value="25">25 baris</option>
                                            <option value="50">50 baris</option>
                                            <option value="100">100 baris</option>
                                            <option value="all">Semua</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Table with Crisp Horizontal Lines */}
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-sidebar-border/70">
                                        <tr>
                                            <th className="w-10 px-2 py-2.5 text-center whitespace-nowrap">
                                                No
                                            </th>
                                            <th className="w-px px-2 py-2.5 text-left whitespace-nowrap">
                                                No Doc
                                            </th>
                                            <th className="w-px px-2 py-2.5 text-left whitespace-nowrap">
                                                Ref PO
                                            </th>
                                            <th className="w-px px-2 py-2.5 text-left whitespace-nowrap">
                                                {activeModal === 'realized' &&
                                                    activeModalTab === 'do'
                                                    ? 'Tgl DO Terakhir'
                                                    : activeModal === 'realized' &&
                                                        activeModalTab === 'pr'
                                                        ? 'Tgl PR Terakhir'
                                                        : 'Tgl Input'}
                                            </th>
                                            <th className="px-2 py-2.5 text-left">
                                                Customer
                                            </th>
                                            <th className="w-32 px-2 py-2.5 text-right whitespace-nowrap">
                                                Grand Total
                                            </th>
                                            <th className="w-24 px-2 py-2.5 text-center whitespace-nowrap">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
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

                                        {modalDisplayedItems.map((item, index) => {
                                            const urgency = getRowUrgency(item);
                                            return (
                                                <tr
                                                    key={`${item.no_do || item.no_poin}-${index}`}
                                                    className={cn(
                                                        'border-b border-sidebar-border/70 transition-colors hover:bg-muted/40',
                                                        urgency === 'overdue'
                                                            ? 'bg-red-500/10 border-l-4 border-l-red-500'
                                                            : urgency === 'soon'
                                                                ? 'bg-yellow-500/10 border-l-4 border-l-yellow-500'
                                                                : '',
                                                    )}
                                                >
                                                    <td className="w-10 px-2 py-2.5 text-center text-muted-foreground whitespace-nowrap">
                                                        {modalPageSize === Infinity
                                                            ? index + 1
                                                            : (modalPage - 1) *
                                                            modalPageSize +
                                                            index +
                                                            1}
                                                    </td>
                                                    <td className="w-px px-2 py-2.5 font-semibold text-foreground whitespace-nowrap">
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
                                                    <td className="w-px px-2 py-2.5 font-medium text-foreground whitespace-nowrap">
                                                        {item.no_poin}
                                                    </td>
                                                    <td className="w-px px-2 py-2.5 text-muted-foreground whitespace-nowrap">
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
                                                    <td className="px-2 py-2.5 font-medium text-foreground">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span>{item.customer_name}</span>
                                                            {urgency && (
                                                                <span
                                                                    className={cn(
                                                                        'rounded-sm border px-1.5 py-0.5 text-[10px] leading-tight font-semibold shrink-0',
                                                                        urgency === 'overdue'
                                                                            ? 'border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400'
                                                                            : 'border-yellow-600/40 bg-yellow-500/20 text-yellow-800 dark:text-yellow-400',
                                                                    )}
                                                                >
                                                                    Segera dikirim
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="w-32 px-2 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                                                        Rp {formatRupiah(item.grand_total)}
                                                    </td>
                                                    <td className="w-24 px-2 py-2.5 whitespace-nowrap text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {activeModal === 'outstanding' || activeModal === 'sisa' ? (
                                                                <>
                                                                    {((activeModal === 'outstanding' && activeModalTab === 'pr') ||
                                                                        !Number(item.has_do ?? 0) ||
                                                                        activeModal === 'sisa') && (
                                                                        <MenuAction
                                                                            action="update"
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 rounded-md border-sidebar-border/70 hover:bg-indigo-500/15 hover:text-indigo-600 cursor-pointer"
                                                                            onClick={() => {
                                                                                if (!canUpdate) {
                                                                                    toastError('Akses edit tidak diizinkan untuk menu ini.');
                                                                                    return;
                                                                                }
                                                                                setActiveModal(null);
                                                                                router.visit(`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/edit`);
                                                                            }}
                                                                            title="Edit PO In"
                                                                        >
                                                                            <Pencil className="size-3.5" />
                                                                        </MenuAction>
                                                                    )}
                                                                    {activeModal === 'outstanding' && (
                                                                        <MenuAction
                                                                            action="delete"
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 rounded-md border-sidebar-border/70 hover:bg-rose-500/15 hover:text-rose-600 cursor-pointer"
                                                                            title="Hapus PO In"
                                                                            onClick={() => {
                                                                                if (!canDelete) {
                                                                                    toastError('Akses delete tidak diizinkan untuk menu ini.');
                                                                                    return;
                                                                                }
                                                                                setConfirmDeleteKode(item.kode_poin);
                                                                                setIsConfirmDeleteOpen(true);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="size-3.5" />
                                                                        </MenuAction>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 rounded-md border-sidebar-border/70 hover:bg-emerald-500/15 hover:text-emerald-600 cursor-pointer"
                                                                onClick={() => {
                                                                    setActiveModal(null);
                                                                    openDetailModal(item.kode_poin);
                                                                }}
                                                                title="Lihat Detail"
                                                            >
                                                                <Eye className="size-3.5 text-muted-foreground" />
                                                            </Button>
                                                            <a
                                                                href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border/70 bg-background text-muted-foreground shadow-xs transition-colors hover:bg-teal-500/15 hover:text-teal-600 cursor-pointer"
                                                                title="Print Dokumen"
                                                            >
                                                                <Printer className="size-3.5" />
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {modalPageSize !== Infinity && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground border-t border-sidebar-border/40 pt-3">
                                    <p>
                                        Menampilkan{' '}
                                        <span className="font-semibold text-foreground">
                                            {modalTotalItems === 0
                                                ? 0
                                                : (modalPage - 1) *
                                                      (modalPageSize === Infinity
                                                          ? modalTotalItems
                                                          : modalPageSize) +
                                                  1}
                                        </span>{' '}
                                        -{' '}
                                        <span className="font-semibold text-foreground">
                                            {modalPageSize === Infinity
                                                ? modalTotalItems
                                                : Math.min(
                                                      modalPage * modalPageSize,
                                                      modalTotalItems,
                                                  )}
                                        </span>{' '}
                                        dari{' '}
                                        <span className="font-semibold text-foreground">
                                            {modalTotalItems}
                                        </span>{' '}
                                        data
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 text-xs font-semibold rounded-lg"
                                            disabled={modalPage <= 1}
                                            onClick={() =>
                                                setModalPage((prev) =>
                                                    Math.max(1, prev - 1),
                                                )
                                            }
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
                                            {modalPage} / {modalTotalPages}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 text-xs font-semibold rounded-lg"
                                            disabled={
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
                    <DialogContent className="max-w-md rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xl">
                        <DialogHeader className="border-b border-sidebar-border/60 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <Trash2 className="size-4" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-bold text-foreground">
                                        Hapus Purchase Order In?
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                        Dokumen: <span className="font-semibold text-foreground">{confirmDeleteKode}</span>
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <p className="text-xs text-muted-foreground py-2">
                            Data header dan seluruh detail material PO In ini akan dihapus secara permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-sidebar-border/60">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-lg text-xs font-semibold"
                                onClick={() => {
                                    setIsConfirmDeleteOpen(false);
                                    setConfirmDeleteKode('');
                                }}
                                disabled={isDeleting}
                            >
                                Batal
                            </Button>
                            <MenuAction
                                action="delete"
                                type="button"
                                size="sm"
                                className="h-9 px-4 gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                                onClick={handleDeletePoIn}
                                disabled={isDeleting}
                            >
                                <Trash2 className="size-3.5" />
                                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
                            </MenuAction>
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
