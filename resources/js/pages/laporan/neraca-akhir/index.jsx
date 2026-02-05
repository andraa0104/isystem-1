import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertTriangle,
    CheckCircle2,
    Landmark,
    Loader2,
    Printer,
    Scale,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Neraca Akhir', href: '/laporan/neraca-akhir' },
];

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const formatNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
};

const getPeriodLabel = (periodType, period) => {
    if (periodType === 'year') {
        if (!period || !/^\d{4}$/.test(period)) return period || '';
        return `FY ${period} (Jan–Des)`;
    }

    if (!period || !/^\d{6}$/.test(period)) return period || '';
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(4, 6));
    const d = new Date(y, Math.max(0, m - 1), 1);
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
};

const buildPrintUrl = (query) => {
    const params = new URLSearchParams();
    params.set('periodType', query.periodType ?? 'month');
    params.set('period', query.period ?? '');
    params.set('search', query.search ?? '');
    params.set('sortBy', query.sortBy ?? 'Kode_Akun');
    params.set('sortDir', query.sortDir ?? 'asc');
    return `/laporan/neraca-akhir/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function StatCard({ label, value, accent = 'default', icon: Icon }) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-400'
            : accent === 'negative'
              ? 'text-rose-400'
              : 'text-white';

    return (
        <div className="rounded-2xl border border-white/10 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                    </div>
                    <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
                </div>
                {Icon ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                        <Icon className="h-5 w-5 text-white/70" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SectionHeaderRow({ title, subtitle }) {
    return (
        <tr className="bg-white/5">
            <td colSpan={3} className="px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/80">
                        {title}
                    </div>
                    {subtitle ? (
                        <div className="text-xs text-muted-foreground">{subtitle}</div>
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

function TotalRow({ label, value, emphasis = false }) {
    return (
        <tr className="border-t border-white/10 bg-black/20">
            <td className={`px-3 py-2 ${emphasis ? 'font-semibold' : 'text-muted-foreground'}`} colSpan={2}>
                {label}
            </td>
            <td className={`px-3 py-2 text-right ${emphasis ? 'font-semibold text-white' : 'text-white/80'}`}>
                {value}
            </td>
        </tr>
    );
}

function buildAiKpiMetrics({ summary }) {
    const totalAset = Number(summary?.total_aset ?? 0);
    const totalLiabilitas = Number(summary?.total_liabilitas ?? 0);
    const totalEkuitas = Number(summary?.total_ekuitas ?? 0);
    const selisih = Number(summary?.selisih ?? 0);

    const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
    const fmtPct = (v) =>
        new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(v);

    const liabilitiesRatio = safeDiv(totalLiabilitas, totalAset);
    const equityRatio = safeDiv(totalEkuitas, totalAset);
    const debtToEquity = safeDiv(totalLiabilitas, totalEkuitas);

    const absSelisih = Math.abs(selisih);
    const tolerance = Math.max(1, totalAset * 0.00001); // 0.001% of assets (min Rp 1)
    const isBalanced = absSelisih <= tolerance;

    return {
        totalAset,
        totalLiabilitas,
        totalEkuitas,
        selisih,
        isBalanced,
        chips: [
            { label: 'Liability Ratio', value: fmtPct(liabilitiesRatio) },
            { label: 'Equity Ratio', value: fmtPct(equityRatio) },
            { label: 'Debt/Equity', value: debtToEquity === 0 ? '0.00' : debtToEquity.toFixed(2) },
            { label: 'Selisih', value: formatRupiah(selisih) },
        ],
    };
}

function buildAiKpiInsights({ metrics }) {
    const insights = [];

    if (metrics.totalAset === 0) {
        insights.push('Total aset masih Rp 0 pada snapshot ini; pastikan proses posting/closing sudah dijalankan.');
        return insights;
    }

    if (metrics.isBalanced) {
        insights.push('Neraca seimbang: Aset ≈ Liabilitas + Ekuitas (selisih dalam batas toleransi).');
    } else {
        insights.push('Neraca tidak seimbang: selisih Aset vs (Liabilitas + Ekuitas) perlu dicek (posting/closing/jurnal).');
    }

    const liabilitiesRatio = metrics.totalAset === 0 ? 0 : metrics.totalLiabilitas / metrics.totalAset;
    const equityRatio = metrics.totalAset === 0 ? 0 : metrics.totalEkuitas / metrics.totalAset;

    if (liabilitiesRatio >= 0.7) {
        insights.push('Komposisi pendanaan didominasi liabilitas (leverage tinggi). Pertimbangkan kontrol utang dan arus kas.');
    } else if (liabilitiesRatio >= 0.5) {
        insights.push('Liabilitas cukup signifikan terhadap total aset. Pastikan jadwal jatuh tempo dan kemampuan bayar terjaga.');
    } else {
        insights.push('Struktur pendanaan relatif konservatif (liabilitas < 50% aset).');
    }

    if (equityRatio >= 0.5) {
        insights.push('Ekuitas kuat (≥ 50% aset), umumnya memberi buffer risiko yang lebih baik.');
    }

    if (metrics.totalEkuitas === 0 && metrics.totalLiabilitas > 0) {
        insights.push('Ekuitas 0 namun liabilitas ada; periksa pemetaan akun ekuitas (prefix 3) atau saldo laba ditahan.');
    }

    return insights;
}

export default function NeracaAkhirIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod = '',
        yearOptions = [],
        defaultYear = '',
    } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_aset: 0,
        total_liabilitas: 0,
        total_ekuitas: 0,
        selisih: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(
        initialQuery?.period ?? (periodType === 'year' ? defaultYear ?? '' : defaultPeriod ?? ''),
    );
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Kode_Akun');
    const [sortDir, setSortDir] = useState((initialQuery?.sortDir ?? 'asc').toLowerCase());
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all'
            ? 'all'
            : Number(initialQuery?.pageSize ?? 10) || 10,
    );
    const [page, setPage] = useState(1);
    const [effectivePeriod, setEffectivePeriod] = useState('');
    const [effectivePeriodLabel, setEffectivePeriodLabel] = useState('');

    const latestMonthForYear = (year) => {
        if (!year || !/^\d{4}$/.test(year)) return '';
        const hit = periodOptions.find((p) => String(p).startsWith(String(year)));
        return hit ? String(hit) : '';
    };

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, sortBy, sortDir, period, periodType]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', periodType);
            params.set('period', period);
            params.set('search', debouncedSearch);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));

            const res = await fetch(`/laporan/neraca-akhir/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = String(data?.error ?? 'Gagal memuat data.');
                setError(msg);
                throw new Error(msg);
            }

            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
            setSummary({
                total_aset: Number(data?.summary?.total_aset ?? 0),
                total_liabilitas: Number(data?.summary?.total_liabilitas ?? 0),
                total_ekuitas: Number(data?.summary?.total_ekuitas ?? 0),
                selisih: Number(data?.summary?.selisih ?? 0),
            });
            setEffectivePeriod(String(data?.effective_period ?? ''));
            setEffectivePeriodLabel(String(data?.effective_period_label ?? ''));
        } catch {
            setRows([]);
            setTotal(0);
            setSummary({ total_aset: 0, total_liabilitas: 0, total_ekuitas: 0, selisih: 0 });
            setEffectivePeriod('');
            setEffectivePeriodLabel('');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodType, period, debouncedSearch, pageSize, page, sortBy, sortDir]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const printUrl = buildPrintUrl({ periodType, period, search: debouncedSearch, sortBy, sortDir });

    const selisihAccent = summary.selisih === 0 ? 'positive' : 'negative';

    const sections = useMemo(() => {
        const aset = rows.filter((r) => r?.side === 'aset');
        const liabilitas = rows.filter((r) => r?.side === 'liabilitas');
        const ekuitas = rows.filter((r) => r?.side === 'ekuitas');
        return { aset, liabilitas, ekuitas };
    }, [rows]);

    const aiMetrics = useMemo(() => buildAiKpiMetrics({ summary }), [summary]);
    const aiInsights = useMemo(() => buildAiKpiInsights({ metrics: aiMetrics }), [aiMetrics]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Neraca Akhir" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                                <Landmark className="h-5 w-5 text-white/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Neraca Akhir</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Posisi aset, liabilitas, dan ekuitas pada akhir periode (periodik)
                        </p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                            Periode:{' '}
                            <span className="text-white/80">{getPeriodLabel(periodType, period)}</span>
                            {periodType === 'month' && period ? (
                                <span className="text-white/60">({period})</span>
                            ) : periodType === 'month' ? (
                                <span className="text-white/60">(-)</span>
                            ) : null}
                            {periodType === 'year' && period ? (
                                <span className="text-white/60">({period})</span>
                            ) : null}
                            {periodType === 'year' && effectivePeriod ? (
                                <span className="text-white/60">
                                    • Posisi: {effectivePeriodLabel || effectivePeriod} ({effectivePeriod})
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Mode</span>
                        <Select
                            value={periodType}
                            onValueChange={(val) => {
                                const next = val === 'year' ? 'year' : 'month';
                                setPeriodType(next);
                                if (next === 'year') {
                                    const y = /^\d{6}$/.test(String(period))
                                        ? String(period).slice(0, 4)
                                        : /^\d{4}$/.test(String(period))
                                          ? String(period)
                                          : String(defaultYear || '').slice(0, 4);
                                    setPeriod(y || defaultYear || '');
                                } else {
                                    const y = /^\d{4}$/.test(String(period))
                                        ? String(period)
                                        : /^\d{6}$/.test(String(period))
                                          ? String(period).slice(0, 4)
                                          : '';
                                    const p = latestMonthForYear(y) || defaultPeriod || '';
                                    setPeriod(p);
                                }
                            }}
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Per Bulan</SelectItem>
                                <SelectItem value="year">Per Tahun</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Periode</span>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {periodType === 'year' ? (
                                    yearOptions.length === 0 ? (
                                        <SelectItem value={period || ''}>{period || '-'}</SelectItem>
                                    ) : (
                                        yearOptions.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {getPeriodLabel('year', y)}
                                            </SelectItem>
                                        ))
                                    )
                                ) : periodOptions.length === 0 ? (
                                    <SelectItem value={period || ''}>{period || '-'}</SelectItem>
                                ) : (
                                    periodOptions.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {getPeriodLabel('month', p)} ({p})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>

                        <Button asChild variant="outline">
                            <a href={printUrl} target="_blank" rel="noreferrer">
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                            </a>
                        </Button>

                        <span className="text-sm text-muted-foreground">Urut</span>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Kode_Akun">Kode Akun</SelectItem>
                                <SelectItem value="Nama_Akun">Nama Akun</SelectItem>
                                <SelectItem value="Amount">Amount</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortDir} onValueChange={setSortDir}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asc">Asc</SelectItem>
                                <SelectItem value="desc">Desc</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Tampil</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) => setPageSize(val === 'all' ? 'all' : Number(val))}
                        >
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="all">Semua</SelectItem>
                            </SelectContent>
                        </Select>

                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari Kode / Nama Akun..."
                            className="w-full sm:w-80"
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total Aset" value={formatRupiah(summary.total_aset)} icon={Scale} />
                    <StatCard label="Total Liabilitas" value={formatRupiah(summary.total_liabilitas)} icon={TrendingDown} />
                    <StatCard label="Total Ekuitas" value={formatRupiah(summary.total_ekuitas)} icon={TrendingUp} />
                    <StatCard label="Selisih (Aset - (L+E))" value={formatRupiah(summary.selisih)} accent={selisihAccent} />
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                    <div className="border-b border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                                    <Sparkles className="h-5 w-5 text-white/80" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold">AI Summary KPI</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        Penilaian otomatis (rule-based)
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div
                                    className={[
                                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                                        aiMetrics.isBalanced
                                            ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-200 ring-rose-500/20',
                                    ].join(' ')}
                                >
                                    {aiMetrics.isBalanced ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                    )}
                                    {aiMetrics.isBalanced ? 'Balanced' : 'Mismatch'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Total aset:{' '}
                                    <span className="text-white/80">{formatRupiah(aiMetrics.totalAset)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {aiMetrics.chips.map((c) => (
                                <div
                                    key={c.label}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                                >
                                    <div className="text-xs text-muted-foreground">{c.label}</div>
                                    <div className="text-sm font-semibold text-white/90">{c.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4">
                        <ul className="space-y-2 text-sm">
                            {aiInsights.map((t, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                                    <span className="text-white/80">{t}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-200/80">
                            Sumber data menggunakan `tb_nabbrekap` (saldo akhir per akun per periode). Nama akun diambil dari `tb_nabb.Nama_Akun` bila tersedia.
                        </div>
                    </div>
                ) : null}

                <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                            </div>
                        </div>
                    )}

                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                            <tr>
                                <th className="px-3 py-3">Kode Akun</th>
                                <th className="px-3 py-3">Nama Akun</th>
                                <th className="px-3 py-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            ) : null}

                            <SectionHeaderRow title="Aset" subtitle="Prefix kode akun 1 (saldo normal debit)" />
                            {sections.aset.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`aset-${kodeAkun}-${idx}`}
                                        className={[
                                            'border-t border-white/5',
                                            has00 ? markedRowClass : '',
                                        ].join(' ')}
                                    >
                                        <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                            <div className="flex items-center gap-2">
                                                {has00 ? (
                                                    <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                                ) : null}
                                                <Link
                                                    href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30 hover:underline'
                                                            : 'text-amber-300 hover:underline'
                                                    }
                                                >
                                                    {kodeAkun}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 ring-1 ring-white/10">
                                                    lainnya
                                                </span>
                                            ) : null}
                                            {r?.is_anomaly ? (
                                                <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/30">
                                                    anomali
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                            {formatRupiah(r?.amount_display)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Aset" value={formatRupiah(summary.total_aset)} emphasis />

                            <SectionHeaderRow title="Liabilitas" subtitle="Prefix kode akun 2 (saldo normal kredit)" />
                            {sections.liabilitas.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`liab-${kodeAkun}-${idx}`}
                                        className={[
                                            'border-t border-white/5',
                                            has00 ? markedRowClass : '',
                                        ].join(' ')}
                                    >
                                        <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                            <div className="flex items-center gap-2">
                                                {has00 ? (
                                                    <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                                ) : null}
                                                <Link
                                                    href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30 hover:underline'
                                                            : 'text-amber-300 hover:underline'
                                                    }
                                                >
                                                    {kodeAkun}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 ring-1 ring-white/10">
                                                    lainnya
                                                </span>
                                            ) : null}
                                            {r?.is_anomaly ? (
                                                <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/30">
                                                    anomali
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                            {formatRupiah(r?.amount_display)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Liabilitas" value={formatRupiah(summary.total_liabilitas)} emphasis />

                            <SectionHeaderRow title="Ekuitas" subtitle="Prefix kode akun 3 (saldo normal kredit)" />
                            {sections.ekuitas.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`eq-${kodeAkun}-${idx}`}
                                        className={[
                                            'border-t border-white/5',
                                            has00 ? markedRowClass : '',
                                        ].join(' ')}
                                    >
                                        <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                            <div className="flex items-center gap-2">
                                                {has00 ? (
                                                    <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                                ) : null}
                                                <Link
                                                    href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30 hover:underline'
                                                            : 'text-amber-300 hover:underline'
                                                    }
                                                >
                                                    {kodeAkun}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 ring-1 ring-white/10">
                                                    lainnya
                                                </span>
                                            ) : null}
                                            {r?.is_anomaly ? (
                                                <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/30">
                                                    anomali
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                            {formatRupiah(r?.amount_display)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Ekuitas" value={formatRupiah(summary.total_ekuitas)} emphasis />
                            <TotalRow label="Selisih (Aset - (Liabilitas + Ekuitas))" value={formatRupiah(summary.selisih)} emphasis />
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>Total akun NA: {formatNumber(total)}</span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={page === 1 || loading || pageSize === 'all'}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Sebelumnya
                        </Button>
                        <span>
                            Halaman {page} / {totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={page >= totalPages || loading || pageSize === 'all'}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
