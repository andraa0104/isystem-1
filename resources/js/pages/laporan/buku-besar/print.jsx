import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const formatRupiah = (value) => {
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

const formatSaldoWithSide = (signed) => {
    const n = Number(signed);
    if (!Number.isFinite(n) || n === 0) return 'Rp 0';
    return `${formatRupiah(Math.abs(n))} ${n >= 0 ? 'D' : 'K'}`;
};

const markedCellClass = 'bg-amber-50';

export default function BukuBesarLedgerPrint() {
    const { initialQuery = {} } = usePage().props;

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({
        opening_balance_signed: 0,
        opening_warning: false,
        opening_source: 'missing',
        opening_period: null,
        total_debit: 0,
        total_kredit: 0,
        closing_balance_signed: 0,
        line_count: 0,
    });
    const [meta, setMeta] = useState({
        period_type: initialQuery?.periodType ?? 'month',
        period: initialQuery?.period ?? '',
        period_label: '',
        account: initialQuery?.account ?? '',
        account_name: '',
        source: initialQuery?.source ?? 'all',
        search: initialQuery?.search ?? '',
    });
    const [error, setError] = useState('');

    const query = useMemo(
        () => ({
            periodType: initialQuery?.periodType ?? 'month',
            period: initialQuery?.period ?? '',
            account: initialQuery?.account ?? '',
            source: initialQuery?.source ?? 'all',
            search: initialQuery?.search ?? '',
        }),
        [initialQuery],
    );

    const has00Account = useMemo(() => String(query.account || '').includes('00'), [query.account]);

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            setError('');
            try {
                const params = new URLSearchParams();
                params.set('periodType', query.periodType);
                params.set('period', query.period);
                params.set('account', query.account);
                params.set('source', query.source);
                params.set('search', query.search);
                params.set('pageSize', 'all');
                params.set('page', '1');

                const res = await fetch(`/laporan/buku-besar/rows?${params.toString()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal,
                    credentials: 'include',
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Gagal memuat data.');

                setRows(Array.isArray(json?.rows) ? json.rows : []);
                setSummary(json?.summary ?? {});
                setMeta({
                    period_type: json?.period_type ?? query.periodType,
                    period: json?.period ?? query.period,
                    period_label: json?.period_label ?? getPeriodLabel(query.periodType, query.period),
                    account: json?.account ?? query.account,
                    account_name: json?.account_name ?? '',
                    source: json?.source ?? query.source,
                    search: json?.search ?? query.search,
                });
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setRows([]);
                setSummary({
                    opening_balance_signed: 0,
                    opening_warning: false,
                    opening_source: 'missing',
                    opening_period: null,
                    total_debit: 0,
                    total_kredit: 0,
                    closing_balance_signed: 0,
                    line_count: 0,
                });
                setError(String(e?.message || e));
            }
        })();

        return () => controller.abort();
    }, [query]);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title="Print - Buku Besar" />

            <div className="mx-auto max-w-6xl p-6 print:p-0">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
                    <div>
                        <div className="text-lg font-semibold">Buku Besar</div>
                        <div className="mt-1 text-sm text-black/60">
                            Periode:{' '}
                            <span className="font-medium text-black/80">
                                {meta.period_label || '—'}
                            </span>
                        </div>
                        <div className="mt-1 text-sm text-black/60">
                            Akun:{' '}
                            <span className="font-medium text-black/80">
                                {meta.account}
                                {meta.account_name ? ` — ${meta.account_name}` : ''}
                            </span>
                        </div>
                        <div className="mt-1 text-xs text-black/50">
                            Sumber: {meta.source === 'all' ? 'TRX + AJP' : meta.source.toUpperCase()}
                            {meta.search ? (
                                <span className="text-black/50">
                                    {' '}
                                    • Filter: {meta.search}
                                </span>
                            ) : null}
                        </div>
                        {summary?.opening_warning ? (
                            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                                Saldo awal tidak ditemukan (opening=0)
                            </div>
                        ) : null}
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

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Saldo Awal</div>
                        <div className="mt-2 text-base font-semibold">{formatSaldoWithSide(summary?.opening_balance_signed)}</div>
                        <div className="mt-1 text-xs text-black/50">
                            {summary?.opening_warning
                                ? 'Sumber: tidak ditemukan'
                                : summary?.opening_period
                                  ? `Sumber: tb_nabbrekap (${summary.opening_period})`
                                  : 'Sumber: tb_nabbrekap'}
                        </div>
                    </div>
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Total Debit</div>
                        <div className="mt-2 text-base font-semibold">{formatRupiah(summary?.total_debit)}</div>
                    </div>
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Total Kredit</div>
                        <div className="mt-2 text-base font-semibold">{formatRupiah(summary?.total_kredit)}</div>
                    </div>
                    <div className="rounded-lg border border-black/10 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Saldo Akhir</div>
                        <div className="mt-2 text-base font-semibold">{formatSaldoWithSide(summary?.closing_balance_signed)}</div>
                    </div>
                </div>

                <div className="mt-6 rounded-lg border border-black/10">
                    <div className="border-b border-black/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black/50">
                        Ledger Lines ({summary?.line_count ?? rows.length})
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-black/5 text-[11px] uppercase tracking-wide text-black/50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Tanggal</th>
                                    <th className="px-3 py-2 text-left">Sumber</th>
                                    <th className="px-3 py-2 text-left">Kode Jurnal</th>
                                    <th className="px-3 py-2 text-left">Voucher</th>
                                    <th className="px-3 py-2 text-left">Remark</th>
                                    <th className="px-3 py-2 text-right">Debit</th>
                                    <th className="px-3 py-2 text-right">Kredit</th>
                                    <th className="px-3 py-2 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-8 text-center text-black/50">
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r, idx) => {
                                        const cellClass = has00Account ? markedCellClass : '';
                                        return (
                                            <tr key={`${r?.date ?? idx}-${r?.kode_jurnal ?? idx}-${idx}`} className="border-t border-black/10">
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.date}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.source}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.kode_jurnal}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.kode_voucher}</td>
                                                <td className={`px-3 py-2 ${cellClass}`}>{r?.remark}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.debit)}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatRupiah(r?.kredit)}</td>
                                                <td className={`px-3 py-2 text-right ${cellClass}`}>{formatSaldoWithSide(r?.running_signed)}</td>
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

