import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    ArrowDown,
    ArrowDownRight,
    ArrowLeftRight,
    ArrowUp,
    ArrowUpDown,
    ArrowUpRight,
    Banknote,
    BarChart3,
    BookOpen,
    Building2,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    CreditCard,
    Eye,
    Filter,
    HelpCircle,
    Layers,
    Minus,
    Plus,
    Printer,
    RefreshCw,
    Scale,
    Search,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
    Wallet,
    X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Breadcrumbs
const breadcrumbs = [
    { title: 'Laporan', href: '/laporan/nabb-rekap' },
    { title: 'NABB Rekap', href: '/laporan/nabb-rekap' },
];

// Helper: Format Rupiah
const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

// Helper: Format Number
const formatNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
};

// Helper: Format Label Periode
const getPeriodLabel = (periodType, period) => {
    if (!period) return 'Semua Periode';
    if (periodType === 'year') {
        if (!/^\d{4}$/.test(period)) return `Tahun ${period}`;
        return `Tahun ${period}`;
    }
    if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split('-').map(Number);
        const d = new Date(y, Math.max(0, m - 1), 1);
        return new Intl.DateTimeFormat('id-ID', {
            month: 'long',
            year: 'numeric',
        }).format(d);
    }
    if (/^\d{6}$/.test(period)) {
        const y = Number(period.slice(0, 4));
        const m = Number(period.slice(4, 6));
        const d = new Date(y, Math.max(0, m - 1), 1);
        return new Intl.DateTimeFormat('id-ID', {
            month: 'long',
            year: 'numeric',
        }).format(d);
    }
    return period;
};

// Helper: Kategori Akun ringkas dan jelas
const getAccountCategory = (code) => {
    const prefix = String(code || '').trim().charAt(0);
    switch (prefix) {
        case '1':
            return { name: 'Aset', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25' };
        case '2':
            return { name: 'Liabilitas', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25' };
        case '3':
            return { name: 'Ekuitas', badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25' };
        case '4':
            return { name: 'Pendapatan', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25' };
        case '5':
            return { name: 'Beban Ops', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25' };
        case '6':
            return { name: 'HPP', badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25' };
        case '7':
            return { name: 'Pend. Lain', badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25' };
        case '8':
            return { name: 'Beban Lain', badge: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25' };
        default:
            return { name: 'Lain-lain', badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25' };
    }
};

export default function NabbRekapIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod,
        yearOptions = [],
        defaultYear,
    } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Mode: Single vs Dynamic Comparison
    const [isCompare, setIsCompare] = useState(Boolean(initialQuery?.isCompare ?? false));

    // Comparison Settings
    const [compareType, setCompareType] = useState(initialQuery?.compareType ?? 'month'); // 'month' | 'year'

    // Selected Periods for Comparison
    const [comparePeriods, setComparePeriods] = useState(() => {
        if (Array.isArray(initialQuery?.comparePeriods) && initialQuery.comparePeriods.length >= 2) {
            return initialQuery.comparePeriods;
        }
        if (initialQuery?.period1 && initialQuery?.period2) {
            return [initialQuery.period1, initialQuery.period2];
        }
        // Default: 2 bulan terakhir atau 2 tahun terakhir
        if (initialQuery?.compareType === 'year') {
            return yearOptions.slice(0, Math.min(2, yearOptions.length)).sort();
        }
        return periodOptions.slice(0, Math.min(2, periodOptions.length)).sort();
    });

    const [changeFilter, setChangeFilter] = useState(initialQuery?.changeFilter ?? 'all'); // all, up, down, same, changed

    // Single period states
    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(
        initialQuery?.period !== undefined && initialQuery?.period !== ''
            ? initialQuery.period
            : (defaultPeriod || '')
    );
    const [accountGroup, setAccountGroup] = useState(initialQuery?.accountGroup ?? 'all');
    const [ajpFilter, setAjpFilter] = useState(initialQuery?.ajpFilter ?? 'all');
    const [saldoFilter, setSaldoFilter] = useState(initialQuery?.saldoFilter ?? 'all');
    const [saldoSign, setSaldoSign] = useState(initialQuery?.saldoSign ?? 'all');
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Kode_Akun');
    const [sortDir, setSortDir] = useState(initialQuery?.sortDir ?? 'asc');
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all' ? 'all' : Number(initialQuery?.pageSize ?? 10) || 10
    );
    const [page, setPage] = useState(1);

    // Summary state
    const [summary, setSummary] = useState({
        total_accounts: 0,
        total_saldo_awal: 0,
        total_ajp_debit: 0,
        total_ajp_kredit: 0,
        total_saldo: 0,
        total_aset: 0,
        total_liabilitas: 0,
        total_ekuitas: 0,
        total_pendapatan: 0,
        total_biaya_operasional: 0,
        total_hpp: 0,
        total_beban: 0,
        selisih_neraca: 0,
        is_balanced: true,
        positive_count: 0,
        negative_count: 0,
        zero_count: 0,
        adjusted_count: 0,
        // Dynamic comparison metrics
        compareType: 'month',
        periods: [],
        periodLabels: [],
        period_totals: [],
        total_saldo_start: 0,
        total_saldo_end: 0,
        total_diff_nominal: 0,
        total_diff_percent: 0,
        count_up: 0,
        count_down: 0,
        count_same: 0,
    });

    // Expandable detail row
    const [expandedRows, setExpandedRows] = useState({});
    const toggleRowDetail = (kodeAkun) => {
        setExpandedRows((prev) => ({
            ...prev,
            [kodeAkun]: !prev[kodeAkun],
        }));
    };

    // Popover dropdown state for "+ Tambah Periode"
    const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
    const periodPickerRef = useRef(null);

    // Close period picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (periodPickerRef.current && !periodPickerRef.current.contains(e.target)) {
                setIsPeriodPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search debounce
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 350);
        return () => clearTimeout(handler);
    }, [search]);

    // Reset page to 1 on filter changes
    useEffect(() => {
        setPage(1);
    }, [
        isCompare,
        compareType,
        comparePeriods,
        changeFilter,
        periodType,
        period,
        accountGroup,
        ajpFilter,
        saldoFilter,
        saldoSign,
        debouncedSearch,
        sortBy,
        sortDir,
        pageSize,
    ]);

    // Toggle a period in/out of comparison
    const handleTogglePeriod = (p) => {
        setComparePeriods((prev) => {
            let next;
            if (prev.includes(p)) {
                if (prev.length <= 2) {
                    alert('Minimal 2 periode harus dipilih untuk komparasi.');
                    return prev;
                }
                next = prev.filter((item) => item !== p);
            } else {
                next = [...prev, p];
            }
            return next.sort();
        });
    };

    // Remove single period
    const handleRemovePeriod = (p) => {
        if (comparePeriods.length <= 2) {
            alert('Minimal 2 periode harus dipilih untuk membandingkan data.');
            return;
        }
        setComparePeriods((prev) => prev.filter((item) => item !== p));
    };

    // Presets for Monthly
    const handleMonthlyPreset = (count) => {
        if (count === 'all') {
            // Semua bulan di tahun berjalan
            const curYear = defaultYear || (yearOptions[0] ?? new Date().getFullYear().toString());
            const filtered = periodOptions.filter((p) => p.startsWith(curYear));
            if (filtered.length >= 2) {
                setComparePeriods([...filtered].sort());
            } else {
                setComparePeriods(periodOptions.slice(0, Math.min(12, periodOptions.length)).sort());
            }
        } else {
            const num = Number(count);
            const sliced = periodOptions.slice(0, Math.min(num, periodOptions.length));
            setComparePeriods(sliced.sort());
        }
    };

    // Presets for Yearly
    const handleYearlyPreset = (count) => {
        if (count === 'all') {
            setComparePeriods([...yearOptions].sort());
        } else {
            const num = Number(count);
            const sliced = yearOptions.slice(0, Math.min(num, yearOptions.length));
            setComparePeriods(sliced.sort());
        }
    };

    // Switch between Monthly and Yearly comparison
    const handleCompareTypeSwitch = (type) => {
        setCompareType(type);
        if (type === 'year') {
            const defYears = yearOptions.slice(0, Math.min(2, yearOptions.length)).sort();
            setComparePeriods(defYears);
        } else {
            const defMonths = periodOptions.slice(0, Math.min(2, periodOptions.length)).sort();
            setComparePeriods(defMonths);
        }
    };

    // Reverse periods order
    const handleReversePeriods = () => {
        setComparePeriods((prev) => [...prev].reverse());
    };

    // Fetch data
    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();

            if (isCompare) {
                params.set('isCompare', 'true');
                params.set('compareType', compareType);
                params.set('periods', comparePeriods.join(','));
                if (changeFilter !== 'all') params.set('changeFilter', changeFilter);
            } else {
                params.set('periodType', periodType);
                if (period) params.set('period', period);
                if (ajpFilter !== 'all') params.set('ajpFilter', ajpFilter);
                if (saldoFilter !== 'all') params.set('saldoFilter', saldoFilter);
                if (saldoSign !== 'all') params.set('saldoSign', saldoSign);
            }

            if (debouncedSearch) params.set('search', debouncedSearch);
            if (accountGroup !== 'all') params.set('accountGroup', accountGroup);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set('pageSize', String(pageSize));

            const response = await axios.get(`/laporan/nabb-rekap/rows?${params.toString()}`);
            setRows(response.data.rows ?? []);
            setTotal(response.data.total ?? 0);
            if (response.data.summary) {
                setSummary(response.data.summary);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Gagal memproses data NABB Rekap.');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [
        isCompare,
        compareType,
        comparePeriods,
        changeFilter,
        periodType,
        period,
        debouncedSearch,
        accountGroup,
        ajpFilter,
        saldoFilter,
        saldoSign,
        sortBy,
        sortDir,
        page,
        pageSize,
    ]);

    useEffect(() => {
        fetchRows();
    }, [fetchRows]);

    // Sorting toggle
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDir('asc');
        }
    };

    // Print URL builder
    const printUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (isCompare) {
            params.set('isCompare', 'true');
            params.set('compareType', compareType);
            params.set('periods', comparePeriods.join(','));
            if (changeFilter !== 'all') params.set('changeFilter', changeFilter);
        } else {
            params.set('periodType', periodType);
            if (period) params.set('period', period);
            if (ajpFilter !== 'all') params.set('ajpFilter', ajpFilter);
            if (saldoFilter !== 'all') params.set('saldoFilter', saldoFilter);
            if (saldoSign !== 'all') params.set('saldoSign', saldoSign);
        }
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (accountGroup !== 'all') params.set('accountGroup', accountGroup);
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);
        return `/laporan/nabb-rekap/print?${params.toString()}`;
    }, [
        isCompare,
        compareType,
        comparePeriods,
        changeFilter,
        periodType,
        period,
        debouncedSearch,
        accountGroup,
        ajpFilter,
        saldoFilter,
        saldoSign,
        sortBy,
        sortDir,
    ]);

    // Export CSV
    const exportCsv = () => {
        if (rows.length === 0) return;

        if (isCompare) {
            const pLabels = (summary.periods && summary.periods.length > 0 ? summary.periods : comparePeriods).map((p) =>
                getPeriodLabel(compareType, p)
            );
            const headers = [
                'No',
                'Kode Akun',
                'Kategori',
                'Nama Akun',
                ...pLabels.map((l) => `Saldo (${l})`),
                'Selisih Total (Rp)',
                '% Perubahan',
            ];

            const csvRows = [headers.join(',')];

            rows.forEach((r, idx) => {
                const cat = getAccountCategory(r.Kode_Akun).name;
                const periodSaldos = (summary.periods || comparePeriods).map((_, i) => r[`Saldo_${i}`] ?? 0);
                const rowValues = [
                    idx + 1,
                    `"${r.Kode_Akun ?? ''}"`,
                    `"${cat}"`,
                    `"${(r.Nama_Akun ?? '').replace(/"/g, '""')}"`,
                    ...periodSaldos,
                    r.Diff_Nominal ?? 0,
                    `${r.Diff_Percent ?? 0}%`,
                ];
                csvRows.push(rowValues.join(','));
            });

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `NABB_Komparasi_${compareType}_${comparePeriods.join('_')}_${new Date().toISOString().slice(0, 10)}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        // Single mode CSV
        const headers = [
            'No',
            'Kode Akun',
            'Kategori',
            'Nama Akun',
            'Saldo Awal',
            'AJP Debit',
            'AJP Kredit',
            'Saldo Akhir (Disesuaikan)',
            'Selisih (Rp)',
            '% Perubahan',
        ];
        const csvRows = [headers.join(',')];

        rows.forEach((r, idx) => {
            const cat = getAccountCategory(r.Kode_Akun).name;
            const sAwal = Number(r.Saldo_Awal || 0);
            const sAkhir = Number(r.Saldo || 0);
            const diff = r.Diff_Nominal !== undefined ? Number(r.Diff_Nominal) : (sAkhir - sAwal);
            const diffPct = r.Diff_Percent !== undefined
                ? Number(r.Diff_Percent)
                : (sAwal !== 0 ? (diff / Math.abs(sAwal)) * 100 : (diff !== 0 ? (diff > 0 ? 100 : -100) : 0));
            const rowValues = [
                idx + 1,
                `"${r.Kode_Akun ?? ''}"`,
                `"${cat}"`,
                `"${(r.Nama_Akun ?? '').replace(/"/g, '""')}"`,
                r.Saldo_Awal ?? 0,
                r.Ajp_Debit ?? 0,
                r.Ajp_Kredit ?? 0,
                r.Saldo ?? 0,
                diff,
                `${Number(diffPct).toFixed(2)}%`,
            ];
            csvRows.push(rowValues.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `NABB_Rekap_${period || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / (Number(pageSize) || 10));

    // Active period labels for display
    const activePeriodLabels = useMemo(() => {
        const list = summary.periods && summary.periods.length > 0 ? summary.periods : comparePeriods;
        return list.map((p) => ({
            raw: p,
            label: getPeriodLabel(compareType, p),
        }));
    }, [summary.periods, comparePeriods, compareType]);

    const activePeriodsList = summary.periods && summary.periods.length > 0 ? summary.periods : comparePeriods;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head
                title={
                    isCompare
                        ? `NABB Rekap Komparasi Dinamis (${activePeriodLabels.map((p) => p.label).join(' vs ')})`
                        : 'NABB Rekap'
                }
            />

            <div className="space-y-6">
                {/* ─── 1. Header & Quick Actions Ribbon ──────────────────────────── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sidebar-border/40 pb-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-teal-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shadow-xs">
                                <Layers className="size-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                                        NABB Rekapitulasi
                                    </h1>
                                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                        {isCompare
                                            ? `Komparasi Dinamis (${compareType === 'year' ? 'Tahunan' : 'Bulanan'} - ${activePeriodsList.length} Periode)`
                                            : 'Mode Standar (1 Periode)'}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {isCompare
                                        ? `Analisis tren & pergeseran saldo disesuaikan AJP melintasi ${activePeriodsList.length} periode (${compareType === 'year' ? 'Year-over-Year' : 'Month-over-Month'})`
                                        : 'Rekonsiliasi snapshot saldo neraca & buku besar terhadap jurnal penyesuaian (AJP) berbasis YYYY-MM'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Mode Switch Toggle: Standar vs Bandingkan Dinamis */}
                        <div className="flex items-center rounded-2xl bg-muted/50 p-1 border border-sidebar-border/70 shadow-xs">
                            <button
                                type="button"
                                onClick={() => setIsCompare(false)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    !isCompare
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Layers className="size-3.5" />
                                <span>1 Periode</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCompare(true)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isCompare
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <ArrowLeftRight className="size-3.5" />
                                <span>Bandingkan Dinamis</span>
                            </button>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fetchRows()}
                            disabled={loading}
                            className="rounded-xl border-sidebar-border/80 text-xs font-semibold gap-1.5"
                        >
                            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
                            <span>Segarkan</span>
                        </Button>

                        <Button
                            asChild
                            size="sm"
                            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-sm"
                        >
                            <a href={printUrl} target="_blank" rel="noreferrer">
                                <Printer className="size-3.5" />
                                <span>Cetak Laporan</span>
                            </a>
                        </Button>
                    </div>
                </div>

                {/* ─── 2. Controls & Dynamic Comparison Filter Ribbon ───────────── */}
                {isCompare ? (
                    <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-background to-teal-500/5 p-4 sm:p-5 shadow-xs space-y-4">
                        {/* Row 1: Granularity Switcher & Presets */}
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Format Komparasi:
                                </span>
                                <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-sidebar-border/70 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleCompareTypeSwitch('month')}
                                        className={`rounded-lg px-3 py-1 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            compareType === 'month'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Calendar className="size-3.5" />
                                        <span>Per Bulan (MoM)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCompareTypeSwitch('year')}
                                        className={`rounded-lg px-3 py-1 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            compareType === 'year'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <BarChart3 className="size-3.5" />
                                        <span>Per Tahun (YoY)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1">
                                    Preset Cepat:
                                </span>
                                {compareType === 'month' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthlyPreset(2)}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            2 Bulan Terakhir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthlyPreset(3)}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            3 Bulan Terakhir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthlyPreset(6)}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            6 Bulan Terakhir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthlyPreset('all')}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            Tahun Ini
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleYearlyPreset(2)}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            2 Tahun Terakhir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleYearlyPreset(3)}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            3 Tahun Terakhir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleYearlyPreset('all')}
                                            className="rounded-lg bg-background hover:bg-muted border border-sidebar-border/70 px-2.5 py-1 font-semibold text-foreground transition-colors cursor-pointer"
                                        >
                                            Semua Tahun
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Selected Periods Chips & "+ Tambah Periode" Dropdown */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-500/10">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mr-1">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Periode Terpilih ({comparePeriods.length}):
                            </span>

                            {/* Render Badges of selected periods */}
                            {comparePeriods.map((p, idx) => (
                                <span
                                    key={p}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-background/90 text-foreground px-3 py-1 text-xs font-bold border border-indigo-500/30 shadow-2xs"
                                >
                                    <span className="text-[10px] text-muted-foreground font-mono">P{idx + 1}:</span>
                                    <span>{getPeriodLabel(compareType, p)}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePeriod(p)}
                                        title={`Hapus ${getPeriodLabel(compareType, p)} dari komparasi`}
                                        className="text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer p-0.5 rounded-full hover:bg-rose-500/10"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </span>
                            ))}

                            {/* Dropdown "+ Tambah Periode" */}
                            <div className="relative" ref={periodPickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsPeriodPickerOpen(!isPeriodPickerOpen)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs font-bold transition-all shadow-xs cursor-pointer"
                                >
                                    <Plus className="size-3.5" />
                                    <span>Pilih Periode</span>
                                    <ChevronDown className={`size-3 transition-transform ${isPeriodPickerOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isPeriodPickerOpen && (
                                    <div className="absolute left-0 mt-2 z-50 w-64 max-h-72 overflow-y-auto rounded-2xl bg-popover text-popover-foreground border border-sidebar-border/80 p-2 shadow-xl backdrop-blur-md">
                                        <div className="text-[11px] font-bold text-muted-foreground uppercase px-2 py-1 border-b border-sidebar-border/40">
                                            Daftar {compareType === 'year' ? 'Tahun' : 'Bulan'} Tersedia
                                        </div>
                                        <div className="space-y-1 mt-1">
                                            {(compareType === 'year' ? yearOptions : periodOptions).map((opt) => {
                                                const isSelected = comparePeriods.includes(opt);
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => handleTogglePeriod(opt)}
                                                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-left font-medium transition-colors cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold'
                                                                : 'hover:bg-muted text-foreground'
                                                        }`}
                                                    >
                                                        <span>{getPeriodLabel(compareType, opt)}</span>
                                                        {isSelected && <Check className="size-3.5 text-indigo-600 dark:text-indigo-400" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Button Balik Urutan */}
                            <button
                                type="button"
                                onClick={handleReversePeriods}
                                title="Balik urutan periode komparasi"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                            >
                                <ArrowLeftRight className="size-3" />
                                <span>Balik Urutan</span>
                            </button>
                        </div>

                        {/* Row 3: Filter Arah Perubahan, Kategori Akun & Search */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-indigo-500/10">
                            {/* Arah Perubahan */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Filter Arah Perubahan
                                </label>
                                <select
                                    value={changeFilter}
                                    onChange={(e) => setChangeFilter(e.target.value)}
                                    className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="all">Semua Perubahan</option>
                                    <option value="up">Hanya Saldo Naik (▲)</option>
                                    <option value="down">Hanya Saldo Turun (▼)</option>
                                    <option value="changed">Ada Perubahan (Naik/Turun)</option>
                                    <option value="same">Saldo Tetap (=)</option>
                                </select>
                            </div>

                            {/* Kelompok Akun */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Kelompok Akun
                                </label>
                                <select
                                    value={accountGroup}
                                    onChange={(e) => setAccountGroup(e.target.value)}
                                    className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="all">Semua Kelompok Akun (1-9)</option>
                                    <option value="1">1 - Aset</option>
                                    <option value="2">2 - Liabilitas</option>
                                    <option value="3">3 - Ekuitas</option>
                                    <option value="4">4 - Pendapatan</option>
                                    <option value="5">5 - Biaya Operasional</option>
                                    <option value="6">6 - Harga Pokok Penjualan (HPP)</option>
                                    <option value="7">7 - Pendapatan Lain-lain</option>
                                    <option value="8">8 - Beban Lain-lain</option>
                                </select>
                            </div>

                            {/* Search */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Pencarian Akun
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Cari kode atau nama akun..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="h-9 pl-9 rounded-xl border-sidebar-border/80 text-xs bg-background"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ─── Mode Standar Filter Ribbon ─── */
                    <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Jenis Periode */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Jenis Periode
                                </label>
                                <select
                                    value={periodType}
                                    onChange={(e) => {
                                        const t = e.target.value;
                                        setPeriodType(t);
                                        if (t === 'year') setPeriod(defaultYear || (yearOptions[0] ?? ''));
                                        else if (t === 'month') setPeriod(defaultPeriod || (periodOptions[0] ?? ''));
                                        else setPeriod('');
                                    }}
                                    className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="month">Bulanan (YYYY-MM)</option>
                                    <option value="year">Tahunan (YYYY)</option>
                                    <option value="all">Semua Periode</option>
                                </select>
                            </div>

                            {/* Pilih Periode */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Periode
                                </label>
                                {periodType === 'month' ? (
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">Semua Bulan</option>
                                        {periodOptions.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {getPeriodLabel('month', opt)} ({opt})
                                            </option>
                                        ))}
                                    </select>
                                ) : periodType === 'year' ? (
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">Semua Tahun</option>
                                        {yearOptions.map((y) => (
                                            <option key={y} value={y}>
                                                Tahun {y}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-sidebar-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-medium">
                                        Seluruh data historis
                                    </div>
                                )}
                            </div>

                            {/* Kelompok Akun */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Kelompok Akun
                                </label>
                                <select
                                    value={accountGroup}
                                    onChange={(e) => setAccountGroup(e.target.value)}
                                    className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="all">Semua Kelompok Akun (1-9)</option>
                                    <option value="1">1 - Aset</option>
                                    <option value="2">2 - Liabilitas</option>
                                    <option value="3">3 - Ekuitas</option>
                                    <option value="4">4 - Pendapatan</option>
                                    <option value="5">5 - Biaya Operasional</option>
                                    <option value="6">6 - Harga Pokok Penjualan (HPP)</option>
                                    <option value="7">7 - Pendapatan Lain-lain</option>
                                    <option value="8">8 - Beban Lain-lain</option>
                                </select>
                            </div>

                            {/* Pencarian */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Pencarian Akun
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Cari kode atau nama akun..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="h-9 pl-9 rounded-xl border-sidebar-border/80 text-xs bg-background"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-3">
                        <AlertCircle className="size-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ─── 3. Executive Bento KPI Cards ──────────────────────────────── */}
                {isCompare ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                            {/* Card 1: Pergerakan Saldo Bersih */}
                            <div className="rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-background p-4 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-muted-foreground mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        Pergerakan Saldo Bersih
                                    </span>
                                    <Scale className="size-4 text-indigo-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            {activePeriodLabels[0]?.label || 'Awal'}:
                                        </span>
                                        <span className="text-xs font-mono font-semibold text-foreground">
                                            {formatRupiah(summary.total_saldo_start)}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            {activePeriodLabels[activePeriodLabels.length - 1]?.label || 'Akhir'}:
                                        </span>
                                        <span className="text-sm font-mono font-black text-indigo-600 dark:text-indigo-400">
                                            {formatRupiah(summary.total_saldo_end)}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t border-sidebar-border/60 flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                            Pergeseran Bersih
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-0.5 text-xs font-mono font-extrabold px-1.5 py-0.5 rounded-lg ${
                                                summary.total_diff_nominal > 0
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                    : summary.total_diff_nominal < 0
                                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {summary.total_diff_nominal > 0 ? '+' : ''}
                                            {formatRupiah(summary.total_diff_nominal)} ({summary.total_diff_percent > 0 ? '+' : ''}
                                            {summary.total_diff_percent}%)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Total Aset (Prefix 1) */}
                            <div className="rounded-3xl border border-blue-500/20 bg-card p-4 shadow-xs space-y-2">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        Total Aset (Prefix 1)
                                    </span>
                                    <Building2 className="size-4 text-blue-500" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline justify-between text-xs">
                                        <span className="text-muted-foreground">{activePeriodLabels[0]?.label}:</span>
                                        <span className="font-mono font-semibold">{formatRupiah(summary.total_aset_1)}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-xs">
                                        <span className="text-muted-foreground">{activePeriodLabels[activePeriodLabels.length - 1]?.label}:</span>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatRupiah(summary.total_aset_2)}</span>
                                    </div>
                                    <div className="pt-1.5 border-t border-sidebar-border/50 text-[11px] font-mono flex justify-between">
                                        <span className="text-muted-foreground">Selisih Aset:</span>
                                        <span className={`font-bold ${summary.diff_aset >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {summary.diff_aset > 0 ? '+' : ''}{formatRupiah(summary.diff_aset)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Liabilitas & Ekuitas (Prefix 2 & 3) */}
                            <div className="rounded-3xl border border-purple-500/20 bg-card p-4 shadow-xs space-y-2">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        Liabilitas &amp; Ekuitas
                                    </span>
                                    <CreditCard className="size-4 text-purple-500" />
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Liab. Akhir:</span>
                                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatRupiah(summary.total_liabilitas_2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ekuitas Akhir:</span>
                                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{formatRupiah(summary.total_ekuitas_2)}</span>
                                    </div>
                                    <div className="pt-1.5 border-t border-sidebar-border/50 text-[11px] font-mono flex justify-between">
                                        <span className="text-muted-foreground">Δ Liabilitas:</span>
                                        <span className="font-bold">{summary.diff_liabilitas > 0 ? '+' : ''}{formatRupiah(summary.diff_liabilitas)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Biaya Operasional (Prefix 5) */}
                            <div className="rounded-3xl border border-rose-500/20 bg-card p-4 shadow-xs space-y-2">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        Biaya Operasional (5)
                                    </span>
                                    <Wallet className="size-4 text-rose-500" />
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{activePeriodLabels[0]?.label}:</span>
                                        <span className="font-mono font-semibold">{formatRupiah(summary.total_biaya_operasional_1)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{activePeriodLabels[activePeriodLabels.length - 1]?.label}:</span>
                                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatRupiah(summary.total_biaya_operasional_2)}</span>
                                    </div>
                                    <div className="pt-1.5 border-t border-sidebar-border/50 text-[11px] font-mono flex justify-between">
                                        <span className="text-muted-foreground">Δ Beban Ops:</span>
                                        <span className="font-bold">{summary.diff_biaya_operasional > 0 ? '+' : ''}{formatRupiah(summary.diff_biaya_operasional)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: HPP (Prefix 6) & Dinamika Akun */}
                            <div className="rounded-3xl border border-orange-500/20 bg-card p-4 shadow-xs space-y-2">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        HPP (6) &amp; Dinamika
                                    </span>
                                    <BarChart3 className="size-4 text-orange-500" />
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total HPP Akhir:</span>
                                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{formatRupiah(summary.total_hpp_2)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-sidebar-border/50 text-[10px] font-bold">
                                        <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5">
                                            ▲ {summary.count_up ?? 0}
                                        </span>
                                        <span className="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 px-1.5 py-0.5">
                                            ▼ {summary.count_down ?? 0}
                                        </span>
                                        <span className="rounded-md bg-muted text-muted-foreground px-1.5 py-0.5">
                                            = {summary.count_same ?? 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Horizontal Timeline Summary across all chosen periods */}
                        {summary.period_totals && summary.period_totals.length > 2 && (
                            <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-3 flex flex-wrap items-center gap-2 overflow-x-auto text-xs">
                                <span className="font-bold text-muted-foreground text-[11px] uppercase mr-2 flex items-center gap-1">
                                    <Activity className="size-3.5 text-indigo-500" />
                                    Tren Saldo Antar Periode:
                                </span>
                                {summary.period_totals.map((pt, i) => (
                                    <div key={pt.period} className="flex items-center gap-2">
                                        <div className="flex flex-col bg-background/80 border border-sidebar-border/70 rounded-xl px-2.5 py-1">
                                            <span className="text-[10px] text-muted-foreground font-semibold">{pt.label}</span>
                                            <span className="font-mono font-bold text-foreground text-xs">{formatRupiah(pt.total_saldo)}</span>
                                        </div>
                                        {i < summary.period_totals.length - 1 && (
                                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ─── Mode Standar Bento KPI Cards ─── */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                        <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between text-muted-foreground mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Total Akun Terdaftar</span>
                                <Layers className="size-4 text-indigo-500" />
                            </div>
                            <div className="text-xl font-black text-foreground">{formatNumber(total)} Akun</div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                                {formatNumber(summary.adjusted_count ?? 0)} akun memiliki AJP
                            </div>
                        </div>

                        <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between text-muted-foreground mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Total Saldo Awal</span>
                                <Wallet className="size-4 text-blue-500" />
                            </div>
                            <div className="text-lg font-black font-mono text-foreground">{formatRupiah(summary.total_saldo_awal)}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">Snapshot NABB Rekap</div>
                        </div>

                        <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between text-muted-foreground mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Jurnal Penyesuaian</span>
                                <ArrowLeftRight className="size-4 text-amber-500" />
                            </div>
                            <div className="text-xs font-mono font-bold text-rose-600">
                                Debit: -{formatRupiah(summary.total_ajp_debit)}
                            </div>
                            <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                                Kredit: +{formatRupiah(summary.total_ajp_kredit)}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between text-muted-foreground mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Total Saldo Akhir</span>
                                <Scale className="size-4 text-emerald-500" />
                            </div>
                            <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                                {formatRupiah(summary.total_saldo)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1">Saldo Disesuaikan AJP</div>
                        </div>

                        <div className="rounded-3xl border border-sidebar-border/70 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between text-muted-foreground mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Status Neraca</span>
                                {summary.is_balanced ? (
                                    <ShieldCheck className="size-4 text-emerald-500" />
                                ) : (
                                    <ShieldAlert className="size-4 text-rose-500" />
                                )}
                            </div>
                            <div className={`text-sm font-bold ${summary.is_balanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {summary.is_balanced ? 'Neraca Seimbang (Balance)' : 'Selisih Terdeteksi'}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-1">
                                Δ {formatRupiah(summary.selisih_neraca)}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── 4. Main Data Table ────────────────────────────────────────── */}
                <div className="rounded-3xl border border-sidebar-border/70 bg-card shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        {isCompare ? (
                            /* ─── TABEL KOMPARASI DINAMIS ─── */
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-sidebar-border/60 bg-muted/40 text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                                        <th className="py-3 px-1.5 w-10 text-center whitespace-nowrap">No</th>
                                        <th
                                            className="py-3 px-2 w-24 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                                            onClick={() => handleSort('Kode_Akun')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Kode Akun</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th className="py-3 px-1.5 w-20 text-center whitespace-nowrap">Kategori</th>
                                        <th
                                            className="py-3 px-3 min-w-[240px] whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                                            onClick={() => handleSort('Nama_Akun')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Nama Akun</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>

                                        {/* Dynamic Period Headers */}
                                        {activePeriodsList.map((p, idx) => {
                                            const label = getPeriodLabel(compareType, p);
                                            return (
                                                <th
                                                    key={p}
                                                    className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:text-foreground transition-colors min-w-[130px]"
                                                    onClick={() => handleSort(`Saldo_${idx}`)}
                                                >
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <span>{label}</span>
                                                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                                    </div>
                                                </th>
                                            );
                                        })}

                                        <th
                                            className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:text-foreground transition-colors min-w-[130px]"
                                            onClick={() => handleSort('Diff_Nominal')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>Selisih Total (Rp)</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:text-foreground transition-colors min-w-[85px]"
                                            onClick={() => handleSort('Diff_Percent')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>% Ubah</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th className="py-3 px-3 text-center whitespace-nowrap w-16">Buku Besar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/40">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={activePeriodsList.length + 7} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <RefreshCw className="size-6 animate-spin text-indigo-500" />
                                                    <span className="text-xs font-semibold">Memuat data komparasi dinamis...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={activePeriodsList.length + 7} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Layers className="size-8 text-muted-foreground/40" />
                                                    <span className="text-xs font-medium">Tidak ada data akun pada periode yang dipilih.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, idx) => {
                                            const cat = getAccountCategory(row.Kode_Akun);
                                            const diff = Number(row.Diff_Nominal || 0);
                                            const diffPct = Number(row.Diff_Percent || 0);
                                            const isUp = diff > 0;
                                            const isDown = diff < 0;
                                            const isExpanded = Boolean(expandedRows[row.Kode_Akun]);

                                            return (
                                                <Fragment key={row.Kode_Akun || idx}>
                                                    <tr className="hover:bg-muted/30 transition-colors group">
                                                        <td className="py-2.5 px-1.5 text-center text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                                                            {(page - 1) * (pageSize === 'all' ? 0 : Number(pageSize)) + idx + 1}
                                                        </td>
                                                        <td className="py-2.5 px-2 font-mono font-bold text-foreground whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleRowDetail(row.Kode_Akun)}
                                                                    className={`size-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                                                        isExpanded
                                                                            ? 'bg-indigo-600 text-white shadow-xs'
                                                                            : 'bg-muted hover:bg-indigo-500/15 text-muted-foreground hover:text-indigo-600'
                                                                    }`}
                                                                    title={isExpanded ? 'Tutup Rincian AJP' : 'Buka Rincian AJP'}
                                                                >
                                                                    <ChevronRight
                                                                        className={`size-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                                    />
                                                                </button>
                                                                <span>{row.Kode_Akun}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold border ${cat.badge}`}>
                                                                {cat.name}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-medium text-foreground min-w-[240px] whitespace-nowrap">
                                                            {row.Nama_Akun || '-'}
                                                        </td>

                                                        {/* Dynamic Period Columns */}
                                                        {activePeriodsList.map((p, pIdx) => {
                                                            const saldoVal = row[`Saldo_${pIdx}`];
                                                            return (
                                                                <td key={p} className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                                                                    {formatRupiah(saldoVal)}
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Selisih Total */}
                                                        <td
                                                            className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${
                                                                isUp
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : isDown
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {isUp ? '+' : ''}
                                                            {formatRupiah(diff)}
                                                        </td>

                                                        {/* % Perubahan */}
                                                        <td
                                                            className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${
                                                                isUp
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : isDown
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {isUp ? '+' : ''}
                                                            {diffPct.toFixed(2)}%
                                                        </td>

                                                        {/* Buku Besar Link */}
                                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                            <Link
                                                                href={`/laporan/buku-besar?kodeAkun=${encodeURIComponent(row.Kode_Akun)}`}
                                                                className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                                                title="Buka Buku Besar Akun Ini"
                                                            >
                                                                <BookOpen className="size-3.5" />
                                                            </Link>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Sub-Row: Rincian AJP per Periode */}
                                                    {isExpanded && (
                                                        <tr className="bg-muted/20">
                                                            <td colSpan={activePeriodsList.length + 7} className="p-3 pl-12">
                                                                <div className="rounded-2xl border border-indigo-500/20 bg-background/95 p-3.5 space-y-2">
                                                                    <div className="flex items-center justify-between text-xs font-bold text-foreground pb-2 border-b border-sidebar-border/50">
                                                                        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                                                            <Activity className="size-3.5" />
                                                                            Rincian Saldo Awal &amp; Penyesuaian AJP: {row.Kode_Akun} - {row.Nama_Akun}
                                                                        </span>
                                                                        <span className="text-[11px] text-muted-foreground font-mono">
                                                                            Formula: Saldo Awal - (Debit - Kredit)
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                                                                        {activePeriodsList.map((p, pIdx) => {
                                                                            const pLabel = getPeriodLabel(compareType, p);
                                                                            const sAwal = Number(row[`Saldo_Awal_${pIdx}`] ?? row[`saldo_awal_${pIdx}`] ?? 0);
                                                                            const ajpDeb = Number(row[`Ajp_Debit_${pIdx}`] ?? row[`ajp_debit_${pIdx}`] ?? 0);
                                                                            const ajpKre = Number(row[`Ajp_Kredit_${pIdx}`] ?? row[`ajp_kredit_${pIdx}`] ?? 0);
                                                                            const sAkhir = Number(row[`Saldo_${pIdx}`] ?? row[`saldo_${pIdx}`] ?? 0);
                                                                            const hasAjp = ajpDeb > 0 || ajpKre > 0;
                                                                            const ajpNet = ajpKre - ajpDeb;

                                                                            return (
                                                                                <div key={p} className="rounded-xl border border-sidebar-border/70 p-2.5 bg-muted/30 space-y-1.5">
                                                                                    <div className="flex items-center justify-between text-[11px] font-bold text-foreground border-b border-sidebar-border/40 pb-1">
                                                                                        <span>{pLabel}</span>
                                                                                        {hasAjp ? (
                                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                                                                                                Ada AJP
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/80 text-muted-foreground font-normal">
                                                                                                Rp 0 (Tanpa AJP)
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex justify-between text-[11px] text-muted-foreground">
                                                                                        <span>Saldo Awal:</span>
                                                                                        <span className="font-mono font-medium text-foreground">{formatRupiah(sAwal)}</span>
                                                                                    </div>
                                                                                    <div className={`flex justify-between text-[11px] ${ajpDeb > 0 ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}`}>
                                                                                        <span>AJP Debit (-):</span>
                                                                                        <span className="font-mono">{formatRupiah(ajpDeb)}</span>
                                                                                    </div>
                                                                                    <div className={`flex justify-between text-[11px] ${ajpKre > 0 ? 'text-blue-600 font-semibold' : 'text-muted-foreground'}`}>
                                                                                        <span>AJP Kredit (+):</span>
                                                                                        <span className="font-mono">{formatRupiah(ajpKre)}</span>
                                                                                    </div>
                                                                                    {hasAjp && (
                                                                                        <div className="flex justify-between text-[10px] text-muted-foreground italic bg-background/60 px-1.5 py-0.5 rounded border border-sidebar-border/30">
                                                                                            <span>Penyesuaian:</span>
                                                                                            <span className={`font-mono font-bold ${ajpNet > 0 ? 'text-blue-600' : ajpNet < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                                                                {ajpNet > 0 ? `+${formatRupiah(ajpNet)}` : ajpNet < 0 ? `-${formatRupiah(Math.abs(ajpNet))}` : 'Rp 0'}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="flex justify-between text-[11px] font-bold text-emerald-600 border-t border-sidebar-border/40 pt-1">
                                                                                        <span>Saldo Akhir:</span>
                                                                                        <span className="font-mono">{formatRupiah(sAkhir)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })
                                    )}
                                </tbody>

                                {/* Footer Row */}
                                {rows.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-sidebar-border/80 bg-muted/60 text-xs font-black">
                                            <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                                Total Ringkasan:
                                            </td>

                                            {/* Dynamic Period Totals */}
                                            {activePeriodsList.map((p, pIdx) => {
                                                const pTot = summary.period_totals?.[pIdx]?.total_saldo ?? 0;
                                                return (
                                                    <td key={p} className="py-3 px-3 text-right font-mono text-foreground font-black whitespace-nowrap">
                                                        {formatRupiah(pTot)}
                                                    </td>
                                                );
                                            })}

                                            {/* Total Net Shift */}
                                            <td
                                                className={`py-3 px-3 text-right font-mono font-black whitespace-nowrap ${
                                                    summary.total_diff_nominal >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {summary.total_diff_nominal > 0 ? '+' : ''}
                                                {formatRupiah(summary.total_diff_nominal)}
                                            </td>
                                            <td
                                                className={`py-3 px-3 text-right font-mono font-black whitespace-nowrap ${
                                                    summary.total_diff_percent >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {summary.total_diff_percent > 0 ? '+' : ''}
                                                {summary.total_diff_percent}%
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        ) : (
                            /* ─── TABEL STANDAR 1 PERIODE ─── */
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-sidebar-border/60 bg-muted/40 text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                                        <th className="py-3 px-1.5 w-10 text-center whitespace-nowrap">No</th>
                                        <th
                                            className="py-3 px-2 w-24 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                                            onClick={() => handleSort('Kode_Akun')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Kode Akun</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th className="py-3 px-1.5 w-20 text-center whitespace-nowrap">Kategori</th>
                                        <th
                                            className="py-3 px-3 min-w-[240px] cursor-pointer hover:text-foreground transition-colors"
                                            onClick={() => handleSort('Nama_Akun')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Nama Akun</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-28 min-w-[105px]"
                                            onClick={() => handleSort('Saldo_Awal')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>Saldo Awal</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-28 min-w-[105px]"
                                            onClick={() => handleSort('Ajp_Debit')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>AJP Debit (-)</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-28 min-w-[105px]"
                                            onClick={() => handleSort('Ajp_Kredit')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>AJP Kredit (+)</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-28 min-w-[105px]"
                                            onClick={() => handleSort('Saldo')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>Saldo Akhir</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-28 min-w-[105px]"
                                            onClick={() => handleSort('Diff_Nominal')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>Selisih (Rp)</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th
                                            className="py-3 px-2 text-right cursor-pointer hover:text-foreground transition-colors w-20 min-w-[70px]"
                                            onClick={() => handleSort('Diff_Percent')}
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span>%</span>
                                                <ArrowUpDown className="size-3 text-muted-foreground/60" />
                                            </div>
                                        </th>
                                        <th className="py-3 px-2 text-center w-14">Buku Besar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/40">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <RefreshCw className="size-6 animate-spin text-indigo-500" />
                                                    <span className="text-xs font-semibold">Memuat data rekapitulasi...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Layers className="size-8 text-muted-foreground/40" />
                                                    <span className="text-xs font-medium">Tidak ada data akun pada filter yang dipilih.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, idx) => {
                                            const cat = getAccountCategory(row.Kode_Akun);
                                            const hasAjp = Number(row.Ajp_Debit || 0) > 0 || Number(row.Ajp_Kredit || 0) > 0;
                                            const sAwal = Number(row.Saldo_Awal || 0);
                                            const sAkhir = Number(row.Saldo || 0);
                                            const diff = row.Diff_Nominal !== undefined ? Number(row.Diff_Nominal) : (sAkhir - sAwal);
                                            const diffPct = row.Diff_Percent !== undefined
                                                ? Number(row.Diff_Percent)
                                                : (sAwal !== 0 ? (diff / Math.abs(sAwal)) * 100 : (diff !== 0 ? (diff > 0 ? 100 : -100) : 0));
                                            const isUp = diff > 0;
                                            const isDown = diff < 0;

                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`hover:bg-muted/30 transition-colors group ${
                                                        hasAjp ? 'bg-amber-500/5' : ''
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-1.5 text-center text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                                                        {(page - 1) * (pageSize === 'all' ? 0 : Number(pageSize)) + idx + 1}
                                                    </td>
                                                    <td className="py-2.5 px-2 font-mono font-bold text-foreground whitespace-nowrap">
                                                        {row.Kode_Akun}
                                                    </td>
                                                    <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold border ${cat.badge}`}>
                                                            {cat.name}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-medium text-foreground min-w-[240px]">
                                                        {row.Nama_Akun || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                                                        {formatRupiah(row.Saldo_Awal)}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-semibold whitespace-nowrap">
                                                        {Number(row.Ajp_Debit || 0) > 0 ? (
                                                             <span className="text-rose-600 dark:text-rose-400">{formatRupiah(row.Ajp_Debit)}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 font-normal">Rp 0</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-semibold whitespace-nowrap">
                                                        {Number(row.Ajp_Kredit || 0) > 0 ? (
                                                            <span className="text-blue-600 dark:text-blue-400">{formatRupiah(row.Ajp_Kredit)}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 font-normal">Rp 0</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                        {formatRupiah(row.Saldo)}
                                                    </td>
                                                    <td
                                                        className={`py-2.5 px-2 text-right font-mono font-bold text-xs whitespace-nowrap ${
                                                            isUp ? 'text-emerald-600 dark:text-emerald-400' : isDown ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                                                        }`}
                                                    >
                                                        {isUp ? '+' : ''}
                                                        {formatRupiah(diff)}
                                                    </td>
                                                    <td
                                                        className={`py-2.5 px-2 text-right font-mono font-bold text-xs whitespace-nowrap ${
                                                            isUp ? 'text-emerald-600 dark:text-emerald-400' : isDown ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                                                        }`}
                                                    >
                                                        {isUp ? '+' : ''}
                                                        {Number(diffPct).toFixed(2)}%
                                                    </td>
                                                    <td className="py-2.5 px-2 text-center">
                                                        <Link
                                                            href={`/laporan/buku-besar?kodeAkun=${encodeURIComponent(row.Kode_Akun)}`}
                                                            className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                                            title="Buka Buku Besar"
                                                        >
                                                            <BookOpen className="size-3.5" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>

                                {/* Footer Row */}
                                {rows.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-sidebar-border/80 bg-muted/60 text-xs font-black">
                                            <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                                Total Ringkasan:
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono text-foreground whitespace-nowrap">
                                                {formatRupiah(summary.total_saldo_awal)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                                {formatRupiah(summary.total_ajp_debit)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                {formatRupiah(summary.total_ajp_kredit)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {formatRupiah(summary.total_saldo)}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-right font-mono font-black whitespace-nowrap ${
                                                    (summary.total_diff_nominal ?? 0) >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {(summary.total_diff_nominal ?? 0) > 0 ? '+' : ''}
                                                {formatRupiah(summary.total_diff_nominal)}
                                            </td>
                                            <td
                                                className={`py-3 px-2 text-right font-mono font-black whitespace-nowrap ${
                                                    (summary.total_diff_percent ?? 0) >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {(summary.total_diff_percent ?? 0) > 0 ? '+' : ''}
                                                {Number(summary.total_diff_percent ?? 0).toFixed(2)}%
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-sidebar-border/60 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Tampilkan per halaman:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="rounded-lg border border-sidebar-border/80 bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-hidden"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="all">Semua ({total})</option>
                            </select>
                            <span>dari total {formatNumber(total)} akun</span>
                        </div>

                        {pageSize !== 'all' && totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="rounded-lg h-7 px-2.5 text-xs font-semibold"
                                >
                                    Sebelumnya
                                </Button>
                                <span className="px-2 text-xs font-bold text-foreground">
                                    Halaman {page} dari {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="rounded-lg h-7 px-2.5 text-xs font-semibold"
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
