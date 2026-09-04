import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowLeft,
    ArrowUpDown,
    ArrowUpRight,
    Award,
    Banknote,
    BarChart3,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    FileText,
    Filter,
    HelpCircle,
    Layers,
    Lightbulb,
    Loader2,
    Minus,
    Package,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
    Tag,
    Target,
    TrendingDown,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)))}`;

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)));

const formatPercent = (value) => {
    const num = Number(value || 0);
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatCompactRupiah = (value) => {
    const num = Number(value || 0);
    if (num >= 1_000_000_000) {
        const v = (num / 1_000_000_000).toFixed(2);
        return v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') + ' M';
    }
    if (num >= 1_000_000) {
        const v = (num / 1_000_000).toFixed(2);
        return v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') + ' jt';
    }
    if (num >= 1_000) {
        return Math.round(num / 1_000) + ' rb';
    }
    if (num === 0) return 'Rp 0';
    return String(num);
};

const formatBarLabel = (value) => {
    const num = Number(value || 0);
    if (num >= 1_000_000_000) {
        const v = (num / 1_000_000_000).toFixed(2);
        return v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') + 'M';
    }
    if (num >= 1_000_000) {
        const v = (num / 1_000_000).toFixed(2);
        return v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') + 'jt';
    }
    if (num >= 1_000) {
        return Math.round(num / 1_000) + 'rb';
    }
    if (num === 0) return '0';
    return String(Math.round(num));
};

const monthOptions = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
];

const weekOptions = [
    { value: 1, label: 'Minggu 1 (Tgl 01 - 07)' },
    { value: 2, label: 'Minggu 2 (Tgl 08 - 14)' },
    { value: 3, label: 'Minggu 3 (Tgl 15 - 21)' },
    { value: 4, label: 'Minggu 4 (Tgl 22 - 28)' },
    { value: 5, label: 'Minggu 5 (Tgl 29 - Akhir)' },
];

const quarterOptions = [
    { value: 1, label: 'Triwulan 1 (Jan - Mar)' },
    { value: 2, label: 'Triwulan 2 (Apr - Jun)' },
    { value: 3, label: 'Triwulan 3 (Jul - Sep)' },
    { value: 4, label: 'Triwulan 4 (Okt - Des)' },
];

const semesterOptions = [
    { value: 1, label: 'Semester 1 (Jan - Jun)' },
    { value: 2, label: 'Semester 2 (Jul - Des)' },
];

export default function CustomerPerformanceDetail({
    customer = {},
    initialFilters = {},
    availableYears = [2026, 2025, 2024, 2023, 2022],
}) {
    const customerCode = customer.kd_cs || '';
    const customerName = customer.nm_cs || customerCode;

    // Filter states
    const [periodType, setPeriodType] = useState(
        initialFilters.period_type || 'monthly',
    );
    const [year, setYear] = useState(Number(initialFilters.year || 2026));
    const [month, setMonth] = useState(Number(initialFilters.month || 8));
    const [week, setWeek] = useState(Number(initialFilters.week || 1));
    const [quarter, setQuarter] = useState(Number(initialFilters.quarter || 3));
    const [semester, setSemester] = useState(Number(initialFilters.semester || 2));
    const [startYear, setStartYear] = useState(
        Number(initialFilters.start_year || 2022),
    );
    const [endYear, setEndYear] = useState(
        Number(initialFilters.end_year || 2026),
    );

    // Data states
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    // AI Analysis states
    const [aiLoading, setAiLoading] = useState(false);
    const [aiData, setAiData] = useState(null);
    const [aiEngine, setAiEngine] = useState('');
    const [aiIsFallback, setAiIsFallback] = useState(false);
    const [aiNotice, setAiNotice] = useState('');
    const [aiError, setAiError] = useState(null);
    const [aiCopied, setAiCopied] = useState(false);
    const [aiCollapsed, setAiCollapsed] = useState(false);

    // Table & Chart UI states
    const [hoveredChartItem, setHoveredChartItem] = useState(null);
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [invoicePage, setInvoicePage] = useState(1);
    const invoicesPerPage = 8;

    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Marketing', href: '/marketing/performance' },
        { title: 'Performance', href: '/marketing/performance' },
        { title: customerName, href: '#' },
    ];

    // Fetch customer data
    const fetchCustomerData = async (overrideFilters = null) => {
        setLoading(true);
        try {
            const pType = overrideFilters?.period_type ?? periodType;
            const pYear = overrideFilters?.year ?? year;
            const pMonth = overrideFilters?.month ?? month;
            const pWeek = overrideFilters?.week ?? week;
            const pQuarter = overrideFilters?.quarter ?? quarter;
            const pSemester = overrideFilters?.semester ?? semester;
            const pStartYear = overrideFilters?.start_year ?? startYear;
            const pEndYear = overrideFilters?.end_year ?? endYear;

            const params = new URLSearchParams({
                period_type: pType,
                year: String(pYear),
                month: String(pMonth),
                week: String(pWeek),
                quarter: String(pQuarter),
                semester: String(pSemester),
                start_year: String(pStartYear),
                end_year: String(pEndYear),
            });

            const res = await fetch(
                `/marketing/performance/customer/${encodeURIComponent(customerCode)}/data?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );

            if (!res.ok) {
                throw new Error('Gagal memuat data performa customer.');
            }

            const json = await res.json();
            setData(json);
            setInvoicePage(1);

            // Auto-trigger AI Analysis
            fetchCustomerAi(overrideFilters);
        } catch (error) {
            console.error('Error fetching customer performance data:', error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat Data',
                text: error.message || 'Terjadi kesalahan saat memuat data KPI Customer.',
            });
        } finally {
            setLoading(false);
        }
    };

    // Fetch AI Analysis specifically for this customer
    const fetchCustomerAi = async (overrideFilters = null, force = false) => {
        setAiLoading(true);
        setAiData(null);
        setAiError(null);
        try {
            const pType = overrideFilters?.period_type ?? periodType;
            const pYear = overrideFilters?.year ?? year;
            const pMonth = overrideFilters?.month ?? month;
            const pWeek = overrideFilters?.week ?? week;
            const pQuarter = overrideFilters?.quarter ?? quarter;
            const pSemester = overrideFilters?.semester ?? semester;
            const pStartYear = overrideFilters?.start_year ?? startYear;
            const pEndYear = overrideFilters?.end_year ?? endYear;

            let csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') || '';
            if (!csrfToken) {
                const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
                if (match) csrfToken = decodeURIComponent(match[1]);
            }

            const res = await fetch(
                `/marketing/performance/customer/${encodeURIComponent(customerCode)}/ai-analyze`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-XSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        period_type: pType,
                        year: pYear,
                        month: pMonth,
                        week: pWeek,
                        quarter: pQuarter,
                        semester: pSemester,
                        start_year: pStartYear,
                        end_year: pEndYear,
                        force,
                    }),
                },
            );

            if (!res.ok) {
                if (res.status === 504) {
                    throw new Error('Server VPS Gateway Time-out (504). AI di VPS sedang proses awal / antre di memori. Silakan klik Analisis Ulang.');
                }
                throw new Error(`Gagal memuat analisis AI (${res.status}).`);
            }

            const json = await res.json();
            if (json.success && json.data) {
                setAiData(json.data);
                setAiEngine(json.engine || 'qwen2.5:7b (Ollama)');
                setAiIsFallback(Boolean(json.is_fallback));
                setAiNotice(json.notice || '');
            } else {
                throw new Error(json.notice || 'Gagal memproses data analisis.');
            }
        } catch (err) {
            console.error('Customer AI Error:', err);
            setAiError(err.message || 'Gagal memuat analisis AI customer.');
        } finally {
            setAiLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchCustomerData();
    }, [customerCode]);

    // Handle filter submit
    const handleApplyFilter = (e) => {
        if (e) e.preventDefault();
        fetchCustomerData();
    };

    // Handle reset filter
    const handleResetFilter = () => {
        setPeriodType('monthly');
        setYear(2026);
        setMonth(8);
        setWeek(1);
        setQuarter(3);
        setSemester(2);
        setStartYear(2022);
        setEndYear(2026);
        fetchCustomerData({
            period_type: 'monthly',
            year: 2026,
            month: 8,
            week: 1,
            quarter: 3,
            semester: 2,
            start_year: 2022,
            end_year: 2026,
        });
    };

    // Copy Customer AI report formatted for WhatsApp / Sales briefing
    const handleCopyAiAnalysis = () => {
        if (!aiData) return;
        const periodLabel = data?.periodInfo?.currentLabel || 'Periode Berjalan';
        const lines = [
            `*BRIEFING INTELIJEN SALES & KPI AKUN CUSTOMER*`,
            `Customer: ${customerName} (${customerCode})`,
            `Periode: ${periodLabel}`,
            `AI Engine: ${aiEngine}`,
            `Skor Kesehatan Akun: ${aiData.account_health_score}/100 [${aiData.loyalty_status}]`,
            ``,
            `*1. RINGKASAN EKSEKUTIF:*`,
            aiData.executive_summary,
            ``,
            `*2. KEBIASAAN & POLA BELANJA (BUYING HABITS):*`,
            `• Pola Transaksi: ${aiData.buying_habits?.pattern}`,
            `• Kategori Favorit: ${aiData.buying_habits?.favorite_categories}`,
            `• Karakteristik Order: ${aiData.buying_habits?.order_characteristics}`,
            ``,
            `*3. PELUANG SALES & REKOMENDASI PENAWARAN (CROSS-SELLING):*`,
            ...(aiData.sales_growth_opportunities || []).map(
                (op, i) =>
                    `${i + 1}. [${op.category}] Rekomendasi: ${op.suggested_product}\n   - Alasan: ${op.rationale}\n   - Taktik Penawaran: ${op.pitching_strategy}`,
            ),
            ``,
            `*4. PERINGATAN RISIKO & ANOMALI PENURUNAN:*`,
            ...(aiData.risk_and_drop_alerts?.length > 0
                ? (aiData.risk_and_drop_alerts || []).map(
                      (al, i) =>
                          `${i + 1}. [${al.alert}] Dampak: ${al.impact}\n   - Solusi: ${al.mitigation}`,
                  )
                : ['- Tidak ada risiko penurunan kritis terdeteksi pada periode ini.']),
            ``,
            `*5. QUICK WINS (AKSI TIM SALES 7 HARI):*`,
            ...(aiData.quick_wins || []).map((q, i) => `[ ] ${q}`),
        ];

        navigator.clipboard.writeText(lines.join('\n'));
        setAiCopied(true);
        setTimeout(() => setAiCopied(false), 2500);
    };

    // Filter Invoices table
    const filteredInvoices = useMemo(() => {
        if (!data?.recentInvoices) return [];
        let list = [...data.recentInvoices];
        if (invoiceSearch.trim()) {
            const q = invoiceSearch.toLowerCase().trim();
            list = list.filter(
                (inv) =>
                    inv.no_fakturpenjualan?.toLowerCase().includes(q) ||
                    inv.no_fakturpajak?.toLowerCase().includes(q) ||
                    inv.ref_po?.toLowerCase().includes(q),
            );
        }
        return list;
    }, [data?.recentInvoices, invoiceSearch]);

    const paginatedInvoices = useMemo(() => {
        const start = (invoicePage - 1) * invoicesPerPage;
        return filteredInvoices.slice(start, start + invoicesPerPage);
    }, [filteredInvoices, invoicePage]);

    const totalInvoicePages = Math.ceil(filteredInvoices.length / invoicesPerPage) || 1;

    // Comprehensive Chart Stats for modern visualization
    const chartStats = useMemo(() => {
        const items = data?.chartData?.items || [];
        if (items.length === 0) {
            return { max: 1, avg: 0, total: 0, peakItem: null, activeItemsCount: 0 };
        }
        let total = 0;
        let max = 0;
        let peakItem = null;
        let activeCount = 0;

        items.forEach((it) => {
            const val = Number(it.sales || 0);
            total += val;
            if (val > max) {
                max = val;
                peakItem = it;
            }
            if (val > 0) activeCount++;
        });

        const avg = items.length > 0 ? total / items.length : 0;
        return {
            max: max > 0 ? max : 1,
            avg,
            total,
            peakItem,
            activeItemsCount: activeCount,
        };
    }, [data?.chartData?.items]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`KPI Customer - ${customerName}`} />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                {/* 1. Header & Breadcrumb Info */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => router.visit('/marketing/performance')}
                            className="h-10 w-10 shrink-0 border-sidebar-border/80 shadow-xs"
                            title="Kembali ke Performance Overview"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                    {customerName}
                                </h1>
                                <span className="rounded-md border border-sidebar-border/70 bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
                                    {customerCode}
                                </span>
                                {data?.kpi?.status && (
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                            data.kpi.status.includes('Sangat Baik')
                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                                : data.kpi.status === 'Baik'
                                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                : data.kpi.status === 'Stabil'
                                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                : data.kpi.status === 'Menurun'
                                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {data.kpi.status}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Laporan analitik KPI pelanggan, riwayat faktur, grafik tren, dan intelijen penjualan AI.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fetchCustomerData()}
                            disabled={loading}
                            className="h-9 w-9 border border-sidebar-border/70"
                            title="Segarkan Data"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                            />
                        </Button>
                    </div>
                </div>

                {/* 2. Filter Section */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                    <form onSubmit={handleApplyFilter} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            {/* Jenis Periode */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">
                                    Granularity Periode
                                </label>
                                <select
                                    value={periodType}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden font-medium"
                                >
                                    <option value="weekly">Mingguan (7 Hari)</option>
                                    <option value="monthly">Bulanan (4-5 Minggu)</option>
                                    <option value="quarterly">Triwulan (3 Bulan)</option>
                                    <option value="semester">Semester (6 Bulan)</option>
                                    <option value="yearly">Tahunan (12 Bulan)</option>
                                    <option value="year_range">Rentang Tahun (Multi-Tahun)</option>
                                </select>
                            </div>

                            {/* Tahun (untuk Weekly, Monthly, Quarterly, Semester, Yearly) */}
                            {periodType !== 'year_range' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Tahun
                                    </label>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {availableYears.map((y) => (
                                            <option key={y} value={y}>
                                                Tahun {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Bulan (untuk Weekly dan Monthly) */}
                            {(periodType === 'weekly' || periodType === 'monthly') && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Bulan
                                    </label>
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {monthOptions.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Minggu (Khusus Weekly) */}
                            {periodType === 'weekly' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Minggu (7 Hari)
                                    </label>
                                    <select
                                        value={week}
                                        onChange={(e) => setWeek(Number(e.target.value))}
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {weekOptions.map((w) => (
                                            <option key={w.value} value={w.value}>
                                                {w.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Triwulan (Khusus Quarterly) */}
                            {periodType === 'quarterly' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Triwulan (3 Bulan)
                                    </label>
                                    <select
                                        value={quarter}
                                        onChange={(e) => setQuarter(Number(e.target.value))}
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {quarterOptions.map((q) => (
                                            <option key={q.value} value={q.value}>
                                                {q.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Semester (Khusus Semester) */}
                            {periodType === 'semester' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Semester (6 Bulan)
                                    </label>
                                    <select
                                        value={semester}
                                        onChange={(e) => setSemester(Number(e.target.value))}
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {semesterOptions.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Tahun Mulai & Selesai (Khusus Year Range) */}
                            {periodType === 'year_range' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">
                                            Tahun Mulai
                                        </label>
                                        <select
                                            value={startYear}
                                            onChange={(e) => setStartYear(Number(e.target.value))}
                                            className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                        >
                                            {availableYears.map((y) => (
                                                <option key={y} value={y}>
                                                    Tahun {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">
                                            Tahun Selesai
                                        </label>
                                        <select
                                            value={endYear}
                                            onChange={(e) => setEndYear(Number(e.target.value))}
                                            className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                        >
                                            {availableYears.map((y) => (
                                                <option key={y} value={y}>
                                                    Tahun {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-end gap-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="h-9.5 flex-1 gap-1.5 rounded-lg text-xs font-medium sm:text-sm"
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>Terapkan</span>
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleResetFilter}
                                    disabled={loading}
                                    className="h-9.5 border-sidebar-border/70 px-3 text-xs sm:text-sm"
                                    title="Reset ke Default"
                                >
                                    Reset
                                </Button>
                            </div>
                        </div>

                        {/* Banner Periode Aktif */}
                        {data?.periodInfo && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border/50 pt-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <span>
                                        Periode Berjalan:{' '}
                                        <strong className="text-foreground">
                                            {data.periodInfo.currentLabel}
                                        </strong>
                                    </span>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span>
                                        Periode Pembanding:{' '}
                                        <strong className="text-foreground">
                                            {data.periodInfo.previousLabel}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Loading State */}
                {loading && !data && (
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-sidebar-border/70 bg-card">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium">
                                Memuat data detail KPI customer...
                            </p>
                        </div>
                    </div>
                )}

                {data && (
                    <>
                        {/* 3. Kartu KPI Customer (6 Kartu) */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {/* Card 1: Total Pembelian */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Total Pembelian
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Banknote className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatRupiah(data.kpi.total_sales)}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1 text-xs">
                                        {data.kpi.growth_percent > 0 ? (
                                            <span className="inline-flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                                                <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                                                {formatPercent(data.kpi.growth_percent)}
                                            </span>
                                        ) : data.kpi.growth_percent < 0 ? (
                                            <span className="inline-flex items-center font-semibold text-rose-600 dark:text-rose-400">
                                                <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                                                {formatPercent(data.kpi.growth_percent)}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-muted-foreground">
                                                <Minus className="mr-0.5 h-3.5 w-3.5" />
                                                0.00%
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">vs lalu</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Jumlah Faktur */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Jumlah Faktur
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatNumber(data.kpi.total_invoices)}{' '}
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Invoice
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {data.kpi.prev_total_invoices} invoice periode lalu
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Rata-rata Order (AOV) */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Rata-rata Order (AOV)
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Layers className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatRupiah(data.kpi.avg_order_value)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Rata-rata nilai per faktur
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Order Terbesar */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Faktur Terbesar
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        <Award className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatRupiah(data.kpi.max_order_value)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Faktur nilai maksimum
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Pangsa Omset Perusahaan */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Pangsa Omset
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                        <Target className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {data.kpi.company_share_percent.toFixed(2)}%
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        dari omset total perusahaan
                                    </div>
                                </div>
                            </div>

                            {/* Card 6: Pertumbuhan Nominal */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Selisih Nominal
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                        <ArrowUpDown className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div
                                        className={`text-lg font-bold tracking-tight sm:text-xl ${
                                            data.kpi.growth_nominal > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : data.kpi.growth_nominal < 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {formatCompactRupiah(data.kpi.growth_nominal)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {data.kpi.growth_nominal >= 0
                                            ? 'Peningkatan omset'
                                            : 'Penurunan omset'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. AI Strategic Customer Intelligence Widget */}
                        <div className="overflow-hidden rounded-2xl border border-sidebar-border/80 bg-card shadow-xs transition-all">
                            {/* Header Widget */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border/60 bg-gradient-to-r from-primary/5 via-background to-transparent px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20">
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-base font-bold text-foreground sm:text-lg">
                                                AI Customer Intelligence & Strategic Recommendations
                                            </h2>
                                            {aiEngine && (
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        aiIsFallback
                                                            ? 'border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                            : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                    }`}
                                                    title={
                                                        aiIsFallback
                                                            ? 'Di VPS production, otomatis menggunakan model qwen2.5:7b via Ollama'
                                                            : 'Didukung langsung oleh model Qwen 2.5 (7B) di Ollama VPS'
                                                    }
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            aiIsFallback
                                                                ? 'bg-amber-500'
                                                                : 'animate-ping bg-emerald-500'
                                                        }`}
                                                    />
                                                    {aiEngine}
                                                </span>
                                            )}
                                            {data?.period_info?.current_label && (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                                    <Calendar className="h-3 w-3" />
                                                    Periode: {data.period_info.current_label}
                                                </span>
                                            )}
                                            <span className="hidden rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-block">
                                                Otomatis Sesuai Filter
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Analisis profil akun, pola repeat order material dari DO, deteksi churn, dan arahan taktis penawaran tim sales.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {aiData && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCopyAiAnalysis}
                                            className="h-8.5 gap-1.5 border-sidebar-border/70 text-xs shadow-xs"
                                            title="Salin analisis lengkap akun ke clipboard untuk tim sales / WhatsApp"
                                        >
                                            {aiCopied ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span className="font-semibold text-emerald-600">
                                                        Tersalin!
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3.5 w-3.5" />
                                                    <span>Salin Laporan Akun</span>
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchCustomerAi(null, true)}
                                        disabled={aiLoading}
                                        className="h-8.5 gap-1.5 border-sidebar-border/70 text-xs shadow-xs"
                                        title="Jalankan ulang analisis AI dengan data terbaru (Bypass Cache)"
                                    >
                                        <RefreshCw
                                            className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`}
                                        />
                                        <span className="hidden sm:inline">
                                            Analisis Ulang
                                        </span>
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setAiCollapsed(!aiCollapsed)}
                                        className="h-8.5 w-8.5 border border-sidebar-border/50 text-muted-foreground hover:text-foreground"
                                        title={aiCollapsed ? 'Buka Panel AI' : 'Ciutkan Panel AI'}
                                    >
                                        {aiCollapsed ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronUp className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Body Widget */}
                            {!aiCollapsed && (
                                <div className="p-5">
                                    {/* Loading Skeleton */}
                                    {aiLoading && !aiData && (
                                        <div className="space-y-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    AI sedang meneliti riwayat pemesanan material di DO, mengevaluasi konsistensi faktur, dan menyusun taktik penawaran...
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                                <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
                                                <div className="h-32 animate-pulse rounded-xl bg-muted/60 lg:col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                                                <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Banner */}
                                    {aiError && !aiLoading && (
                                        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                                <span>{aiError}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => fetchCustomerAi(null, true)}
                                                className="h-7 border-rose-500/30 text-xs text-rose-700 dark:text-rose-300"
                                            >
                                                Coba Lagi
                                            </Button>
                                        </div>
                                    )}

                                    {/* Content Display */}
                                    {aiData && (
                                        <div className="space-y-5">
                                            {/* Notice if local fallback */}
                                            {aiIsFallback && (
                                                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300">
                                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                                    <span>
                                                        <strong>Catatan Lingkungan:</strong> Model Qwen 2.5 (7B) aktif di VPS Production. Di komputer lokal modul ini menggunakan Intelligent Account Engine. Saat dideploy ke VPS Production, analisis otomatis dijalankan langsung oleh Qwen 2.5 (7B) Ollama.
                                                    </span>
                                                </div>
                                            )}

                                            {/* Row 1: Account Health & Executive Summary */}
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                                {/* Account Health Box */}
                                                <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4.5 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Kesehatan Akun
                                                        </span>
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                                                aiData.account_health_score >= 80
                                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                                                    : aiData.account_health_score >= 65
                                                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                                    : aiData.account_health_score >= 50
                                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                            }`}
                                                        >
                                                            {aiData.loyalty_status || 'Evaluasi'}
                                                        </span>
                                                    </div>

                                                    <div className="my-3 flex items-baseline gap-2">
                                                        <span
                                                            className={`text-4xl font-extrabold tracking-tight ${
                                                                aiData.account_health_score >= 80
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : aiData.account_health_score >= 65
                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                    : aiData.account_health_score >= 50
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-rose-600 dark:text-rose-400'
                                                            }`}
                                                        >
                                                            {aiData.account_health_score}
                                                        </span>
                                                        <span className="text-sm font-semibold text-muted-foreground">
                                                            / 100
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 border-t border-sidebar-border/50 pt-2.5 text-xs text-muted-foreground">
                                                        <div className="flex items-center justify-between">
                                                            <span>Pola Transaksi:</span>
                                                            <strong className="text-foreground text-[11px]">
                                                                {aiData.buying_habits?.pattern || '-'}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Executive Summary Box */}
                                                <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-5 shadow-xs lg:col-span-3">
                                                    <div className="flex items-center justify-between border-b border-sidebar-border/50 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <BarChart3 className="h-4 w-4 text-primary" />
                                                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                                Ringkasan Strategis Akun Customer
                                                            </h3>
                                                        </div>
                                                        <span className="text-[11px] font-medium text-primary">
                                                            Evaluasi Periode: {data?.period_info?.current_label || 'Periode Berjalan'}
                                                        </span>
                                                    </div>
                                                    <div className="my-2.5 text-sm leading-relaxed text-foreground/90">
                                                        <p>{aiData.executive_summary}</p>
                                                    </div>
                                                    {aiData.buying_habits?.favorite_categories && (
                                                        <div className="rounded-lg border border-sidebar-border/50 bg-muted/50 p-2.5 text-xs text-muted-foreground">
                                                            <strong className="text-foreground">
                                                                Kategori Favorit:{' '}
                                                            </strong>
                                                            {aiData.buying_habits.favorite_categories}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Row 2: Peluang Sales & Rekomendasi Penawaran Produk */}
                                            {aiData.sales_growth_opportunities &&
                                                aiData.sales_growth_opportunities.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                                <Target className="h-3.5 w-3.5" />
                                                            </div>
                                                            <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                                Peluang Penawaran & Strategi Sales (Cross-Selling / Upselling)
                                                            </h3>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                            {aiData.sales_growth_opportunities.map((op, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs"
                                                                >
                                                                    <div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <h4 className="text-xs font-bold text-primary">
                                                                                {op.category}
                                                                            </h4>
                                                                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
                                                                                Target Penawaran
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-1.5 text-sm font-bold text-foreground">
                                                                            {op.suggested_product}
                                                                        </div>
                                                                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                                                            <strong className="text-foreground/80">
                                                                                Alasan Kebutuhan:{' '}
                                                                            </strong>
                                                                            {op.rationale}
                                                                        </p>
                                                                    </div>
                                                                    <div className="mt-3 rounded-lg border border-sidebar-border/60 bg-muted/30 p-2.5 text-xs text-foreground/90">
                                                                        <div className="mb-1 flex items-center gap-1 font-semibold text-primary">
                                                                            <Zap className="h-3 w-3" />
                                                                            <span>Taktik Penawaran (Pitching):</span>
                                                                        </div>
                                                                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                                            {op.pitching_strategy}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Row 3: Peringatan Risiko & Churn (Jika Ada) */}
                                            {aiData.risk_and_drop_alerts &&
                                                aiData.risk_and_drop_alerts.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                                                <ShieldAlert className="h-3.5 w-3.5" />
                                                            </div>
                                                            <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                                Peringatan Risiko & Hal yang Harus Dibenahi
                                                            </h3>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                            {aiData.risk_and_drop_alerts.map((al, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-4"
                                                                >
                                                                    <div>
                                                                        <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                                                                            {al.alert}
                                                                        </h4>
                                                                        <div className="mt-1 text-xs font-medium text-foreground">
                                                                            {al.impact}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-3 rounded-lg border border-sidebar-border/60 bg-card/80 p-2.5 text-xs text-foreground/90">
                                                                        <div className="mb-1 flex items-center gap-1 font-semibold text-primary">
                                                                            <Zap className="h-3 w-3" />
                                                                            <span>Langkah Mitigasi:</span>
                                                                        </div>
                                                                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                                            {al.mitigation}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Row 4: Quick Wins Checklist */}
                                            {aiData.quick_wins && aiData.quick_wins.length > 0 && (
                                                <div className="rounded-xl border border-sidebar-border/80 bg-muted/30 p-4">
                                                    <div className="mb-2.5 flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                            Aksi Prioritas Tim Sales untuk Akun Ini (Next 7 Days)
                                                        </h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                        {aiData.quick_wins.map((qw, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-start gap-2 rounded-lg border border-sidebar-border/60 bg-card p-2.5 text-xs text-foreground/90 shadow-2xs"
                                                            >
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="text-[11px] leading-relaxed text-muted-foreground">
                                                                    {qw}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 5. Grafik Penjualan Interaktif Sesuai Granularity (Modern SVG) */}
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 sm:p-6 shadow-xs">
                            {/* Chart Top Header & Stat Pills */}
                            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-sidebar-border/50 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-foreground sm:text-lg tracking-tight">
                                            {data.chartData?.title || 'Grafik Realisasi Penjualan Customer'}
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            {data.chartData?.subtitle || 'Visualisasi tren penjualan per interval waktu'}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Metric Pills */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {chartStats.peakItem && chartStats.peakItem.sales > 0 && (
                                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300 shadow-2xs">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-[11px] font-medium text-muted-foreground">Puncak:</span>
                                            <strong className="font-bold text-foreground">{chartStats.peakItem.label}</strong>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">({formatCompactRupiah(chartStats.peakItem.sales)})</span>
                                        </div>
                                    )}

                                    {chartStats.avg > 0 && (
                                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-800 dark:text-purple-300 shadow-2xs">
                                            <span className="text-[11px] font-medium text-muted-foreground">Rata-rata:</span>
                                            <strong className="font-bold text-foreground">{formatCompactRupiah(chartStats.avg)}</strong>
                                            <span className="text-[10px] text-muted-foreground">/ bar</span>
                                        </div>
                                    )}

                                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-sidebar-border/80 bg-muted/40 px-3 py-1.5 text-xs text-foreground shadow-2xs">
                                        <span className="text-[11px] text-muted-foreground">Total Periode:</span>
                                        <strong className="font-bold text-primary">{formatRupiah(data.kpi.total_sales)}</strong>
                                        <span className="text-[10px] text-muted-foreground">({data.kpi.total_invoices} faktur)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Active / Hovered Bar Details Live Banner */}
                            <div className="mb-4 rounded-xl border border-sidebar-border/70 bg-muted/25 px-4 py-2.5 text-xs transition-all duration-200">
                                {hoveredChartItem ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs shadow-2xs">
                                                <Calendar className="h-3.5 w-3.5" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-xs sm:text-sm text-foreground">
                                                    {hoveredChartItem.full_label || hoveredChartItem.label}
                                                </span>
                                                <span className="ml-2 text-[11px] text-muted-foreground">
                                                    {hoveredChartItem.invoices > 0 ? `${hoveredChartItem.invoices} faktur penjualan` : 'Tidak ada faktur'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Realisasi Penjualan</div>
                                                <div className="text-xs sm:text-sm font-bold text-primary">
                                                    {formatRupiah(hoveredChartItem.sales)}
                                                </div>
                                            </div>
                                            {data.kpi.total_sales > 0 && (
                                                <div className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-center font-bold text-primary text-[11px]">
                                                    {((hoveredChartItem.sales / data.kpi.total_sales) * 100).toFixed(1)}% porsi
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <Zap className="h-3.5 w-3.5 text-primary" />
                                            Arahkan kursor atau sentuh bar pada grafik untuk melihat rincian angka dan faktur per tanggal/periode.
                                        </span>
                                        <span className="text-[11px] font-medium text-foreground">
                                            {chartStats.activeItemsCount} dari {data.chartData?.items?.length || 0} interval bertransaksi
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* SVG Chart Canvas */}
                            {data.chartData?.items?.length > 0 ? (
                                <div className="overflow-x-auto pt-1 pb-2">
                                    <div className="min-w-[700px] relative">
                                        <svg
                                            viewBox="0 0 940 330"
                                            className="w-full h-auto select-none overflow-visible"
                                        >
                                            <defs>
                                                {/* Modern Primary Bar Gradient */}
                                                <linearGradient id="custBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                                                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.85" />
                                                </linearGradient>

                                                {/* Peak/Highest Bar Gradient */}
                                                <linearGradient id="custPeakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                                                    <stop offset="100%" stopColor="#047857" stopOpacity="0.9" />
                                                </linearGradient>

                                                {/* Hovered Bar Gradient */}
                                                <linearGradient id="custHoverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
                                                    <stop offset="100%" stopColor="#4338ca" stopOpacity="0.95" />
                                                </linearGradient>

                                                {/* Glow Filters */}
                                                <filter id="peakGlow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#10b981" floodOpacity="0.4" />
                                                </filter>
                                                <filter id="hoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#3b82f6" floodOpacity="0.35" />
                                                </filter>
                                            </defs>

                                            {(() => {
                                                const chartLeft = 85;
                                                const chartRight = 915;
                                                const chartTop = 45;
                                                const chartBottom = 245;
                                                const chartHeight = chartBottom - chartTop; // 200px
                                                const chartWidth = chartRight - chartLeft; // 830px

                                                const maxVal = chartStats.max;
                                                const gridLevels = [1.0, 0.75, 0.5, 0.25, 0.0];

                                                const n = data.chartData.items.length;
                                                const step = chartWidth / n;
                                                const barWidth = Math.min(52, Math.max(16, step * 0.58));

                                                return (
                                                    <g>
                                                        {/* Horizontal Gridlines & Y-Axis Labels */}
                                                        {gridLevels.map((pct, gIdx) => {
                                                            const lineY = chartBottom - chartHeight * pct;
                                                            const labelVal = maxVal * pct;
                                                            return (
                                                                <g key={gIdx}>
                                                                    <line
                                                                        x1={chartLeft}
                                                                        y1={lineY}
                                                                        x2={chartRight}
                                                                        y2={lineY}
                                                                        stroke="currentColor"
                                                                        strokeOpacity={pct === 0 ? "0.3" : "0.08"}
                                                                        strokeDasharray={pct === 0 ? undefined : "3 3"}
                                                                        strokeWidth={pct === 0 ? "1.5" : "1"}
                                                                    />
                                                                    <text
                                                                        x="75"
                                                                        y={lineY + 3.5}
                                                                        textAnchor="end"
                                                                        fontSize="10"
                                                                        fontFamily="monospace"
                                                                        fill="currentColor"
                                                                        opacity="0.6"
                                                                        className="select-none font-medium"
                                                                    >
                                                                        {pct === 0 ? 'Rp 0' : formatCompactRupiah(labelVal)}
                                                                    </text>
                                                                </g>
                                                            );
                                                        })}

                                                        {/* Average Benchmark Line (Jika ada sales) */}
                                                        {chartStats.avg > 0 && chartStats.avg < maxVal && (
                                                            <g>
                                                                {(() => {
                                                                    const avgY = chartBottom - (chartStats.avg / maxVal) * chartHeight;
                                                                    return (
                                                                        <g>
                                                                            <line
                                                                                x1={chartLeft}
                                                                                y1={avgY}
                                                                                x2={chartRight}
                                                                                y2={avgY}
                                                                                stroke="#a855f7"
                                                                                strokeDasharray="4 4"
                                                                                strokeWidth="1.2"
                                                                                opacity="0.7"
                                                                            />
                                                                            <rect
                                                                                x={chartRight - 122}
                                                                                y={avgY - 9}
                                                                                width="120"
                                                                                height="18"
                                                                                rx="4"
                                                                                fill="#9333ea"
                                                                                fillOpacity="0.12"
                                                                                stroke="#a855f7"
                                                                                strokeWidth="0.8"
                                                                            />
                                                                            <text
                                                                                x={chartRight - 62}
                                                                                y={avgY + 3.5}
                                                                                textAnchor="middle"
                                                                                fontSize="9.5"
                                                                                fontWeight="bold"
                                                                                fill="#9333ea"
                                                                                className="dark:fill-purple-300 select-none"
                                                                            >
                                                                                Avg: {formatCompactRupiah(chartStats.avg)}
                                                                            </text>
                                                                        </g>
                                                                    );
                                                                })()}
                                                            </g>
                                                        )}

                                                        {/* Bars, Value Pills & X-Axis Labels */}
                                                        {data.chartData.items.map((item, index) => {
                                                            const val = Number(item.sales || 0);
                                                            const barH = maxVal > 0 ? (val / maxVal) * chartHeight : 0;
                                                            const displayH = val > 0 ? Math.max(barH, 6) : 0;
                                                            const x = chartLeft + index * step + (step - barWidth) / 2;
                                                            const y = chartBottom - displayH;

                                                            const isPeak = chartStats.peakItem && chartStats.peakItem.sales > 0 && item.sales === chartStats.peakItem.sales;
                                                            const isHovered = hoveredChartItem?.key === item.key;

                                                            // Format Value Label on top of Bar
                                                            const labelText = formatBarLabel(val);
                                                            const pillW = Math.max(42, labelText.length * 7 + 14);
                                                            const pillH = 19;
                                                            const pillX = x + barWidth / 2 - pillW / 2;
                                                            const pillY = Math.max(y - 25, 18);

                                                            return (
                                                                <g
                                                                    key={item.key || index}
                                                                    className="cursor-pointer group"
                                                                    onMouseEnter={() => setHoveredChartItem(item)}
                                                                    onMouseLeave={() => setHoveredChartItem(null)}
                                                                    onClick={() => setHoveredChartItem(hoveredChartItem?.key === item.key ? null : item)}
                                                                >
                                                                    {/* Full Column Hit Target */}
                                                                    <rect
                                                                        x={chartLeft + index * step}
                                                                        y="15"
                                                                        width={step}
                                                                        height="295"
                                                                        fill="transparent"
                                                                    />

                                                                    {/* Column Hover Background Beam */}
                                                                    <rect
                                                                        x={chartLeft + index * step + 2}
                                                                        y={chartTop - 15}
                                                                        width={step - 4}
                                                                        height={chartHeight + 15}
                                                                        rx="6"
                                                                        fill="currentColor"
                                                                        opacity={isHovered ? "0.08" : "0"}
                                                                        className="transition-opacity duration-200"
                                                                    />

                                                                    {/* THE BAR ELEMENT */}
                                                                    {val > 0 ? (
                                                                        <rect
                                                                            x={x}
                                                                            y={y}
                                                                            width={barWidth}
                                                                            height={displayH}
                                                                            rx="6"
                                                                            ry="6"
                                                                            fill={
                                                                                isPeak
                                                                                    ? "url(#custPeakGrad)"
                                                                                    : (isHovered ? "url(#custHoverGrad)" : "url(#custBarGrad)")
                                                                            }
                                                                            filter={isPeak ? "url(#peakGlow)" : (isHovered ? "url(#hoverGlow)" : undefined)}
                                                                            stroke={isPeak ? "#34d399" : (isHovered ? "#93c5fd" : "#60a5fa")}
                                                                            strokeWidth={isPeak || isHovered ? "1.5" : "0.5"}
                                                                            className="transition-all duration-300 hover:brightness-110"
                                                                        />
                                                                    ) : (
                                                                        /* Zero Value Baseline Tick */
                                                                        <rect
                                                                            x={x}
                                                                            y={chartBottom - 2}
                                                                            width={barWidth}
                                                                            height="2"
                                                                            rx="1"
                                                                            fill="currentColor"
                                                                            opacity="0.2"
                                                                        />
                                                                    )}

                                                                    {/* PER-BAR VALUE LABEL (PERMANENTLY VISIBLE) */}
                                                                    {val > 0 ? (
                                                                        <g className="transition-transform duration-200">
                                                                            {/* Background Pill */}
                                                                            <rect
                                                                                x={pillX}
                                                                                y={pillY}
                                                                                width={pillW}
                                                                                height={pillH}
                                                                                rx="5"
                                                                                fill={
                                                                                    isPeak
                                                                                        ? "#059669"
                                                                                        : (isHovered ? "#2563eb" : "#0f172a")
                                                                                }
                                                                                stroke={
                                                                                    isPeak
                                                                                        ? "#34d399"
                                                                                        : (isHovered ? "#60a5fa" : "#334155")
                                                                                }
                                                                                strokeWidth={isPeak || isHovered ? "1.5" : "1"}
                                                                                className="dark:fill-slate-900 shadow-xs transition-colors"
                                                                            />

                                                                            {/* Peak Crown / Star indicator */}
                                                                            {isPeak && (
                                                                                <circle
                                                                                    cx={pillX + 5}
                                                                                    cy={pillY + 4}
                                                                                    r="2.5"
                                                                                    fill="#fbbf24"
                                                                                />
                                                                            )}

                                                                            {/* Pill Text Value */}
                                                                            <text
                                                                                x={x + barWidth / 2 + (isPeak ? 2 : 0)}
                                                                                y={pillY + 13}
                                                                                textAnchor="middle"
                                                                                fontSize="10"
                                                                                fontWeight="700"
                                                                                fill="#ffffff"
                                                                                className="tabular-nums font-mono select-none"
                                                                            >
                                                                                {labelText}
                                                                            </text>
                                                                        </g>
                                                                    ) : (
                                                                        /* Zero Value Label */
                                                                        <text
                                                                            x={x + barWidth / 2}
                                                                            y={chartBottom - 7}
                                                                            textAnchor="middle"
                                                                            fontSize="9.5"
                                                                            fontWeight="500"
                                                                            fill="currentColor"
                                                                            opacity="0.35"
                                                                            className="select-none"
                                                                        >
                                                                            0
                                                                        </text>
                                                                    )}

                                                                    {/* X-AXIS LABELS (BAWAH BAR) */}
                                                                    {/* 1. Main Period Label */}
                                                                    <text
                                                                        x={x + barWidth / 2}
                                                                        y={chartBottom + 18}
                                                                        textAnchor="middle"
                                                                        fontSize="10.5"
                                                                        fontWeight={isHovered || isPeak ? "700" : "500"}
                                                                        fill={isHovered ? "#2563eb" : (isPeak ? "#059669" : "currentColor")}
                                                                        opacity={isHovered || isPeak ? 1 : 0.75}
                                                                        className="select-none transition-colors"
                                                                    >
                                                                        {item.label}
                                                                    </text>

                                                                    {/* 2. Invoices Count Pill Underneath */}
                                                                    {item.invoices > 0 ? (
                                                                        <g>
                                                                            <rect
                                                                                x={x + barWidth / 2 - 18}
                                                                                y={chartBottom + 26}
                                                                                width="36"
                                                                                height="15"
                                                                                rx="4"
                                                                                fill="currentColor"
                                                                                opacity={isHovered ? "0.15" : "0.07"}
                                                                            />
                                                                            <text
                                                                                x={x + barWidth / 2}
                                                                                y={chartBottom + 37.5}
                                                                                textAnchor="middle"
                                                                                fontSize="9"
                                                                                fontWeight="600"
                                                                                fill="currentColor"
                                                                                opacity={isHovered ? "0.9" : "0.65"}
                                                                                className="select-none"
                                                                            >
                                                                                {item.invoices} inv
                                                                            </text>
                                                                        </g>
                                                                    ) : (
                                                                        <text
                                                                            x={x + barWidth / 2}
                                                                            y={chartBottom + 37.5}
                                                                            textAnchor="middle"
                                                                            fontSize="8.5"
                                                                            fill="currentColor"
                                                                            opacity="0.25"
                                                                            className="select-none"
                                                                        >
                                                                            -
                                                                        </text>
                                                                    )}
                                                                </g>
                                                            );
                                                        })}
                                                    </g>
                                                );
                                            })()}
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-44 flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <BarChart3 className="h-8 w-8 opacity-40" />
                                    <span className="text-xs">Tidak ada data transaksi pada rentang periode ini.</span>
                                </div>
                            )}

                            {/* Chart Footer Legend */}
                            <div className="mt-3 pt-3 border-t border-sidebar-border/50 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
                                        <span>Realisasi Penjualan</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                                        <span>Puncak Periode Terbesar</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-0.5 w-3.5 border-t-2 border-dashed border-purple-500" />
                                        <span>Garis Rata-rata</span>
                                    </div>
                                </div>
                                <div className="text-muted-foreground">
                                    *Angka di atas bar merupakan nominal penjualan per interval waktu.
                                </div>
                            </div>
                        </div>

                        {/* 6. Top Purchased Products / Materials from tb_do */}
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-primary" />
                                    <div>
                                        <h2 className="text-base font-bold text-foreground sm:text-lg">
                                            Top Material & Barang Dipesan (Delivery Order)
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Data material diambil langsung dari Surat Jalan (DO) yang dicocokkan dengan faktur penjualan.
                                        </p>
                                    </div>
                                </div>
                                {data.isAllTimeMaterials && (
                                    <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                        Menampilkan riwayat produk sepanjang waktu (karena periode ini belum ada pembelian)
                                    </span>
                                )}
                            </div>

                            {data.topMaterials?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-sidebar-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-3">#</th>
                                                <th className="px-3 py-3">Kode Material</th>
                                                <th className="px-3 py-3">Nama Material / Barang</th>
                                                <th className="px-3 py-3 text-right">Total Kuantiti</th>
                                                <th className="px-3 py-3 text-right">Rata-rata Harga</th>
                                                <th className="px-3 py-3 text-right">Total Nilai Pembelian</th>
                                                <th className="px-3 py-3 text-center">Frekuensi DO</th>
                                                <th className="px-3 py-3 text-center">Terakhir Order</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sidebar-border/40">
                                            {data.topMaterials.map((mat, idx) => (
                                                <tr
                                                    key={idx}
                                                    className="transition-colors hover:bg-muted/30"
                                                >
                                                    <td className="px-3 py-3 font-semibold text-muted-foreground">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-3 py-3 font-mono font-medium text-foreground">
                                                        {mat.kd_mat || '-'}
                                                    </td>
                                                    <td className="px-3 py-3 font-semibold text-foreground">
                                                        {mat.material}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-medium text-foreground">
                                                        {formatNumber(mat.total_qty)}{' '}
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {mat.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-muted-foreground">
                                                        {formatRupiah(mat.avg_price)}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-bold text-primary">
                                                        {formatRupiah(mat.total_val)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center font-semibold text-foreground">
                                                        <span className="rounded-md bg-muted px-2 py-0.5">
                                                            {mat.freq}x
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-muted-foreground text-[11px]">
                                                        {mat.last_date || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                                    Belum ada catatan material DO untuk customer ini.
                                </div>
                            )}
                        </div>

                        {/* 7. Riwayat Faktur Penjualan (Invoices History) */}
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-foreground sm:text-lg">
                                        Riwayat Faktur Penjualan
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Daftar invoice terbit customer pada rentang waktu terpilih ({filteredInvoices.length} faktur).
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Cari no invoice / PO..."
                                            value={invoiceSearch}
                                            onChange={(e) => {
                                                setInvoiceSearch(e.target.value);
                                                setInvoicePage(1);
                                            }}
                                            className="h-9 pl-8 text-xs border-sidebar-border/70"
                                        />
                                    </div>
                                </div>
                            </div>

                            {paginatedInvoices.length > 0 ? (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="border-b border-sidebar-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <tr>
                                                    <th className="px-3 py-3">No Faktur</th>
                                                    <th className="px-3 py-3">Faktur Pajak</th>
                                                    <th className="px-3 py-3">Referensi PO</th>
                                                    <th className="px-3 py-3">Tanggal Dokumen</th>
                                                    <th className="px-3 py-3 text-center">Jml Item</th>
                                                    <th className="px-3 py-3 text-right">Nilai Total (Rp)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/40">
                                                {paginatedInvoices.map((inv, idx) => (
                                                    <tr
                                                        key={idx}
                                                        className="transition-colors hover:bg-muted/30"
                                                    >
                                                        <td className="px-3 py-3 font-mono font-bold text-foreground">
                                                            {inv.no_fakturpenjualan}
                                                        </td>
                                                        <td className="px-3 py-3 font-mono text-muted-foreground text-[11px]">
                                                            {inv.no_fakturpajak || '-'}
                                                        </td>
                                                        <td className="px-3 py-3 font-medium text-foreground">
                                                            {inv.ref_po || '-'}
                                                        </td>
                                                        <td className="px-3 py-3 text-muted-foreground">
                                                            {inv.tgl_doc}
                                                        </td>
                                                        <td className="px-3 py-3 text-center font-medium text-foreground">
                                                            {inv.item_count}
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-bold text-primary">
                                                            {formatRupiah(inv.total_amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {totalInvoicePages > 1 && (
                                        <div className="mt-4 flex items-center justify-between border-t border-sidebar-border/50 pt-3 text-xs text-muted-foreground">
                                            <span>
                                                Halaman {invoicePage} dari {totalInvoicePages}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={invoicePage <= 1}
                                                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                                                    className="h-8 px-2 border-sidebar-border/70 text-xs"
                                                >
                                                    <ChevronLeft className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={invoicePage >= totalInvoicePages}
                                                    onClick={() =>
                                                        setInvoicePage((p) =>
                                                            Math.min(totalInvoicePages, p + 1),
                                                        )
                                                    }
                                                    className="h-8 px-2 border-sidebar-border/70 text-xs"
                                                >
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                                    Tidak ada faktur yang cocok dengan pencarian.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
