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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const STATUS_OPTIONS = [
    { value: 'belum_dijurnal', label: 'Belum dijurnal' },
    { value: 'sudah_dijurnal', label: 'Sudah dijurnal' },
    { value: 'all', label: 'Semua data' },
];

const PAGE_SIZE_OPTIONS = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: 'all', label: 'Semua data' },
];

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);

const getInvoiceStatus = (row) => {
    const pembayaran = Number(row?.pembayaran ?? 0);
    const jurnal = String(row?.jurnal ?? '').trim();
    const sisa = Number(row?.sisa_bayar ?? 0);

    if (jurnal) return { label: 'Sudah dijurnal', variant: 'default' };
    if (pembayaran <= 0) return { label: 'Belum dibayar', variant: 'destructive' };
    if (sisa !== 0) return { label: 'Belum lunas', variant: 'secondary' };
    return { label: 'Siap dijurnal', variant: 'outline' };
};

const buildDefaultKeterangan = (row) => {
    if (!row?.no_doc) return '';
    const vendor = String(row?.nm_vdr ?? '').trim();
    const refPo = String(row?.ref_po ?? '').trim();
    return `Pembelian/FI ${row.no_doc}${vendor ? ` — ${vendor}` : ''}${refPo ? ` (PO ${refPo})` : ''}`;
};

const getAccountLabel = (options, value) => {
    const v = String(value ?? '').trim();
    if (!v) return '-';
    const found = options?.find((opt) => String(opt?.value ?? '') === v);
    return found?.label ?? v;
};

function AccountSearchDialog({
    title,
    description,
    open,
    onOpenChange,
    options,
    value,
    onSelect,
}) {
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

export default function InputPembelianCreate({
    filters = {},
    accountOptions = [],
    defaultAccount = null,
    expenseAccountOptions = [],
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
    const [status, setStatus] = useState(filters?.status ?? 'belum_dijurnal');
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
    const [saving, setSaving] = useState(false);
    const [ppnDialogOpen, setPpnDialogOpen] = useState(false);
    const [activeBebanIndex, setActiveBebanIndex] = useState(null);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [autoSuggestedNoDoc, setAutoSuggestedNoDoc] = useState('');
    const [ppnAkunAuto, setPpnAkunAuto] = useState(true);

    const calc = useMemo(() => {
        const totalInv = Number(selectedDetail?.total ?? selected?.total ?? 0);
        const taxInv = Math.max(0, Number(selectedDetail?.tax ?? selected?.tax ?? 0));
        const dppInv = Math.max(0, totalInv - taxInv);
        const bayar = Number(selectedDetail?.pembayaran ?? selected?.pembayaran ?? 0);
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

    // voucherType is derived from kodeAkun, no user selection

    const [bebanLines, setBebanLines] = useState(() => [
        { akun: expenseAccountOptions?.[0]?.value ?? '', jenis: 'Debit', nominal: 0 },
    ]);

    useEffect(() => {
        // Auto set default nominal beban 1 = DPP target when user selects FI.
        setBebanLines((prev) => {
            if (!Array.isArray(prev) || prev.length !== 1) return prev;
            const first = prev[0] ?? {};
            const current = Number(first?.nominal ?? 0);
            if (current > 0) return prev;
            if (calc.dppCash <= 0) return prev;
            return [{ ...first, nominal: calc.dppCash }];
        });
    }, [calc.dppCash]);

    const bebanSum = useMemo(() => {
        return (bebanLines ?? []).reduce((acc, l) => acc + Number(l?.nominal ?? 0), 0);
    }, [bebanLines]);

    const bebanDiff = useMemo(() => {
        return Math.round((calc.dppCash - bebanSum) * 100) / 100;
    }, [calc.dppCash, bebanSum]);

    const getBebanSlotLabel = (idx) => {
        if (calc.taxCash > 0) {
            return idx === 0 ? 1 : 3; // slot 2 reserved for PPN
        }
        return idx + 1;
    };

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
            if (status) params.set('status', status);
            params.set('pageSize', 'all'); // pagination UI dilakukan di frontend

            const res = await fetch(`/keuangan/input-pembelian/fi-rows?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                throw await normalizeApiError(res);
            }
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

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setPage(1);
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const applySelectedToForm = (row) => {
        setSelected(row);
        setSelectedDetail(null);
        setKeteranganAuto(true);
        setKeterangan(buildDefaultKeterangan(row));
        setPpnAkunAuto(true);
        const bayar = Number(row?.pembayaran ?? 0);
        const totalInv = Number(row?.total ?? 0);
        const value = bayar > 0 ? bayar : totalInv;
        setNominal(value > 0 ? String(value) : '');
        const tgl = String(row?.tgl_bayar ?? '').trim() || String(row?.inv_d ?? '').trim() || '';
        if (tgl && /^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
            setTglVoucher(tgl);
        }

        // Default alokasi: seluruh DPP ke beban 1.
        setBebanLines([{ akun: '', jenis: 'Debit', nominal: 0 }]);
    };

    const fetchFiDetail = async (noDoc) => {
        if (!noDoc) return;
        setDetailLoading(true);
        try {
            const res = await fetch(`/keuangan/input-pembelian/fi-detail/${encodeURIComponent(noDoc)}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();
            setSelectedDetail({
                ...json?.header,
                ppn_percent: json?.ppn_percent ?? null,
            });
        } catch {
            setSelectedDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const applySuggestion = async ({ noDoc, cashNominal }) => {
        if (!noDoc) return;
        setSuggestLoading(true);
        try {
            const params = new URLSearchParams();
            if (cashNominal) params.set('nominal', String(cashNominal));
            const res = await fetch(`/keuangan/input-pembelian/suggest/${encodeURIComponent(noDoc)}?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();

            const suggestedKet = String(json?.keterangan ?? '').trim();
            if (keteranganAuto && suggestedKet) {
                setKeterangan(suggestedKet);
            }

            const suggestedKas = String(json?.kode_akun ?? '').trim();
            if (suggestedKas && kodeAkunAuto) {
                setKodeAkun(suggestedKas);
            }

            // voucher_type is derived from selected kas/bank account (no user selection)

            const beban = Array.isArray(json?.beban_lines) ? json.beban_lines : [];
            if (beban.length) {
                setBebanLines(
                    beban.map((l) => ({
                        akun: String(l?.akun ?? '').trim(),
                        jenis: String(l?.jenis ?? ''),
                        nominal: Number(l?.nominal ?? 0),
                    }))
                );
            } else {
                setBebanLines([
                    {
                        akun: '',
                        jenis: 'DPP',
                        nominal: calc.dppCash,
                    },
                ]);
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
        const noDoc = String(selected?.no_doc ?? '').trim();
        if (!noDoc) return;
        if (autoSuggestedNoDoc === noDoc) return;
        const bayar = Number(selected?.pembayaran ?? 0);
        const totalInv = Number(selected?.total ?? 0);
        const cashNominal = bayar > 0 ? bayar : totalInv;
        setAutoSuggestedNoDoc(noDoc);
        applySuggestion({ noDoc, cashNominal });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.no_doc]);

    const submit = () => {
        if (!selected?.no_doc) return;
        if (!kodeAkun) return;
        if (!tglVoucher) return;
        if (calc.taxCash > 0 && !ppnAkun) return;
        if (!bebanLines?.length || !bebanLines[0]?.akun) return;
        if (calc.taxCash > 0 && (bebanLines?.length ?? 0) > 2) return;

        setSaving(true);
        router.post(
            '/keuangan/input-pembelian',
            {
                no_doc: selected.no_doc,
                kode_akun: kodeAkun,
                tgl_voucher: tglVoucher,
                voucher_type: voucherType,
                ppn_akun: calc.taxCash > 0 ? ppnAkun : null,
                beban_lines: (bebanLines ?? []).map((l) => ({
                    akun: String(l?.akun ?? ''),
                    jenis: String(l?.jenis ?? ''),
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
                    setKeterangan('');
                    setNominal('');
                    fetchRows();
                },
            }
        );
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Input Pembelian', href: '/keuangan/input-pembelian' }, { title: 'Input Baru', href: '/keuangan/input-pembelian/create' }]}>
            <Head title="Input Pembelian - Input Baru" />

            <div className="flex flex-col gap-4 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle>Pilih Data Pembelian (FI)</CardTitle>
                                    <div className="text-xs text-muted-foreground">
                                        Ambil dari <span className="font-mono">tb_kdinvin</span>, lalu simpan ke <span className="font-mono">tb_kas</span>.
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={() => router.visit('/keuangan/input-pembelian')}>
                                    Kembali
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Input
                                    placeholder="Cari no_doc, ref_po, vendor..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full max-w-xs"
                                />
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="w-full max-w-xs">
                                        <SelectValue placeholder="Filter status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                        <TableHead>No FI</TableHead>
                                        <TableHead>Inv Date</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Pembayaran</TableHead>
                                        <TableHead className="text-right">Sisa</TableHead>
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
                                        emptyTitle="Tidak ada data."
                                        emptyDescription="Ubah filter atau kata kunci pencarian."
                                    />
                                    {!loading && !error && displayed.map((row) => {
                                        const statusBadge = getInvoiceStatus(row);
                                        const active = selected?.no_doc === row?.no_doc;
                                        return (
                                            <TableRow
                                                key={row?.no_doc ?? Math.random()}
                                                onClick={() => {
                                                    applySelectedToForm(row);
                                                    const noDoc = String(row?.no_doc ?? '').trim();
                                                    fetchFiDetail(noDoc);
                                                }}
                                                className={`cursor-pointer ${active ? 'bg-primary/5' : ''}`}
                                            >
                                                <TableCell className="font-medium">{row?.no_doc ?? '-'}</TableCell>
                                                <TableCell>{formatDate(row?.inv_d)}</TableCell>
                                                <TableCell className="max-w-[260px] truncate" title={row?.nm_vdr ?? ''}>
                                                    {row?.nm_vdr ?? '-'}
                                                </TableCell>
                                                <TableCell className="text-right">{`Rp ${formatNumber(row?.total ?? 0)}`}</TableCell>
                                                <TableCell className="text-right">{`Rp ${formatNumber(row?.pembayaran ?? 0)}`}</TableCell>
                                                <TableCell className="text-right">{`Rp ${formatNumber(row?.sisa_bayar ?? 0)}`}</TableCell>
                                                <TableCell>
                                                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
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
                            <CardTitle>Jurnal ke Buku Kas</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Voucher otomatis: <span className="font-mono">{'{DB}/{CV|GV|BV}/00000001'}</span> (keluar).
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                                <div className="text-xs text-muted-foreground">FI terpilih</div>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold">{selected?.no_doc ?? '-'}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {selected?.nm_vdr ? String(selected.nm_vdr) : 'Pilih baris FI di tabel.'}
                                        </div>
                                    </div>
                                    {selected?.jurnal ? (
                                        <Badge variant="default" className="shrink-0">
                                            {String(selected.jurnal)}
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="shrink-0">
                                            Draft
                                        </Badge>
                                    )}
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

                            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/10 p-3">
                                <div className="text-xs text-muted-foreground">PPN</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground">PO PPN %</div>
                                    <div className="text-right font-medium">
                                        {detailLoading ? '...' : (selectedDetail?.ppn_percent ?? '-') }
                                    </div>
                                    <div className="text-muted-foreground">Tax (tb_kdinvin.tax)</div>
                                    <div className="text-right font-medium">{`Rp ${formatNumber(calc.taxInv)}`}</div>
                                    <div className="text-muted-foreground">DPP</div>
                                    <div className="text-right font-medium">{`Rp ${formatNumber(calc.dppInv)}`}</div>
                                    <div className="text-muted-foreground">Total</div>
                                    <div className="text-right font-medium">{`Rp ${formatNumber(calc.totalInv)}`}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Nominal kas/bank dialokasikan proporsional bila pembayaran tidak sama dengan total invoice.
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!selected?.no_doc || suggestLoading || autoSuggestedNoDoc === String(selected?.no_doc ?? '')}
                                        onClick={() =>
                                            applySuggestion({
                                                noDoc: String(selected?.no_doc ?? '').trim(),
                                                cashNominal: calc.cashNominal,
                                            })
                                        }
                                    >
                                        {suggestLoading ? 'Menganalisa...' : 'Auto Suggest Ulang'}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">Beban (DPP)</div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={calc.taxCash > 0 ? (bebanLines?.length ?? 0) >= 2 : (bebanLines?.length ?? 0) >= 3}
                                        onClick={() => {
                                            setBebanLines((prev) => [...(prev ?? []), { akun: '', jenis: 'Debit', nominal: 0 }]);
                                        }}
                                    >
                                        Tambah
                                    </Button>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <div className="grid gap-3">
	                                        {(bebanLines ?? []).map((line, idx) => (
	                                            <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-2">
	                                                <div className="flex items-center justify-between gap-2">
	                                                    <div className="text-xs font-medium text-muted-foreground">{`Beban ${getBebanSlotLabel(idx)}`}</div>
	                                                    <div className="flex items-center gap-2">
	                                                        {(bebanLines?.length ?? 0) > 1 ? (
	                                                            <Button
	                                                                type="button"
	                                                                variant="ghost"
                                                                onClick={() => setBebanLines((prev) => (prev ?? []).filter((_, i) => i !== idx))}
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
	                                                        onClick={() => {
	                                                            setActiveBebanIndex(idx);
	                                                        }}
	                                                    >
	                                                        <span className="text-left leading-snug break-words whitespace-normal">
	                                                            {line?.akun ? getAccountLabel(expenseAccountOptions, line.akun) : 'Pilih akun beban'}
	                                                        </span>
	                                                        <span className="shrink-0 text-muted-foreground">Cari</span>
	                                                    </Button>
	                                                </div>
	                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
	                                                    <div className="space-y-1">
	                                                        <Label className="text-xs text-muted-foreground">Jenis</Label>
	                                                        <Select
	                                                            value={String(line?.jenis ?? '') || 'Debit'}
	                                                            onValueChange={(v) => {
	                                                                setBebanLines((prev) =>
	                                                                    (prev ?? []).map((l, i) => (i === idx ? { ...l, jenis: v } : l))
	                                                                );
	                                                            }}
	                                                        >
	                                                            <SelectTrigger className="h-9">
	                                                                <SelectValue placeholder="Jenis" />
	                                                            </SelectTrigger>
	                                                            <SelectContent>
	                                                                <SelectItem value="Debit">Debit</SelectItem>
	                                                                <SelectItem value="Kredit">Kredit</SelectItem>
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
	                                                                setBebanLines((prev) =>
	                                                                    (prev ?? []).map((l, i) =>
	                                                                        i === idx ? { ...l, nominal: v === '' ? 0 : Number(v) } : l
	                                                                    )
	                                                                );
	                                                            }}
	                                                            placeholder="Jumlah Beban (Rp)"
	                                                        />
	                                                    </div>
	                                                </div>
	                                            </div>
	                                        ))}
	                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-muted-foreground">DPP target</div>
                                        <div className="text-right font-medium">{`Rp ${formatNumber(calc.dppCash)}`}</div>
                                        <div className="text-muted-foreground">Total beban</div>
                                        <div className="text-right font-medium">{`Rp ${formatNumber(bebanSum)}`}</div>
                                        <div className="text-muted-foreground">Selisih</div>
                                        <div className={`text-right font-medium ${bebanDiff === 0 ? 'text-foreground' : 'text-destructive'}`}>
                                            {`Rp ${formatNumber(bebanDiff)}`}
                                        </div>
                                    </div>
                                    {calc.taxCash > 0 ? (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Catatan: sesuai standar perusahaan, PPN masuk ke <span className="font-mono">Kode_Akun2</span>, sehingga saat ada PPN maksimal beban DPP adalah 2 baris.
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {calc.taxCash > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Akun PPN Masukan</div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-between"
                                        onClick={() => setPpnDialogOpen(true)}
                                    >
                                        <span className="truncate">{ppnAkun ? getAccountLabel(expenseAccountOptions, ppnAkun) : 'Pilih akun PPN'}</span>
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
                                <div className="text-sm font-medium">Nominal</div>
                                <Input
                                    inputMode="numeric"
                                    value={nominal}
                                    onChange={(e) => setNominal(e.target.value.replace(/[^\d.]/g, ''))}
                                    placeholder="Contoh: 3500000"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Sistem mencatat sebagai <span className="font-medium text-foreground">keluar</span> (Mutasi negatif).
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    className="w-full"
                                    disabled={
                                        saving ||
                                        !selected?.no_doc ||
                                        !kodeAkun ||
                                        !tglVoucher ||
                                        !bebanLines?.length ||
                                        !bebanLines?.[0]?.akun ||
                                        bebanDiff !== 0 ||
                                        (calc.taxCash > 0 && !ppnAkun) ||
                                        (calc.taxCash > 0 && (bebanLines?.length ?? 0) > 2)
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
                                        setKeterangan('');
                                        setNominal('');
                                    }}
                                >
                                    Reset
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AccountSearchDialog
                title={`Pilih Akun Beban (DPP)${
                    activeBebanIndex !== null ? ` — Beban ${getBebanSlotLabel(activeBebanIndex)}` : ''
                }`}
                description="Cari berdasarkan kode akun atau nama akun."
                open={activeBebanIndex !== null}
                onOpenChange={(v) => {
                    if (!v) setActiveBebanIndex(null);
                }}
                options={expenseAccountOptions}
                value={activeBebanIndex !== null ? bebanLines?.[activeBebanIndex]?.akun : ''}
                onSelect={(val) => {
                    if (activeBebanIndex === null) return;
                    setBebanLines((prev) => (prev ?? []).map((l, i) => (i === activeBebanIndex ? { ...l, akun: val } : l)));
                }}
            />
            <AccountSearchDialog
                title="Pilih Akun PPN Masukan"
                description="Wajib diisi jika nilai PPN > 0."
                open={ppnDialogOpen}
                onOpenChange={setPpnDialogOpen}
                options={expenseAccountOptions}
                value={ppnAkun}
                onSelect={(v) => {
                    setPpnAkunAuto(false);
                    setPpnAkun(v);
                }}
            />
        </AppLayout>
    );
}
