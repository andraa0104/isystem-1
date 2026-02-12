import { Head, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value, dashIfNull = false) => {
    if (value === null || value === undefined) return dashIfNull ? '—' : 'Rp 0';
    if (value === '') return dashIfNull ? '—' : 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return dashIfNull ? '—' : 'Rp 0';
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

export default function BukuKasPrint() {
    const { initialQuery = {}, accountOptions = [] } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        opening_balance: null,
        closing_balance: null,
        total_in: 0,
        total_out: 0,
        net_change: 0,
        count_voucher: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const openedAt = useMemo(() => new Date(), []);

    const accountLabel = useMemo(() => {
        const code = String(initialQuery?.account ?? 'all');
        if (code === 'all') return 'Semua akun';
        const hit = accountOptions.find((a) => String(a.value) === code);
        return hit?.label || code;
    }, [accountOptions, initialQuery?.account]);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('periodType', initialQuery?.periodType ?? 'month');
                params.set('period', initialQuery?.period ?? '');
                params.set('account', initialQuery?.account ?? 'all');
                params.set('flow', initialQuery?.flow ?? 'all');
                params.set('search', initialQuery?.search ?? '');
                params.set('sortBy', initialQuery?.sortBy ?? 'Tgl_Voucher');
                params.set('sortDir', initialQuery?.sortDir ?? 'desc');
                params.set('page', '1');
                params.set('pageSize', 'all');

                const res = await fetch(`/laporan/buku-kas/rows?${params.toString()}`, {
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
                    opening_balance:
                        data?.summary?.opening_balance === null
                            ? null
                            : Number(data?.summary?.opening_balance ?? 0),
                    closing_balance:
                        data?.summary?.closing_balance === null
                            ? null
                            : Number(data?.summary?.closing_balance ?? 0),
                    total_in: Number(data?.summary?.total_in ?? 0),
                    total_out: Number(data?.summary?.total_out ?? 0),
                    net_change: Number(data?.summary?.net_change ?? 0),
                    count_voucher: Number(data?.summary?.count_voucher ?? 0),
                });
            } catch (err) {
                setRows([]);
                setTotal(0);
                setSummary({
                    opening_balance: null,
                    closing_balance: null,
                    total_in: 0,
                    total_out: 0,
                    net_change: 0,
                    count_voucher: 0,
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
            <Head title="Buku Kas - Print" />
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
                        <h1 className="text-2xl font-semibold">Buku Kas</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Periode: {getPeriodLabel(initialQuery?.periodType ?? 'month', initialQuery?.period ?? '')}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">Akun: {accountLabel}</div>
                        <div className="mt-1 text-sm text-slate-600">Sumber: `tb_kas`</div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dibuka: {openedAt.toLocaleDateString('id-ID')}{' '}
                            {openedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: mode="{initialQuery?.periodType ?? 'month'}", period="{initialQuery?.period ?? ''}", account="
                            {initialQuery?.account ?? 'all'}", flow="{initialQuery?.flow ?? 'all'}", search="{initialQuery?.search ?? ''}", sort=
                            {(initialQuery?.sortBy ?? 'Tgl_Voucher') + ' ' + (initialQuery?.sortDir ?? 'desc')}
                        </div>
                        <div className="mt-1">Total transaksi: {new Intl.NumberFormat('id-ID').format(total)}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Saldo Awal</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.opening_balance, true)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Masuk</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_in)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Keluar</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_out)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Saldo Akhir</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.closing_balance, true)}</div>
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

                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="border border-slate-200 px-3 py-2 text-left">Tgl Voucher</th>
                                <th className="border border-slate-200 px-3 py-2 text-left">Kode Voucher</th>
                                <th className="border border-slate-200 px-3 py-2 text-left">Keterangan</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Mutasi</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={5} className="border border-slate-200 px-3 py-6 text-center text-slate-500">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            ) : null}

                            {rows.map((r, idx) => {
                                const kodeVoucher = String(r?.Kode_Voucher ?? '');
                                const breakdowns = Array.isArray(r?.breakdowns) ? r.breakdowns : [];
                                const mutasi = Number(r?.Mutasi_Kas ?? 0);
                                const direction = String(r?.direction ?? 'neutral');
                                const mutasiClass = direction === 'in' ? 'text-emerald-700' : direction === 'out' ? 'text-rose-700' : 'text-slate-900';
                                const has00 = kodeVoucher.includes('00') || String(r?.Kode_Akun ?? '').includes('00');

                                return (
                                    <Fragment key={`${kodeVoucher}-${idx}`}>
                                        <tr>
                                            <td className={`border border-slate-200 px-3 py-2 ${has00 ? markedCellClass : ''}`}>{formatDate(r?.Tgl_Voucher)}</td>
                                            <td className={`border border-slate-200 px-3 py-2 font-medium ${has00 ? markedCellClass : ''}`}>{kodeVoucher}</td>
                                            <td className={`border border-slate-200 px-3 py-2 ${has00 ? markedCellClass : ''}`}>{r?.Keterangan || '-'}</td>
                                            <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${mutasiClass} ${has00 ? markedCellClass : ''}`}>{formatRupiah(mutasi)}</td>
                                            <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${has00 ? markedCellClass : ''}`}>{formatRupiah(r?.Saldo)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="border border-slate-200 bg-white px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-wide text-slate-500">Rincian</div>
                                                {breakdowns.length === 0 ? (
                                                    <div className="mt-1 text-sm text-slate-500">Tidak ada rincian beban.</div>
                                                ) : (
                                                    <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                                                        <table className="min-w-full text-sm">
                                                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                                                                <tr>
                                                                    <th className="border border-slate-200 px-3 py-2 text-left">Kode Akun</th>
                                                                    <th className="border border-slate-200 px-3 py-2 text-left">Nama Akun</th>
                                                                    <th className="border border-slate-200 px-3 py-2 text-left">Jenis Beban</th>
                                                                    <th className="border border-slate-200 px-3 py-2 text-right">Nominal</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {breakdowns.map((b, bi) => {
                                                                    const kodeAkun = String(b?.kode_akun ?? '');
                                                                    const has00Detail = kodeAkun.includes('00');
                                                                    const c = has00Detail ? markedCellClass : '';
                                                                    return (
                                                                        <tr key={`${kodeVoucher}-${kodeAkun}-${bi}`}>
                                                                            <td className={`border border-slate-200 px-3 py-2 font-medium ${c}`}>{kodeAkun || '-'}</td>
                                                                            <td className={`border border-slate-200 px-3 py-2 ${c}`}>{b?.nama_akun || '-'}</td>
                                                                            <td className={`border border-slate-200 px-3 py-2 ${c}`}>{b?.jenis_beban || '-'}</td>
                                                                            <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${c}`}>{formatRupiah(b?.nominal)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
