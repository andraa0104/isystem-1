import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
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

export default function NeracaAkhirPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({
        total_aset: 0,
        total_liabilitas: 0,
        total_ekuitas: 0,
        selisih: 0,
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

                const res = await fetch(`/laporan/neraca-akhir/rows?${params.toString()}`, {
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
                    total_aset: Number(data?.summary?.total_aset ?? 0),
                    total_liabilitas: Number(data?.summary?.total_liabilitas ?? 0),
                    total_ekuitas: Number(data?.summary?.total_ekuitas ?? 0),
                    selisih: Number(data?.summary?.selisih ?? 0),
                });
            } catch (err) {
                setRows([]);
                setTotal(0);
                setSummary({ total_aset: 0, total_liabilitas: 0, total_ekuitas: 0, selisih: 0 });
                setError(String(err?.message ?? 'Gagal memuat data.'));
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sections = useMemo(() => {
        const aset = rows.filter((r) => r?.side === 'aset');
        const liabilitas = rows.filter((r) => r?.side === 'liabilitas');
        const ekuitas = rows.filter((r) => r?.side === 'ekuitas');
        return { aset, liabilitas, ekuitas };
    }, [rows]);

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <Head title="Neraca Akhir - Print" />
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
                        <h1 className="text-2xl font-semibold">Neraca Akhir</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Posisi aset, liabilitas, dan ekuitas (snapshot)
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
                        <div className="mt-1">Total akun NA: {new Intl.NumberFormat('id-ID').format(total)}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Aset</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_aset)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Liabilitas</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_liabilitas)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Total Ekuitas</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.total_ekuitas)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Selisih</div>
                        <div className="mt-1 text-lg font-semibold">{formatRupiah(summary.selisih)}</div>
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
                                <th className="border border-slate-200 px-3 py-2 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            <SectionTitle title="Aset" subtitle="Prefix 1" />
                            {sections.aset.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`a-${kodeAkun}-${idx}`}>
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
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                                                    lainnya
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Aset" value={formatRupiah(summary.total_aset)} />

                            <SectionTitle title="Liabilitas" subtitle="Prefix 2" />
                            {sections.liabilitas.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`l-${kodeAkun}-${idx}`}>
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
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                                                    lainnya
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Liabilitas" value={formatRupiah(summary.total_liabilitas)} />

                            <SectionTitle title="Ekuitas" subtitle="Prefix 3" />
                            {sections.ekuitas.map((r, idx) => {
                                const kodeAkun = String(r?.Kode_Akun ?? '');
                                const has00 = kodeAkun.includes('00');
                                const cellClass = has00 ? markedCellClass : '';
                                return (
                                    <tr key={`e-${kodeAkun}-${idx}`}>
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
                                            {r?.is_other ? (
                                                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                                                    lainnya
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className={`border border-slate-200 px-3 py-2 text-right font-semibold ${cellClass}`}>{formatRupiah(r?.amount_display)}</td>
                                    </tr>
                                );
                            })}
                            <TotalRow label="Total Ekuitas" value={formatRupiah(summary.total_ekuitas)} />
                            <TotalRow label="Selisih (Aset - (Liabilitas + Ekuitas))" value={formatRupiah(summary.selisih)} />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

