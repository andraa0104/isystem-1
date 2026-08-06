import { Head } from '@inertiajs/react';

const text = (value) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

const COLUMNS = [
    'No',
    'Kode Customer',
    'Nama Customer',
    'Alamat',
    'Kota',
    'Telepon',
    'Fax',
    'NPWP',
    'NPWP 1',
    'NPWP 2',
    'Attended / PIC',
];

export default function CustomerExport({ customers = [] }) {
    // No need to flatten rows anymore, since PICs will be comma separated in a single td.

    return (
        <div className="min-h-screen bg-white p-6 text-slate-950">
            <Head title="Export Data Customer" />
            <style>{`
                @media print {
                    @page { size: landscape; margin: 8mm; }
                    body { margin: 0 !important; }
                    .export-page { padding: 0 !important; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <main className="export-page">
                <div className="no-print mb-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold">Export Data Customer</h1>
                    <button
                        onClick={() => window.print()}
                        className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
                    >
                        Print / Save as PDF
                    </button>
                </div>
                <h1 className="mb-2 hidden text-xl font-bold print:block">
                    Export Data Customer
                </h1>
                <p className="mb-4 text-sm text-slate-500">
                    Total: {customers.length} customer
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                        <thead>
                            <tr className="bg-slate-100">
                                {COLUMNS.map((col) => (
                                    <th
                                        key={col}
                                        className="border border-slate-300 p-2 text-left whitespace-nowrap"
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={COLUMNS.length}
                                        className="border border-slate-300 p-4 text-center"
                                    >
                                        Tidak ada data customer.
                                    </td>
                                </tr>
                            )}
                            {customers.map((cs, idx) => (
                                <tr key={idx} className="even:bg-slate-50">
                                    <td className="border border-slate-300 p-2 text-center align-top whitespace-nowrap">
                                        {idx + 1}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top font-medium whitespace-nowrap">
                                        {text(cs.kd_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(cs.nm_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(cs.alamat_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top whitespace-nowrap">
                                        {text(cs.kota_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top whitespace-nowrap">
                                        {text(cs.telp_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top whitespace-nowrap">
                                        {text(cs.fax_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(cs.npwp_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(cs.npwp1_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(cs.npwp2_cs)}
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        {cs.pics && cs.pics.length > 0
                                            ? cs.pics.join(', ')
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
