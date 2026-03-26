import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        toNumber(value),
    );

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return `${number.toFixed(2)} %`;
};

const formatLongDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
};

const formatShortDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
};

export default function BiayaKirimPembelianPrint({
    company = {},
    header = {},
    details = [],
    printDate = '',
}) {
    // Print margin settings (top, right, bottom, left)
    const pageMargins = {
        top: '8mm',
        right: '8mm',
        bottom: '3mm',
        left: '8mm',
    };

    // Keep layout consistent between on-screen preview and print output by using
    // a fixed "page box" and applying margins as padding on that box.
    const pageStyle = `
        :root {
            --page-pad-top: ${pageMargins.top};
            --page-pad-right: ${pageMargins.right};
            --page-pad-bottom: ${pageMargins.bottom};
            --page-pad-left: ${pageMargins.left};
        }

        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: Arial, Helvetica, sans-serif;
        }

        .print-page {
            box-sizing: border-box;
            width: 210mm;
            min-height: 297mm;
            padding: var(--page-pad-top) var(--page-pad-right) var(--page-pad-bottom) var(--page-pad-left);
            margin: 0 auto;
        }

        @media screen {
            body { background: #f3f4f6; }
            .print-page {
                background: #fff;
                box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                margin: 18px auto;
            }
        }

        @media print {
            /* Don't rely on CSS variables in @page: some browsers ignore var() and end up with 0 margin. */
            @page { size: A4; margin: ${pageMargins.top} ${pageMargins.right} ${pageMargins.bottom} ${pageMargins.left}; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .print-page {
                box-shadow: none !important;
                margin: 0 !important;
                /* Padding handled by @page margin in print */
                padding: 0 !important;
            }

            /* Force borders to actually render on paper/PDF */
            .print-border-bottom { border-bottom: 2pt solid #000 !important; }
            .print-border-bottom-thin { border-bottom: 1.2pt solid #000 !important; }
            .print-border-top-thick { border-top: 2pt solid #000 !important; }
        }
    `;

    // Use inline border styles so lines reliably appear on actual print output.
    // Many printers/drivers drop very thin strokes; use thicker rules.
    const headerBorderStyle = { borderBottom: '2pt solid #000' };
    const rowBorderStyle = { borderBottom: '1.2pt solid #000' };

    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp : ${company.phone}`);
    if (company.email) companyLines.push(`Email : ${company.email}`);

    const sortedDetails = [...(details ?? [])].sort((a, b) => {
        const poCompare = String(a?.no_po ?? '').localeCompare(
            String(b?.no_po ?? ''),
        );
        if (poCompare !== 0) return poCompare;
        return String(a?.material ?? '').localeCompare(String(b?.material ?? ''));
    });

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print BKP ${header?.no_bkp ?? ''}`} />
            <style>{pageStyle}</style>

            <div className="no-print mx-auto max-w-[980px] px-6 py-4 text-right">
                <button
                    type="button"
                    className="rounded-md border px-3 py-1 text-sm"
                    onClick={() => window.print()}
                >
                    Print
                </button>
            </div>

            <div className="print-page text-[12px] leading-[1.35] text-black">
                <div>
                    <div className="text-[16px] font-semibold uppercase">
                        {company.name || '-'}
                    </div>
                    {companyLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                </div>

                <div className="mt-6 text-center text-[16px] font-semibold underline">
                    BIAYA KIRIM PEMBELIAN
                </div>

                <div className="mt-5 grid grid-cols-2 gap-10">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-[150px] align-top">No.</td>
                                <td className="w-[12px] align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(header?.no_bkp)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Vendor (Ekspedisi)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(header?.Vendor_Ekspedisi)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">No. Invoice</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(header?.no_inv)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Tgl. Invoice</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatLongDate(header?.tgl_inv)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Jumlah Invoice (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.Total_Biaya)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Total Beli (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.total_beli)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Beban Biaya Kirim (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.biaya_kirim)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-[150px] align-top text-right">
                                    Total Jual (Rp.)
                                </td>
                                <td className="w-[12px] align-top">:</td>
                                <td className="w-[120px] text-right font-semibold">
                                    {formatNumber(header?.gtotal_jual)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top text-right">Margin</td>
                                <td className="align-top">:</td>
                                <td className="text-right font-semibold">
                                    {formatPercent(header?.margin)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top text-right">Tanggal</td>
                                <td className="align-top">:</td>
                                <td className="text-right font-semibold">
                                    {formatLongDate(header?.tanggal)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top text-right">Tanggal Print</td>
                                <td className="align-top">:</td>
                                <td className="text-right font-semibold">
                                    {printDate || '-'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 pt-2 print-border-top-thick">
                    <table className="w-full table-fixed border-collapse text-[11px]">
                        <thead>
                            <tr>
                                <th
                                    className="w-[28px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    No.
                                </th>
                                <th
                                    className="w-[70px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Ref. PO
                                </th>
                                <th
                                    className="w-[140px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Customer / PO Cust.
                                </th>
                                <th
                                    className="w-[150px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Franco / Vendor
                                </th>
                                <th
                                    className="px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Material / Qty
                                </th>
                                <th
                                    className="w-[70px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Modal
                                </th>
                                <th
                                    className="w-[70px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Jual
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDetails.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-2 py-4 text-center text-muted-foreground"
                                    >
                                        Tidak ada detail.
                                    </td>
                                </tr>
                            ) : (
                                sortedDetails.map((row, index) => (
                                    <tr
                                        key={`${row?.no_po ?? 'po'}-${row?.material ?? 'mat'}-${index}`}
                                        className="align-top"
                                        style={rowBorderStyle}
                                    >
                                        <td className="px-2 py-1">{index + 1}</td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.no_po)}
                                            </div>
                                            <div>{formatShortDate(row?.tgl_po)}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.customer)}
                                            </div>
                                            <div>{renderValue(row?.po_cust)}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.franco)}
                                            </div>
                                            <div>{renderValue(row?.vendor)}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.material)}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-[36px] text-right">
                                                    {renderValue(row?.qty)}
                                                </div>
                                                <div className="w-[40px]">
                                                    {renderValue(row?.unit)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <div className="font-semibold">
                                                {formatNumber(row?.harga_modal)}
                                            </div>
                                            <div>{formatNumber(row?.total_modal)}</div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <div className="font-semibold">
                                                {formatNumber(row?.harga_jual)}
                                            </div>
                                            <div>{formatNumber(row?.total_jual)}</div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 text-[12px]">
                    <div className="grid grid-cols-4 gap-10 text-center">
                        <div>
                            <div className="text-center">Dibuat Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Purchasing / Marketing
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Diketahui Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head Office Area
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Diperiksa Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head of Accounting
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Disetujui Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head Of Management
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 text-[11px] font-semibold">
                        * Berkas Terlampir / Keterangan Lainnya :
                    </div>
                </div>
            </div>
        </div>
    );
}
