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
import { FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Neraca Lajur', href: '/laporan/neraca-lajur' },
];

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const buildPrintUrl = (query) => {
    const params = new URLSearchParams();
    params.set('search', query.search ?? '');
    params.set('sortBy', query.sortBy ?? 'Kode_Akun');
    params.set('sortDir', query.sortDir ?? 'asc');
    return `/laporan/neraca-lajur/print?${params.toString()}`;
};

const markedRowClass = 'bg-amber-500/5';
const markedCellClass = 'bg-amber-500/10';

function ColGroupHeader({ title }) {
    return (
        <th
            colSpan={2}
            className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
            {title}
        </th>
    );
}

function ColHeader({ title }) {
    return (
        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
        </th>
    );
}

export default function NeracaLajurIndex() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
    }, [debouncedSearch, pageSize, sortBy, sortDir]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('search', debouncedSearch);
            params.set('sortBy', sortBy);
            params.set('sortDir', sortDir);
            params.set('page', String(page));
            params.set(
                'pageSize',
                pageSize === 'all' ? 'all' : String(pageSize),
            );

            const res = await fetch(`/laporan/neraca-lajur/rows?${params.toString()}`, {
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
        } catch {
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page, sortBy, sortDir]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 10;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const printUrl = buildPrintUrl({ search: debouncedSearch, sortBy, sortDir });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Neraca Lajur" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                                <FileSpreadsheet className="h-5 w-5 text-white/80" />
                            </div>
                            <h1 className="text-xl font-semibold">Neraca Lajur</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ringkasan neraca lajur per akun (snapshot)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                                <SelectItem value="NA_Debit">NA Debit</SelectItem>
                                <SelectItem value="NA_Kredit">NA Kredit</SelectItem>
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

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-200/80">
                            Pastikan tabel/kolom `tb_neracalajur` sesuai (Kode_Akun, Nama_Akun, Saldo/AJP/NSSP/RL/NA
                            Debit-Kredit).
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

                    <table className="min-w-[1200px] w-full text-sm text-left">
                        <thead className="bg-white/5">
                            <tr className="border-b border-white/10">
                                <th
                                    rowSpan={2}
                                    className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                    Kode Akun
                                </th>
                                <th
                                    rowSpan={2}
                                    className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                    Nama Akun
                                </th>
                                <ColGroupHeader title="Saldo" />
                                <ColGroupHeader title="AJP" />
                                <ColGroupHeader title="NSSP" />
                                <ColGroupHeader title="RL" />
                                <ColGroupHeader title="NA" />
                            </tr>
                            <tr className="border-b border-white/10">
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td
                                        colSpan={12}
                                        className="px-3 py-10 text-center text-muted-foreground"
                                    >
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => (
                                (() => {
                                    const kodeAkun = String(r?.Kode_Akun ?? '');
                                    const has00 = kodeAkun.includes('00');
                                    const cellClass = has00 ? markedCellClass : '';
                                    return (
                                        <tr
                                            key={`${r?.Kode_Akun ?? idx}-${idx}`}
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
                                                        href={buildBukuBesarUrl({ kodeAkun })}
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
                                            <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>

                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Saldo_Debit)}</td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Saldo_Kredit)}</td>

                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.AJP_Debit)}</td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.AJP_Kredit)}</td>

                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NSSP_Debit)}</td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NSSP_Kredit)}</td>

                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.RL_Debit)}</td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.RL_Kredit)}</td>

                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Debit)}</td>
                                            <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Kredit)}</td>
                                        </tr>
                                    );
                                })()
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                    <span>Total data: {new Intl.NumberFormat('id-ID').format(total)}</span>
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
