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
    ArrowDownRight,
    ArrowUpRight,
    Landmark,
    Loader2,
    Printer,
    Sparkles,
} from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';
import {
    buildTopFindings,
    buildRecommendations,
    contextualizeFindings,
    contextualizeRecommendations,
    findingLevelMeta,
    runFuzzyAhpTopsis,
} from '@/lib/dss-fahp-topsis';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Perubahan Modal', href: '/laporan/perubahan-modal' },
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
    params.set('sortBy', query.sortBy ?? 'Net');
    params.set('sortDir', query.sortDir ?? 'desc');
    return `/laporan/perubahan-modal/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function StatCard({ label, value, accent = 'default', icon: Icon, helper }) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-400'
            : accent === 'negative'
              ? 'text-rose-400'
              : 'text-foreground';

    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                    </div>
                    <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
                    {helper ? (
                        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
                    ) : null}
                </div>
                {Icon ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function PerubahanModalIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod = '',
        yearOptions = [],
        defaultYear = '',
    } = usePage().props;

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(initialQuery?.period ?? '');
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Net');
    const [sortDir, setSortDir] = useState(initialQuery?.sortDir ?? 'desc');
    const [pageSize, setPageSize] = useState(initialQuery?.pageSize ?? 25);
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        opening_equity: 0,
        contributions: 0,
        withdrawals: 0,
        net_income: 0,
        computed_ending_equity: 0,
        snapshot_ending_equity: 0,
        diff: 0,
    });
    const [effectivePeriod, setEffectivePeriod] = useState(null);
    const [effectivePeriodLabel, setEffectivePeriodLabel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (periodType === 'year') {
            if (period && /^\d{4}$/.test(period)) return;
            setPeriod(defaultYear || yearOptions?.[0] || '');
            return;
        }

        if (period && /^\d{6}$/.test(period)) return;
        setPeriod(defaultPeriod || periodOptions?.[0] || '');
    }, [periodType, period, defaultPeriod, periodOptions, defaultYear, yearOptions]);

    const query = useMemo(
        () => ({
            periodType,
            period,
            search,
            sortBy,
            sortDir,
            page,
            pageSize,
        }),
        [periodType, period, search, sortBy, sortDir, page, pageSize],
    );

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Math.max(1, Number(pageSize) || 10);
        return Math.max(1, Math.ceil((Number(total) || 0) / size));
    }, [total, pageSize]);

    useEffect(() => {
        const controller = new AbortController();
        const t = setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('periodType', query.periodType ?? 'month');
                params.set('period', query.period ?? '');
                params.set('search', query.search ?? '');
                params.set('sortBy', query.sortBy ?? 'Net');
                params.set('sortDir', query.sortDir ?? 'desc');
                params.set('page', String(query.page ?? 1));
                params.set('pageSize', String(query.pageSize ?? 25));

                const res = await fetch(`/laporan/perubahan-modal/rows?${params.toString()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal,
                    credentials: 'include',
                });
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json?.error || 'Gagal memuat data.');
                }

                setRows(Array.isArray(json?.rows) ? json.rows : []);
                setTotal(Number(json?.total ?? 0));
                setSummary(json?.summary ?? {});
                setEffectivePeriod(json?.effective_period ?? null);
                setEffectivePeriodLabel(json?.effective_period_label ?? null);
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setRows([]);
                setTotal(0);
                setSummary({
                    opening_equity: 0,
                    contributions: 0,
                    withdrawals: 0,
                    net_income: 0,
                    computed_ending_equity: 0,
                    snapshot_ending_equity: 0,
                    diff: 0,
                });
                setEffectivePeriod(null);
                setEffectivePeriodLabel(null);
                setError(String(e?.message || e));
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => {
            clearTimeout(t);
            controller.abort();
        };
    }, [query]);

    useEffect(() => {
        setPage(1);
    }, [periodType, period, search, sortBy, sortDir, pageSize]);

    const computedEnding = Number(summary?.computed_ending_equity ?? 0);
    const snapshotEnding = Number(summary?.snapshot_ending_equity ?? 0);
    const diff = Number(summary?.diff ?? 0);
    const absDiff = Math.abs(diff);
    const tolerance = Math.max(1, Math.abs(snapshotEnding) * 0.00001);
    const isMatch = absDiff <= tolerance;
    const dssResult = useMemo(
        () =>
            runFuzzyAhpTopsis('perubahan-modal', {
                diff,
                tolerance,
                computed_ending_equity: computedEnding,
                opening_plus_computed:
                    Math.abs(Number(summary?.opening_equity ?? 0)) + Math.abs(computedEnding),
            }),
        [diff, tolerance, computedEnding, summary],
    );
    const dssTips = useMemo(
        () =>
            contextualizeRecommendations(buildRecommendations(dssResult, 5), {
                periodLabel: getPeriodLabel(periodType, period),
            }),
        [dssResult, periodType, period],
    );
    const dssFindings = useMemo(
        () =>
            contextualizeFindings(buildTopFindings(dssResult, 5), {
                periodLabel: getPeriodLabel(periodType, period),
            }),
        [dssResult, periodType, period],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Perubahan Modal" />

            <div className="space-y-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 dark:bg-white/5">
                                <Landmark className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-foreground">Perubahan Modal</div>
                                <div className="text-sm text-muted-foreground">
                                    Rekonsiliasi modal (ekuitas) periodik — snapshot `tb_nabbrekap` + perhitungan jurnal.
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 dark:bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                            <span>Periode:</span>
                            <span className="font-medium text-foreground/80">
                                {getPeriodLabel(periodType, period) || '—'}
                            </span>
                            {periodType === 'year' && effectivePeriod ? (
                                <span className="text-muted-foreground">
                                    • Snapshot akhir: {effectivePeriodLabel || effectivePeriod}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={buildPrintUrl({ periodType, period, search, sortBy, sortDir })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex"
                        >
                            <Button variant="outline" className="gap-2">
                                <Printer className="h-4 w-4" /> Print
                            </Button>
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex items-center gap-2">
                        <Select value={periodType} onValueChange={setPeriodType}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Per Bulan</SelectItem>
                                <SelectItem value="year">Per Tahun</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                {periodType === 'year'
                                    ? yearOptions.map((y) => (
                                          <SelectItem key={y} value={String(y)}>
                                              FY {y} (Jan–Des)
                                          </SelectItem>
                                      ))
                                    : periodOptions.map((p) => (
                                          <SelectItem key={p} value={String(p)}>
                                              {getPeriodLabel('month', String(p))} ({p})
                                          </SelectItem>
                                      ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari kode / nama akun ekuitas..."
                        className="w-full sm:w-[320px]"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[170px]">
                                <SelectValue placeholder="Urut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Net">Net</SelectItem>
                                <SelectItem value="Kode_Akun">Kode Akun</SelectItem>
                                <SelectItem value="Nama_Akun">Nama Akun</SelectItem>
                                <SelectItem value="Debit">Debit</SelectItem>
                                <SelectItem value="Kredit">Kredit</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortDir} onValueChange={setSortDir}>
                            <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="Arah" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asc">Asc</SelectItem>
                                <SelectItem value="desc">Desc</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={String(pageSize)} onValueChange={setPageSize}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Tampil" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Modal Awal"
                        value={formatRupiah(summary?.opening_equity)}
                        icon={Landmark}
                    />
                    <StatCard
                        label="Tambahan Modal"
                        value={formatRupiah(summary?.contributions)}
                        accent={Number(summary?.contributions ?? 0) > 0 ? 'positive' : 'default'}
                        icon={ArrowUpRight}
                        helper="Dari akun ekuitas (prefix 3)"
                    />
                    <StatCard
                        label="Prive"
                        value={formatRupiah(summary?.withdrawals)}
                        accent={Number(summary?.withdrawals ?? 0) > 0 ? 'negative' : 'default'}
                        icon={ArrowDownRight}
                        helper="Dari akun ekuitas (prefix 3)"
                    />
                    <StatCard
                        label="Laba Bersih"
                        value={formatRupiah(summary?.net_income)}
                        accent={Number(summary?.net_income ?? 0) >= 0 ? 'positive' : 'negative'}
                        icon={Sparkles}
                        helper="Nominal (prefix 4–7)"
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        label="Modal Akhir (Hitung)"
                        value={formatRupiah(computedEnding)}
                        icon={Landmark}
                    />
                    <StatCard
                        label="Modal Akhir (Snapshot)"
                        value={formatRupiah(snapshotEnding)}
                        icon={Landmark}
                        helper={effectivePeriodLabel ? `Basis: ${effectivePeriodLabel}` : null}
                    />
                    <StatCard
                        label="Selisih"
                        value={formatRupiah(diff)}
                        accent={isMatch ? 'positive' : 'negative'}
                        icon={isMatch ? null : AlertTriangle}
                        helper={isMatch ? 'Match (toleransi)' : 'Mismatch'}
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                                <Sparkles className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="font-semibold text-foreground">Rekomendasi DSS (Fuzzy AHP-TOPSIS)</div>
                                <div className="text-xs text-muted-foreground">
                                    Saran prioritas untuk kualitas rekonsiliasi perubahan modal periode aktif.
                                </div>
                            </div>
                        </div>
                    </div>

                    {dssFindings.length ? (
                        <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                                Temuan DSS (Top 5)
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {dssFindings.map((item, idx) => (
                                    <li key={`finding-${idx}`}>
                                        <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${findingLevelMeta(item?.level).className}`}>
                                            {findingLevelMeta(item?.level).label}
                                        </span>
                                        {item.finding}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {dssTips.length ? (
                        <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                                Saran / Rekomendasi (Top 5)
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {dssTips.map((tip, idx) => (
                                    <li key={idx}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {!dssTips.length && !dssFindings.length ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                            Tidak ada rekomendasi DSS untuk kondisi saat ini.
                        </div>
                    ) : null}
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Pastikan tabel tersedia: `tb_nabbrekap` (Kode_NaBB, Kode_Akun, Saldo), `tb_jurnal` + `tb_jurnaldetail`, dan `tb_jurnalpenyesuaian`.
                        </div>
                    </div>
                ) : null}

                <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 dark:bg-black/30 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 dark:bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                            </div>
                        </div>
                    )}

                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-muted/30 dark:bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                            <tr>
                                <th className="px-3 py-3">Kode Akun</th>
                                <th className="px-3 py-3">Nama Akun</th>
                                <th className="px-3 py-3 text-right">Debit</th>
                                <th className="px-3 py-3 text-right">Kredit</th>
                                <th className="px-3 py-3 text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = Boolean(r?.has_00) || kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                const net = Number(r?.net ?? 0);
                                return (
                                    <tr
                                        key={`${kodeAkun}-${idx}`}
                                        className={[
                                            'border-t border-border/50',
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
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 hover:underline'
                                                            : 'text-amber-700 dark:text-amber-300 hover:underline'
                                                    }
                                                >
                                                    {kodeAkun}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.debit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.kredit)}
                                        </td>
                                        <td
                                            className={[
                                                'px-3 py-2 text-right',
                                                cellClass,
                                                net > 0 ? 'text-emerald-700 dark:text-emerald-300' : net < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-foreground/80',
                                            ].join(' ')}
                                        >
                                            {formatRupiah(net)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>Total data: {formatNumber(total)}</span>
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
