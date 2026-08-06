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
    // Flatten: each PIC = one row, merge header cells with rowSpan
    const rows = [];
    customers.forEach((cs, csIdx) => {
        const pics = cs.pics && cs.pics.length > 0 ? cs.pics : [null];
        pics.forEach((pic, picIdx) => {
            rows.push({
                cs,
                csIdx,
                pic,
                picIdx,
                picCount: pics.length,
                globalNo: csIdx + 1,
            });
        });
    });

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
                            {rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={COLUMNS.length}
                                        className="border border-slate-300 p-4 text-center"
                                    >
                                        Tidak ada data customer.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row, idx) => (
                                <tr key={idx} className="even:bg-slate-50">
                                    {/* Merge header cells on first PIC row */}
                                    {row.picIdx === 0 && (
                                        <>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 text-center align-top whitespace-nowrap"
                                            >
                                                {row.globalNo}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top font-medium whitespace-nowrap"
                                            >
                                                {text(row.cs.kd_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top"
                                            >
                                                {text(row.cs.nm_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top"
                                            >
                                                {text(row.cs.alamat_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                            >
                                                {text(row.cs.kota_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                            >
                                                {text(row.cs.telp_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                            >
                                                {text(row.cs.fax_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top"
                                            >
                                                {text(row.cs.npwp_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top"
                                            >
                                                {text(row.cs.npwp1_cs)}
                                            </td>
                                            <td
                                                rowSpan={row.picCount}
                                                className="border border-slate-300 p-2 align-top"
                                            >
                                                {text(row.cs.npwp2_cs)}
                                            </td>
                                        </>
                                    )}
                                    {/* PIC column — one row per PIC */}
                                    <td className="border border-slate-300 p-2 align-top">
                                        {text(row.pic)}
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
