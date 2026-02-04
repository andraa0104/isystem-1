import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

export default function NeracaSaldoPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_accounts: 0,
        debit: 0,
        kredit: 0,
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
                params.set('search', initialQuery?.search ?? '');
                params.set('sortBy', initialQuery?.sortBy ?? 'Kode_Akun');
                params.set('sortDir', initialQuery?.sortDir ?? 'asc');
                params.set('page', '1');
                params.set('pageSize', 'all');

                const res = await fetch(`/laporan/neraca-saldo/rows?${params.toString()}`, {
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
                    total_accounts: Number(data?.summary?.total_accounts ?? 0),
                    debit: Number(data?.summary?.debit ?? 0),
                    kredit: Number(data?.summary?.kredit ?? 0),
                });
            } catch (err) {
                setRows([]);
                setTotal(0);
                setSummary({ total_accounts: 0, debit: 0, kredit: 0 });
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
            <Head title="Neraca Saldo - Print" />
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
                        <h1 className="text-2xl font-semibold">Neraca Saldo</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Ringkasan saldo debit dan kredit per akun (snapshot)
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dibuka: {openedAt.toLocaleDateString('id-ID')}{' '}
                            {openedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: search="{initialQuery?.search ?? ''}", sort=
                            {(initialQuery?.sortBy ?? 'Kode_Akun') + ' ' + (initialQuery?.sortDir ?? 'asc')}
                        </div>
                        <div className="mt-1">
                            Total data: {new Intl.NumberFormat('id-ID').format(total)}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            Total Akun
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {new Intl.NumberFormat('id-ID').format(summary.total_accounts)}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            Total Debit
                        </div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.debit)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            Total Kredit
                        </div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.kredit)}</div>
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
                                <th className="border border-slate-200 px-3 py-2 text-left">Kode Akun</th>
                                <th className="border border-slate-200 px-3 py-2 text-left">Nama Akun</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Debit</th>
                                <th className="border border-slate-200 px-3 py-2 text-right">Kredit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? 'bg-amber-50' : '';
                                return (
                                    <tr key={`${r?.Kode_Akun ?? idx}-${idx}`}>
                                        <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                            {has00 ? (
                                                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                            ) : null}
                                            <span
                                                className={
                                                    has00
                                                        ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200'
                                                        : ''
                                                }
                                            >
                                                {kodeAkun}
                                            </span>
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Debit)}</td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Kredit)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
