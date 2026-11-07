import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';

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

const getPeriodLabel = (periodType, period) => {
    if (!period) return 'Semua Periode';
    if (periodType === 'year') {
        if (!/^\d{4}$/.test(period)) return `Tahun ${period}`;
        return `Tahun ${period}`;
    }
    if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split('-').map(Number);
        const d = new Date(y, Math.max(0, m - 1), 1);
        return new Intl.DateTimeFormat('id-ID', {
            month: 'long',
            year: 'numeric',
        }).format(d);
    }
    if (/^\d{6}$/.test(period)) {
        const y = Number(period.slice(0, 4));
        const m = Number(period.slice(4, 6));
        const d = new Date(y, Math.max(0, m - 1), 1);
        return new Intl.DateTimeFormat('id-ID', {
            month: 'long',
            year: 'numeric',
        }).format(d);
    }
    return period;
};

const getAccountCategory = (code) => {
    const prefix = String(code || '').trim().charAt(0);
    switch (prefix) {
        case '1':
            return 'Aset';
        case '2':
            return 'Liabilitas';
        case '3':
            return 'Ekuitas';
        case '4':
            return 'Pendapatan';
        case '5':
            return 'Beban Ops';
        case '6':
            return 'HPP';
        case '7':
            return 'Pend. Lain';
        case '8':
            return 'Beban Lain';
        default:
            return 'Lainnya';
    }
};

const databaseCompanies = {
    dbsja: 'CV. Semesta Jaya Abadi',
    dbbbbs: 'CV. Bangun Banua Bersama Sejahtera',
    dbstg: 'CV. Surya Teknik Gemilang',
    dbati: 'PT. Allstar Tekstil Indonesia',
    dbarm: 'AR-MART',
    dbjms: 'CV. JLX Makmur Sentosa',
};

export default function NabbRekapPrint() {
    const { initialQuery = {}, periodOptions = [], yearOptions = [], companyName: propCompanyName, tenant } = usePage().props;

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Nama Perusahaan otomatis diambil dari data login user / tenant
    const companyName = useMemo(() => {
        const db = tenant?.database || '';
        return propCompanyName
            || tenant?.company
            || databaseCompanies[db]
            || tenant?.label
            || 'CV. Semesta Jaya Abadi';
    }, [propCompanyName, tenant]);

    const isCompare = Boolean(initialQuery?.isCompare ?? false);
    const compareType = initialQuery?.compareType ?? 'month';

    const comparePeriods = useMemo(() => {
        if (Array.isArray(initialQuery?.comparePeriods) && initialQuery.comparePeriods.length >= 2) {
            return initialQuery.comparePeriods;
        }
        if (initialQuery?.period1 && initialQuery?.period2) {
            return [initialQuery.period1, initialQuery.period2];
        }
        if (compareType === 'year') {
            return yearOptions.slice(0, Math.min(2, yearOptions.length)).sort();
        }
        return periodOptions.slice(0, Math.min(2, periodOptions.length)).sort();
    }, [initialQuery, compareType, yearOptions, periodOptions]);

    const query = useMemo(
        () => ({
            isCompare,
            compareType,
            comparePeriods,
            changeFilter: initialQuery?.changeFilter ?? 'all',
            periodType: initialQuery?.periodType ?? 'month',
            period: initialQuery?.period ?? '',
            search: initialQuery?.search ?? '',
            accountGroup: initialQuery?.accountGroup ?? 'all',
            ajpFilter: initialQuery?.ajpFilter ?? 'all',
            saldoFilter: initialQuery?.saldoFilter ?? 'all',
            saldoSign: initialQuery?.saldoSign ?? 'all',
            sortBy: initialQuery?.sortBy ?? 'Kode_Akun',
            sortDir: initialQuery?.sortDir ?? 'asc',
        }),
        [initialQuery, isCompare, compareType, comparePeriods],
    );

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams();

                if (query.isCompare) {
                    params.set('isCompare', 'true');
                    params.set('compareType', query.compareType);
                    params.set('periods', query.comparePeriods.join(','));
                    if (query.changeFilter !== 'all') {
                        params.set('changeFilter', query.changeFilter);
                    }
                } else {
                    params.set('periodType', query.periodType);
                    if (query.period) params.set('period', query.period);
                    if (query.ajpFilter !== 'all') params.set('ajpFilter', query.ajpFilter);
                    if (query.saldoFilter !== 'all') params.set('saldoFilter', query.saldoFilter);
                    if (query.saldoSign !== 'all') params.set('saldoSign', query.saldoSign);
                }

                if (query.search) params.set('search', query.search);
                if (query.accountGroup !== 'all') params.set('accountGroup', query.accountGroup);
                params.set('sortBy', query.sortBy);
                params.set('sortDir', query.sortDir);
                params.set('pageSize', 'all');
                params.set('page', '1');

                const res = await fetch(`/laporan/nabb-rekap/rows?${params.toString()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal,
                    credentials: 'include',
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Gagal memuat data cetak.');

                setRows(Array.isArray(json?.rows) ? json.rows : []);
                setSummary(json?.summary ?? {});
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setRows([]);
                setError(String(e?.message || e));
            } finally {
                setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [query]);

    // Active periods list
    const activePeriods = useMemo(() => {
        if (summary.periods && summary.periods.length > 0) return summary.periods;
        return query.comparePeriods;
    }, [summary.periods, query.comparePeriods]);

    const activePeriodLabels = useMemo(() => {
        return activePeriods.map((p) => ({
            raw: p,
            label: getPeriodLabel(query.compareType, p),
        }));
    }, [activePeriods, query.compareType]);

    const pageTitle = companyName
        ? `${companyName} - ${isCompare ? `Komparasi NABB Rekap (${query.compareType === 'year' ? 'Tahunan' : 'Bulanan'})` : `NABB Rekap (${getPeriodLabel(query.periodType, query.period)})`}`
        : isCompare
            ? `Cetak Komparasi NABB Rekap (${query.compareType === 'year' ? 'Tahunan' : 'Bulanan'}) - ${activePeriodLabels.map((p) => p.label).join(' vs ')}`
            : `Cetak NABB Rekap Disesuaikan - ${getPeriodLabel(query.periodType, query.period)}`;

    return (
        <div className="min-h-screen bg-white text-black p-6 print:p-0 font-sans">
            <Head title={pageTitle} />

            <style>{`
                @page { size: auto; margin: 10mm 8mm; }
                @media print {
                    table { page-break-inside: auto; width: 100%; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>

            {/* Document Header */}
            <div className="border-b-2 border-black pb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                    {/* Kop Nama Perusahaan Otomatis dari Login User */}
                    {companyName && (
                        <div className="mb-2.5">
                            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
                                {companyName}
                            </h2>
                            <div className="h-0.5 bg-black w-36 mt-1 mb-2"></div>
                        </div>
                    )}

                    <h1 className="text-xl font-bold uppercase tracking-wider">
                        {isCompare
                            ? `Laporan Perbandingan Rekapitulasi NABB (${query.compareType === 'year' ? 'Tahunan' : 'Bulanan'})`
                            : 'Laporan Rekapitulasi Neraca & Buku Besar (NABB)'}
                    </h1>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">
                        {isCompare
                            ? `Analisis Komparasi Saldo Disesuaikan AJP Melintasi ${activePeriods.length} Periode`
                            : 'Rekapitulasi Saldo Disesuaikan dengan Jurnal Penyesuaian (AJP)'}
                    </p>
                    <div className="text-xs text-gray-600 mt-2 space-y-0.5">
                        {isCompare ? (
                            <div>
                                Periode Komparasi:{' '}
                                {activePeriodLabels.map((item, idx) => (
                                    <span key={item.raw} className="font-bold">
                                        {item.label}
                                        <span className="text-gray-500 font-mono text-[11px] ml-0.5">({item.raw})</span>
                                        {idx < activePeriodLabels.length - 1 && (
                                            <span className="mx-2 text-gray-400 font-bold">&rarr;</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div>
                                Periode:{' '}
                                <span className="font-bold">
                                    {getPeriodLabel(query.periodType, query.period)}
                                </span>
                                {query.period && <span className="font-mono ml-1 font-semibold">({query.period})</span>}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 mt-1">
                            {query.accountGroup !== 'all' && (
                                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                                    Kelompok Akun: Prefix {query.accountGroup}
                                </span>
                            )}
                            {isCompare && query.changeFilter !== 'all' && (
                                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                                    Arah Perubahan:{' '}
                                    {query.changeFilter === 'up'
                                        ? 'Hanya Saldo Naik'
                                        : query.changeFilter === 'down'
                                            ? 'Hanya Saldo Turun'
                                            : query.changeFilter === 'changed'
                                                ? 'Ada Perubahan (Naik/Turun)'
                                                : 'Saldo Tetap'}
                                </span>
                            )}
                            {!isCompare && query.ajpFilter !== 'all' && (
                                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                                    Filter Penyesuaian: {query.ajpFilter === 'adjusted' ? 'Hanya yang Ada AJP' : 'Hanya yang Tanpa AJP'}
                                </span>
                            )}
                            {!isCompare && query.saldoFilter !== 'all' && (
                                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                                    Filter Saldo: {query.saldoFilter === 'nonzero' ? 'Non-Zero' : 'Nol (0)'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-right text-xs text-gray-500 space-y-1">
                    <div>Dicetak pada: {new Date().toLocaleString('id-ID')}</div>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="print:hidden inline-flex items-center gap-1.5 rounded-md border border-gray-400 bg-gray-100 px-3 py-1 font-semibold text-gray-800 hover:bg-gray-200 transition-colors shadow-sm cursor-pointer"
                    >
                        <Printer className="size-3.5" />
                        <span>Cetak / Print</span>
                    </button>
                </div>
            </div>

            {/* Financial Summary Box */}
            {isCompare ? (
                <div className="my-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs border border-gray-300 rounded-md p-3 bg-gray-50">
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total Akun / Dinamika</div>
                        <div className="font-bold text-sm">
                            {formatNumber(summary.total_accounts ?? rows.length)} Akun
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 flex gap-1">
                            <span className="text-emerald-700 font-semibold">&uarr; {summary.count_up ?? 0}</span>
                            <span>•</span>
                            <span className="text-rose-700 font-semibold">&darr; {summary.count_down ?? 0}</span>
                            <span>•</span>
                            <span className="text-gray-600 font-semibold">= {summary.count_same ?? 0}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">
                            Saldo ({activePeriodLabels[0]?.label})
                        </div>
                        <div className="font-bold text-sm text-gray-800">{formatRupiah(summary.total_saldo_start)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">
                            Saldo ({activePeriodLabels[activePeriodLabels.length - 1]?.label})
                        </div>
                        <div className="font-bold text-sm text-gray-800">{formatRupiah(summary.total_saldo_end)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Selisih Bersih (Net)</div>
                        <div className={`font-bold text-sm ${(summary.total_diff_nominal ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {(summary.total_diff_nominal ?? 0) > 0 ? '+' : ''}
                            {formatRupiah(summary.total_diff_nominal)}
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">% Perubahan Total</div>
                        <div className={`font-bold text-sm ${(summary.total_diff_percent ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {(summary.total_diff_percent ?? 0) > 0 ? '+' : ''}
                            {summary.total_diff_percent ?? 0}%
                        </div>
                    </div>
                </div>
            ) : (
                <div className="my-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs border border-gray-300 rounded-md p-3 bg-gray-50">
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total Akun / Ada AJP</div>
                        <div className="font-bold text-sm">
                            {formatNumber(summary.total_accounts ?? rows.length)} Akun
                            <span className="text-xs font-normal text-gray-500 ml-1">
                                ({formatNumber(summary.adjusted_count ?? 0)} AJP)
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total Saldo Awal</div>
                        <div className="font-bold text-sm text-gray-800">{formatRupiah(summary.total_saldo_awal)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total AJP Debit (-)</div>
                        <div className="font-bold text-sm text-rose-700">{formatRupiah(summary.total_ajp_debit)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total AJP Kredit (+)</div>
                        <div className="font-bold text-sm text-blue-700">{formatRupiah(summary.total_ajp_kredit)}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 font-medium uppercase text-[10px]">Total Saldo Akhir Disesuaikan</div>
                        <div className="font-bold text-sm text-emerald-800">{formatRupiah(summary.total_saldo)}</div>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                </div>
            )}

            {/* Table */}
            {isCompare ? (
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-t border-black bg-gray-100 text-[10px] font-bold uppercase">
                            <th className="py-2 px-1 w-7 text-center border-l border-r border-gray-300 whitespace-nowrap">No</th>
                            <th className="py-2 px-1.5 border-r border-gray-300 w-16 whitespace-nowrap">Kode Akun</th>
                            <th className="py-2 px-1 border-r border-gray-300 w-14 text-[8.5px] text-center whitespace-nowrap">Kategori</th>
                            <th className="py-2 px-2.5 border-r border-gray-300 min-w-[200px]">Nama Akun</th>

                            {/* Dynamic period columns */}
                            {activePeriodLabels.map((item) => (
                                <th key={item.raw} className="py-2 px-2 text-right border-r border-gray-300 min-w-[115px] whitespace-nowrap">
                                    Saldo ({item.label})
                                </th>
                            ))}

                            <th className="py-2 px-2 text-right border-r border-gray-300 min-w-[115px] whitespace-nowrap">Selisih Total</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-16 whitespace-nowrap">% Ubah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6 + activePeriods.length} className="py-8 text-center text-gray-500 border-l border-r border-gray-300">
                                    Memuat data komparasi rekapitulasi...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6 + activePeriods.length} className="py-8 text-center text-gray-500 border-l border-r border-gray-300">
                                    Tidak ada data untuk dibandingkan pada periode yang dipilih.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => {
                                const diff = Number(row.Diff_Nominal || 0);
                                const diffPct = Number(row.Diff_Percent || 0);
                                const isUp = diff > 0;
                                const isDown = diff < 0;

                                return (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-1.5 px-1 text-center border-l border-r border-gray-300 font-mono text-[11px] whitespace-nowrap">
                                            {idx + 1}
                                        </td>
                                        <td className="py-1.5 px-1.5 border-r border-gray-300 font-mono font-bold whitespace-nowrap">
                                            {row.Kode_Akun}
                                        </td>
                                        <td className="py-1.5 px-1 border-r border-gray-300 text-[8.5px] text-center font-medium whitespace-nowrap">
                                            {getAccountCategory(row.Kode_Akun)}
                                        </td>
                                        <td className="py-1.5 px-2.5 border-r border-gray-300 font-medium text-[11px] leading-snug break-words">
                                            {row.Nama_Akun || '-'}
                                        </td>

                                        {/* Dynamic Period Saldo */}
                                        {activePeriods.map((_, pIdx) => (
                                            <td key={pIdx} className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-[11px] whitespace-nowrap">
                                                {formatRupiah(row[`Saldo_${pIdx}`])}
                                            </td>
                                        ))}

                                        <td
                                            className={`py-1.5 px-2 text-right border-r border-gray-300 font-mono font-bold text-[11px] whitespace-nowrap ${isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-gray-600'
                                                }`}
                                        >
                                            {isUp ? '+' : ''}
                                            {formatRupiah(diff)}
                                        </td>
                                        <td
                                            className={`py-1.5 px-1.5 text-right border-r border-gray-300 font-mono font-bold text-[11px] whitespace-nowrap ${isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-gray-600'
                                                }`}
                                        >
                                            {isUp ? '+' : ''}
                                            {diffPct.toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black font-bold bg-gray-100 text-[11px]">
                            <td colSpan={4} className="py-2 px-3 text-right border-l border-r border-gray-300">
                                Total Ringkasan:
                            </td>

                            {/* Dynamic period footer sums */}
                            {activePeriods.map((_, pIdx) => (
                                <td key={pIdx} className="py-2 px-2 text-right border-r border-gray-300 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(summary.period_totals?.[pIdx]?.total_saldo ?? 0)}
                                </td>
                            ))}

                            <td
                                className={`py-2 px-2 text-right border-r border-gray-300 font-mono text-[11px] whitespace-nowrap ${(summary.total_diff_nominal ?? 0) >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                            >
                                {(summary.total_diff_nominal ?? 0) > 0 ? '+' : ''}
                                {formatRupiah(summary.total_diff_nominal)}
                            </td>
                            <td
                                className={`py-2 px-3 text-right border-r border-gray-300 font-mono ${(summary.total_diff_percent ?? 0) >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                            >
                                {(summary.total_diff_percent ?? 0) > 0 ? '+' : ''}
                                {summary.total_diff_percent ?? 0}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            ) : (
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-t border-black bg-gray-100 text-[10px] font-bold uppercase">
                            <th className="py-2 px-1 w-7 text-center border-l border-r border-gray-300 whitespace-nowrap">No</th>
                            <th className="py-2 px-1.5 border-r border-gray-300 w-16 whitespace-nowrap">Kode Akun</th>
                            <th className="py-2 px-1 border-r border-gray-300 w-14 text-[8.5px] text-center whitespace-nowrap">Kategori</th>
                            <th className="py-2 px-3 border-r border-gray-300 min-w-[240px]">Nama Akun</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-24 min-w-[92px] whitespace-nowrap">Saldo Awal</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-24 min-w-[92px] whitespace-nowrap">AJP Debit (-)</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-24 min-w-[92px] whitespace-nowrap">AJP Kredit (+)</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-24 min-w-[92px] whitespace-nowrap">Saldo Akhir</th>
                            <th className="py-2 px-1.5 text-right border-r border-gray-300 w-24 min-w-[92px] whitespace-nowrap">Selisih (Rp)</th>
                            <th className="py-2 px-1 text-right border-r border-gray-300 w-14 min-w-[50px] whitespace-nowrap">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="py-8 text-center text-gray-500 border-l border-r border-gray-300">
                                    Memuat data rekapitulasi...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-8 text-center text-gray-500 border-l border-r border-gray-300">
                                    Tidak ada data pada periode ini.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => {
                                const hasAjp = Number(row.Ajp_Debit || 0) > 0 || Number(row.Ajp_Kredit || 0) > 0;
                                const sAwal = Number(row.Saldo_Awal || 0);
                                const sAkhir = Number(row.Saldo || 0);
                                const diff = row.Diff_Nominal !== undefined ? Number(row.Diff_Nominal) : (sAkhir - sAwal);
                                const diffPct = row.Diff_Percent !== undefined
                                    ? Number(row.Diff_Percent)
                                    : (sAwal !== 0 ? (diff / Math.abs(sAwal)) * 100 : (diff !== 0 ? (diff > 0 ? 100 : -100) : 0));
                                const isUp = diff > 0;
                                const isDown = diff < 0;

                                return (
                                    <tr key={idx} className={`border-b border-gray-200 ${hasAjp ? 'bg-amber-50/30' : ''}`}>
                                        <td className="py-1.5 px-1 text-center border-l border-r border-gray-300 font-mono text-[11px] whitespace-nowrap">
                                            {idx + 1}
                                        </td>
                                        <td className="py-1.5 px-1.5 border-r border-gray-300 font-mono font-bold whitespace-nowrap">
                                            {row.Kode_Akun}
                                        </td>
                                        <td className="py-1.5 px-1 border-r border-gray-300 text-[8.5px] text-center font-medium whitespace-nowrap">
                                            {getAccountCategory(row.Kode_Akun)}
                                        </td>
                                        <td className="py-1.5 px-3 border-r border-gray-300 font-medium text-[11px] leading-snug break-words">
                                            {row.Nama_Akun || '-'}
                                        </td>
                                        <td className="py-1.5 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] whitespace-nowrap">
                                            {formatRupiah(row.Saldo_Awal)}
                                        </td>
                                        <td className="py-1.5 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] text-rose-700 whitespace-nowrap">
                                            {Number(row.Ajp_Debit || 0) > 0 ? formatRupiah(row.Ajp_Debit) : 'Rp 0'}
                                        </td>
                                        <td className="py-1.5 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] text-blue-700 whitespace-nowrap">
                                            {Number(row.Ajp_Kredit || 0) > 0 ? formatRupiah(row.Ajp_Kredit) : 'Rp 0'}
                                        </td>
                                        <td className="py-1.5 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] font-bold whitespace-nowrap">
                                            {formatRupiah(row.Saldo)}
                                        </td>
                                        <td
                                            className={`py-1.5 px-1.5 text-right border-r border-gray-300 font-mono font-bold text-[10.5px] whitespace-nowrap ${
                                                isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-gray-600'
                                            }`}
                                        >
                                            {isUp ? '+' : ''}
                                            {formatRupiah(diff)}
                                        </td>
                                        <td
                                            className={`py-1.5 px-1 text-right border-r border-gray-300 font-mono font-bold text-[10.5px] whitespace-nowrap ${
                                                isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-gray-600'
                                            }`}
                                        >
                                            {isUp ? '+' : ''}
                                            {Number(diffPct).toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black font-bold bg-gray-100 text-[11px]">
                            <td colSpan={4} className="py-2 px-3 text-right border-l border-r border-gray-300">
                                Total Ringkasan:
                            </td>
                            <td className="py-2 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] whitespace-nowrap">
                                {formatRupiah(summary.total_saldo_awal)}
                            </td>
                            <td className="py-2 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] text-rose-700 whitespace-nowrap">
                                {formatRupiah(summary.total_ajp_debit)}
                            </td>
                            <td className="py-2 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] text-blue-700 whitespace-nowrap">
                                {formatRupiah(summary.total_ajp_kredit)}
                            </td>
                            <td className="py-2 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] text-emerald-800 whitespace-nowrap">
                                {formatRupiah(summary.total_saldo)}
                            </td>
                            <td
                                className={`py-2 px-1.5 text-right border-r border-gray-300 font-mono text-[10.5px] whitespace-nowrap ${(summary.total_diff_nominal ?? (Number(summary.total_saldo || 0) - Number(summary.total_saldo_awal || 0))) >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                            >
                                {(summary.total_diff_nominal ?? (Number(summary.total_saldo || 0) - Number(summary.total_saldo_awal || 0))) > 0 ? '+' : ''}
                                {formatRupiah(summary.total_diff_nominal ?? (Number(summary.total_saldo || 0) - Number(summary.total_saldo_awal || 0)))}
                            </td>
                            <td
                                className={`py-2 px-1 text-right border-r border-gray-300 font-mono text-[10.5px] whitespace-nowrap ${(summary.total_diff_percent ?? 0) >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                            >
                                {(summary.total_diff_percent ?? 0) > 0 ? '+' : ''}
                                {Number(summary.total_diff_percent ?? 0).toFixed(2)}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            )}

            {/* Print Footer */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-[10px] text-gray-500 flex items-center justify-between">
                <span>ISYSTEM Enterprise Accounting • NABB Rekapitulasi (Formula Penyesuaian AJP)</span>
                <span>Halaman 1 dari 1</span>
            </div>
        </div>
    );
}
