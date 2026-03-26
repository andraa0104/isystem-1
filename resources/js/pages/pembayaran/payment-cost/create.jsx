import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
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
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/payment-cost' },
    { title: 'Payment Cost', href: '/pembayaran/payment-cost' },
    { title: 'Add Payment', href: '/pembayaran/payment-cost/create' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
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

function toastSuccess(message) {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: message,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
    });
}

function DataPickerModal({
    open,
    onOpenChange,
    title,
    columns,
    fetchUrl,
    searchPlaceholder,
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
        const t = setTimeout(() => setDebouncedSearch(search), 400);
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
            const res = await fetch(`${fetchUrl}?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch (e) {
            setRows([]);
            setTotal(0);
            toastError('Gagal memuat data.');
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
            <DialogContent className="max-w-[98vw] sm:max-w-5xl p-0">
                <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-slate-950/70 px-4 py-3">
                    <DialogTitle className="flex items-center justify-between">
                        <span>{title}</span>
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
                                placeholder={searchPlaceholder}
                                className="pl-9"
                            />
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
                                        {columns.map((c) => (
                                            <th key={c.key} className="px-3 py-3">
                                                {c.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && !loading && (
                                        <tr>
                                            <td
                                                colSpan={columns.length}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((r, idx) => (
                                        <tr
                                            key={idx}
                                            className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                                            onClick={() => {
                                                onPickRow(r);
                                                onOpenChange(false);
                                            }}
                                        >
                                            {columns.map((c) => (
                                                <td key={c.key} className="px-3 py-2">
                                                    {c.render ? c.render(r) : r?.[c.key]}
                                                </td>
                                            ))}
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

export default function PaymentCostCreate() {
    const [mode, setMode] = useState('bkp'); // bkp | bkj | other
    const [modalOpen, setModalOpen] = useState(false);

    const [tglBayar, setTglBayar] = useState(todayISO());
    const [keterangan, setKeterangan] = useState('');

    const [penanggung, setPenanggung] = useState('');
    const [jumlahBiaya, setJumlahBiaya] = useState('');
    const [alokasiBiaya, setAlokasiBiaya] = useState('2101AK');
    const [bebanNoDok, setBebanNoDok] = useState('');

    // Payment status fields
    const [tagihan, setTagihan] = useState('');
    const [terakhirBayar, setTerakhirBayar] = useState('');
    const [sisaBayar, setSisaBayar] = useState('');

    const [items, setItems] = useState([]);

    const sisaBayarSekarang = useMemo(() => {
        const sisa = Number(sisaBayar);
        const bayar = Number(jumlahBiaya);
        if (!Number.isFinite(sisa) || !Number.isFinite(bayar)) return '';
        return String(sisa - bayar);
    }, [sisaBayar, jumlahBiaya]);

    useEffect(() => {
        // Reset defaults per mode
        if (mode === 'bkp') {
            setAlokasiBiaya('2101AK');
            setBebanNoDok('');
        } else if (mode === 'bkj') {
            setAlokasiBiaya('2101AK');
            setBebanNoDok('');
        } else {
            setAlokasiBiaya('51XXAD');
            setBebanNoDok('BIAYA');
        }
        setKeterangan('');
        setPenanggung('');
        setJumlahBiaya('');
        setTagihan('');
        setTerakhirBayar('');
        setSisaBayar('');
    }, [mode]);

    const modalConfig = useMemo(() => {
        if (mode === 'bkp') {
            return {
                title: 'Pilih BKP (Biaya Kirim Pembelian)',
                fetchUrl: '/pembayaran/payment-cost/bkp-rows',
                searchPlaceholder: 'Cari No BKP, Vendor Ekspedisi, No Inv...',
                columns: [
                    { key: 'no_bkp', label: 'No BKP' },
                    { key: 'tanggal', label: 'Tanggal' },
                    { key: 'Vendor_Ekspedisi', label: 'Vendor Ekspedisi' },
                    { key: 'no_inv', label: 'No Invoice' },
                    {
                        key: 'Total_Biaya',
                        label: 'Total Biaya',
                        render: (r) => formatRupiah(r?.Total_Biaya),
                    },
                ],
                onPickRow: (r) => {
                    const no = r?.no_bkp || '';
                    const trxKas = String(r?.trx_kas ?? '');
                    const alokasi = trxKas.trim() === '' ? '5123AD' : '2101AK';
                    setBebanNoDok(no);
                    setJumlahBiaya(String(r?.Total_Biaya ?? ''));
                    setKeterangan(`BAYAR BIAYA ANGKUT PEMBELIAN NO. ${no}`);
                    setAlokasiBiaya(alokasi);
                    setTagihan(String(r?.Total_Biaya ?? ''));
                    setTerakhirBayar(String(r?.pembayaran ?? ''));
                    setSisaBayar(String(r?.sisa ?? ''));
                },
            };
        }
        if (mode === 'bkj') {
            return {
                title: 'Pilih BKJ (Biaya Kirim Penjualan)',
                fetchUrl: '/pembayaran/payment-cost/bkj-rows',
                searchPlaceholder: 'Cari No BKJ, Vendor Ekspedisi, No Inv...',
                columns: [
                    { key: 'no_bkj', label: 'No BKJ' },
                    { key: 'tanggal', label: 'Tanggal' },
                    { key: 'nama_vendor', label: 'Vendor Ekspedisi' },
                    { key: 'no_inv', label: 'No Invoice' },
                    {
                        key: 'jumlah_inv',
                        label: 'Biaya Kirim',
                        render: (r) => formatRupiah(r?.jumlah_inv),
                    },
                ],
                onPickRow: (r) => {
                    const no = r?.no_bkj || '';
                    const jurnal = String(r?.jurnal ?? '');
                    const alokasi = jurnal.trim() === '' ? '5124AD' : '2101AK';
                    setBebanNoDok(no);
                    setJumlahBiaya(String(r?.jumlah_inv ?? ''));
                    setKeterangan(`BAYAR BIAYA ANGKUT PENJUALAN NO. ${no}`);
                    setAlokasiBiaya(alokasi);
                    setTagihan(String(r?.jumlah_inv ?? ''));
                    setTerakhirBayar(String(r?.jumlah_bayar ?? ''));
                    setSisaBayar(String(r?.sisa ?? ''));
                },
            };
        }
        return {
            title: 'Input Biaya Lainnya',
            fetchUrl: '',
            searchPlaceholder: '',
            columns: [],
            onPickRow: () => {},
        };
    }, [mode]);

    const canOpenModal = mode !== 'other';

    const handleMasuk = () => {
        if (!keterangan.trim()) return toastWarn('Keterangan wajib diisi.');
        if (!penanggung.trim()) return toastWarn('Penanggung jawab wajib diisi.');
        const amt = Number(jumlahBiaya);
        if (!Number.isFinite(amt) || amt <= 0) return toastWarn('Jumlah biaya wajib diisi.');
        if (!alokasiBiaya.trim()) return toastWarn('Perkiraan alokasi biaya wajib diisi.');
        if ((mode === 'bkp' || mode === 'bkj') && !bebanNoDok.trim()) {
            return toastWarn('Beban No. Dokumen wajib dipilih dari data.');
        }

        const bill = Number(tagihan);
        const lastPaid = Number(terakhirBayar);
        const remaining = Number(sisaBayar);
        const remainingNow = Number(sisaBayarSekarang);
        if (mode !== 'other') {
            if (!Number.isFinite(bill)) return toastWarn('Bill Amount wajib terisi.');
            if (!Number.isFinite(lastPaid)) return toastWarn('Last Paid wajib terisi.');
            if (!Number.isFinite(remaining)) return toastWarn('Remaining wajib terisi.');
            if (!Number.isFinite(remainingNow)) return toastWarn('Remaining Now wajib terisi.');
            if (remainingNow < 0) return toastWarn('Remaining Now tidak boleh minus. Jumlah biaya melebihi sisa bayar.');
        }

        setItems((prev) => [
            ...prev,
            {
                no: prev.length + 1,
                keterangan: keterangan.trim(),
                penanggung: penanggung.trim(),
                jumlah: amt,
                alokasi: alokasiBiaya.trim(),
                dok: bebanNoDok.trim(),
                tagihan: Number.isFinite(bill) ? bill : null,
                sisaBayarSekarang: Number.isFinite(remainingNow) ? remainingNow : null,
            },
        ]);

        // clear input line, keep global fields (tgl bayar)
        setKeterangan('');
        setPenanggung('');
        setJumlahBiaya('');
        if (mode === 'other') {
            setBebanNoDok('BIAYA');
            setAlokasiBiaya('51XXAD');
        } else {
            setBebanNoDok('');
        }
        setTagihan('');
        setTerakhirBayar('');
        setSisaBayar('');
        toastSuccess('Masuk ke daftar.');
    };

    const handleBatal = () => {
        setKeterangan('');
        setPenanggung('');
        setJumlahBiaya('');
        if (mode === 'other') {
            setBebanNoDok('BIAYA');
            setAlokasiBiaya('51XXAD');
        } else {
            setBebanNoDok('');
        }
        setTagihan('');
        setTerakhirBayar('');
        setSisaBayar('');
    };

    const handleDeleteItem = (no) => {
        setItems((prev) =>
            prev
                .filter((it) => it.no !== no)
                .map((it, idx) => ({ ...it, no: idx + 1 })),
        );
    };

    const handleSimpan = () => {
        if (items.length === 0) {
            toastWarn('Daftar pembayaran masih kosong.');
            return;
        }

        router.post(
            '/pembayaran/payment-cost',
            {
                tgl_bayar: tglBayar,
                items: items.map((it) => ({
                    keterangan: it.keterangan,
                    penanggung: it.penanggung,
                    jumlah: it.jumlah,
                    alokasi: it.alokasi,
                    dok: it.dok,
                    tagihan: it.tagihan,
                    sisaBayarSekarang: it.sisaBayarSekarang,
                })),
            },
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Add Payment" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Form Payment Cost</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Input pembayaran biaya kirim & biaya lainnya
                        </p>
                    </div>
                </div>

                {/* Mode selector */}
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-950/50 via-slate-900/25 to-slate-950/50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">Jenis Pembayaran</div>
                            <div className="mt-1 text-sm">
                                {mode === 'bkp' && 'BKP (Biaya Kirim Pembelian)'}
                                {mode === 'bkj' && 'BKJ (Biaya Kirim Penjualan)'}
                                {mode === 'other' && 'Biaya Lainnya'}
                            </div>
                        </div>

                        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                            <Button
                                type="button"
                                variant={mode === 'bkp' ? 'default' : 'outline'}
                                className="justify-start sm:justify-center"
                                onClick={() => setMode('bkp')}
                            >
                                BKP
                            </Button>
                            <Button
                                type="button"
                                variant={mode === 'bkj' ? 'default' : 'outline'}
                                className="justify-start sm:justify-center"
                                onClick={() => setMode('bkj')}
                            >
                                BKJ
                            </Button>
                            <Button
                                type="button"
                                variant={mode === 'other' ? 'default' : 'outline'}
                                className="justify-start sm:justify-center"
                                onClick={() => setMode('other')}
                            >
                                Lainnya
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Input */}
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card className="rounded-2xl border-white/10 bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold">Informasi Dokumen</div>
                                <div className="text-xs text-muted-foreground">
                                    Isi tanggal bayar dan keterangan pembayaran.
                                </div>
                            </div>
                            {mode !== 'other' && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setModalOpen(true)}
                                    disabled={!canOpenModal}
                                >
                                    <Search className="mr-2 h-4 w-4" /> Cari Data
                                </Button>
                            )}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <div className="text-xs text-muted-foreground">Tgl. Bayar</div>
                                <Input
                                    type="date"
                                    value={tglBayar}
                                    onChange={(e) => setTglBayar(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="text-xs text-muted-foreground">Keterangan</div>
                            <Textarea
                                value={keterangan}
                                onChange={(e) => setKeterangan(e.target.value)}
                                rows={6}
                                className="mt-1"
                            />
                        </div>
                    </Card>

                    <Card className="rounded-2xl border-white/10 bg-gradient-to-b from-slate-950/30 via-slate-900/10 to-slate-950/20 p-4">
                        <div className="text-sm font-semibold">Rincian Pembayaran</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            Penanggung, jumlah biaya, dan alokasi pembukuan.
                        </div>
                        <div className="grid gap-3">
                            <div>
                                <div className="text-xs text-muted-foreground">Penanggung Jawab</div>
                                <Input
                                    value={penanggung}
                                    onChange={(e) => setPenanggung(e.target.value)}
                                    placeholder="Nama penanggung..."
                                    className="mt-1"
                                />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">Bill Amount</div>
                                    <Input
                                        value={tagihan}
                                        onChange={(e) => setTagihan(e.target.value)}
                                        placeholder="0"
                                        inputMode="numeric"
                                        readOnly={mode === 'other'}
                                        className="mt-1"
                                    />
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                        {formatRupiah(tagihan)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Last Paid</div>
                                    <Input
                                        value={terakhirBayar}
                                        readOnly
                                        className="mt-1"
                                    />
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                        {formatRupiah(terakhirBayar)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">Remaining</div>
                                    <Input
                                        value={sisaBayar}
                                        readOnly
                                        className="mt-1"
                                    />
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                        {formatRupiah(sisaBayar)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Remaining Now</div>
                                    <Input
                                        value={sisaBayarSekarang}
                                        readOnly
                                        className="mt-1"
                                    />
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                        {formatRupiah(sisaBayarSekarang)}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs text-muted-foreground">Jumlah Biaya</div>
                                <Input
                                    value={jumlahBiaya}
                                    onChange={(e) => setJumlahBiaya(e.target.value)}
                                    placeholder="0"
                                    inputMode="numeric"
                                    className="mt-1"
                                />
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                    {formatRupiah(jumlahBiaya)}
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">Perkiraan Alokasi Biaya</div>
                                    <Input
                                        value={alokasiBiaya}
                                        onChange={(e) => setAlokasiBiaya(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Beban No. Dokumen</div>
                                    <Input
                                        value={bebanNoDok}
                                        onChange={(e) => setBebanNoDok(e.target.value)}
                                        placeholder={mode === 'other' ? 'BIAYA' : 'Pilih dari data...'}
                                        readOnly={mode !== 'other'}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Items table */}
                <Card className="rounded-2xl border-white/10 bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold">Daftar Pembayaran</div>
                            <div className="text-xs text-muted-foreground">
                                Baris yang akan disimpan ke Payment Cost
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={handleMasuk}>
                                <Plus className="mr-2 h-4 w-4" /> Masuk
                            </Button>
                            <Button type="button" onClick={handleSimpan}>
                                Simpan
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                                <tr>
                                    <th className="px-3 py-3 w-14">No.</th>
                                    <th className="px-3 py-3">Keterangan</th>
                                    <th className="px-3 py-3">Penanggung</th>
                                    <th className="px-3 py-3 text-right">Jumlah Biaya</th>
                                    <th className="px-3 py-3 text-right">Bill Amount</th>
                                    <th className="px-3 py-3 text-right">Remaining Now</th>
                                    <th className="px-3 py-3">Alokasi Biaya</th>
                                    <th className="px-3 py-3">Dokumen Beban</th>
                                    <th className="px-3 py-3 w-16 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-3 py-10 text-center text-muted-foreground"
                                        >
                                            Belum ada data.
                                        </td>
                                    </tr>
                                )}
                                {items.map((it) => (
                                    <tr key={it.no} className="border-t border-white/5">
                                        <td className="px-3 py-2">{it.no}</td>
                                        <td className="px-3 py-2">{it.keterangan}</td>
                                        <td className="px-3 py-2">{it.penanggung}</td>
                                        <td className="px-3 py-2 text-right">{formatRupiah(it.jumlah)}</td>
                                        <td className="px-3 py-2 text-right">{formatRupiah(it.tagihan)}</td>
                                        <td className="px-3 py-2 text-right">{formatRupiah(it.sisaBayarSekarang)}</td>
                                        <td className="px-3 py-2">{it.alokasi}</td>
                                        <td className="px-3 py-2">{it.dok}</td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                                                onClick={() => handleDeleteItem(it.no)}
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
                </Card>

                {canOpenModal && (
                    <DataPickerModal
                        open={modalOpen}
                        onOpenChange={setModalOpen}
                        title={modalConfig.title}
                        fetchUrl={modalConfig.fetchUrl}
                        searchPlaceholder={modalConfig.searchPlaceholder}
                        columns={modalConfig.columns}
                        onPickRow={modalConfig.onPickRow}
                    />
                )}
            </div>
        </AppLayout>
    );
}
