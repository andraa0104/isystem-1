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
import { BookOpenText, Loader2, Printer, Search } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Buku Besar', href: '/laporan/buku-besar' },
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
    params.set('sortBy', query.sortBy ?? 'Kode_Akun');
    params.set('sortDir', query.sortDir ?? 'asc');
    return `/laporan/buku-besar/print?${params.toString()}`;
};

function StatCard({ label, value, sublabel, accent = 'default' }) {
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
            {sublabel ? (
                <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
            ) : null}
        </div>
    );
}

export default function BukuBesarIndex() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({
        total_accounts: 0,
        na_debit: 0,
        na_kredit: 0,
    });
    const [loading, setLoading] = useState(false);

    const [saldoFilter, setSaldoFilter] = useState(initialQuery?.saldoFilter ?? 'all'); // all | nonzero | zero
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
    }, [debouncedSearch, pageSize, saldoFilter, sortBy, sortDir]);

    const fetchRows = async (opts = {}) => {
        const query = {
            search: opts.search ?? debouncedSearch,
            saldoFilter: opts.saldoFilter ?? saldoFilter,
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
            params.set('sortBy', query.sortBy);
            params.set('sortDir', query.sortDir);
            params.set('page', String(query.page));
            params.set(
                'pageSize',
                query.pageSize === 'all' ? 'all' : String(query.pageSize),
            );

            const res = await fetch(`/laporan/buku-besar/rows?${params.toString()}`, {
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
                total_accounts: Number(data?.summary?.total_accounts ?? 0),
                na_debit: Number(data?.summary?.na_debit ?? 0),
                na_kredit: Number(data?.summary?.na_kredit ?? 0),
            });
        } catch {
            setRows([]);
            setTotal(0);
            setSummary({
                total_accounts: 0,
                na_debit: 0,
                na_kredit: 0,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page, saldoFilter, sortBy, sortDir]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const printUrl = buildPrintUrl({ search: debouncedSearch, saldoFilter, sortBy, sortDir });
    const markedCellClass = 'bg-amber-500/10';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buku Besar" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                                <BookOpenText className="h-5 w-5 text-white/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Buku Besar</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ringkasan saldo per akun (snapshot)
                        </p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                            <Search className="h-3.5 w-3.5" />
                            Periode: Snapshot (tb_nabb tidak menyimpan periode)
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline">
                            <a href={printUrl} target="_blank" rel="noreferrer">
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                            </a>
                        </Button>

                        <span className="text-sm text-muted-foreground">Saldo</span>
                        <Select value={saldoFilter} onValueChange={setSaldoFilter}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="nonzero">Saldo ≠ 0</SelectItem>
                                <SelectItem value="zero">Saldo = 0</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="text-sm text-muted-foreground">Urut</span>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Kode_Akun">Kode Akun</SelectItem>
                                <SelectItem value="Nama_Akun">Nama Akun</SelectItem>
                                <SelectItem value="Saldo">Saldo</SelectItem>
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

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                        label="Total Akun"
                        value={formatNumber(summary.total_accounts)}
                        sublabel="Sesuai filter"
                    />
                    <StatCard label="NA Debit" value={formatRupiah(summary.na_debit)} />
                    <StatCard label="NA Kredit" value={formatRupiah(summary.na_kredit)} />
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-200/80">
                            Cek koneksi database tenant dan pastikan tabel/kolom `tb_nabb` sesuai (Kode_Akun,
                            Nama_Akun, NA_Debit, NA_Kredit, BB_Debit, BB_Kredit, Saldo).
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
                                <th className="px-3 py-3 text-right">NA Debit</th>
                                <th className="px-3 py-3 text-right">NA Kredit</th>
                                <th className="px-3 py-3 text-right">BB Debit</th>
                                <th className="px-3 py-3 text-right">BB Kredit</th>
                                <th className="px-3 py-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-10 text-center text-muted-foreground"
                                    >
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const saldo = Number(r?.Saldo ?? 0);
                                const saldoClass =
                                    saldo > 0
                                        ? 'text-emerald-400'
                                        : saldo < 0
                                          ? 'text-rose-400'
                                          : '';
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr
                                        key={`${r?.Kode_Akun ?? idx}-${idx}`}
                                        className={[
                                            'border-t border-white/5',
                                            has00 ? 'bg-amber-500/5' : '',
                                        ].join(' ')}
                                    >
                                        <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={
                                                        has00
                                                            ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30'
                                                            : ''
                                                    }
                                                >
                                                    {kodeAkun}
                                                </span>
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
                                            {formatRupiah(r?.BB_Debit)}
                                        </td>
                                        <td className={`px-3 py-2 text-right ${cellClass}`}>
                                            {formatRupiah(r?.BB_Kredit)}
                                        </td>
                                        <td
                                            className={`px-3 py-2 text-right font-semibold ${saldoClass} ${cellClass}`}
                                        >
                                            {formatRupiah(saldo)}
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
