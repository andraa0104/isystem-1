import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value ?? 0),
    )}`;

const parseRupiahInput = (value) => {
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    return digits === '' ? '' : digits;
};

const formatRupiahInput = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n <= 0) return '';
    return formatRupiah(n);
};

const getAccountLabel = (options, value) => {
    const v = String(value ?? '').trim();
    if (!v) return '';
    const found = options?.find((opt) => String(opt?.value ?? '') === v);
    return String(found?.label ?? v);
};

function AccountSearchDialog({ open, onOpenChange, options, value, onSelect }) {
    const [q, setQ] = useState('');

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return options ?? [];
        return (options ?? []).filter((opt) => {
            const code = String(opt?.value ?? '').toLowerCase();
            const label = String(opt?.label ?? '').toLowerCase();
            return code.includes(term) || label.includes(term);
        });
    }, [options, q]);

    useEffect(() => {
        if (open) setQ('');
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Pilih Akun Lawan</DialogTitle>
                    <DialogDescription>
                        Cari berdasarkan kode akun atau nama akun.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari kode / nama akun..."
                    />
                    <div className="max-h-[360px] overflow-auto rounded-md border">
                        {filtered.length ? (
                            <div className="divide-y">
                                {filtered.map((opt) => {
                                    const v = String(opt?.value ?? '');
                                    const active =
                                        v !== '' && v === String(value ?? '');
                                    return (
                                        <button
                                            key={v || opt?.label}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${active ? 'bg-primary/5' : ''}`}
                                            onClick={() => {
                                                onSelect(v);
                                                onOpenChange(false);
                                            }}
                                        >
                                            <div className="font-medium text-foreground">
                                                {opt?.label ?? v}
                                            </div>
                                            {opt?.label && opt?.label !== v ? (
                                                <div className="text-xs text-muted-foreground">
                                                    {v}
                                                </div>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                Tidak ada hasil.
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Tutup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ReferenceSearchDialog({ open, onOpenChange, rows, value, onSelect }) {
    const [q, setQ] = useState('');

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return rows ?? [];
        return (rows ?? []).filter((row) => {
            const ref = String(row?.ref_no ?? '').toLowerCase();
            const nominal = String(row?.nominal ?? '').toLowerCase();
            const rupiah = formatRupiah(row?.nominal).toLowerCase();
            return (
                ref.includes(term) ||
                nominal.includes(term) ||
                rupiah.includes(term)
            );
        });
    }, [rows, q]);

    useEffect(() => {
        if (open) setQ('');
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Pilih Referensi</DialogTitle>
                    <DialogDescription>
                        Cari berdasarkan nomor referensi atau nominal.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari nomor referensi / nominal..."
                    />
                    <div className="max-h-[360px] overflow-auto rounded-md border">
                        {filtered.length ? (
                            <div className="divide-y">
                                {filtered.map((row) => {
                                    const ref = String(row?.ref_no ?? '');
                                    const active =
                                        ref !== '' && ref === String(value ?? '');
                                    return (
                                        <button
                                            key={ref}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${active ? 'bg-primary/5' : ''}`}
                                            onClick={() => {
                                                onSelect(ref);
                                                onOpenChange(false);
                                            }}
                                        >
                                            <div className="font-medium text-foreground">
                                                {ref}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatRupiah(row?.nominal)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                Tidak ada hasil.
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Tutup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const today = () => new Date().toISOString().slice(0, 10);

export default function JurnalLainnyaCreate({ types = {}, accountOptions = [] }) {
    const typeKeys = Object.keys(types ?? {});
    const [type, setType] = useState(typeKeys[0] ?? 'DOB');
    const [refs, setRefs] = useState([]);
    const [refNo, setRefNo] = useState('');
    const [tglJurnal, setTglJurnal] = useState(today());
    const [nominal, setNominal] = useState('');
    const [akunLawan, setAkunLawan] = useState('');
    const [jenisLawan, setJenisLawan] = useState('Debit');
    const [keterangan, setKeterangan] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [hppdotTotal, setHppdotTotal] = useState('');
    const [saving, setSaving] = useState(false);
    const [akunDialogOpen, setAkunDialogOpen] = useState(false);
    const [refDialogOpen, setRefDialogOpen] = useState(false);

    const selectedType = types?.[type] ?? {};
    const mainSide = selectedType?.main_side ?? 'Debit';
    const mainAccount = selectedType?.main ?? '';
    const isBalanced = useMemo(() => {
        const n = Number(nominal ?? 0);
        return n > 0 && akunLawan !== '' && jenisLawan !== mainSide;
    }, [nominal, akunLawan, jenisLawan, mainSide]);

    const loadRefs = async (nextType = type) => {
        const res = await fetch(
            `/keuangan/jurnal-lainnya/ref-rows?type=${encodeURIComponent(nextType)}`,
            { headers: { Accept: 'application/json' } },
        );
        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        setRefs(rows);
        if (rows.length) {
            setRefNo(rows[0].ref_no);
            setNominal(String(Number(rows[0].nominal ?? 0)));
        } else {
            setRefNo('');
            setNominal('');
        }
    };

    useEffect(() => {
        loadRefs(type);
        if (type === 'BKP' || type === 'BKJ') {
            setAkunLawan('2101AK');
            setJenisLawan('Kredit');
        } else {
            setAkunLawan('');
            setJenisLawan('Debit');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    useEffect(() => {
        const ref = refs.find((r) => String(r.ref_no) === String(refNo));
        if (ref) setNominal(String(Number(ref.nominal ?? 0)));
    }, [refNo, refs]);

    useEffect(() => {
        if (!refNo) return;
        if (type === 'DOB') {
            setKeterangan(`PEMBEBANAN BIAYA UNTUK DO NO. ${refNo}`);
        } else if (type === 'DOT') {
            setKeterangan(`PEMBEBANAN DO TAMBAHAN NO. ${refNo}`);
        } else if (type === 'BKP') {
            setKeterangan(`HUTANG BIAYA ANGKUT PEMBELIAN NO. ${refNo}`);
        } else if (type === 'BKJ') {
            setKeterangan(`HUTANG BIAYA ANGKUT PENJUALAN NO. ${refNo}`);
        }
    }, [type, refNo]);

    const submit = () => {
        if (!isBalanced || !refNo || !tglJurnal || !keterangan) return;
        setSaving(true);
        router.post(
            '/keuangan/jurnal-lainnya',
            {
                type,
                ref_no: refNo,
                tgl_jurnal: tglJurnal,
                keterangan,
                nominal: Number(nominal ?? 0),
                akun_lawan: akunLawan,
                jenis_lawan: jenisLawan,
                invoice_no: invoiceNo || null,
                hppdot_total: hppdotTotal ? Number(hppdotTotal) : null,
            },
            { onFinish: () => setSaving(false) },
        );
    };

    return (
        <>
            <Head title="Input Jurnal Lainnya" />
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Input Jurnal Lainnya</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Jenis Transaksi</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {typeKeys.map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {k} - {types[k]?.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Referensi</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => setRefDialogOpen(true)}
                                disabled={!refs.length}
                            >
                                <span className="truncate">
                                    {refNo
                                        ? `${refNo} - ${formatRupiah(nominal)}`
                                        : 'Pilih referensi'}
                                </span>
                                <span className="text-muted-foreground">
                                    Cari
                                </span>
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Tanggal Jurnal</Label>
                            <Input
                                type="date"
                                value={tglJurnal}
                                onChange={(e) => setTglJurnal(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nominal</Label>
                            <Input
                                inputMode="numeric"
                                value={formatRupiahInput(nominal)}
                                onChange={(e) =>
                                    setNominal(
                                        parseRupiahInput(e.target.value),
                                    )
                                }
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Keterangan</Label>
                            <Input
                                value={keterangan}
                                onChange={(e) => setKeterangan(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Akun Lawan</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => setAkunDialogOpen(true)}
                            >
                                <span className="truncate">
                                    {akunLawan
                                        ? getAccountLabel(
                                              accountOptions,
                                              akunLawan,
                                          )
                                        : 'Pilih akun'}
                                </span>
                                <span className="text-muted-foreground">
                                    Cari
                                </span>
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Jenis Akun Lawan</Label>
                            <Select
                                value={jenisLawan}
                                onValueChange={setJenisLawan}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Debit">Debit</SelectItem>
                                    <SelectItem value="Kredit">Kredit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {type === 'DOT' ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Referensi Faktur</Label>
                                    <Input
                                        value={invoiceNo}
                                        onChange={(e) =>
                                            setInvoiceNo(e.target.value)
                                        }
                                        placeholder="SJA.INV-0000000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>HPP DOT Total</Label>
                                    <Input
                                        inputMode="numeric"
                                        value={formatRupiahInput(hppdotTotal)}
                                        onChange={(e) =>
                                            setHppdotTotal(
                                                parseRupiahInput(
                                                    e.target.value,
                                                ),
                                            )
                                        }
                                    />
                                </div>
                            </>
                        ) : null}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Preview Jurnal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="rounded-md border p-3">
                            <div className="font-medium">{mainAccount}</div>
                            <div>{mainSide}</div>
                            <div>{formatRupiah(nominal)}</div>
                        </div>
                        <div className="rounded-md border p-3">
                            <div className="font-medium">
                                {akunLawan
                                    ? getAccountLabel(accountOptions, akunLawan)
                                    : 'Akun lawan belum dipilih'}
                            </div>
                            <div>{jenisLawan}</div>
                            <div>{formatRupiah(nominal)}</div>
                        </div>
                        <div
                            className={
                                isBalanced
                                    ? 'text-emerald-600'
                                    : 'text-destructive'
                            }
                        >
                            {isBalanced ? 'Balance' : 'Belum balance'}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                className="flex-1"
                                disabled={!isBalanced || saving}
                                onClick={submit}
                            >
                                Simpan
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    router.visit('/keuangan/jurnal-lainnya')
                                }
                            >
                                Batal
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <AccountSearchDialog
                open={akunDialogOpen}
                onOpenChange={setAkunDialogOpen}
                options={accountOptions}
                value={akunLawan}
                onSelect={setAkunLawan}
            />
            <ReferenceSearchDialog
                open={refDialogOpen}
                onOpenChange={setRefDialogOpen}
                rows={refs}
                value={refNo}
                onSelect={setRefNo}
            />
        </>
    );
}

JurnalLainnyaCreate.layout = (page) => (
    <AppLayout
        breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Keuangan', href: '#' },
            { title: 'Jurnal Lainnya', href: '/keuangan/jurnal-lainnya' },
            { title: 'Input Baru', href: '/keuangan/jurnal-lainnya/create' },
        ]}
    >
        {page}
    </AppLayout>
);
