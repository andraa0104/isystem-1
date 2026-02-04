import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

function GroupHeader({ title }) {
    return (
        <th colSpan={2} className="border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {title}
        </th>
    );
}

function ColHeader({ title }) {
    return (
        <th className="border border-slate-200 bg-white px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {title}
        </th>
    );
}

export default function NeracaLajurPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const printedAt = useMemo(() => new Date(), []);

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

                const res = await fetch(`/laporan/neraca-lajur/rows?${params.toString()}`, {
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
            } catch (err) {
                setRows([]);
                setTotal(0);
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
            <Head title="Neraca Lajur - Print" />
            <style>{`
                @page { size: A4 landscape; margin: 10mm; }
                @media print {
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>

            <div className="mx-auto max-w-[1400px] px-4 py-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Neraca Lajur</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Ringkasan neraca lajur per akun (snapshot)
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Dibuka: {printedAt.toLocaleDateString('id-ID')}{' '}
                            {printedAt.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1">
                            Filter: search="{initialQuery?.search ?? ''}", sort=
                            {(initialQuery?.sortBy ?? 'Kode_Akun') + ' ' + (initialQuery?.sortDir ?? 'asc')}
                        </div>
                        <div className="mt-1">Total data: {new Intl.NumberFormat('id-ID').format(total)}</div>
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

                    <table className="min-w-[1350px] w-full text-sm">
                        <thead>
                            <tr>
                                <th rowSpan={2} className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                    Kode Akun
                                </th>
                                <th rowSpan={2} className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                    Nama Akun
                                </th>
                                <GroupHeader title="Saldo" />
                                <GroupHeader title="AJP" />
                                <GroupHeader title="NSSP" />
                                <GroupHeader title="RL" />
                                <GroupHeader title="NA" />
                            </tr>
                            <tr>
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                                <ColHeader title="Debit" />
                                <ColHeader title="Kredit" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={12} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => (
                                <tr key={`${r?.Kode_Akun ?? idx}-${idx}`}>
                                    {(() => {
                                        const kodeAkun = String(r?.Kode_Akun ?? '');
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? 'bg-amber-50' : '';
                                        return (
                                            <>
                                                <td className={`border border-slate-200 px-3 py-2 font-medium ${cellClass}`}>
                                                    {has00 ? (
                                                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                                                    ) : null}
                                                    <span className={has00 ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200' : ''}>
                                                        {kodeAkun}
                                                    </span>
                                                </td>
                                                <td className={`border border-slate-200 px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>

                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Saldo_Debit)}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Saldo_Kredit)}</td>

                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.AJP_Debit)}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.AJP_Kredit)}</td>

                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NSSP_Debit)}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NSSP_Kredit)}</td>

                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.RL_Debit)}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.RL_Kredit)}</td>

                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Debit)}</td>
                                                <td className={`border border-slate-200 px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Kredit)}</td>
                                            </>
                                        );
                                    })()}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
