import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Rp 0';
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
};

const markedCellClass = 'bg-amber-50';

export default function SaldoAkunPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({
        total_accounts: 0,
        na_debit: 0,
        na_kredit: 0,
    });
    const [error, setError] = useState('');

    const query = useMemo(
        () => ({
            search: initialQuery?.search ?? '',
            saldoFilter: initialQuery?.saldoFilter ?? 'all',
            saldoSign: initialQuery?.saldoSign ?? 'all',
            mark00: initialQuery?.mark00 ?? 'all',
            sortBy: initialQuery?.sortBy ?? 'Kode_Akun',
            sortDir: initialQuery?.sortDir ?? 'asc',
        }),
        [initialQuery],
    );

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('search', query.search);
                params.set('saldoFilter', query.saldoFilter);
                params.set('saldoSign', query.saldoSign);
                params.set('mark00', query.mark00);
                params.set('sortBy', query.sortBy);
                params.set('sortDir', query.sortDir);
                params.set('pageSize', 'all');
                params.set('page', '1');

                const res = await fetch(`/laporan/saldo-akun/rows?${params.toString()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal,
                    credentials: 'include',
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

                setRows(Array.isArray(json?.rows) ? json.rows : []);
                setSummary(json?.summary ?? { total_accounts: 0, na_debit: 0, na_kredit: 0 });
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setRows([]);
                setSummary({ total_accounts: 0, na_debit: 0, na_kredit: 0 });
                setError(String(e?.message || e));
            }
        })();

        return () => controller.abort();
    }, [query]);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title="Print - Saldo Akun (NABB)" />

            <div className="mx-auto max-w-6xl p-6 print:p-0">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
                    <div>
                        <div className="text-lg font-semibold">Saldo Akun (NABB)</div>
                        <div className="mt-1 text-xs text-black/50">
                            Sumber: `tb_nabb` (snapshot)
                            {query.saldoFilter !== 'all' ? (
                                <span className="text-black/50"> • Saldo: {query.saldoFilter}</span>
                            ) : null}
                            {query.search ? (
                                <span className="text-black/50"> • Filter: {query.search}</span>
                            ) : null}
                        </div>
                    </div>
                    <div className="text-right text-xs text-black/50">
                        Dicetak: {new Date().toLocaleString('id-ID')}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Total Akun</div>
                        <div className="mt-2 text-base font-semibold">{summary?.total_accounts ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">NA Debit</div>
                        <div className="mt-2 text-base font-semibold">{formatRupiah(summary?.na_debit)}</div>
                    </div>
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">NA Kredit</div>
                        <div className="mt-2 text-base font-semibold">{formatRupiah(summary?.na_kredit)}</div>
                    </div>
                </div>

                <div className="mt-6 rounded-lg border border-black/10">
                    <div className="border-b border-black/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black/50">
                        Ringkasan Saldo per Akun
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-black/5 text-[11px] uppercase tracking-wide text-black/50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Kode Akun</th>
                                    <th className="px-3 py-2 text-left">Nama Akun</th>
                                    <th className="px-3 py-2 text-right">NA Debit</th>
                                    <th className="px-3 py-2 text-right">NA Kredit</th>
                                    <th className="px-3 py-2 text-right">Saldo</th>
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
                                        const has00 = kodeAkun.includes('00');
                                        const cellClass = has00 ? markedCellClass : '';
                                        return (
                                            <tr key={`${kodeAkun}-${idx}`} className="border-t border-black/10">
                                                <td className={`px-3 py-2 font-medium ${cellClass}`}>{kodeAkun}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.Nama_Akun}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Debit)}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.NA_Kredit)}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.Saldo)}</td>
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
