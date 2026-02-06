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
import { ChevronDown, Loader2, Printer, Search, Wallet } from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Buku Kas', href: '/laporan/buku-kas' },
];

const formatRupiah = (value, dashIfNull = false) => {
    if (value === null || value === undefined) return dashIfNull ? '—' : 'Rp 0';
    if (value === '') return dashIfNull ? '—' : 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return dashIfNull ? '—' : 'Rp 0';
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
    params.set('account', query.account ?? 'all');
    params.set('flow', query.flow ?? 'all');
    params.set('search', query.search ?? '');
    params.set('sortBy', query.sortBy ?? 'Tgl_Voucher');
    params.set('sortDir', query.sortDir ?? 'desc');
    return `/laporan/buku-kas/print?${params.toString()}`;
};

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

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

export default function BukuKasIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod = '',
        yearOptions = [],
        defaultYear = '',
        accountOptions = [],
        defaultAccount = '',
    } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        opening_balance: null,
        closing_balance: null,
        total_in: 0,
        total_out: 0,
        net_change: 0,
        count_voucher: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(
        initialQuery?.period ?? (periodType === 'year' ? defaultYear ?? '' : defaultPeriod ?? ''),
    );
    const [account, setAccount] = useState(initialQuery?.account ?? defaultAccount ?? 'all');
    const [flow, setFlow] = useState(initialQuery?.flow ?? 'all');
    const [search, setSearch] = useState(initialQuery?.search ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery?.search ?? '');
    const [sortBy, setSortBy] = useState(initialQuery?.sortBy ?? 'Tgl_Voucher');
    const [sortDir, setSortDir] = useState((initialQuery?.sortDir ?? 'desc').toLowerCase());
    const [pageSize, setPageSize] = useState(
        initialQuery?.pageSize === 'all'
            ? 'all'
            : Number(initialQuery?.pageSize ?? 10) || 10,
    );
    const [page, setPage] = useState(1);

    const [openMap, setOpenMap] = useState({});

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
    }, [debouncedSearch, pageSize, sortBy, sortDir, period, periodType, account, flow]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', periodType);
            params.set('period', period);
            params.set('account', account);
            params.set('flow', flow);
            params.set('search', debouncedSearch);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));

            const res = await fetch(`/laporan/buku-kas/rows?${params.toString()}`, {
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
                opening_balance:
                    data?.summary?.opening_balance === null
                        ? null
                        : Number(data?.summary?.opening_balance ?? 0),
                closing_balance:
                    data?.summary?.closing_balance === null
                        ? null
                        : Number(data?.summary?.closing_balance ?? 0),
                total_in: Number(data?.summary?.total_in ?? 0),
                total_out: Number(data?.summary?.total_out ?? 0),
                net_change: Number(data?.summary?.net_change ?? 0),
                count_voucher: Number(data?.summary?.count_voucher ?? 0),
            });
            setOpenMap({});
        } catch {
            setRows([]);
            setTotal(0);
            setSummary({
                opening_balance: null,
                closing_balance: null,
                total_in: 0,
                total_out: 0,
                net_change: 0,
                count_voucher: 0,
            });
            setOpenMap({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodType, period, account, flow, debouncedSearch, pageSize, page, sortBy, sortDir]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const printUrl = buildPrintUrl({
        periodType,
        period,
        account,
        flow,
        search: debouncedSearch,
        sortBy,
        sortDir,
    });

    const netAccent =
        summary.net_change > 0 ? 'positive' : summary.net_change < 0 ? 'negative' : 'default';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buku Kas" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                                <Wallet className="h-5 w-5 text-foreground/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Buku Kas</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Mutasi kas/bank dan saldo berjalan (periodik)
                        </p>
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-muted/30 dark:bg-white/5 px-3 py-1 text-xs text-muted-foreground">
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

                        <span className="text-sm text-muted-foreground">Akun</span>
                        <Select value={account} onValueChange={setAccount}>
                            <SelectTrigger className="w-64">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua akun</SelectItem>
                                {accountOptions.map((a) => (
                                    <SelectItem key={a.value} value={a.value}>
                                        {a.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Arus</span>
                        <Select value={flow} onValueChange={setFlow}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="in">Masuk</SelectItem>
                                <SelectItem value="out">Keluar</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Urut</span>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Tgl_Voucher">Tgl Voucher</SelectItem>
                                <SelectItem value="Kode_Voucher">Kode Voucher</SelectItem>
                                <SelectItem value="Mutasi">Mutasi</SelectItem>
                                <SelectItem value="Saldo">Saldo</SelectItem>
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
                            placeholder="Cari voucher/keterangan/kode akun/jenis beban..."
                            className="w-full sm:w-96"
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <StatCard
                        label="Saldo Awal"
                        value={formatRupiah(summary.opening_balance, true)}
                        hint={account === 'all' ? 'Pilih akun untuk saldo' : 'Sebelum periode'}
                    />
                    <StatCard label="Total Masuk" value={formatRupiah(summary.total_in)} accent="positive" />
                    <StatCard label="Total Keluar" value={formatRupiah(summary.total_out)} accent="negative" />
                    <StatCard
                        label="Saldo Akhir"
                        value={formatRupiah(summary.closing_balance, true)}
                        hint={account === 'all' ? 'Pilih akun untuk saldo' : 'Akhir periode'}
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold text-foreground">Ringkasan</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                Net change dihitung dari total mutasi sesuai filter.
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-border bg-muted/30 dark:bg-black/20 px-3 py-1 text-xs text-muted-foreground">
                                Net Change:{' '}
                                <span className={netAccent === 'positive' ? 'text-emerald-700 dark:text-emerald-300' : netAccent === 'negative' ? 'text-rose-700 dark:text-rose-300' : 'text-foreground/80'}>
                                    {formatRupiah(summary.net_change)}
                                </span>
                            </div>
                            <div className="rounded-full border border-border bg-muted/30 dark:bg-black/20 px-3 py-1 text-xs text-muted-foreground">
                                Voucher: <span className="text-foreground/80">{formatNumber(summary.count_voucher)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Sumber: `tb_kas` (mutasi dan saldo berjalan).
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
                                <th className="px-3 py-3">Tgl Voucher</th>
                                <th className="px-3 py-3">Kode Voucher</th>
                                <th className="px-3 py-3">Keterangan</th>
                                <th className="px-3 py-3 text-right">Mutasi</th>
                                <th className="px-3 py-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            ) : null}

                            {rows.map((r, idx) => {
                                const kodeVoucher = String(r?.Kode_Voucher ?? '');
                                const open = Boolean(openMap[kodeVoucher]);
                                const mutasi = Number(r?.Mutasi_Kas ?? 0);
                                const direction = String(r?.direction ?? 'neutral');
                                const breakdowns = Array.isArray(r?.breakdowns) ? r.breakdowns : [];
                                const has00 = kodeVoucher.includes('00') || String(r?.Kode_Akun ?? '').includes('00');
                                const cellClass = has00 ? markedCellClass : '';

                                const mutasiClass =
                                    direction === 'in'
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : direction === 'out'
                                          ? 'text-rose-700 dark:text-rose-300'
                                          : 'text-foreground/80';

                                return (
                                    <Fragment key={`${kodeVoucher}-${idx}`}>
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
                                                    aria-label="Toggle breakdown"
                                                    onClick={() => {
                                                        setOpenMap((s) => ({ ...s, [kodeVoucher]: !open }));
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
                                            <td className={`px-3 py-2 ${cellClass}`}>{formatDate(r?.Tgl_Voucher)}</td>
                                            <td className={`px-3 py-2 font-medium ${cellClass}`}>{kodeVoucher}</td>
                                            <td className={`px-3 py-2 ${cellClass}`}>
                                                <div className="max-w-[640px] truncate text-foreground/80">
                                                    {r?.Keterangan || '-'}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold ${cellClass} ${mutasiClass}`}>
                                                {formatRupiah(mutasi)}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                                {formatRupiah(r?.Saldo)}
                                            </td>
                                        </tr>

                                        {open ? (
                                            <tr className="border-t border-border/50">
                                                <td colSpan={6} className="px-3 pb-4 pt-0">
                                                    <div className="mt-3 rounded-2xl border border-border bg-muted/30 dark:bg-black/20">
                                                        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                                                            <div className="text-sm font-semibold text-foreground">
                                                                Rincian Beban
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {breakdowns.length === 0
                                                                    ? 'Tidak ada rincian'
                                                                    : `${formatNumber(breakdowns.length)} item`}
                                                            </div>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-muted/30 dark:bg-white/5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left">
                                                                            Kode Akun
                                                                        </th>
                                                                        <th className="px-4 py-2 text-left">
                                                                            Jenis Beban
                                                                        </th>
                                                                        <th className="px-4 py-2 text-right">
                                                                            Nominal
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {breakdowns.length === 0 ? (
                                                                        <tr>
                                                                            <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                                                                                Tidak ada rincian beban.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        breakdowns.map((b, bi) => {
                                                                            const kodeAkun = String(b?.kode_akun ?? '');
                                                                            const has00Detail = kodeAkun.includes('00');
                                                                            const c = has00Detail ? markedCellClass : '';
                                                                            return (
                                                                                <tr
                                                                                    key={`${kodeVoucher}-${kodeAkun}-${bi}`}
                                                                                    className={[
                                                                                        'border-t border-border/50',
                                                                                        has00Detail ? markedRowClass : '',
                                                                                    ].join(' ')}
                                                                                >
                                                                                    <td className={`px-4 py-2 font-medium ${c}`}>
                                                                                        {kodeAkun ? (
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
                                                                                        ) : (
                                                                                            '-'
                                                                                        )}
                                                                                    </td>
                                                                                    <td className={`px-4 py-2 ${c}`}>
                                                                                        {b?.jenis_beban || '-'}
                                                                                    </td>
                                                                                    <td className={`px-4 py-2 text-right font-semibold ${c}`}>
                                                                                        {formatRupiah(b?.nominal)}
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
