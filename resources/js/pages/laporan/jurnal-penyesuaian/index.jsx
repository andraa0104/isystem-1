import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
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
    ChevronDown,
    FileCog,
    Loader2,
    Printer,
    Search,
} from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Jurnal Penyesuaian', href: '/laporan/jurnal-penyesuaian' },
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

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
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
    params.set('balance', query.balance ?? 'all');
    params.set('search', query.search ?? '');
    params.set('sortBy', query.sortBy ?? 'Periode');
    params.set('sortDir', query.sortDir ?? 'desc');
    return `/laporan/jurnal-penyesuaian/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function StatCard({ label, value, hint, accent = 'default' }) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-400'
            : accent === 'negative'
              ? 'text-rose-400'
              : 'text-foreground';

    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
    );
}

export default function JurnalPenyesuaianIndex() {
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
        total_dokumen: 0,
        sum_debit: 0,
        sum_kredit: 0,
        balanced_count: 0,
        unbalanced_count: 0,
        sum_selisih_abs: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(
        initialQuery?.period ?? (periodType === 'year' ? defaultYear ?? '' : defaultPeriod ?? ''),
    );
    const [balance, setBalance] = useState(initialQuery?.balance ?? 'all'); // all|balanced|unbalanced
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Periode');
    const [sortDir, setSortDir] = useState((initialQuery?.sortDir ?? 'desc').toLowerCase());
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all'
            ? 'all'
            : Number(initialQuery?.pageSize ?? 10) || 10,
    );
    const [page, setPage] = useState(1);

    const [openMap, setOpenMap] = useState({});
    const [detailMap, setDetailMap] = useState({});
    const [detailLoading, setDetailLoading] = useState({});
    const [detailError, setDetailError] = useState({});

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
    }, [debouncedSearch, pageSize, sortBy, sortDir, period, periodType, balance]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', periodType);
            params.set('period', period);
            params.set('balance', balance);
            params.set('search', debouncedSearch);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));

            const res = await fetch(`/laporan/jurnal-penyesuaian/rows?${params.toString()}`, {
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
                total_dokumen: Number(data?.summary?.total_dokumen ?? 0),
                sum_debit: Number(data?.summary?.sum_debit ?? 0),
                sum_kredit: Number(data?.summary?.sum_kredit ?? 0),
                balanced_count: Number(data?.summary?.balanced_count ?? 0),
                unbalanced_count: Number(data?.summary?.unbalanced_count ?? 0),
                sum_selisih_abs: Number(data?.summary?.sum_selisih_abs ?? 0),
            });

            setOpenMap({});
            setDetailMap({});
            setDetailLoading({});
            setDetailError({});
        } catch {
            setRows([]);
            setTotal(0);
            setSummary({
                total_dokumen: 0,
                sum_debit: 0,
                sum_kredit: 0,
                balanced_count: 0,
                unbalanced_count: 0,
                sum_selisih_abs: 0,
            });
            setOpenMap({});
            setDetailMap({});
            setDetailLoading({});
            setDetailError({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodType, period, balance, debouncedSearch, pageSize, page, sortBy, sortDir]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const printUrl = buildPrintUrl({
        periodType,
        period,
        balance,
        search: debouncedSearch,
        sortBy,
        sortDir,
    });

    const balanceChip = useMemo(() => {
        const balanced = Number(summary.balanced_count ?? 0);
        const unbalanced = Number(summary.unbalanced_count ?? 0);
        if (unbalanced > 0) {
            return {
                label: `${formatNumber(balanced)} seimbang • ${formatNumber(unbalanced)} tidak`,
                className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
            };
        }
        return {
            label: `${formatNumber(balanced)} seimbang`,
            className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
        };
    }, [summary]);

    const loadDetailsIfNeeded = async ({ kodeJurnal, periode }) => {
        if (!kodeJurnal || !periode) return;
        const docKey = `${kodeJurnal}|${periode}`;
        if (detailMap[docKey] || detailLoading[docKey]) return;

        setDetailLoading((s) => ({ ...s, [docKey]: true }));
        setDetailError((s) => ({ ...s, [docKey]: '' }));
        try {
            const params = new URLSearchParams();
            params.set('kodeJurnal', kodeJurnal);
            params.set('periode', periode);
            const res = await fetch(`/laporan/jurnal-penyesuaian/details?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = String(data?.error ?? 'Gagal memuat detail AJP.');
                setDetailError((s) => ({ ...s, [docKey]: msg }));
                throw new Error(msg);
            }

            setDetailMap((s) => ({
                ...s,
                [docKey]: {
                    details: Array.isArray(data?.details) ? data.details : [],
                    totals: data?.totals ?? null,
                },
            }));
        } catch {
            setDetailMap((s) => ({ ...s, [docKey]: { details: [], totals: null } }));
        } finally {
            setDetailLoading((s) => ({ ...s, [docKey]: false }));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Jurnal Penyesuaian" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                                <FileCog className="h-5 w-5 text-foreground/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Jurnal Penyesuaian</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            AJP periodik dari `tb_jurnalpenyesuaian` (header per Kode Jurnal)
                        </p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 dark:bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                            <Search className="h-3.5 w-3.5" />
                            Periode: <span className="text-foreground/80">{getPeriodLabel(periodType, period)}</span>
                            {period ? <span className="text-muted-foreground">({period})</span> : <span className="text-muted-foreground">(-)</span>}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline">
                            <a href={printUrl} target="_blank" rel="noreferrer">
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                            </a>
                        </Button>

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

                        <span className="text-sm text-muted-foreground">Status</span>
                        <Select value={balance} onValueChange={setBalance}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="balanced">Seimbang</SelectItem>
                                <SelectItem value="unbalanced">Tidak seimbang</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Urut</span>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Periode">Periode</SelectItem>
                                <SelectItem value="Posting_Date">Posting Date</SelectItem>
                                <SelectItem value="Kode_Jurnal">Kode Jurnal</SelectItem>
                                <SelectItem value="Lines">Lines</SelectItem>
                                <SelectItem value="Total_Debit">Total Debit</SelectItem>
                                <SelectItem value="Total_Kredit">Total Kredit</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortDir} onValueChange={setSortDir}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Desc</SelectItem>
                                <SelectItem value="asc">Asc</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Tampil</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) =>
                                setPageSize(val === 'all' ? 'all' : Number(val))
                            }
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
                            placeholder="Cari kode jurnal/remark/kode akun/nama akun..."
                            className="w-full sm:w-96"
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <StatCard label="Total Dokumen" value={formatNumber(summary.total_dokumen)} hint="Sesuai filter" />
                    <StatCard label="Total Debit" value={formatRupiah(summary.sum_debit)} />
                    <StatCard label="Total Kredit" value={formatRupiah(summary.sum_kredit)} />
                    <StatCard
                        label="Kualitas Posting"
                        value={formatRupiah(summary.sum_selisih_abs)}
                        hint="Total selisih ABS"
                        accent={summary.sum_selisih_abs > 0 ? 'negative' : 'positive'}
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold text-foreground">Ringkasan Status</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                Seimbang jika total debit = total kredit (per dokumen AJP).
                            </div>
                        </div>
                        <div
                            className={[
                                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                                balanceChip.className,
                            ].join(' ')}
                        >
                            {summary.unbalanced_count > 0 ? (
                                <AlertTriangle className="h-4 w-4" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {balanceChip.label}
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Sumber: `tb_jurnalpenyesuaian` (AJP).
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
                                <th className="px-3 py-3 w-12" />
                                <th className="px-3 py-3">Periode</th>
                                <th className="px-3 py-3">Posting</th>
                                <th className="px-3 py-3">Kode Jurnal</th>
                                <th className="px-3 py-3">Remark</th>
                                <th className="px-3 py-3 text-right">Lines</th>
                                <th className="px-3 py-3 text-right">Total Debit</th>
                                <th className="px-3 py-3 text-right">Total Kredit</th>
                                <th className="px-3 py-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            ) : null}

                            {rows.map((r, idx) => {
                                const kodeJurnal = String(r?.Kode_Jurnal ?? '');
                                const periodeDoc = String(r?.Periode ?? '');
                                const docKey = `${kodeJurnal}|${periodeDoc}`;
                                const open = Boolean(openMap[docKey]);
                                const has00 = Boolean(r?.has_00);
                                const cellClass = has00 ? markedCellClass : '';

                                const statusClass = r?.is_balanced
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20';
                                const statusText = r?.is_balanced ? 'Seimbang' : 'Tidak';

                                const detail = detailMap[docKey];
                                const detLoading = Boolean(detailLoading[docKey]);
                                const detErr = String(detailError[docKey] ?? '');
                                const detRows = Array.isArray(detail?.details) ? detail.details : [];

                                return (
                                    <Fragment key={`${docKey}-${idx}`}>
                                        <tr
                                            className={[
                                                'border-t border-border/50',
                                                has00 ? markedRowClass : '',
                                            ].join(' ')}
                                        >
                                            <td className={`px-3 py-2 ${cellClass}`}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    aria-label="Toggle detail"
                                                    onClick={() => {
                                                        const next = !open;
                                                        setOpenMap((s) => ({ ...s, [docKey]: next }));
                                                        if (next) {
                                                            loadDetailsIfNeeded({ kodeJurnal, periode: periodeDoc });
                                                        }
                                                    }}
                                                >
                                                    <ChevronDown
                                                        className={[
                                                            'h-4 w-4 transition-transform',
                                                            open ? 'rotate-180' : '',
                                                        ].join(' ')}
                                                    />
                                                </Button>
                                            </td>
                                            <td className={`px-3 py-2 ${cellClass}`}>
                                                {formatDate(periodeDoc)}
                                            </td>
                                            <td className={`px-3 py-2 ${cellClass}`}>
                                                {formatDate(r?.Posting_Date)}
                                            </td>
                                            <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                                <div className="flex items-center gap-2">
                                                    {has00 ? (
                                                        <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                                    ) : null}
                                                    <span
                                                        className={
                                                            has00
                                                                ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                                                                : ''
                                                        }
                                                    >
                                                        {kodeJurnal}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 ${cellClass}`}>
                                                <div className="max-w-[520px] truncate text-foreground/80">
                                                    {r?.Remark || '-'}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>
                                                {formatNumber(r?.lines)}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                                {formatRupiah(r?.total_debit)}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                                {formatRupiah(r?.total_kredit)}
                                            </td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>
                                                <span
                                                    className={[
                                                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                                                        statusClass,
                                                    ].join(' ')}
                                                >
                                                    {r?.is_balanced ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : (
                                                        <AlertTriangle className="h-4 w-4" />
                                                    )}
                                                    {statusText}
                                                </span>
                                            </td>
                                        </tr>

                                        {open ? (
                                            <tr className="border-t border-border/50">
                                                <td colSpan={9} className="px-3 pb-4 pt-0">
                                                    <div className="mt-3 rounded-2xl border border-border bg-muted/30 dark:bg-black/20">
                                                        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                                                            <div className="text-sm font-semibold text-foreground">
                                                                Detail Akun
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {detLoading
                                                                    ? 'Memuat...'
                                                                    : detErr
                                                                      ? 'Gagal memuat'
                                                                      : `${formatNumber(detRows.length)} baris`}
                                                            </div>
                                                        </div>

                                                        {detErr && !detLoading ? (
                                                            <div className="border-b border-border px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                                                                {detErr}
                                                            </div>
                                                        ) : null}

                                                        <div className="overflow-x-auto">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-muted/30 dark:bg-white/5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left">
                                                                            Kode Akun
                                                                        </th>
                                                                        <th className="px-4 py-2 text-left">
                                                                            Nama Akun
                                                                        </th>
                                                                        <th className="px-4 py-2 text-right">
                                                                            Debit
                                                                        </th>
                                                                        <th className="px-4 py-2 text-right">
                                                                            Kredit
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {detLoading ? (
                                                                        <tr>
                                                                            <td
                                                                                colSpan={4}
                                                                                className="px-4 py-6 text-center text-muted-foreground"
                                                                            >
                                                                                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                                                                Memuat detail...
                                                                            </td>
                                                                        </tr>
                                                                    ) : detRows.length === 0 ? (
                                                                        <tr>
                                                                            <td
                                                                                colSpan={4}
                                                                                className="px-4 py-6 text-center text-muted-foreground"
                                                                            >
                                                                                Tidak ada detail.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        detRows.map((d, di) => {
                                                                            const kodeAkun = String(d?.Kode_Akun ?? '');
                                                                            const has00Detail = kodeAkun.includes('00');
                                                                            const c = has00Detail ? markedCellClass : '';
                                                                            return (
                                                                                <tr
                                                                                    key={`${docKey}-${kodeAkun}-${di}`}
                                                                                    className={[
                                                                                        'border-t border-border/50',
                                                                                        has00Detail ? markedRowClass : '',
                                                                                    ].join(' ')}
                                                                                >
                                                                                    <td className={`px-4 py-2 font-medium ${c}`}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {has00Detail ? (
                                                                                                <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                                                                            ) : null}
                                                                                            <Link
                                                                                                href={buildBukuBesarUrl({ kodeAkun, periodType, period })}
                                                                                                className={
                                                                                                    has00Detail
                                                                                                        ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 hover:underline'
                                                                                                        : 'text-amber-700 dark:text-amber-300 hover:underline'
                                                                                                }
                                                                                            >
                                                                                                {kodeAkun}
                                                                                            </Link>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className={`px-4 py-2 ${c}`}>
                                                                                        {d?.Nama_Akun || '-'}
                                                                                    </td>
                                                                                    <td className={`px-4 py-2 text-right font-semibold ${c}`}>
                                                                                        {formatRupiah(d?.Debit)}
                                                                                    </td>
                                                                                    <td className={`px-4 py-2 text-right font-semibold ${c}`}>
                                                                                        {formatRupiah(d?.Kredit)}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                        Total data: <span className="text-foreground/80">{formatNumber(total)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            disabled={page <= 1 || pageSize === 'all'}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Sebelumnya
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            Halaman{' '}
                            <span className="text-foreground/80">
                                {pageSize === 'all' ? 1 : page}
                            </span>
                            /{totalPages}
                        </div>
                        <Button
                            variant="outline"
                            disabled={page >= totalPages || pageSize === 'all'}
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
