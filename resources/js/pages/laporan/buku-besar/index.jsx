import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
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
    BookOpenText,
    AlertTriangle,
    Loader2,
    Printer,
    Search,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react';
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
    { title: 'Buku Besar', href: '/laporan/buku-besar' },
];

const formatRupiah = (value) => {
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

const formatSaldoWithSide = (signed) => {
    const n = Number(signed);
    if (!Number.isFinite(n) || n === 0) return 'Rp 0';
    return `${formatRupiah(Math.abs(n))} ${n >= 0 ? 'D' : 'K'}`;
};

const buildPrintUrl = (query) => {
    const params = new URLSearchParams();
    params.set('periodType', query.periodType ?? 'month');
    params.set('period', query.period ?? '');
    params.set('account', query.account ?? '');
    params.set('source', query.source ?? 'all');
    params.set('search', query.search ?? '');
    return `/laporan/buku-besar/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function StatCard({ label, value, helper, accent = 'default' }) {
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
            {helper ? (
                <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
            ) : null}
        </div>
    );
}

export default function BukuBesarLedgerIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod = '',
        yearOptions = [],
        defaultYear = '',
        accountOptions = [],
    } = usePage().props;

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(initialQuery?.period ?? '');
    const [account, setAccount] = useState(initialQuery?.account ?? '');
    const [source, setSource] = useState(initialQuery?.source ?? 'all'); // all|trx|ajp
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all'
            ? 'all'
            : Number(initialQuery?.pageSize ?? 50) || 50,
    );
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        opening_balance_signed: 0,
        opening_warning: false,
        opening_source: 'missing',
        opening_period: null,
        total_debit: 0,
        total_kredit: 0,
        closing_balance_signed: 0,
        line_count: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [accountName, setAccountName] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        // Ensure period format per mode
        if (periodType === 'year') {
            if (period && /^\d{4}$/.test(period)) return;
            setPeriod(defaultYear || yearOptions?.[0] || '');
            return;
        }
        if (period && /^\d{6}$/.test(period)) return;
        setPeriod(defaultPeriod || periodOptions?.[0] || '');
    }, [periodType, period, defaultPeriod, periodOptions, defaultYear, yearOptions]);

    useEffect(() => {
        // Ensure account default
        if (account) return;
        const def = accountOptions?.[0]?.Kode_Akun || '';
        if (def) setAccount(def);
    }, [account, accountOptions]);

    useEffect(() => {
        setPage(1);
    }, [periodType, period, account, source, debouncedSearch, pageSize]);

    const query = useMemo(
        () => ({
            periodType,
            period,
            account,
            source,
            search: debouncedSearch,
            page,
            pageSize,
        }),
        [periodType, period, account, source, debouncedSearch, page, pageSize],
    );

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Math.max(1, Number(pageSize) || 50);
        return Math.max(1, Math.ceil((Number(total) || 0) / size));
    }, [total, pageSize]);

    const accountLabel = useMemo(() => {
        const match = accountOptions.find((a) => String(a?.Kode_Akun) === String(account));
        return match ? `${match.Kode_Akun} — ${match.Nama_Akun || ''}`.trim() : account;
    }, [accountOptions, account]);

    const has00Account = useMemo(() => String(account || '').includes('00'), [account]);

    const dssResult = useMemo(
        () =>
            runFuzzyAhpTopsis('buku-besar', {
                opening_warning: Boolean(summary?.opening_warning),
                opening_balance_signed: Number(summary?.opening_balance_signed ?? 0),
                total_debit: Number(summary?.total_debit ?? 0),
                total_kredit: Number(summary?.total_kredit ?? 0),
                line_count: Number(summary?.line_count ?? 0),
            }),
        [summary],
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

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', query.periodType ?? 'month');
            params.set('period', query.period ?? '');
            params.set('account', query.account ?? '');
            params.set('source', query.source ?? 'all');
            params.set('search', query.search ?? '');
            params.set('page', String(query.page ?? 1));
            params.set('pageSize', query.pageSize === 'all' ? 'all' : String(query.pageSize));

            const res = await fetch(`/laporan/buku-besar/rows?${params.toString()}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

            setRows(Array.isArray(json?.rows) ? json.rows : []);
            setTotal(Number(json?.total ?? 0));
            setSummary(json?.summary ?? {});
            setAccountName(String(json?.account_name ?? ''));
        } catch (e) {
            setRows([]);
            setTotal(0);
            setSummary({
                opening_balance_signed: 0,
                opening_warning: false,
                opening_source: 'missing',
                opening_period: null,
                total_debit: 0,
                total_kredit: 0,
                closing_balance_signed: 0,
                line_count: 0,
            });
            setAccountName('');
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query.periodType, query.period, query.account, query.source, query.search, query.page, query.pageSize]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buku Besar" />

            <div className="space-y-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 dark:bg-white/5">
                                <BookOpenText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-foreground">Buku Besar</div>
                                <div className="text-sm text-muted-foreground">
                                    Ledger detail per akun (TRX + AJP) — periodik.
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 dark:bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                                <span>Periode:</span>
                                <span className="font-medium text-foreground/80">
                                    {getPeriodLabel(periodType, period) || '—'}
                                </span>
                            </div>
                            <div
                                className={[
                                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                                    has00Account
                                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                        : 'border-border bg-muted/30 dark:bg-white/5 text-muted-foreground',
                                ].join(' ')}
                            >
                                {has00Account ? (
                                    <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-500/30" />
                                ) : null}
                                <span className={has00Account ? 'text-amber-700 dark:text-amber-300' : ''}>
                                    Akun: {accountLabel}
                                </span>
                            </div>
                            {summary?.opening_warning ? (
                                <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-700 dark:text-rose-300">
                                    <AlertTriangle className="h-4 w-4" />
                                    Saldo awal tidak ditemukan (opening=0)
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={buildPrintUrl({
                                periodType,
                                period,
                                account,
                                source,
                                search: debouncedSearch,
                            })}
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

                        <Select value={account} onValueChange={setAccount}>
                            <SelectTrigger className="w-[320px]">
                                <SelectValue placeholder="Akun" />
                            </SelectTrigger>
                            <SelectContent>
                                {accountOptions.map((a) => (
                                    <SelectItem key={a.Kode_Akun} value={String(a.Kode_Akun)}>
                                        {a.Kode_Akun} — {a.Nama_Akun}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-1 items-center gap-2">
                        <div className="relative w-full sm:w-[360px]">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari kode jurnal / voucher / remark..."
                                className="pl-9"
                            />
                        </div>

                        <Select value={source} onValueChange={setSource}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Sumber" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="trx">TRX</SelectItem>
                                <SelectItem value="ajp">AJP</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={String(pageSize)} onValueChange={setPageSize}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Tampil" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Saldo Awal"
                        value={formatSaldoWithSide(summary?.opening_balance_signed)}
                        helper={
                            summary?.opening_warning
                                ? 'Sumber: tidak ditemukan'
                                : summary?.opening_period
                                  ? `Sumber: tb_nabbrekap (${summary.opening_period})`
                                  : 'Sumber: tb_nabbrekap'
                        }
                    />
                    <StatCard
                        label="Total Debit"
                        value={formatRupiah(summary?.total_debit)}
                        accent="positive"
                    />
                    <StatCard
                        label="Total Kredit"
                        value={formatRupiah(summary?.total_kredit)}
                        accent="negative"
                    />
                    <StatCard
                        label="Saldo Akhir"
                        value={formatSaldoWithSide(summary?.closing_balance_signed)}
                        helper={
                            accountName
                                ? `Akun: ${accountName}`
                                : ' '
                        }
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
                                    Saran prioritas untuk kualitas saldo awal dan mutasi akun periode aktif.
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

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Jumlah baris: {formatNumber(summary?.line_count ?? total)}</span>
                    </div>
                    <div className="inline-flex items-center gap-3">
                        <span>Sumber: {source === 'all' ? 'TRX + AJP' : source.toUpperCase()}</span>
                        <span className="text-foreground/30">•</span>
                        <span>Periode: {getPeriodLabel(periodType, period) || '—'}</span>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Pastikan tabel tersedia: `tb_nabb`, `tb_jurnal`, `tb_jurnaldetail`, `tb_jurnalpenyesuaian` (dan `tb_nabbrekap` untuk saldo awal).
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
                                <th className="px-3 py-3">Tanggal</th>
                                <th className="px-3 py-3">Sumber</th>
                                <th className="px-3 py-3">Kode Jurnal</th>
                                <th className="px-3 py-3">Voucher</th>
                                <th className="px-3 py-3">Remark</th>
                                <th className="px-3 py-3 text-right">Debit</th>
                                <th className="px-3 py-3 text-right">Kredit</th>
                                <th className="px-3 py-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const cellClass = has00Account ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`${r?.date ?? idx}-${r?.kode_jurnal ?? idx}-${idx}`}
                                        className={[
                                            'border-t border-border/50',
                                            has00Account ? markedRowClass : '',
                                        ].join(' ')}
                                    >
                                        <td className={`px-3 py-2 ${cellClass}`}>{r?.date}</td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            <span className="rounded-full border border-border bg-muted/30 dark:bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                                                {r?.source}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-2 font-medium ${cellClass}`}>{r?.kode_jurnal}</td>
                                        <td className={`px-3 py-2 ${cellClass}`}>{r?.kode_voucher}</td>
                                        <td className={`px-3 py-2 ${cellClass}`}>
                                            <div className="max-w-[520px] whitespace-normal break-words">
                                                {r?.remark}
                                            </div>
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.debit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.kredit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatSaldoWithSide(r?.running_signed)}
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
