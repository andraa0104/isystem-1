import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Loader2, Plus, Printer } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/permintaan-dana-biaya' },
    { title: 'Permintaan Dana Biaya', href: '/pembayaran/permintaan-dana-biaya' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

const formatRupiah = (value) => {
    const normalized =
        value === null || value === undefined
            ? NaN
            : Number(String(value).replace(/,/g, '').trim());
    const number = Number.isNaN(normalized) ? Number(value) : normalized;
    if (Number.isNaN(number)) return '-';
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const toNumber = (value) => {
    const normalized =
        value === null || value === undefined
            ? NaN
            : Number(String(value).replace(/,/g, '').trim());
    const number = Number.isNaN(normalized) ? Number(value) : normalized;
    return Number.isNaN(number) ? 0 : number;
};

export default function PermintaanDanaBiayaIndex() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailNo, setDetailNo] = useState('');
    const [detailRows, setDetailRows] = useState([]);
    const [detailTotal, setDetailTotal] = useState(0);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailPage, setDetailPage] = useState(1);

    const [bayarOpen, setBayarOpen] = useState(false);
    const [bayarKode, setBayarKode] = useState('');
    const [bayarRows, setBayarRows] = useState([]);
    const [bayarLoading, setBayarLoading] = useState(false);
    const [bayarError, setBayarError] = useState('');
    const [bayarTotal, setBayarTotal] = useState(0);
    const [bayarPageSize, setBayarPageSize] = useState(5);
    const [bayarPage, setBayarPage] = useState(1);
    const [bayarSumsServer, setBayarSumsServer] = useState({ total: 0, bayar: 0, sisa: 0 });

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 450);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 5;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const loadRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('search', debouncedSearch);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));
            const res = await fetch(`/pembayaran/permintaan-dana-biaya/rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Gagal memuat data.');
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch (e) {
            setRows([]);
            setTotal(0);
            setError(e?.message || 'Gagal memuat data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize, page]);

    const detailTotalPages = useMemo(() => {
        if (detailPageSize === 'all') return 1;
        const size = Number(detailPageSize) || 5;
        return Math.max(1, Math.ceil(detailTotal / size));
    }, [detailPageSize, detailTotal]);

    const loadDetail = async () => {
        if (!detailOpen || !detailNo) return;
        setDetailLoading(true);
        setDetailError('');
        try {
            const params = new URLSearchParams();
            params.set('no_pdb', detailNo);
            params.set('page', String(detailPage));
            params.set('pageSize', detailPageSize === 'all' ? 'all' : String(detailPageSize));
            const res = await fetch(
                `/pembayaran/permintaan-dana-biaya/detail-rows?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.message || 'Gagal memuat detail PDB.');
            }
            const data = await res.json();
            setDetailRows(Array.isArray(data?.rows) ? data.rows : []);
            setDetailTotal(Number(data?.total ?? 0));
        } catch (e) {
            setDetailRows([]);
            setDetailTotal(0);
            setDetailError(e?.message || 'Gagal memuat detail PDB.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailOpen, detailNo, detailPage, detailPageSize]);

    const openDetail = (noPdb) => {
        setDetailNo(noPdb);
        setDetailPage(1);
        setDetailPageSize(5);
        setDetailOpen(true);
    };

    const loadBayar = async (kodeBayar) => {
        setBayarLoading(true);
        setBayarError('');
        try {
            const params = new URLSearchParams();
            params.set('kode_bayar', kodeBayar);
            params.set('page', String(bayarPage));
            params.set('pageSize', bayarPageSize === 'all' ? 'all' : String(bayarPageSize));
            const res = await fetch(`/pembayaran/permintaan-dana-biaya/bayar-detail?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.message || 'Gagal memuat detail pembayaran.');
            }
            const data = await res.json();
            setBayarRows(Array.isArray(data?.rows) ? data.rows : []);
            setBayarTotal(Number(data?.total ?? 0));
            setBayarSumsServer({
                total: Number(data?.sums?.total ?? 0),
                bayar: Number(data?.sums?.bayar ?? 0),
                sisa: Number(data?.sums?.sisa ?? 0),
            });
        } catch (e) {
            setBayarRows([]);
            setBayarTotal(0);
            setBayarSumsServer({ total: 0, bayar: 0, sisa: 0 });
            setBayarError(e?.message || 'Gagal memuat detail pembayaran.');
        } finally {
            setBayarLoading(false);
        }
    };

    const openBayar = (kodeBayar) => {
        if (!kodeBayar) return;
        setBayarKode(kodeBayar);
        setBayarPage(1);
        setBayarPageSize(5);
        setBayarOpen(true);
    };

    const bayarTotalPages = useMemo(() => {
        if (bayarPageSize === 'all') return 1;
        const size = Number(bayarPageSize) || 5;
        return Math.max(1, Math.ceil(bayarTotal / size));
    }, [bayarPageSize, bayarTotal]);

    useEffect(() => {
        if (!bayarOpen || !bayarKode) return;
        loadBayar(bayarKode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bayarOpen, bayarKode, bayarPage, bayarPageSize]);

    const printPdb = (noPdb) => {
        const params = new URLSearchParams();
        params.set('no_pdb', noPdb);
        window.open(`/pembayaran/permintaan-dana-biaya/print?${params.toString()}`, '_blank');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permintaan Dana Biaya" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm text-muted-foreground">Pembayaran</div>
                        <div className="text-2xl font-semibold">Permintaan Dana Biaya</div>
                        <div className="text-sm text-muted-foreground">
                            Ringkasan permintaan dana biaya berdasarkan PDB.
                        </div>
                    </div>
                    <Button asChild className="gap-2">
                        <Link href="/pembayaran/permintaan-dana-biaya/create">
                            <Plus className="h-4 w-4" />
                            Add PDB
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Data PDB</CardTitle>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari No PDB..."
                                    className="h-9 w-64"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                Tampil
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(value) => setPageSize(value === 'all' ? 'all' : Number(value))}
                                >
                                    <SelectTrigger className="h-9 w-[110px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="all">Semua</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        )}
                        <div className="overflow-hidden rounded-xl border border-white/10">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No PDB</TableHead>
                                        <TableHead>Tgl Buat</TableHead>
                                        <TableHead>Kas Bank</TableHead>
                                        <TableHead>Kas Tunai</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Transfer</TableHead>
                                        <TableHead>Sisa</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 && !loading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-muted-foreground">
                                                {error || 'Tidak ada data.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((row) => (
                                            <TableRow key={`${row?.no_pdb}-${row?.tgl_buat}`}>
                                                <TableCell className="font-medium">{renderValue(row?.no_pdb)}</TableCell>
                                                <TableCell>{formatDate(row?.tgl_buat)}</TableCell>
                                                <TableCell>{formatRupiah(row?.kas_bank)}</TableCell>
                                                <TableCell>{formatRupiah(row?.kas_tunai)}</TableCell>
                                                <TableCell>{formatRupiah(row?.total)}</TableCell>
                                                <TableCell>{formatRupiah(row?.transfer)}</TableCell>
                                                <TableCell>{formatRupiah(row?.sisa)}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => openDetail(row?.no_pdb)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => printPdb(row?.no_pdb)}
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div>Total data: {formatNumber(total)}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1 || pageSize === 'all'}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {page} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages || pageSize === 'all'}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* modal={false} so a stacked fullscreen overlay (Detail Pembayaran) can still receive pointer events. */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen} modal={false}>
                <DialogContent
                    className="max-w-5xl"
                    // Prevent closing Detail PDB when user interacts with the stacked fullscreen Detail Pembayaran.
                    // Radix treats those interactions as "outside" clicks, which would close this dialog.
                    onPointerDownOutside={(e) => {
                        if (bayarOpen) e.preventDefault();
                    }}
                    onInteractOutside={(e) => {
                        if (bayarOpen) e.preventDefault();
                    }}
                    onFocusOutside={(e) => {
                        if (bayarOpen) e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Detail PDB</DialogTitle>
                        <DialogDescription>
                            No PDB: <span className="font-medium">{renderValue(detailNo)}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground"></div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            Tampil
                            <Select
                                value={String(detailPageSize)}
                                onValueChange={(value) =>
                                    setDetailPageSize(value === 'all' ? 'all' : Number(value))
                                }
                            >
                                <SelectTrigger className="h-8 w-[110px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="all">Semua</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10">
                        {detailLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No</TableHead>
                                    <TableHead>Kode Bayar</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailRows.length === 0 && !detailLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            {detailError || 'Tidak ada data.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    detailRows.map((row, index) => (
                                        <TableRow key={`${row?.kode_bayar}-${row?.no}-${index}`}>
                                            <TableCell>{row?.no ?? index + 1}</TableCell>
                                            <TableCell>
                                                <button
                                                    type="button"
                                                    className="text-primary underline"
                                                    onClick={() => openBayar(row?.kode_bayar)}
                                                >
                                                    {renderValue(row?.kode_bayar)}
                                                </button>
                                            </TableCell>
                                            <TableCell>{renderValue(row?.keterangan)}</TableCell>
                                            <TableCell className="text-right">
                                                {formatRupiah(row?.jumlah)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                        <div>Total data: {formatNumber(detailTotal)}</div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={detailPage <= 1 || detailPageSize === 'all'}
                                onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                            >
                                Sebelumnya
                            </Button>
                            <span>
                                Halaman {detailPage} / {detailTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={detailPage >= detailTotalPages || detailPageSize === 'all'}
                                onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {bayarOpen && (
                <div className="fixed inset-0 z-[300] flex flex-col bg-background text-foreground">
                    <div className="relative border-b border-white/10 p-6 pb-4">
                        {bayarLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xl font-semibold">Detail Pembayaran</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Kode Bayar: <span className="font-medium">{renderValue(bayarKode)}</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onMouseDown={(e) => {
                                    // Prevent "click-through" to the dialog behind after this overlay unmounts.
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.setTimeout(() => setBayarOpen(false), 0);
                                }}
                            >
                                <span className="sr-only">Close</span>
                                ×
                            </Button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                Tampil
                                <Select
                                    value={String(bayarPageSize)}
                                    onValueChange={(value) => setBayarPageSize(value === 'all' ? 'all' : Number(value))}
                                >
                                    <SelectTrigger className="h-8 w-[110px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="all">Semua</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 pt-4">
                        <div className="overflow-auto rounded-xl border border-white/10">
                            <Table className="w-full md:min-w-[1100px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="hidden md:table-cell">Penanggung</TableHead>
                                        <TableHead className="hidden md:table-cell">Total</TableHead>
                                        <TableHead className="hidden md:table-cell">Bayar</TableHead>
                                        <TableHead className="hidden md:table-cell">Sisa</TableHead>
                                        <TableHead className="hidden md:table-cell">Akun</TableHead>
                                        <TableHead className="hidden md:table-cell">No Dokumen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bayarRows.length === 0 && !bayarLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                                                {bayarError || 'Tidak ada data.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        bayarRows.map((row, index) => (
                                            <TableRow key={`${row?.Kode_Bayar}-${row?.No}-${index}`}>
                                                <TableCell>{row?.No ?? index + 1}</TableCell>
                                                <TableCell className="whitespace-normal break-words">
                                                    <div className="space-y-2">
                                                        <div>{renderValue(row?.Keterangan)}</div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground md:hidden">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>Penanggung</span>
                                                                <span className="text-foreground/90">
                                                                    {renderValue(row?.Penanggung)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>Total</span>
                                                                <span className="text-foreground/90">
                                                                    {formatRupiah(row?.Total)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>Bayar</span>
                                                                <span className="text-foreground/90">
                                                                    {formatRupiah(row?.Bayar)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>Sisa</span>
                                                                <span className="text-foreground/90">
                                                                    {formatRupiah(row?.Sisa)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>Akun</span>
                                                                <span className="text-foreground/90">
                                                                    {renderValue(row?.beban_akun)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>No Dok</span>
                                                                <span className="text-foreground/90">
                                                                    {renderValue(row?.noduk_beban)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">{renderValue(row?.Penanggung)}</TableCell>
                                                <TableCell className="hidden md:table-cell">{formatRupiah(row?.Total)}</TableCell>
                                                <TableCell className="hidden md:table-cell">{formatRupiah(row?.Bayar)}</TableCell>
                                                <TableCell className="hidden md:table-cell">{formatRupiah(row?.Sisa)}</TableCell>
                                                <TableCell className="hidden md:table-cell">{renderValue(row?.beban_akun)}</TableCell>
                                                <TableCell className="hidden md:table-cell">{renderValue(row?.noduk_beban)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="border-t border-white/10 p-6 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div>Total data: {formatNumber(bayarTotal)}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={bayarPage <= 1 || bayarPageSize === 'all'}
                                    onClick={() => setBayarPage((p) => Math.max(1, p - 1))}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {bayarPage} / {bayarTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={bayarPage >= bayarTotalPages || bayarPageSize === 'all'}
                                    onClick={() => setBayarPage((p) => Math.min(bayarTotalPages, p + 1))}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Sum Total</span>
                                <span className="font-semibold">{formatRupiah(bayarSumsServer.total)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Sum Bayar</span>
                                <span className="font-semibold">{formatRupiah(bayarSumsServer.bayar)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Sum Sisa</span>
                                <span className="font-semibold">{formatRupiah(bayarSumsServer.sisa)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
