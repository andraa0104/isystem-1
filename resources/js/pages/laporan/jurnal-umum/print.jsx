import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
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

export default function JurnalUmumPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_jurnal: 0,
        sum_debit: 0,
        sum_kredit: 0,
        balanced_count: 0,
        unbalanced_count: 0,
        sum_selisih_abs: 0,
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
                params.set('balance', initialQuery?.balance ?? 'all');
                params.set('search', initialQuery?.search ?? '');
                params.set('sortBy', initialQuery?.sortBy ?? 'Tgl_Jurnal');
                params.set('sortDir', initialQuery?.sortDir ?? 'desc');
                params.set('page', '1');
                params.set('pageSize', 'all');
                params.set('includeDetails', '1');

                const res = await fetch(`/laporan/jurnal-umum/rows?${params.toString()}`, {
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
                    total_jurnal: Number(data?.summary?.total_jurnal ?? 0),
                    sum_debit: Number(data?.summary?.sum_debit ?? 0),
                    sum_kredit: Number(data?.summary?.sum_kredit ?? 0),
                    balanced_count: Number(data?.summary?.balanced_count ?? 0),
                    unbalanced_count: Number(data?.summary?.unbalanced_count ?? 0),
                    sum_selisih_abs: Number(data?.summary?.sum_selisih_abs ?? 0),
                });
            } catch (err) {
                setRows([]);
                setTotal(0);
                setSummary({
                    total_jurnal: 0,
                    sum_debit: 0,
                    sum_kredit: 0,
                    balanced_count: 0,
                    unbalanced_count: 0,
                    sum_selisih_abs: 0,
                });
                setError(String(err?.message ?? 'Gagal memuat data.'));
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <Head title="Jurnal Umum - Print" />
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
                        <h1 className="text-2xl font-semibold">Jurnal Umum</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Periode: {getPeriodLabel(initialQuery?.periodType ?? 'month', initialQuery?.period ?? '')}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                            Sumber: `tb_jurnal` + `tb_jurnaldetail`
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dibuka: {openedAt.toLocaleDateString('id-ID')}{' '}
                            {openedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: mode="{initialQuery?.periodType ?? 'month'}", period="{initialQuery?.period ?? ''}", balance="
                            {initialQuery?.balance ?? 'all'}", search="{initialQuery?.search ?? ''}", sort=
                            {(initialQuery?.sortBy ?? 'Tgl_Jurnal') + ' ' + (initialQuery?.sortDir ?? 'desc')}
                        </div>
                        <div className="mt-1">Total jurnal: {new Intl.NumberFormat('id-ID').format(total)}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Jurnal</div>
                        <div className="mt-1 text-lg font-semibold">{new Intl.NumberFormat('id-ID').format(summary.total_jurnal)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Debit</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.sum_debit)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Kredit</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.sum_kredit)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Selisih ABS</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.sum_selisih_abs)}</div>
                    </div>
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

                    <div className="divide-y divide-slate-200">
                        {rows.map((j, idx) => {
                            const kodeJurnal = String(j?.Kode_Jurnal ?? '');
                            const has00 = Boolean(j?.has_00);
                            const details = Array.isArray(j?.details) ? j.details : [];
                            return (
                                <div key={`${kodeJurnal}-${idx}`} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {formatDate(j?.Tgl_Jurnal)} • {kodeJurnal}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-600">
                                                Voucher: {j?.Kode_Voucher || '-'} • Lines: {new Intl.NumberFormat('id-ID').format(j?.lines ?? 0)}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-600">
                                                Remark: {j?.Remark || '-'}
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-slate-700">
                                            <div>
                                                Debit: <span className="font-semibold">{formatRupiah(j?.total_debit)}</span>
                                            </div>
                                            <div>
                                                Kredit: <span className="font-semibold">{formatRupiah(j?.total_kredit)}</span>
                                            </div>
                                            <div className="mt-1">
                                                Status:{' '}
                                                <span className={`font-semibold ${j?.is_balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {j?.is_balanced ? 'Seimbang' : 'Tidak seimbang'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                                                <tr>
                                                    <th className="border border-slate-200 px-3 py-2 text-left">Kode Akun</th>
                                                    <th className="border border-slate-200 px-3 py-2 text-left">Nama Akun</th>
                                                    <th className="border border-slate-200 px-3 py-2 text-right">Debit</th>
                                                    <th className="border border-slate-200 px-3 py-2 text-right">Kredit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="border border-slate-200 px-3 py-4 text-center text-slate-500">
                                                            Tidak ada detail.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    details.map((d, di) => {
                                                        const kodeAkun = String(d?.Kode_Akun ?? '');
                                                        const has00Detail = kodeAkun.includes('00');
                                                        const c = has00Detail || has00 ? markedCellClass : '';
                                                        return (
                                                            <tr key={`${kodeJurnal}-${kodeAkun}-${di}`}>
                                                                <td className={`border border-slate-200 px-3 py-2 font-medium ${c}`}>
                                                                    {has00Detail ? (
                                                                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                                                    ) : null}
                                                                    <span className={has00Detail ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                                        {kodeAkun}
                                                                    </span>
                                                                </td>
                                                                <td className={`border border-slate-200 px-3 py-2 ${c}`}>{d?.Nama_Akun || '-'}</td>
                                                                <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${c}`}>{formatRupiah(d?.Debit)}</td>
                                                                <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${c}`}>{formatRupiah(d?.Kredit)}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

