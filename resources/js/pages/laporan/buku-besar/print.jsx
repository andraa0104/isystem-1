import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const formatNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
};

export default function BukuBesarPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({
        total_accounts: 0,
        na_debit: 0,
        na_kredit: 0,
    });
    const [loading, setLoading] = useState(true);

    const printedAt = useMemo(() => new Date(), []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('search', initialQuery?.search ?? '');
                params.set('saldoFilter', initialQuery?.saldoFilter ?? 'all');
                params.set('sortBy', initialQuery?.sortBy ?? 'Kode_Akun');
                params.set('sortDir', initialQuery?.sortDir ?? 'asc');
                params.set('page', '1');
                params.set('pageSize', 'all');

                const res = await fetch(`/laporan/buku-besar/rows?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) {
                    const msg = String(data?.error ?? 'Gagal memuat data.');
                    setError(msg);
                    throw new Error(msg);
                }
                setRows(Array.isArray(data?.rows) ? data.rows : []);
                setSummary({
                    total_accounts: Number(data?.summary?.total_accounts ?? 0),
                    na_debit: Number(data?.summary?.na_debit ?? 0),
                    na_kredit: Number(data?.summary?.na_kredit ?? 0),
                });
            } catch (err) {
                setRows([]);
                setSummary({
                    total_accounts: 0,
                    na_debit: 0,
                    na_kredit: 0,
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
            <Head title="Buku Besar - Print" />
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
                        <h1 className="text-2xl font-semibold">Buku Besar</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Ringkasan saldo per akun (snapshot)
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                            Periode: Snapshot (tb_nabb tidak menyimpan periode)
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dicetak: {printedAt.toLocaleDateString('id-ID')}{' '}
                            {printedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: search="{initialQuery?.search ?? ''}", saldo=
                            {initialQuery?.saldoFilter ?? 'all'}, sort=
                            {(initialQuery?.sortBy ?? 'Kode_Akun') + ' ' + (initialQuery?.sortDir ?? 'asc')}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            Total Akun
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {formatNumber(summary.total_accounts)}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            NA Debit
                        </div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.na_debit)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            NA Kredit
                        </div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.na_kredit)}</div>
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
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Kode Akun</th>
                                <th className="px-3 py-2 text-left">Nama Akun</th>
                                <th className="px-3 py-2 text-right">NA Debit</th>
                                <th className="px-3 py-2 text-right">NA Kredit</th>
                                <th className="px-3 py-2 text-right">BB Debit</th>
                                <th className="px-3 py-2 text-right">BB Kredit</th>
                                <th className="px-3 py-2 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const has00 = String(r?.Kode_Akun ?? '').includes('00');
                                const cellClass = has00 ? 'bg-amber-50' : '';
                                return (
                                <tr
                                    key={`${r?.Kode_Akun ?? idx}-${idx}`}
                                    className="border-t border-slate-200"
                                >
                                    <td className={`px-3 py-2 font-medium ${cellClass}`}>
                                        {has00 ? (
                                            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">
                                                {r?.Kode_Akun}
                                            </span>
                                        ) : (
                                            r?.Kode_Akun
                                        )}
                                    </td>
                                    <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                    <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Debit)}</td>
                                    <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Kredit)}</td>
                                    <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.BB_Debit)}</td>
                                    <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.BB_Kredit)}</td>
                                    <td className={`px-3 py-2 text-right font-semibold ${cellClass}`}>
                                        {formatRupiah(r?.Saldo)}
                                    </td>
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
