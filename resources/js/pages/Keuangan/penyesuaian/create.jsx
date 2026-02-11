import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Keuangan', href: '#' },
    { title: 'Penyesuaian', href: '/keuangan/penyesuaian' },
    { title: 'Penyesuaian Baru', href: '/keuangan/penyesuaian/create' },
];

const formatRupiah = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(n)}`;
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
                    <DialogTitle>Pilih Akun</DialogTitle>
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

export default function KeuanganPenyesuaianCreate({
    bootstrapError = '',
    activeBookMonthYm = '',
    periodeDefault = '',
    postingDateDefault = '',
    hasPostingDate = false,
    glAccountOptions = [],
}) {
    const [periode] = useState(periodeDefault);
    const [postingDate, setPostingDate] = useState(postingDateDefault);
    const [remark, setRemark] = useState('');
    const [remarkTouched, setRemarkTouched] = useState(false);

    const [headerAkun, setHeaderAkun] = useState('');
    const [headerNominal, setHeaderNominal] = useState('');
    const [headerJenis, setHeaderJenis] = useState(''); // Debit|Kredit
    const headerNominalNumber = useMemo(() => {
        const n = Number(headerNominal);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }, [headerNominal]);
    const [headerDialogOpen, setHeaderDialogOpen] = useState(false);

    const headerAkunLabel = useMemo(
        () => getAccountLabel(glAccountOptions, headerAkun),
        [glAccountOptions, headerAkun],
    );

    const [lines, setLines] = useState(() => [
        { akun: '', jenis: 'Debit', nominal: 0, touched: {} },
        { akun: '', jenis: 'Kredit', nominal: 0, touched: {} },
    ]);

    const lineAkunLabels = useMemo(() => {
        const map = new Map();
        (glAccountOptions ?? []).forEach((opt) => {
            const v = String(opt?.value ?? '').trim();
            if (!v) return;
            map.set(v, String(opt?.label ?? v));
        });
        return map;
    }, [glAccountOptions]);

    const getLineAkunLabel = (akun) => {
        const v = String(akun ?? '').trim();
        if (!v) return '';
        return lineAkunLabels.get(v) ?? v;
    };

    const [autoBalance, setAutoBalance] = useState(true);
    const [saving, setSaving] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestMeta, setSuggestMeta] = useState({
        confidence: 0,
        evidence: [],
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState(null);

    // If user picked "akun fokus", prefill line1 account (unless user already touched it).
    useEffect(() => {
        const a = String(headerAkun ?? '').trim();
        if (!a) return;
        setLines((prev) => {
            const next = [...prev];
            const first = next[0] ?? { touched: {} };
            if (first?.touched?.akun) return prev;
            next[0] = {
                ...first,
                akun: a,
            };
            return next;
        });
    }, [headerAkun]);

    // If user filled "jumlah", set line1 nominal (unless touched) so user only needs to pick remaining akun.
    useEffect(() => {
        if (headerNominalNumber <= 0) return;
        setLines((prev) => {
            const next = [...prev];
            const first = next[0] ?? { touched: {} };
            if (first?.touched?.nominal) return prev;
            next[0] = {
                ...first,
                nominal: headerNominalNumber,
            };
            return next;
        });
    }, [headerNominalNumber]);

    // If user picked "jenis fokus", prefer it for baris pertama (unless user explicitly overrides on the line).
    useEffect(() => {
        const j = String(headerJenis ?? '').trim();
        setLines((prev) => {
            const next = [...prev];
            const first = next[0] ?? { touched: {} };
            const source = String(first?.touched?.jenisSource ?? '');

            // If user already chose jenis manually on line1, don't override with header.
            if (first?.touched?.jenis && source === 'user') return prev;

            // If header cleared and line1 was only set by header before, unlock it.
            if (j !== 'Debit' && j !== 'Kredit') {
                if (first?.touched?.jenis && source === 'header') {
                    next[0] = {
                        ...first,
                        touched: { ...(first.touched ?? {}), jenis: false, jenisSource: '' },
                    };
                    return next;
                }
                return prev;
            }

            next[0] = {
                ...first,
                jenis: j,
                touched: { ...(first.touched ?? {}), jenis: true, jenisSource: 'header' },
            };
            return next;
        });
    }, [headerJenis]);

    const totals = useMemo(() => {
        let d = 0;
        let k = 0;
        (lines ?? []).forEach((l) => {
            const n = Number(l?.nominal ?? 0);
            if (!Number.isFinite(n) || n <= 0) return;
            if (String(l?.jenis ?? '') === 'Debit') d += n;
            if (String(l?.jenis ?? '') === 'Kredit') k += n;
        });
        d = Math.round(d * 100) / 100;
        k = Math.round(k * 100) / 100;
        return { debit: d, kredit: k, diff: Math.round((d - k) * 100) / 100 };
    }, [lines]);

    const canSave = useMemo(() => {
        if (bootstrapError) return false;
        if (!periode) return false;
        if (!remark.trim()) return false;
        if (!Array.isArray(lines) || lines.length < 2) return false;
        if (lines.length > 4) return false;
        const anyMissingAkun = lines.some((l) => !String(l?.akun ?? '').trim());
        if (anyMissingAkun) return false;
        const anyBadNom = lines.some(
            (l) => !Number.isFinite(Number(l?.nominal ?? 0)) || Number(l?.nominal ?? 0) <= 0,
        );
        if (anyBadNom) return false;
        return totals.diff === 0;
    }, [bootstrapError, periode, remark, lines, totals.diff]);

    // Auto-balance last line (if enabled and last line nominal not manually touched)
    // Important: guard state updates to avoid infinite rerender loops.
    useEffect(() => {
        if (!autoBalance) return;
        if (!Array.isArray(lines) || lines.length < 2) return;

        const lastIdx = lines.length - 1;
        const last = lines[lastIdx] ?? {};
        if (Boolean(last?.touched?.nominal)) return;

        // compute diff excluding last line
        let d = 0;
        let k = 0;
        lines.slice(0, lastIdx).forEach((l) => {
            const n = Number(l?.nominal ?? 0);
            if (!Number.isFinite(n) || n <= 0) return;
            if (String(l?.jenis ?? '') === 'Debit') d += n;
            if (String(l?.jenis ?? '') === 'Kredit') k += n;
        });
        d = Math.round(d * 100) / 100;
        k = Math.round(k * 100) / 100;
        const diff = Math.round((d - k) * 100) / 100;

        const needNom = Math.abs(diff);
        const needJenis = diff > 0 ? 'Kredit' : diff < 0 ? 'Debit' : String(last?.jenis ?? 'Debit');
        const jenisTouched = Boolean(last?.touched?.jenis);
        const nextJenis = jenisTouched ? String(last?.jenis ?? needJenis) : needJenis;

        const curNom = Number(last?.nominal ?? 0);
        const curNomSafe = Number.isFinite(curNom) ? curNom : 0;
        const sameNom = Math.round(curNomSafe * 100) / 100 === Math.round(needNom * 100) / 100;
        const sameJenis = jenisTouched || String(last?.jenis ?? '') === needJenis;
        if (sameNom && sameJenis) return;

        setLines((prev) => {
            if (!Array.isArray(prev) || prev.length < 2) return prev;
            const idx = prev.length - 1;
            const cur = prev[idx] ?? {};
            if (Boolean(cur?.touched?.nominal)) return prev;

            const curJenisTouched = Boolean(cur?.touched?.jenis);
            const desiredJenis = curJenisTouched ? String(cur?.jenis ?? nextJenis) : nextJenis;
            const curN = Number(cur?.nominal ?? 0);
            const curNSafe = Number.isFinite(curN) ? curN : 0;
            const sameN = Math.round(curNSafe * 100) / 100 === Math.round(needNom * 100) / 100;
            const sameJ = curJenisTouched || String(cur?.jenis ?? '') === desiredJenis;
            if (sameN && sameJ) return prev;

            const next = [...prev];
            next[idx] = {
                ...cur,
                jenis: desiredJenis,
                nominal: needNom,
            };
            return next;
        });
    }, [autoBalance, lines]);

    const runSuggest = async () => {
        const r = remark.trim();
        if (!r) return;

        setSuggestLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('remark', r);
            const a = String(headerAkun ?? '').trim();
            if (a) params.set('kodeAkun', a);
            if (headerNominalNumber > 0) params.set('nominal', String(headerNominalNumber));
            if (headerJenis === 'Debit' || headerJenis === 'Kredit') params.set('jenis', headerJenis);
            const res = await fetch(`/keuangan/penyesuaian/suggest?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(String(data?.error ?? 'Gagal suggest.'));

            const suggestedLines = Array.isArray(data?.lines) ? data.lines : [];
            setSuggestMeta({
                confidence: Number(data?.confidence?.overall ?? 0),
                evidence: Array.isArray(data?.evidence) ? data.evidence : [],
            });

            if (!suggestedLines.length) return;

            setLines((prev) => {
                const next = [...prev];
                // Apply suggested akun+jenis only if not touched
                suggestedLines.slice(0, Math.min(4, next.length)).forEach((s, idx) => {
                    const cur = next[idx] ?? { touched: {} };
                    const akunTouched = Boolean(cur?.touched?.akun);
                    const jenisTouched = Boolean(cur?.touched?.jenis);
                    const akun = String(s?.akun ?? '').trim();
                    const jenis = String(s?.jenis ?? '').trim();
                    next[idx] = {
                        ...cur,
                        akun: akunTouched ? cur.akun : akun || cur.akun,
                        jenis: jenisTouched ? cur.jenis : (jenis === 'Kredit' ? 'Kredit' : 'Debit'),
                    };
                });
                return next.slice(0, 4);
            });
        } catch {
            // non-blocking
        } finally {
            setSuggestLoading(false);
        }
    };

    // DSS trigger (debounced)
    useEffect(() => {
        if (!remarkTouched) return () => {};
        const t = window.setTimeout(() => runSuggest(), 550);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remark, headerAkun, headerNominalNumber, headerJenis]);

    const onSave = () => {
        if (saving || !canSave) return;
        setSaving(true);
        router.post(
            '/keuangan/penyesuaian',
            {
                periode,
                posting_date: hasPostingDate ? postingDate : null,
                remark,
                lines: (lines ?? []).slice(0, 4).map((l) => ({
                    akun: String(l?.akun ?? ''),
                    jenis: String(l?.jenis ?? 'Debit'),
                    nominal: Number(l?.nominal ?? 0),
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penyesuaian - Buat Baru" />

            <div className="space-y-4 p-4">
                {bootstrapError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        {bootstrapError}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Header</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Periode mengikuti buku aktif (buka buku terakhir):{' '}
                                <span className="font-mono">{activeBookMonthYm || '-'}</span>
                                . Periode wajib tanggal 1.
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Periode</Label>
                                <Input value={periode} readOnly />
                            </div>

                            {hasPostingDate ? (
                                <div className="space-y-2">
                                    <Label>Posting Date</Label>
                                    <Input
                                        type="date"
                                        value={postingDate}
                                        onChange={(e) => setPostingDate(e.target.value)}
                                    />
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <Label>Kode akun (fokus)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={headerAkunLabel || headerAkun}
                                        readOnly
                                        placeholder="Pilih kode akun..."
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setHeaderDialogOpen(true)}
                                    >
                                        Cari
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    DSS akan memprioritaskan pola penyesuaian yang sering memakai akun ini.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Jumlah</Label>
                                <Input
                                    inputMode="numeric"
                                    value={headerNominal}
                                    onChange={(e) => setHeaderNominal(e.target.value)}
                                    placeholder="Contoh: 545938"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Jumlah membantu DSS memberi rekomendasi yang lebih relevan dan membantu auto-balance.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Jenis (fokus)</Label>
                                <Select
                                    value={headerJenis}
                                    onValueChange={(v) => setHeaderJenis(v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="(opsional) Debit / Kredit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Debit">Debit</SelectItem>
                                        <SelectItem value="Kredit">Kredit</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Jika diisi, DSS akan menyesuaikan rekomendasi akun lawan agar seimbang dengan jenis yang dipilih.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>Remark</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={suggestLoading || !remark.trim()}
                                        onClick={runSuggest}
                                    >
                                        {suggestLoading ? 'Menganalisis...' : 'Refresh DSS'}
                                    </Button>
                                </div>
                                <Textarea
                                    value={remark}
                                    onChange={(e) => {
                                        setRemark(e.target.value);
                                        setRemarkTouched(true);
                                    }}
                                    placeholder="Contoh: HUTANG PPH 21 PER BULAN ... / PENYUSUTAN ... / dll"
                                    className="min-h-[120px]"
                                />
                                <div className="text-xs text-muted-foreground">
                                    DSS aktif berdasarkan kemiripan Remark dari riwayat{' '}
                                    <span className="font-mono">tb_jurnalpenyesuaian</span>.
                                </div>
                                {suggestMeta?.confidence > 0 ? (
                                    <div className="rounded-md border bg-muted/20 p-3 text-xs">
                                        Confidence: {Math.round((suggestMeta.confidence ?? 0) * 100)}%
                                        {Array.isArray(suggestMeta.evidence) && suggestMeta.evidence.length ? (
                                            <div className="mt-2 space-y-1">
                                                <div className="font-medium">Evidence (top 3)</div>
                                                {suggestMeta.evidence.slice(0, 3).map((ev, idx) => (
                                                    <div key={idx} className="text-muted-foreground">
                                                        <span className="font-mono">{String(ev?.Kode_Jurnal ?? '')}</span>{' '}
                                                        ({String(ev?.Periode ?? '')}) — {String(ev?.Remark ?? '').slice(0, 80)}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-3">
                        <CardHeader className="space-y-1">
                            <CardTitle>Baris Akun (maks 4)</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Minimal 2 baris. Total Debit harus sama dengan Total Kredit.
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-muted-foreground">
                                    Auto-balance baris terakhir
                                </div>
                                <Button
                                    type="button"
                                    variant={autoBalance ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAutoBalance((v) => !v)}
                                >
                                    {autoBalance ? 'Aktif' : 'Nonaktif'}
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {(lines ?? []).map((l, idx) => (
                                    <div key={idx} className="rounded-xl border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-sm font-medium">
                                                Baris {idx + 1}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {lines.length > 2 ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setLines((prev) => prev.filter((_, i) => i !== idx));
                                                        }}
                                                    >
                                                        Hapus
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <Label>Akun</Label>
                                                <div className="mt-2 flex gap-2">
                                                    <div className="flex-1 rounded-md border px-3 py-2 text-sm break-words whitespace-normal">
                                                        {l?.akun ? (
                                                            getLineAkunLabel(l.akun)
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                Pilih akun...
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setActiveLineIndex(idx);
                                                            setDialogOpen(true);
                                                        }}
                                                    >
                                                        Cari
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <div className="md:col-span-1">
                                                    <Label>Jenis</Label>
                                                    <div className="mt-2">
                                                        <Select
                                                            value={String(l?.jenis ?? 'Debit')}
                                                            onValueChange={(v) => {
                                                                setLines((prev) => {
                                                                    const next = [...prev];
                                                                    const cur = next[idx] ?? {};
                                                                    next[idx] = {
                                                                        ...cur,
                                                                        jenis: v,
                                                                        touched: {
                                                                            ...(cur.touched ?? {}),
                                                                            jenis: true,
                                                                            jenisSource: 'user',
                                                                        },
                                                                    };
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Jenis" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Debit">Debit</SelectItem>
                                                                <SelectItem value="Kredit">Kredit</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Label>Nominal</Label>
                                                    <div className="mt-2">
                                                        <Input
                                                            inputMode="numeric"
                                                            value={
                                                                l?.nominal === 0
                                                                    ? ''
                                                                    : String(l?.nominal ?? '')
                                                            }
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                const num =
                                                                    raw === ''
                                                                        ? 0
                                                                        : Number(raw);
                                                                setLines((prev) => {
                                                                    const next = [...prev];
                                                                    const cur = next[idx] ?? {};
                                                                    next[idx] = {
                                                                        ...cur,
                                                                        nominal: Number.isFinite(num)
                                                                            ? num
                                                                            : 0,
                                                                        touched: {
                                                                            ...(cur.touched ?? {}),
                                                                            nominal: true,
                                                                        },
                                                                    };
                                                                    return next;
                                                                });
                                                            }}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={lines.length >= 4}
                                    onClick={() =>
                                        setLines((prev) => [
                                            ...prev,
                                            {
                                                akun: '',
                                                jenis: 'Debit',
                                                nominal: 0,
                                                touched: {},
                                            },
                                        ])
                                    }
                                >
                                    Tambah baris
                                </Button>
                            </div>

                            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>Total Debit</span>
                                    <span className="font-medium">
                                        {formatRupiah(totals.debit)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Total Kredit</span>
                                    <span className="font-medium">
                                        {formatRupiah(totals.kredit)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Selisih</span>
                                    <span
                                        className={`font-medium ${totals.diff === 0 ? 'text-emerald-500' : 'text-destructive'}`}
                                    >
                                        {formatRupiah(totals.diff)}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    disabled={!canSave || saving}
                                    onClick={onSave}
                                >
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.visit('/keuangan/penyesuaian')}
                                >
                                    Kembali
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AccountSearchDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                options={glAccountOptions}
                value={
                    activeLineIndex !== null
                        ? String(lines?.[activeLineIndex]?.akun ?? '')
                        : ''
                }
                onSelect={(v) => {
                    if (activeLineIndex === null) return;
                    setLines((prev) => {
                        const next = [...prev];
                        const cur = next[activeLineIndex] ?? {};
                        next[activeLineIndex] = {
                            ...cur,
                            akun: v,
                            touched: { ...(cur.touched ?? {}), akun: true },
                        };
                        return next;
                    });
                }}
            />

            <AccountSearchDialog
                open={headerDialogOpen}
                onOpenChange={setHeaderDialogOpen}
                options={glAccountOptions}
                value={headerAkun}
                onSelect={(v) => {
                    setHeaderAkun(v);
                }}
            />
        </AppLayout>
    );
}
