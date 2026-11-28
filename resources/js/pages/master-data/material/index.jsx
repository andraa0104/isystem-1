import { MenuAction } from '@/components/menu-action';
import { ActionIconButton } from '@/components/action-icon-button';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { useMasterDataRows } from '@/hooks/use-master-data-rows';
import { confirmDelete } from '@/lib/confirm-delete';
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowUpDown,
    Boxes,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    Download,
    Eye,
    FileSpreadsheet,
    Layers,
    Package,
    PackageCheck,
    PackageSearch,
    Pencil,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    TrendingDown,
    TrendingUp,
    Truck,
    Warehouse,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Master Data', href: '/master-data/material' },
    { title: 'Material', href: '/master-data/material' },
];

const warehouseOptions = [
    { value: 'g1', label: 'Gudang 1' },
    { value: 'g2', label: 'Gudang 2' },
    { value: 'g3', label: 'Gudang 3' },
    { value: 'g4', label: 'Gudang 4' },
];

const stockCategoryOptions = ['FAST MOVING', 'SLOW MOVING', 'DEAD STOK'];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const compareCode = (a, b) =>
    String(a ?? '').localeCompare(String(b ?? ''), 'id', {
        numeric: true,
        sensitivity: 'base',
    });

const formatNumber = (value) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) {
        return '0';
    }

    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.trunc(number));
};

const toNumber = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
};

const stockRows = (material) => [
    {
        label: 'G1',
        stok: material?.stok_g1,
        harga: material?.harga_stokg1,
        kategori: material?.kategori_stok1,
    },
    {
        label: 'G2',
        stok: material?.stok_g2,
        harga: material?.harga_stokg2,
        kategori: material?.kategori_stok2,
    },
    {
        label: 'G3',
        stok: material?.stok_g3,
        harga: material?.harga_stokg3,
        kategori: material?.kategori_stok3,
    },
    {
        label: 'G4',
        stok: material?.stok_g4,
        harga: material?.harga_stokg4,
        kategori: material?.kategori_stok4,
    },
];

const movementCategories = [
    { key: 'fast', title: 'Fast Moving', matcher: 'fast' },
    { key: 'slow', title: 'Slow Moving', matcher: 'slow' },
    { key: 'dead', title: 'Dead Stok', matcher: 'dead' },
];

const inventoryCardTypes = [
    { key: 'mis', title: 'MIS', balanceLabel: 'MIS' },
    { key: 'mib', title: 'MIB', balanceLabel: 'MIB' },
    { key: 'mibs', title: 'MIBS', balanceLabel: 'MIBS' },
];

const movementMetricKeys = ['stock', 'items', 'total'];

const createMovementMetricState = (value) =>
    movementCategories.reduce((acc, category) => {
        acc[category.key] = movementMetricKeys.reduce((metrics, metric) => {
            metrics[metric] = value;
            return metrics;
        }, {});
        return acc;
    }, {});

const createWarehouseSummaryState = (loading = true) =>
    warehouseOptions.reduce((acc, warehouse) => {
        acc[warehouse.value] = {
            loading,
            total: { stock: 0, items: 0, total: 0 },
            categories: [],
        };
        return acc;
    }, {});

const materialMovementRows = (material) =>
    stockRows(material).map((row) => ({
        kd_material: material?.kd_material,
        material: material?.material,
        gudang: row.label,
        stok: toNumber(row.stok),
        harga: toNumber(row.harga),
        kategori: row.kategori,
        total: toNumber(row.stok) * toNumber(row.harga),
    }));

const MetricValue = ({ loading, children, className = 'h-5 w-16' }) =>
    loading ? <Skeleton className={className} /> : children;

/* ─── Ambient Atmospheric Drifting Mesh Ornaments (Dashboard UI Language) ─── */
function MaterialOrnaments() {
    return (
        <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
        >
            <div className="absolute -top-32 -left-20 size-[520px] rounded-full bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] blur-[130px]" />
            <div className="absolute top-1/4 -right-24 size-[460px] rounded-full bg-cyan-500/[0.07] dark:bg-cyan-500/[0.12] blur-[130px]" />
            <div className="absolute bottom-16 left-1/3 size-[400px] rounded-full bg-indigo-500/[0.05] dark:bg-indigo-500/[0.09] blur-[110px]" />
        </div>
    );
}

/* ─── Sparkline Micro-Wave for Material KPI Cards ─────────────────────────── */
function CategorySparkWave({ color = 'emerald' }) {
    const colorMap = {
        emerald: { stroke: '#10b981', dotY: 5, path: 'M 2,24 C 18,28 28,12 44,16 C 60,20 70,7 88,5' },
        amber: { stroke: '#f59e0b', dotY: 9, path: 'M 2,22 C 18,14 30,26 52,12 C 68,4 78,18 88,9' },
        rose: { stroke: '#f43f5e', dotY: 22, path: 'M 2,8 C 20,10 34,19 52,17 C 68,15 78,24 88,22' },
        sky: { stroke: '#0ea5e9', dotY: 7, path: 'M 2,20 C 16,8 28,22 46,14 C 62,6 74,16 88,7' },
        indigo: { stroke: '#6366f1', dotY: 6, path: 'M 2,14 C 18,24 34,9 52,18 C 68,25 78,8 88,6' },
        teal: { stroke: '#14b8a6', dotY: 7, path: 'M 2,22 C 20,24 34,11 50,15 C 66,19 76,8 88,7' },
    };
    const c = colorMap[color] || colorMap.emerald;
    const areaD = `${c.path} L 88,32 L 2,32 Z`;

    return (
        <svg
            className="w-20 h-7 overflow-visible shrink-0 opacity-75 group-hover:opacity-100 transition-opacity"
            viewBox="0 0 90 32"
            fill="none"
        >
            <defs>
                <linearGradient id={`mat-spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#mat-spark-${color})`} />
            <motion.path
                d={c.path}
                stroke={c.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
            />
            <circle cx="88" cy={c.dotY} r="2.5" fill={c.stroke} />
        </svg>
    );
}

/* ─── Shared Modal Chrome Components (Dashboard Aesthetic) ─────────────────── */
function ModalToolbar({
    pageSize,
    onPageSizeChange,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Cari...',
    pageSizeOptions = [5, 10, 25, 50],
    includeAll = true,
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sidebar-border/60 bg-muted/25 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
                <SlidersHorizontal className="size-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold">Tampilkan</span>
                <select
                    className="rounded-xl border border-sidebar-border/70 bg-background/80 px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 cursor-pointer"
                    value={pageSize === Infinity ? 'all' : pageSize}
                    onChange={(event) => {
                        const value = event.target.value;
                        onPageSizeChange(value === 'all' ? Infinity : Number(value));
                    }}
                >
                    {pageSizeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                    {includeAll && <option value="all">Semua</option>}
                </select>
            </div>

            <div className="relative flex items-center w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
                <input
                    type="search"
                    className="w-full sm:w-72 rounded-xl border border-sidebar-border/70 bg-background/80 py-1.5 pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground transition-all hover:border-emerald-500/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
                {searchValue && (
                    <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        aria-label="Hapus pencarian"
                        className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

function ModalPagination({
    currentPage,
    totalPages,
    onPrev,
    onNext,
    nextLabel = 'Berikutnya',
    summaryText = null,
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
            <span className="font-medium">
            </span>
            <div className="flex items-center gap-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 rounded-xl border-sidebar-border/70 bg-background/70 px-2.5 text-xs font-bold transition-all hover:border-emerald-500/40"
                    disabled={currentPage === 1}
                    onClick={onPrev}
                >
                    <ChevronLeft className="size-3.5" />
                    Sebelumnya
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 rounded-xl border-sidebar-border/70 bg-background/70 px-2.5 text-xs font-bold transition-all hover:border-emerald-500/40"
                    disabled={currentPage === totalPages}
                    onClick={onNext}
                >
                    {nextLabel}
                    <ChevronRight className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}

export default function MaterialIndex() {
    // --- States Utama ---
    const [activeCardTab, setActiveCardTab] = useState('');
    const loadedCardTabs = useRef(new Set());

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [stockFilter, setStockFilter] = useState('all');
    const [codeOrder, setCodeOrder] = useState('asc');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilters, setExportFilters] = useState({
        warehouse: 'all',
        category: 'all',
        stock: 'all',
    });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [viewingMaterial, setViewingMaterial] = useState(null);
    const [movementModal, setMovementModal] = useState(null);
    const [warehouseModal, setWarehouseModal] = useState(null);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');
    const [outstandingCount, setOutstandingCount] = useState(0);
    const [outstandingQty, setOutstandingQty] = useState(0);
    const [outstandingTotal, setOutstandingTotal] = useState(0);
    const [outstandingCountLoading, setOutstandingCountLoading] =
        useState(true);
    const [outstandingTotalLoading, setOutstandingTotalLoading] =
        useState(true);
    const [outstandingQtyLoading, setOutstandingQtyLoading] = useState(true);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [selectedDo, setSelectedDo] = useState(null);
    const [isDetailDoModalOpen, setIsDetailDoModalOpen] = useState(false);
    const [selectedDoDetails, setSelectedDoDetails] = useState([]);
    const [selectedDoAddress, setSelectedDoAddress] = useState('');
    const [detailDoLoading, setDetailDoLoading] = useState(false);
    const [detailDoError, setDetailDoError] = useState('');
    const [detailDoSearch, setDetailDoSearch] = useState('');
    const [detailDoPageSize, setDetailDoPageSize] = useState(5);
    const [detailDoCurrentPage, setDetailDoCurrentPage] = useState(1);
    const [isDotOutstandingModalOpen, setIsDotOutstandingModalOpen] =
        useState(false);
    const [dotOutstandingList, setDotOutstandingList] = useState([]);
    const [dotOutstandingLoading, setDotOutstandingLoading] = useState(false);
    const [dotOutstandingCount, setDotOutstandingCount] = useState(0);
    const [dotOutstandingQty, setDotOutstandingQty] = useState(0);
    const [dotOutstandingTotal, setDotOutstandingTotal] = useState(0);
    const [dotOutstandingCountLoading, setDotOutstandingCountLoading] =
        useState(true);
    const [dotOutstandingTotalLoading, setDotOutstandingTotalLoading] =
        useState(true);
    const [dotOutstandingQtyLoading, setDotOutstandingQtyLoading] =
        useState(true);
    const [dotOutstandingError, setDotOutstandingError] = useState('');
    const [dotOutstandingSearch, setDotOutstandingSearch] = useState('');
    const [dotOutstandingPageSize, setDotOutstandingPageSize] = useState(5);
    const [dotOutstandingCurrentPage, setDotOutstandingCurrentPage] =
        useState(1);
    const [selectedDot, setSelectedDot] = useState(null);
    const [isDotDetailModalOpen, setIsDotDetailModalOpen] = useState(false);
    const [dotDetailItems, setDotDetailItems] = useState([]);
    const [dotDetailHeader, setDotDetailHeader] = useState(null);
    const [dotDetailLoading, setDotDetailLoading] = useState(false);
    const [dotDetailError, setDotDetailError] = useState('');
    const [dotDetailSearch, setDotDetailSearch] = useState('');
    const [dotDetailPageSize, setDotDetailPageSize] = useState(5);
    const [dotDetailCurrentPage, setDotDetailCurrentPage] = useState(1);
    const [isDoCostOutstandingModalOpen, setIsDoCostOutstandingModalOpen] =
        useState(false);
    const [doCostOutstandingList, setDoCostOutstandingList] = useState([]);
    const [doCostOutstandingLoading, setDoCostOutstandingLoading] =
        useState(false);
    const [doCostOutstandingCount, setDoCostOutstandingCount] = useState(0);
    const [doCostOutstandingQty, setDoCostOutstandingQty] = useState(0);
    const [doCostOutstandingTotal, setDoCostOutstandingTotal] = useState(0);
    const [doCostOutstandingCountLoading, setDoCostOutstandingCountLoading] =
        useState(true);
    const [doCostOutstandingTotalLoading, setDoCostOutstandingTotalLoading] =
        useState(true);
    const [doCostOutstandingQtyLoading, setDoCostOutstandingQtyLoading] =
        useState(true);
    const [doCostOutstandingError, setDoCostOutstandingError] = useState('');
    const [doCostOutstandingSearch, setDoCostOutstandingSearch] = useState('');
    const [doCostOutstandingPageSize, setDoCostOutstandingPageSize] =
        useState(5);
    const [doCostOutstandingCurrentPage, setDoCostOutstandingCurrentPage] =
        useState(1);
    const [isDoCostDetailModalOpen, setIsDoCostDetailModalOpen] =
        useState(false);
    const [doCostDetailItems, setDoCostDetailItems] = useState([]);
    const [doCostDetailHeader, setDoCostDetailHeader] = useState(null);
    const [doCostDetailLoading, setDoCostDetailLoading] = useState(false);
    const [doCostDetailError, setDoCostDetailError] = useState('');
    const [doCostDetailSearch, setDoCostDetailSearch] = useState('');
    const [doCostDetailPageSize, setDoCostDetailPageSize] = useState(5);
    const [doCostDetailCurrentPage, setDoCostDetailCurrentPage] = useState(1);
    const [inventorySummaries, setInventorySummaries] = useState(() =>
        Object.fromEntries(
            inventoryCardTypes.map(({ key }) => [
                key,
                { items: 0, qty: 0, total: 0 },
            ]),
        ),
    );
    const [inventorySummaryLoading, setInventorySummaryLoading] = useState(() =>
        Object.fromEntries(
            inventoryCardTypes.map(({ key }) => [
                key,
                { items: true, qty: true, total: true },
            ]),
        ),
    );
    const [inventoryModalType, setInventoryModalType] = useState(null);
    const [inventoryRows, setInventoryRows] = useState([]);
    const [inventoryRowsTotal, setInventoryRowsTotal] = useState(0);
    const [inventoryRowsLoading, setInventoryRowsLoading] = useState(false);
    const [inventoryRowsError, setInventoryRowsError] = useState('');
    const [inventoryRowsSearch, setInventoryRowsSearch] = useState('');
    const [inventoryRowsPageSize, setInventoryRowsPageSize] = useState(5);
    const [inventoryRowsCurrentPage, setInventoryRowsCurrentPage] = useState(1);
    const [movementSearchTerm, setMovementSearchTerm] = useState('');
    const [movementPageSize, setMovementPageSize] = useState(5);
    const [movementCurrentPage, setMovementCurrentPage] = useState(1);
    const [movementMetrics, setMovementMetrics] = useState(() =>
        createMovementMetricState(0),
    );
    const [movementMetricLoading, setMovementMetricLoading] = useState(() =>
        createMovementMetricState(true),
    );
    const [warehouseSummaries, setWarehouseSummaries] = useState(() =>
        createWarehouseSummaryState(true),
    );

    const { data, setData, post, processing, reset, errors } = useForm({
        material: '',
        unit: '',
        gudang: '',
        kategori: '',
        stok: 0,
    });
    const {
        data: editData,
        setData: setEditData,
        put,
        processing: editProcessing,
        reset: resetEdit,
        errors: editErrors,
    } = useForm({
        material: '',
        unit: '',
        stok: 0,
        remark: '',
    });

    const {
        rows: materialsList,
        total: totalItems,
        loading: tableLoading,
        error: tableError,
        refresh: refreshRows,
    } = useMasterDataRows('/master-data/material/rows', {
        search: debouncedSearchTerm.trim(),
        page: currentPage,
        per_page: pageSize === Infinity ? 'all' : pageSize,
        order: codeOrder,
        stock: stockFilter,
    });

    const {
        rows: movementMaterials,
        loading: movementRowsLoading,
        error: movementRowsError,
        refresh: refreshMovementRows,
    } = useMasterDataRows(
        '/master-data/material/rows',
        { per_page: 'all' },
        { enabled: Boolean(movementModal || warehouseModal) },
    );

    const setMetricLoading = (category, metric, loading, warehouse = null) => {
        if (warehouse) {
            return;
        }

        setMovementMetricLoading((prev) => ({
            ...prev,
            [category]: { ...prev[category], [metric]: loading },
        }));
    };

    const setMetricValue = (category, metric, value, warehouse = null) => {
        if (warehouse) {
            return;
        }

        setMovementMetrics((prev) => ({
            ...prev,
            [category]: { ...prev[category], [metric]: value },
        }));
    };

    const fetchMovementMetric = async (category, metric, warehouse = null) => {
        setMetricLoading(category, metric, true, warehouse);

        try {
            const params = new URLSearchParams({ category, metric });
            if (warehouse) {
                params.set('warehouse', warehouse);
            }
            const response = await fetch(
                `/master-data/material/movement-metric?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Gagal memuat metric.');
            }

            setMetricValue(
                category,
                metric,
                Number(data?.value ?? 0),
                warehouse,
            );
        } catch {
            setMetricValue(category, metric, 0, warehouse);
        } finally {
            setMetricLoading(category, metric, false, warehouse);
        }
    };

    const fetchAllMovementMetrics = () => {
        movementCategories.forEach((category) => {
            movementMetricKeys.forEach((metric) => {
                fetchMovementMetric(category.key, metric);
            });
        });
    };

    const fetchWarehouseSummary = async (warehouse) => {
        setWarehouseSummaries((prev) => ({
            ...prev,
            [warehouse]: {
                ...prev[warehouse],
                loading: true,
            },
        }));

        try {
            const params = new URLSearchParams({ warehouse });
            const response = await fetch(
                `/master-data/material/warehouse-summary?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Gagal memuat summary.');
            }

            setWarehouseSummaries((prev) => ({
                ...prev,
                [warehouse]: {
                    loading: false,
                    total: data?.total ?? { stock: 0, items: 0, total: 0 },
                    categories: Array.isArray(data?.categories)
                        ? data.categories
                        : [],
                },
            }));
        } catch {
            setWarehouseSummaries((prev) => ({
                ...prev,
                [warehouse]: {
                    loading: false,
                    total: { stock: 0, items: 0, total: 0 },
                    categories: [],
                },
            }));
        }
    };

    const fetchAllWarehouseSummaries = () => {
        warehouseOptions.forEach((warehouse) => {
            fetchWarehouseSummary(warehouse.value);
        });
    };

    const fetchDoMetrics = () => {
        const loadMetric = (url, setter, loadingSetter) => {
            fetch(url, { headers: { Accept: 'application/json' } })
                .then((response) => {
                    if (!response.ok) throw new Error('Request failed');
                    return response.json();
                })
                .then((result) => setter(toNumber(result?.value)))
                .catch(() => { })
                .finally(() => loadingSetter(false));
        };

        loadMetric(
            '/marketing/delivery-order/outstanding-metric?metric=count',
            setOutstandingCount,
            setOutstandingCountLoading,
        );
        loadMetric(
            '/marketing/delivery-order/outstanding-metric?metric=total',
            setOutstandingTotal,
            setOutstandingTotalLoading,
        );
        loadMetric(
            '/marketing/delivery-order/outstanding-metric?metric=qty',
            setOutstandingQty,
            setOutstandingQtyLoading,
        );
        loadMetric(
            '/marketing/delivery-order-add/outstanding-metric?metric=count',
            setDotOutstandingCount,
            setDotOutstandingCountLoading,
        );
        loadMetric(
            '/marketing/delivery-order-add/outstanding-metric?metric=total',
            setDotOutstandingTotal,
            setDotOutstandingTotalLoading,
        );
        loadMetric(
            '/marketing/delivery-order-add/outstanding-metric?metric=qty',
            setDotOutstandingQty,
            setDotOutstandingQtyLoading,
        );
        loadMetric(
            '/pembelian/delivery-order-cost/outstanding-metric?metric=count',
            setDoCostOutstandingCount,
            setDoCostOutstandingCountLoading,
        );
        loadMetric(
            '/pembelian/delivery-order-cost/outstanding-metric?metric=total',
            setDoCostOutstandingTotal,
            setDoCostOutstandingTotalLoading,
        );
        loadMetric(
            '/pembelian/delivery-order-cost/outstanding-metric?metric=qty',
            setDoCostOutstandingQty,
            setDoCostOutstandingQtyLoading,
        );
    };

    const loadOutstanding = () => {
        if (outstandingLoading || outstandingList.length > 0) return;
        setOutstandingLoading(true);
        setOutstandingError('');
        fetch('/marketing/delivery-order/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((result) => {
                const list =
                    result?.deliveryOrders?.data ?? result?.deliveryOrders;
                setOutstandingList(Array.isArray(list) ? list : []);
            })
            .catch(() =>
                setOutstandingError('Gagal memuat data DO outstanding.'),
            )
            .finally(() => setOutstandingLoading(false));
    };

    const loadDotOutstanding = () => {
        if (dotOutstandingLoading || dotOutstandingList.length > 0) return;
        setDotOutstandingLoading(true);
        setDotOutstandingError('');
        fetch('/marketing/delivery-order-add/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((result) => {
                setDotOutstandingList(
                    Array.isArray(result?.deliveryOrders)
                        ? result.deliveryOrders
                        : [],
                );
            })
            .catch(() =>
                setDotOutstandingError('Gagal memuat data DOT outstanding.'),
            )
            .finally(() => setDotOutstandingLoading(false));
    };

    const handleOpenDotDetail = (item) => {
        setIsDotOutstandingModalOpen(false);
        setSelectedDot(item);
        setIsDotDetailModalOpen(true);
        setDotDetailItems([]);
        setDotDetailHeader(null);
        setDotDetailError('');
        setDotDetailSearch('');
        setDotDetailPageSize(5);
        setDotDetailCurrentPage(1);
        setDotDetailLoading(true);
        fetch(
            `/marketing/delivery-order-add/details?${new URLSearchParams({ no_dob: item.no_dob })}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((result) => {
                setDotDetailItems(
                    Array.isArray(result?.details) ? result.details : [],
                );
                setDotDetailHeader(result?.header ?? null);
            })
            .catch(() => setDotDetailError('Gagal memuat detail DOT.'))
            .finally(() => setDotDetailLoading(false));
    };

    const loadDoCostOutstanding = () => {
        if (doCostOutstandingLoading || doCostOutstandingList.length > 0)
            return;
        setDoCostOutstandingLoading(true);
        setDoCostOutstandingError('');
        fetch('/pembelian/delivery-order-cost/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((result) =>
                setDoCostOutstandingList(
                    Array.isArray(result?.deliveryOrders)
                        ? result.deliveryOrders
                        : [],
                ),
            )
            .catch(() =>
                setDoCostOutstandingError('Gagal memuat data DO Cost.'),
            )
            .finally(() => setDoCostOutstandingLoading(false));
    };

    const handleOpenDoCostDetail = (item) => {
        setIsDoCostOutstandingModalOpen(false);
        setIsDoCostDetailModalOpen(true);
        setDoCostDetailItems([]);
        setDoCostDetailHeader(null);
        setDoCostDetailError('');
        setDoCostDetailSearch('');
        setDoCostDetailPageSize(5);
        setDoCostDetailCurrentPage(1);
        setDoCostDetailLoading(true);
        fetch(
            `/pembelian/delivery-order-cost/details?no_alokasi=${encodeURIComponent(item.no_alokasi)}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((result) => {
                setDoCostDetailItems(
                    Array.isArray(result?.details) ? result.details : [],
                );
                setDoCostDetailHeader(result?.header ?? null);
            })
            .catch(() => setDoCostDetailError('Gagal memuat detail DO Cost.'))
            .finally(() => setDoCostDetailLoading(false));
    };

    const handleOpenDetailDo = (item) => {
        setIsOutstandingModalOpen(false);
        setSelectedDo(item);
        setIsDetailDoModalOpen(true);
        setSelectedDoDetails([]);
        setSelectedDoAddress('');
        setDetailDoError('');
        setDetailDoSearch('');
        setDetailDoPageSize(5);
        setDetailDoCurrentPage(1);
    };

    // --- Debounce Input Pencarian (Optimasi Filter Tabel) ---
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Pemrosesan Data List ---
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedMaterials = materialsList;

    const outstandingDeliveryOrders = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        return outstandingList
            .filter((item) =>
                !term
                    ? true
                    : [item.no_do, item.ref_po, item.nm_cs].some((value) =>
                        String(value ?? '')
                            .toLowerCase()
                            .includes(term),
                    ),
            )
            .sort((a, b) => {
                const dateCompare = String(b.date ?? '').localeCompare(
                    String(a.date ?? ''),
                );
                return dateCompare !== 0
                    ? dateCompare
                    : String(b.no_do ?? '').localeCompare(
                        String(a.no_do ?? ''),
                    );
            });
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = outstandingDeliveryOrders.length;
    const outstandingTotalPages = useMemo(
        () =>
            outstandingPageSize === Infinity
                ? 1
                : Math.max(
                    1,
                    Math.ceil(outstandingTotalItems / outstandingPageSize),
                ),
        [outstandingPageSize, outstandingTotalItems],
    );
    const displayedOutstandingDeliveryOrders = useMemo(() => {
        if (outstandingPageSize === Infinity) return outstandingDeliveryOrders;
        const start = (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingDeliveryOrders.slice(
            start,
            start + outstandingPageSize,
        );
    }, [
        outstandingCurrentPage,
        outstandingDeliveryOrders,
        outstandingPageSize,
    ]);

    const detailDoTotalItems = selectedDoDetails.length;
    const detailDoTotalPages = Math.max(
        1,
        detailDoPageSize === Infinity
            ? 1
            : Math.ceil(detailDoTotalItems / detailDoPageSize),
    );
    const displayedDoDetails = useMemo(() => {
        if (detailDoPageSize === Infinity) return selectedDoDetails;
        const start = (detailDoCurrentPage - 1) * detailDoPageSize;
        return selectedDoDetails.slice(start, start + detailDoPageSize);
    }, [detailDoCurrentPage, detailDoPageSize, selectedDoDetails]);
    const selectedDoGrandTotal = useMemo(
        () =>
            selectedDoDetails.reduce(
                (total, detail) =>
                    total + toNumber(detail?.total ?? detail?.Total),
                0,
            ),
        [selectedDoDetails],
    );
    const filteredDotOutstanding = useMemo(() => {
        const term = dotOutstandingSearch.trim().toLowerCase();
        return dotOutstandingList.filter((item) => {
            if (!term) return true;
            return [item.no_dob, item.ref_do, item.nm_cs].some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            );
        });
    }, [dotOutstandingList, dotOutstandingSearch]);
    const dotOutstandingTotalPages = Math.max(
        1,
        dotOutstandingPageSize === Infinity
            ? 1
            : Math.ceil(filteredDotOutstanding.length / dotOutstandingPageSize),
    );
    const displayedDotOutstanding = useMemo(() => {
        if (dotOutstandingPageSize === Infinity) return filteredDotOutstanding;
        const start = (dotOutstandingCurrentPage - 1) * dotOutstandingPageSize;
        return filteredDotOutstanding.slice(
            start,
            start + dotOutstandingPageSize,
        );
    }, [
        dotOutstandingCurrentPage,
        dotOutstandingPageSize,
        filteredDotOutstanding,
    ]);
    const filteredDotDetails = useMemo(() => {
        const term = dotDetailSearch.trim().toLowerCase();
        if (!term) return dotDetailItems;
        return dotDetailItems.filter((item) =>
            String(item.mat ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [dotDetailItems, dotDetailSearch]);
    const dotDetailTotalPages = Math.max(
        1,
        dotDetailPageSize === Infinity
            ? 1
            : Math.ceil(filteredDotDetails.length / dotDetailPageSize),
    );
    const displayedDotDetails = useMemo(() => {
        if (dotDetailPageSize === Infinity) return filteredDotDetails;
        const start = (dotDetailCurrentPage - 1) * dotDetailPageSize;
        return filteredDotDetails.slice(start, start + dotDetailPageSize);
    }, [dotDetailCurrentPage, dotDetailPageSize, filteredDotDetails]);
    const dotDetailGrandTotal = useMemo(
        () =>
            dotDetailItems.reduce(
                (total, item) => total + toNumber(item.total ?? item.Total),
                0,
            ),
        [dotDetailItems],
    );
    const filteredDoCostOutstanding = useMemo(() => {
        const term = doCostOutstandingSearch.trim().toLowerCase();
        if (!term) return doCostOutstandingList;
        return doCostOutstandingList.filter((item) =>
            [item.no_alokasi, item.ref_permintaan, item.kd_cs].some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            ),
        );
    }, [doCostOutstandingList, doCostOutstandingSearch]);
    const doCostOutstandingTotalPages = Math.max(
        1,
        doCostOutstandingPageSize === Infinity
            ? 1
            : Math.ceil(
                filteredDoCostOutstanding.length / doCostOutstandingPageSize,
            ),
    );
    const displayedDoCostOutstanding = useMemo(() => {
        if (doCostOutstandingPageSize === Infinity)
            return filteredDoCostOutstanding;
        const start =
            (doCostOutstandingCurrentPage - 1) * doCostOutstandingPageSize;
        return filteredDoCostOutstanding.slice(
            start,
            start + doCostOutstandingPageSize,
        );
    }, [
        doCostOutstandingCurrentPage,
        doCostOutstandingPageSize,
        filteredDoCostOutstanding,
    ]);
    const filteredDoCostDetails = useMemo(() => {
        const term = doCostDetailSearch.trim().toLowerCase();
        if (!term) return doCostDetailItems;
        return doCostDetailItems.filter((item) =>
            String(item.mat ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [doCostDetailItems, doCostDetailSearch]);
    const doCostDetailTotalPages = Math.max(
        1,
        doCostDetailPageSize === Infinity
            ? 1
            : Math.ceil(filteredDoCostDetails.length / doCostDetailPageSize),
    );
    const displayedDoCostDetails = useMemo(() => {
        if (doCostDetailPageSize === Infinity) return filteredDoCostDetails;
        const start = (doCostDetailCurrentPage - 1) * doCostDetailPageSize;
        return filteredDoCostDetails.slice(start, start + doCostDetailPageSize);
    }, [doCostDetailCurrentPage, doCostDetailPageSize, filteredDoCostDetails]);
    const doCostDetailGrandTotal = useMemo(
        () =>
            doCostDetailItems.reduce(
                (total, item) => total + toNumber(item.total ?? item.Total),
                0,
            ),
        [doCostDetailItems],
    );
    const inventoryRowsTotalPages = Math.max(
        1,
        inventoryRowsPageSize === Infinity
            ? 1
            : Math.ceil(inventoryRowsTotal / inventoryRowsPageSize),
    );

    const movementData = useMemo(() => {
        const base = movementCategories.reduce((acc, category) => {
            acc[category.key] = {
                ...category,
                count: 0,
                stock: 0,
                total: 0,
                rows: [],
                warehouses: [],
            };
            return acc;
        }, {});

        movementMaterials.forEach((material) => {
            const grouped = movementCategories.reduce((acc, category) => {
                acc[category.key] = null;
                return acc;
            }, {});

            materialMovementRows(material).forEach((row) => {
                const kategori = String(row.kategori ?? '').toLowerCase();
                const category = movementCategories.find((item) =>
                    kategori.includes(item.matcher),
                );

                if (!category) {
                    return;
                }

                if (!grouped[category.key]) {
                    grouped[category.key] = {
                        kd_material: material?.kd_material,
                        material: material?.material,
                        stocks: {},
                        prices: {},
                        stock: 0,
                        total: 0,
                    };
                }

                grouped[category.key].stocks[row.gudang] = row.stok;
                grouped[category.key].prices[row.gudang] = row.harga;
                grouped[category.key].stock += row.stok;
                grouped[category.key].total += row.total;
            });

            Object.entries(grouped).forEach(([key, row]) => {
                if (!row) {
                    return;
                }

                base[key].count += 1;
                base[key].stock += row.stock;
                base[key].total += row.total;
                base[key].rows.push(row);
                Object.keys(row.stocks).forEach((gudang) => {
                    if (!base[key].warehouses.includes(gudang)) {
                        base[key].warehouses.push(gudang);
                    }
                });
            });
        });

        Object.values(base).forEach((category) => {
            category.warehouses.sort((a, b) => a.localeCompare(b));
        });

        return base;
    }, [movementMaterials]);

    const selectedMovement = movementModal ? movementData[movementModal] : null;
    const movementWarehouses = selectedMovement?.warehouses ?? [];
    const selectedWarehouse = warehouseOptions.find(
        (warehouse) => warehouse.value === warehouseModal,
    );
    const selectedWarehouseSummary = warehouseModal
        ? warehouseSummaries[warehouseModal]
        : null;
    const movementRows = useMemo(() => {
        const term = movementSearchTerm.trim().toLowerCase();
        const rows =
            selectedMovement?.rows ??
            (selectedWarehouse
                ? movementMaterials.flatMap((material) =>
                    materialMovementRows(material)
                        .filter(
                            (row) =>
                                row.gudang.toLowerCase() ===
                                selectedWarehouse.value,
                        )
                        .filter((row) => {
                            const kategori = String(row.kategori ?? '')
                                .trim()
                                .toLowerCase();
                            return kategori !== '' && kategori !== '0';
                        }),
                )
                : []);
        const filteredRows = term
            ? rows.filter((row) =>
                [row.kd_material, row.material, row.kategori].some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
                ),
            )
            : rows;

        return [...filteredRows].sort((a, b) =>
            compareCode(a.kd_material, b.kd_material),
        );
    }, [
        movementMaterials,
        movementSearchTerm,
        selectedMovement,
        selectedWarehouse,
    ]);

    const movementTotalItems = movementRows.length;
    const movementTotalPages = useMemo(() => {
        return Math.max(1, Math.ceil(movementTotalItems / movementPageSize));
    }, [movementPageSize, movementTotalItems]);

    const displayedMovementRows = useMemo(() => {
        const startIndex = (movementCurrentPage - 1) * movementPageSize;
        return movementRows.slice(startIndex, startIndex + movementPageSize);
    }, [movementCurrentPage, movementPageSize, movementRows]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (movementCurrentPage > movementTotalPages) {
            setMovementCurrentPage(movementTotalPages);
        }
    }, [movementCurrentPage, movementTotalPages]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    useEffect(() => {
        if (!selectedDo || !isDetailDoModalOpen) return;
        const timer = setTimeout(
            () => {
                setDetailDoLoading(true);
                setDetailDoError('');
                const params = new URLSearchParams({ no_do: selectedDo.no_do });
                if (detailDoSearch.trim()) {
                    params.append('search', detailDoSearch.trim());
                }
                fetch(
                    `/marketing/delivery-order/details?${params.toString()}`,
                    {
                        headers: { Accept: 'application/json' },
                    },
                )
                    .then((response) => {
                        if (!response.ok) throw new Error('Request failed');
                        return response.json();
                    })
                    .then((result) => {
                        setSelectedDoDetails(
                            Array.isArray(result?.deliveryOrderDetails)
                                ? result.deliveryOrderDetails
                                : [],
                        );
                        setSelectedDoAddress(result?.customerAddress ?? '');
                        setDetailDoCurrentPage(1);
                    })
                    .catch(() => setDetailDoError('Gagal memuat detail DO.'))
                    .finally(() => setDetailDoLoading(false));
            },
            detailDoSearch ? 500 : 0,
        );
        return () => clearTimeout(timer);
    }, [detailDoSearch, isDetailDoModalOpen, selectedDo]);

    useEffect(() => {
        if (detailDoCurrentPage > detailDoTotalPages) {
            setDetailDoCurrentPage(detailDoTotalPages);
        }
    }, [detailDoCurrentPage, detailDoTotalPages]);

    useEffect(() => {
        setDotOutstandingCurrentPage(1);
    }, [dotOutstandingPageSize, dotOutstandingSearch]);

    useEffect(() => {
        if (dotOutstandingCurrentPage > dotOutstandingTotalPages) {
            setDotOutstandingCurrentPage(dotOutstandingTotalPages);
        }
    }, [dotOutstandingCurrentPage, dotOutstandingTotalPages]);

    useEffect(() => {
        setDotDetailCurrentPage(1);
    }, [dotDetailPageSize, dotDetailSearch]);

    useEffect(() => {
        setDoCostOutstandingCurrentPage(1);
    }, [doCostOutstandingPageSize, doCostOutstandingSearch]);

    useEffect(() => {
        if (doCostOutstandingCurrentPage > doCostOutstandingTotalPages) {
            setDoCostOutstandingCurrentPage(doCostOutstandingTotalPages);
        }
    }, [doCostOutstandingCurrentPage, doCostOutstandingTotalPages]);

    useEffect(() => {
        setDoCostDetailCurrentPage(1);
    }, [doCostDetailPageSize, doCostDetailSearch]);

    const fetchInventoryMetrics = () => {
        inventoryCardTypes.forEach(({ key }) => {
            ['items', 'qty', 'total'].forEach((metric) => {
                fetch(
                    `/master-data/material/inventory-summary?type=${key}&metric=${metric}`,
                    { headers: { Accept: 'application/json' } },
                )
                    .then((response) => {
                        if (!response.ok) throw new Error('Request failed');
                        return response.json();
                    })
                    .then((result) =>
                        setInventorySummaries((current) => ({
                            ...current,
                            [key]: {
                                ...current[key],
                                [metric]: toNumber(result?.value),
                            },
                        })),
                    )
                    .catch(() => { })
                    .finally(() =>
                        setInventorySummaryLoading((current) => ({
                            ...current,
                            [key]: {
                                ...current[key],
                                [metric]: false,
                            },
                        })),
                    );
            });
        });
    };

    const handleCardTabChange = (tab) => {
        if (activeCardTab === tab) {
            setActiveCardTab('');
            return;
        }
        setActiveCardTab(tab);
        if (loadedCardTabs.current.has(tab)) return;
        loadedCardTabs.current.add(tab);

        if (tab === 'category') fetchAllMovementMetrics();
        if (tab === 'do') fetchDoMetrics();
        if (tab === 'inventory') fetchInventoryMetrics();
        if (tab === 'warehouse') fetchAllWarehouseSummaries();
    };

    const refreshLoadedCardMetrics = () => {
        refreshRows();
        refreshMovementRows();
        if (loadedCardTabs.current.has('category')) fetchAllMovementMetrics();
        if (loadedCardTabs.current.has('warehouse'))
            fetchAllWarehouseSummaries();
    };

    useEffect(() => {
        if (!inventoryModalType) return;
        const timer = setTimeout(
            () => {
                setInventoryRowsLoading(true);
                setInventoryRowsError('');
                const params = new URLSearchParams({
                    type: inventoryModalType,
                    search: inventoryRowsSearch,
                    page: String(inventoryRowsCurrentPage),
                    per_page:
                        inventoryRowsPageSize === Infinity
                            ? 'all'
                            : String(inventoryRowsPageSize),
                });
                fetch(`/master-data/material/inventory-rows?${params}`, {
                    headers: { Accept: 'application/json' },
                })
                    .then((response) => {
                        if (!response.ok) throw new Error('Request failed');
                        return response.json();
                    })
                    .then((result) => {
                        setInventoryRows(
                            Array.isArray(result?.rows) ? result.rows : [],
                        );
                        setInventoryRowsTotal(toNumber(result?.total));
                    })
                    .catch(() => {
                        setInventoryRows([]);
                        setInventoryRowsTotal(0);
                        setInventoryRowsError('Gagal memuat data material.');
                    })
                    .finally(() => setInventoryRowsLoading(false));
            },
            inventoryRowsSearch ? 400 : 0,
        );
        return () => clearTimeout(timer);
    }, [
        inventoryModalType,
        inventoryRowsCurrentPage,
        inventoryRowsPageSize,
        inventoryRowsSearch,
    ]);

    useEffect(() => {
        setInventoryRowsCurrentPage(1);
    }, [inventoryModalType, inventoryRowsPageSize, inventoryRowsSearch]);

    useEffect(() => {
        if (inventoryRowsCurrentPage > inventoryRowsTotalPages) {
            setInventoryRowsCurrentPage(inventoryRowsTotalPages);
        }
    }, [inventoryRowsCurrentPage, inventoryRowsTotalPages]);

    // --- Handlers ---
    const handleSubmit = (event) => {
        event.preventDefault();
        post('/master-data/material', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setIsModalOpen(false);
                refreshLoadedCardMetrics();
            },
        });
    };

    const handleEdit = (material) => {
        // Form Edit langsung mengambil data dari props tabel, sehingga tidak butuh loading/fetch API
        setEditingMaterial(material);
        setEditData({
            material: material.material ?? '',
            unit: material.unit ?? '',
            stok: material.stok ?? 0,
            remark: material.kategori_stok1 ?? '',
        });
        setIsEditModalOpen(true);
    };

    const handleExport = () => {
        const params = new URLSearchParams(exportFilters);
        window.open(
            `/master-data/material/export?${params.toString()}`,
            '_blank',
            'noopener,noreferrer',
        );
        setIsExportModalOpen(false);
    };

    const handleUpdate = (event) => {
        event.preventDefault();
        if (!editingMaterial?.kd_material) {
            return;
        }
        put(
            `/master-data/material/${encodeURIComponent(editingMaterial.kd_material)}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    resetEdit();
                    setEditingMaterial(null);
                    setIsEditModalOpen(false);
                    refreshLoadedCardMetrics();
                },
            },
        );
    };

    const handleDelete = async (material) => {
        if (!material?.kd_material) {
            return;
        }
        const ok = await confirmDelete({
            title: 'Hapus material?',
            text: `Kode material: ${material.kd_material}`,
        });
        if (!ok) return;
        router.delete(
            `/master-data/material/${encodeURIComponent(material.kd_material)}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    refreshLoadedCardMetrics();
                },
            },
        );
    };

    const moduleHubItems = [
        {
            key: 'category',
            title: 'Kategori Pergerakan',
            subtitle: 'Fast, Slow & Dead Stok',
            icon: TrendingUp,
            accent: 'emerald',
            activeBorder: 'border-emerald-500/50 shadow-emerald-500/15',
            iconWrap:
                'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
            topHairline: 'before:via-emerald-500/50',
            badgeClass:
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        },
        {
            key: 'do',
            title: 'Delivery Order (DO)',
            subtitle: 'DO, DO Add & DO Cost',
            icon: Truck,
            accent: 'amber',
            activeBorder: 'border-amber-500/50 shadow-amber-500/15',
            iconWrap:
                'bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
            topHairline: 'before:via-amber-500/50',
            badgeClass:
                'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
        },
        {
            key: 'inventory',
            title: 'MIS, MIB & MIBS',
            subtitle: 'Ringkasan Dokumen Stok',
            icon: Layers,
            accent: 'sky',
            activeBorder: 'border-sky-500/50 shadow-sky-500/15',
            iconWrap:
                'bg-gradient-to-br from-sky-500/20 to-cyan-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
            topHairline: 'before:via-sky-500/50',
            badgeClass:
                'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
        },
        {
            key: 'warehouse',
            title: 'Distribusi Gudang',
            subtitle: 'Gudang 1 s/d Gudang 4',
            icon: Warehouse,
            accent: 'indigo',
            activeBorder: 'border-indigo-500/50 shadow-indigo-500/15',
            iconWrap:
                'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
            topHairline: 'before:via-indigo-500/50',
            badgeClass:
                'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
        },
    ];

    const stockFilterPills = [
        { value: 'all', label: 'Semua' },
        { value: 'top', label: 'Terbanyak' },
        { value: 'low', label: 'Sedikit (>0)' },
        { value: 'empty', label: 'Kosong' },
    ];

    return (
        <>
            <Head title="Data Material" />

            {/* ── Main Container with Dashboard Dot Grid & Atmospheric Ornaments ── */}
            <div className="relative min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px]">
                <MaterialOrnaments />

                {/* ── Error Banner ─────────────────────────────────────────── */}
                <AnimatePresence>
                    {tableError && (
                        <motion.div
                            role="alert"
                            initial={{ opacity: 0, y: -10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.25 }}
                            className="relative z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 backdrop-blur-xl shadow-lg shadow-rose-500/5"
                        >
                            <div className="flex items-center gap-2.5 font-semibold">
                                <AlertCircle className="size-4.5 shrink-0" />
                                <span>{tableError}</span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={refreshRows}
                                className="rounded-xl text-xs font-bold"
                            >
                                Coba lagi
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── 1. Executive Material Command Hero Header ─────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between rounded-3xl border border-sidebar-border/70 bg-gradient-to-r from-card/95 via-card/85 to-card/70 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/35 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/35 before:to-transparent overflow-hidden"
                >
                    <div className="flex items-start sm:items-center gap-4">
                        <motion.div
                            whileHover={{ rotate: 6, scale: 1.06 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/10 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-500/10"
                        >
                            <Boxes className="size-7 text-emerald-500 dark:text-emerald-400" />
                        </motion.div>

                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Master Inventory
                                </span>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
                                    <Package className="size-3.5 text-teal-500" />
                                    {formatNumber(totalItems)} Material Terdaftar
                                </span>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                                Manajemen{' '}
                                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                                    Data Material
                                </span>
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Pantau pergerakan stok gudang, kategori pergerakan, DO outstanding, dan kartu stok secara terpusat.
                            </p>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <motion.button
                            type="button"
                            onClick={() => setIsExportModalOpen(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-sidebar-border/70 bg-background/80 px-4 py-2.5 text-xs font-bold text-foreground shadow-xs hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer"
                        >
                            <Download className="size-3.5 text-sky-500" />
                            <span>Export Data</span>
                        </motion.button>

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <MenuAction
                                action="create"
                                onClick={() => setIsModalOpen(true)}
                                className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 active:brightness-95 border-0 transition-all cursor-pointer"
                            >
                                <Plus className="mr-1.5 size-4" />
                                Tambah Material
                            </MenuAction>
                        </motion.div>
                    </div>
                </motion.div>

                {/* ── 2. Interactive Analytics Command Hub (4 Collapsible Modules) ─ */}
                <div className="relative z-10 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                        {moduleHubItems.map((mod, idx) => {
                            const Icon = mod.icon;
                            const isActive = activeCardTab === mod.key;
                            return (
                                <motion.button
                                    key={mod.key}
                                    type="button"
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35, delay: 0.04 * idx }}
                                    whileHover={{ y: -3, transition: { duration: 0.18 } }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleCardTabChange(mod.key)}
                                    className={cn(
                                        'group relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border bg-card/85 dark:bg-card/55 p-4 text-left backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 transition-all cursor-pointer before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent',
                                        mod.topHairline,
                                        isActive
                                            ? `${mod.activeBorder} ring-1 ring-inset ring-white/10 bg-card`
                                            : 'border-sidebar-border/70 hover:border-sidebar-border',
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={cn(
                                                'flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-200 group-hover:scale-105',
                                                mod.iconWrap,
                                            )}
                                        >
                                            <Icon className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-bold text-foreground">
                                                    {mod.title}
                                                </span>
                                            </div>
                                            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                                                {mod.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isActive && (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className={cn(
                                                    'hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                                    mod.badgeClass,
                                                )}
                                            >
                                                Aktif
                                            </motion.span>
                                        )}
                                        <motion.span
                                            animate={{ rotate: isActive ? 180 : 0 }}
                                            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                                            className={cn(
                                                'flex size-8 items-center justify-center rounded-xl border border-sidebar-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:text-foreground',
                                                isActive && 'bg-foreground text-background border-foreground',
                                            )}
                                        >
                                            <ChevronDown className="size-4" />
                                        </motion.span>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* ── Expandable Analytics Drawer with AnimatePresence ── */}
                    <AnimatePresence mode="wait">
                        {activeCardTab === 'category' && (
                            <motion.div
                                key="drawer-category"
                                initial={{ opacity: 0, y: -12, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="grid gap-4 md:grid-cols-3"
                            >
                                {movementCategories.map((category, idx) => {
                                    const item = movementMetrics[category.key];
                                    const loading = movementMetricLoading[category.key];
                                    const theme =
                                        category.key === 'fast'
                                            ? {
                                                color: 'emerald',
                                                icon: TrendingUp,
                                                border: 'hover:border-emerald-500/45 hover:shadow-emerald-500/10 before:via-emerald-500/40',
                                                badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                                valueText: 'text-emerald-600 dark:text-emerald-400',
                                            }
                                            : category.key === 'slow'
                                                ? {
                                                    color: 'amber',
                                                    icon: Clock,
                                                    border: 'hover:border-amber-500/45 hover:shadow-amber-500/10 before:via-amber-500/40',
                                                    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                                    valueText: 'text-amber-600 dark:text-amber-400',
                                                }
                                                : {
                                                    color: 'rose',
                                                    icon: TrendingDown,
                                                    border: 'hover:border-rose-500/45 hover:shadow-rose-500/10 before:via-rose-500/40',
                                                    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                                                    valueText: 'text-rose-600 dark:text-rose-400',
                                                };
                                    const CatIcon = theme.icon;

                                    return (
                                        <motion.div
                                            key={category.key}
                                            role="button"
                                            tabIndex={0}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.32, delay: idx * 0.06 }}
                                            whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                            whileTap={{ scale: 0.985 }}
                                            onClick={() => {
                                                setMovementModal(category.key);
                                                setMovementSearchTerm('');
                                                setMovementPageSize(5);
                                                setMovementCurrentPage(1);
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === 'Enter' ||
                                                    event.key === ' '
                                                ) {
                                                    event.preventDefault();
                                                    setMovementModal(category.key);
                                                    setMovementSearchTerm('');
                                                    setMovementPageSize(5);
                                                    setMovementCurrentPage(1);
                                                }
                                            }}
                                            className={cn(
                                                'group relative cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent',
                                                theme.border,
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                                                        theme.badge,
                                                    )}
                                                >
                                                    <CatIcon className="size-3.5" />
                                                    {category.title}
                                                </span>
                                                <CategorySparkWave color={theme.color} />
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Jumlah Stok
                                                    </div>
                                                    <div className="mt-1 text-xl font-black tracking-tight text-foreground tabular-nums">
                                                        {loading?.stock ? (
                                                            <Skeleton className="h-7 w-20" />
                                                        ) : (
                                                            formatNumber(item?.stock)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Jumlah Item
                                                    </div>
                                                    <div className="mt-1 text-xl font-black tracking-tight text-foreground tabular-nums">
                                                        {loading?.items ? (
                                                            <Skeleton className="h-7 w-16" />
                                                        ) : (
                                                            formatNumber(item?.items)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border/40 pt-3">
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Total Valuasi Harga
                                                    </div>
                                                    <div className={cn('mt-0.5 text-sm font-black tabular-nums', theme.valueText)}>
                                                        {loading?.total ? (
                                                            <Skeleton className="h-5 w-28" />
                                                        ) : (
                                                            `Rp ${formatNumber(item?.total)}`
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 rounded-xl bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                                    Detail
                                                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}

                        {activeCardTab === 'do' && (
                            <motion.div
                                key="drawer-do"
                                initial={{ opacity: 0, y: -12, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="grid gap-4 md:grid-cols-3"
                            >
                                {/* Card 1: DO Outstanding */}
                                <motion.button
                                    type="button"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.32, delay: 0 }}
                                    whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => {
                                        setIsOutstandingModalOpen(true);
                                        loadOutstanding();
                                    }}
                                    className="group relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 text-left backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-amber-500/45 hover:shadow-amber-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-500/40 before:to-transparent"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                            <Truck className="size-3.5" />
                                            DO Outstanding
                                        </span>
                                        <CategorySparkWave color="amber" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Item
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {outstandingCountLoading ? (
                                                    <Skeleton className="h-7 w-16" />
                                                ) : (
                                                    formatNumber(outstandingCount)
                                                )}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Qty
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {outstandingQtyLoading ? (
                                                    <Skeleton className="h-7 w-20" />
                                                ) : (
                                                    formatNumber(outstandingQty)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border/40 pt-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Grand Total Outstanding
                                            </p>
                                            <div className="mt-0.5 text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                                                {outstandingTotalLoading ? (
                                                    <Skeleton className="h-5 w-24" />
                                                ) : (
                                                    `Rp ${formatNumber(outstandingTotal)}`
                                                )}
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 rounded-xl bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                            Buka
                                            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </motion.button>

                                {/* Card 2: DO Add */}
                                <motion.button
                                    type="button"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.32, delay: 0.06 }}
                                    whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => {
                                        setIsDotOutstandingModalOpen(true);
                                        loadDotOutstanding();
                                    }}
                                    className="group relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 text-left backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-sky-500/45 hover:shadow-sky-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-500/40 before:to-transparent"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                                            <ClipboardList className="size-3.5" />
                                            DO Add
                                        </span>
                                        <CategorySparkWave color="sky" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Item
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {dotOutstandingCountLoading ? (
                                                    <Skeleton className="h-7 w-16" />
                                                ) : (
                                                    formatNumber(dotOutstandingCount)
                                                )}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Qty
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {dotOutstandingQtyLoading ? (
                                                    <Skeleton className="h-7 w-20" />
                                                ) : (
                                                    formatNumber(dotOutstandingQty)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border/40 pt-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                DOT Belum Dibebankan
                                            </p>
                                            <div className="mt-0.5 text-sm font-black text-sky-600 dark:text-sky-400 tabular-nums">
                                                {dotOutstandingTotalLoading ? (
                                                    <Skeleton className="h-5 w-24" />
                                                ) : (
                                                    `Rp ${formatNumber(dotOutstandingTotal)}`
                                                )}
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 rounded-xl bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                            Buka
                                            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </motion.button>

                                {/* Card 3: DO Cost */}
                                <motion.button
                                    type="button"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.32, delay: 0.12 }}
                                    whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => {
                                        setIsDoCostOutstandingModalOpen(true);
                                        loadDoCostOutstanding();
                                    }}
                                    className="group relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 text-left backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-indigo-500/45 hover:shadow-indigo-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-indigo-500/40 before:to-transparent"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                            <FileSpreadsheet className="size-3.5" />
                                            DO Cost
                                        </span>
                                        <CategorySparkWave color="indigo" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Item
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {doCostOutstandingCountLoading ? (
                                                    <Skeleton className="h-7 w-16" />
                                                ) : (
                                                    formatNumber(doCostOutstandingCount)
                                                )}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Jumlah Qty
                                            </p>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                {doCostOutstandingQtyLoading ? (
                                                    <Skeleton className="h-7 w-20" />
                                                ) : (
                                                    formatNumber(doCostOutstandingQty)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border/40 pt-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                DO Biaya Belum Dibebankan
                                            </p>
                                            <div className="mt-0.5 text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                {doCostOutstandingTotalLoading ? (
                                                    <Skeleton className="h-5 w-24" />
                                                ) : (
                                                    `Rp ${formatNumber(doCostOutstandingTotal)}`
                                                )}
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 rounded-xl bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                            Buka
                                            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </motion.button>
                            </motion.div>
                        )}

                        {activeCardTab === 'inventory' && (
                            <motion.div
                                key="drawer-inventory"
                                initial={{ opacity: 0, y: -12, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="grid gap-4 md:grid-cols-3"
                            >
                                {inventoryCardTypes.map((card, idx) => {
                                    const summary = inventorySummaries[card.key];
                                    const loading = inventorySummaryLoading[card.key];
                                    const theme =
                                        card.key === 'mis'
                                            ? {
                                                color: 'sky',
                                                border: 'hover:border-sky-500/45 hover:shadow-sky-500/10 before:via-sky-500/40',
                                                badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
                                                value: 'text-sky-600 dark:text-sky-400',
                                            }
                                            : card.key === 'mib'
                                                ? {
                                                    color: 'teal',
                                                    border: 'hover:border-teal-500/45 hover:shadow-teal-500/10 before:via-teal-500/40',
                                                    badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
                                                    value: 'text-teal-600 dark:text-teal-400',
                                                }
                                                : {
                                                    color: 'indigo',
                                                    border: 'hover:border-indigo-500/45 hover:shadow-indigo-500/10 before:via-indigo-500/40',
                                                    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                                                    value: 'text-indigo-600 dark:text-indigo-400',
                                                };

                                    return (
                                        <motion.div
                                            key={card.key}
                                            role="button"
                                            tabIndex={0}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.32, delay: idx * 0.06 }}
                                            whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                            whileTap={{ scale: 0.985 }}
                                            onClick={() => {
                                                setInventoryRowsSearch('');
                                                setInventoryRowsPageSize(5);
                                                setInventoryRowsCurrentPage(1);
                                                setInventoryModalType(card.key);
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === 'Enter' ||
                                                    event.key === ' '
                                                ) {
                                                    event.preventDefault();
                                                    setInventoryModalType(card.key);
                                                }
                                            }}
                                            className={cn(
                                                'group relative cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent',
                                                theme.border,
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                                                        theme.badge,
                                                    )}
                                                >
                                                    <Layers className="size-3.5" />
                                                    {card.title}
                                                </span>
                                                <CategorySparkWave color={theme.color} />
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Jumlah Item
                                                    </div>
                                                    <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                        {loading?.items ? (
                                                            <Skeleton className="h-7 w-16" />
                                                        ) : (
                                                            formatNumber(summary?.items)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-sidebar-border/50 bg-muted/25 p-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Jumlah Qty
                                                    </div>
                                                    <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                                        {loading?.qty ? (
                                                            <Skeleton className="h-7 w-20" />
                                                        ) : (
                                                            formatNumber(summary?.qty)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border/40 pt-3">
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Total Harga
                                                    </div>
                                                    <div className={cn('mt-0.5 text-sm font-black tabular-nums', theme.value)}>
                                                        {loading?.total ? (
                                                            <Skeleton className="h-5 w-28" />
                                                        ) : (
                                                            `Rp ${formatNumber(summary?.total)}`
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 rounded-xl bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                                    Rincian
                                                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}

                        {activeCardTab === 'warehouse' && (
                            <motion.div
                                key="drawer-warehouse"
                                initial={{ opacity: 0, y: -12, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                            >
                                {warehouseOptions.map((warehouse, idx) => {
                                    const summary = warehouseSummaries[warehouse.value];

                                    return (
                                        <motion.div
                                            key={warehouse.value}
                                            role="button"
                                            tabIndex={0}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.32, delay: idx * 0.05 }}
                                            whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                            whileTap={{ scale: 0.985 }}
                                            onClick={() => {
                                                setWarehouseModal(warehouse.value);
                                                setMovementSearchTerm('');
                                                setMovementPageSize(5);
                                                setMovementCurrentPage(1);
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === 'Enter' ||
                                                    event.key === ' '
                                                ) {
                                                    event.preventDefault();
                                                    setWarehouseModal(warehouse.value);
                                                    setMovementSearchTerm('');
                                                    setMovementPageSize(5);
                                                    setMovementCurrentPage(1);
                                                }
                                            }}
                                            className="group relative cursor-pointer overflow-hidden rounded-3xl border border-sidebar-border/70 bg-gradient-to-br from-card/95 via-card/75 to-background/60 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-indigo-500/45 hover:shadow-indigo-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-indigo-500/40 before:to-transparent"
                                        >
                                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-sidebar-border/40">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                        <Warehouse className="size-4" />
                                                    </div>
                                                    <span className="text-sm font-bold text-foreground">
                                                        {warehouse.label}
                                                    </span>
                                                </div>
                                                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                                            </div>

                                            <div className="mt-3 space-y-3">
                                                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3">
                                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                                        Total Gudang
                                                    </div>
                                                    <div className="grid gap-1.5 text-xs text-muted-foreground">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span>Total stok</span>
                                                            <span className="font-black text-foreground tabular-nums">
                                                                <MetricValue loading={summary?.loading}>
                                                                    {formatNumber(summary?.total?.stock)}
                                                                </MetricValue>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span>Total item</span>
                                                            <span className="font-black text-foreground tabular-nums">
                                                                <MetricValue loading={summary?.loading}>
                                                                    {formatNumber(summary?.total?.items)}
                                                                </MetricValue>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3 border-t border-indigo-500/15 pt-1.5 mt-0.5">
                                                            <span>Total harga</span>
                                                            <span className="font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                                <MetricValue loading={summary?.loading} className="h-5 w-20">
                                                                    Rp {formatNumber(summary?.total?.total)}
                                                                </MetricValue>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {summary?.loading ? (
                                                    <div className="space-y-2.5">
                                                        <Skeleton className="h-24 w-full rounded-2xl" />
                                                        <Skeleton className="h-24 w-full rounded-2xl" />
                                                    </div>
                                                ) : summary?.categories?.length > 0 ? (
                                                    summary.categories.map((category) => (
                                                        <div
                                                            key={`${warehouse.value}-${category.key}`}
                                                            className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3 transition-colors group-hover:bg-muted/35"
                                                        >
                                                            <div className="mb-1.5 text-xs font-bold text-foreground">
                                                                {category.label}
                                                            </div>
                                                            <div className="grid gap-1 text-[11px] text-muted-foreground">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span>Jumlah stok</span>
                                                                    <span className="font-bold text-foreground tabular-nums">
                                                                        {formatNumber(category.stock)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span>Jumlah item</span>
                                                                    <span className="font-bold text-foreground tabular-nums">
                                                                        {formatNumber(category.items)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span>Total harga</span>
                                                                    <span className="font-bold text-foreground tabular-nums">
                                                                        Rp {formatNumber(category.total)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="rounded-2xl border border-dashed border-sidebar-border/70 p-3 text-center text-xs text-muted-foreground">
                                                        Belum ada kategori stok di gudang ini.
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── 3. Main Material Data Table Bento Panel ──────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 overflow-hidden rounded-3xl border border-sidebar-border/70 bg-card/85 dark:bg-card/55 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/35 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/35 before:to-transparent"
                >
                    {/* Top Table Ribbon Header */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-sidebar-border/40 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-xs">
                                <PackageSearch className="size-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                                        Daftar Master Material
                                    </h2>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Cari, filter berdasarkan kondisi stok, urutkan kode, dan kelola rincian material per gudang.
                                </p>
                            </div>
                        </div>

                        {/* Animated Stock Filter Pill Switcher (Motion layoutId) */}
                        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-muted/40 p-1 border border-sidebar-border/60 self-start lg:self-auto">
                            {stockFilterPills.map((opt) => {
                                const active = stockFilter === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setStockFilter(opt.value);
                                            setCurrentPage(1);
                                        }}
                                        className={cn(
                                            'relative rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                                            active
                                                ? 'text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {active && (
                                            <motion.div
                                                layoutId="material-stock-filter-pill"
                                                className="absolute inset-0 rounded-xl bg-background shadow-xs border border-sidebar-border/60"
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 450,
                                                    damping: 30,
                                                }}
                                            />
                                        )}
                                        <span className="relative z-10">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <SlidersHorizontal className="size-3.5 text-emerald-500 shrink-0" />
                                <label className="flex items-center gap-1.5 text-xs font-semibold">
                                    Tampilkan
                                    <select
                                        className="rounded-xl border border-sidebar-border/70 bg-background/80 px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 cursor-pointer"
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
                                            setCurrentPage(1);
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

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <ArrowUpDown className="size-3.5 text-teal-500 shrink-0" />
                                <label className="flex items-center gap-1.5 text-xs font-semibold">
                                    Urut kode
                                    <select
                                        className="rounded-xl border border-sidebar-border/70 bg-background/80 px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        value={codeOrder}
                                        onChange={(event) => {
                                            setCodeOrder(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                        disabled={stockFilter !== 'all'}
                                    >
                                        <option value="asc">
                                            Kode Material A-Z
                                        </option>
                                        <option value="desc">
                                            Kode Material Z-A
                                        </option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="relative flex items-center w-full sm:w-auto">
                            <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
                            <input
                                type="search"
                                className="w-full sm:w-72 md:w-80 rounded-xl border border-sidebar-border/70 bg-background/80 py-1.5 pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground transition-all hover:border-emerald-500/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                                placeholder="Cari nama atau kode material..."
                                value={searchTerm}
                                onChange={(event) => {
                                    setSearchTerm(event.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setCurrentPage(1);
                                    }}
                                    aria-label="Hapus pencarian"
                                    className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="mt-4 overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background/40">
                        <div className="max-h-[65vh] overflow-auto overscroll-contain">
                            <table className="w-full table-auto text-sm">
                                <thead className="sticky top-0 z-10 bg-muted/85 text-muted-foreground backdrop-blur-md">
                                    <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                        <th className="w-1 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            No
                                        </th>
                                        <th className="w-1 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            Kode Material
                                        </th>
                                        <th className="w-full px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            Nama Material
                                        </th>
                                        <th className="w-1 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            Satuan
                                        </th>
                                        <th className="w-1 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            Total Stok
                                        </th>
                                        <th className="w-1 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableLoading ? (
                                        <tr>
                                            <td className="px-4 py-6" colSpan={6}>
                                                <div className="flex flex-col gap-3">
                                                    <Skeleton className="h-9 w-full rounded-xl opacity-75" />
                                                    <Skeleton className="h-9 w-full rounded-xl opacity-60" />
                                                    <Skeleton className="h-9 w-full rounded-xl opacity-45" />
                                                    <Skeleton className="h-9 w-4/5 rounded-xl opacity-30" />
                                                </div>
                                            </td>
                                        </tr>
                                    ) : displayedMaterials.length === 0 ? (
                                        <tr>
                                            <td
                                                className="px-4 py-14 text-center"
                                                colSpan={6}
                                            >
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex flex-col items-center gap-3"
                                                >
                                                    <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-sidebar-border/60">
                                                        <PackageSearch className="size-7 text-muted-foreground/60" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground">
                                                            Data material belum tersedia
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            Coba ubah kata kunci pencarian atau tambahkan material baru.
                                                        </p>
                                                    </div>
                                                    <MenuAction
                                                        action="create"
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => setIsModalOpen(true)}
                                                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-md shadow-emerald-500/20"
                                                    >
                                                        <Plus className="mr-1.5 size-3.5" />
                                                        Tambah Material
                                                    </MenuAction>
                                                </motion.div>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedMaterials.map((item, index) => {
                                            const stockQty = toNumber(item.stok);
                                            const rowNum =
                                                (pageSize === Infinity
                                                    ? index
                                                    : (currentPage - 1) * pageSize + index) +
                                                1;
                                            return (
                                                <motion.tr
                                                    key={`${item.kd_material}-${index}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{
                                                        duration: 0.2,
                                                        delay: Math.min(index * 0.018, 0.22),
                                                    }}
                                                    className="group border-b border-slate-300/70 dark:border-slate-700/70 transition-colors duration-150 hover:bg-emerald-500/[0.06]"
                                                >
                                                    <td className="w-1 px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap tabular-nums">
                                                        {rowNum}
                                                    </td>
                                                    <td className="w-1 px-3 py-2.5 whitespace-nowrap">
                                                        <span className="inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-sans tabular-nums tracking-wide text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                            {renderValue(item.kd_material)}
                                                        </span>
                                                    </td>
                                                    <td className="w-full min-w-0 px-3 py-2.5 font-semibold text-foreground">
                                                        <div
                                                            className="truncate"
                                                            title={item.material}
                                                        >
                                                            {renderValue(item.material)}
                                                        </div>
                                                    </td>
                                                    <td className="w-1 px-3 py-2.5 whitespace-nowrap">
                                                        <span className="inline-flex items-center rounded-lg border border-sidebar-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                            {renderValue(item.unit)}
                                                        </span>
                                                    </td>
                                                    <td className="w-1 px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-black tabular-nums',
                                                                stockQty === 0
                                                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
                                                            )}
                                                        >
                                                            {formatNumber(item.stok)}
                                                        </span>
                                                    </td>
                                                    <td className="w-1 px-3 py-2.5 whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <ActionIconButton
                                                                label="Lihat detail stok"
                                                                onClick={() =>
                                                                    setViewingMaterial(item)
                                                                }
                                                                className="h-7 w-7 p-0 rounded-lg text-sky-600 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                                                            >
                                                                <Eye className="size-3.5" />
                                                            </ActionIconButton>
                                                            <MenuAction
                                                                action="update"
                                                                as={ActionIconButton}
                                                                label="Edit"
                                                                onClick={() => handleEdit(item)}
                                                                className="h-7 w-7 p-0 rounded-lg text-amber-600 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                                                            >
                                                                <Pencil className="size-3.5" />
                                                            </MenuAction>
                                                            {toNumber(item.stok) === 0 && (
                                                                <MenuAction
                                                                    action="delete"
                                                                    as={ActionIconButton}
                                                                    label="Hapus"
                                                                    onClick={() =>
                                                                        handleDelete(item)
                                                                    }
                                                                    className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:bg-rose-500/15 hover:text-rose-600 dark:text-rose-400 transition-colors"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </MenuAction>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Footer */}
                    {pageSize !== Infinity && totalItems > 0 && (
                        <div className="mt-4">
                            <ModalPagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPrev={() =>
                                    setCurrentPage((page) => Math.max(1, page - 1))
                                }
                                onNext={() =>
                                    setCurrentPage((page) =>
                                        Math.min(totalPages, page + 1),
                                    )
                                }
                            />
                        </div>
                    )}
                </motion.div>
            </div>

            <Dialog
                open={Boolean(inventoryModalType)}
                onOpenChange={(open) => {
                    if (!open) {
                        setInventoryModalType(null);
                        setInventoryRows([]);
                        setInventoryRowsTotal(0);
                        setInventoryRowsError('');
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                <Layers className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    Data {inventoryModalType?.toUpperCase()}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Data material read-only tanpa kolom aksi.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <ModalToolbar
                        pageSize={inventoryRowsPageSize}
                        onPageSizeChange={(val) => setInventoryRowsPageSize(val)}
                        searchValue={inventoryRowsSearch}
                        onSearchChange={(val) => setInventoryRowsSearch(val)}
                        searchPlaceholder="Cari nomor dokumen, ref PO, atau material..."
                    />

                    <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/80 text-muted-foreground">
                                    <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                        {(inventoryModalType === 'mibs'
                                            ? [
                                                'No MIB',
                                                'Material',
                                                'Qty',
                                                'Price',
                                                'Total Price',
                                                'MIBS',
                                            ]
                                            : [
                                                'No MI',
                                                'Date',
                                                'Ref PO',
                                                'Material',
                                                'Qty',
                                                'Price',
                                                'Total Price',
                                                inventoryModalType?.toUpperCase(),
                                            ]
                                        ).map((heading) => (
                                            <th
                                                key={heading}
                                                className={
                                                    [
                                                        'Qty',
                                                        'Price',
                                                        'Total Price',
                                                        'MIS',
                                                        'MIB',
                                                        'MIBS',
                                                    ].includes(heading)
                                                        ? 'px-4 py-3 text-right text-xs font-bold uppercase tracking-wider'
                                                        : 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider'
                                                }
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={inventoryRowsLoading}
                                        columns={
                                            inventoryModalType === 'mibs' ? 6 : 8
                                        }
                                        rows={5}
                                        isEmpty={
                                            !inventoryRowsLoading &&
                                            inventoryRows.length === 0
                                        }
                                        emptyMessage={
                                            inventoryRowsError || 'Tidak ada data.'
                                        }
                                    />
                                    {!inventoryRowsLoading &&
                                        inventoryRows.map((row, index) =>
                                            inventoryModalType === 'mibs' ? (
                                                <motion.tr
                                                    key={`${row.no_doc}-${index}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.2) }}
                                                    className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-sky-500/[0.05]"
                                                >
                                                    <td className="px-4 py-3 font-sans tabular-nums tracking-wide text-xs font-bold text-sky-600 dark:text-sky-400">
                                                        {renderValue(row.no_doc)}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">
                                                        {renderValue(row.material)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        {formatNumber(row.qty)}{' '}
                                                        {row.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        {formatNumber(row.price)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                                        {formatNumber(
                                                            row.total_price,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                                                        {formatNumber(
                                                            row.balance_qty,
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ) : (
                                                <motion.tr
                                                    key={`${row.no_doc}-${index}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.2) }}
                                                    className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-sky-500/[0.05]"
                                                >
                                                    <td className="px-4 py-3 font-sans tabular-nums tracking-wide text-xs font-bold text-sky-600 dark:text-sky-400">
                                                        {renderValue(row.no_doc)}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {renderValue(row.doc_tgl)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(row.ref_po)}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">
                                                        {renderValue(row.material)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        {formatNumber(row.qty)}{' '}
                                                        {row.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        {formatNumber(row.price)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                                        {formatNumber(
                                                            row.total_price,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                                                        {formatNumber(
                                                            row.balance_qty,
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ),
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {inventoryRowsPageSize !== Infinity &&
                        inventoryRowsTotal > 0 && (
                            <ModalPagination
                                currentPage={inventoryRowsCurrentPage}
                                totalPages={inventoryRowsTotalPages}
                                onPrev={() =>
                                    setInventoryRowsCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setInventoryRowsCurrentPage((page) =>
                                        Math.min(
                                            inventoryRowsTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isExportModalOpen}
                onOpenChange={setIsExportModalOpen}
            >
                <DialogContent className="sm:max-w-lg rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader className="border-b border-sidebar-border/40 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                <Download className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black">
                                    Pilih Filter Export
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Tentukan data material yang akan diekspor.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <Label htmlFor="export-warehouse" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Gudang
                            </Label>
                            <Select
                                value={exportFilters.warehouse}
                                onValueChange={(value) =>
                                    setExportFilters((current) => ({
                                        ...current,
                                        warehouse: value,
                                    }))
                                }
                            >
                                <SelectTrigger id="export-warehouse" className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Semua Gudang
                                    </SelectItem>
                                    <SelectItem value="g1">Gudang 1</SelectItem>
                                    <SelectItem value="g2">Gudang 2</SelectItem>
                                    <SelectItem value="g3">Gudang 3</SelectItem>
                                    <SelectItem value="g4">Gudang 4</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="export-category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Kategori
                            </Label>
                            <Select
                                value={exportFilters.category}
                                onValueChange={(value) =>
                                    setExportFilters((current) => ({
                                        ...current,
                                        category: value,
                                    }))
                                }
                            >
                                <SelectTrigger id="export-category" className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Semua Kategori
                                    </SelectItem>
                                    <SelectItem value="fast">
                                        Fast Moving
                                    </SelectItem>
                                    <SelectItem value="slow">
                                        Slow Moving
                                    </SelectItem>
                                    <SelectItem value="dead">
                                        Dead Stok
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="export-stock" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Stok
                            </Label>
                            <Select
                                value={exportFilters.stock}
                                onValueChange={(value) =>
                                    setExportFilters((current) => ({
                                        ...current,
                                        stock: value,
                                    }))
                                }
                            >
                                <SelectTrigger id="export-stock" className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Semua Stok
                                    </SelectItem>
                                    <SelectItem value="highest">
                                        Stok Terbanyak
                                    </SelectItem>
                                    <SelectItem value="lowest">
                                        Stok Sedikit (&gt;0)
                                    </SelectItem>
                                    <SelectItem value="empty">
                                        Stok Kosong
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-sidebar-border/40">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => setIsExportModalOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={handleExport}
                                className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/20 hover:brightness-110"
                            >
                                <Download className="mr-1.5 size-4" />
                                Export
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isDoCostDetailModalOpen}
                onOpenChange={(open) => {
                    setIsDoCostDetailModalOpen(open);
                    if (!open) {
                        setDoCostDetailItems([]);
                        setDoCostDetailHeader(null);
                        setDoCostDetailSearch('');
                        setDoCostDetailError('');
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                <FileSpreadsheet className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    Detail Delivery Order Cost
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Detail Delivery Order Cost terpilih.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-muted/25 p-4 text-sm md:grid-cols-3">
                            {[
                                [
                                    'Nomor DO Biaya',
                                    doCostDetailHeader?.no_alokasi,
                                ],
                                ['Date', doCostDetailHeader?.date],
                                ['Posting Date', doCostDetailHeader?.pos_tgl],
                                [
                                    'Permintaan',
                                    doCostDetailHeader?.ref_permintaan,
                                ],
                                ['Departemen', doCostDetailHeader?.kd_cs],
                                ['Nama', doCostDetailHeader?.nm_cs],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-background/60 p-3 border border-sidebar-border/40">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {label}
                                    </div>
                                    <div className="mt-0.5 font-bold text-foreground">
                                        {renderValue(value)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <ModalToolbar
                            pageSize={doCostDetailPageSize}
                            onPageSizeChange={(val) => setDoCostDetailPageSize(val)}
                            searchValue={doCostDetailSearch}
                            onSearchChange={(val) => setDoCostDetailSearch(val)}
                            searchPlaceholder="Cari material..."
                        />

                        <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/80 text-muted-foreground">
                                        <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                            {[
                                                'No',
                                                'Material',
                                                'Qty',
                                                'Satuan',
                                                'Harga',
                                                'Total',
                                                'Remark',
                                            ].map((heading) => (
                                                <th
                                                    key={heading}
                                                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <PlainTableStateRows
                                            loading={doCostDetailLoading}
                                            columns={7}
                                            rows={5}
                                            isEmpty={
                                                !doCostDetailLoading &&
                                                displayedDoCostDetails.length === 0
                                            }
                                            emptyMessage={
                                                doCostDetailError ||
                                                'Tidak ada data.'
                                            }
                                        />
                                        {!doCostDetailLoading &&
                                            displayedDoCostDetails.map(
                                                (item, index) => (
                                                    <tr
                                                        key={`${item.no_alokasi}-${index}`}
                                                        className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-indigo-500/[0.05]"
                                                    >
                                                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                            {doCostDetailPageSize ===
                                                                Infinity
                                                                ? index + 1
                                                                : (doCostDetailCurrentPage -
                                                                    1) *
                                                                doCostDetailPageSize +
                                                                index +
                                                                1}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium">
                                                            {renderValue(item.mat)}
                                                        </td>
                                                        <td className="px-4 py-3 tabular-nums">
                                                            {formatNumber(item.qty)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(item.unit)}
                                                        </td>
                                                        <td className="px-4 py-3 tabular-nums">
                                                            {formatNumber(
                                                                item.harga,
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold tabular-nums">
                                                            {formatNumber(
                                                                item.total,
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">
                                                            {renderValue(
                                                                item.remark,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {doCostDetailPageSize !== Infinity &&
                            filteredDoCostDetails.length > 0 && (
                                <ModalPagination
                                    currentPage={doCostDetailCurrentPage}
                                    totalPages={doCostDetailTotalPages}
                                    nextLabel="Selanjutnya"
                                    onPrev={() =>
                                        setDoCostDetailCurrentPage((page) =>
                                            Math.max(1, page - 1),
                                        )
                                    }
                                    onNext={() =>
                                        setDoCostDetailCurrentPage((page) =>
                                            Math.min(
                                                doCostDetailTotalPages,
                                                page + 1,
                                            ),
                                        )
                                    }
                                />
                            )}
                        <div className="flex justify-end">
                            <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2 text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                Grand Total: Rp {formatNumber(doCostDetailGrandTotal)}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isDoCostOutstandingModalOpen}
                onOpenChange={(open) => {
                    setIsDoCostOutstandingModalOpen(open);
                    if (open) loadDoCostOutstanding();
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                <FileSpreadsheet className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    DO Cost Belum Dibebankan
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Daftar DO Cost yang belum dibebankan.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <ModalToolbar
                        pageSize={doCostOutstandingPageSize}
                        onPageSizeChange={(val) => setDoCostOutstandingPageSize(val)}
                        searchValue={doCostOutstandingSearch}
                        onSearchChange={(val) => setDoCostOutstandingSearch(val)}
                        searchPlaceholder="Cari no alokasi, permintaan..."
                    />

                    <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/80 text-muted-foreground">
                                    <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                        {[
                                            'No DOBi',
                                            'Date',
                                            'Permintaan',
                                            'Departemen',
                                            'Action',
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={doCostOutstandingLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !doCostOutstandingLoading &&
                                            displayedDoCostOutstanding.length === 0
                                        }
                                        emptyMessage={
                                            doCostOutstandingError ||
                                            'Tidak ada data.'
                                        }
                                    />
                                    {!doCostOutstandingLoading &&
                                        displayedDoCostOutstanding.map((item) => (
                                            <tr
                                                key={`cost-${item.no_alokasi}`}
                                                className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-indigo-500/[0.05]"
                                            >
                                                <td className="px-4 py-3 font-sans tabular-nums tracking-wide text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                    {renderValue(item.no_alokasi)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {renderValue(item.date)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(
                                                        item.ref_permintaan,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.kd_cs)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-400 transition-colors cursor-pointer"
                                                        title="Lihat detail DO Cost"
                                                        aria-label="Lihat detail DO Cost"
                                                        onClick={() =>
                                                            handleOpenDoCostDetail(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {doCostOutstandingPageSize !== Infinity &&
                        filteredDoCostOutstanding.length > 0 && (
                            <ModalPagination
                                currentPage={doCostOutstandingCurrentPage}
                                totalPages={doCostOutstandingTotalPages}
                                nextLabel="Selanjutnya"
                                onPrev={() =>
                                    setDoCostOutstandingCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setDoCostOutstandingCurrentPage((page) =>
                                        Math.min(
                                            doCostOutstandingTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isDotDetailModalOpen}
                onOpenChange={(open) => {
                    setIsDotDetailModalOpen(open);
                    if (!open) {
                        setSelectedDot(null);
                        setDotDetailItems([]);
                        setDotDetailHeader(null);
                        setDotDetailSearch('');
                        setDotDetailError('');
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                <ClipboardList className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    Detail Delivery Order Bantu
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Detail Delivery Order Bantu terpilih.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {selectedDot && (
                        <div className="space-y-4">
                            <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-muted/25 p-4 text-sm md:grid-cols-3">
                                {[
                                    ['Nomor DOB', dotDetailHeader?.no_dob],
                                    ['Date', dotDetailHeader?.date],
                                    ['Posting Date', dotDetailHeader?.pos_tgl],
                                    ['Nama Customer', dotDetailHeader?.nm_cs],
                                    ['Ref DO', dotDetailHeader?.ref_do],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl bg-background/60 p-3 border border-sidebar-border/40">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {label}
                                        </div>
                                        <div className="mt-0.5 font-bold text-foreground">
                                            {renderValue(value)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <ModalToolbar
                                pageSize={dotDetailPageSize}
                                onPageSizeChange={(val) => setDotDetailPageSize(val)}
                                searchValue={dotDetailSearch}
                                onSearchChange={(val) => setDotDetailSearch(val)}
                                searchPlaceholder="Cari nama material..."
                            />

                            <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/80 text-muted-foreground">
                                            <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                                {[
                                                    'No',
                                                    'Nama Material',
                                                    'Satuan',
                                                    'Harga',
                                                    'Total',
                                                    'Remark',
                                                ].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <PlainTableStateRows
                                                loading={dotDetailLoading}
                                                columns={6}
                                                rows={5}
                                                isEmpty={
                                                    !dotDetailLoading &&
                                                    displayedDotDetails.length === 0
                                                }
                                                emptyMessage={
                                                    dotDetailError ||
                                                    'Tidak ada data material.'
                                                }
                                            />
                                            {!dotDetailLoading &&
                                                displayedDotDetails.map(
                                                    (item, index) => (
                                                        <tr
                                                            key={`${item.no_dob}-${index}`}
                                                            className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-sky-500/[0.05]"
                                                        >
                                                            <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                                {dotDetailPageSize ===
                                                                    Infinity
                                                                    ? index + 1
                                                                    : (dotDetailCurrentPage -
                                                                        1) *
                                                                    dotDetailPageSize +
                                                                    index +
                                                                    1}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium">
                                                                {renderValue(
                                                                    item.mat,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 tabular-nums">
                                                                {renderValue(
                                                                    item.qty,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 tabular-nums">
                                                                {formatNumber(
                                                                    item.harga,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 font-semibold tabular-nums">
                                                                {formatNumber(
                                                                    item.total,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {renderValue(
                                                                    item.remark,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {dotDetailPageSize !== Infinity &&
                                filteredDotDetails.length > 0 && (
                                    <ModalPagination
                                        currentPage={dotDetailCurrentPage}
                                        totalPages={dotDetailTotalPages}
                                        nextLabel="Selanjutnya"
                                        onPrev={() =>
                                            setDotDetailCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        onNext={() =>
                                            setDotDetailCurrentPage((page) =>
                                                Math.min(
                                                    dotDetailTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                    />
                                )}
                            <div className="flex justify-end">
                                <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-sm font-black text-sky-600 dark:text-sky-400 tabular-nums">
                                    Grand Total: Rp {formatNumber(dotDetailGrandTotal)}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isDotOutstandingModalOpen}
                onOpenChange={(open) => {
                    setIsDotOutstandingModalOpen(open);
                    if (open) loadDotOutstanding();
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                <ClipboardList className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    DOT Belum Dibebankan
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Daftar DOT yang belum dibebankan.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <ModalToolbar
                        pageSize={dotOutstandingPageSize}
                        onPageSizeChange={(val) => setDotOutstandingPageSize(val)}
                        searchValue={dotOutstandingSearch}
                        onSearchChange={(val) => setDotOutstandingSearch(val)}
                        searchPlaceholder="Cari no DOT, ref DO, customer..."
                    />

                    <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/80 text-muted-foreground">
                                    <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                        {[
                                            'No DOT',
                                            'Ref DO',
                                            'Customer',
                                            'Action',
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={dotOutstandingLoading}
                                        columns={4}
                                        rows={5}
                                        isEmpty={
                                            !dotOutstandingLoading &&
                                            displayedDotOutstanding.length === 0
                                        }
                                        emptyMessage={
                                            dotOutstandingError || 'Tidak ada data.'
                                        }
                                    />
                                    {!dotOutstandingLoading &&
                                        displayedDotOutstanding.map((item) => (
                                            <tr
                                                key={`dot-${item.no_dob}`}
                                                className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-sky-500/[0.05]"
                                            >
                                                <td className="px-4 py-3 font-sans tabular-nums tracking-wide text-xs font-bold text-sky-600 dark:text-sky-400">
                                                    {renderValue(item.no_dob)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.ref_do)}
                                                </td>
                                                <td className="px-4 py-3 font-medium">
                                                    {renderValue(item.nm_cs)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-400 transition-colors cursor-pointer"
                                                        title="Lihat detail DOT"
                                                        aria-label="Lihat detail DOT"
                                                        onClick={() =>
                                                            handleOpenDotDetail(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {dotOutstandingPageSize !== Infinity &&
                        filteredDotOutstanding.length > 0 && (
                            <ModalPagination
                                currentPage={dotOutstandingCurrentPage}
                                totalPages={dotOutstandingTotalPages}
                                nextLabel="Selanjutnya"
                                onPrev={() =>
                                    setDotOutstandingCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setDotOutstandingCurrentPage((page) =>
                                        Math.min(
                                            dotOutstandingTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isDetailDoModalOpen}
                onOpenChange={(open) => {
                    setIsDetailDoModalOpen(open);
                    if (!open) {
                        setSelectedDo(null);
                        setSelectedDoDetails([]);
                        setSelectedDoAddress('');
                        setDetailDoError('');
                        setDetailDoSearch('');
                        setDetailDoPageSize(5);
                        setDetailDoCurrentPage(1);
                    }
                }}
            >
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl p-5 sm:p-6">
                    <DialogHeader className="border-b border-sidebar-border/40 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                <Truck className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    Detail Delivery Order
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Ringkasan data dan item Delivery Order terpilih.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {selectedDo && (
                        <div className="space-y-5">
                            <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-muted/25 p-4 text-sm sm:grid-cols-2">
                                {[
                                    ['Nomor DO', selectedDo.no_do],
                                    ['Date', selectedDo.date],
                                    ['Ref. PO', selectedDo.ref_po],
                                    ['Nama Customer', selectedDo.nm_cs],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl bg-background/60 p-3 border border-sidebar-border/40">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {label}
                                        </div>
                                        <div className="mt-0.5 font-bold text-foreground">
                                            {renderValue(value)}
                                        </div>
                                    </div>
                                ))}
                                <div className="rounded-xl bg-background/60 p-3 border border-sidebar-border/40 sm:col-span-2">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Alamat
                                    </div>
                                    <div className="mt-0.5 font-bold text-foreground">
                                        {renderValue(selectedDoAddress)}
                                    </div>
                                </div>
                            </div>

                            <ModalToolbar
                                pageSize={detailDoPageSize}
                                onPageSizeChange={(val) => {
                                    setDetailDoPageSize(val);
                                    setDetailDoCurrentPage(1);
                                }}
                                searchValue={detailDoSearch}
                                onSearchChange={(val) => setDetailDoSearch(val)}
                                searchPlaceholder="Cari material..."
                            />

                            <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background/50">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/80 text-muted-foreground">
                                            <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                                {[
                                                    'No',
                                                    'Material',
                                                    'Qty',
                                                    'Harga',
                                                    'Total',
                                                    'Remark',
                                                ].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <PlainTableStateRows
                                                loading={detailDoLoading}
                                                columns={6}
                                                rows={5}
                                                isEmpty={
                                                    !detailDoLoading &&
                                                    displayedDoDetails.length === 0
                                                }
                                                emptyMessage={
                                                    detailDoError ||
                                                    'Tidak ada detail DO.'
                                                }
                                            />
                                            {!detailDoLoading &&
                                                displayedDoDetails.map(
                                                    (detail, index) => (
                                                        <tr
                                                            key={`${detail.no_do}-${index}`}
                                                            className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-amber-500/[0.05]"
                                                        >
                                                            <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                                {detailDoPageSize ===
                                                                    Infinity
                                                                    ? index + 1
                                                                    : (detailDoCurrentPage -
                                                                        1) *
                                                                    detailDoPageSize +
                                                                    index +
                                                                    1}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium">
                                                                {renderValue(
                                                                    detail.mat,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 tabular-nums">
                                                                {renderValue(
                                                                    [
                                                                        detail.qty,
                                                                        detail.unit,
                                                                    ]
                                                                        .filter(
                                                                            Boolean,
                                                                        )
                                                                        .join(' '),
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 tabular-nums">
                                                                {formatNumber(
                                                                    detail.harga,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 font-semibold tabular-nums">
                                                                {formatNumber(
                                                                    detail.total,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {renderValue(
                                                                    detail.remark,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {detailDoPageSize !== Infinity &&
                                detailDoTotalItems > 0 && (
                                    <ModalPagination
                                        currentPage={detailDoCurrentPage}
                                        totalPages={detailDoTotalPages}
                                        onPrev={() =>
                                            setDetailDoCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        onNext={() =>
                                            setDetailDoCurrentPage((page) =>
                                                Math.min(
                                                    detailDoTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                    />
                                )}
                            <div className="flex justify-end">
                                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                                    Grand Total: Rp {formatNumber(selectedDoGrandTotal)}
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
                    if (open) {
                        loadOutstanding();
                    } else {
                        setOutstandingSearchTerm('');
                        setOutstandingPageSize(5);
                        setOutstandingCurrentPage(1);
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none bg-background/95 backdrop-blur-2xl p-5 sm:p-6 gap-5">
                    <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                <Truck className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    DO Outstanding
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Pilih Delivery Order yang masih outstanding.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <ModalToolbar
                        pageSize={outstandingPageSize}
                        onPageSizeChange={(val) => setOutstandingPageSize(val)}
                        searchValue={outstandingSearchTerm}
                        onSearchChange={(val) => setOutstandingSearchTerm(val)}
                        searchPlaceholder="Cari nomor DO, ref PO, customer..."
                    />

                    <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card/60">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/80 text-muted-foreground">
                                    <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                            No DO
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                            Ref PO
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
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
                                            displayedOutstandingDeliveryOrders.length ===
                                            0
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
                                                className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-amber-500/[0.05]"
                                            >
                                                <td className="px-4 py-3 font-sans tabular-nums tracking-wide text-xs font-bold text-amber-600 dark:text-amber-400">
                                                    {item.no_do}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {item.date}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.ref_po}
                                                </td>
                                                <td className="px-4 py-3 font-medium">
                                                    {renderValue(item.nm_cs)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-400 transition-colors cursor-pointer"
                                                        aria-label="Lihat detail DO"
                                                        title="Lihat detail DO"
                                                        onClick={() =>
                                                            handleOpenDetailDo(item)
                                                        }
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {outstandingPageSize !== Infinity &&
                        outstandingTotalItems > 0 && (
                            <ModalPagination
                                currentPage={outstandingCurrentPage}
                                totalPages={outstandingTotalPages}
                                summaryText={`Menampilkan ${Math.min((outstandingCurrentPage - 1) * outstandingPageSize + 1, outstandingTotalItems)}-${Math.min(outstandingCurrentPage * outstandingPageSize, outstandingTotalItems)} dari ${outstandingTotalItems} data`}
                                onPrev={() =>
                                    setOutstandingCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setOutstandingCurrentPage((page) =>
                                        Math.min(
                                            outstandingTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(viewingMaterial)}
                onOpenChange={(open) => {
                    if (!open) {
                        setViewingMaterial(null);
                    }
                }}
            >
                <DialogContent className="max-w-3xl rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl p-5 sm:p-6">
                    <DialogHeader className="border-b border-sidebar-border/40 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                <PackageCheck className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    Detail Stok Material
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Detail stok material per gudang.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {viewingMaterial && (
                        <div className="space-y-4 text-sm">
                            <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-emerald-500/[0.06] via-muted/25 to-sky-500/[0.06] p-4 md:grid-cols-3">
                                <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Kode Material
                                    </div>
                                    <div className="mt-1 font-sans tabular-nums tracking-wide text-sm font-black text-emerald-600 dark:text-emerald-400">
                                        {renderValue(
                                            viewingMaterial.kd_material,
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Nama Material
                                    </div>
                                    <div className="mt-1 font-bold text-foreground">
                                        {renderValue(viewingMaterial.material)}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Satuan
                                    </div>
                                    <div className="mt-1 font-bold text-foreground">
                                        {renderValue(viewingMaterial.unit)}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background/50">
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto text-sm">
                                        <thead className="bg-muted/80 text-muted-foreground">
                                            <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                                <th className="w-1 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                    Gudang
                                                </th>
                                                <th className="w-1 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                    Stok
                                                </th>
                                                <th className="w-1 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                    Harga
                                                </th>
                                                <th className="w-full px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                    Kategori
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stockRows(viewingMaterial).map(
                                                (row) => (
                                                    <tr
                                                        key={row.label}
                                                        className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-emerald-500/[0.05]"
                                                    >
                                                        <td className="w-1 px-3 py-2.5 whitespace-nowrap">
                                                            <span className="inline-flex items-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                                {row.label}
                                                            </span>
                                                        </td>
                                                        <td className="w-1 px-3 py-2.5 text-right font-bold whitespace-nowrap tabular-nums">
                                                            {formatNumber(row.stok)}
                                                        </td>
                                                        <td className="w-1 px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.harga,
                                                            )}
                                                        </td>
                                                        <td className="w-full min-w-0 px-3 py-2.5">
                                                            <div
                                                                className="truncate text-muted-foreground"
                                                                title={renderValue(
                                                                    row.kategori,
                                                                )}
                                                            >
                                                                {renderValue(
                                                                    row.kategori,
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(movementModal)}
                onOpenChange={(open) => {
                    if (!open) {
                        setMovementModal(null);
                        setMovementSearchTerm('');
                        setMovementPageSize(5);
                        setMovementCurrentPage(1);
                    }
                }}
            >
                <DialogContent className="w-[calc(100vw-2rem)] max-w-none p-5 sm:p-6 sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-4rem)] lg:max-w-[1800px] rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader className="border-b border-sidebar-border/40 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                <TrendingUp className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    {selectedMovement?.title ?? 'Kategori Material'}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Daftar material berdasarkan kategori stok.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-muted/25 p-4 md:grid-cols-3">
                            <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Jumlah stok
                                </div>
                                <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                    {formatNumber(selectedMovement?.stock)}
                                </div>
                            </div>
                            <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Jumlah item
                                </div>
                                <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                    {formatNumber(selectedMovement?.count)}
                                </div>
                            </div>
                            <div className="rounded-xl bg-background/70 p-3 border border-emerald-500/25">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total harga
                                </div>
                                <div className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    Rp {formatNumber(selectedMovement?.total)}
                                </div>
                            </div>
                        </div>

                        <ModalToolbar
                            pageSize={movementPageSize}
                            onPageSizeChange={(val) => {
                                setMovementPageSize(val);
                                setMovementCurrentPage(1);
                            }}
                            searchValue={movementSearchTerm}
                            onSearchChange={(val) => {
                                setMovementSearchTerm(val);
                                setMovementCurrentPage(1);
                            }}
                            searchPlaceholder="Cari kode atau material..."
                            pageSizeOptions={[5, 10, 25, 50, 100]}
                            includeAll={false}
                        />

                        <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background/50">
                            <div className="max-h-[64vh] overflow-auto overscroll-contain">
                                <table className="w-full min-w-[1100px] table-fixed text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted/85 text-muted-foreground backdrop-blur-md">
                                        <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                            <th className="w-14 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                No
                                            </th>
                                            <th className="w-36 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Kode Material
                                            </th>
                                            <th className="min-w-0 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                                Nama Material
                                            </th>
                                            {movementWarehouses.flatMap(
                                                (gudang) => [
                                                    <th
                                                        key={`${gudang}-stok`}
                                                        className="w-24 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                                                    >
                                                        Stok {gudang}
                                                    </th>,
                                                    <th
                                                        key={`${gudang}-harga`}
                                                        className="w-32 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                                                    >
                                                        Harga {gudang}
                                                    </th>,
                                                ],
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedMovementRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    className="px-4 py-8 text-center text-muted-foreground"
                                                    colSpan={
                                                        3 +
                                                        movementWarehouses.length *
                                                        2
                                                    }
                                                >
                                                    {movementRowsLoading ? 'Memuat data material...' : movementRowsError || 'Data material tidak tersedia.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedMovementRows.map(
                                                (row, index) => (
                                                    <tr
                                                        key={`${row.kd_material}-${index}`}
                                                        className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-emerald-500/[0.05]"
                                                    >
                                                        <td className="w-14 px-3 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums">
                                                            {(movementCurrentPage -
                                                                1) *
                                                                movementPageSize +
                                                                index +
                                                                1}
                                                        </td>
                                                        <td className="w-36 px-3 py-2.5 font-sans tabular-nums tracking-wide text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                            {renderValue(
                                                                row.kd_material,
                                                            )}
                                                        </td>
                                                        <td className="min-w-0 px-3 py-2.5 font-medium">
                                                            <div
                                                                className="truncate"
                                                                title={
                                                                    row.material
                                                                }
                                                            >
                                                                {renderValue(
                                                                    row.material,
                                                                )}
                                                            </div>
                                                        </td>
                                                        {movementWarehouses.flatMap(
                                                            (gudang) => [
                                                                <td
                                                                    key={`${gudang}-stok`}
                                                                    className="w-24 px-3 py-2.5 text-right whitespace-nowrap tabular-nums"
                                                                >
                                                                    {row
                                                                        .stocks?.[
                                                                        gudang
                                                                    ] ===
                                                                        undefined
                                                                        ? '-'
                                                                        : formatNumber(
                                                                            row
                                                                                .stocks[
                                                                            gudang
                                                                            ],
                                                                        )}
                                                                </td>,
                                                                <td
                                                                    key={`${gudang}-harga`}
                                                                    className="w-32 px-3 py-2.5 text-right whitespace-nowrap tabular-nums"
                                                                >
                                                                    {row
                                                                        .prices?.[
                                                                        gudang
                                                                    ] ===
                                                                        undefined
                                                                        ? '-'
                                                                        : `Rp ${formatNumber(
                                                                            row
                                                                                .prices[
                                                                            gudang
                                                                            ],
                                                                        )}`}
                                                                </td>,
                                                            ],
                                                        )}
                                                    </tr>
                                                ),
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {movementTotalItems > 0 && (
                            <ModalPagination
                                currentPage={movementCurrentPage}
                                totalPages={movementTotalPages}
                                summaryText={`Menampilkan ${Math.min((movementCurrentPage - 1) * movementPageSize + 1, movementTotalItems)}-${Math.min(movementCurrentPage * movementPageSize, movementTotalItems)} dari ${movementTotalItems} data`}
                                onPrev={() =>
                                    setMovementCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setMovementCurrentPage((page) =>
                                        Math.min(
                                            movementTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(warehouseModal)}
                onOpenChange={(open) => {
                    if (!open) {
                        setWarehouseModal(null);
                        setMovementSearchTerm('');
                        setMovementPageSize(5);
                        setMovementCurrentPage(1);
                    }
                }}
            >
                <DialogContent className="w-[calc(100vw-2rem)] max-w-none p-5 sm:p-6 sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-4rem)] lg:max-w-[1800px] rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader className="border-b border-sidebar-border/40 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                <Warehouse className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">
                                    {selectedWarehouse?.label ?? 'Detail Gudang'}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Daftar material berdasarkan gudang.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-sidebar-border/70 bg-muted/25 p-4 md:grid-cols-3">
                            <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total stok
                                </div>
                                <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                    {formatNumber(
                                        selectedWarehouseSummary?.total?.stock,
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl bg-background/70 p-3 border border-sidebar-border/40">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total item
                                </div>
                                <div className="mt-1 text-xl font-black text-foreground tabular-nums">
                                    {formatNumber(
                                        selectedWarehouseSummary?.total?.items,
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl bg-background/70 p-3 border border-indigo-500/25">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total harga
                                </div>
                                <div className="mt-1 text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    Rp{' '}
                                    {formatNumber(
                                        selectedWarehouseSummary?.total?.total,
                                    )}
                                </div>
                            </div>
                        </div>

                        <ModalToolbar
                            pageSize={movementPageSize}
                            onPageSizeChange={(val) => {
                                setMovementPageSize(val);
                                setMovementCurrentPage(1);
                            }}
                            searchValue={movementSearchTerm}
                            onSearchChange={(val) => {
                                setMovementSearchTerm(val);
                                setMovementCurrentPage(1);
                            }}
                            searchPlaceholder="Cari kode, material, kategori..."
                            pageSizeOptions={[5, 10, 25, 50, 100]}
                            includeAll={false}
                        />

                        <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background/50">
                            <div className="max-h-[64vh] overflow-auto overscroll-contain">
                                <table className="w-full min-w-[980px] table-fixed text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted/85 text-muted-foreground backdrop-blur-md">
                                        <tr className="border-b border-slate-300/80 dark:border-slate-700/80">
                                            <th className="w-14 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                No
                                            </th>
                                            <th className="w-36 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Kode Material
                                            </th>
                                            <th className="min-w-0 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                                                Nama Material
                                            </th>
                                            <th className="w-44 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Kategori
                                            </th>
                                            <th className="w-24 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Stok
                                            </th>
                                            <th className="w-32 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Harga
                                            </th>
                                            <th className="w-36 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                                Total Harga
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedMovementRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    className="px-4 py-8 text-center text-muted-foreground"
                                                    colSpan={7}
                                                >
                                                    {movementRowsLoading ? 'Memuat data material...' : movementRowsError || 'Data material tidak tersedia.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedMovementRows.map(
                                                (row, index) => (
                                                    <tr
                                                        key={`${row.kd_material}-${row.gudang}-${index}`}
                                                        className="border-b border-slate-300/70 dark:border-slate-700/70 transition-colors hover:bg-indigo-500/[0.05]"
                                                    >
                                                        <td className="w-14 px-3 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums">
                                                            {(movementCurrentPage -
                                                                1) *
                                                                movementPageSize +
                                                                index +
                                                                1}
                                                        </td>
                                                        <td className="w-36 px-3 py-2.5 font-sans tabular-nums tracking-wide text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                            {renderValue(
                                                                row.kd_material,
                                                            )}
                                                        </td>
                                                        <td className="min-w-0 px-3 py-2.5 font-medium">
                                                            <div
                                                                className="truncate"
                                                                title={
                                                                    row.material
                                                                }
                                                            >
                                                                {renderValue(
                                                                    row.material,
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="w-44 px-3 py-2.5 whitespace-nowrap">
                                                            <div
                                                                className="truncate text-muted-foreground"
                                                                title={renderValue(
                                                                    row.kategori,
                                                                )}
                                                            >
                                                                {renderValue(
                                                                    row.kategori,
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="w-24 px-3 py-2.5 text-right font-bold whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.stok,
                                                            )}
                                                        </td>
                                                        <td className="w-32 px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                                                            Rp{' '}
                                                            {formatNumber(
                                                                row.harga,
                                                            )}
                                                        </td>
                                                        <td className="w-36 px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                                                            Rp{' '}
                                                            {formatNumber(
                                                                row.total,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {movementTotalItems > 0 && (
                            <ModalPagination
                                currentPage={movementCurrentPage}
                                totalPages={movementTotalPages}
                                summaryText={`Menampilkan ${Math.min((movementCurrentPage - 1) * movementPageSize + 1, movementTotalItems)}-${Math.min(movementCurrentPage * movementPageSize, movementTotalItems)} dari ${movementTotalItems} data`}
                                onPrev={() =>
                                    setMovementCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                onNext={() =>
                                    setMovementCurrentPage((page) =>
                                        Math.min(
                                            movementTotalPages,
                                            page + 1,
                                        ),
                                    )
                                }
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {isModalOpen && (
                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            reset();
                        }
                    }}
                >
                    <DialogContent className="rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
                        <DialogHeader className="border-b border-sidebar-border/40 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                    <Plus className="size-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-black">
                                        Tambah Material
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">
                                        Form untuk menambah material baru
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor="material" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Nama Material
                                </Label>
                                <Input
                                    id="material"
                                    className="rounded-xl"
                                    value={data.material}
                                    onChange={(event) =>
                                        setData('material', event.target.value)
                                    }
                                    placeholder="Masukkan nama material"
                                />
                                {errors.material && (
                                    <p className="text-xs text-rose-600">
                                        {errors.material}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Satuan
                                </Label>
                                <Input
                                    id="unit"
                                    className="rounded-xl"
                                    value={data.unit}
                                    onChange={(event) =>
                                        setData('unit', event.target.value)
                                    }
                                    placeholder="Contoh: pcs"
                                />
                                {errors.unit && (
                                    <p className="text-xs text-rose-600">
                                        {errors.unit}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gudang" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Gudang
                                </Label>
                                <Select
                                    value={data.gudang || 'none'}
                                    onValueChange={(value) =>
                                        setData(
                                            'gudang',
                                            value === 'none' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger id="gudang" className="rounded-xl">
                                        <SelectValue placeholder="Pilih gudang" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Tidak dipilih
                                        </SelectItem>
                                        {warehouseOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.gudang && (
                                    <p className="text-xs text-rose-600">
                                        {errors.gudang}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kategori" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Kategori
                                </Label>
                                <Select
                                    value={data.kategori || 'none'}
                                    onValueChange={(value) =>
                                        setData(
                                            'kategori',
                                            value === 'none' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger id="kategori" className="rounded-xl">
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Tidak dipilih
                                        </SelectItem>
                                        {stockCategoryOptions.map((option) => (
                                            <SelectItem
                                                key={option}
                                                value={option}
                                            >
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.kategori && (
                                    <p className="text-xs text-rose-600">
                                        {errors.kategori}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stok" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Stok
                                </Label>
                                <Input
                                    id="stok"
                                    type="number"
                                    min="0"
                                    className="rounded-xl"
                                    value={data.stok}
                                    onChange={(event) =>
                                        setData('stok', event.target.value)
                                    }
                                />
                                {errors.stok && (
                                    <p className="text-xs text-rose-600">
                                        {errors.stok}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-sidebar-border/40">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <MenuAction
                                    action="create"
                                    type="submit"
                                    disabled={processing}
                                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-md shadow-emerald-500/20"
                                >
                                    {processing
                                        ? 'Menyimpan...'
                                        : 'Simpan Data'}
                                </MenuAction>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {isEditModalOpen && (
                <Dialog
                    open={isEditModalOpen}
                    onOpenChange={(open) => {
                        setIsEditModalOpen(open);
                        if (!open) {
                            resetEdit();
                            setEditingMaterial(null);
                        }
                    }}
                >
                    <DialogContent className="rounded-3xl border border-sidebar-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
                        <DialogHeader className="border-b border-sidebar-border/40 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                    <Pencil className="size-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-black">
                                        Edit Material
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">
                                        Form untuk mengubah data material
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <form className="space-y-4 pt-1" onSubmit={handleUpdate}>
                            <div className="space-y-2">
                                <Label htmlFor="edit-material" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Nama Material
                                </Label>
                                <Input
                                    id="edit-material"
                                    className="rounded-xl"
                                    value={editData.material}
                                    onChange={(event) =>
                                        setEditData(
                                            'material',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Masukkan nama material"
                                />
                                {editErrors.material && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.material}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-unit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Satuan
                                </Label>
                                <Input
                                    id="edit-unit"
                                    className="rounded-xl"
                                    value={editData.unit}
                                    onChange={(event) =>
                                        setEditData('unit', event.target.value)
                                    }
                                    placeholder="Contoh: pcs"
                                />
                                {editErrors.unit && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.unit}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-stok" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Stok
                                </Label>
                                <Input
                                    id="edit-stok"
                                    type="number"
                                    min="0"
                                    className="rounded-xl"
                                    value={editData.stok}
                                    disabled
                                />
                                {editErrors.stok && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.stok}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-remark" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Kategori
                                </Label>
                                <Select
                                    value={editData.remark || 'none'}
                                    onValueChange={(value) =>
                                        setEditData(
                                            'remark',
                                            value === 'none' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger id="edit-remark" className="rounded-xl">
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Tidak dipilih
                                        </SelectItem>
                                        {stockCategoryOptions.map((option) => (
                                            <SelectItem
                                                key={option}
                                                value={option}
                                            >
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {editErrors.remark && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.remark}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-sidebar-border/40">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setIsEditModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <MenuAction
                                    action="update"
                                    type="submit"
                                    disabled={editProcessing}
                                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md shadow-amber-500/20"
                                >
                                    {editProcessing
                                        ? 'Menyimpan...'
                                        : 'Simpan Perubahan'}
                                </MenuAction>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

MaterialIndex.layout = (page) => {
    return <AppLayout children={page} breadcrumbs={breadcrumbs} />;
};
