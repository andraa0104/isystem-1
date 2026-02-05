import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

function SectionTitle({ title, subtitle }) {
    return (
        <tr>
            <td colSpan={3} className="border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {title}
                    </div>
                    {subtitle ? (
                        <div className="text-xs text-slate-500">{subtitle}</div>
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

function TotalRow({ label, value }) {
    return (
        <tr>
            <td colSpan={2} className="border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">
                {label}
            </td>
            <td className="border border-slate-200 bg-white px-3 py-2 text-right font-semibold text-slate-900">
                {value}
            </td>
        </tr>
    );
}

export default function RugiLabaPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_pendapatan: 0,
        total_hpp: 0,
        laba_kotor: 0,
        total_beban_operasional: 0,
        laba_usaha: 0,
        total_lain_lain_net: 0,
        laba_bersih: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const openedAt = useMemo(() => new Date(), []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('periodType', initialQuery?.periodType ?? 'month');
                params.set('period', initialQuery?.period ?? '');
                params.set('search', initialQuery?.search ?? '');
                params.set('sortBy', initialQuery?.sortBy ?? 'Kode_Akun');
                params.set('sortDir', initialQuery?.sortDir ?? 'asc');
                params.set('page', '1');
                params.set('pageSize', 'all');

                const res = await fetch(`/laporan/rugi-laba/rows?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) {
                    const msg = String(data?.error ?? 'Gagal memuat data.');
                    setError(msg);
                    throw new Error(msg);
                }

                setRows(Array.isArray(data?.rows) ? data.rows : []);
                setTotal(Number(data?.total ?? 0));
                setSummary({
                    total_pendapatan: Number(data?.summary?.total_pendapatan ?? 0),
                    total_hpp: Number(data?.summary?.total_hpp ?? 0),
                    laba_kotor: Number(data?.summary?.laba_kotor ?? 0),
                    total_beban_operasional: Number(data?.summary?.total_beban_operasional ?? 0),
                    laba_usaha: Number(data?.summary?.laba_usaha ?? 0),
                    total_lain_lain_net: Number(data?.summary?.total_lain_lain_net ?? 0),
                    laba_bersih: Number(data?.summary?.laba_bersih ?? 0),
                });
            } catch (err) {
                setRows([]);
                setTotal(0);
                setSummary({
                    total_pendapatan: 0,
                    total_hpp: 0,
                    laba_kotor: 0,
                    total_beban_operasional: 0,
                    laba_usaha: 0,
                    total_lain_lain_net: 0,
                    laba_bersih: 0,
                });
                setError(String(err?.message ?? 'Gagal memuat data.'));
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sections = useMemo(() => {
        const pendapatan = rows.filter((r) => r?.group === 'pendapatan');
        const hpp = rows.filter((r) => r?.group === 'hpp');
        const bebanOps = rows.filter((r) => r?.group === 'beban_operasional');
        const pendapatanLain = rows.filter((r) => r?.subgroup === 'pendapatan_lain');
        const bebanLain = rows.filter((r) => r?.subgroup === 'beban_lain');
        return { pendapatan, hpp, bebanOps, pendapatanLain, bebanLain };
    }, [rows]);

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <Head title="Rugi Laba - Print" />
            <style>{`
                @page { size: A4 portrait; margin: 12mm; }
                @media print {
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>

            <div className="mx-auto max-w-[1100px] px-4 py-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Rugi Laba</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Income statement (periodik)
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                            Periode: {getPeriodLabel(initialQuery?.periodType ?? 'month', initialQuery?.period ?? '')}
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dibuka: {openedAt.toLocaleDateString('id-ID')}{' '}
                            {openedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: mode="{initialQuery?.periodType ?? 'month'}", period="{initialQuery?.period ?? ''}",
                            search="{initialQuery?.search ?? ''}", sort=
                            {(initialQuery?.sortBy ?? 'Kode_Akun') + ' ' + (initialQuery?.sortDir ?? 'asc')}
                        </div>
                        <div className="mt-1">Total akun RL: {new Intl.NumberFormat('id-ID').format(total)}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Pendapatan</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_pendapatan)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Laba Kotor</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.laba_kotor)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Laba Usaha</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.laba_usaha)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Laba Bersih</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.laba_bersih)}</div>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="border border-slate-200 px-3 py-2 text-left">Waterfall</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Nilai</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { label: 'Pendapatan', sign: '+', value: summary.total_pendapatan },
                                { label: 'HPP', sign: '-', value: summary.total_hpp },
                                { label: 'Laba Kotor', sign: '=', value: summary.laba_kotor },
                                { label: 'Beban Operasional', sign: '-', value: summary.total_beban_operasional },
                                { label: 'Laba Usaha', sign: '=', value: summary.laba_usaha },
                                { label: 'Lain-lain Bersih', sign: summary.total_lain_lain_net >= 0 ? '+' : '-', value: summary.total_lain_lain_net },
                                { label: 'Laba Bersih', sign: '=', value: summary.laba_bersih },
                            ].map((s, idx) => (
                                <tr key={idx}>
                                    <td className="border border-slate-200 bg-white px-3 py-2">
                                        <span className="mr-2 inline-flex w-5 justify-center text-slate-400">{s.sign}</span>
                                        <span className={s.sign === '=' ? 'font-semibold text-slate-900' : 'text-slate-700'}>{s.label}</span>
                                    </td>
                                    <td className="border border-slate-200 bg-white px-3 py-2 text-right font-semibold text-slate-900">
                                        {formatRupiah(s.value)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="relative mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                            </div>
                        </div>
                    )}
                    {error && !loading ? (
                        <div className="border-b border-slate-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                            <div className="font-semibold">Gagal memuat data</div>
                            <div className="mt-1">{error}</div>
                        </div>
                    ) : null}

                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="border border-slate-200 px-3 py-2 text-left">Kode Akun</th>
                                <th className="border border-slate-200 px-3 py-2 text-left">Nama Akun</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
                            <SectionTitle title="Pendapatan" subtitle="Prefix 4" />
                            {sections.pendapatan.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`p-${kodeAkun}-${idx}`}>
                                        <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                            {has00 ? (
                                                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                            ) : null}
                                            <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                {kodeAkun}
                                            </span>
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>
                                            {r?.Nama_Akun}
                                            {r?.is_anomaly ? (
                                                <span className="ml-2 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200">
                                                    anomali
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Pendapatan" value={formatRupiah(summary.total_pendapatan)} />

                            <SectionTitle title="Harga Pokok Penjualan (HPP)" subtitle="Prefix 5" />
                            {sections.hpp.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`h-${kodeAkun}-${idx}`}>
                                        <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                            {has00 ? (
                                                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                            ) : null}
                                            <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                {kodeAkun}
                                            </span>
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total HPP" value={formatRupiah(summary.total_hpp)} />
                            <TotalRow label="Laba Kotor" value={formatRupiah(summary.laba_kotor)} />

                            <SectionTitle title="Beban Operasional" subtitle="Prefix 6" />
                            {sections.bebanOps.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`o-${kodeAkun}-${idx}`}>
                                        <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                            {has00 ? (
                                                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                            ) : null}
                                            <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                {kodeAkun}
                                            </span>
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Beban Operasional" value={formatRupiah(summary.total_beban_operasional)} />
                            <TotalRow label="Laba Usaha" value={formatRupiah(summary.laba_usaha)} />

                            {(sections.pendapatanLain.length > 0 || sections.bebanLain.length > 0) ? (
                                <>
                                    <SectionTitle title="Pendapatan Lain-lain" subtitle="Prefix 7 / lainnya (net positif)" />
                                    {sections.pendapatanLain.map((r, idx) => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        return (
                                            <tr key={`li-${kodeAkun}-${idx}`}>
                                                <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                                    {has00 ? (
                                                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                                    ) : null}
                                                    <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                        {kodeAkun}
                                                    </span>
                                                </td>
                                                <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                            </tr>
                                        );
                                    })}

                                    <SectionTitle title="Beban Lain-lain" subtitle="Prefix 7 / lainnya (net negatif)" />
                                    {sections.bebanLain.map((r, idx) => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        return (
                                            <tr key={`lo-${kodeAkun}-${idx}`}>
                                                <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                                    {has00 ? (
                                                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                                    ) : null}
                                                    <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                        {kodeAkun}
                                                    </span>
                                                </td>
                                                <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                            </tr>
                                        );
                                    })}
                                    <TotalRow label="Net Lain-lain" value={formatRupiah(summary.total_lain_lain_net)} />
                                </>
                            ) : null}

                            <TotalRow label="Laba (Rugi) Bersih" value={formatRupiah(summary.laba_bersih)} />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
