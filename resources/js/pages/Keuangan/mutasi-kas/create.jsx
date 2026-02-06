import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShadcnTableStateRows } from '@/components/data-states/TableStateRows';
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

const directionBadge = (mutasi) => {
    const v = Number(mutasi ?? 0);
    if (v > 0) return { label: 'Masuk', variant: 'default' };
    if (v < 0) return { label: 'Keluar', variant: 'destructive' };
    return { label: 'Netral', variant: 'secondary' };
};

const getAccountLabel = (options, value) => {
    const v = String(value ?? '').trim();
    if (!v) return '-';
    const found = options?.find((opt) => String(opt?.value ?? '') === v);
    return found?.label ?? v;
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
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari berdasarkan kode akun atau nama akun..." />
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
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${active ? 'bg-primary/5' : ''}`}
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

export default function MutasiKasCreate({
    filters = {},
    accountOptions = [],
    defaultAccount = null,
    glAccountOptions = [],
    templates = [],
}) {
    const guessVoucherType = (kodeAkun) => {
        const v = String(kodeAkun ?? '').trim().toUpperCase();
        return v === '1101AD' || v.startsWith('1101') ? 'GV' : 'BV';
    };

    const [histSearch, setHistSearch] = useState(filters?.search ?? '');
    const [histPageSize, setHistPageSize] = useState(10);
    const [histPage, setHistPage] = useState(1);
    const [histRows, setHistRows] = useState([]);
    const [histTotal, setHistTotal] = useState(0);
    const [histLoading, setHistLoading] = useState(false);
    const [histError, setHistError] = useState(null);

    const [mode, setMode] = useState('out'); // out|in|transfer
    const [templateKey, setTemplateKey] = useState('');

    // in/out
    const [kodeAkun, setKodeAkun] = useState(defaultAccount ?? (accountOptions?.[0]?.value ?? ''));
    const [kodeAkunTouched, setKodeAkunTouched] = useState(false);

    // transfer
    const [sourceAkun, setSourceAkun] = useState(defaultAccount ?? (accountOptions?.[0]?.value ?? ''));
    const [destAkun, setDestAkun] = useState(accountOptions?.[1]?.value ?? (accountOptions?.[0]?.value ?? ''));
    const [sourceTouched, setSourceTouched] = useState(false);
    const [destTouched, setDestTouched] = useState(false);

    const [voucherType, setVoucherType] = useState(() => guessVoucherType(defaultAccount ?? (accountOptions?.[0]?.value ?? '')));
    const [voucherTypeTouched, setVoucherTypeTouched] = useState(false);

    const [tglVoucher, setTglVoucher] = useState(() => new Date().toISOString().slice(0, 10));

    const [nominal, setNominal] = useState('');
    const nominalNumber = useMemo(() => {
        const n = Number(nominal);
        return Number.isFinite(n) ? n : 0;
    }, [nominal]);

    const [keterangan, setKeterangan] = useState('');
    const [keteranganTouched, setKeteranganTouched] = useState(false);

    const [hasPpn, setHasPpn] = useState(false);
    const [ppnNominal, setPpnNominal] = useState('');
    const ppnNumber = useMemo(() => {
        const n = Number(ppnNominal);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }, [ppnNominal]);
    const [ppnAkun, setPpnAkun] = useState('');
    const [ppnAkunTouched, setPpnAkunTouched] = useState(false);
    const [ppnDialogOpen, setPpnDialogOpen] = useState(false);

    const [lines, setLines] = useState(() => [{ akun: '', jenis: 'Debit', nominal: 0 }]);
    const [lineDialogOpen, setLineDialogOpen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState(null);

    const [suggestLoading, setSuggestLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const dppTarget = useMemo(() => {
        const base = Math.max(0, nominalNumber);
        if (mode === 'transfer') return base;
        return Math.max(0, base - (hasPpn ? ppnNumber : 0));
    }, [nominalNumber, hasPpn, ppnNumber, mode]);

    const maxLines = useMemo(() => {
        if (mode === 'transfer') return 1;
        if (hasPpn && ppnNumber > 0) return 2;
        return 3;
    }, [mode, hasPpn, ppnNumber]);

    const getSlotLabel = (idx) => {
        if (mode === 'transfer') return 1;
        if (hasPpn && ppnNumber > 0) return idx === 0 ? 1 : 3;
        return idx + 1;
    };

    const linesSum = useMemo(() => (lines ?? []).reduce((acc, l) => acc + Number(l?.nominal ?? 0), 0), [lines]);
    const linesDiff = useMemo(() => Math.round((dppTarget - linesSum) * 100) / 100, [dppTarget, linesSum]);

    const selectedTemplate = useMemo(() => (templates ?? []).find((t) => String(t?.key ?? '') === String(templateKey)), [templates, templateKey]);

    const fetchHistory = async () => {
        setHistLoading(true);
        setHistError(null);
        try {
            const params = new URLSearchParams();
            if (histSearch) params.set('search', histSearch);
            const acc = mode === 'transfer' ? sourceAkun : kodeAkun;
            if (acc) params.set('account', acc);
            // Do not force current month; "Riwayat terbaru" should show latest rows even if
            // the last transactions are in previous periods.
            // (Index page already supports period filtering.)
            params.set('pageSize', 'all');

            const res = await fetch(`/keuangan/mutasi-kas/rows?${params.toString()}`, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();
            setHistRows(Array.isArray(json?.rows) ? json.rows : []);
            setHistTotal(Number(json?.total ?? 0));
        } catch (e) {
            setHistError(readApiError(e));
            setHistRows([]);
            setHistTotal(0);
        } finally {
            setHistLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, kodeAkun, sourceAkun]);

    useEffect(() => {
        const t = window.setTimeout(() => fetchHistory(), 350);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [histSearch]);

    const histDisplayed = useMemo(() => {
        if (histPageSize === Infinity) return histRows;
        const start = (histPage - 1) * histPageSize;
        return histRows.slice(start, start + histPageSize);
    }, [histRows, histPage, histPageSize]);

    const histTotalPages = useMemo(() => {
        if (histPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil((histTotal ?? 0) / histPageSize));
    }, [histTotal, histPageSize]);

    const runSuggest = async ({ reason } = {}) => {
        if (mode === 'transfer' && (!sourceAkun || !destAkun)) return;
        if ((mode === 'in' || mode === 'out') && !kodeAkun) return;

        setSuggestLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('mode', mode);
            if (mode === 'transfer') {
                params.set('source', sourceAkun);
                params.set('dest', destAkun);
            } else {
                params.set('account', kodeAkun);
            }
            if (templateKey) params.set('templateKey', templateKey);
            if (nominalNumber > 0) params.set('nominal', String(nominalNumber));
            if (keterangan.trim()) params.set('keterangan', keterangan);
            params.set('hasPpn', String(hasPpn && ppnNumber > 0));
            if (ppnNumber > 0) params.set('ppnNominal', String(ppnNumber));

            const res = await fetch(`/keuangan/mutasi-kas/suggest?${params.toString()}`, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw await normalizeApiError(res);
            const json = await res.json();

            if (mode === 'transfer') {
                const s = String(json?.source ?? '').trim();
                const d = String(json?.dest ?? '').trim();
                if (s && !sourceTouched) setSourceAkun(s);
                if (d && !destTouched) setDestAkun(d);
            } else {
                const suggestedKas = String(json?.kode_akun ?? '').trim();
                if (suggestedKas && !kodeAkunTouched) setKodeAkun(suggestedKas);
            }

            if (!voucherTypeTouched && json?.voucher_type) {
                setVoucherType(String(json.voucher_type));
            }
            if (!keteranganTouched && json?.keterangan) {
                setKeterangan(String(json.keterangan));
            }
            if (!ppnAkunTouched && hasPpn && ppnNumber > 0 && json?.ppn_akun) {
                setPpnAkun(String(json.ppn_akun));
            }

            const suggestedLines = Array.isArray(json?.lines) ? json.lines : [];
            if (mode === 'transfer') {
                setLines([{ akun: destAkun, jenis: 'Debit', nominal: nominalNumber }]);
            } else if (suggestedLines.length) {
                setLines((prev) => {
                    // only auto-fill if user hasn't manually set akun in first line yet
                    const prevTouched = (prev ?? []).some((l) => String(l?.akun ?? '').trim() !== '');
                    if (prevTouched && reason === 'typing') return prev;
                    return suggestedLines.slice(0, maxLines).map((l, idx) => ({
                        akun: String(l?.akun ?? ''),
                        jenis: String(l?.jenis ?? (mode === 'in' ? 'Kredit' : 'Debit')),
                        nominal: Number(l?.nominal ?? (idx === 0 ? dppTarget : 0)),
                    }));
                });
            }
        } catch {
            // ignore suggest failure (non-blocking)
        } finally {
            setSuggestLoading(false);
        }
    };

    // Auto-suggest triggers
    useEffect(() => {
        if (!templateKey) return;
        const t = window.setTimeout(() => runSuggest({ reason: 'template' }), 200);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateKey]);

    useEffect(() => {
        const t = window.setTimeout(() => runSuggest({ reason: 'typing' }), 500);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keterangan, mode]);

    useEffect(() => {
        const t = window.setTimeout(() => runSuggest({ reason: 'recalc' }), 250);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kodeAkun, sourceAkun, destAkun, nominalNumber, hasPpn, ppnNumber, mode]);

    // Keep default voucher type when account changes (if not touched)
    useEffect(() => {
        if (voucherTypeTouched) return;
        const acc = mode === 'transfer' ? sourceAkun : kodeAkun;
        setVoucherType(guessVoucherType(acc));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kodeAkun, sourceAkun, mode]);

    // Keep lines count under maxLines and keep DPP allocation consistent
    useEffect(() => {
        setLines((prev) => {
            const next = Array.isArray(prev) ? prev.slice(0, maxLines) : [];
            if (next.length === 0) {
                return [{ akun: '', jenis: mode === 'in' ? 'Kredit' : 'Debit', nominal: dppTarget }];
            }
            const running = next.reduce((acc, l, i) => (i === next.length - 1 ? acc : acc + Number(l?.nominal ?? 0)), 0);
            const lastNom = Math.max(0, Math.round((dppTarget - running) * 100) / 100);
            next[next.length - 1] = { ...next[next.length - 1], nominal: lastNom };
            return next;
        });
    }, [dppTarget, maxLines, mode]);

    // Disable PPN for transfer
    useEffect(() => {
        if (mode !== 'transfer') return;
        setHasPpn(false);
        setPpnNominal('');
        setPpnAkun('');
    }, [mode]);

    const applyTemplateDefaults = (key) => {
        const t = (templates ?? []).find((x) => String(x?.key ?? '') === String(key));
        if (!t) return;
        if (t?.defaultMode && !['in', 'out', 'transfer'].includes(String(t.defaultMode))) return;
        if (!t?.defaultMode) return;
        setMode(String(t.defaultMode));
        if (!keteranganTouched && t?.example) setKeterangan(String(t.example));
    };

    const onSave = () => {
        if (saving) return;
        if (!tglVoucher) return;
        if (nominalNumber <= 0) return;

        if (mode === 'transfer') {
            if (!sourceAkun || !destAkun || sourceAkun === destAkun) return;
        } else {
            if (!kodeAkun) return;
            if (hasPpn && ppnNumber > 0 && !ppnAkun) return;
            if (linesDiff !== 0) return;
            const missingAkun = (lines ?? []).some((l) => !String(l?.akun ?? '').trim());
            if (missingAkun) return;
        }

        setSaving(true);
        router.post(
            '/keuangan/mutasi-kas',
            {
                mode,
                kode_akun: mode === 'transfer' ? null : kodeAkun,
                source: mode === 'transfer' ? sourceAkun : null,
                dest: mode === 'transfer' ? destAkun : null,
                tgl_voucher: tglVoucher,
                voucher_type: voucherType,
                nominal: nominalNumber,
                keterangan,
                has_ppn: mode === 'transfer' ? false : hasPpn,
                ppn_akun: hasPpn && ppnNumber > 0 ? ppnAkun : null,
                ppn_nominal: hasPpn && ppnNumber > 0 ? ppnNumber : 0,
                lines:
                    mode === 'transfer'
                        ? [{ akun: destAkun, jenis: 'Debit', nominal: nominalNumber }]
                        : (lines ?? []).slice(0, maxLines).map((l) => ({
                              akun: String(l?.akun ?? ''),
                              jenis: String(l?.jenis ?? (mode === 'in' ? 'Kredit' : 'Debit')),
                              nominal: Number(l?.nominal ?? 0),
                          })),
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setNominal('');
                    setKeterangan('');
                    setKeteranganTouched(false);
                    setHasPpn(false);
                    setPpnNominal('');
                    setPpnAkun('');
                    setPpnAkunTouched(false);
                    setLines([{ akun: '', jenis: mode === 'in' ? 'Kredit' : 'Debit', nominal: 0 }]);
                    fetchHistory();
                },
            }
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Mutasi Kas', href: '/keuangan/mutasi-kas' },
                { title: 'Mutasi Baru', href: '/keuangan/mutasi-kas/create' },
            ]}
        >
            <Head title="Mutasi Kas - Mutasi Baru" />

            <div className="flex flex-col gap-4 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle>Riwayat Mutasi Terbaru</CardTitle>
                                    <div className="text-xs text-muted-foreground">
                                        Referensi cepat dari <span className="font-mono">tb_kas</span> untuk akun yang dipilih.
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={() => router.visit('/keuangan/mutasi-kas')}>
                                    Kembali
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Input
                                    placeholder="Cari voucher / keterangan..."
                                    value={histSearch}
                                    onChange={(e) => setHistSearch(e.target.value)}
                                    className="w-full max-w-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setHistPage(1);
                                        fetchHistory();
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
                                        <TableHead>Kode Voucher</TableHead>
                                        <TableHead>Tgl</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="text-right">Mutasi</TableHead>
                                        <TableHead className="text-right">Saldo</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <ShadcnTableStateRows
                                        columns={6}
                                        loading={histLoading}
                                        error={histError}
                                        onRetry={fetchHistory}
                                        isEmpty={!histLoading && !histError && histDisplayed.length === 0}
                                        emptyTitle="Tidak ada riwayat."
                                        emptyDescription="Ubah kata kunci atau pilih akun kas/bank."
                                    />
                                    {!histLoading &&
                                        !histError &&
                                        histDisplayed.map((row) => {
                                            const badge = directionBadge(row?.Mutasi_Kas);
                                            const mut = Number(row?.Mutasi_Kas ?? 0);
                                            return (
                                                <TableRow
                                                    key={row?.Kode_Voucher ?? Math.random()}
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        if (!keteranganTouched && row?.Keterangan) {
                                                            setKeterangan(String(row.Keterangan));
                                                        }
                                                        if (nominal === '') {
                                                            setNominal(String(Math.abs(mut)));
                                                        }
                                                        runSuggest({ reason: 'history' });
                                                    }}
                                                >
                                                    <TableCell className="whitespace-pre-wrap font-mono text-xs">{String(row?.Kode_Voucher ?? '-')}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{formatDate(row?.Tgl_Voucher)}</TableCell>
                                                    <TableCell className="whitespace-normal break-words text-sm">{String(row?.Keterangan ?? '') || '-'}</TableCell>
                                                    <TableCell className={`whitespace-nowrap text-right ${mut < 0 ? 'text-destructive' : mut > 0 ? 'text-emerald-500' : ''}`}>
                                                        Rp {formatNumber(mut)}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-right">Rp {formatNumber(row?.Saldo)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={badge.variant}>{badge.label}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>

                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="text-sm text-muted-foreground">Total data: {histTotal}</div>
                                <div className="flex items-center gap-3">
                                    <Select
                                        value={histPageSize === Infinity ? 'all' : String(histPageSize)}
                                        onValueChange={(v) => {
                                            const num = v === 'all' ? Infinity : Number(v);
                                            setHistPageSize(num);
                                            setHistPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Per halaman" />
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
                                        disabled={histPage <= 1 || histPageSize === Infinity}
                                        onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </Button>
                                    <div className="min-w-[64px] text-center text-sm">
                                        {histPage}/{histTotalPages}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={histPage >= histTotalPages || histPageSize === Infinity}
                                        onClick={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="space-y-2">
                            <CardTitle>Mutasi Kas</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Standar perusahaan: PPN (jika ada) selalu di slot 2, dan DPP maksimal 2 baris (slot 1 & 3).
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="text-sm font-medium">Mode transaksi</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        type="button"
                                        variant={mode === 'out' ? 'default' : 'outline'}
                                        onClick={() => setMode('out')}
                                    >
                                        Keluar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={mode === 'in' ? 'default' : 'outline'}
                                        onClick={() => setMode('in')}
                                    >
                                        Masuk
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={mode === 'transfer' ? 'default' : 'outline'}
                                        onClick={() => setMode('transfer')}
                                    >
                                        Transfer
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Template transaksi (opsional)</div>
                                <Select
                                    value={templateKey || 'none'}
                                    onValueChange={(v) => {
                                        const next = v === 'none' ? '' : v;
                                        setTemplateKey(next);
                                        if (next) applyTemplateDefaults(next);
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pilih template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Tanpa template —</SelectItem>
                                        {(templates ?? []).map((t) => (
                                            <SelectItem key={t.key} value={t.key}>
                                                {String(t?.label ?? '').slice(0, 64)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedTemplate?.label ? (
                                    <div className="text-[11px] text-muted-foreground">Contoh: {String(selectedTemplate.example ?? selectedTemplate.label)}</div>
                                ) : null}
                            </div>

                            {mode === 'transfer' ? (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <div className="text-sm font-medium">Akun sumber</div>
                                        <Select
                                            value={sourceAkun}
                                            onValueChange={(v) => {
                                                setSourceAkun(v);
                                                setSourceTouched(true);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Akun sumber" />
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
                                        <div className="text-sm font-medium">Akun tujuan</div>
                                        <Select
                                            value={destAkun}
                                            onValueChange={(v) => {
                                                setDestAkun(v);
                                                setDestTouched(true);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Akun tujuan" />
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
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Akun kas/bank</div>
                                    <Select
                                        value={kodeAkun}
                                        onValueChange={(v) => {
                                            setKodeAkun(v);
                                            setKodeAkunTouched(true);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Akun kas/bank" />
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
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Tipe voucher</div>
                                    <Select
                                        value={voucherType}
                                        onValueChange={(v) => {
                                            setVoucherType(v);
                                            setVoucherTypeTouched(true);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="GV/BV" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GV">GV</SelectItem>
                                            <SelectItem value="BV">BV</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Tanggal voucher</div>
                                    <Input type="date" value={tglVoucher} onChange={(e) => setTglVoucher(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Nominal</div>
                                <Input
                                    inputMode="numeric"
                                    value={nominal}
                                    onChange={(e) => setNominal(e.target.value)}
                                    placeholder="Contoh: 1500000"
                                />
                                <div className="text-[11px] text-muted-foreground">Mutasi {mode === 'in' ? 'masuk' : mode === 'out' ? 'keluar' : 'transfer'} otomatis dihitung dari nominal.</div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Keterangan</div>
                                <Input
                                    value={keterangan}
                                    onChange={(e) => {
                                        setKeterangan(e.target.value);
                                        setKeteranganTouched(true);
                                    }}
                                    placeholder="Contoh: Mutasi/biaya admin bank..."
                                />
                                <div className="flex items-center justify-between">
                                    <div className="text-[11px] text-muted-foreground">
                                        {suggestLoading ? 'AI: menyusun rekomendasi…' : 'AI: auto-suggest aktif (template + keterangan).'}
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => runSuggest({ reason: 'manual' })}>
                                        Refresh AI
                                    </Button>
                                </div>
                            </div>

                            <div className={`rounded-md border p-3 ${mode === 'transfer' ? 'opacity-60' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">PPN (opsional)</div>
                                        <div className="text-[11px] text-muted-foreground">Jika diisi, sistem pakai slot 2.</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={hasPpn && mode !== 'transfer'}
                                            onCheckedChange={(v) => {
                                                if (mode === 'transfer') return;
                                                const on = Boolean(v);
                                                setHasPpn(on);
                                                if (!on) {
                                                    setPpnNominal('');
                                                    setPpnAkun('');
                                                    setPpnAkunTouched(false);
                                                }
                                            }}
                                            disabled={mode === 'transfer'}
                                        />
                                        <span className="text-sm">Aktif</span>
                                    </div>
                                </div>

                                {hasPpn && mode !== 'transfer' ? (
                                    <div className="mt-3 grid grid-cols-1 gap-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm">Akun PPN</Label>
                                                <Button type="button" variant="outline" size="sm" onClick={() => setPpnDialogOpen(true)}>
                                                    Cari
                                                </Button>
                                            </div>
                                            <div className="rounded-md border px-3 py-2 text-sm">
                                                {ppnAkun ? getAccountLabel(glAccountOptions, ppnAkun) : <span className="text-muted-foreground">Belum dipilih</span>}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm">Nominal PPN</Label>
                                            <Input inputMode="numeric" value={ppnNominal} onChange={(e) => setPpnNominal(e.target.value)} placeholder="0" />
                                            <div className="text-[11px] text-muted-foreground">
                                                Jenis PPN otomatis: <span className="font-medium">{mode === 'in' ? 'Kredit' : 'Debit'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">{mode === 'in' ? 'Akun lawan (Pendapatan/DPP)' : 'Akun lawan (Beban/DPP)'}</div>
                                        <div className="text-[11px] text-muted-foreground">Total harus sama dengan target DPP.</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={mode === 'transfer' || lines.length >= maxLines}
                                            onClick={() =>
                                                setLines((prev) => {
                                                    const next = Array.isArray(prev) ? [...prev] : [];
                                                    next.push({ akun: '', jenis: mode === 'in' ? 'Kredit' : 'Debit', nominal: 0 });
                                                    return next;
                                                })
                                            }
                                        >
                                            Tambah
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {(lines ?? []).slice(0, maxLines).map((l, idx) => (
                                        <div key={idx} className="rounded-md border p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium">
                                                    {mode === 'in' ? 'Pendapatan' : 'Beban'} {getSlotLabel(idx)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={String(l?.jenis ?? (mode === 'in' ? 'Kredit' : 'Debit'))}
                                                        onValueChange={(v) =>
                                                            setLines((prev) => {
                                                                const next = [...(prev ?? [])];
                                                                next[idx] = { ...next[idx], jenis: v };
                                                                return next;
                                                            })
                                                        }
                                                        disabled={mode === 'transfer'}
                                                    >
                                                        <SelectTrigger className="h-8 w-[120px]">
                                                            <SelectValue placeholder="Jenis" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Debit">Debit</SelectItem>
                                                            <SelectItem value="Kredit">Kredit</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setActiveLineIndex(idx);
                                                            setLineDialogOpen(true);
                                                        }}
                                                        disabled={mode === 'transfer'}
                                                    >
                                                        Cari
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={mode === 'transfer' || lines.length <= 1}
                                                        onClick={() =>
                                                            setLines((prev) => {
                                                                const next = [...(prev ?? [])];
                                                                next.splice(idx, 1);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        Hapus
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-2 grid grid-cols-1 gap-2">
                                                <div className="rounded-md border px-3 py-2 text-sm">
                                                    {l?.akun ? getAccountLabel(glAccountOptions, l.akun) : <span className="text-muted-foreground">Pilih akun</span>}
                                                </div>
                                                <Input
                                                    inputMode="numeric"
                                                    value={String(l?.nominal ?? '')}
                                                    onChange={(e) =>
                                                        setLines((prev) => {
                                                            const next = [...(prev ?? [])];
                                                            next[idx] = { ...next[idx], nominal: e.target.value === '' ? 0 : Number(e.target.value) };
                                                            return next;
                                                        })
                                                    }
                                                    placeholder="0"
                                                    disabled={mode === 'transfer'}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-md bg-muted/30 p-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span>Target DPP</span>
                                        <span className="font-medium">Rp {formatNumber(dppTarget)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Total DPP</span>
                                        <span className="font-medium">Rp {formatNumber(linesSum)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Selisih</span>
                                        <span className={`font-medium ${linesDiff === 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                            Rp {formatNumber(linesDiff)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button type="button" className="w-full" disabled={saving || suggestLoading} onClick={onSave}>
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setTemplateKey('');
                                        setMode('out');
                                        setNominal('');
                                        setKeterangan('');
                                        setKeteranganTouched(false);
                                        setHasPpn(false);
                                        setPpnNominal('');
                                        setPpnAkun('');
                                        setPpnAkunTouched(false);
                                        setLines([{ akun: '', jenis: 'Debit', nominal: 0 }]);
                                        setVoucherTypeTouched(false);
                                        setVoucherType(guessVoucherType(kodeAkun));
                                        setKodeAkunTouched(false);
                                        setSourceTouched(false);
                                        setDestTouched(false);
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
                title="Pilih akun PPN"
                description="Cari akun berdasarkan kode atau nama akun."
                open={ppnDialogOpen}
                onOpenChange={setPpnDialogOpen}
                options={glAccountOptions}
                value={ppnAkun}
                onSelect={(v) => {
                    setPpnAkun(v);
                    setPpnAkunTouched(true);
                }}
            />

            <AccountSearchDialog
                title="Pilih akun lawan (DPP)"
                description="Cari akun berdasarkan kode atau nama akun."
                open={lineDialogOpen}
                onOpenChange={setLineDialogOpen}
                options={glAccountOptions}
                value={activeLineIndex !== null ? lines?.[activeLineIndex]?.akun : ''}
                onSelect={(v) => {
                    if (activeLineIndex === null) return;
                    setLines((prev) => {
                        const next = [...(prev ?? [])];
                        next[activeLineIndex] = { ...next[activeLineIndex], akun: v };
                        return next;
                    });
                }}
            />
        </AppLayout>
    );
}
