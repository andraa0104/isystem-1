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
    BookText,
    Loader2,
    Printer,
    Search,
    Sparkles,
} from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';
import {
    buildRecommendations,
    contextualizeRecommendations,
    runFuzzyAhpTopsis,
} from '@/lib/dss-fahp-topsis';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Saldo Akun (NABB)', href: '/laporan/saldo-akun' },
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

const buildPrintUrl = (query) => {
    const params = new URLSearchParams();
    params.set('search', query.search ?? '');
    params.set('saldoFilter', query.saldoFilter ?? 'all');
    params.set('saldoSign', query.saldoSign ?? 'all');
    params.set('mark00', query.mark00 ?? 'all');
    params.set('sortBy', query.sortBy ?? 'Kode_Akun');
    params.set('sortDir', query.sortDir ?? 'asc');
    return `/laporan/saldo-akun/print?${params.toString()}`;
};

function StatCard({ label, value, sublabel, accent = 'default' }) {
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
            {sublabel ? (
                <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
            ) : null}
        </div>
    );
}

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

export default function SaldoAkunIndex() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({
        total_accounts: 0,
        na_debit: 0,
        na_kredit: 0,
        sum_saldo: 0,
        positive_count: 0,
        negative_count: 0,
        zero_count: 0,
        marked_00_count: 0,
    });
    const [loading, setLoading] = useState(false);

    const [saldoFilter, setSaldoFilter] = useState(initialQuery?.saldoFilter ?? 'all'); // all | nonzero | zero
    const [saldoSign, setSaldoSign] = useState(initialQuery?.saldoSign ?? 'all'); // all | positive | negative | zero
    const [mark00, setMark00] = useState(initialQuery?.mark00 ?? 'all'); // all | yes
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

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, saldoFilter, saldoSign, mark00, sortBy, sortDir]);

    const fetchRows = async (opts = {}) => {
        const query = {
            search: opts.search ?? debouncedSearch,
            saldoFilter: opts.saldoFilter ?? saldoFilter,
            saldoSign: opts.saldoSign ?? saldoSign,
            mark00: opts.mark00 ?? mark00,
            sortBy: opts.sortBy ?? sortBy,
            sortDir: opts.sortDir ?? sortDir,
            page: opts.page ?? page,
            pageSize: opts.pageSize ?? pageSize,
        };

        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('search', query.search);
            params.set('saldoFilter', query.saldoFilter);
            params.set('saldoSign', query.saldoSign);
            params.set('mark00', query.mark00);
            params.set('sortBy', query.sortBy);
            params.set('sortDir', query.sortDir);
            params.set('page', String(query.page));
            params.set(
                'pageSize',
                query.pageSize === 'all' ? 'all' : String(query.pageSize),
            );

            const res = await fetch(`/laporan/saldo-akun/rows?${params.toString()}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

            setRows(Array.isArray(json?.rows) ? json.rows : []);
            setTotal(Number(json?.total ?? 0));
            setSummary(
                json?.summary ?? {
                    total_accounts: 0,
                    na_debit: 0,
                    na_kredit: 0,
                    sum_saldo: 0,
                    positive_count: 0,
                    negative_count: 0,
                    zero_count: 0,
                    marked_00_count: 0,
                },
            );
        } catch (e) {
            setRows([]);
            setTotal(0);
            setSummary({
                total_accounts: 0,
                na_debit: 0,
                na_kredit: 0,
                sum_saldo: 0,
                positive_count: 0,
                negative_count: 0,
                zero_count: 0,
                marked_00_count: 0,
            });
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, saldoFilter, saldoSign, mark00, sortBy, sortDir, page, pageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Math.max(1, Number(pageSize) || 10);
        return Math.max(1, Math.ceil((Number(total) || 0) / size));
    }, [total, pageSize]);

    const dssResult = useMemo(
        () =>
            runFuzzyAhpTopsis('saldo-akun', {
                total_accounts: Number(summary?.total_accounts ?? 0),
                negative_count: Number(summary?.negative_count ?? 0),
                zero_count: Number(summary?.zero_count ?? 0),
                marked_00_count: Number(summary?.marked_00_count ?? 0),
                na_nonzero_but_saldo_zero_count: Number(summary?.na_nonzero_but_saldo_zero_count ?? 0),
                saldo_nonzero_but_na_zero_count: Number(summary?.saldo_nonzero_but_na_zero_count ?? 0),
            }),
        [summary],
    );
    const dssTips = useMemo(
        () =>
            contextualizeRecommendations(buildRecommendations(dssResult, 3), {
                sourceLabel: 'tb_nabb (snapshot)',
            }),
        [dssResult],
    );

    const quickChipClass = (active) =>
        [
            'rounded-full px-3 py-1 text-xs ring-1 transition',
            active
                ? 'bg-muted/30 text-foreground ring-border dark:bg-white/10 dark:ring-white/20'
                : 'bg-muted/30 dark:bg-white/5 text-muted-foreground ring-border hover:bg-muted/40 hover:text-foreground/80 dark:ring-white/10 dark:hover:bg-white/10',
        ].join(' ');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Saldo Akun (NABB)" />

            <div className="space-y-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 dark:bg-white/5">
                                <BookText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-foreground">Saldo Akun (NABB)</div>
                                <div className="text-sm text-muted-foreground">
                                    Ringkasan saldo per akun dari `tb_nabb` (snapshot).
                                </div>
                            </div>
                        </div>
                    </div>

                <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={buildPrintUrl({
                                search: debouncedSearch,
                                saldoFilter,
                                saldoSign,
                                mark00,
                                sortBy,
                                sortDir,
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
                    <div className="relative w-full sm:w-[360px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kode / nama akun..."
                            className="pl-9"
                        />
                    </div>

                    <Select value={saldoFilter} onValueChange={setSaldoFilter}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Saldo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua</SelectItem>
                            <SelectItem value="nonzero">Saldo ≠ 0</SelectItem>
                            <SelectItem value="zero">Saldo = 0</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className={quickChipClass(saldoSign === 'positive')}
                            onClick={() => setSaldoSign((s) => (s === 'positive' ? 'all' : 'positive'))}
                        >
                            Saldo (+)
                        </button>
                        <button
                            type="button"
                            className={quickChipClass(saldoSign === 'negative')}
                            onClick={() => setSaldoSign((s) => (s === 'negative' ? 'all' : 'negative'))}
                        >
                            Saldo (-)
                        </button>
                        <button
                            type="button"
                            className={quickChipClass(saldoSign === 'zero')}
                            onClick={() => setSaldoSign((s) => (s === 'zero' ? 'all' : 'zero'))}
                        >
                            Saldo (=0)
                        </button>
                        <button
                            type="button"
                            className={quickChipClass(mark00 === 'yes')}
                            onClick={() => setMark00((m) => (m === 'yes' ? 'all' : 'yes'))}
                        >
                            Kode berisi 00
                        </button>
                    </div>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Urut" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Kode_Akun">Kode Akun</SelectItem>
                            <SelectItem value="Nama_Akun">Nama Akun</SelectItem>
                            <SelectItem value="Saldo">Saldo</SelectItem>
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

                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Total Akun"
                        value={formatNumber(summary?.total_accounts)}
                        sublabel="Sesuai filter"
                    />
                    <StatCard
                        label="NA Debit"
                        value={formatRupiah(summary?.na_debit)}
                        accent="positive"
                    />
                    <StatCard
                        label="NA Kredit"
                        value={formatRupiah(summary?.na_kredit)}
                        accent="negative"
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
                                    Saran prioritas untuk komposisi dan konsistensi saldo akun.
                                </div>
                            </div>
                        </div>
                    </div>

                    {dssTips.length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {dssTips.map((tip, idx) => (
                                <li key={idx}>{tip}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="mt-3 text-xs text-muted-foreground">
                            Tidak ada rekomendasi DSS untuk kondisi saat ini.
                        </div>
                    )}
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Pastikan `tb_nabb` ada (Kode_Akun, Nama_Akun, NA_Debit, NA_Kredit, Saldo).
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
                                <th className="px-3 py-3 text-right">NA Debit</th>
                                <th className="px-3 py-3 text-right">NA Kredit</th>
                                <th className="px-3 py-3 text-right">Saldo</th>
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
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
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
                                                    href={buildBukuBesarUrl({ kodeAkun })}
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
                                            {formatRupiah(r?.NA_Debit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.NA_Kredit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.Saldo)}
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
