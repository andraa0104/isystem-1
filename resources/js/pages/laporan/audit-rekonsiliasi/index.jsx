import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Loader2,
    RefreshCcw,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { buildBukuBesarUrl } from '@/lib/report-links';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Audit & Rekonsiliasi', href: '/laporan/audit-rekonsiliasi' },
];

const formatRupiah = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const formatNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
};

const getPeriodLabel = (periodType, period) => {
    if (periodType === 'year') {
        if (!period || !/^\d{4}$/.test(period)) return period || '';
        return `FY ${period} (Jan–Des)`;
    }

    if (!period || !/^\d{6}$/.test(period)) return period || '';
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(4, 6));
    const d = new Date(y, Math.max(0, m - 1), 1);
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
};

function StatCard({ label, value, hint, accent = 'default', icon: Icon }) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-700 dark:text-emerald-400'
            : accent === 'negative'
              ? 'text-rose-700 dark:text-rose-400'
              : accent === 'warning'
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-foreground';

    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                    </div>
                    <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
                    {hint ? (
                        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
                    ) : null}
                </div>
                {Icon ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function buildAiStatus({ kpis }) {
    const trxUnb = Number(kpis?.trx?.unbalanced ?? 0);
    const ajpUnb = Number(kpis?.ajp?.unbalanced ?? 0);
    const neracaBalanced = Boolean(kpis?.neraca?.is_balanced);
    const modalMatch = Boolean(kpis?.modal?.is_match);

    const neracaTolerance = Number(kpis?.neraca?.tolerance ?? 0);
    const neracaDiff = Number(kpis?.neraca?.selisih ?? 0);
    const modalTolerance = Number(kpis?.modal?.tolerance ?? 0);
    const modalDiff = Number(kpis?.modal?.diff ?? 0);

    const hasCriticalMismatch =
        (neracaTolerance > 0 && Math.abs(neracaDiff) > 10 * neracaTolerance) ||
        (modalTolerance > 0 && Math.abs(modalDiff) > 10 * modalTolerance);

    if (trxUnb === 0 && ajpUnb === 0 && neracaBalanced && modalMatch) return 'healthy';
    if (hasCriticalMismatch) return 'critical';
    return 'check';
}

function buildAiInsights({ kpis, meta }) {
    const insights = [];

    const trxUnb = Number(kpis?.trx?.unbalanced ?? 0);
    const ajpUnb = Number(kpis?.ajp?.unbalanced ?? 0);

    const neracaBalanced = Boolean(kpis?.neraca?.is_balanced);
    const neracaDiff = Number(kpis?.neraca?.selisih ?? 0);
    const neracaTol = Number(kpis?.neraca?.tolerance ?? 0);

    const modalMatch = Boolean(kpis?.modal?.is_match);
    const modalDiff = Number(kpis?.modal?.diff ?? 0);
    const modalTol = Number(kpis?.modal?.tolerance ?? 0);

    if (trxUnb > 0) {
        insights.push(`Ada ${formatNumber(trxUnb)} jurnal TRX tidak seimbang. Prioritaskan perbaikan sebelum closing/snapshot.`);
    } else {
        insights.push('Tidak ada jurnal TRX tidak seimbang pada periode ini.');
    }

    if (ajpUnb > 0) {
        insights.push(`Ada ${formatNumber(ajpUnb)} dokumen AJP tidak seimbang. Cek penyesuaian periode & akun terkait.`);
    } else {
        insights.push('Tidak ada dokumen AJP tidak seimbang pada periode ini.');
    }

    if (!neracaBalanced) {
        insights.push(`Neraca mismatch: selisih A-(L+E) = ${formatRupiah(neracaDiff)} (toleransi ${formatRupiah(neracaTol)}). Cek proses posting/closing/snapshot.`);
    } else {
        insights.push('Neraca seimbang dalam batas toleransi.');
    }

    if (!modalMatch) {
        insights.push(`Modal mismatch: diff snapshot vs hitung = ${formatRupiah(modalDiff)} (toleransi ${formatRupiah(modalTol)}). Cek akun ekuitas (prefix 3) & laba ditahan.`);
    } else {
        insights.push('Rekonsiliasi perubahan modal match dalam batas toleransi.');
    }

    if (meta?.periodType === 'year' && meta?.effectivePeriod) {
        insights.push(`Mode FY memakai snapshot akhir tahun: ${meta.effectivePeriodLabel || meta.effectivePeriod}.`);
    }

    return insights;
}

function buildJurnalUmumUrl({ periodType, period, kodeJurnal }) {
    const params = new URLSearchParams();
    params.set('periodType', periodType);
    params.set('period', period);
    params.set('search', kodeJurnal);
    params.set('sortBy', 'Tgl_Jurnal');
    params.set('sortDir', 'desc');
    params.set('pageSize', '10');
    return `/laporan/jurnal-umum?${params.toString()}`;
}

export default function AuditRekonsiliasiIndex() {
    const {
        initialQuery = {},
        periodOptions = [],
        defaultPeriod = '',
        yearOptions = [],
        defaultYear = '',
    } = usePage().props;

    const [periodType, setPeriodType] = useState(initialQuery?.periodType ?? 'month');
    const [period, setPeriod] = useState(initialQuery?.period ?? '');
    const [findingsMode, setFindingsMode] = useState(initialQuery?.findingsMode ?? 'unbalanced');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [meta, setMeta] = useState({
        period_type: periodType,
        period,
        period_label: '',
        effective_period: null,
        effective_period_label: null,
    });

    const [kpis, setKpis] = useState({
        trx: { total: 0, balanced: 0, unbalanced: 0, sum_selisih_abs: 0 },
        ajp: { total: 0, balanced: 0, unbalanced: 0, sum_selisih_abs: 0 },
        neraca: { total_aset: 0, total_liabilitas: 0, total_ekuitas: 0, selisih: 0, tolerance: 0, is_balanced: false },
        modal: { opening_equity: 0, contributions: 0, withdrawals: 0, net_income: 0, computed_ending_equity: 0, snapshot_ending_equity: 0, diff: 0, tolerance: 0, is_match: false },
    });

    const [findings, setFindings] = useState({
        unbalanced_journals: [],
        unbalanced_ajp_docs: [],
        neraca_anomalies: [],
        equity_movements_top: [],
    });

    const findingsRef = useRef(null);

    useEffect(() => {
        if (periodType === 'year') {
            if (period && /^\d{4}$/.test(period)) return;
            setPeriod(defaultYear || yearOptions?.[0] || '');
            return;
        }
        if (period && /^\d{6}$/.test(period)) return;
        setPeriod(defaultPeriod || periodOptions?.[0] || '');
    }, [periodType, period, defaultPeriod, periodOptions, defaultYear, yearOptions]);

    const fetchRows = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('periodType', periodType);
            params.set('period', period);
            params.set('findingsMode', findingsMode);
            const res = await fetch(`/laporan/audit-rekonsiliasi/rows?${params.toString()}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

            setMeta({
                period_type: json?.period_type ?? periodType,
                period: json?.period ?? period,
                period_label: json?.period_label ?? getPeriodLabel(periodType, period),
                effective_period: json?.effective_period ?? null,
                effective_period_label: json?.effective_period_label ?? null,
            });
            setFindingsMode(json?.findings_mode ?? findingsMode);
            setKpis(json?.kpis ?? kpis);
            setFindings(json?.findings ?? findings);
        } catch (e) {
            setError(String(e?.message || e));
            setKpis({
                trx: { total: 0, balanced: 0, unbalanced: 0, sum_selisih_abs: 0 },
                ajp: { total: 0, balanced: 0, unbalanced: 0, sum_selisih_abs: 0 },
                neraca: { total_aset: 0, total_liabilitas: 0, total_ekuitas: 0, selisih: 0, tolerance: 0, is_balanced: false },
                modal: { opening_equity: 0, contributions: 0, withdrawals: 0, net_income: 0, computed_ending_equity: 0, snapshot_ending_equity: 0, diff: 0, tolerance: 0, is_match: false },
            });
            setFindings({
                unbalanced_journals: [],
                unbalanced_ajp_docs: [],
                neraca_anomalies: [],
                equity_movements_top: [],
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodType, period, findingsMode]);

    const aiStatus = useMemo(() => buildAiStatus({ kpis }), [kpis]);
    const aiInsights = useMemo(
        () =>
            buildAiInsights({
                kpis,
                meta: {
                    periodType,
                    effectivePeriod: meta?.effective_period,
                    effectivePeriodLabel: meta?.effective_period_label,
                },
            }),
        [kpis, meta, periodType],
    );

    const aiStatusPillClass =
        aiStatus === 'healthy'
            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : aiStatus === 'critical'
              ? 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';

    const trxFindingsTitle = findingsMode === 'all' ? 'Dokumen TRX (Top 10)' : 'Temuan TRX Tidak Seimbang';
    const trxFindingsSubtitle =
        findingsMode === 'all' ? 'Top 10 terbaru (termasuk seimbang)' : 'Top 10 berdasarkan ABS selisih';
    const ajpFindingsTitle = findingsMode === 'all' ? 'Dokumen AJP (Top 10)' : 'Temuan AJP Tidak Seimbang';
    const ajpFindingsSubtitle =
        findingsMode === 'all' ? 'Top 10 terbaru (termasuk seimbang)' : 'Top 10 berdasarkan ABS selisih';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Audit & Rekonsiliasi" />

            <div className="space-y-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 dark:bg-white/5">
                                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-foreground">Audit &amp; Rekonsiliasi</div>
                                <div className="text-sm text-muted-foreground">
                                    Quality check akuntansi periodik (TRX, AJP, Neraca, Modal).
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                                <span>Periode:</span>
                                <span className="font-medium text-foreground/80">
                                    {meta?.period_label || getPeriodLabel(periodType, period) || '—'}
                                </span>
                                {periodType === 'year' && meta?.effective_period ? (
                                    <span className="text-muted-foreground">
                                        • Snapshot akhir: {meta?.effective_period_label || meta.effective_period}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => fetchRows()}
                            disabled={loading}
                        >
                            <RefreshCcw className="h-4 w-4" /> Refresh
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex items-center gap-2">
                        <Select value={periodType} onValueChange={setPeriodType}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Per Bulan</SelectItem>
                                <SelectItem value="year">Per Tahun</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                {periodType === 'year'
                                    ? yearOptions.map((y) => (
                                          <SelectItem key={y} value={String(y)}>
                                              FY {y} (Jan–Des)
                                          </SelectItem>
                                      ))
                                    : periodOptions.map((p) => (
                                          <SelectItem key={p} value={String(p)}>
                                              {getPeriodLabel('month', String(p))} ({p})
                                          </SelectItem>
                                      ))}
                            </SelectContent>
                        </Select>

                        <Select value={findingsMode} onValueChange={setFindingsMode}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Temuan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unbalanced">Tidak seimbang saja</SelectItem>
                                <SelectItem value="all">Semua dokumen</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                        <div className="font-semibold">Gagal memuat data</div>
                        <div className="mt-1 opacity-90">{error}</div>
                        <div className="mt-2 text-xs text-rose-700 dark:text-rose-300/80">
                            Pastikan tabel tersedia: `tb_jurnal`, `tb_jurnaldetail`, `tb_jurnalpenyesuaian`, `tb_nabbrekap`.
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="TRX Unbalanced"
                        value={formatNumber(kpis?.trx?.unbalanced)}
                        hint={`Total: ${formatNumber(kpis?.trx?.total)} • Selisih ABS: ${formatRupiah(kpis?.trx?.sum_selisih_abs)}`}
                        accent={Number(kpis?.trx?.unbalanced ?? 0) > 0 ? 'negative' : 'positive'}
                        icon={Number(kpis?.trx?.unbalanced ?? 0) > 0 ? TrendingDown : TrendingUp}
                    />
                    <StatCard
                        label="AJP Unbalanced"
                        value={formatNumber(kpis?.ajp?.unbalanced)}
                        hint={`Total: ${formatNumber(kpis?.ajp?.total)} • Selisih ABS: ${formatRupiah(kpis?.ajp?.sum_selisih_abs)}`}
                        accent={Number(kpis?.ajp?.unbalanced ?? 0) > 0 ? 'negative' : 'positive'}
                        icon={Number(kpis?.ajp?.unbalanced ?? 0) > 0 ? TrendingDown : TrendingUp}
                    />
                    <StatCard
                        label="Selisih Neraca (A-(L+E))"
                        value={formatRupiah(kpis?.neraca?.selisih)}
                        hint={`Toleransi: ${formatRupiah(kpis?.neraca?.tolerance)} • Aset: ${formatRupiah(kpis?.neraca?.total_aset)}`}
                        accent={kpis?.neraca?.is_balanced ? 'positive' : 'negative'}
                        icon={kpis?.neraca?.is_balanced ? CheckCircle2 : AlertTriangle}
                    />
                    <StatCard
                        label="Diff Modal (Snapshot-Hitung)"
                        value={formatRupiah(kpis?.modal?.diff)}
                        hint={`Toleransi: ${formatRupiah(kpis?.modal?.tolerance)} • Net Income: ${formatRupiah(kpis?.modal?.net_income)}`}
                        accent={kpis?.modal?.is_match ? 'positive' : 'negative'}
                        icon={kpis?.modal?.is_match ? CheckCircle2 : AlertTriangle}
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 dark:bg-white/5">
                                <Sparkles className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="font-semibold text-foreground">AI Summary KPI</div>
                                <div className="text-xs text-muted-foreground">
                                    Ringkasan otomatis (rule-based) untuk prioritas investigasi.
                                </div>
                            </div>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${aiStatusPillClass}`}>
                            {aiStatus === 'healthy' ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4" /> Healthy
                                </>
                            ) : aiStatus === 'critical' ? (
                                <>
                                    <AlertTriangle className="h-4 w-4" /> Critical
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="h-4 w-4" /> Check
                                </>
                            )}
                        </div>
                    </div>

                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {aiInsights.map((t, i) => (
                            <li key={i}>{t}</li>
                        ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => findingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                            Lihat Temuan
                        </Button>
                    </div>
                </div>

                <div ref={findingsRef} className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card">
                        <div className="border-b border-border px-4 py-3">
                            <div className="text-sm font-semibold text-foreground">{trxFindingsTitle}</div>
                            <div className="text-xs text-muted-foreground">{trxFindingsSubtitle}</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-white/5">
                                    <tr>
                                        <th className="px-3 py-3 text-left">Tanggal</th>
                                        <th className="px-3 py-3 text-left">Kode Jurnal</th>
                                        <th className="px-3 py-3 text-left">Voucher</th>
                                        <th className="px-3 py-3 text-left">Remark</th>
                                        <th className="px-3 py-3 text-right">Debit</th>
                                        <th className="px-3 py-3 text-right">Kredit</th>
                                        <th className="px-3 py-3 text-right">Selisih</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                            </td>
                                        </tr>
                                    ) : findings?.unbalanced_journals?.length ? (
                                        findings.unbalanced_journals.map((r, idx) => (
                                            <tr key={`${r?.kode_jurnal ?? idx}-${idx}`} className="border-t border-border/50">
                                                {(() => {
                                                    const selisih = Number(r?.selisih ?? 0);
                                                    const selisihClass =
                                                        selisih === 0
                                                            ? 'text-muted-foreground'
                                                            : 'text-rose-700 dark:text-rose-300';
                                                    return (
                                                        <>
                                                <td className="px-3 py-2">{r?.date}</td>
                                                <td className="px-3 py-2 font-medium">
                                                    <Link
                                                        href={buildJurnalUmumUrl({
                                                            periodType,
                                                            period,
                                                            kodeJurnal: r?.kode_jurnal ?? '',
                                                        })}
                                                        className="text-amber-700 hover:underline dark:text-amber-300"
                                                    >
                                                        {r?.kode_jurnal}
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-2">{r?.kode_voucher}</td>
                                                <td className="px-3 py-2">
                                                    <div className="max-w-[520px] truncate text-foreground/80">{r?.remark}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.total_debit)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.total_kredit)}</td>
                                                <td className={`px-3 py-2 text-right font-medium ${selisihClass}`}>{formatRupiah(r?.selisih)}</td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card">
                        <div className="border-b border-border px-4 py-3">
                            <div className="text-sm font-semibold text-foreground">{ajpFindingsTitle}</div>
                            <div className="text-xs text-muted-foreground">{ajpFindingsSubtitle}</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-white/5">
                                    <tr>
                                        <th className="px-3 py-3 text-left">Periode</th>
                                        <th className="px-3 py-3 text-left">Kode Jurnal</th>
                                        <th className="px-3 py-3 text-left">Posting</th>
                                        <th className="px-3 py-3 text-left">Remark</th>
                                        <th className="px-3 py-3 text-right">Debit</th>
                                        <th className="px-3 py-3 text-right">Kredit</th>
                                        <th className="px-3 py-3 text-right">Selisih</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                            </td>
                                        </tr>
                                    ) : findings?.unbalanced_ajp_docs?.length ? (
                                        findings.unbalanced_ajp_docs.map((r, idx) => (
                                            <tr key={`${r?.kode_jurnal ?? idx}-${idx}`} className="border-t border-border/50">
                                                {(() => {
                                                    const selisih = Number(r?.selisih ?? 0);
                                                    const selisihClass =
                                                        selisih === 0
                                                            ? 'text-muted-foreground'
                                                            : 'text-rose-700 dark:text-rose-300';
                                                    return (
                                                        <>
                                                <td className="px-3 py-2">{r?.periode}</td>
                                                <td className="px-3 py-2 font-medium">{r?.kode_jurnal}</td>
                                                <td className="px-3 py-2">{r?.posting_date}</td>
                                                <td className="px-3 py-2">
                                                    <div className="max-w-[520px] truncate text-foreground/80">{r?.remark}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.total_debit)}</td>
                                                <td className="px-3 py-2 text-right">{formatRupiah(r?.total_kredit)}</td>
                                                <td className={`px-3 py-2 text-right font-medium ${selisihClass}`}>{formatRupiah(r?.selisih)}</td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-card">
                            <div className="border-b border-border px-4 py-3">
                                <div className="text-sm font-semibold text-foreground">Anomali Neraca (saldo berlawanan)</div>
                                <div className="text-xs text-muted-foreground">Top 10 berdasarkan ABS saldo</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-white/5">
                                        <tr>
                                            <th className="px-3 py-3 text-left">Kode Akun</th>
                                            <th className="px-3 py-3 text-left">Nama Akun</th>
                                            <th className="px-3 py-3 text-right">Saldo Raw</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {findings?.neraca_anomalies?.length ? (
                                            findings.neraca_anomalies.map((r, idx) => (
                                                <tr key={`${r?.kode_akun ?? idx}-${idx}`} className="border-t border-border/50">
                                                    <td className="px-3 py-2 font-medium">
                                                        <Link
                                                            href={buildBukuBesarUrl({
                                                                periodType,
                                                                period,
                                                                kodeAkun: r?.kode_akun ?? '',
                                                            })}
                                                            className="text-amber-700 hover:underline dark:text-amber-300"
                                                        >
                                                            {r?.kode_akun}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-2 text-foreground/80">{r?.nama_akun}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-amber-700 dark:text-amber-300">
                                                        {formatRupiah(r?.saldo_raw)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">
                                                    Tidak ada anomali.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-card">
                            <div className="border-b border-border px-4 py-3">
                                <div className="text-sm font-semibold text-foreground">Top Pergerakan Ekuitas</div>
                                <div className="text-xs text-muted-foreground">Top 10 berdasarkan ABS net</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-white/5">
                                        <tr>
                                            <th className="px-3 py-3 text-left">Kode Akun</th>
                                            <th className="px-3 py-3 text-left">Nama Akun</th>
                                            <th className="px-3 py-3 text-right">Debit</th>
                                            <th className="px-3 py-3 text-right">Kredit</th>
                                            <th className="px-3 py-3 text-right">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {findings?.equity_movements_top?.length ? (
                                            findings.equity_movements_top.map((r, idx) => (
                                                <tr key={`${r?.kode_akun ?? idx}-${idx}`} className="border-t border-border/50">
                                                    <td className="px-3 py-2 font-medium">
                                                        <Link
                                                            href={buildBukuBesarUrl({
                                                                periodType,
                                                                period,
                                                                kodeAkun: r?.kode_akun ?? '',
                                                            })}
                                                            className="text-amber-700 hover:underline dark:text-amber-300"
                                                        >
                                                            {r?.kode_akun}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-2 text-foreground/80">{r?.nama_akun}</td>
                                                    <td className="px-3 py-2 text-right">{formatRupiah(r?.debit)}</td>
                                                    <td className="px-3 py-2 text-right">{formatRupiah(r?.kredit)}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-foreground">
                                                        {formatRupiah(r?.net)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                                                    Tidak ada data.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
