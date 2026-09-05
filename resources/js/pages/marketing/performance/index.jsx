import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpDown,
    ArrowUpRight,
    Award,
    Banknote,
    BarChart3,
    Bot,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    Crown,
    ExternalLink,
    FileText,
    Filter,
    HelpCircle,
    Loader2,
    Minus,
    RefreshCw,
    Rocket,
    Search,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/performance' },
    { title: 'Performance', href: '/marketing/performance' },
];

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
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' M';
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' jt';
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(0) + ' rb';
    }
    if (num === 0) return 'Rp 0';
    return String(num);
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

export default function PerformanceIndex({
    initialFilters = {},
    availableYears = [2026, 2025, 2024],
    customersList = [],
}) {
    // Filter states
    const [year, setYear] = useState(initialFilters.year || 2026);
    const [periodType, setPeriodType] = useState(
        initialFilters.period_type || 'monthly',
    );
    const [month, setMonth] = useState(initialFilters.month || 8);
    const [quarter, setQuarter] = useState(initialFilters.quarter || 3);
    const [semester, setSemester] = useState(initialFilters.semester || 2);
    const [customer, setCustomer] = useState(initialFilters.customer || 'all');

    // Data states
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    // Table states
    const [searchCustomer, setSearchCustomer] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortField, setSortField] = useState('rank');
    const [sortDirection, setSortDirection] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(5);

    // Hovered chart item for interactive tooltip
    const [hoveredChartItem, setHoveredChartItem] = useState(null);

    // Top 5 lowest mode: 'nominal' (volume terkecil) | 'drop' (penurunan terbesar)
    const [lowestMode, setLowestMode] = useState('nominal');

    // AI Analysis states
    const [aiLoading, setAiLoading] = useState(false);
    const [aiData, setAiData] = useState(null);
    const [aiEngine, setAiEngine] = useState('');
    const [aiIsFallback, setAiIsFallback] = useState(false);
    const [aiNotice, setAiNotice] = useState('');
    const [aiError, setAiError] = useState(null);
    const [aiCopied, setAiCopied] = useState(false);
    const [aiCollapsed, setAiCollapsed] = useState(false);

    // Fetch AI Analysis automatically
    const fetchAiAnalysis = async (overrideFilters = null, force = false) => {
        setAiLoading(true);
        setAiData(null);
        setAiError(null);
        try {
            const currentYear = overrideFilters?.year ?? year;
            const currentPeriodType = overrideFilters?.period_type ?? periodType;
            const currentMonth = overrideFilters?.month ?? month;
            const currentQuarter = overrideFilters?.quarter ?? quarter;
            const currentSemester = overrideFilters?.semester ?? semester;
            const currentCustomer = overrideFilters?.customer ?? customer;

            // Safely read CSRF token
            let csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') || '';
            if (!csrfToken) {
                const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
                if (match) csrfToken = decodeURIComponent(match[1]);
            }

            const res = await fetch('/marketing/performance/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    year: currentYear,
                    period_type: currentPeriodType,
                    month: currentMonth,
                    quarter: currentQuarter,
                    semester: currentSemester,
                    customer: currentCustomer,
                    force,
                }),
            });

            if (!res.ok) {
                if (res.status === 504) {
                    throw new Error('Server VPS Gateway Time-out (504). AI di VPS sedang proses awal / antre di memori. Silakan klik Analisis Ulang.');
                }
                throw new Error(`Gagal memuat analisis AI (Kode: ${res.status}).`);
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
            console.error('AI Analysis Error:', err);
            setAiError(err.message || 'Gagal memuat analisis AI.');
        } finally {
            setAiLoading(false);
        }
    };

    // Handle copy AI Report to Clipboard formatted for WhatsApp / Email
    const handleCopyAiAnalysis = () => {
        if (!aiData) return;
        const periodLabel = data?.periodInfo?.currentLabel || 'Periode Berjalan';
        const lines = [
            `*LAPORAN ANALISIS STRATEGIS KPI PENJUALAN*`,
            `Periode: ${periodLabel}`,
            `AI Engine: ${aiEngine}`,
            `Skor Kesehatan KPI: ${aiData.health_score}/100 [${aiData.status_label}]`,
            ``,
            `*1. RINGKASAN EKSEKUTIF:*`,
            aiData.executive_summary,
            ``,
            `*2. ANALISIS KONSENTRASI RISIKO (PARETO):*`,
            `• Kontribusi Top 5: ${aiData.pareto_risk_analysis?.top5_share_percent}% (Tingkat Risiko: ${aiData.pareto_risk_analysis?.risk_level})`,
            `• Evaluasi: ${aiData.pareto_risk_analysis?.evaluation}`,
            ``,
            `*3. SOROTAN KRITIS & HAL YANG WAJIB DIPERBAIKI:*`,
            ...(aiData.critical_areas_to_fix || []).map(
                (c, i) =>
                    `${i + 1}. [${c.issue}] Akun: ${c.customer_affected} (${c.nominal_impact})\n   - Akar Masalah: ${c.root_cause}\n   - Tindakan Perbaikan: ${c.action_to_fix}`,
            ),
            ``,
            `*4. REKOMENDASI TAKTIS TIM SALES & MARKETING:*`,
            ...(aiData.tactical_recommendations || []).map(
                (r, i) =>
                    `${i + 1}. ${r.category} [${r.focus}]:\n   ${r.action}`,
            ),
            ``,
            `*5. QUICK WINS (AKSI PRIORITAS 7 HARI):*`,
            ...(aiData.quick_wins || []).map((q, i) => `[ ] ${q}`),
        ];

        navigator.clipboard.writeText(lines.join('\n'));
        setAiCopied(true);
        setTimeout(() => setAiCopied(false), 2500);
    };

    // Fetch Performance Data
    const fetchData = async (overrideFilters = null) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                year: String(overrideFilters?.year ?? year),
                period_type: overrideFilters?.period_type ?? periodType,
                month: String(overrideFilters?.month ?? month),
                quarter: String(overrideFilters?.quarter ?? quarter),
                semester: String(overrideFilters?.semester ?? semester),
                customer: overrideFilters?.customer ?? customer,
            });

            const res = await fetch(
                `/marketing/performance/data?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );

            if (!res.ok) {
                throw new Error('Gagal memuat data performa.');
            }

            const json = await res.json();
            setData(json);
            setCurrentPage(1);

            // Trigger AI analysis automatically in parallel
            fetchAiAnalysis(overrideFilters);
        } catch (error) {
            console.error('Error loading performance data:', error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat Data',
                text:
                    error.message ||
                    'Terjadi kesalahan saat memuat data KPI Marketing.',
            });
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchData();
    }, []);

    // Handle click on chart bar to quickly switch active period
    const handleBarClick = (item) => {
        if (!item?.key) return;
        if (periodType === 'monthly') {
            setMonth(Number(item.key));
            fetchData({ month: Number(item.key) });
        } else if (periodType === 'quarterly') {
            setQuarter(Number(item.key));
            fetchData({ quarter: Number(item.key) });
        } else if (periodType === 'semester') {
            setSemester(Number(item.key));
            fetchData({ semester: Number(item.key) });
        } else if (periodType === 'yearly') {
            setYear(Number(item.key));
            fetchData({ year: Number(item.key) });
        }
    };

    // Handle filter submit
    const handleApplyFilter = (e) => {
        if (e) e.preventDefault();
        fetchData();
    };

    // Handle filter reset
    const handleResetFilter = () => {
        setYear(2026);
        setPeriodType('monthly');
        setMonth(8);
        setQuarter(3);
        setSemester(2);
        setCustomer('all');
        fetchData({
            year: 2026,
            period_type: 'monthly',
            month: 8,
            quarter: 3,
            semester: 2,
            customer: 'all',
        });
    };

    // Handle export PDF
    const handleExportPdf = () => {
        const params = new URLSearchParams({
            year: String(year),
            period_type: periodType,
            month: String(month),
            quarter: String(quarter),
            semester: String(semester),
            customer,
            format: 'pdf',
        });
        window.open(
            `/marketing/performance/export?${params.toString()}`,
            '_blank',
        );
    };

    // Filter & Sort Customer Table Data
    const filteredCustomers = useMemo(() => {
        if (!data?.allCustomers) return [];

        let list = [...data.allCustomers];

        // Search
        if (searchCustomer.trim()) {
            const q = searchCustomer.toLowerCase().trim();
            list = list.filter(
                (c) =>
                    c.nm_cs.toLowerCase().includes(q) ||
                    c.kd_cs.toLowerCase().includes(q),
            );
        }

        // Status Filter (Support AI Status categories and legacy labels)
        if (statusFilter !== 'all') {
            list = list.filter((c) => {
                const s = c.ai_status || c.status || '';
                if (statusFilter === 'VIP') {
                    return s.includes('VIP');
                }
                if (statusFilter === 'Akselerasi') {
                    return s === 'Akselerasi Tinggi' || s === 'Sangat Baik';
                }
                if (statusFilter === 'Stabil') {
                    return s === 'Konsisten & Stabil' || s === 'Baik' || s === 'Stabil';
                }
                if (statusFilter === 'Potensial') {
                    return s.includes('Potensial');
                }
                if (statusFilter === 'Menurun') {
                    return s.includes('Menurun') || s.includes('Kritis') || s.includes('Drop') || s === 'Penurunan Ringan';
                }
                if (statusFilter === 'Dormant') {
                    return s.includes('Dormant') || s.includes('Macet');
                }
                if (statusFilter === 'Non-Aktif') {
                    return s.includes('Non-Aktif') || s.includes('Tidak Ada Transaksi');
                }
                return s === statusFilter;
            });
        }

        // Sort
        list.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [data, searchCustomer, statusFilter, sortField, sortDirection]);

    // Paginated Customer Data
    const paginatedCustomers = useMemo(() => {
        if (perPage === 'all') return filteredCustomers;
        const start = (currentPage - 1) * perPage;
        return filteredCustomers.slice(start, start + perPage);
    }, [filteredCustomers, currentPage, perPage]);

    const totalPages =
        perPage === 'all'
            ? 1
            : Math.max(1, Math.ceil(filteredCustomers.length / perPage));

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Map AI Critical Fixes from Ollama to Customers
    const aiCriticalMap = useMemo(() => {
        if (!aiData?.critical_areas_to_fix || !Array.isArray(aiData.critical_areas_to_fix)) return {};
        const map = {};
        aiData.critical_areas_to_fix.forEach((item) => {
            const affected = (item.customer_affected || '').toLowerCase().trim();
            if (affected && affected !== 'umum' && affected !== 'semua') {
                map[affected] = item;
            }
        });
        return map;
    }, [aiData]);

    // Extract real-time AI status, action, and reasoning for a customer
    const getCustomerAiMeta = (c) => {
        if (!c) {
            return {
                status: 'Non-Aktif',
                action: '📋 Kirimkan Brosur & Katalog Baru',
                teamAction: 'Pantau',
                reason: '',
                isAiCritical: false,
                aiIssue: null,
            };
        }
        const nm = (c.nm_cs || '').toLowerCase().trim();
        const kd = (c.kd_cs || '').toLowerCase().trim();

        // Check if explicitly cited in Ollama AI critical areas
        let criticalItem = null;
        for (const [key, item] of Object.entries(aiCriticalMap)) {
            if (key && (nm.includes(key) || key.includes(nm) || kd === key)) {
                criticalItem = item;
                break;
            }
        }

        const baseStatus = c.ai_status || c.status || 'Konsisten & Stabil';
        const baseAction = c.ai_action || '📈 Jadwalkan Repeat Order Rutin & Lock Volume';
        const baseTeamAction = c.ai_team_action || c.marketing_action || 'Pertahankan';
        const baseReason = c.ai_reason || '';

        if (criticalItem) {
            return {
                status: baseStatus,
                action: criticalItem.action_to_fix ? `🤖 ${criticalItem.action_to_fix}` : baseAction,
                teamAction: criticalItem.action_to_fix ? `🤖 ${criticalItem.action_to_fix}` : baseTeamAction,
                reason: `Disorot AI: ${criticalItem.issue || ''}. Akar masalah: ${criticalItem.root_cause || '-'}. Rekomendasi: ${criticalItem.action_to_fix || '-'}`,
                isAiCritical: true,
                aiIssue: criticalItem.issue,
            };
        }

        return {
            status: baseStatus,
            action: baseAction,
            teamAction: baseTeamAction,
            reason: baseReason,
            isAiCritical: false,
            aiIssue: null,
        };
    };

    // Enhanced AI Performance Status Badge Helper
    const renderAiStatusBadge = (c) => {
        const meta = getCustomerAiMeta(c);
        const status = meta.status;

        if (status === 'VIP Growth Leader') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs cursor-help"
                >
                    <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>VIP Growth Leader</span>
                </span>
            );
        }
        if (status === 'VIP At-Risk') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 animate-pulse shadow-2xs cursor-help"
                >
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    <span>VIP At-Risk</span>
                </span>
            );
        }
        if (status === 'Akselerasi Tinggi' || status === 'Sangat Baik') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-help"
                >
                    <Rocket className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Akselerasi Tinggi</span>
                </span>
            );
        }
        if (status === 'Konsisten & Stabil' || status === 'Baik' || status === 'Stabil') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-help"
                >
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span>Konsisten &amp; Stabil</span>
                </span>
            );
        }
        if (status === 'Potensial Penetrasi') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 cursor-help"
                >
                    <Target className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                    <span>Potensial Penetrasi</span>
                </span>
            );
        }
        if (status === 'Penurunan Ringan') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-help"
                >
                    <Minus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Penurunan Ringan</span>
                </span>
            );
        }
        if (status === 'Menurun Signifikan' || status === 'Menurun') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 cursor-help"
                >
                    <ArrowDownRight className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                    <span>Menurun Signifikan</span>
                </span>
            );
        }
        if (status === 'Kritis / Drop Drastis') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-help"
                >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    <span>Kritis / Drop Drastis</span>
                </span>
            );
        }
        if (status === 'Dormant (Macet)') {
            return (
                <span
                    title={meta.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-help"
                >
                    <RefreshCw className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>Dormant (Macet)</span>
                </span>
            );
        }
        return (
            <span
                title={meta.reason}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground cursor-help"
            >
                <span>Non-Aktif</span>
            </span>
        );
    };

    // Enhanced AI Action Recommendation Badge Helper (for Seluruh Customer Table)
    const renderAiActionBadge = (c) => {
        const meta = getCustomerAiMeta(c);

        return (
            <div className="flex flex-col items-center justify-center gap-1" title={meta.reason}>
                {meta.isAiCritical && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
                        <Bot className="h-2.5 w-2.5 text-rose-600" />
                        Prioritas Khusus AI
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-sidebar-border/80 bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors cursor-help text-left max-w-xs leading-snug">
                    <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{meta.action}</span>
                </span>
            </div>
        );
    };

    // Enhanced AI Team Action Badge Helper (for Top 5 Tables)
    const renderAiTeamActionBadge = (c, defaultType = 'top') => {
        const meta = getCustomerAiMeta(c);
        const isTop = defaultType === 'top';

        return (
            <div className="flex flex-col items-center justify-center gap-1" title={meta.reason}>
                {meta.isAiCritical && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        <Bot className="h-2.5 w-2.5 text-rose-600" />
                        Disorot AI
                    </span>
                )}
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-all cursor-help text-center max-w-xs ${
                        isTop
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                    }`}
                >
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>{meta.teamAction}</span>
                </span>
            </div>
        );
    };

    // Status Badge Helper (Legacy fallback)
    const renderStatusBadge = (status) => {
        return renderAiStatusBadge({ status, ai_status: status });
    };

    // Max chart value for relative bar heights
    const maxChartValue = useMemo(() => {
        if (!data?.chartData?.items?.length) return 1;
        const max = Math.max(
            ...data.chartData.items.map((i) => Number(i.sales || 0)),
        );
        return max > 0 ? max : 1;
    }, [data]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Marketing Performance - KPI Penjualan" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                {/* Header & Action Buttons */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            Marketing Performance
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Key Performance Indicator (KPI) penjualan seluruh
                            customer berdasarkan faktur penjualan valid.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportPdf}
                            disabled={loading}
                            className="h-9 gap-1.5 border-sidebar-border/70 text-xs shadow-xs sm:text-sm"
                        >
                            <FileText className="h-4 w-4 text-rose-600" />
                            <span>Export PDF</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="h-9 w-9 border border-sidebar-border/70"
                            title="Refresh Data"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                            />
                        </Button>
                    </div>
                </div>

                {/* 1. Filter Section */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                    <form onSubmit={handleApplyFilter} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            {/* Tahun */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">
                                    Tahun
                                </label>
                                <select
                                    value={year}
                                    onChange={(e) =>
                                        setYear(Number(e.target.value))
                                    }
                                    className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                >
                                    {availableYears.map((y) => (
                                        <option key={y} value={y}>
                                            Tahun {y}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Jenis Periode */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">
                                    Jenis Periode
                                </label>
                                <select
                                    value={periodType}
                                    onChange={(e) =>
                                        setPeriodType(e.target.value)
                                    }
                                    className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                >
                                    <option value="monthly">Bulanan</option>
                                    <option value="quarterly">Triwulan</option>
                                    <option value="semester">Semester</option>
                                    <option value="yearly">Tahunan</option>
                                </select>
                            </div>

                            {/* Sub-filter dinamis */}
                            {periodType === 'monthly' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Bulan
                                    </label>
                                    <select
                                        value={month}
                                        onChange={(e) =>
                                            setMonth(Number(e.target.value))
                                        }
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {monthOptions.map((m) => (
                                            <option
                                                key={m.value}
                                                value={m.value}
                                            >
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {periodType === 'quarterly' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Triwulan
                                    </label>
                                    <select
                                        value={quarter}
                                        onChange={(e) =>
                                            setQuarter(Number(e.target.value))
                                        }
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {quarterOptions.map((q) => (
                                            <option
                                                key={q.value}
                                                value={q.value}
                                            >
                                                {q.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {periodType === 'semester' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Pilih Semester
                                    </label>
                                    <select
                                        value={semester}
                                        onChange={(e) =>
                                            setSemester(Number(e.target.value))
                                        }
                                        className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                    >
                                        {semesterOptions.map((s) => (
                                            <option
                                                key={s.value}
                                                value={s.value}
                                            >
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {periodType === 'yearly' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">
                                        Periode
                                    </label>
                                    <div className="flex h-9.5 items-center rounded-lg border border-sidebar-border/70 bg-muted/40 px-3 text-sm text-muted-foreground">
                                        Sepanjang Tahun {year}
                                    </div>
                                </div>
                            )}

                            {/* Customer Filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">
                                    Customer
                                </label>
                                <select
                                    value={customer}
                                    onChange={(e) =>
                                        setCustomer(e.target.value)
                                    }
                                    className="h-9.5 w-full rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden"
                                >
                                    <option value="all">
                                        Semua Customer (Semua Transaksi)
                                    </option>
                                    {customersList.map((c) => (
                                        <option key={c.kd_cs} value={c.kd_cs}>
                                            {c.nm_cs}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tombol Action */}
                            <div className="flex items-end gap-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="h-9.5 flex-1 gap-1.5 rounded-lg text-xs font-medium sm:text-sm"
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>Terapkan Filter</span>
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
                                    <span className="text-muted-foreground/50">
                                        •
                                    </span>
                                    <span>
                                        Periode Pembanding:{' '}
                                        <strong className="text-foreground">
                                            {data.periodInfo.previousLabel}
                                        </strong>
                                    </span>
                                </div>
                                {customer !== 'all' && (
                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                                        Filter Customer Aktif
                                    </span>
                                )}
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
                                Memuat data KPI penjualan...
                            </p>
                        </div>
                    </div>
                )}

                {data && (
                    <>
                        {/* 2. KPI Cards (6 Kartu) */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {/* Card 1: Total Penjualan */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Total Penjualan
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Banknote className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatRupiah(data.kpi.total_sales)}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-xs">
                                        <span
                                            className={`inline-flex items-center font-semibold ${
                                                data.kpi.growth_percent >= 0
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-rose-600 dark:text-rose-400'
                                            }`}
                                        >
                                            {data.kpi.growth_percent >= 0 ? (
                                                <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                                            ) : (
                                                <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                                            )}
                                            {formatPercent(
                                                data.kpi.growth_percent,
                                            )}
                                        </span>
                                        <span className="truncate text-muted-foreground">
                                            vs periode lalu
                                        </span>
                                    </div>
                                    <div className="mt-2.5 border-t border-sidebar-border/50 pt-2 text-xs">
                                        <span className="text-muted-foreground">Periode lalu: </span>
                                        <strong className="font-semibold text-foreground">
                                            {formatRupiah(data.kpi.prev_total_sales)}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Customer Transaksi */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Customer Transaksi
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        <Users className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatNumber(data.kpi.total_customers)}{' '}
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Customer
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {data.kpi.prev_total_customers} customer
                                        periode lalu
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Rata-rata / Customer */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Rata-rata / Customer
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatRupiah(
                                            data.kpi.avg_sales_per_customer,
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Per customer aktif
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Pertumbuhan Penjualan */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Pertumbuhan
                                    </span>
                                    <div
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                            data.kpi.growth_percent >= 0
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                        }`}
                                    >
                                        {data.kpi.growth_percent >= 0 ? (
                                            <TrendingUp className="h-5 w-5" />
                                        ) : (
                                            <TrendingDown className="h-5 w-5" />
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div
                                        className={`text-lg font-bold tracking-tight sm:text-xl ${
                                            data.kpi.growth_percent >= 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                        }`}
                                    >
                                        {formatPercent(data.kpi.growth_percent)}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-muted-foreground">
                                        {data.kpi.growth_nominal >= 0
                                            ? '+'
                                            : ''}
                                        {formatRupiah(data.kpi.growth_nominal)}
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Total Invoice */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Total Invoice
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                        {formatNumber(data.kpi.total_invoices)}{' '}
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Faktur
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {data.kpi.prev_total_invoices} invoice
                                        periode lalu
                                    </div>
                                </div>
                            </div>

                            {/* Card 6: Customer Tertinggi */}
                            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Customer Tertinggi
                                    </span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        <Award className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div
                                        className="truncate text-sm font-bold tracking-tight text-foreground"
                                        title={
                                            data.kpi.top_customer?.name || '-'
                                        }
                                    >
                                        {data.kpi.top_customer?.name || '-'}
                                    </div>
                                    <div className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                        {data.kpi.top_customer
                                            ? formatRupiah(
                                                  data.kpi.top_customer.sales,
                                              )
                                            : 'Rp 0'}
                                        {data.kpi.top_customer && (
                                            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                                (
                                                {data.kpi.top_customer.contribution.toFixed(
                                                    1,
                                                )}
                                                %)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2.5 AI Strategic Insights & Recommendations Widget */}
                        <div className="overflow-hidden rounded-2xl border border-sidebar-border/80 bg-card shadow-xs transition-all">
                            {/* Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border/60 bg-gradient-to-r from-primary/5 via-background to-transparent px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20">
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-base font-bold text-foreground sm:text-lg">
                                                AI Strategic Insights & Recommendations
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
                                                            ? 'Di VPS production, engine ini otomatis beralih ke model qwen2.5:7b via Ollama'
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
                                            {data?.periodInfo?.currentLabel && (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                                    <Calendar className="h-3 w-3" />
                                                    Periode: {data.periodInfo.currentLabel}
                                                </span>
                                            )}
                                            <span className="hidden rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-block">
                                                Otomatis Sesuai Filter
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Analisis komprehensif otomatis untuk KPI penjualan, deteksi risiko customer drop, dan arahan aksi taktis tim sales.
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
                                            title="Salin analisis lengkap ke clipboard untuk dibagikan ke WhatsApp / Email"
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
                                                    <span>Salin Laporan</span>
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchAiAnalysis(null, true)}
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

                            {/* Body */}
                            {!aiCollapsed && (
                                <div className="p-5">
                                    {/* Loading Skeleton */}
                                    {aiLoading && !aiData && (
                                        <div className="space-y-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    AI sedang membaca seluruh data KPI, menghitung risiko pareto, dan merumuskan rekomendasi taktis...
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                                <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
                                                <div className="h-32 animate-pulse rounded-xl bg-muted/60 lg:col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                                                <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                                                <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {aiError && !aiLoading && (
                                        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                                <span>{aiError}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => fetchAiAnalysis(null, true)}
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
                                                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-2 text-xs text-indigo-700 dark:text-indigo-300">
                                                    <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                                                    <span>
                                                        <strong>Metode Analitik Data Terintegrasi (Python + Qwen 2.5):</strong> Seluruh analitik data dihitung secara presisi menggunakan <em>Python Data Analytics Engine</em> (Pareto HHI, Cohort Dynamics, Z-Score Outlier & Health Scoring berbobot), lalu diteruskan ke <strong>Qwen 2.5 (7B) Ollama</strong> di VPS Production agar kesimpulan serta rekomendasi strategisnya berbasis data riil dan jauh lebih akurat.
                                                    </span>
                                                </div>
                                            )}

                                            {/* 1. Health Score & Executive Summary */}
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                                {/* Health Score Box */}
                                                <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4.5 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Skor Kesehatan KPI
                                                        </span>
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                                                aiData.health_score >= 80
                                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                                                    : aiData.health_score >= 65
                                                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                                    : aiData.health_score >= 50
                                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                            }`}
                                                        >
                                                            {aiData.status_label || 'Evaluasi'}
                                                        </span>
                                                    </div>

                                                    <div className="my-3 flex items-baseline gap-2">
                                                        <span
                                                            className={`text-4xl font-extrabold tracking-tight ${
                                                                aiData.health_score >= 80
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : aiData.health_score >= 65
                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                    : aiData.health_score >= 50
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-rose-600 dark:text-rose-400'
                                                            }`}
                                                        >
                                                            {aiData.health_score}
                                                        </span>
                                                        <span className="text-sm font-semibold text-muted-foreground">
                                                            / 100
                                                        </span>
                                                    </div>

                                                    {/* Pareto Mini Bar */}
                                                    <div className="space-y-1.5 border-t border-sidebar-border/50 pt-2.5 text-xs text-muted-foreground">
                                                        <div className="flex items-center justify-between">
                                                            <span>Konsentrasi Top 5:</span>
                                                            <strong className="text-foreground">
                                                                {aiData.pareto_risk_analysis?.top5_share_percent ?? 0}%
                                                            </strong>
                                                        </div>
                                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${
                                                                    (aiData.pareto_risk_analysis?.top5_share_percent ?? 0) > 70
                                                                        ? 'bg-rose-500'
                                                                        : (aiData.pareto_risk_analysis?.top5_share_percent ?? 0) > 50
                                                                        ? 'bg-amber-500'
                                                                        : 'bg-emerald-500'
                                                                }`}
                                                                style={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        aiData.pareto_risk_analysis?.top5_share_percent ?? 0,
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span>Tingkat Risiko:</span>
                                                            <span
                                                                className={`font-semibold ${
                                                                    aiData.pareto_risk_analysis?.risk_level === 'Tinggi'
                                                                        ? 'text-rose-600 dark:text-rose-400'
                                                                        : aiData.pareto_risk_analysis?.risk_level === 'Sedang'
                                                                        ? 'text-amber-600 dark:text-amber-400'
                                                                        : 'text-emerald-600 dark:text-emerald-400'
                                                                }`}
                                                            >
                                                                {aiData.pareto_risk_analysis?.risk_level || 'Normal'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Executive Summary Box */}
                                                <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-5 shadow-xs lg:col-span-3">
                                                    <div className="flex items-center justify-between border-b border-sidebar-border/50 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <BarChart3 className="h-4 w-4 text-primary" />
                                                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                                Ringkasan Eksekutif (Executive Summary)
                                                            </h3>
                                                        </div>
                                                        <span className="text-[11px] font-medium text-primary">
                                                            Evaluasi Periode: {data?.periodInfo?.currentLabel || 'Periode Berjalan'}
                                                        </span>
                                                    </div>
                                                    <div className="my-2.5 text-sm leading-relaxed text-foreground/90">
                                                        <p>{aiData.executive_summary}</p>
                                                    </div>
                                                    {aiData.pareto_risk_analysis?.evaluation && (
                                                        <div className="rounded-lg border border-sidebar-border/50 bg-muted/50 p-2.5 text-xs text-muted-foreground">
                                                            <strong className="text-foreground">
                                                                Analisis Pareto:{' '}
                                                            </strong>
                                                            {aiData.pareto_risk_analysis.evaluation}
                                                        </div>
                                                    )}

                                                    {/* Python Analytical Metrics Badges */}
                                                    {aiData.analytics_metrics && (
                                                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sidebar-border/50 pt-2.5">
                                                            <span className="text-[11px] font-semibold text-muted-foreground">
                                                                Metrik Analitik Python:
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                                HHI: <strong className="text-primary">{aiData.analytics_metrics.hhi}</strong> ({aiData.analytics_metrics.hhi_label || aiData.analytics_metrics.risk_level})
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                                Gini: <strong className="text-primary">{aiData.analytics_metrics.gini}</strong>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                                NRR: <strong className="text-emerald-600 dark:text-emerald-400">{aiData.analytics_metrics.nrr_percent}%</strong>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                                Churn Rate: <strong className={aiData.analytics_metrics.churn_rate_percent > 15 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}>{aiData.analytics_metrics.churn_rate_percent}%</strong>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                                Titik 80% Pareto: <strong>{aiData.analytics_metrics.pareto_80_cutoff_customers} Akun</strong>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Sorotan Kritis & Hal yang Harus Diperbaiki */}
                                            {aiData.critical_areas_to_fix && aiData.critical_areas_to_fix.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                                            <ShieldAlert className="h-3.5 w-3.5" />
                                                        </div>
                                                        <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                            Sorotan Kritis & Hal yang Harus Diperbaiki
                                                        </h3>
                                                        <span className="rounded-full bg-rose-500/10 px-2 py-0.2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                                            {aiData.critical_areas_to_fix.length} Perhatian
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                        {aiData.critical_areas_to_fix.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="relative flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-4 transition-all hover:border-rose-500/40 hover:shadow-xs"
                                                            >
                                                                <div>
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                                                                            {item.issue}
                                                                        </h4>
                                                                        <span className="shrink-0 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                                                            {item.customer_affected}
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-1 text-xs font-semibold text-foreground">
                                                                        {item.nominal_impact}
                                                                    </div>
                                                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                                                        <strong className="text-foreground/80">
                                                                            Akar Masalah:{' '}
                                                                        </strong>
                                                                        {item.root_cause}
                                                                    </p>
                                                                </div>
                                                                <div className="mt-3 rounded-lg border border-sidebar-border/60 bg-card/80 p-2.5 text-xs text-foreground/90">
                                                                    <div className="mb-1 flex items-center gap-1 font-semibold text-primary">
                                                                        <Zap className="h-3 w-3" />
                                                                        <span>Tindakan Perbaikan:</span>
                                                                    </div>
                                                                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                                        {item.action_to_fix}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 3. Rekomendasi Taktis Tim Marketing & Sales */}
                                            {aiData.tactical_recommendations && aiData.tactical_recommendations.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <Target className="h-3.5 w-3.5" />
                                                        </div>
                                                        <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                            Rekomendasi Taktis Tim Marketing & Sales
                                                        </h3>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                        {aiData.tactical_recommendations.map((rec, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs"
                                                            >
                                                                <div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-foreground">
                                                                            {rec.category}
                                                                        </span>
                                                                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                                            {rec.focus}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                                                                        {rec.action}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 4. Quick Wins Checklist */}
                                            {aiData.quick_wins && aiData.quick_wins.length > 0 && (
                                                <div className="rounded-xl border border-sidebar-border/80 bg-muted/30 p-4">
                                                    <div className="mb-2.5 flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                            Quick Wins (Aksi Prioritas 7 Hari ke Depan)
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

                        {/* 3. Grafik Perkembangan Penjualan */}
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-foreground sm:text-lg">
                                        {data.chartData?.title ||
                                            'Grafik Perkembangan Penjualan'}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Perbandingan total penjualan seluruh periode (faktur terbit valid).
                                    </p>
                                </div>

                                {/* Legend: jelas membedakan periode terpilih vs periode lain */}
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3.5 w-3.5 rounded-xs bg-emerald-500 shadow-sm ring-2 ring-emerald-300 dark:ring-emerald-400" />
                                        <span className="font-bold text-foreground">
                                            Periode Terpilih ({data.periodInfo?.currentLabel || 'Aktif'})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-3.5 w-3.5 rounded-xs bg-blue-500 dark:bg-blue-600 shadow-sm" />
                                        <span className="font-medium text-muted-foreground">
                                            Periode Lainnya
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-1.5 w-3.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                        <span className="text-muted-foreground">
                                            Rp 0 (Tanpa Transaksi)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SVG Vector Bar Chart Area */}
                            <div className="relative mt-6 w-full overflow-x-auto">
                                <div className="min-w-[720px]">
                                    <svg
                                        viewBox="0 0 920 290"
                                        className="h-auto w-full select-none"
                                        style={{ minHeight: '270px' }}
                                    >
                                        <defs>
                                            {/* Emerald Gradient for Active Period */}
                                            <linearGradient
                                                id="activeBarGrad"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="#10b981"
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor="#047857"
                                                />
                                            </linearGradient>

                                            {/* Blue Gradient for Other Periods */}
                                            <linearGradient
                                                id="otherBarGrad"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="#3b82f6"
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor="#1d4ed8"
                                                />
                                            </linearGradient>

                                            {/* Glow and Shadow Filters */}
                                            <filter
                                                id="activeGlow"
                                                x="-20%"
                                                y="-20%"
                                                width="140%"
                                                height="140%"
                                            >
                                                <feDropShadow
                                                    dx="0"
                                                    dy="4"
                                                    stdDeviation="4"
                                                    floodColor="#10b981"
                                                    floodOpacity="0.4"
                                                />
                                            </filter>
                                        </defs>

                                        {/* 5 Horizontal Reference Grid Lines */}
                                        <line
                                            x1="75"
                                            y1="35"
                                            x2="900"
                                            y2="35"
                                            stroke="currentColor"
                                            strokeDasharray="4 4"
                                            strokeOpacity="0.2"
                                        />
                                        <line
                                            x1="75"
                                            y1="81"
                                            x2="900"
                                            y2="81"
                                            stroke="currentColor"
                                            strokeDasharray="4 4"
                                            strokeOpacity="0.15"
                                        />
                                        <line
                                            x1="75"
                                            y1="127"
                                            x2="900"
                                            y2="127"
                                            stroke="currentColor"
                                            strokeDasharray="4 4"
                                            strokeOpacity="0.15"
                                        />
                                        <line
                                            x1="75"
                                            y1="173"
                                            x2="900"
                                            y2="173"
                                            stroke="currentColor"
                                            strokeDasharray="4 4"
                                            strokeOpacity="0.15"
                                        />
                                        <line
                                            x1="75"
                                            y1="220"
                                            x2="900"
                                            y2="220"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeOpacity="0.4"
                                        />

                                        {/* Y-Axis Value Labels */}
                                        <text
                                            x="65"
                                            y="39"
                                            textAnchor="end"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fill="currentColor"
                                            opacity="0.75"
                                        >
                                            {formatCompactRupiah(maxChartValue)}
                                        </text>
                                        <text
                                            x="65"
                                            y="85"
                                            textAnchor="end"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fill="currentColor"
                                            opacity="0.75"
                                        >
                                            {formatCompactRupiah(
                                                maxChartValue * 0.75,
                                            )}
                                        </text>
                                        <text
                                            x="65"
                                            y="131"
                                            textAnchor="end"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fill="currentColor"
                                            opacity="0.75"
                                        >
                                            {formatCompactRupiah(
                                                maxChartValue * 0.5,
                                            )}
                                        </text>
                                        <text
                                            x="65"
                                            y="177"
                                            textAnchor="end"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fill="currentColor"
                                            opacity="0.75"
                                        >
                                            {formatCompactRupiah(
                                                maxChartValue * 0.25,
                                            )}
                                        </text>
                                        <text
                                            x="65"
                                            y="224"
                                            textAnchor="end"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fill="currentColor"
                                            opacity="0.75"
                                        >
                                            Rp 0
                                        </text>

                                        {/* Bars and Period Labels */}
                                        {data.chartData?.items?.map(
                                            (item, index) => {
                                                const n =
                                                    data.chartData.items.length;
                                                const chartLeft = 85;
                                                const chartRight = 890;
                                                const chartWidth =
                                                    chartRight - chartLeft;
                                                const step = chartWidth / n;
                                                const barWidth = Math.min(
                                                    54,
                                                    Math.max(
                                                        26,
                                                        step * 0.52,
                                                    ),
                                                );
                                                const x =
                                                    chartLeft +
                                                    index * step +
                                                    (step - barWidth) / 2;

                                                const chartTop = 35;
                                                const chartBottom = 220;
                                                const chartHeight =
                                                    chartBottom - chartTop; // 185px

                                                const value = Number(
                                                    item.sales || 0,
                                                );
                                                const barH =
                                                    maxChartValue > 0
                                                        ? (value /
                                                              maxChartValue) *
                                                          chartHeight
                                                        : 0;
                                                const displayH =
                                                    value > 0
                                                        ? Math.max(barH, 6)
                                                        : 0;
                                                const y = chartBottom - displayH;

                                                const isHighlighted =
                                                    item.is_active;

                                                return (
                                                    <g
                                                        key={item.key}
                                                        className="group cursor-pointer"
                                                        onClick={() =>
                                                            handleBarClick(item)
                                                        }
                                                        onMouseEnter={() =>
                                                            setHoveredChartItem(
                                                                item,
                                                            )
                                                        }
                                                        onMouseLeave={() =>
                                                            setHoveredChartItem(
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        {/* Invisible clickable trigger area covering full column */}
                                                        <rect
                                                            x={
                                                                chartLeft +
                                                                index * step
                                                            }
                                                            y="15"
                                                            width={step}
                                                            height="260"
                                                            fill="transparent"
                                                        />

                                                        {/* Hover column background highlight */}
                                                        <rect
                                                            x={
                                                                chartLeft +
                                                                index * step +
                                                                2
                                                            }
                                                            y="25"
                                                            width={step - 4}
                                                            height="200"
                                                            rx="6"
                                                            fill="currentColor"
                                                            opacity={
                                                                hoveredChartItem?.key ===
                                                                item.key
                                                                    ? '0.08'
                                                                    : '0'
                                                            }
                                                            className="transition-opacity duration-200"
                                                        />

                                                        {/* Top Value Label */}
                                                        {value > 0 && (
                                                            <text
                                                                x={
                                                                    x +
                                                                    barWidth / 2
                                                                }
                                                                y={Math.max(
                                                                    y - 8,
                                                                    26,
                                                                )}
                                                                textAnchor="middle"
                                                                fontSize="11"
                                                                fontWeight="bold"
                                                                fill={
                                                                    isHighlighted
                                                                        ? '#10b981'
                                                                        : 'currentColor'
                                                                }
                                                                opacity={
                                                                    isHighlighted
                                                                        ? 1
                                                                        : 0.85
                                                                }
                                                                className="tabular-nums"
                                                            >
                                                                {formatCompactRupiah(
                                                                    value,
                                                                )}
                                                            </text>
                                                        )}

                                                        {/* The Bar */}
                                                        {value > 0 ? (
                                                            <rect
                                                                x={x}
                                                                y={y}
                                                                width={barWidth}
                                                                height={displayH}
                                                                rx="5"
                                                                fill={
                                                                    isHighlighted
                                                                        ? 'url(#activeBarGrad)'
                                                                        : 'url(#otherBarGrad)'
                                                                }
                                                                filter={
                                                                    isHighlighted
                                                                        ? 'url(#activeGlow)'
                                                                        : undefined
                                                                }
                                                                stroke={
                                                                    isHighlighted
                                                                        ? '#34d399'
                                                                        : '#60a5fa'
                                                                }
                                                                strokeWidth={
                                                                    isHighlighted
                                                                        ? '1.5'
                                                                        : '0.5'
                                                                }
                                                                className="transition-all duration-300 hover:brightness-110"
                                                            />
                                                        ) : (
                                                            /* Zero Sales Baseline Tick */
                                                            <rect
                                                                x={x}
                                                                y={
                                                                    chartBottom -
                                                                    1.5
                                                                }
                                                                width={barWidth}
                                                                height="3"
                                                                rx="1.5"
                                                                fill="currentColor"
                                                                opacity="0.25"
                                                            />
                                                        )}

                                                        {/* Bottom Label Badge or Text */}
                                                        {isHighlighted ? (
                                                            <g>
                                                                <rect
                                                                    x={
                                                                        x +
                                                                        barWidth /
                                                                            2 -
                                                                        Math.max(
                                                                            barWidth /
                                                                                2 +
                                                                                4,
                                                                            18,
                                                                        )
                                                                    }
                                                                    y={
                                                                        chartBottom +
                                                                        10
                                                                    }
                                                                    width={Math.max(
                                                                        barWidth +
                                                                            8,
                                                                        36,
                                                                    )}
                                                                    height="24"
                                                                    rx="6"
                                                                    fill="#10b981"
                                                                />
                                                                <text
                                                                    x={
                                                                        x +
                                                                        barWidth /
                                                                            2
                                                                    }
                                                                    y={
                                                                        chartBottom +
                                                                        26
                                                                    }
                                                                    textAnchor="middle"
                                                                    fontSize="12"
                                                                    fontWeight="bold"
                                                                    fill="#ffffff"
                                                                >
                                                                    {item.label}
                                                                </text>
                                                            </g>
                                                        ) : (
                                                            <text
                                                                x={
                                                                    x +
                                                                    barWidth / 2
                                                                }
                                                                y={
                                                                    chartBottom +
                                                                    26
                                                                }
                                                                textAnchor="middle"
                                                                fontSize="12"
                                                                fontWeight="500"
                                                                fill="currentColor"
                                                                opacity="0.65"
                                                                className="transition-all group-hover:font-bold group-hover:opacity-100"
                                                            >
                                                                {item.label}
                                                            </text>
                                                        )}
                                                    </g>
                                                );
                                            },
                                        )}
                                    </svg>
                                </div>
                            </div>

                            {/* Chart Summary Footer */}
                            <div className="mt-4 flex flex-wrap items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5 text-xs text-foreground">
                                <div>
                                    {hoveredChartItem ? (
                                        <span className="font-semibold text-foreground">
                                            Sorot:{' '}
                                            <strong className="text-primary">
                                                {hoveredChartItem.full_label}
                                            </strong>{' '}
                                            —{' '}
                                            <span className={hoveredChartItem.is_active ? 'text-emerald-500 font-bold' : 'text-blue-500 font-bold'}>
                                                {formatRupiah(hoveredChartItem.sales)}
                                            </span>{' '}
                                            ({hoveredChartItem.invoices} Faktur)
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            Arahkan kursor ke batang untuk melihat detail, atau <strong>klik pada batang</strong> untuk langsung memfilter ke periode tersebut.
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    Penjualan Tertinggi: <strong className="text-foreground">{formatRupiah(maxChartValue)}</strong>
                                </div>
                            </div>
                        </div>

                        {/* 4. Top 5 Penjualan Customer — Perbandingan Antar Periode & Aksi Marketing */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-foreground sm:text-lg">
                                        Analisis Customer — Perbandingan Antar Periode
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Perbandingan langsung penjualan periode terpilih ({data.periodInfo?.currentLabel}) dengan periode sebelumnya ({data.periodInfo?.previousLabel}) pada masing-masing customer.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                {/* CARD 1: TOP 5 PENJUALAN TERTINGGI (PERTAHANKAN) */}
                                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                                                <Award className="h-5 w-5 text-amber-500" />
                                                Top 5 Penjualan Tertinggi
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Customer kontribusi terbesar — prioritaskan retensi &amp; repeat order.
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                            🛡️ Target: Pertahankan
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-sidebar-border/70 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                <tr>
                                                    <th className="pb-2.5 text-center">#</th>
                                                    <th className="pb-2.5">Customer</th>
                                                    <th className="pb-2.5 text-right">
                                                        {data.periodInfo?.currentLabel || 'Periode Ini'}
                                                    </th>
                                                    <th className="pb-2.5 text-right">
                                                        {data.periodInfo?.previousLabel || 'Periode Lalu'}
                                                    </th>
                                                    <th className="pb-2.5 text-right">Selisih &amp; Tren</th>
                                                    <th className="pb-2.5 text-center">
                                                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                                            <Sparkles className="h-3 w-3" />
                                                            Aksi Tim (AI)
                                                        </span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/50 text-xs sm:text-sm">
                                                {!data.topCustomers || data.topCustomers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                                                            Tidak ada data transaksi pada periode ini.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    data.topCustomers.map((c) => {
                                                        const diff = Number(c.diff_sales ?? (c.curr_sales - c.prev_sales));
                                                        const isUp = diff >= 0;

                                                        return (
                                                            <tr key={c.kd_cs} className="hover:bg-muted/40">
                                                                <td className="py-3 text-center font-bold">
                                                                    {c.rank === 1 ? (
                                                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-xs">1</span>
                                                                    ) : c.rank === 2 ? (
                                                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white shadow-xs">2</span>
                                                                    ) : c.rank === 3 ? (
                                                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white shadow-xs">3</span>
                                                                    ) : (
                                                                        c.rank
                                                                    )}
                                                                </td>
                                                                <td className="py-3 font-medium text-foreground">
                                                                    <Link
                                                                        href={`/marketing/performance/customer/${encodeURIComponent(c.kd_cs)}?period_type=${periodType}&year=${year}&month=${month}&quarter=${quarter}&semester=${semester}`}
                                                                        className="group inline-flex flex-col text-left hover:text-primary transition-colors"
                                                                        title="Klik untuk membuka Detail KPI & Analisis AI Akun Ini"
                                                                    >
                                                                        <span className="font-semibold group-hover:underline flex items-center gap-1">
                                                                            {c.nm_cs}
                                                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                                                        </span>
                                                                        <span className="text-[11px] text-muted-foreground">{c.kd_cs}</span>
                                                                    </Link>
                                                                </td>
                                                                <td className="py-3 text-right font-bold text-foreground">
                                                                    {formatRupiah(c.curr_sales)}
                                                                </td>
                                                                <td className="py-3 text-right font-medium text-muted-foreground">
                                                                    {c.prev_sales > 0 ? formatRupiah(c.prev_sales) : 'Rp 0'}
                                                                </td>
                                                                <td className="py-3 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span
                                                                            className={`inline-flex items-center gap-0.5 font-bold ${
                                                                                isUp
                                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                                    : 'text-rose-600 dark:text-rose-400'
                                                                            }`}
                                                                        >
                                                                            {isUp ? (
                                                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                <ArrowDownRight className="h-3.5 w-3.5" />
                                                                            )}
                                                                            {isUp ? '+' : '-'}{formatCompactRupiah(Math.abs(diff))}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {formatPercent(c.growth)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 text-center">
                                                                    {renderAiTeamActionBadge(c, 'top')}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Marketing Advice Footer */}
                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                                        <Award className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        <span>
                                            <strong>Strategi Marketing:</strong> Customer kunci di atas menghasilkan omset tertinggi. Jaga komunikasi berkala, berikan pelayanan prioritas, dan kunci kontrak repeat order.
                                        </span>
                                    </div>
                                </div>

                                {/* CARD 2: TOP 5 PENJUALAN TERENDAH (PERBANYAK PENAWARAN) */}
                                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                                                <TrendingDown className="h-5 w-5 text-amber-500" />
                                                Top 5 Penjualan Terendah
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Customer dengan penjualan minim — peluang untuk diperbanyak penawarannya.
                                            </p>
                                        </div>

                                        {/* Toggle View: Nominal Terkecil vs Penurunan Terbesar */}
                                        <div className="inline-flex rounded-lg border border-sidebar-border/70 bg-muted/40 p-0.5 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setLowestMode('nominal')}
                                                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                                                    lowestMode === 'nominal'
                                                        ? 'bg-card text-foreground shadow-xs font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                                title="Customer dengan volume pembelian terkecil (> Rp 0)"
                                            >
                                                Nominal Terkecil
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLowestMode('drop')}
                                                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                                                    lowestMode === 'drop'
                                                        ? 'bg-card text-foreground shadow-xs font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                                title="Customer yang mengalami penurunan omset terbesar dibanding periode lalu"
                                            >
                                                Penurunan Terbesar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-sidebar-border/70 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                <tr>
                                                    <th className="pb-2.5 text-center">#</th>
                                                    <th className="pb-2.5">Customer</th>
                                                    <th className="pb-2.5 text-right">
                                                        {data.periodInfo?.currentLabel || 'Periode Ini'}
                                                    </th>
                                                    <th className="pb-2.5 text-right">
                                                        {data.periodInfo?.previousLabel || 'Periode Lalu'}
                                                    </th>
                                                    <th className="pb-2.5 text-right">Selisih &amp; Tren</th>
                                                    <th className="pb-2.5 text-center">
                                                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                                            <Sparkles className="h-3 w-3" />
                                                            Aksi Tim (AI)
                                                        </span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/50 text-xs sm:text-sm">
                                                {(() => {
                                                    const activeLowestList =
                                                        lowestMode === 'nominal'
                                                            ? data.lowestCustomers
                                                            : (data.decliningCustomers || data.lowestCustomers);

                                                    if (!activeLowestList || activeLowestList.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                                                                    Tidak ada data transaksi pada kategori ini.
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return activeLowestList.map((c) => {
                                                        const diff = Number(c.diff_sales ?? (c.curr_sales - c.prev_sales));
                                                        const isUp = diff >= 0;

                                                        return (
                                                            <tr key={c.kd_cs} className="hover:bg-muted/40">
                                                                <td className="py-3 text-center font-bold text-muted-foreground">
                                                                    {c.rank}
                                                                </td>
                                                                <td className="py-3 font-medium text-foreground">
                                                                    <Link
                                                                        href={`/marketing/performance/customer/${encodeURIComponent(c.kd_cs)}?period_type=${periodType}&year=${year}&month=${month}&quarter=${quarter}&semester=${semester}`}
                                                                        className="group inline-flex flex-col text-left hover:text-primary transition-colors"
                                                                        title="Klik untuk membuka Detail KPI & Analisis AI Akun Ini"
                                                                    >
                                                                        <span className="font-semibold group-hover:underline flex items-center gap-1">
                                                                            {c.nm_cs}
                                                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                                                        </span>
                                                                        <span className="text-[11px] text-muted-foreground">{c.kd_cs}</span>
                                                                    </Link>
                                                                </td>
                                                                <td className="py-3 text-right font-bold text-foreground">
                                                                    {formatRupiah(c.curr_sales)}
                                                                </td>
                                                                <td className="py-3 text-right font-medium text-muted-foreground">
                                                                    {c.prev_sales > 0 ? formatRupiah(c.prev_sales) : 'Rp 0'}
                                                                </td>
                                                                <td className="py-3 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span
                                                                            className={`inline-flex items-center gap-0.5 font-bold ${
                                                                                isUp
                                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                                    : 'text-rose-600 dark:text-rose-400'
                                                                            }`}
                                                                        >
                                                                            {isUp ? (
                                                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                <ArrowDownRight className="h-3.5 w-3.5" />
                                                                            )}
                                                                            {isUp ? '+' : '-'}{formatCompactRupiah(Math.abs(diff))}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {formatPercent(c.growth)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 text-center">
                                                                    {renderAiTeamActionBadge(c, 'lowest')}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Marketing Advice Footer */}
                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                                        <HelpCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                        <span>
                                            <strong>Strategi Marketing:</strong> Customer dalam daftar ini memiliki potensi pembelian yang belum optimal. Segera hubungi purchasing mereka dan perbanyak penawaran katalog/diskon volume.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 5. Tabel Seluruh Customer */}
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-xs">
                            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-foreground sm:text-lg">
                                        Tabel Seluruh Customer
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Performa penjualan seluruh customer
                                        pada periode berjalan dibanding periode
                                        sebelumnya.
                                    </p>
                                </div>

                                {/* Search & Status Filter */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Cari customer / kode..."
                                            value={searchCustomer}
                                            onChange={(e) => {
                                                setSearchCustomer(
                                                    e.target.value,
                                                );
                                                setCurrentPage(1);
                                            }}
                                            className="h-9 pl-9 text-xs sm:text-sm"
                                        />
                                    </div>

                                    <select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-xs text-foreground shadow-xs sm:text-sm font-medium"
                                    >
                                        <option value="all">
                                            Semua Status AI
                                        </option>
                                        <option value="VIP">
                                            ⭐ VIP (Growth &amp; At-Risk)
                                        </option>
                                        <option value="Akselerasi">
                                            🚀 Akselerasi Tinggi
                                        </option>
                                        <option value="Stabil">
                                            💎 Konsisten &amp; Stabil
                                        </option>
                                        <option value="Potensial">
                                            🎯 Potensial Penetrasi
                                        </option>
                                        <option value="Menurun">
                                            📉 Menurun &amp; Kritis
                                        </option>
                                        <option value="Dormant">
                                            ⚠️ Dormant (Macet)
                                        </option>
                                        <option value="Non-Aktif">
                                            ⚪ Non-Aktif
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-sidebar-border/70 text-xs font-semibold text-muted-foreground">
                                        <tr>
                                            <th
                                                className="cursor-pointer pb-3 text-center hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('rank')
                                                }
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    Rank{' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th
                                                className="cursor-pointer pb-3 hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('nm_cs')
                                                }
                                            >
                                                <div className="flex items-center gap-1">
                                                    Nama Customer{' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th
                                                className="cursor-pointer pb-3 text-right hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('curr_sales')
                                                }
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Penjualan ({data.periodInfo?.currentLabel || 'Berjalan'}){' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th
                                                className="cursor-pointer pb-3 text-right hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('prev_sales')
                                                }
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Penjualan ({data.periodInfo?.previousLabel || 'Sebelumnya'}){' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th
                                                className="cursor-pointer pb-3 text-right hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('growth')
                                                }
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Pertumbuhan{' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th
                                                className="cursor-pointer pb-3 text-center hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('curr_invoices')
                                                }
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    Invoice{' '}
                                                    <ArrowUpDown className="h-3 w-3" />
                                                </div>
                                            </th>
                                            <th className="pb-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
                                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                                    Status Performa (AI)
                                                </div>
                                            </th>
                                            <th className="pb-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
                                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                                    Rekomendasi Aksi (AI)
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/50 text-xs sm:text-sm">
                                        {paginatedCustomers.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="py-8 text-center text-muted-foreground"
                                                >
                                                    Tidak ada customer yang
                                                    sesuai kriteria filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedCustomers.map((c) => (
                                                <tr
                                                    key={c.kd_cs}
                                                    className="hover:bg-muted/40"
                                                >
                                                    <td className="py-3 text-center font-bold text-muted-foreground">
                                                        {c.curr_sales > 0
                                                            ? c.rank
                                                            : '-'}
                                                    </td>
                                                    <td className="py-3 font-medium text-foreground">
                                                        <Link
                                                            href={`/marketing/performance/customer/${encodeURIComponent(c.kd_cs)}?period_type=${periodType}&year=${year}&month=${month}&quarter=${quarter}&semester=${semester}`}
                                                            className="group inline-flex flex-col text-left hover:text-primary transition-colors"
                                                            title="Klik untuk membuka Detail KPI & Analisis AI Akun Ini"
                                                        >
                                                            <span className="font-semibold group-hover:underline flex items-center gap-1">
                                                                {c.nm_cs}
                                                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground">
                                                                {c.kd_cs}
                                                            </span>
                                                        </Link>
                                                    </td>
                                                    <td className="py-3 text-right font-bold text-foreground">
                                                        {formatRupiah(
                                                            c.curr_sales,
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-right text-muted-foreground">
                                                        {formatRupiah(
                                                            c.prev_sales,
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <span
                                                            className={`font-semibold ${
                                                                c.growth >= 0
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : 'text-rose-600 dark:text-rose-400'
                                                                }`}
                                                        >
                                                            {formatPercent(
                                                                c.growth,
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-center text-muted-foreground">
                                                        {c.curr_invoices}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {renderAiStatusBadge(c)}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {renderAiActionBadge(c)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination & Count Footer */}
                            <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-sidebar-border/50 pt-4 text-xs sm:flex-row sm:text-sm">
                                <div className="text-muted-foreground">
                                    Menampilkan{' '}
                                    <strong className="text-foreground">
                                        {filteredCustomers.length > 0
                                            ? perPage === 'all'
                                                ? 1
                                                : (currentPage - 1) * perPage +
                                                  1
                                            : 0}
                                    </strong>{' '}
                                    sampai{' '}
                                    <strong className="text-foreground">
                                        {perPage === 'all'
                                            ? filteredCustomers.length
                                            : Math.min(
                                                  currentPage * perPage,
                                                  filteredCustomers.length,
                                              )}
                                    </strong>{' '}
                                    dari{' '}
                                    <strong className="text-foreground">
                                        {filteredCustomers.length}
                                    </strong>{' '}
                                    customer
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={perPage}
                                        onChange={(e) => {
                                            setPerPage(
                                                e.target.value === 'all'
                                                    ? 'all'
                                                    : Number(e.target.value),
                                            );
                                            setCurrentPage(1);
                                        }}
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs text-foreground shadow-xs"
                                    >
                                        <option value={5}>5 baris</option>
                                        <option value={10}>10 baris</option>
                                        <option value={15}>15 baris</option>
                                        <option value={25}>25 baris</option>
                                        <option value={50}>50 baris</option>
                                        <option value="all">Semua</option>
                                    </select>

                                    {perPage !== 'all' && totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={currentPage <= 1}
                                                onClick={() =>
                                                    setCurrentPage((p) => p - 1)
                                                }
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="px-2 text-xs font-medium">
                                                {currentPage} / {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={
                                                    currentPage >= totalPages
                                                }
                                                onClick={() =>
                                                    setCurrentPage((p) => p + 1)
                                                }
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
