import { Head } from '@inertiajs/react';
import { ArrowDownRight, ArrowUpRight, Minus, Printer, X } from 'lucide-react';

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)))}`;

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)));

const formatPercent = (value) => {
    const num = Number(value || 0);
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
};

export default function PerformanceExport({
    filters = {},
    periodInfo = {},
    kpi = {},
    topCustomers = [],
    lowestCustomers = [],
    prevTopCustomers = [],
    prevLowestCustomers = [],
    customers = [],
}) {
    const handlePrint = () => {
        window.print();
    };

    const handleClose = () => {
        window.close();
    };

    return (
        <div className="min-h-screen bg-white p-6 font-sans text-slate-900 print:p-0">
            <Head title="Cetak Laporan KPI Penjualan Customer" />

            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 8mm;
                    }
                    body {
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Action Bar (Screen only) */}
            <div className="no-print mb-6 flex items-center justify-between border-b pb-4">
                <div className="text-sm text-slate-500">
                    Pratinjau Cetak / Ekspor PDF Dokumen KPI Penjualan
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                    >
                        <Printer className="h-4 w-4" />
                        <span>Cetak / Simpan PDF</span>
                    </button>
                    <button
                        onClick={handleClose}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <X className="h-4 w-4" />
                        <span>Tutup</span>
                    </button>
                </div>
            </div>

            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight uppercase text-slate-900">
                            Laporan Key Performance Indicator (KPI) Penjualan
                        </h1>
                        <p className="text-xs text-slate-600">
                            Divisi Marketing &bull; Berdasarkan Faktur Penjualan
                            Terbit (SUM ttl_price)
                        </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <div>
                            Tahun:{' '}
                            <strong className="text-slate-900">
                                {filters.year}
                            </strong>
                        </div>
                        <div>
                            Jenis Periode:{' '}
                            <strong className="text-slate-900 uppercase">
                                {filters.period_type}
                            </strong>
                        </div>
                        <div>
                            Dicetak:{' '}
                            <span className="text-slate-900">
                                {new Date().toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary KPI Box */}
            <div className="my-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Ringkasan Key Performance Indicator
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs sm:grid-cols-6">
                    <div>
                        <span className="text-slate-500">Total Penjualan:</span>
                        <div className="text-sm font-bold text-slate-900">
                            {formatRupiah(kpi.total_sales)}
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500">
                            Customer Transaksi:
                        </span>
                        <div className="text-sm font-bold text-slate-900">
                            {formatNumber(kpi.total_customers)} Customer
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500">
                            Rata-rata / Customer:
                        </span>
                        <div className="text-sm font-bold text-slate-900">
                            {formatRupiah(kpi.avg_sales_per_customer)}
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500">Pertumbuhan:</span>
                        <div
                            className={`text-sm font-bold ${
                                kpi.growth_percent >= 0
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                            }`}
                        >
                            {formatPercent(kpi.growth_percent)}
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500">Total Invoice:</span>
                        <div className="text-sm font-bold text-slate-900">
                            {formatNumber(kpi.total_invoices)} Faktur
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500">
                            Customer Tertinggi:
                        </span>
                        <div
                            className="truncate text-sm font-bold text-slate-900"
                            title={kpi.top_customer?.name || '-'}
                        >
                            {kpi.top_customer?.name || '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Section: Perbandingan Periode Top 5 Customer */}
            <div className="mb-6">
                <div className="mb-2 flex items-center gap-2 border-b pb-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Analisis Perbandingan Antar Periode — {periodInfo.currentLabel || 'Periode Ini'} vs {periodInfo.previousLabel || 'Periode Lalu'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    {/* Top 5 Highest */}
                    <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-800">
                            <span>Top 5 Penjualan Tertinggi</span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Target: Pertahankan
                            </span>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead className="border-b bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-1.5 text-center">Rank</th>
                                    <th className="p-1.5">Customer</th>
                                    <th className="p-1.5 text-right">{periodInfo.currentLabel || 'Ini'}</th>
                                    <th className="p-1.5 text-right">{periodInfo.previousLabel || 'Lalu'}</th>
                                    <th className="p-1.5 text-right">Pertumbuhan</th>
                                    <th className="p-1.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {topCustomers.map((c) => (
                                    <tr key={c.kd_cs}>
                                        <td className="p-1.5 text-center font-bold">{c.rank}</td>
                                        <td className="p-1.5 font-medium">{c.nm_cs}</td>
                                        <td className="p-1.5 text-right font-bold">{formatRupiah(c.curr_sales)}</td>
                                        <td className="p-1.5 text-right text-slate-500">{c.prev_sales > 0 ? formatRupiah(c.prev_sales) : 'Rp 0'}</td>
                                        <td className="p-1.5 text-right font-semibold">{formatPercent(c.growth)}</td>
                                        <td className="p-1.5 text-center">
                                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                                Pertahankan
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Top 5 Lowest */}
                    <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-800">
                            <span>Top 5 Penjualan Terendah (&gt; Rp 0)</span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Target: Perbanyak Penawaran
                            </span>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead className="border-b bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-1.5 text-center">Rank</th>
                                    <th className="p-1.5">Customer</th>
                                    <th className="p-1.5 text-right">{periodInfo.currentLabel || 'Ini'}</th>
                                    <th className="p-1.5 text-right">{periodInfo.previousLabel || 'Lalu'}</th>
                                    <th className="p-1.5 text-right">Pertumbuhan</th>
                                    <th className="p-1.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lowestCustomers.map((c) => (
                                    <tr key={c.kd_cs}>
                                        <td className="p-1.5 text-center font-bold">{c.rank}</td>
                                        <td className="p-1.5 font-medium">{c.nm_cs}</td>
                                        <td className="p-1.5 text-right font-bold">{formatRupiah(c.curr_sales)}</td>
                                        <td className="p-1.5 text-right text-slate-500">{c.prev_sales > 0 ? formatRupiah(c.prev_sales) : 'Rp 0'}</td>
                                        <td className="p-1.5 text-right font-semibold">{formatPercent(c.growth)}</td>
                                        <td className="p-1.5 text-center">
                                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                                Penawaran
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Section: Top 5 Periode Sebelumnya */}
            {prevTopCustomers && prevTopCustomers.length > 0 && (
                <div className="mb-6">
                    <div className="mb-2 flex items-center gap-2 border-b pb-1">
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Top 5 Penjualan — Periode Sebelumnya ({periodInfo.previousLabel || 'Pembanding'})
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        {/* Top 5 Highest Previous */}
                        <div>
                            <div className="mb-1 text-[11px] font-bold text-slate-700">
                                Top 5 Penjualan Tertinggi Periode Lalu
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="border-b bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-1.5 text-center">Rank</th>
                                        <th className="p-1.5">Customer</th>
                                        <th className="p-1.5 text-right">Penjualan Lalu</th>
                                        <th className="p-1.5 text-center">Inv</th>
                                        <th className="p-1.5 text-right">Kontribusi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {prevTopCustomers.map((c) => (
                                        <tr key={c.kd_cs}>
                                            <td className="p-1.5 text-center font-bold">{c.rank}</td>
                                            <td className="p-1.5 font-medium">{c.nm_cs}</td>
                                            <td className="p-1.5 text-right font-bold">{formatRupiah(c.prev_sales)}</td>
                                            <td className="p-1.5 text-center">{c.prev_invoices || c.curr_invoices}</td>
                                            <td className="p-1.5 text-right">{(c.contribution || 0).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Top 5 Lowest Previous */}
                        <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span>Top 5 Penjualan Terendah Periode Lalu (&gt; Rp 0)</span>
                                <span className="text-[10px] font-normal text-slate-500">*Tidak termasuk Rp0</span>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="border-b bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-1.5 text-center">Rank</th>
                                        <th className="p-1.5">Customer</th>
                                        <th className="p-1.5 text-right">Penjualan Lalu</th>
                                        <th className="p-1.5 text-center">Inv</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {prevLowestCustomers.map((c) => (
                                        <tr key={c.kd_cs}>
                                            <td className="p-1.5 text-center font-bold">{c.rank}</td>
                                            <td className="p-1.5 font-medium">{c.nm_cs}</td>
                                            <td className="p-1.5 text-right font-bold">{formatRupiah(c.prev_sales)}</td>
                                            <td className="p-1.5 text-center">{c.prev_invoices || c.curr_invoices}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* All Customers Table */}
            <div>
                <div className="mb-2 border-b pb-1 text-xs font-bold uppercase text-slate-800">
                    Performa Seluruh Customer ({customers.length} Customer)
                </div>
                <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-100 text-slate-700">
                        <tr>
                            <th className="p-1.5 text-center">Rank</th>
                            <th className="p-1.5">Kode</th>
                            <th className="p-1.5">Nama Customer</th>
                            <th className="p-1.5 text-right">
                                Penjualan Berjalan
                            </th>
                            <th className="p-1.5 text-right">
                                Penjualan Lalu
                            </th>
                            <th className="p-1.5 text-right">Pertumbuhan</th>
                            <th className="p-1.5 text-center">Inv</th>
                            <th className="p-1.5 text-right">Rata-rata Inv</th>
                            <th className="p-1.5 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-[11px]">
                        {customers.map((c) => (
                            <tr key={c.kd_cs}>
                                <td className="p-1.5 text-center font-bold">
                                    {c.curr_sales > 0 ? c.rank : '-'}
                                </td>
                                <td className="p-1.5 text-slate-500">
                                    {c.kd_cs}
                                </td>
                                <td className="p-1.5 font-medium text-slate-900">
                                    {c.nm_cs}
                                </td>
                                <td className="p-1.5 text-right font-bold">
                                    {formatRupiah(c.curr_sales)}
                                </td>
                                <td className="p-1.5 text-right text-slate-600">
                                    {formatRupiah(c.prev_sales)}
                                </td>
                                <td
                                    className={`p-1.5 text-right font-semibold ${
                                        c.growth >= 0
                                            ? 'text-emerald-700'
                                            : 'text-rose-700'
                                    }`}
                                >
                                    {formatPercent(c.growth)}
                                </td>
                                <td className="p-1.5 text-center">
                                    {c.curr_invoices}
                                </td>
                                <td className="p-1.5 text-right text-slate-600">
                                    {formatRupiah(c.avg_invoice_value)}
                                </td>
                                <td className="p-1.5 text-center font-medium">
                                    {c.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
