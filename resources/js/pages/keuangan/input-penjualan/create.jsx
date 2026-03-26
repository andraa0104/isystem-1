import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShadcnTableStateRows } from '@/components/data-states/TableStateRows';
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGE_SIZE_OPTIONS = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: 'all', label: 'Semua data' },
];

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const parsePpnPercent = (ppnRaw) => {
    const s = String(ppnRaw ?? '').trim();
    if (!s) return null;
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const v = Number(String(m[1]).replace(',', '.'));
    return Number.isFinite(v) ? v : null;
};

const getInvoiceStatus = (row) => {
    const paid = Number(row?.total_bayaran ?? 0);
    const saldo = Number(row?.saldo_piutang ?? 0);
    if (paid <= 0) return { label: 'Belum dibayar', variant: 'destructive' };
    if (saldo <= 0) return { label: 'Lunas', variant: 'default' };
    return { label: 'Sebagian', variant: 'secondary' };
};

const getAccountLabel = (options, value) => {
    const v = String(value ?? '').trim();
    if (!v) return '-';
    const found = options?.find((opt) => String(opt?.value ?? '') === v);
    return found?.label ?? v;
};

const mergeLinesByAccount = (inputLines) => {
    const map = new Map();
    for (const line of inputLines ?? []) {
        const akun = String(line?.akun ?? '').trim();
        const jenis = String(line?.jenis ?? 'Kredit').trim() || 'Kredit';
        const nominal = Number(line?.nominal ?? 0);
        const key = `${akun}||${jenis}`;
        if (!map.has(key)) {
            map.set(key, { akun, jenis, nominal: 0 });
        }
        map.get(key).nominal += Number.isFinite(nominal) ? nominal : 0;
    }
    return Array.from(map.values()).filter((l) => l.akun !== '' || l.nominal !== 0);
};

function AccountSearchDialog({ title, description, open, onOpenChange, options, value, onSelect }) {
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
                    <DialogTitle>{title}</DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                </DialogHeader>
                <div className="space-y-3">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari berdasarkan kode akun atau nama akun..."
                    />
                    <div className="max-h-[360px] overflow-auto rounded-md border">
                        {filtered.length ? (
                            <div className="divide-y">
                                {filtered.map((opt) => {
                                    const v = String(opt?.value ?? '');
                                    const active = v !== '' && v === String(value ?? '');
                                    return (
                                        <button
                                            key={v || opt?.label}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${
                                                active ? 'bg-primary/5' : ''
                                            }`}
                                            onClick={() => {
                                                onSelect(v);
                                                onOpenChange(false);
                                            }}
                                        >
                                            <div className="font-medium text-foreground">{opt?.label ?? v}</div>
                                            {opt?.label && opt?.label !== v ? (
                                                <div className="text-xs text-muted-foreground">{v}</div>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">Tidak ada hasil.</div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Tutup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function InputPenjualanCreate({
    filters = {},
    accountOptions = [],
    defaultAccount = null,
    glAccountOptions = [],
}) {
    const guessVoucherType = (kodeAkun) => {
        const v = String(kodeAkun ?? '').trim();
        const option = accountOptions?.find((opt) => String(opt.value) === v);
        const label = String(option?.label ?? '').toUpperCase();

        if (label.includes('KAS TUNAI')) return 'CV';
        if (label.includes('KAS BANK GIRO')) return 'GV';
        if (label.includes('KAS BANK')) return 'BV';

        const upper = v.toUpperCase();
        if (upper === '1101AD' || upper.startsWith('1101')) return 'CV';
        if (upper === '1102AD' || upper.startsWith('1102')) return 'GV';
        return 'BV';
    };

    const [search, setSearch] = useState(filters?.search ?? '');
    const [pageSize, setPageSize] = useState(filters?.pageSize ?? 10);
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selected, setSelected] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [kodeAkunAuto, setKodeAkunAuto] = useState(true);
    const [kodeAkun, setKodeAkun] = useState(defaultAccount ?? (accountOptions?.[0]?.value ?? ''));
    const voucherType = useMemo(
        () => guessVoucherType(kodeAkun),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [kodeAkun, accountOptions],
    );

    const [tglVoucher, setTglVoucher] = useState(() => new Date().toISOString().slice(0, 10));
    const [keterangan, setKeterangan] = useState('');
    const [keteranganAuto, setKeteranganAuto] = useState(true);
    const [nominal, setNominal] = useState('');

    const [ppnAkun, setPpnAkun] = useState('');
    const [ppnAkunAuto, setPpnAkunAuto] = useState(true);
    const [saving, setSaving] = useState(false);

    const [activeLineIndex, setActiveLineIndex] = useState(null);
    const [ppnDialogOpen, setPpnDialogOpen] = useState(false);

    const [suggestLoading, setSuggestLoading] = useState(false);
    const [autoSuggestedNo, setAutoSuggestedNo] = useState('');

    const calc = useMemo(() => {
        const totalInv = Number(selectedDetail?.g_total ?? selected?.g_total ?? 0);
        const taxInv = Math.max(0, Number(selectedDetail?.h_ppn ?? selected?.h_ppn ?? 0));
        const dppInv = Math.max(0, totalInv - taxInv);
        const bayar = Number(selectedDetail?.total_bayaran ?? selected?.total_bayaran ?? 0);
        const cashNominal = nominal === '' ? (bayar > 0 ? bayar : totalInv) : Number(nominal);
        const ratio = totalInv > 0 ? Math.min(1, Math.max(0, cashNominal / totalInv)) : 1;
        return {
            totalInv,
            taxInv,
            dppInv,
            cashNominal: Number.isFinite(cashNominal) ? cashNominal : 0,
            ratio,
            dppCash: Math.round(dppInv * ratio * 100) / 100,
            taxCash: Math.round(taxInv * ratio * 100) / 100,
        };
    }, [selectedDetail, selected, nominal]);

    const ppnPercent = useMemo(() => parsePpnPercent(selectedDetail?.ppn ?? selected?.ppn), [selectedDetail, selected]);

    const [lines, setLines] = useState(() => [{ akun: '', jenis: 'Kredit', nominal: 0 }]);

    useEffect(() => {
        setLines((prev) => {
            if (!Array.isArray(prev) || prev.length !== 1) return prev;
            const first = prev[0] ?? {};
            const current = Number(first?.nominal ?? 0);
            if (current > 0) return prev;
            if (calc.dppCash <= 0) return prev;
            return [{ ...first, nominal: calc.dppCash, jenis: 'Kredit' }];
        });
    }, [calc.dppCash]);

    const linesSum = useMemo(() => (lines ?? []).reduce((acc, l) => acc + Number(l?.nominal ?? 0), 0), [lines]);
    const linesDiff = useMemo(() => Math.round((calc.dppCash - linesSum) * 100) / 100, [calc.dppCash, linesSum]);

    const maxLines = calc.taxCash > 0 ? 2 : 3;
    const getSlotLabel = (idx) => (calc.taxCash > 0 ? (idx === 0 ? 1 : 3) : idx + 1);

    const displayed = useMemo(() => {
        if (pageSize === Infinity) return rows;
        const start = (page - 1) * pageSize;
        return rows.slice(start, start + pageSize);
    }, [rows, page, pageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil((total ?? 0) / pageSize));
    }, [total, pageSize]);

    const fetchRows = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            params.set('pageSize', 'all');
            const res = await fetch(`/keuangan/input-penjualan/invoice-rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();
            setRows(Array.isArray(json?.rows) ? json.rows : []);
            setTotal(Number(json?.total ?? 0));
        } catch (e) {
            setError(readApiError(e));
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (noFaktur) => {
        if (!noFaktur) return;
        setDetailLoading(true);
        try {
            const res = await fetch(`/keuangan/input-penjualan/invoice-detail/${encodeURIComponent(noFaktur)}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();
            setSelectedDetail(json?.header ?? null);
        } catch {
            setSelectedDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const applySuggestion = async ({ noFaktur, cashNominal }) => {
        if (!noFaktur) return;
        setSuggestLoading(true);
        try {
            const params = new URLSearchParams();
            if (cashNominal) params.set('nominal', String(cashNominal));
            const res = await fetch(`/keuangan/input-penjualan/suggest/${encodeURIComponent(noFaktur)}?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();

            const suggestedKet = String(json?.keterangan ?? '').trim();
            if (keteranganAuto && suggestedKet) setKeterangan(suggestedKet);

            const suggestedKas = String(json?.kode_akun ?? '').trim();
            if (suggestedKas && kodeAkunAuto) setKodeAkun(suggestedKas);

            // voucher_type is now derived from selected kas/bank account (no user selection)

            const beban = Array.isArray(json?.beban_lines) ? json.beban_lines : [];
            if (beban.length) {
                const merged = mergeLinesByAccount(
                    beban.map((l) => ({
                        akun: String(l?.akun ?? '').trim(),
                        jenis: String(l?.jenis ?? 'Kredit'),
                        nominal: Number(l?.nominal ?? 0),
                    }))
                );
                setLines(merged.length ? merged : [{ akun: '', jenis: 'Kredit', nominal: calc.dppCash }]);
            } else {
                setLines([{ akun: '', jenis: 'Kredit', nominal: calc.dppCash }]);
            }

            const ppn = String(json?.ppn_akun ?? '').trim();
            if (ppnAkunAuto) {
                if (ppn) setPpnAkun(ppn);
                else setPpnAkun('');
            }
        } finally {
            setSuggestLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const no = String(selected?.no_fakturpenjualan ?? '').trim();
        if (!no) return;
        if (autoSuggestedNo === no) return;

        const paid = Number(selected?.total_bayaran ?? 0);
        const totalInv = Number(selected?.g_total ?? 0);
        const cashNominal = paid > 0 ? paid : totalInv;

        setAutoSuggestedNo(no);
        applySuggestion({ noFaktur: no, cashNominal });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.no_fakturpenjualan]);

    // voucherType is derived from kodeAkun, no user selection

    const applySelectedToForm = (row) => {
        setSelected(row);
        setSelectedDetail(null);
        setKeteranganAuto(true);
        setPpnAkunAuto(true);
        setKeterangan(`Penjualan/INV ${row?.no_fakturpenjualan ?? ''}${row?.nm_cs ? ` — ${row.nm_cs}` : ''}`);

        const paid = Number(row?.total_bayaran ?? 0);
        const totalInv = Number(row?.g_total ?? 0);
        const value = paid > 0 ? paid : totalInv;
        setNominal(value > 0 ? String(value) : '');
        setTglVoucher(new Date().toISOString().slice(0, 10));
        setLines([{ akun: '', jenis: 'Kredit', nominal: 0 }]);
    };

    const submit = () => {
        if (!selected?.no_fakturpenjualan) return;
        if (!kodeAkun) return;
        if (!tglVoucher) return;
        if (!lines?.length || !lines?.[0]?.akun) return;
        if (linesDiff !== 0) return;
        if (calc.taxCash > 0 && !ppnAkun) return;
        if (calc.taxCash > 0 && lines.length > 2) return;

        setSaving(true);
        router.post(
            '/keuangan/input-penjualan',
            {
                no_fakturpenjualan: selected.no_fakturpenjualan,
                kode_akun: kodeAkun,
                tgl_voucher: tglVoucher,
                voucher_type: voucherType,
                ppn_akun: calc.taxCash > 0 ? ppnAkun : null,
                beban_lines: (lines ?? []).map((l) => ({
                    akun: String(l?.akun ?? ''),
                    jenis: String(l?.jenis ?? 'Kredit'),
                    nominal: Number(l?.nominal ?? 0),
                })),
                keterangan,
                nominal: nominal === '' ? null : Number(nominal),
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setSelected(null);
                    setSelectedDetail(null);
                    setKeterangan('');
                    setNominal('');
                    setLines([{ akun: '', jenis: 'Kredit', nominal: 0 }]);
                    fetchRows();
                },
            }
        );
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Input Penjualan', href: '/keuangan/input-penjualan' }, { title: 'Input Baru', href: '/keuangan/input-penjualan/create' }]}>
            <Head title="Input Penjualan - Input Baru" />
            <div className="flex flex-col gap-4 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle>Pilih Faktur Penjualan</CardTitle>
                                    <div className="text-xs text-muted-foreground">
                                        Ambil dari <span className="font-mono">tb_kdfakturpenjualan</span> (header) dan detail <span className="font-mono">tb_fakturpenjualan</span>.
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={() => router.visit('/keuangan/input-penjualan')}>
                                    Kembali
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Input
                                    placeholder="Cari no faktur, customer, ref PO..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full max-w-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setPage(1);
                                        fetchRows();
                                    }}
                                >
                                    Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead>No Faktur</TableHead>
                                        <TableHead>Tgl</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">PPN</TableHead>
                                        <TableHead className="text-right">Bayar</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <ShadcnTableStateRows
                                        columns={7}
                                        loading={loading}
                                        error={error}
                                        onRetry={fetchRows}
                                        isEmpty={!loading && !error && displayed.length === 0}
                                        emptyTitle="Tidak ada data faktur."
                                        emptyDescription="Ubah kata kunci pencarian."
                                    />
                                    {!loading &&
                                        !error &&
                                        displayed.map((row) => {
                                            const st = getInvoiceStatus(row);
                                            const active = selected?.no_fakturpenjualan === row?.no_fakturpenjualan;
                                            return (
                                                <TableRow
                                                    key={row?.no_fakturpenjualan ?? Math.random()}
                                                    className={`cursor-pointer ${active ? 'bg-primary/5' : ''}`}
                                                    onClick={() => {
                                                        applySelectedToForm(row);
                                                        fetchDetail(String(row?.no_fakturpenjualan ?? '').trim());
                                                    }}
                                                >
                                                    <TableCell className="font-medium">{row?.no_fakturpenjualan ?? '-'}</TableCell>
                                                    <TableCell>{formatDate(row?.tgl_doc)}</TableCell>
                                                    <TableCell className="max-w-[260px] truncate" title={row?.nm_cs ?? ''}>
                                                        {row?.nm_cs ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">{`Rp ${formatNumber(row?.g_total ?? 0)}`}</TableCell>
                                                    <TableCell className="text-right">{`Rp ${formatNumber(row?.h_ppn ?? 0)}`}</TableCell>
                                                    <TableCell className="text-right">{`Rp ${formatNumber(row?.total_bayaran ?? 0)}`}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={st.variant}>{st.label}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Total data: <span className="font-medium text-foreground">{total ?? 0}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                        value={pageSize === Infinity ? 'all' : String(pageSize)}
                                        onValueChange={(val) => {
                                            setPage(1);
                                            setPageSize(val === 'all' ? Infinity : Number(val));
                                        }}
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue placeholder="Tampilkan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAGE_SIZE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={pageSize === Infinity || page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </Button>
                                    <div className="min-w-[92px] text-center text-sm">
                                        {pageSize === Infinity ? 'All' : `${page}/${totalPages}`}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={pageSize === Infinity || page >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="space-y-2">
                            <CardTitle>Jurnal Penjualan ke Buku Kas</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Voucher otomatis: <span className="font-mono">{'{DB}/{CV|GV|BV}/00000001'}</span> (masuk).
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                                <div className="text-xs text-muted-foreground">Faktur terpilih</div>
                                <div className="text-sm font-semibold">{selected?.no_fakturpenjualan ?? '-'}</div>
                                <div className="text-xs text-muted-foreground">{selected?.nm_cs ? String(selected.nm_cs) : 'Pilih faktur di tabel.'}</div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/10 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">Ringkasan</div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!selected?.no_fakturpenjualan || suggestLoading}
                                        onClick={() =>
                                            applySuggestion({
                                                noFaktur: String(selected?.no_fakturpenjualan ?? '').trim(),
                                                cashNominal: calc.cashNominal,
                                            })
                                        }
                                    >
                                        {suggestLoading ? 'Menganalisa...' : 'Auto Suggest Ulang'}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground">Total</div>
                                    <div className="text-right font-medium">{`Rp ${formatNumber(calc.totalInv)}`}</div>
                                    <div className="text-muted-foreground">DPP</div>
                                    <div className="text-right font-medium">{`Rp ${formatNumber(calc.dppCash)}`}</div>
                                    <div className="text-muted-foreground">PPN %</div>
                                    <div className="text-right font-medium">{ppnPercent === null ? '-' : `${ppnPercent}%`}</div>
                                    <div className="text-muted-foreground">PPN</div>
                                    <div className="text-right font-medium">{detailLoading ? '...' : `Rp ${formatNumber(calc.taxCash)}`}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Akun Kas/Bank</div>
                                <Select
                                    value={kodeAkun}
                                    onValueChange={(v) => {
                                        setKodeAkunAuto(false);
                                        setKodeAkun(v);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih akun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accountOptions?.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Pendapatan (DPP)</div>
                                <div className="grid gap-3 rounded-lg border p-3">
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={(lines?.length ?? 0) >= maxLines}
                                            onClick={() => setLines((prev) => [...(prev ?? []), { akun: '', jenis: 'Kredit', nominal: 0 }])}
                                        >
                                            Tambah
                                        </Button>
                                    </div>
	                                    {(lines ?? []).map((line, idx) => (
	                                        <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-2">
	                                            <div className="flex items-center justify-between gap-2">
	                                                <div className="text-xs font-medium text-muted-foreground">{`Pendapatan ${getSlotLabel(idx)}`}</div>
	                                                <div className="flex items-center gap-2">
	                                                    {(lines?.length ?? 0) > 1 ? (
	                                                        <Button
	                                                            type="button"
	                                                            variant="ghost"
                                                            onClick={() => setLines((prev) => (prev ?? []).filter((_, i) => i !== idx))}
                                                        >
                                                            Hapus
                                                        </Button>
	                                                    ) : null}
	                                                </div>
	                                            </div>
	                                            <div className="grid grid-cols-1 gap-2">
	                                                <Button
	                                                    type="button"
	                                                    variant="outline"
	                                                    className="h-auto w-full items-start justify-between gap-2 py-2"
	                                                    onClick={() => setActiveLineIndex(idx)}
	                                                >
	                                                    <span className="text-left leading-snug break-words whitespace-normal">
	                                                        {line?.akun ? getAccountLabel(glAccountOptions, line.akun) : 'Pilih akun pendapatan'}
	                                                    </span>
	                                                    <span className="shrink-0 text-muted-foreground">Cari</span>
	                                                </Button>
	                                            </div>
	                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
	                                                <div className="space-y-1">
	                                                    <Label className="text-xs text-muted-foreground">Jenis</Label>
	                                                    <Select
	                                                        value={String(line?.jenis ?? '') || 'Kredit'}
	                                                        onValueChange={(v) =>
	                                                            setLines((prev) =>
	                                                                (prev ?? []).map((l, i) => (i === idx ? { ...l, jenis: v } : l))
	                                                            )
	                                                        }
	                                                    >
	                                                        <SelectTrigger className="h-9">
	                                                            <SelectValue placeholder="Jenis" />
	                                                        </SelectTrigger>
	                                                        <SelectContent>
	                                                            <SelectItem value="Kredit">Kredit</SelectItem>
	                                                            <SelectItem value="Debit">Debit</SelectItem>
	                                                        </SelectContent>
	                                                    </Select>
	                                                </div>
	                                                <div className="space-y-1">
	                                                    <Label className="text-xs text-muted-foreground">Nominal</Label>
	                                                    <Input
	                                                        inputMode="numeric"
	                                                        value={String(line?.nominal ?? '')}
	                                                        onChange={(e) => {
	                                                            const v = e.target.value.replace(/[^\d.]/g, '');
	                                                            setLines((prev) =>
	                                                                (prev ?? []).map((l, i) => (i === idx ? { ...l, nominal: v === '' ? 0 : Number(v) } : l))
	                                                            );
	                                                        }}
	                                                        placeholder="Jumlah (Rp)"
	                                                    />
	                                                </div>
	                                            </div>
	                                        </div>
	                                    ))}
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-muted-foreground">DPP target</div>
                                        <div className="text-right font-medium">{`Rp ${formatNumber(calc.dppCash)}`}</div>
                                        <div className="text-muted-foreground">Total</div>
                                        <div className="text-right font-medium">{`Rp ${formatNumber(linesSum)}`}</div>
                                        <div className="text-muted-foreground">Selisih</div>
                                        <div className={`text-right font-medium ${linesDiff === 0 ? 'text-foreground' : 'text-destructive'}`}>
                                            {`Rp ${formatNumber(linesDiff)}`}
                                        </div>
                                    </div>
                                    {calc.taxCash > 0 ? (
                                        <div className="text-xs text-muted-foreground">
                                            Catatan: PPN masuk ke <span className="font-mono">Kode_Akun2</span>, jadi pendapatan DPP maksimal 2 baris.
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {calc.taxCash > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Akun PPN Keluaran</div>
                                    <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setPpnDialogOpen(true)}>
                                        <span className="truncate">
                                            {ppnAkun ? getAccountLabel(glAccountOptions, ppnAkun) : 'Pilih akun PPN'}
                                        </span>
                                        <span className="text-muted-foreground">Cari</span>
                                    </Button>
                                    <div className="text-xs text-muted-foreground">{`Nominal PPN: Rp ${formatNumber(calc.taxCash)}`}</div>
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Tanggal Voucher</div>
                                <Input type="date" value={tglVoucher} onChange={(e) => setTglVoucher(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Keterangan</div>
                                <Input
                                    value={keterangan}
                                    onChange={(e) => {
                                        setKeteranganAuto(false);
                                        setKeterangan(e.target.value);
                                    }}
                                    placeholder="Keterangan transaksi..."
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Nominal (Masuk)</div>
                                <Input
                                    inputMode="numeric"
                                    value={nominal}
                                    onChange={(e) => setNominal(e.target.value.replace(/[^\d.]/g, ''))}
                                    placeholder="Contoh: 2500000"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    className="w-full"
                                    disabled={
                                        saving ||
                                        !selected?.no_fakturpenjualan ||
                                        !kodeAkun ||
                                        !tglVoucher ||
                                        !lines?.length ||
                                        !lines?.[0]?.akun ||
                                        linesDiff !== 0 ||
                                        (calc.taxCash > 0 && !ppnAkun) ||
                                        (calc.taxCash > 0 && lines.length > 2)
                                    }
                                    onClick={submit}
                                >
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saving}
                                    onClick={() => {
                                        setSelected(null);
                                        setSelectedDetail(null);
                                        setKeterangan('');
                                        setNominal('');
                                        setLines([{ akun: '', jenis: 'Kredit', nominal: 0 }]);
                                    }}
                                >
                                    Reset
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <AccountSearchDialog
                    title={`Pilih Akun Pendapatan${activeLineIndex !== null ? ` — Pendapatan ${getSlotLabel(activeLineIndex)}` : ''}`}
                    description="Cari berdasarkan kode akun atau nama akun."
                    open={activeLineIndex !== null}
                    onOpenChange={(v) => {
                        if (!v) setActiveLineIndex(null);
                    }}
                    options={glAccountOptions}
                    value={activeLineIndex !== null ? lines?.[activeLineIndex]?.akun : ''}
                    onSelect={(val) => {
                        if (activeLineIndex === null) return;
                        setLines((prev) => (prev ?? []).map((l, i) => (i === activeLineIndex ? { ...l, akun: val } : l)));
                    }}
                />

                <AccountSearchDialog
                    title="Pilih Akun PPN Keluaran"
                    description="Wajib diisi jika nilai PPN > 0."
                    open={ppnDialogOpen}
                    onOpenChange={setPpnDialogOpen}
                    options={glAccountOptions}
                    value={ppnAkun}
                    onSelect={(v) => {
                        setPpnAkunAuto(false);
                        setPpnAkun(v);
                    }}
                />
            </div>
        </AppLayout>
    );
}
