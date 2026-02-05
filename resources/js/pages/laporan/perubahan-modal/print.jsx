import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
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

const markedCellClass = 'bg-amber-50';

export default function PerubahanModalPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({
        opening_equity: 0,
        contributions: 0,
        withdrawals: 0,
        net_income: 0,
        computed_ending_equity: 0,
        snapshot_ending_equity: 0,
        diff: 0,
    });
    const [periodMeta, setPeriodMeta] = useState({
        period_type: initialQuery?.periodType ?? 'month',
        period: initialQuery?.period ?? '',
        period_label: '',
        effective_period: null,
        effective_period_label: null,
    });
    const [error, setError] = useState('');

    const query = useMemo(
        () => ({
            periodType: initialQuery?.periodType ?? 'month',
            period: initialQuery?.period ?? '',
            search: initialQuery?.search ?? '',
            sortBy: initialQuery?.sortBy ?? 'Net',
            sortDir: initialQuery?.sortDir ?? 'desc',
        }),
        [initialQuery],
    );

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('periodType', query.periodType);
                params.set('period', query.period);
                params.set('search', query.search);
                params.set('sortBy', query.sortBy);
                params.set('sortDir', query.sortDir);
                params.set('pageSize', 'all');
                params.set('page', '1');

                const res = await fetch(`/laporan/perubahan-modal/rows?${params.toString()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal,
                    credentials: 'include',
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

                setRows(Array.isArray(json?.rows) ? json.rows : []);
                setSummary(json?.summary ?? {});
                setPeriodMeta({
                    period_type: json?.period_type ?? query.periodType,
                    period: json?.period ?? query.period,
                    period_label:
                        json?.period_label ??
                        getPeriodLabel(query.periodType, query.period),
                    effective_period: json?.effective_period ?? null,
                    effective_period_label: json?.effective_period_label ?? null,
                });
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setRows([]);
                setSummary({
                    opening_equity: 0,
                    contributions: 0,
                    withdrawals: 0,
                    net_income: 0,
                    computed_ending_equity: 0,
                    snapshot_ending_equity: 0,
                    diff: 0,
                });
                setError(String(e?.message || e));
            }
        })();

        return () => controller.abort();
    }, [query]);

    const computedEnding = Number(summary?.computed_ending_equity ?? 0);
    const snapshotEnding = Number(summary?.snapshot_ending_equity ?? 0);
    const diff = Number(summary?.diff ?? 0);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title="Print - Perubahan Modal" />

            <div className="mx-auto max-w-5xl p-6 print:p-0">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
                    <div>
                        <div className="text-lg font-semibold">Laporan Perubahan Modal</div>
                        <div className="mt-1 text-sm text-black/60">
                            Periode: <span className="font-medium text-black/80">{periodMeta.period_label || '—'}</span>
                            {periodMeta.period_type === 'year' && periodMeta.effective_period ? (
                                <span className="text-black/50">
                                    {' '}
                                    • Snapshot akhir: {periodMeta.effective_period_label || periodMeta.effective_period}
                                </span>
                            ) : null}
                        </div>
                        <div className="mt-1 text-xs text-black/50">
                            Sumber: `tb_nabbrekap` (snapshot) + `tb_jurnal`/`tb_jurnaldetail` + `tb_jurnalpenyesuaian`
                        </div>
                    </div>
                    <div className="text-right text-xs text-black/50">
                        Dicetak: {new Date().toLocaleString('id-ID')}
                        {query.search ? (
                            <div className="mt-1">
                                Filter: <span className="text-black/70">{query.search}</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                            Ringkasan
                        </div>
                        <table className="mt-3 w-full text-sm">
                            <tbody>
                                <tr>
                                    <td className="py-1 text-black/60">Modal awal</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(summary?.opening_equity)}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-black/60">Tambahan modal</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(summary?.contributions)}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-black/60">Laba bersih</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(summary?.net_income)}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-black/60">Prive</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(summary?.withdrawals)}</td>
                                </tr>
                                <tr className="border-t border-black/10">
                                    <td className="py-2 font-semibold">Modal akhir (hitung)</td>
                                    <td className="py-2 text-right font-semibold">{formatRupiah(computedEnding)}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-black/60">Modal akhir (snapshot)</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(snapshotEnding)}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-black/60">Selisih</td>
                                    <td className="py-1 text-right font-medium">{formatRupiah(diff)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                            Catatan
                        </div>
                        <div className="mt-3 text-sm text-black/70">
                            Tambahan modal &amp; prive dihitung dari transaksi akun ekuitas (prefix <span className="font-mono">3</span>) pada jurnal dan penyesuaian periode.
                            Laba bersih dihitung dari akun nominal (prefix <span className="font-mono">4–7</span>).
                        </div>
                    </div>
                </div>

                <div className="mt-6 rounded-lg border border-black/10">
                    <div className="border-b border-black/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black/50">
                        Rincian Pergerakan Akun Ekuitas (Prefix 3)
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-black/5 text-[11px] uppercase tracking-wide text-black/50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Kode Akun</th>
                                    <th className="px-3 py-2 text-left">Nama Akun</th>
                                    <th className="px-3 py-2 text-right">Debit</th>
                                    <th className="px-3 py-2 text-right">Kredit</th>
                                    <th className="px-3 py-2 text-right">Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-black/50">
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r, idx) => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = Boolean(r?.has_00) || kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        const net = Number(r?.net ?? 0);
                                        return (
                                            <tr key={`${kodeAkun}-${idx}`} className="border-t border-black/10">
                                                <td className={`px-3 py-2 font-medium ${cellClass}`}>{kodeAkun}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>
                                                    {formatRupiah(r?.debit)}
                                                </td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>
                                                    {formatRupiah(r?.kredit)}
                                                </td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>
                                                    {formatRupiah(net)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

