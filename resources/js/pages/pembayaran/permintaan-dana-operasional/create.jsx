import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/permintaan-dana-operasional' },
    { title: 'Permintaan Dana Operasional', href: '/pembayaran/permintaan-dana-operasional' },
    { title: 'Buat PDO', href: '/pembayaran/permintaan-dana-operasional/create' },
];

const todayDotted = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

const dottedToISO = (dotted) => {
    const raw = String(dotted ?? '').trim();
    const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
};

const isoToDotted = (iso) => {
    const raw = String(iso ?? '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return `${m[3]}.${m[2]}.${m[1]}`;
};

const isValidDottedDate = (dotted) => /^(\d{2})\.(\d{2})\.(\d{4})$/.test(String(dotted ?? '').trim());

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const normalized = String(value).replace(/,/g, '').trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
};

const formatRupiah = (value) => {
    const n = toNumber(value);
    return `Rp. ${new Intl.NumberFormat('id-ID').format(n)}`;
};

function toastWarn(message) {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: message,
        showConfirmButton: false,
        timer: 2800,
        timerProgressBar: true,
    });
}

function toastError(message) {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: message,
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
    });
}

function DataPickerModal({
    open,
    onOpenChange,
    onPickRow,
}) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

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

    const load = async () => {
        if (!open) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('search', debouncedSearch);
            params.set('page', String(page));
            params.set('pageSize', pageSize === 'all' ? 'all' : String(pageSize));
            const res = await fetch(
                `/pembayaran/permintaan-dana-operasional/fi-rows?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!res.ok) throw new Error('Gagal memuat data FI.');
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch (e) {
            setRows([]);
            setTotal(0);
            toastError(e?.message || 'Gagal memuat data FI.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, debouncedSearch, pageSize, page]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] p-0 sm:max-w-6xl">
                <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-slate-950/70 px-4 py-3">
                    <DialogTitle className="flex items-center justify-between">
                        <span>Cari FI</span>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari No Doc, Ref PO, Vendor..."
                                className="pl-9"
                            />
                            <div className="mt-1 text-[11px] text-muted-foreground">
                                Pencarian: <span className="font-medium">no_doc</span>,{' '}
                                <span className="font-medium">ref_po</span>,{' '}
                                <span className="font-medium">nm_vdr</span>.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="all">Semua</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="relative mt-4 overflow-x-auto rounded-xl border border-white/10 bg-card">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                                </div>
                            </div>
                        )}
                        <div className="max-h-[65vh] overflow-auto">
                            <table className="min-w-full text-sm text-left">
                                <thead className="sticky top-0 bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                                    <tr>
                                        <th className="px-3 py-3">No FI</th>
                                        <th className="px-3 py-3">No Inv</th>
                                        <th className="px-3 py-3">Inv Date</th>
                                        <th className="px-3 py-3">Ref PO</th>
                                        <th className="px-3 py-3">Vendor</th>
                                        <th className="px-3 py-3 text-right">Total</th>
                                        <th className="px-3 py-3 text-right">Bayar</th>
                                        <th className="px-3 py-3 text-right">Sisa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && !loading && (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((r, idx) => (
                                        <tr
                                            key={`${r?.no_doc ?? 'fi'}-${idx}`}
                                            className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                                            onClick={() => {
                                                onPickRow(r);
                                                onOpenChange(false);
                                            }}
                                        >
                                            <td className="px-3 py-2 font-medium">
                                                {r?.no_doc ?? '-'}
                                            </td>
                                            <td className="px-3 py-2">{r?.t_doc ?? '-'}</td>
                                            <td className="px-3 py-2">{r?.inv_d ?? '-'}</td>
                                            <td className="px-3 py-2">{r?.ref_po ?? '-'}</td>
                                            <td className="px-3 py-2">{r?.nm_vdr ?? '-'}</td>
                                            <td className="px-3 py-2 text-right">
                                                {formatRupiah(r?.total ?? 0)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {formatRupiah(r?.pembayaran ?? 0)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {formatRupiah(r?.sisa_bayar ?? 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                        <span>Total data: {new Intl.NumberFormat('id-ID').format(total)}</span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === 1 || loading}
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
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function PermintaanDanaOperasionalCreate() {
    const [fiModalOpen, setFiModalOpen] = useState(false);
    const [fiLoading, setFiLoading] = useState(false);
    const [lastPdo, setLastPdo] = useState(0);
    const [pdoNowDirty, setPdoNowDirty] = useState(false);

    const [form, setForm] = useState({
        no_fi: '',
        no_inv: '',
        inv_date: '',
        ref_po: '',
        vendor: '',
        jumlah_inv: 0,
        jumlah_bayar: 0,
        // tgl bayar default hari ini, user bisa ubah (disimpan dd.mm.yyyy)
        tgl_bayar: todayDotted(),
        remark: '',
        pdo_now: 0,
    });

    const [items, setItems] = useState([]);
    const [saving, setSaving] = useState(false);

    const lastEndPdo = useMemo(() => {
        const pdoNow = toNumber(form.pdo_now);
        const paid = toNumber(form.jumlah_bayar);
        return pdoNow + paid;
    }, [form.jumlah_bayar, form.pdo_now]);

    const totals = useMemo(() => {
        const totalPdo = items.reduce((acc, it) => acc + toNumber(it.jumlah_inv), 0);
        // Total Transfer = jumlah bayar (sum)
        const totalTransfer = items.reduce((acc, it) => acc + toNumber(it.jumlah_bayar), 0);
        // Total PDO Now = sisa pdo (sum)
        const totalPdoNow = items.reduce((acc, it) => acc + toNumber(it.pdo_now), 0);
        return { totalPdo, totalTransfer, totalPdoNow };
    }, [items]);

    useEffect(() => {
        // Auto-calc PDO Now when user edits "Jumlah Bayar", unless user overrides PDO Now manually.
        if (pdoNowDirty) return;
        const computed = Math.max(0, toNumber(form.jumlah_inv) - toNumber(form.jumlah_bayar));
        setForm((p) => ({ ...p, pdo_now: computed }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.jumlah_inv, form.jumlah_bayar, pdoNowDirty]);

    const pickFiRow = async (row) => {
        const noDoc = row?.no_doc;
        if (!noDoc) return;
        setFiLoading(true);
        try {
            const res = await fetch(
                `/pembayaran/permintaan-dana-operasional/fi/${encodeURIComponent(noDoc)}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!res.ok) throw new Error('Gagal memuat detail FI.');
            const data = await res.json();
            const header = data?.header ?? row;
            const lp = toNumber(data?.last_pdo ?? 0);
            setLastPdo(lp);

            const totalInv = toNumber(header?.total);
            const bayar = toNumber(header?.pembayaran);
            const pdoNow = Math.max(0, totalInv - bayar);

            setForm((prev) => ({
                ...prev,
                no_fi: header?.no_doc ?? noDoc,
                no_inv: header?.t_doc ?? '',
                inv_date: header?.inv_d ?? '',
                ref_po: header?.ref_po ?? '',
                vendor: header?.nm_vdr ?? '',
                jumlah_inv: totalInv,
                jumlah_bayar: bayar,
                pdo_now: pdoNow,
            }));
            setPdoNowDirty(false);
        } catch (e) {
            toastError(e?.message || 'Gagal memuat detail FI.');
        } finally {
            setFiLoading(false);
        }
    };

    const addRow = () => {
        if (!form.no_fi) {
            toastWarn('Pilih No Doc FI dulu.');
            return;
        }
        const bayar = toNumber(form.jumlah_bayar);
        // Jika jumlah bayar = 0, tgl bayar harus disimpan spasi (kolom DB tidak boleh NULL).
        // Validasi format tanggal tidak diperlukan.
        const tglBayar = bayar === 0 ? ' ' : String(form.tgl_bayar ?? '');
        if (bayar !== 0 && !isValidDottedDate(tglBayar)) {
            toastWarn('Pay Date wajib format dd.mm.yyyy.');
            return;
        }
        const pdoNow = toNumber(form.pdo_now);
        if (pdoNow < 0) {
            toastWarn('PDO Now tidak boleh minus.');
            return;
        }
        const next = {
            no_fi: String(form.no_fi),
            no_inv: String(form.no_inv ?? ''),
            inv_date: String(form.inv_date ?? ''),
            ref_po: String(form.ref_po ?? ''),
            vendor: String(form.vendor ?? ''),
            jumlah_inv: toNumber(form.jumlah_inv),
            jumlah_bayar: bayar,
            tgl_bayar: tglBayar,
            remark: String(form.remark ?? ''),
            last_pdo: toNumber(lastPdo),
            pdo_now: pdoNow,
            lastend_pdo: toNumber(lastEndPdo),
        };

        setItems((prev) => [...prev, next]);

        // Clear FI-specific fields
        setForm((prev) => ({
            ...prev,
            no_fi: '',
            no_inv: '',
            inv_date: '',
            ref_po: '',
            vendor: '',
            jumlah_inv: 0,
            jumlah_bayar: 0,
            remark: '',
            pdo_now: 0,
        }));
        setLastPdo(0);
        setPdoNowDirty(false);
    };

    const removeRow = (idx) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const save = () => {
        if (items.length === 0) {
            toastWarn('Data PDO masih kosong.');
            return;
        }
        // Sanitasi payload: pastikan tgl_bayar selalu ada.
        // Rule: jika jumlah_bayar = 0 -> tgl_bayar = ' '.
        // Selain itu, tgl_bayar wajib dd.mm.yyyy (fallback: hari ini).
        const cleanedItems = items.map((it) => {
            const bayar = toNumber(it.jumlah_bayar);
            if (bayar === 0) {
                return { ...it, tgl_bayar: ' ' };
            }
            const tgl = String(it.tgl_bayar ?? '').trim();
            return {
                ...it,
                tgl_bayar: isValidDottedDate(tgl) ? tgl : todayDotted(),
            };
        });

        setSaving(true);
        router.post(
            '/pembayaran/permintaan-dana-operasional',
            {
                items: cleanedItems,
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buat PDO" />
            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-slate-950/70 px-5 py-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="text-xs text-muted-foreground">Pembayaran</div>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                                Permintaan Dana Operasional
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Pilih FI → isi pay date & remark → Masuk ke daftar → Simpan.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* actions moved to ringkasan card */}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
                    <Card className="rounded-2xl border-white/10 bg-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Input PDO</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="text-xs text-muted-foreground">No. Doc FI</div>
                                            <div className="mt-1 font-medium break-all">
                                                {form.no_fi ? form.no_fi : 'Belum dipilih'}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => setFiModalOpen(true)}
                                            className="gap-2"
                                            disabled={fiLoading}
                                        >
                                            {fiLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Search className="h-4 w-4" />
                                            )}
                                            Cari FI
                                        </Button>
                                    </div>

                                    <div className="grid gap-3">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Vendor</div>
                                            <div className="mt-1 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm">
                                                <div className="break-words leading-snug">
                                                    {form.vendor ? form.vendor : '-'}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Pay Date</div>
                                            <Input
                                                className="mt-1"
                                                type="date"
                                                value={dottedToISO(form.tgl_bayar)}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        tgl_bayar:
                                                            isoToDotted(e.target.value) || todayDotted(),
                                                    }))
                                                }
                                            />
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                Disimpan format{' '}
                                                <span className="font-medium">dd.mm.yyyy</span>.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/40 to-black/10 p-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <div className="text-xs text-muted-foreground">No. Invoice</div>
                                            <Input className="mt-1" value={form.no_inv} readOnly />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Inv. Date</div>
                                            <Input className="mt-1" value={form.inv_date} readOnly />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <div className="text-xs text-muted-foreground">Ref. PO</div>
                                            <Input className="mt-1" value={form.ref_po} readOnly />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="text-[11px] text-muted-foreground">Total Inv</div>
                                    <div className="mt-1 text-sm font-semibold">
                                        {formatRupiah(form.jumlah_inv)}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="text-[11px] text-muted-foreground">Jumlah Bayar</div>
                                    <Input
                                        className="mt-2"
                                        value={String(form.jumlah_bayar)}
                                        onChange={(e) => {
                                            setPdoNowDirty(false);
                                            setForm((p) => ({ ...p, jumlah_bayar: e.target.value }));
                                        }}
                                        inputMode="numeric"
                                    />
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                        Editable (angka).
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="text-[11px] text-muted-foreground">Last PDO</div>
                                    <div className="mt-1 text-sm font-semibold">{formatRupiah(lastPdo)}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="text-[11px] text-muted-foreground">Last End PDO</div>
                                    <div className="mt-1 text-sm font-semibold">
                                        {formatRupiah(lastEndPdo)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                                <div>
                                    <div className="text-xs text-muted-foreground">Remark</div>
                                    <Textarea
                                        className="mt-1 min-h-[160px]"
                                        value={form.remark}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, remark: e.target.value }))
                                        }
                                        placeholder="Tambahkan catatan..."
                                    />
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="text-xs text-muted-foreground">PDO Now</div>
                                    <Input
                                        className="mt-1"
                                        value={String(form.pdo_now)}
                                        onChange={(e) => {
                                            setPdoNowDirty(true);
                                            setForm((p) => ({ ...p, pdo_now: e.target.value }));
                                        }}
                                        inputMode="numeric"
                                    />
                                    <div className="mt-2 text-[11px] text-muted-foreground">
                                        Default: Total Inv - Jumlah Bayar.
                                        <br />
                                        Tidak boleh minus.
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={addRow}
                                        className="mt-3 w-full gap-2"
                                    >
                                        Masuk ke Daftar
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-white/10 bg-card lg:sticky lg:top-4 lg:self-start">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Ringkasan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total PDO</span>
                                    <span className="font-semibold text-white">{formatRupiah(totals.totalPdo)}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total Transfer</span>
                                    <span className="font-semibold text-white">{formatRupiah(totals.totalTransfer)}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total PDO Now</span>
                                    <span className="font-semibold text-white">{formatRupiah(totals.totalPdoNow)}</span>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-xs text-muted-foreground">
                                Posting Date diisi otomatis saat klik <span className="font-medium">Simpan</span> (format
                                dd.mm.yyyy).
                            </div>
                            <Button
                                type="button"
                                onClick={save}
                                disabled={saving || items.length === 0}
                                className="w-full gap-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Simpan
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-2xl border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Data PDO</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-card">
                            <div className="max-h-[60vh] overflow-auto">
                                <table className="min-w-[1200px] w-full text-sm">
                                    <thead className="sticky top-0 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-slate-950/70 text-muted-foreground uppercase text-[11px] tracking-wide">
                                        <tr>
                                            <th className="px-3 py-3">No</th>
                                            <th className="px-3 py-3">No Doc FI</th>
                                            <th className="px-3 py-3">No Inv</th>
                                            <th className="px-3 py-3">Inv Date</th>
                                            <th className="px-3 py-3">Ref PO</th>
                                            <th className="px-3 py-3">Vendor</th>
                                            <th className="px-3 py-3 text-right">Total Inv</th>
                                            <th className="px-3 py-3 text-right">Jumlah Bayar</th>
                                            <th className="px-3 py-3">Tgl Bayar</th>
                                            <th className="px-3 py-3 text-right">Last PDO</th>
                                            <th className="px-3 py-3 text-right">PDO Now</th>
                                            <th className="px-3 py-3 text-right">Last End PDO</th>
                                            <th className="px-3 py-3">Remark</th>
                                            <th className="px-3 py-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                                                    Belum ada data.
                                                </td>
                                            </tr>
                                        )}
                                        {items.map((it, idx) => (
                                            <tr
                                                key={`${it.no_fi}-${idx}`}
                                                className="border-t border-white/5 hover:bg-white/5"
                                            >
                                                <td className="px-3 py-2">{idx + 1}</td>
                                                <td className="px-3 py-2 font-medium">{it.no_fi}</td>
                                                <td className="px-3 py-2">{it.no_inv || '-'}</td>
                                                <td className="px-3 py-2">{it.inv_date || '-'}</td>
                                                <td className="px-3 py-2">{it.ref_po || '-'}</td>
                                                <td className="px-3 py-2">{it.vendor || '-'}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(it.jumlah_inv)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(it.jumlah_bayar)}</td>
                                                <td className="px-3 py-2">
                                                    {String(it.tgl_bayar ?? '').trim() === '' ? '-' : it.tgl_bayar}
                                                </td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(it.last_pdo)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(it.pdo_now)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(it.lastend_pdo)}</td>
                                                <td className="px-3 py-2">{it.remark || '-'}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeRow(idx)}
                                                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <DataPickerModal
                    open={fiModalOpen}
                    onOpenChange={setFiModalOpen}
                    onPickRow={pickFiRow}
                />
            </div>
        </AppLayout>
    );
}
