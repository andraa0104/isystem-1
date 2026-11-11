import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserNote from '@/components/user-note';
import RealtimeWeatherCard from '@/components/realtime-weather-card';
import { dashboardCardKeys } from '@/data/dashboard-cards';
import useCachedRequest from '@/hooks/use-cached-request';
import useInView from '@/hooks/use-in-view';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes/index';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    Clock,
    Eye,
    Layers,
    LineChart,
    Moon,
    Package,
    PieChart,
    RefreshCw,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Sun,
    Sunrise,
    Sunset,
    TrendingDown,
    TrendingUp,
    Truck,
    Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const breadcrumbs = [
    {
        title: 'Dashboard',
        href: dashboard(),
    },
];

const databaseCompanies = {
    dbsja: 'CV. Semesta Jaya Abadi',
    dbbbbs: 'CV. Bangun Banua Bersama Sejahtera',
    dbstg: 'CV. Surya Teknik Gemilang',
    dbati: 'PT. Allstar Tekstil Indonesia',
    dbarm: 'AR-MART',
    dbjms: 'CV. JLX Makmur Sentosa',
};

const resolveMax = (values) =>
    values.reduce((max, item) => Math.max(max, Number(item.total ?? 0)), 0);

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value ?? 0),
    );

const formatCompactNumber = (value) => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return '0';
    try {
        return new Intl.NumberFormat('id-ID', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1,
        }).format(numericValue);
    } catch {
        return formatNumber(numericValue);
    }
};

const formatPercent = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0%';
    return `${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
    }).format(numericValue)}%`;
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const rangeOptions = [
    { key: '1_week', label: '1 Minggu' },
    { key: '1_month', label: '1 Bulan' },
    { key: '3_months', label: '3 Bulan' },
    { key: '5_months', label: '5 Bulan' },
    { key: '1_year', label: '1 Tahun' },
];

/* ─── Dynamic Greeting by Hour of Day ─────────────────────────────────────── */
function getGreetingInfo(date) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 11) {
        return {
            greeting: 'Selamat Pagi',
            sub: 'Awali aktivitas dengan bismillah & fokus produktif',
            icon: Sunrise,
            iconColor: 'text-amber-500 dark:text-amber-400',
            containerClass:
                'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10',
            pingClass: 'bg-amber-400',
            dotClass: 'bg-amber-500',
        };
    }
    if (hour >= 11 && hour < 15) {
        return {
            greeting: 'Selamat Siang',
            sub: 'Pantau operasional dan pergerakan arus kas bisnis',
            icon: Sun,
            iconColor: 'text-amber-500 dark:text-yellow-400',
            containerClass:
                'bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-transparent ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10',
            pingClass: 'bg-yellow-400',
            dotClass: 'bg-amber-500',
        };
    }
    if (hour >= 15 && hour < 18) {
        return {
            greeting: 'Selamat Sore',
            sub: 'Evaluasi pencapaian target dan transaksi hari ini',
            icon: Sunset,
            iconColor: 'text-orange-500 dark:text-orange-400',
            containerClass:
                'bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-transparent ring-1 ring-orange-500/30 shadow-md shadow-orange-500/10',
            pingClass: 'bg-orange-400',
            dotClass: 'bg-orange-500',
        };
    }
    return {
        greeting: 'Selamat Malam',
        sub: 'Laporan terintegrasi waktu-nyata & sinkronisasi otomatis',
        icon: Moon,
        iconColor: 'text-indigo-400 dark:text-indigo-300',
        containerClass:
            'bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/10',
        pingClass: 'bg-indigo-400',
        dotClass: 'bg-indigo-500',
    };
}

/* ─── Ambient Atmospheric Drifting Mesh Ornaments ─────────────────────────── */
function DriftingOrnaments() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Ambient Aurora Orbs */}
            <div className="absolute -top-32 -left-20 size-[540px] rounded-full bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] blur-[130px]" />
            <div className="absolute top-1/4 -right-24 size-[480px] rounded-full bg-cyan-500/[0.07] dark:bg-cyan-500/[0.12] blur-[130px]" />
            <div className="absolute bottom-20 left-1/3 size-[420px] rounded-full bg-indigo-500/[0.05] dark:bg-indigo-500/[0.09] blur-[110px]" />

            {/* Drifting Cyber Hexagon Node */}
            <motion.div
                className="absolute top-8 right-10 hidden xl:block opacity-35 dark:opacity-50"
                animate={{
                    y: [0, -18, 12, -8, 0],
                    rotate: [0, 60, 120, 180, 240, 300, 360],
                }}
                transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            >
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <polygon
                        points="22,3 39,13 39,31 22,41 5,31 5,13"
                        stroke="#10b981"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                    />
                    <circle cx="22" cy="22" r="3.5" fill="#06b6d4" />
                </svg>
            </motion.div>
        </div>
    );
}

/* ─── Real-data Dynamic Sparkline for KPI Cards ──────────────────────────── */
function RealMetricSparkline({ data = [], color = 'emerald', fallbackValue = 0 }) {
    const colorMap = {
        emerald: {
            stroke: '#10b981',
            gradId: 'spark-real-emerald',
        },
        rose: {
            stroke: '#f43f5e',
            gradId: 'spark-real-rose',
        },
        sky: {
            stroke: '#0ea5e9',
            gradId: 'spark-real-sky',
        },
        indigo: {
            stroke: '#6366f1',
            gradId: 'spark-real-indigo',
        },
        amber: {
            stroke: '#f59e0b',
            gradId: 'spark-real-amber',
        },
    };
    const c = colorMap[color] || colorMap.emerald;

    const width = 88;
    const height = 30;
    const paddingX = 4;
    const paddingY = 4;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    // Normalisasi array nilai dari data series objek { date, value } atau { sales } atau angka
    const values = (Array.isArray(data) && data.length > 0)
        ? data.map((d) => (typeof d === 'number' ? d : Number(d?.value ?? d?.sales ?? d?.saldo ?? 0)))
        : (fallbackValue > 0 ? [fallbackValue * 0.95, fallbackValue] : [0]);

    if (values.length === 0) {
        return <SparklineWave color={color} />;
    }

    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal > 0 ? maxVal - minVal : 1;

    const points = values.map((val, idx) => {
        const x =
            values.length > 1
                ? paddingX + (idx / (values.length - 1)) * usableW
                : width / 2;
        const y = height - paddingY - ((val - minVal) / range) * usableH;
        return { x, y };
    });

    let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    if (points.length === 1) {
        pathD = `M ${paddingX},${points[0].y.toFixed(1)} L ${width - paddingX},${points[0].y.toFixed(1)}`;
    } else {
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cx1 = (p0.x + (p1.x - p0.x) / 2).toFixed(1);
            const cy1 = p0.y.toFixed(1);
            const cx2 = (p0.x + (p1.x - p0.x) / 2).toFixed(1);
            const cy2 = p1.y.toFixed(1);
            pathD += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
        }
    }

    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const areaD = `${pathD} L ${(points.length === 1 ? width - paddingX : lastPt.x).toFixed(1)},${height} L ${(points.length === 1 ? paddingX : firstPt.x).toFixed(1)},${height} Z`;

    return (
        <svg
            className="w-20 h-7 overflow-visible shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
        >
            <defs>
                <linearGradient id={c.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity="0.0" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#${c.gradId})`} />
            <motion.path
                key={pathD}
                d={pathD}
                stroke={c.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <circle
                cx={points.length === 1 ? width - paddingX : lastPt.x}
                cy={points.length === 1 ? points[0].y : lastPt.y}
                r="2.5"
                fill={c.stroke}
                stroke="#ffffff"
                strokeWidth="1"
            />
        </svg>
    );
}

/* ─── Sparkline Micro-Wave for KPI Cards ──────────────────────────────────── */
function SparklineWave({ color = 'emerald' }) {
    const colorMap = {
        emerald: {
            stroke: '#10b981',
            fill: 'url(#spark-emerald)',
            dotY: 5,
        },
        rose: {
            stroke: '#f43f5e',
            fill: 'url(#spark-rose)',
            dotY: 9,
        },
        sky: {
            stroke: '#0ea5e9',
            fill: 'url(#spark-sky)',
            dotY: 7,
        },
        indigo: {
            stroke: '#6366f1',
            fill: 'url(#spark-indigo)',
            dotY: 6,
        },
        amber: {
            stroke: '#f59e0b',
            fill: 'url(#spark-amber)',
            dotY: 9,
        },
    };
    const c = colorMap[color] || colorMap.emerald;

    const pathD =
        color === 'emerald'
            ? 'M 2,24 C 18,28 28,12 44,16 C 60,20 70,7 88,5'
            : color === 'sky'
                ? 'M 2,20 C 16,8 28,22 46,14 C 62,6 74,16 88,7'
                : color === 'indigo'
                    ? 'M 2,12 C 16,22 32,8 50,18 C 66,26 78,8 88,6'
                    : 'M 2,22 C 18,14 30,26 52,12 C 68,4 78,18 88,9';

    const areaD = `${pathD} L 88,32 L 2,32 Z`;

    return (
        <svg
            className="w-20 h-7 overflow-visible shrink-0 opacity-75 group-hover:opacity-100 transition-opacity"
            viewBox="0 0 90 32"
            fill="none"
        >
            <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={c.fill} />
            <motion.path
                d={pathD}
                stroke={c.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <circle cx="88" cy={c.dotY} r="2.5" fill={c.stroke} />
        </svg>
    );
}

/* ─── Helper for Area Spline Path Calculation ─────────────────────────────── */
function buildSplinePoints(series, maxVal, width = 960, height = 240) {
    if (!series || series.length === 0) {
        return { salesPoints: [], hppPoints: [], biayaPoints: [], coords: [], width, height };
    }

    const paddingX = 40;
    const paddingYTop = 28;
    const paddingYBottom = 34;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingYTop - paddingYBottom;
    const safeMax = maxVal > 0 ? maxVal : 1;

    const count = series.length;
    const stepX = count > 1 ? usableWidth / (count - 1) : 0;

    const coords = [];
    const salesPoints = [];
    const hppPoints = [];
    const biayaPoints = [];

    series.forEach((item, i) => {
        const x = count > 1 ? paddingX + i * stepX : width / 2;
        const sVal = Number(item.sales ?? 0);
        const hVal = Number(item.hpp ?? 0);
        const bVal = Number(item.biaya ?? 0);

        const sy = height - paddingYBottom - (sVal / safeMax) * usableHeight;
        const hy = height - paddingYBottom - (hVal / safeMax) * usableHeight;
        const by = height - paddingYBottom - (bVal / safeMax) * usableHeight;

        salesPoints.push({ x, y: sy });
        hppPoints.push({ x, y: hy });
        biayaPoints.push({ x, y: by });

        coords.push({
            x,
            label: item.label,
            period: item.period,
            sales: sVal,
            hpp: hVal,
            biaya: bVal,
            sy,
            hy,
            by,
        });
    });

    return {
        salesPoints,
        hppPoints,
        biayaPoints,
        coords,
        width,
        height,
        paddingYBottom,
        paddingX,
        usableWidth,
    };
}

function pointsToSplinePath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx1 = p0.x + (p1.x - p0.x) / 2;
        const cy1 = p0.y;
        const cx2 = p0.x + (p1.x - p0.x) / 2;
        const cy2 = p1.y;
        path += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }
    return path;
}

function pointsToAreaPath(points, height, paddingYBottom) {
    if (!points || points.length === 0) return '';
    const spline = pointsToSplinePath(points);
    const baselineY = height - paddingYBottom;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${spline} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
}

export default function Dashboard({
    quotationStats = [],
    saldoStats = [],
    pdbStats = {},
    pdoStats = {},
    salesHppStats: initialSalesHppStats = { summary: {}, series: [] },
    dashboardCardAccess = null,
}) {
    const { auth, tenant } = usePage().props;
    const userName = auth?.user?.name || 'Administrator';

    const canViewCard = useCallback(
        (key) =>
            dashboardCardAccess === null ||
            dashboardCardAccess === undefined ||
            dashboardCardAccess[key] === true,
        [dashboardCardAccess],
    );
    const hasAnyDashboardCard = useMemo(
        () => dashboardCardKeys.some(canViewCard),
        [canViewCard],
    );

    // Live clock ticker
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const greetingInfo = useMemo(() => getGreetingInfo(currentTime), [currentTime]);

    const [quotationRange, setQuotationRange] = useState('1_week');
    const [activeDeliveryTab, setActiveDeliveryTab] = useState('pdb');
    const [prefetchPriorityCards, setPrefetchPriorityCards] = useState(false);
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);

    const [salesHppRange, setSalesHppRange] = useState('1_week');
    const [salesHppHover, setSalesHppHover] = useState(null);
    const [chartDisplayMode, setChartDisplayMode] = useState('bars'); // 'bars' | 'area'

    const quotationView = useInView();
    const saldoView = useInView();
    const deliveryView = useInView({ rootMargin: '0px' });
    const salesHppView = useInView();

    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => {
            window.setTimeout(() => {
                setPrefetchPriorityCards(true);
            }, 250);
        });
        return () => window.cancelAnimationFrame(rafId);
    }, []);

    // ── Data Requests ──────────────────────────────────────────────────────────
    const quotationRequest = useCachedRequest({
        key: `quotation:v3:${quotationRange}`,
        enabled:
            canViewCard('quotation') &&
            (quotationView.inView || prefetchPriorityCards),
        ttlMs: 0,
        initialData:
            Array.isArray(quotationStats) && quotationStats.length > 0
                ? quotationStats
                : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/quotation-stats', {
                params: { range: quotationRange },
            });
            return response.data;
        },
    });

    const saldoRequest = useCachedRequest({
        key: 'saldo',
        enabled: canViewCard('saldo'),
        ttlMs: 0,
        initialData:
            Array.isArray(saldoStats) && saldoStats.length > 0
                ? saldoStats
                : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/saldo-stats');
            return response.data;
        },
    });

    const deliveryRequest = useCachedRequest({
        key: 'delivery:v2',
        enabled: canViewCard('delivery') && deliveryView.inView,
        ttlMs: 0,
        initialData:
            (pdbStats && Object.keys(pdbStats).length > 0) ||
                (pdoStats && Object.keys(pdoStats).length > 0)
                ? { pdb: pdbStats, pdo: pdoStats }
                : null,
        fetcher: async () => {
            const response = await axios.get('/dashboard/delivery-stats');
            return response.data;
        },
    });

    const receivablePayableRequest = useCachedRequest({
        key: 'receivablePayable',
        enabled: canViewCard('receivable_payable'),
        ttlMs: 0,
        fetcher: async () => {
            const response = await axios.get(
                '/dashboard/receivable-payable-stats',
            );
            return response.data;
        },
    });

    const stockSummaryRequest = useCachedRequest({
        key: 'stockSummary:v2',
        enabled: canViewCard('stock_summary'),
        ttlMs: 0,
        fetcher: async () => {
            const response = await axios.get('/dashboard/stock-summary-stats');
            return response.data;
        },
    });

    const salesHppRequest = useCachedRequest({
        key: `salesHpp:v3:${salesHppRange}`,
        enabled:
            canViewCard('sales_hpp') &&
            (salesHppView.inView || prefetchPriorityCards),
        ttlMs: 0,
        initialData:
            salesHppRange === '3_months' &&
                Array.isArray(initialSalesHppStats?.series) &&
                initialSalesHppStats.series.length > 0
                ? initialSalesHppStats
                : null,
        fetcher: async () => {
            const response = await axios.get(
                `/dashboard/sales-hpp-stats/${salesHppRange}`,
            );
            return response.data;
        },
    });

    const quotationSeries = Array.isArray(quotationRequest.data)
        ? quotationRequest.data
        : [];
    const rawSaldoData = saldoRequest.data;
    const saldoSeries = useMemo(() => {
        if (Array.isArray(rawSaldoData)) return rawSaldoData;
        if (rawSaldoData && Array.isArray(rawSaldoData.accounts)) return rawSaldoData.accounts;
        return [];
    }, [rawSaldoData]);
    const saldoHistory = useMemo(() => {
        if (rawSaldoData && Array.isArray(rawSaldoData.history)) return rawSaldoData.history;
        return [];
    }, [rawSaldoData]);

    const deliveryData = deliveryRequest.data ?? {};
    const pdbData = deliveryData?.pdb ?? {};
    const pdoData = deliveryData?.pdo ?? {};
    const receivablePayableData = receivablePayableRequest.data ?? {};
    const piutangData = receivablePayableData?.piutang ?? {
        total: 0,
        last_update: null,
        history: [],
    };
    const hutangData = receivablePayableData?.hutang ?? {
        total: 0,
        last_update: null,
        history: [],
    };
    const stockSummary = stockSummaryRequest.data ?? {
        physical: null,
        physical_last_update: null,
        book: null,
        book_last_update: null,
        difference: null,
    };
    const salesHppData =
        salesHppRequest.data ??
        initialSalesHppStats ?? { summary: {}, series: [] };

    const displayedStats = useMemo(
        () => (Array.isArray(quotationSeries) ? quotationSeries : []),
        [quotationSeries],
    );
    const maxTotal = useMemo(
        () => resolveMax(displayedStats),
        [displayedStats],
    );
    const maxSaldo = useMemo(
        () => Math.max(1, ...saldoSeries.map((item) => Number(item.saldo ?? 0))),
        [saldoSeries],
    );
    const totalSaldoKas = useMemo(
        () =>
            saldoSeries.reduce(
                (sum, item) => sum + Number(item.saldo ?? 0),
                0,
            ),
        [saldoSeries],
    );
    const quotationTotal = useMemo(
        () =>
            displayedStats.reduce(
                (sum, item) => sum + Number(item.total ?? 0),
                0,
            ),
        [displayedStats],
    );

    const [currentMonthSalesHpp, setCurrentMonthSalesHpp] = useState(null);

    // Sync currentMonthSalesHpp from whichever salesHpp response has current_month data
    useEffect(() => {
        if (salesHppData?.current_month) {
            setCurrentMonthSalesHpp(salesHppData.current_month);
        }
    }, [salesHppData?.current_month]);

    // Initial refresh date
    useEffect(() => {
        if (lastRefreshedAt) return;
        const anySuccess =
            (canViewCard('quotation') &&
                quotationRequest.status === 'success') ||
            (canViewCard('saldo') && saldoRequest.status === 'success') ||
            (canViewCard('delivery') && deliveryRequest.status === 'success') ||
            (canViewCard('receivable_payable') &&
                receivablePayableRequest.status === 'success') ||
            (canViewCard('sales_hpp') &&
                salesHppRequest.status === 'success') ||
            (canViewCard('stock_summary') &&
                stockSummaryRequest.status === 'success');
        if (anySuccess) setLastRefreshedAt(new Date());
    }, [
        lastRefreshedAt,
        quotationRequest.status,
        saldoRequest.status,
        deliveryRequest.status,
        receivablePayableRequest.status,
        salesHppRequest.status,
        stockSummaryRequest.status,
        canViewCard,
    ]);

    // Global Refresh
    const handleGlobalRefresh = useCallback(
        async (silent = false) => {
            if (!silent) setIsGlobalRefreshing(true);
            await Promise.allSettled([
                canViewCard('quotation')
                    ? quotationRequest.refresh(true, silent)
                    : Promise.resolve(),
                canViewCard('saldo')
                    ? saldoRequest.refresh(true, silent)
                    : Promise.resolve(),
                canViewCard('delivery')
                    ? deliveryRequest.refresh(true, silent)
                    : Promise.resolve(),
                canViewCard('receivable_payable')
                    ? receivablePayableRequest.refresh(true, silent)
                    : Promise.resolve(),
                canViewCard('sales_hpp')
                    ? salesHppRequest.refresh(true, silent)
                    : Promise.resolve(),
                canViewCard('stock_summary')
                    ? stockSummaryRequest.refresh(true, silent)
                    : Promise.resolve(),
            ]);
            setLastRefreshedAt(new Date());
            if (!silent) setIsGlobalRefreshing(false);
        },
        [
            canViewCard,
            quotationRequest,
            saldoRequest,
            deliveryRequest,
            receivablePayableRequest,
            salesHppRequest,
            stockSummaryRequest,
        ],
    );

    const refreshRef = useRef(handleGlobalRefresh);
    refreshRef.current = handleGlobalRefresh;

    // Auto-refresh interval effect
    useEffect(() => {
        if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
        const intervalId = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            refreshRef.current?.(true);
        }, autoRefreshInterval * 1000);
        return () => clearInterval(intervalId);
    }, [autoRefreshInterval]);

    // Sales HPP derived calculations
    const salesHppDerived = useMemo(() => {
        const series = salesHppData?.series || [];
        const max = Math.max(
            1,
            ...series.map((d) =>
                Math.max(
                    Number(d.sales ?? 0),
                    Number(d.hpp ?? 0),
                    Number(d.biaya ?? 0),
                ),
            ),
        );
        const totalSales = series.reduce(
            (sum, item) => sum + Number(item.sales ?? 0),
            0,
        );
        const totalHpp = series.reduce(
            (sum, item) => sum + Number(item.hpp ?? 0),
            0,
        );
        const totalBiaya = series.reduce(
            (sum, item) => sum + Number(item.biaya ?? 0),
            0,
        );
        const grossProfit = totalSales - totalHpp;
        const profitAfterBiaya = grossProfit - totalBiaya;
        const grossMarginPct =
            totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
        const profitAfterBiayaPct =
            totalSales > 0 ? (profitAfterBiaya / totalSales) * 100 : 0;
        return {
            max,
            series,
            totalSales,
            totalHpp,
            totalBiaya,
            grossProfit,
            profitAfterBiaya,
            grossMarginPct,
            profitAfterBiayaPct,
            currentMonth: salesHppData?.current_month ?? null,
        };
    }, [salesHppData]);

    const currentMonthInfo = useMemo(() => {
        const cm = currentMonthSalesHpp || salesHppDerived.currentMonth;
        const nowLabel = currentTime.toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric',
        });
        if (cm && typeof cm.sales !== 'undefined') {
            return {
                label: cm.label || nowLabel,
                sales: Number(cm.sales ?? 0),
                marginPct: Number(cm.net_margin_pct ?? cm.gross_margin_pct ?? 0),
            };
        }
        return {
            label: nowLabel,
            sales: salesHppDerived.totalSales,
            marginPct: salesHppDerived.profitAfterBiayaPct,
        };
    }, [currentMonthSalesHpp, salesHppDerived, currentTime]);

    const isSalesMarginMinus = Number(currentMonthInfo.marginPct ?? 0) < 0;

    // Spline data for SVG area chart mode
    const splineData = useMemo(() => {
        return buildSplinePoints(salesHppDerived.series, salesHppDerived.max, 960, 240);
    }, [salesHppDerived.series, salesHppDerived.max]);

    // Net working capital (Piutang - Hutang)
    const netWorkingCapital = useMemo(() => {
        const p = Number(piutangData?.total ?? 0);
        const h = Number(hutangData?.total ?? 0);
        return {
            diff: p - h,
            ratio: h > 0 ? p / h : 1,
        };
    }, [piutangData, hutangData]);

    const tenantDbKey = tenant?.database ? tenant.database.toLowerCase() : '';
    const companyName =
        databaseCompanies[tenantDbKey] ||
        tenant?.label ||
        (tenant?.database ? tenant.database.toUpperCase() : 'Enterprise Suite');

    const DashboardCardError = ({ message, onRetry }) => (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4.5" />
                <span>Gagal memuat data</span>
            </div>
            <div className="mt-1 text-xs opacity-80">{message}</div>
            <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRetry}
                className="mt-3 text-xs rounded-xl"
            >
                Coba lagi
            </Button>
        </div>
    );

    const GreetingIcon = greetingInfo.icon;

    return (
        <>
            <Head title="Executive Command Center - i-System" />

            {/* Main Container with Background Grid Pattern */}
            <div className="relative min-w-0 flex-1 space-y-6 sm:space-y-7 p-4 sm:p-6 lg:p-8 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px]">
                {/* Ambient Atmospheric Lights */}
                <DriftingOrnaments />

                {/* ─── 1. Executive Cyber Command Hero Header ──────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-r from-card/95 via-card/85 to-card/70 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/35 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/35 before:to-transparent"
                >
                    <div className="flex items-start sm:items-center gap-4">
                        <div className={`relative flex size-13 shrink-0 items-center justify-center rounded-2xl ${greetingInfo.containerClass}`}>
                            <GreetingIcon className={`size-6 ${greetingInfo.iconColor}`} />
                            <span className="absolute -top-1 -right-1 flex size-3">
                                <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${greetingInfo.pingClass}`} />
                                <span className={`relative inline-flex size-3 rounded-full ring-2 ring-background ${greetingInfo.dotClass}`} />
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {companyName}
                                </span>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                                    {currentTime.toLocaleTimeString('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                    })}
                                </span>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                                {greetingInfo.greeting},{' '}
                                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                                    {userName}
                                </span>
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                {greetingInfo.sub} • Terakhir disegarkan:{' '}
                                <span className="font-semibold text-foreground">
                                    {lastRefreshedAt
                                        ? lastRefreshedAt.toLocaleTimeString('id-ID', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })
                                        : 'Waktu-nyata'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Real-time 3D Weather Card & Quick Sync HUD */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                        <RealtimeWeatherCard className="w-full sm:w-auto" />

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <div className="flex items-center gap-2 rounded-2xl bg-muted/40 border border-sidebar-border/60 px-3.5 py-2 text-xs text-muted-foreground shadow-xs">
                                <Clock className="size-3.5 text-emerald-500" />
                                <span className="font-medium">Otomatis:</span>
                                <select
                                    className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
                                    value={autoRefreshInterval}
                                    onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                                >
                                    <option value={0} className="bg-popover text-popover-foreground">Manual (Off)</option>
                                    <option value={10} className="bg-popover text-popover-foreground">Tiap 10 dtk</option>
                                    <option value={30} className="bg-popover text-popover-foreground">Tiap 30 dtk</option>
                                    <option value={60} className="bg-popover text-popover-foreground">Tiap 1 mnt</option>
                                    <option value={300} className="bg-popover text-popover-foreground">Tiap 5 mnt</option>
                                </select>
                            </div>

                            <motion.button
                                type="button"
                                onClick={() => handleGlobalRefresh(false)}
                                disabled={isGlobalRefreshing}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.96 }}
                                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all cursor-pointer"
                            >
                                <RefreshCw
                                    className={`size-3.5 ${isGlobalRefreshing ? 'animate-spin' : ''
                                        }`}
                                />
                                <span>{isGlobalRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* ─── 2. Executive KPI Bento Grid ─────────────────────────────────── */}
                <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {/* KPI 1: Penjualan */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className={`group relative overflow-hidden rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-br from-card/95 via-card/75 to-background/50 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent ${isSalesMarginMinus
                                ? 'hover:border-rose-500/40 hover:shadow-rose-500/10 before:via-rose-500/40'
                                : 'hover:border-emerald-500/40 hover:shadow-emerald-500/10 before:via-emerald-500/40'
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                                    Total Penjualan
                                </span>
                                <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-foreground/80 border border-sidebar-border/60">
                                    {currentMonthInfo.label}
                                </span>
                            </div>
                            <div
                                className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate"
                                title={`Rp ${formatNumber(currentMonthInfo.sales)}`}
                            >
                                {salesHppRequest.status === 'pending' && !salesHppRequest.data ? (
                                    <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-muted/60" />
                                ) : (
                                    `Rp ${formatNumber(currentMonthInfo.sales)}`
                                )}
                            </div>
                        </div>

                        {/* Sparkline & Sub-bar */}
                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-sidebar-border/40">
                            <span
                                className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border text-xs ${isSalesMarginMinus
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    }`}
                            >
                                {isSalesMarginMinus ? (
                                    <TrendingDown className="size-3" />
                                ) : (
                                    <TrendingUp className="size-3" />
                                )}
                                {formatPercent(currentMonthInfo.marginPct)} Margin
                            </span>
                            <RealMetricSparkline
                                data={salesHppDerived.series}
                                color={isSalesMarginMinus ? 'rose' : 'emerald'}
                                fallbackValue={currentMonthInfo.sales}
                            />
                        </div>
                    </motion.div>

                    {/* KPI 2: Likuiditas Kas */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative overflow-hidden rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-br from-card/95 via-card/75 to-background/50 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-sky-500/40 hover:shadow-sky-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-500/40 before:to-transparent"
                    >
                        <div>
                            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                                Kas & Bank Liquid
                            </span>
                            <div className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate" title={`Rp ${formatNumber(totalSaldoKas)}`}>
                                {saldoRequest.status === 'pending' && totalSaldoKas === 0 ? (
                                    <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-muted/60" />
                                ) : (
                                    `Rp ${formatNumber(totalSaldoKas)}`
                                )}
                            </div>
                        </div>

                        {/* Sparkline & Sub-bar */}
                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-sidebar-border/40">
                            <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20 text-xs">
                                {saldoSeries.length} Akun Aktif
                            </span>
                            <RealMetricSparkline
                                data={saldoHistory.length > 0 ? saldoHistory : saldoSeries.map(s => Number(s.saldo ?? 0))}
                                color="sky"
                                fallbackValue={totalSaldoKas}
                            />
                        </div>
                    </motion.div>

                    {/* KPI 3: Piutang Usaha */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative overflow-hidden rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-br from-card/95 via-card/75 to-background/50 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-indigo-500/40 hover:shadow-indigo-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-indigo-500/40 before:to-transparent"
                    >
                        <div>
                            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                                Piutang Pelanggan
                            </span>
                            <div className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate" title={`Rp ${formatNumber(piutangData?.total ?? 0)}`}>
                                {receivablePayableRequest.status === 'pending' && !receivablePayableRequest.data ? (
                                    <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-muted/60" />
                                ) : (
                                    `Rp ${formatNumber(piutangData?.total ?? 0)}`
                                )}
                            </div>
                        </div>

                        {/* Sparkline & Sub-bar */}
                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-sidebar-border/40">
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 text-xs truncate max-w-[150px]">
                                {receivablePayableRequest.status === 'pending'
                                    ? 'Memuat data...'
                                    : piutangData?.last_update
                                        ? `Sinkron: ${formatDate(piutangData.last_update)}`
                                        : 'Terpantau'}
                            </span>
                            <RealMetricSparkline
                                data={piutangData?.history ?? []}
                                color="indigo"
                                fallbackValue={Number(piutangData?.total ?? 0)}
                            />
                        </div>
                    </motion.div>

                    {/* KPI 4: Hutang Usaha & Working Capital */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative overflow-hidden rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-br from-card/95 via-card/75 to-background/50 p-5 backdrop-blur-2xl shadow-lg shadow-black/[0.02] dark:shadow-black/25 hover:border-amber-500/40 hover:shadow-amber-500/10 transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-500/40 before:to-transparent"
                    >
                        <div>
                            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                                Hutang Supplier
                            </span>
                            <div className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate" title={`Rp ${formatNumber(hutangData?.total ?? 0)}`}>
                                {receivablePayableRequest.status === 'pending' && !receivablePayableRequest.data ? (
                                    <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-muted/60" />
                                ) : (
                                    `Rp ${formatNumber(hutangData?.total ?? 0)}`
                                )}
                            </div>
                        </div>

                        {/* Sparkline & Sub-bar */}
                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-sidebar-border/40">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 text-xs truncate max-w-[150px]">
                                {receivablePayableRequest.status === 'pending'
                                    ? 'Memuat data...'
                                    : hutangData?.last_update
                                        ? `Sinkron: ${formatDate(hutangData.last_update)}`
                                        : 'Terpantau'}
                            </span>
                            <RealMetricSparkline
                                data={hutangData?.history ?? []}
                                color="amber"
                                fallbackValue={Number(hutangData?.total ?? 0)}
                            />
                        </div>
                    </motion.div>
                </div>

                {/* ─── 3. Full-Width Flagship: Penjualan, HPP & Laba Intelligence ──── */}
                {canViewCard('sales_hpp') && (
                    <motion.div
                        ref={salesHppView.ref}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.25 }}
                        className="rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-gradient-to-b from-card/90 via-card/80 to-card/60 p-5 sm:p-7 backdrop-blur-2xl shadow-2xl shadow-black/[0.03] dark:shadow-black/35 relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/40 before:to-transparent"
                    >
                        {/* Top Controls Ribbon */}
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-sidebar-border/40 pb-5">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-xs">
                                        <TrendingUp className="size-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold tracking-tight text-foreground">
                                            Kinerja Finansial: Penjualan, HPP & Profitabilitas
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Komparasi analitis pendapatan penjualan, beban pokok, biaya operasional, dan margin laba
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* View Mode & Range Switchers */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Diagram Mode Switcher (Batang vs Kurva) */}
                                <div className="flex items-center rounded-2xl bg-muted/40 p-1 border border-sidebar-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setChartDisplayMode('bars')}
                                        className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${chartDisplayMode === 'bars'
                                                ? 'text-foreground'
                                                : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {chartDisplayMode === 'bars' && (
                                            <motion.div
                                                layoutId="chart-view-mode-pill"
                                                className="absolute inset-0 rounded-xl bg-background shadow-xs border border-sidebar-border/60"
                                                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                                            />
                                        )}
                                        <BarChart3 className="relative z-10 size-3.5" />
                                        <span className="relative z-10">Batang</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setChartDisplayMode('area')}
                                        className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${chartDisplayMode === 'area'
                                                ? 'text-foreground'
                                                : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {chartDisplayMode === 'area' && (
                                            <motion.div
                                                layoutId="chart-view-mode-pill"
                                                className="absolute inset-0 rounded-xl bg-background shadow-xs border border-sidebar-border/60"
                                                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                                            />
                                        )}
                                        <LineChart className="relative z-10 size-3.5" />
                                        <span className="relative z-10">Kurva Tren</span>
                                    </button>
                                </div>

                                {/* Range Filter Buttons with Motion Spring Pill */}
                                <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-muted/40 p-1 border border-sidebar-border/60">
                                    {rangeOptions.map((opt) => {
                                        const active = salesHppRange === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() => {
                                                    setSalesHppHover(null);
                                                    setSalesHppRange(opt.key);
                                                }}
                                                className={`relative rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${active
                                                        ? 'text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {active && (
                                                    <motion.div
                                                        layoutId="sales-hpp-range-pill"
                                                        className="absolute inset-0 rounded-xl bg-background shadow-xs border border-sidebar-border/60"
                                                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                                                    />
                                                )}
                                                <span className="relative z-10">{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Financial Metrics Strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-emerald-500/30 transition-colors">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total Penjualan
                                </div>
                                <div
                                    className="mt-1 text-base xl:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate"
                                    title={`Rp ${formatNumber(salesHppDerived.totalSales)}`}
                                >
                                    Rp {formatNumber(salesHppDerived.totalSales)}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-sky-500/30 transition-colors">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Total HPP
                                </div>
                                <div
                                    className="mt-1 text-base xl:text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums truncate"
                                    title={`Rp ${formatNumber(salesHppDerived.totalHpp)}`}
                                >
                                    Rp {formatNumber(salesHppDerived.totalHpp)}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-rose-500/30 transition-colors">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Biaya Operasional
                                </div>
                                <div
                                    className="mt-1 text-base xl:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums truncate"
                                    title={`Rp ${formatNumber(salesHppDerived.totalBiaya)}`}
                                >
                                    Rp {formatNumber(salesHppDerived.totalBiaya)}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-sidebar-border transition-colors">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Laba Kotor (Gross)
                                </div>
                                <div
                                    className="mt-1 text-base xl:text-lg font-black text-foreground tabular-nums truncate"
                                    title={`Rp ${formatNumber(salesHppDerived.grossProfit)}`}
                                >
                                    Rp {formatNumber(salesHppDerived.grossProfit)}{' '}
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        ({formatPercent(salesHppDerived.grossMarginPct)})
                                    </span>
                                </div>
                            </div>

                            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-sidebar-border transition-colors">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Laba Bersih (Net)
                                </div>
                                <div
                                    className="mt-1 text-base xl:text-lg font-black text-foreground tabular-nums truncate"
                                    title={`Rp ${formatNumber(salesHppDerived.profitAfterBiaya)}`}
                                >
                                    Rp {formatNumber(salesHppDerived.profitAfterBiaya)}{' '}
                                    <span
                                        className={`text-xs font-bold ${salesHppDerived.profitAfterBiaya >= 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                            }`}
                                    >
                                        ({formatPercent(salesHppDerived.profitAfterBiayaPct)})
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Chart Legend */}
                        <div className="mt-5 flex items-center justify-end gap-5 text-xs font-semibold text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <span className="size-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                                <span>Sales (Pendapatan)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="size-3 rounded-full bg-sky-500 shadow-xs shadow-sky-500/50" />
                                <span>HPP (Harga Pokok)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="size-3 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" />
                                <span>Biaya Operasional</span>
                            </div>
                        </div>

                        {/* Chart Render Area */}
                        <div className="mt-5 min-h-[260px] relative">
                            {salesHppRequest.status === 'error' ? (
                                <DashboardCardError
                                    message={salesHppRequest.error}
                                    onRetry={salesHppRequest.retry}
                                />
                            ) : salesHppRequest.status !== 'success' ? (
                                <div className="flex h-56 items-end gap-3 pt-6 animate-pulse">
                                    {Array.from({ length: 8 }).map((_, idx) => (
                                        <div key={idx} className="flex-1 space-y-2">
                                            <div className="h-44 w-full rounded-2xl bg-muted/50" />
                                            <div className="h-3 w-12 rounded bg-muted/40 mx-auto" />
                                        </div>
                                    ))}
                                </div>
                            ) : salesHppDerived.series.length === 0 ? (
                                <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                                    Tidak ada data transaksi pada rentang waktu ini.
                                </div>
                            ) : chartDisplayMode === 'area' ? (
                                /* ─── Mode A: Smooth SVG Area Spline Chart ─── */
                                <div className="relative w-full pt-4 overflow-hidden">
                                    <svg
                                        viewBox={`0 0 ${splineData.width} ${splineData.height}`}
                                        className="w-full h-64 overflow-visible"
                                        preserveAspectRatio="none"
                                    >
                                        <defs>
                                            <linearGradient id="areaSalesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                            </linearGradient>
                                            <linearGradient id="areaHppGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                                            </linearGradient>
                                            <linearGradient id="areaBiayaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                                                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Horizontal Guideline Grids */}
                                        {[0.25, 0.5, 0.75, 1].map((ratio) => {
                                            const y =
                                                splineData.height -
                                                splineData.paddingYBottom -
                                                ratio * (splineData.height - 20 - splineData.paddingYBottom);
                                            return (
                                                <g key={ratio}>
                                                    <line
                                                        x1={splineData.paddingX}
                                                        y1={y}
                                                        x2={splineData.width - splineData.paddingX}
                                                        y2={y}
                                                        stroke="currentColor"
                                                        strokeOpacity="0.08"
                                                        strokeDasharray="4 4"
                                                    />
                                                </g>
                                            );
                                        })}

                                        {/* Baseline */}
                                        <line
                                            x1={splineData.paddingX}
                                            y1={splineData.height - splineData.paddingYBottom}
                                            x2={splineData.width - splineData.paddingX}
                                            y2={splineData.height - splineData.paddingYBottom}
                                            stroke="currentColor"
                                            strokeOpacity="0.15"
                                        />

                                        {/* Area Fills */}
                                        <path
                                            d={pointsToAreaPath(
                                                splineData.salesPoints,
                                                splineData.height,
                                                splineData.paddingYBottom,
                                            )}
                                            fill="url(#areaSalesGrad)"
                                        />
                                        <path
                                            d={pointsToAreaPath(
                                                splineData.hppPoints,
                                                splineData.height,
                                                splineData.paddingYBottom,
                                            )}
                                            fill="url(#areaHppGrad)"
                                        />
                                        <path
                                            d={pointsToAreaPath(
                                                splineData.biayaPoints,
                                                splineData.height,
                                                splineData.paddingYBottom,
                                            )}
                                            fill="url(#areaBiayaGrad)"
                                        />

                                        {/* Smooth Spline Curves with Motion Path Animation */}
                                        <motion.path
                                            d={pointsToSplinePath(splineData.biayaPoints)}
                                            fill="none"
                                            stroke="#f43f5e"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                        />
                                        <motion.path
                                            d={pointsToSplinePath(splineData.hppPoints)}
                                            fill="none"
                                            stroke="#0ea5e9"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.8, delay: 0.05, ease: 'easeOut' }}
                                        />
                                        <motion.path
                                            d={pointsToSplinePath(splineData.salesPoints)}
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                                        />

                                        {/* Interactive Scrubbing Dots & Value Labels */}
                                        {splineData.coords.map((c, i) => {
                                            const showSales = c.sales > 0;
                                            const showHpp = c.hpp > 0;
                                            const showBiaya = c.biaya > 0;
                                            const colWidth = splineData.usableWidth / Math.max(splineData.coords.length, 1);

                                            return (
                                                <g
                                                    key={i}
                                                    className="group/node cursor-pointer"
                                                    onMouseEnter={(e) => {
                                                        setSalesHppHover({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            label: c.label,
                                                            sales: c.sales,
                                                            hpp: c.hpp,
                                                            biaya: c.biaya,
                                                        });
                                                    }}
                                                    onMouseMove={(e) => {
                                                        setSalesHppHover((prev) =>
                                                            prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
                                                        );
                                                    }}
                                                    onMouseLeave={() => setSalesHppHover(null)}
                                                >
                                                    {/* Invisible vertical scrubber hit-area for effortless hovering */}
                                                    <rect
                                                        x={c.x - colWidth / 2}
                                                        y={0}
                                                        width={colWidth}
                                                        height={splineData.height}
                                                        fill="transparent"
                                                        className="hover:fill-foreground/[0.03] transition-colors"
                                                    />

                                                    {/* Sales Dot & Value */}
                                                    <circle
                                                        cx={c.x}
                                                        cy={c.sy}
                                                        r="4.5"
                                                        fill="#10b981"
                                                        stroke="#ffffff"
                                                        strokeWidth="2"
                                                        className="transition-transform group-hover/node:scale-125"
                                                    />
                                                    {showSales && (
                                                        <text
                                                            x={c.x}
                                                            y={c.sy - 8}
                                                            textAnchor="middle"
                                                            className="fill-emerald-600 dark:fill-emerald-400 font-black select-none pointer-events-none drop-shadow-xs"
                                                            style={{ fontSize: '10px', fontWeight: 800 }}
                                                        >
                                                            {formatCompactNumber(c.sales)}
                                                        </text>
                                                    )}

                                                    {/* HPP Dot & Value */}
                                                    <circle
                                                        cx={c.x}
                                                        cy={c.hy}
                                                        r="4"
                                                        fill="#0ea5e9"
                                                        stroke="#ffffff"
                                                        strokeWidth="1.5"
                                                        className="transition-transform group-hover/node:scale-125"
                                                    />
                                                    {showHpp && Math.abs(c.hy - c.sy) > 18 && (
                                                        <text
                                                            x={c.x}
                                                            y={c.hy > c.sy ? c.hy + 13 : c.hy - 7}
                                                            textAnchor="middle"
                                                            className="fill-sky-600 dark:fill-sky-400 font-black select-none pointer-events-none drop-shadow-xs"
                                                            style={{ fontSize: '9px', fontWeight: 800 }}
                                                        >
                                                            {formatCompactNumber(c.hpp)}
                                                        </text>
                                                    )}

                                                    {/* Biaya Dot & Value */}
                                                    <circle
                                                        cx={c.x}
                                                        cy={c.by}
                                                        r="3.5"
                                                        fill="#f43f5e"
                                                        stroke="#ffffff"
                                                        strokeWidth="1.5"
                                                        className="transition-transform group-hover/node:scale-125"
                                                    />
                                                    {showBiaya && Math.abs(c.by - c.hy) > 16 && Math.abs(c.by - c.sy) > 16 && (
                                                        <text
                                                            x={c.x}
                                                            y={c.by + 13}
                                                            textAnchor="middle"
                                                            className="fill-rose-600 dark:fill-rose-400 font-black select-none pointer-events-none drop-shadow-xs"
                                                            style={{ fontSize: '9px', fontWeight: 800 }}
                                                        >
                                                            {formatCompactNumber(c.biaya)}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>

                                    {/* X-Axis Labels Below */}
                                    <div className="flex justify-between px-10 text-[11px] font-bold text-muted-foreground pt-2">
                                        {salesHppDerived.series.map((item) => (
                                            <span
                                                key={item.period}
                                                className="text-center truncate px-1 hover:text-foreground cursor-pointer transition-colors"
                                                onMouseEnter={(e) => {
                                                    setSalesHppHover({
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        label: item.label,
                                                        sales: Number(item.sales ?? 0),
                                                        hpp: Number(item.hpp ?? 0),
                                                        biaya: Number(item.biaya ?? 0),
                                                    });
                                                }}
                                                onMouseMove={(e) => {
                                                    setSalesHppHover((prev) =>
                                                        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
                                                    );
                                                }}
                                                onMouseLeave={() => setSalesHppHover(null)}
                                            >
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* ─── Mode B: Multi-Bar Comparative Chart ─── */
                                <div className="flex items-end gap-3 sm:gap-5 overflow-x-auto pb-2 pt-6 min-h-[260px] scrollbar-thin">
                                    {salesHppDerived.series.map((item) => {
                                        const sVal = Number(item.sales ?? 0);
                                        const hVal = Number(item.hpp ?? 0);
                                        const bVal = Number(item.biaya ?? 0);

                                        const safeScale =
                                            salesHppDerived.max > 0 ? salesHppDerived.max * 1.18 : 1;
                                        const sPct = (sVal / safeScale) * 100;
                                        const hPct = (hVal / safeScale) * 100;
                                        const bPct = (bVal / safeScale) * 100;

                                        return (
                                            <div
                                                key={item.period}
                                                className="group flex flex-1 min-w-[85px] sm:min-w-[95px] flex-col items-center gap-2 cursor-pointer"
                                                onMouseEnter={(e) => {
                                                    setSalesHppHover({
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        label: item.label,
                                                        sales: sVal,
                                                        hpp: hVal,
                                                        biaya: bVal,
                                                    });
                                                }}
                                                onMouseMove={(e) => {
                                                    setSalesHppHover((prev) =>
                                                        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
                                                    );
                                                }}
                                                onMouseLeave={() => setSalesHppHover(null)}
                                            >
                                                <div className="relative flex h-52 w-full items-end justify-center gap-1.5 rounded-2xl bg-muted/20 p-2 group-hover:bg-muted/40 group-hover:ring-1 group-hover:ring-emerald-500/20 transition-all">
                                                    {/* Sales Bar */}
                                                    <div className="flex flex-col items-center flex-1 h-full justify-end min-w-0">
                                                        <span
                                                            className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mb-1 leading-none tabular-nums truncate max-w-full"
                                                            title={`Sales: Rp ${formatNumber(sVal)}`}
                                                        >
                                                            {sVal > 0 ? formatCompactNumber(sVal) : '-'}
                                                        </span>
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${Math.max(sPct, 4)}%` }}
                                                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                                            className="w-full rounded-t-md rounded-b-xs bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-xs shadow-emerald-500/30 group-hover:brightness-110"
                                                        />
                                                    </div>

                                                    {/* HPP Bar */}
                                                    <div className="flex flex-col items-center flex-1 h-full justify-end min-w-0">
                                                        <span
                                                            className="text-[9px] font-black text-sky-600 dark:text-sky-400 mb-1 leading-none tabular-nums truncate max-w-full"
                                                            title={`HPP: Rp ${formatNumber(hVal)}`}
                                                        >
                                                            {hVal > 0 ? formatCompactNumber(hVal) : '-'}
                                                        </span>
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${Math.max(hPct, 4)}%` }}
                                                            transition={{
                                                                duration: 0.6,
                                                                delay: 0.05,
                                                                ease: [0.16, 1, 0.3, 1],
                                                            }}
                                                            className="w-full rounded-t-md rounded-b-xs bg-gradient-to-t from-sky-600 to-cyan-400 shadow-xs shadow-sky-500/30 group-hover:brightness-110"
                                                        />
                                                    </div>

                                                    {/* Biaya Bar */}
                                                    <div className="flex flex-col items-center flex-1 h-full justify-end min-w-0">
                                                        <span
                                                            className="text-[9px] font-black text-rose-600 dark:text-rose-400 mb-1 leading-none tabular-nums truncate max-w-full"
                                                            title={`Biaya: Rp ${formatNumber(bVal)}`}
                                                        >
                                                            {bVal > 0 ? formatCompactNumber(bVal) : '-'}
                                                        </span>
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${Math.max(bPct, 4)}%` }}
                                                            transition={{
                                                                duration: 0.6,
                                                                delay: 0.1,
                                                                ease: [0.16, 1, 0.3, 1],
                                                            }}
                                                            className="w-full rounded-t-md rounded-b-xs bg-gradient-to-t from-rose-600 to-rose-400 shadow-xs shadow-rose-500/30 group-hover:brightness-110"
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground text-center truncate w-full transition-colors">
                                                    {item.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Interactive Floating Hover Tooltip (Portaled directly to document.body to prevent transform/overflow clipping) */}
                        {typeof document !== 'undefined' &&
                            createPortal(
                                <AnimatePresence>
                                    {salesHppHover && (() => {
                                        const tooltipWidth = 260;
                                        const tooltipHeight = 180;
                                        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
                                        const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
                                        const isRightSide = salesHppHover.x > screenW / 2;
                                        const tooltipLeft = isRightSide
                                            ? Math.max(16, salesHppHover.x - tooltipWidth - 16)
                                            : Math.min(screenW - tooltipWidth - 16, salesHppHover.x + 16);
                                        const tooltipTop = Math.max(
                                            16,
                                            Math.min(screenH - tooltipHeight - 16, salesHppHover.y - tooltipHeight / 2),
                                        );

                                        return (
                                            <motion.div
                                                key="sales-hpp-tooltip"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.12 }}
                                                className="pointer-events-none fixed z-[99999] min-w-[260px] rounded-2xl border border-sidebar-border/80 bg-popover/95 p-4 text-xs text-popover-foreground shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10"
                                                style={{
                                                    left: tooltipLeft,
                                                    top: tooltipTop,
                                                }}
                                            >
                                                <div className="font-bold text-foreground text-sm truncate border-b border-sidebar-border/40 pb-2 flex items-center justify-between">
                                                    <span>{salesHppHover.label}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                                        Rincian Periode
                                                    </span>
                                                </div>
                                                <div className="mt-2.5 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                                                        <span>Penjualan:</span>
                                                        <span className="font-black tabular-nums">
                                                            Rp {formatNumber(salesHppHover.sales)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-sky-600 dark:text-sky-400">
                                                        <span>HPP:</span>
                                                        <span className="font-black tabular-nums">
                                                            Rp {formatNumber(salesHppHover.hpp)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                                                        <span>Biaya Operasional:</span>
                                                        <span className="font-black tabular-nums">
                                                            Rp {formatNumber(salesHppHover.biaya)}
                                                        </span>
                                                    </div>
                                                    <div className="border-t border-sidebar-border/50 pt-2 mt-2 flex items-center justify-between gap-3 text-foreground font-bold">
                                                        <span>Laba Kotor:</span>
                                                        <span className="tabular-nums">
                                                            Rp {formatNumber(salesHppHover.sales - salesHppHover.hpp)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-muted-foreground font-semibold">
                                                        <span>Laba Bersih:</span>
                                                        <span className="tabular-nums text-foreground">
                                                            Rp{' '}
                                                            {formatNumber(
                                                                salesHppHover.sales -
                                                                salesHppHover.hpp -
                                                                salesHppHover.biaya,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })()}
                                </AnimatePresence>,
                                document.body,
                            )}
                    </motion.div>
                )}

                {/* ─── 4. Secondary Bento Grid Section ─────────────────────────────── */}
                <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4 items-stretch">
                    {/* Quotation Analytics */}
                    {canViewCard('quotation') && (
                        <div ref={quotationView.ref} className="min-w-0 lg:col-span-1 2xl:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="flex h-full flex-col rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-card/85 dark:bg-card/45 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/30 before:to-transparent relative overflow-hidden"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sidebar-border/40 pb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <PieChart className="size-4" />
                                            </div>
                                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                                Pipeline Quotation Sales
                                            </h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Frekuensi penawaran harga kepada calon pembeli
                                        </p>
                                    </div>

                                    {/* Range Filter Buttons */}
                                    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/40 p-1 border border-sidebar-border/50">
                                        {rangeOptions.map((opt) => {
                                            const active = quotationRange === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    onClick={() => setQuotationRange(opt.key)}
                                                    className={`relative rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${active
                                                            ? 'text-foreground'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    {active && (
                                                        <motion.div
                                                            layoutId="quotation-range-pill"
                                                            className="absolute inset-0 rounded-lg bg-background shadow-xs border border-sidebar-border/60"
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

                                <div className="mt-4 flex flex-1 flex-col justify-between">
                                    {quotationRequest.status === 'error' ? (
                                        <DashboardCardError
                                            message={quotationRequest.error}
                                            onRetry={quotationRequest.retry}
                                        />
                                    ) : quotationRequest.status !== 'success' ? (
                                        <div className="flex h-44 items-end gap-3 pt-6 animate-pulse">
                                            {Array.from({ length: 6 }).map((_, idx) => (
                                                <div key={idx} className="flex-1 space-y-2">
                                                    <div className="h-32 w-full rounded-2xl bg-muted/50" />
                                                    <div className="h-3 w-12 rounded bg-muted/40 mx-auto" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : displayedStats.length === 0 ? (
                                        <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-muted-foreground">
                                            Belum ada data quotation pada periode ini.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    Total Terbit: {formatNumber(quotationTotal)} Berkas
                                                </span>
                                            </div>

                                            <div className="flex items-end gap-3 pt-4 min-h-[170px] overflow-x-auto pb-2 scrollbar-thin">
                                                {displayedStats.map((item) => {
                                                    const rawVal = Number(item.total ?? 0);
                                                    const pct =
                                                        maxTotal > 0 ? (rawVal / maxTotal) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={item.period}
                                                            className="flex flex-1 min-w-[52px] flex-col items-center gap-2 group"
                                                        >
                                                            <span className="text-[11px] font-bold text-foreground tabular-nums group-hover:text-emerald-500 transition-colors">
                                                                {formatNumber(rawVal)}
                                                            </span>
                                                            <div className="relative flex h-36 w-full items-end justify-center rounded-2xl bg-muted/20 p-1">
                                                                <motion.div
                                                                    initial={{ height: 0 }}
                                                                    animate={{ height: `${Math.max(pct, 6)}%` }}
                                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                                    className="w-full rounded-xl bg-gradient-to-t from-emerald-600 to-teal-400 dark:from-emerald-500 dark:to-cyan-400 shadow-xs shadow-emerald-500/25 group-hover:brightness-110"
                                                                />
                                                            </div>
                                                            <span className="text-[11px] font-semibold text-muted-foreground text-center truncate w-full">
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Saldo Kas & Rekening */}
                    {canViewCard('saldo') && (
                        <div ref={saldoView.ref} className="min-w-0 lg:col-span-1 2xl:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.05 }}
                                className="flex h-full flex-col rounded-3xl border border-sidebar-border border-sidebar-border/70 bg-card bg-card/85 dark:bg-card/45 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-500/30 before:to-transparent relative overflow-hidden"
                            >
                                <div className="flex items-center justify-between border-b border-sidebar-border/40 pb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                                <Wallet className="size-4" />
                                            </div>
                                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                                Likuiditas Kas & Bank
                                            </h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Posisi saldo per rekening kas perusahaan
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                        Rp {formatCompactNumber(totalSaldoKas)}
                                    </span>
                                </div>

                                <div className="mt-4 flex flex-1 flex-col">
                                    {saldoRequest.status === 'error' ? (
                                        <DashboardCardError
                                            message={saldoRequest.error}
                                            onRetry={saldoRequest.retry}
                                        />
                                    ) : saldoRequest.status !== 'success' ? (
                                        <div className="space-y-3 animate-pulse pt-2">
                                            {Array.from({ length: 4 }).map((_, idx) => (
                                                <div key={idx} className="h-14 rounded-2xl bg-muted/40" />
                                            ))}
                                        </div>
                                    ) : saldoSeries.length === 0 ? (
                                        <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-muted-foreground">
                                            Data saldo belum tersedia.
                                        </div>
                                    ) : (
                                        <div className="flex-1 space-y-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                                            {saldoSeries.map((item) => {
                                                const val = Number(item.saldo ?? 0);
                                                const ratio = maxSaldo > 0 ? (val / maxSaldo) * 100 : 0;
                                                return (
                                                    <div
                                                        key={item.code}
                                                        className="group rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3 hover:bg-muted/40 hover:border-sky-500/30 transition-all"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 text-xs">
                                                            <div className="font-bold text-foreground truncate flex items-center gap-2">
                                                                <span className="size-2 rounded-full bg-sky-500/80" />
                                                                <span className="truncate">{item.label}</span>
                                                            </div>
                                                            <div className="font-black text-sky-600 dark:text-sky-400 tabular-nums">
                                                                Rp {formatNumber(val)}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                                                                    style={{ width: `${Math.max(ratio, 4)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                                                                Voucher: {formatDate(item.last_voucher)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Ringkasan Stok Persediaan */}
                    {canViewCard('stock_summary') && (
                        <div className="min-w-0 lg:col-span-1 2xl:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="flex h-full flex-col rounded-3xl border border-sidebar-border/70 bg-card/85 dark:bg-card/45 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-teal-500/30 before:to-transparent relative overflow-hidden"
                            >
                                <div className="border-b border-sidebar-border/40 pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                                            <Package className="size-4" />
                                        </div>
                                        <h2 className="text-base font-bold tracking-tight text-foreground">
                                            Valuasi & Rekonsiliasi Stok
                                        </h2>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Perbandingan stok fisik gudang versus stok buku persediaan
                                    </p>
                                </div>

                                <div className="mt-4 flex flex-1 flex-col justify-between">
                                    {stockSummaryRequest.status === 'error' ? (
                                        <DashboardCardError
                                            message={stockSummaryRequest.error}
                                            onRetry={stockSummaryRequest.retry}
                                        />
                                    ) : stockSummaryRequest.status !== 'success' ? (
                                        <div className="space-y-3 animate-pulse pt-1">
                                            <div className="h-14 rounded-2xl bg-muted/40" />
                                            <div className="h-14 rounded-2xl bg-muted/40" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-sidebar-border transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Stok Fisik
                                                    </span>
                                                    {stockSummary.physical_last_update && (
                                                        <span className="text-[9px] font-semibold text-muted-foreground/80">
                                                            {formatDate(stockSummary.physical_last_update)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="mt-1 text-base font-black text-foreground tabular-nums truncate"
                                                    title={stockSummary.physical === null ? '-' : `Rp ${formatNumber(stockSummary.physical)}`}
                                                >
                                                    {stockSummary.physical === null
                                                        ? '-'
                                                        : `Rp ${formatNumber(stockSummary.physical)}`}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-sidebar-border/60 bg-muted/20 p-3.5 hover:border-sidebar-border transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Stok Buku
                                                    </span>
                                                    {stockSummary.book_last_update && (
                                                        <span className="text-[9px] font-semibold text-muted-foreground/80">
                                                            {formatDate(stockSummary.book_last_update)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="mt-1 text-base font-black text-foreground tabular-nums truncate"
                                                    title={stockSummary.book === null ? '-' : `Rp ${formatNumber(stockSummary.book)}`}
                                                >
                                                    {stockSummary.book === null
                                                        ? '-'
                                                        : `Rp ${formatNumber(stockSummary.book)}`}
                                                </div>
                                            </div>

                                            {(() => {
                                                const isMinus =
                                                    stockSummary.difference !== null &&
                                                    stockSummary.difference < 0;
                                                return (
                                                    <div
                                                        className={`rounded-2xl border p-3.5 transition-colors ${isMinus
                                                                ? 'border-rose-500/40 bg-rose-500/10'
                                                                : 'border-emerald-500/40 bg-emerald-500/10'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                Selisih Stok
                                                            </span>
                                                            <span className={`text-[9px] font-bold ${isMinus ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {isMinus ? 'Defisit' : 'Seimbang / Surplus'}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={`mt-1 text-base font-black tabular-nums truncate ${isMinus
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : 'text-emerald-600 dark:text-emerald-400'
                                                                }`}
                                                            title={stockSummary.difference === null ? '-' : `Rp ${formatNumber(stockSummary.difference)}`}
                                                        >
                                                            {stockSummary.difference === null
                                                                ? '-'
                                                                : `Rp ${formatNumber(stockSummary.difference)}`}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Sisa Delivery */}
                    {canViewCard('delivery') && (
                        <div ref={deliveryView.ref} className="min-w-0 lg:col-span-1 2xl:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.15 }}
                                className="flex h-full flex-col rounded-3xl border border-sidebar-border/70 bg-card/85 dark:bg-card/45 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-500/30 before:to-transparent relative overflow-hidden"
                            >
                                <div className="border-b border-sidebar-border/40 pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                <Truck className="size-4" />
                                            </div>
                                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                                Sisa Delivery Pipeline
                                            </h2>
                                        </div>

                                        <div className="flex rounded-xl bg-muted/50 p-1 border border-sidebar-border/50">
                                            <button
                                                type="button"
                                                onClick={() => setActiveDeliveryTab('pdb')}
                                                className={`relative rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${activeDeliveryTab === 'pdb'
                                                        ? 'text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {activeDeliveryTab === 'pdb' && (
                                                    <motion.div
                                                        layoutId="delivery-tab-indicator"
                                                        className="absolute inset-0 rounded-lg bg-background shadow-xs border border-sidebar-border/60"
                                                        transition={{
                                                            type: 'spring',
                                                            stiffness: 450,
                                                            damping: 30,
                                                        }}
                                                    />
                                                )}
                                                <span className="relative z-10">PDB</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveDeliveryTab('pdo')}
                                                className={`relative rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${activeDeliveryTab === 'pdo'
                                                        ? 'text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {activeDeliveryTab === 'pdo' && (
                                                    <motion.div
                                                        layoutId="delivery-tab-indicator"
                                                        className="absolute inset-0 rounded-lg bg-background shadow-xs border border-sidebar-border/60"
                                                        transition={{
                                                            type: 'spring',
                                                            stiffness: 450,
                                                            damping: 30,
                                                        }}
                                                    />
                                                )}
                                                <span className="relative z-10">PDO</span>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {activeDeliveryTab === 'pdb'
                                            ? 'Permintaan Dana Biaya pengiriman belum terselesaikan'
                                            : 'Permintaan Dana Operasional pengiriman belum terselesaikan'}
                                    </p>
                                </div>

                                <div className="mt-4 flex flex-1 flex-col justify-center">
                                    {deliveryRequest.status === 'error' ? (
                                        <DashboardCardError
                                            message={deliveryRequest.error}
                                            onRetry={deliveryRequest.retry}
                                        />
                                    ) : deliveryRequest.status !== 'success' ? (
                                        <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
                                    ) : (
                                        <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5 p-5 text-center">
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                Total Sisa {activeDeliveryTab.toUpperCase()}
                                            </div>
                                            <div className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums">
                                                Rp{' '}
                                                {formatNumber(
                                                    activeDeliveryTab === 'pdb'
                                                        ? pdbData?.total ?? 0
                                                        : pdoData?.total ?? 0,
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>

                {/* ─── 5. Collaborative Team Notes Workspace ───────────────────────── */}
                {canViewCard('user_note') && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="rounded-3xl border border-sidebar-border/70 bg-card/85 dark:bg-card/45 backdrop-blur-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/30 before:to-transparent relative overflow-hidden"
                    >
                        <UserNote />
                    </motion.div>
                )}
            </div>
        </>
    );
}

Dashboard.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
