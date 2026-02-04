import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/permintaan-dana-biaya' },
    { title: 'Permintaan Dana Biaya', href: '/pembayaran/permintaan-dana-biaya' },
    { title: 'Buat PDB', href: '/pembayaran/permintaan-dana-biaya/create' },
];

const formatRupiah = (value) => {
    const normalized =
        value === null || value === undefined
            ? NaN
            : Number(String(value).replace(/,/g, '').trim());
    const number = Number.isNaN(normalized) ? Number(value) : normalized;
    if (Number.isNaN(number)) return '-';
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const toNumber = (value) => {
    const normalized =
        value === null || value === undefined
            ? NaN
            : Number(String(value).replace(/,/g, '').trim());
    const number = Number.isNaN(normalized) ? Number(value) : normalized;
    return Number.isNaN(number) ? 0 : number;
};

const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export default function PermintaanDanaBiayaCreate() {
    const [tglBuat, setTglBuat] = useState(todayISO());

    const [kodeBayar, setKodeBayar] = useState('');
    const [keterangan, setKeterangan] = useState('DANA BIAYA');
    const [jumlah, setJumlah] = useState('');
    const [selectedPayCost, setSelectedPayCost] = useState(null);

    const [items, setItems] = useState([]);

    // Modal cari Pay Cost (tb_bayar)
    const [payOpen, setPayOpen] = useState(false);
    const [paySearch, setPaySearch] = useState('');
    const [payDebounced, setPayDebounced] = useState('');
    const [payPage, setPayPage] = useState(1);
    const [payPageSize, setPayPageSize] = useState(5);
    const [payRows, setPayRows] = useState([]);
    const [payTotal, setPayTotal] = useState(0);
    const [payLoading, setPayLoading] = useState(false);
    const [payError, setPayError] = useState('');

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setPayDebounced(paySearch), 450);
        return () => clearTimeout(t);
    }, [paySearch]);

    useEffect(() => {
        setPayPage(1);
    }, [payDebounced, payPageSize]);

    const payTotalPages = useMemo(() => {
        if (payPageSize === 'all') return 1;
        const size = Number(payPageSize) || 5;
        return Math.max(1, Math.ceil(payTotal / size));
    }, [payPageSize, payTotal]);

    const loadPayRows = async () => {
        if (!payOpen) return;
        setPayLoading(true);
        setPayError('');
        try {
            const params = new URLSearchParams();
            params.set('search', payDebounced);
            params.set('page', String(payPage));
            params.set('pageSize', payPageSize === 'all' ? 'all' : String(payPageSize));
            const res = await fetch(`/pembayaran/permintaan-dana-biaya/paycost-rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Gagal memuat data Pay Cost.');
            const data = await res.json();
            setPayRows(Array.isArray(data?.rows) ? data.rows : []);
            setPayTotal(Number(data?.total ?? 0));
        } catch (e) {
            setPayRows([]);
            setPayTotal(0);
            setPayError(e?.message || 'Gagal memuat data Pay Cost.');
        } finally {
            setPayLoading(false);
        }
    };

    useEffect(() => {
        loadPayRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payOpen, payDebounced, payPage, payPageSize]);

    const totals = useMemo(() => {
        const total = items.reduce((acc, it) => acc + toNumber(it.jumlah), 0);
        const bayar = items.reduce((acc, it) => acc + toNumber(it.bayar), 0);
        const sisa = items.reduce((acc, it) => acc + toNumber(it.sisa), 0);
        return { total, bayar, sisa };
    }, [items]);

    const addItem = async () => {
        const trimmedKode = String(kodeBayar).trim();
        if (!trimmedKode) {
            await Swal.fire({ icon: 'warning', title: 'Kode bayar wajib diisi.' });
            return;
        }
        if (!String(keterangan).trim()) {
            await Swal.fire({ icon: 'warning', title: 'Keterangan wajib diisi.' });
            return;
        }
        const j = toNumber(jumlah);
        if (!j || j <= 0) {
            await Swal.fire({ icon: 'warning', title: 'Jumlah wajib lebih dari 0.' });
            return;
        }
        if (items.some((it) => String(it.kode_bayar).trim() === trimmedKode)) {
            await Swal.fire({ icon: 'warning', title: 'Kode bayar sudah ada di daftar.' });
            return;
        }

        setItems((prev) => [
            ...prev,
            {
                no: prev.length + 1,
                kode_bayar: trimmedKode,
                keterangan: String(keterangan).trim(),
                jumlah: j,
                bayar: toNumber(selectedPayCost?.sum_bayar),
                sisa: toNumber(selectedPayCost?.sum_sisa),
            },
        ]);

        // Reset field input row (sesuai request: hapus semua field)
        setKodeBayar('');
        setJumlah('');
        setSelectedPayCost(null);
    };

    const removeItem = (index) => {
        setItems((prev) =>
            prev
                .filter((_, i) => i !== index)
                .map((it, idx) => ({ ...it, no: idx + 1 })),
        );
    };

    const save = async () => {
        if (items.length === 0) {
            await Swal.fire({ icon: 'warning', title: 'Daftar masih kosong.' });
            return;
        }

        setSaving(true);
        router.post(
            '/pembayaran/permintaan-dana-biaya',
            {
                tgl_buat: tglBuat,
                items: items.map((it) => ({
                    kode_bayar: it.kode_bayar,
                    keterangan: it.keterangan,
                    jumlah: it.jumlah,
                    bayar: it.bayar,
                    sisa: it.sisa,
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onError: async (errs) => {
                    const first = Object.values(errs || {})?.[0];
                    const msg = Array.isArray(first) ? first[0] : first;
                    if (msg) {
                        await Swal.fire({ icon: 'error', title: msg });
                    }
                },
            },
        );
    };

    const selectPayCost = (row) => {
        const kb = String(row?.kode_bayar ?? '').trim();
        if (!kb) return;
        setSelectedPayCost(row);
        setKodeBayar(kb);
        // Default: gunakan sisa jika ada, kalau tidak pakai total.
        const suggested = toNumber(row?.sum_sisa) > 0 ? toNumber(row?.sum_sisa) : toNumber(row?.sum_total);
        setJumlah(suggested ? String(suggested) : '');
        setPayOpen(false);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buat Permintaan Dana Biaya" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Pembayaran</div>
                        <div className="text-2xl font-semibold tracking-tight">Permintaan Dana Biaya</div>
                        <div className="text-sm text-muted-foreground">
                            Pilih Pay Cost → isi keterangan & jumlah → Masuk ke daftar → Simpan.
                        </div>
                    </div>

                    <Card className="w-full lg:w-[560px]">
                        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                    <div className="text-[11px] text-muted-foreground">Total</div>
                                    <div className="text-sm font-semibold tabular-nums">{formatRupiah(totals.total)}</div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                    <div className="text-[11px] text-muted-foreground">Bayar</div>
                                    <div className="text-sm font-semibold tabular-nums">{formatRupiah(totals.bayar)}</div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                    <div className="text-[11px] text-muted-foreground">Sisa</div>
                                    <div className="text-sm font-semibold tabular-nums">{formatRupiah(totals.sisa)}</div>
                                </div>
                            </div>
                            <Button onClick={save} disabled={saving} className="h-10 w-full gap-2 sm:w-auto">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Simpan
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                    <Card className="xl:col-span-5">
                        <CardHeader>
                            <CardTitle className="text-base">Input</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">No. Pay Cost</div>
                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                                        <Input
                                            value={kodeBayar}
                                            onChange={(e) => setKodeBayar(e.target.value)}
                                            placeholder="SJA/PC/0000xxxx"
                                            className="h-12 w-full text-base font-medium tracking-wide"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12 w-full gap-2 sm:w-auto"
                                            onClick={() => setPayOpen(true)}
                                        >
                                            <Search className="h-4 w-4" />
                                            Cari
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Tanggal Buat</div>
                                    <Input
                                        type="date"
                                        value={tglBuat}
                                        onChange={(e) => setTglBuat(e.target.value)}
                                        className="h-12 w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2 md:col-span-2">
                                    <div className="text-xs text-muted-foreground">Keterangan</div>
                                    <Input
                                        value={keterangan}
                                        onChange={(e) => setKeterangan(e.target.value)}
                                        placeholder="Contoh: DANA BIAYA"
                                        className="h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Jumlah</div>
                                    <Input
                                        value={jumlah}
                                        onChange={(e) => setJumlah(e.target.value)}
                                        placeholder="0"
                                        className="h-12 text-right text-base"
                                        inputMode="decimal"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="text-xs text-muted-foreground">
                                    Tips: pilih Pay Cost dulu supaya Bayar &amp; Sisa ikut terisi.
                                </div>
                                <Button type="button" className="h-10 gap-2" onClick={addItem}>
                                    <Plus className="h-4 w-4" />
                                    Masuk ke Daftar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-7">
                        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base">Daftar</CardTitle>
                            <div className="text-sm text-muted-foreground">
                                Total item: <span className="font-medium">{items.length}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-hidden rounded-xl border border-white/10">
                                <div className="overflow-auto">
                                    <Table className="w-full">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[56px]">No</TableHead>
                                                <TableHead className="w-[240px]">Kode Bayar</TableHead>
                                                <TableHead>Keterangan</TableHead>
                                                <TableHead className="w-[220px] text-right">Nilai</TableHead>
                                                <TableHead className="w-[64px] text-center">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                        Belum ada data.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                items.map((it, idx) => (
                                                    <TableRow key={`${it.kode_bayar}-${idx}`}>
                                                        <TableCell>{it.no}</TableCell>
                                                        <TableCell className="font-medium break-all">{it.kode_bayar}</TableCell>
                                                        <TableCell className="whitespace-normal break-words">
                                                            {it.keterangan}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            <div className="font-semibold">{formatRupiah(it.jumlah)}</div>
                                                            <div className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span>Bayar</span>
                                                                    <span className="font-medium tabular-nums text-foreground/80">
                                                                        {formatRupiah(it.bayar)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span>Sisa</span>
                                                                    <span className="font-medium tabular-nums text-foreground/80">
                                                                        {formatRupiah(it.sisa)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => removeItem(idx)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={payOpen} onOpenChange={setPayOpen}>
                {/* Override default `sm:max-w-lg` from DialogContent to avoid narrow modal on desktop. */}
                <DialogContent className="h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)] sm:!max-w-6xl">
                    <DialogHeader>
                        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                            <DialogTitle>Cari Pay Cost</DialogTitle>
                            <DialogDescription>
                                Data diambil dari tb_bayar (distinct Kode_Bayar). Pilih salah satu untuk mengisi form.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex h-[calc(100%-76px)] flex-col gap-4 px-5 pb-5 pt-4 sm:h-[calc(100%-82px)] sm:px-6 sm:pb-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Input
                                value={paySearch}
                                onChange={(e) => setPaySearch(e.target.value)}
                                placeholder="Cari Kode Bayar / Keterangan / Penanggung..."
                                className="h-10 w-full sm:w-[420px]"
                            />
                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    Tampil
                                    <Select
                                        value={String(payPageSize)}
                                        onValueChange={(value) =>
                                            setPayPageSize(value === 'all' ? 'all' : Number(value))
                                        }
                                    >
                                        <SelectTrigger className="h-10 w-[120px]">
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

                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
                            {payLoading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            )}
                            <div className="h-full overflow-auto">
                                <Table className="w-full min-w-[980px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kode Bayar</TableHead>
                                            <TableHead className="hidden md:table-cell">Penanggung</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Bayar</TableHead>
                                            <TableHead className="text-right">Sisa</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payRows.length === 0 && !payLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                    {payError || 'Tidak ada data.'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            payRows.map((row) => (
                                                <TableRow
                                                    key={row?.kode_bayar}
                                                    className="cursor-pointer hover:bg-white/5"
                                                    onClick={() => selectPayCost(row)}
                                                >
                                                    <TableCell className="font-medium">{row?.kode_bayar}</TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        {row?.penanggung ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal break-words">
                                                        {row?.keterangan ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatRupiah(row?.sum_total)}</TableCell>
                                                    <TableCell className="text-right">{formatRupiah(row?.sum_bayar)}</TableCell>
                                                    <TableCell className="text-right">{formatRupiah(row?.sum_sisa)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <div>Total data: {payTotal}</div>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={payPage <= 1 || payPageSize === 'all'}
                                    onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {payPage} / {payTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={payPage >= payTotalPages || payPageSize === 'all'}
                                    onClick={() => setPayPage((p) => Math.min(payTotalPages, p + 1))}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
