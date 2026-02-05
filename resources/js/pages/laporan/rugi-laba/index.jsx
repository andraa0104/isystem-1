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
import { BarChart3, Loader2, Printer, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Rugi Laba', href: '/laporan/rugi-laba' },
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
    return `/laporan/rugi-laba/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function StatCard({ label, value, accent = 'default' }) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-400'
            : accent === 'negative'
              ? 'text-rose-400'
              : 'text-white';

    return (
        <div className="rounded-2xl border border-white/10 bg-card p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
        </div>
    );
}

function buildKpiInsights({ summary }) {
    const pendapatan = Number(summary?.total_pendapatan ?? 0);
    const hpp = Number(summary?.total_hpp ?? 0);
    const bebanOps = Number(summary?.total_beban_operasional ?? 0);
    const labaKotor = Number(summary?.laba_kotor ?? 0);
    const labaUsaha = Number(summary?.laba_usaha ?? 0);
    const netLain = Number(summary?.total_lain_lain_net ?? 0);
    const labaBersih = Number(summary?.laba_bersih ?? 0);

    const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
    const grossMargin = safeDiv(labaKotor, pendapatan);
    const opMargin = safeDiv(labaUsaha, pendapatan);
    const netMargin = safeDiv(labaBersih, pendapatan);

    const fmtPct = (v) => `${new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(v)}`;

    const insights = [];

    if (pendapatan === 0) {
        insights.push('Pendapatan masih Rp 0 pada periode ini; pastikan akun pendapatan (prefix 4) sudah terisi di jurnal dan penyesuaian.');
        if (hpp !== 0 || bebanOps !== 0) {
            insights.push('Terdapat beban meskipun pendapatan nol; periksa mapping akun atau jurnal penutup/penyesuaian.');
        }
        return insights;
    }

    insights.push(`Gross margin: ${fmtPct(grossMargin)} (Laba Kotor / Pendapatan).`);
    insights.push(`Operating margin: ${fmtPct(opMargin)} (Laba Usaha / Pendapatan).`);
    insights.push(`Net margin: ${fmtPct(netMargin)} (Laba Bersih / Pendapatan).`);

    if (labaBersih > 0) {
        insights.push('Perusahaan dalam kondisi laba bersih.');
    } else if (labaBersih < 0) {
        insights.push('Perusahaan dalam kondisi rugi bersih; fokus evaluasi HPP dan beban operasional.');
    } else {
        insights.push('Laba bersih berada di titik impas (0).');
    }

    if (netLain !== 0) {
        insights.push(
            `Komponen lain-lain bersih ${netLain > 0 ? 'menambah' : 'mengurangi'} laba: ${formatRupiah(netLain)}.`,
        );
    }

    const hppRatio = safeDiv(hpp, pendapatan);
    const opexRatio = safeDiv(bebanOps, pendapatan);
    if (hppRatio >= 0.7) {
        insights.push(`HPP relatif tinggi: ${fmtPct(hppRatio)} dari pendapatan.`);
    }
    if (opexRatio >= 0.3) {
        insights.push(`Beban operasional relatif tinggi: ${fmtPct(opexRatio)} dari pendapatan.`);
    }

    return insights;
}

function buildKpiMetrics({ summary }) {
    const pendapatan = Number(summary?.total_pendapatan ?? 0);
    const hpp = Number(summary?.total_hpp ?? 0);
    const bebanOps = Number(summary?.total_beban_operasional ?? 0);
    const labaKotor = Number(summary?.laba_kotor ?? 0);
    const labaUsaha = Number(summary?.laba_usaha ?? 0);
    const netLain = Number(summary?.total_lain_lain_net ?? 0);
    const labaBersih = Number(summary?.laba_bersih ?? 0);

    const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
    const fmtPct = (v) =>
        new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(v);

    const grossMargin = safeDiv(labaKotor, pendapatan);
    const opMargin = safeDiv(labaUsaha, pendapatan);
    const netMargin = safeDiv(labaBersih, pendapatan);
    const hppRatio = safeDiv(hpp, pendapatan);
    const opexRatio = safeDiv(bebanOps, pendapatan);

    return {
        pendapatan,
        labaBersih,
        netLain,
        chips: [
            { label: 'Gross Margin', value: fmtPct(grossMargin) },
            { label: 'Op. Margin', value: fmtPct(opMargin) },
            { label: 'Net Margin', value: fmtPct(netMargin) },
            { label: 'Rasio HPP', value: fmtPct(hppRatio) },
            { label: 'Rasio Opex', value: fmtPct(opexRatio) },
            { label: 'Net Lain²', value: formatRupiah(netLain) },
        ],
    };
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

export default function RugiLabaIndex() {
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
        total_pendapatan: 0,
        total_hpp: 0,
        laba_kotor: 0,
        total_beban_operasional: 0,
        laba_usaha: 0,
        total_lain_lain_net: 0,
        laba_bersih: 0,
        drivers: {
            pendapatan: [],
            hpp: [],
            beban_operasional: [],
            pendapatan_lain: [],
            beban_lain: [],
        },
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showWaterfallDetail, setShowWaterfallDetail] = useState(false);

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

            const res = await fetch(`/laporan/rugi-laba/rows?${params.toString()}`, {
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
                total_pendapatan: Number(data?.summary?.total_pendapatan ?? 0),
                total_hpp: Number(data?.summary?.total_hpp ?? 0),
                laba_kotor: Number(data?.summary?.laba_kotor ?? 0),
                total_beban_operasional: Number(data?.summary?.total_beban_operasional ?? 0),
                laba_usaha: Number(data?.summary?.laba_usaha ?? 0),
                total_lain_lain_net: Number(data?.summary?.total_lain_lain_net ?? 0),
                laba_bersih: Number(data?.summary?.laba_bersih ?? 0),
                drivers: data?.summary?.drivers ?? {
                    pendapatan: [],
                    hpp: [],
                    beban_operasional: [],
                    pendapatan_lain: [],
                    beban_lain: [],
                },
            });
        } catch {
            setRows([]);
            setTotal(0);
            setSummary({
                total_pendapatan: 0,
                total_hpp: 0,
                laba_kotor: 0,
                total_beban_operasional: 0,
                laba_usaha: 0,
                total_lain_lain_net: 0,
                laba_bersih: 0,
                drivers: {
                    pendapatan: [],
                    hpp: [],
                    beban_operasional: [],
                    pendapatan_lain: [],
                    beban_lain: [],
                },
            });
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
    const labaBersihAccent = summary.laba_bersih > 0 ? 'positive' : summary.laba_bersih < 0 ? 'negative' : 'default';

    const sections = useMemo(() => {
        const pendapatan = rows.filter((r) => r?.group === 'pendapatan');
        const hpp = rows.filter((r) => r?.group === 'hpp');
        const bebanOps = rows.filter((r) => r?.group === 'beban_operasional');
        const pendapatanLain = rows.filter((r) => r?.subgroup === 'pendapatan_lain');
        const bebanLain = rows.filter((r) => r?.subgroup === 'beban_lain');

        return { pendapatan, hpp, bebanOps, pendapatanLain, bebanLain };
    }, [rows]);

    const kpiInsights = useMemo(() => buildKpiInsights({ summary }), [summary]);
    const kpiMetrics = useMemo(() => buildKpiMetrics({ summary }), [summary]);

    const wf = useMemo(() => {
        const pendapatan = Number(summary?.total_pendapatan ?? 0);
        const hpp = Number(summary?.total_hpp ?? 0);
        const labaKotor = Number(summary?.laba_kotor ?? 0);
        const opex = Number(summary?.total_beban_operasional ?? 0);
        const labaUsaha = Number(summary?.laba_usaha ?? 0);
        const lainNet = Number(summary?.total_lain_lain_net ?? 0);
        const labaBersih = Number(summary?.laba_bersih ?? 0);
        return [
            { label: 'Pendapatan', value: pendapatan, sign: '+' },
            { label: 'HPP', value: hpp, sign: '-' },
            { label: 'Laba Kotor', value: labaKotor, sign: '=' },
            { label: 'Beban Operasional', value: opex, sign: '-' },
            { label: 'Laba Usaha', value: labaUsaha, sign: '=' },
            { label: 'Lain-lain Bersih', value: lainNet, sign: lainNet >= 0 ? '+' : '-' },
            { label: 'Laba Bersih', value: labaBersih, sign: '=' },
        ];
    }, [summary]);

    const drivers = useMemo(() => summary?.drivers ?? {}, [summary]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Rugi Laba" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                                <BarChart3 className="h-5 w-5 text-white/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Rugi Laba</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Income statement periodik (Jurnal + Jurnal Detail + Jurnal Penyesuaian)
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
                    <StatCard label="Total Pendapatan" value={formatRupiah(summary.total_pendapatan)} />
                    <StatCard label="Laba Kotor" value={formatRupiah(summary.laba_kotor)} />
                    <StatCard label="Laba Usaha" value={formatRupiah(summary.laba_usaha)} />
                    <StatCard
                        label="Laba Bersih"
                        value={formatRupiah(summary.laba_bersih)}
                        accent={labaBersihAccent}
                    />
                </div>

                <div className="rounded-2xl border border-white/10 bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-white">Waterfall Laba Bersih</div>
                            <div className="text-xs text-muted-foreground">
                                Step-by-step + top drivers per bagian (akun penyumbang terbesar).
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowWaterfallDetail((v) => !v)}
                        >
                            {showWaterfallDetail ? 'Tutup' : 'Detail'}
                        </Button>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-sm">
                            <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-3 text-left">Step</th>
                                    <th className="px-3 py-3 text-right">Nilai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wf.map((s, idx) => {
                                    const isTotal = s.sign === '=';
                                    const accent =
                                        s.label === 'Laba Bersih'
                                            ? Number(summary?.laba_bersih ?? 0) >= 0
                                                ? 'text-emerald-300'
                                                : 'text-rose-300'
                                            : isTotal
                                              ? 'text-white'
                                              : s.sign === '-'
                                                ? 'text-rose-200'
                                                : 'text-emerald-200';
                                    return (
                                        <tr key={idx} className="border-t border-white/10">
                                            <td className="px-3 py-2">
                                                <span className="mr-2 inline-flex w-5 justify-center text-white/50">
                                                    {s.sign}
                                                </span>
                                                <span className={isTotal ? 'font-semibold text-white' : 'text-white/80'}>
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold ${accent}`}>
                                                {formatRupiah(s.value)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {showWaterfallDetail ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5">
                                <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                                    Top Pendapatan
                                </div>
                                <div className="divide-y divide-white/10">
                                    {(drivers?.pendapatan ?? []).length ? (
                                        drivers.pendapatan.map((d, i) => (
                                            <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                                                <div className="min-w-0">
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun: d.Kode_Akun, periodType, period })}
                                                        className="text-sm font-semibold text-amber-300 hover:underline"
                                                    >
                                                        {d.Kode_Akun}
                                                    </Link>
                                                    <div className="truncate text-xs text-muted-foreground">{d.Nama_Akun}</div>
                                                </div>
                                                <div className="text-right text-sm font-semibold text-emerald-300">
                                                    {formatRupiah(d.amount)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5">
                                <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                                    Top HPP
                                </div>
                                <div className="divide-y divide-white/10">
                                    {(drivers?.hpp ?? []).length ? (
                                        drivers.hpp.map((d, i) => (
                                            <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                                                <div className="min-w-0">
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun: d.Kode_Akun, periodType, period })}
                                                        className="text-sm font-semibold text-amber-300 hover:underline"
                                                    >
                                                        {d.Kode_Akun}
                                                    </Link>
                                                    <div className="truncate text-xs text-muted-foreground">{d.Nama_Akun}</div>
                                                </div>
                                                <div className="text-right text-sm font-semibold text-rose-300">
                                                    {formatRupiah(d.amount)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5">
                                <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                                    Top Beban Operasional
                                </div>
                                <div className="divide-y divide-white/10">
                                    {(drivers?.beban_operasional ?? []).length ? (
                                        drivers.beban_operasional.map((d, i) => (
                                            <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                                                <div className="min-w-0">
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun: d.Kode_Akun, periodType, period })}
                                                        className="text-sm font-semibold text-amber-300 hover:underline"
                                                    >
                                                        {d.Kode_Akun}
                                                    </Link>
                                                    <div className="truncate text-xs text-muted-foreground">{d.Nama_Akun}</div>
                                                </div>
                                                <div className="text-right text-sm font-semibold text-rose-300">
                                                    {formatRupiah(d.amount)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5">
                                <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                                    Top Lain-lain
                                </div>
                                <div className="divide-y divide-white/10">
                                    {((drivers?.pendapatan_lain ?? []).length || (drivers?.beban_lain ?? []).length) ? (
                                        <>
                                            {(drivers?.pendapatan_lain ?? []).map((d, i) => (
                                                <div key={`pl-${i}`} className="flex items-start justify-between gap-3 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={buildBukuBesarUrl({ kodeAkun: d.Kode_Akun, periodType, period })}
                                                            className="text-sm font-semibold text-amber-300 hover:underline"
                                                        >
                                                            {d.Kode_Akun}
                                                        </Link>
                                                        <div className="truncate text-xs text-muted-foreground">{d.Nama_Akun}</div>
                                                        <div className="text-[11px] text-emerald-300/80">Pendapatan lain</div>
                                                    </div>
                                                    <div className="text-right text-sm font-semibold text-emerald-300">
                                                        {formatRupiah(d.amount)}
                                                    </div>
                                                </div>
                                            ))}
                                            {(drivers?.beban_lain ?? []).map((d, i) => (
                                                <div key={`bl-${i}`} className="flex items-start justify-between gap-3 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={buildBukuBesarUrl({ kodeAkun: d.Kode_Akun, periodType, period })}
                                                            className="text-sm font-semibold text-amber-300 hover:underline"
                                                        >
                                                            {d.Kode_Akun}
                                                        </Link>
                                                        <div className="truncate text-xs text-muted-foreground">{d.Nama_Akun}</div>
                                                        <div className="text-[11px] text-rose-300/80">Beban lain</div>
                                                    </div>
                                                    <div className="text-right text-sm font-semibold text-rose-300">
                                                        {formatRupiah(d.amount)}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                    <div className="border-b border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                                    <Sparkles className="h-5 w-5 text-white/80" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold">Ringkasan KPI</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        Insight otomatis (rule-based)
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div
                                    className={[
                                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                                        kpiMetrics.labaBersih >= 0
                                            ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-200 ring-rose-500/20',
                                    ].join(' ')}
                                >
                                    {kpiMetrics.labaBersih >= 0 ? (
                                        <TrendingUp className="h-3.5 w-3.5" />
                                    ) : (
                                        <TrendingDown className="h-3.5 w-3.5" />
                                    )}
                                    {kpiMetrics.labaBersih >= 0 ? 'Profit' : 'Loss'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Pendapatan: <span className="text-white/80">{formatRupiah(kpiMetrics.pendapatan)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {kpiMetrics.chips.map((c) => (
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
                            {kpiInsights.map((t, i) => (
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
                            Sumber: `tb_jurnal` + `tb_jurnaldetail` (transaksi) + `tb_jurnalpenyesuaian` (AJP). Nama akun diambil dari `tb_nabb.Nama_Akun` bila tersedia.
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
                                <th className="px-3 py-3 text-right">Jumlah</th>
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

                            <SectionHeaderRow title="Pendapatan" subtitle="Kode akun prefix 4" />
                            {sections.pendapatan.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`pendapatan-${kodeAkun}-${idx}`}
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
                                                <span
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                            : ''
                                                    }
                                                >
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                        className={has00 ? '' : 'text-amber-300 hover:underline'}
                                                    >
                                                        {kodeAkun}
                                                    </Link>
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
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
                            <TotalRow label="Total Pendapatan" value={formatRupiah(summary.total_pendapatan)} emphasis />

                            <SectionHeaderRow title="Harga Pokok Penjualan (HPP)" subtitle="Kode akun prefix 5" />
                            {sections.hpp.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`hpp-${kodeAkun}-${idx}`}
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
                                                <span
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                            : ''
                                                    }
                                                >
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                        className={has00 ? '' : 'text-amber-300 hover:underline'}
                                                    >
                                                        {kodeAkun}
                                                    </Link>
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
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
                            <TotalRow label="Total HPP" value={formatRupiah(summary.total_hpp)} emphasis />
                            <TotalRow label="Laba Kotor" value={formatRupiah(summary.laba_kotor)} emphasis />

                            <SectionHeaderRow title="Beban Operasional" subtitle="Kode akun prefix 6" />
                            {sections.bebanOps.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`ops-${kodeAkun}-${idx}`}
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
                                                <span
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                            : ''
                                                    }
                                                >
                                                    <Link
                                                        href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                        className={has00 ? '' : 'text-amber-300 hover:underline'}
                                                    >
                                                        {kodeAkun}
                                                    </Link>
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
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
                            <TotalRow
                                label="Total Beban Operasional"
                                value={formatRupiah(summary.total_beban_operasional)}
                                emphasis
                            />
                            <TotalRow label="Laba Usaha" value={formatRupiah(summary.laba_usaha)} emphasis />

                            {(sections.pendapatanLain.length > 0 || sections.bebanLain.length > 0) ? (
                                <>
                                    <SectionHeaderRow title="Pendapatan Lain-lain" subtitle="Kode akun prefix 7 / lainnya (net positif)" />
                                    {sections.pendapatanLain.map((r, idx) => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        return (
                                            <tr
                                                key={`lain-in-${kodeAkun}-${idx}`}
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
                                                        <span
                                                            className={
                                                                has00
                                                                    ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                                    : ''
                                                            }
                                                        >
                                                            <Link
                                                                href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                                className={has00 ? '' : 'text-amber-300 hover:underline'}
                                                            >
                                                                {kodeAkun}
                                                            </Link>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                                    {formatRupiah(r?.amount_display)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    <SectionHeaderRow title="Beban Lain-lain" subtitle="Kode akun prefix 7 / lainnya (net negatif)" />
                                    {sections.bebanLain.map((r, idx) => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        return (
                                            <tr
                                                key={`lain-out-${kodeAkun}-${idx}`}
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
                                                        <span
                                                            className={
                                                                has00
                                                                    ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                                    : ''
                                                            }
                                                        >
                                                            <Link
                                                                href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                                className={has00 ? '' : 'text-amber-300 hover:underline'}
                                                            >
                                                                {kodeAkun}
                                                            </Link>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                                    {formatRupiah(r?.amount_display)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    <TotalRow
                                        label="Net Lain-lain"
                                        value={formatRupiah(summary.total_lain_lain_net)}
                                        emphasis
                                    />
                                </>
                            ) : null}

                            <TotalRow label="Laba (Rugi) Bersih" value={formatRupiah(summary.laba_bersih)} emphasis />
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>Total akun RL: {formatNumber(total)}</span>
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
