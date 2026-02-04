import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatDate = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value; // fallback if already string or invalid
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
};

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '-';
    }
    return new Intl.NumberFormat('id-ID').format(number);
};

export default function DeliveryOrderPrint({
    deliveryOrder,
    deliveryOrderDetails = [],
    customerAddress = '',
    company = {},
}) {
    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp : ${company.phone}`);
    if (company.email) companyLines.push(`Email : ${company.email}`);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print DO ${deliveryOrder?.no_do ?? ''}`} />

            <div className="print-container mx-auto w-full max-w-[900px] text-[12px] leading-tight">
                <div className="flex items-start justify-between gap-2">
                    <div className="w-[60%]">
                        <div className="text-[20px] font-bold uppercase">
                            {renderValue(company.name)}
                        </div>
                        {companyLines.map((line, idx) => (
                            <div key={idx} className="capitalize">
                                {line}
                            </div>
                        ))}
                    </div>
                    <div className="delivery-to box-border w-[40%] border border-black px-2 py-1">
                        <div className="mb-1 underline">Delivery To :</div>
                        <div className="mb-1 font-bold uppercase">
                            {renderValue(deliveryOrder?.nm_cs)}
                        </div>
                        <div className="uppercase">
                            {renderValue(customerAddress)}
                        </div>
                    </div>
                </div>

                <div className="my-3 text-center text-[20px] font-extrabold tracking-[0.2em]">
                    DELIVERY ORDER
                </div>

                <div className="mb-3">
                    <table className="no-border w-auto text-[12px]">
                        <tbody>
                            <tr>
                                <td className="w-[80px]">No. DO</td>
                                <td className="w-[10px]">:</td>
                                <td>{renderValue(deliveryOrder?.no_do)}</td>
                            </tr>
                            <tr>
                                <td>Date</td>
                                <td>:</td>
                                <td>{formatDate(deliveryOrder?.date)}</td>
                            </tr>
                            <tr>
                                <td>Ref. PO</td>
                                <td>:</td>
                                <td>{renderValue(deliveryOrder?.ref_po)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="border border-black">
                    <table className="no-row-lines w-full border-collapse text-[12px]">
                        <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[10%]" />
                            <col className="w-[50%]" />
                            <col className="w-[30.9%]" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className="border-r border-b border-black py-[2px] text-center leading-tight font-normal">
                                    No.
                                </th>
                                <th className="border-r border-b border-black py-[2px] text-center leading-tight font-normal">
                                    Quantity
                                </th>
                                <th className="border-r border-b border-black py-[2px] text-center leading-tight font-normal">
                                    Description
                                </th>
                                <th className="border-b border-black py-[2px] text-center leading-tight font-normal">
                                    Remark
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveryOrderDetails.map((item, index) => {
                                const isLast =
                                    index === deliveryOrderDetails.length - 1;
                                const cellClass = 'border-r border-black';
                                const lastCellClass = '';

                                return (
                                    <tr key={index} className="align-top">
                                        <td
                                            className={`${cellClass} py-[2px] text-center leading-tight`}
                                        >
                                            {index + 1}
                                        </td>
                                        <td
                                            className={`${cellClass} px-2 py-[2px] text-right leading-tight`}
                                        >
                                            {formatNumber(item.qty)}{' '}
                                            {renderValue(item.unit)}
                                        </td>
                                        <td
                                            className={`${cellClass} py-[2px] pl-2 leading-tight`}
                                        >
                                            {renderValue(item.mat)}
                                        </td>
                                        <td
                                            className={`${lastCellClass} py-[2px] pl-2 leading-tight`}
                                        >
                                            {renderValue(item.remark)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {deliveryOrderDetails.length === 0 && (
                                <tr>
                                    <td
                                        className="border-t border-black py-2 text-center"
                                        colSpan={4}
                                    >
                                        Tidak ada detail DO.
                                    </td>
                                </tr>
                            )}
                            {deliveryOrderDetails.length > 0 && (
                                <tr className="h-[20px]">
                                    <td className="border-r border-black">
                                        &nbsp;
                                    </td>
                                    <td className="border-r border-black">
                                        &nbsp;
                                    </td>
                                    <td className="border-r border-black">
                                        &nbsp;
                                    </td>
                                    <td>&nbsp;</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 border-x border-b border-black">
                    <table className="w-full border-collapse text-[11px]">
                        <colgroup>
                            <col className="w-[20%]" />
                            <col className="w-[20%]" />
                            <col className="w-[20%]" />
                            <col className="w-[29%]" />
                        </colgroup>
                        <tbody>
                            <tr>
                                <td className="border-r border-black py-1 text-center">
                                    Created By,
                                </td>
                                <td className="border-r border-black py-1 text-center">
                                    Check By,
                                </td>
                                <td className="border-r border-black py-1 text-center">
                                    Carried By,
                                </td>
                                <td className="py-1 text-center">
                                    Received By,
                                </td>
                            </tr>
                            <tr>
                                <td className="h-[60px] border-r border-black" />
                                <td className="h-[60px] border-r border-black" />
                                <td className="h-[60px] border-r border-black" />
                                <td className="h-[60px]" />
                            </tr>
                            <tr>
                                <td className="border-t border-r border-black py-1 text-center">
                                    &nbsp;
                                </td>
                                <td className="border-t border-r border-black py-1 text-center">
                                    &nbsp;
                                </td>
                                <td className="border-t border-r border-black py-1 text-center">
                                    &nbsp;
                                </td>
                                <td className="border-t border-black py-1 text-center font-semibold uppercase">
                                    {renderValue(deliveryOrder?.nm_cs)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        size: 8.5in 5.4in landscape;
                        /*
                         * Epson LX usually has a fairly large non-printable area,
                         * especially on the right/top edge. Use a larger margin
                         * to avoid clipped borders.
                         */
                        margin: 10mm 14mm 14mm 10mm;
                    }
                    * {
                        -webkit-print-color-adjust: economy;
                        print-color-adjust: economy;
                    }
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #000 !important;
                    }
                    html, body, * {
                        /*
                         * Prefer sharper printer-style monospace fonts if available.
                         * These may not exist on all machines; we keep safe fallbacks.
                         */
                        font-family:
                            "OCR A Extended",
                            "OCRA",
                            "Letter Gothic",
                            "Courier 10 Pitch",
                            "Nimbus Mono L",
                            "Courier New",
                            "Lucida Console",
                            Consolas,
                            monospace !important;
                    }
                    body {
                        /* Slightly larger + heavier improves legibility on Epson LX. */
                        font-size: 12pt !important;
                        line-height: 1.2 !important;
                        /* Avoid dot-matrix "bleeding" while staying readable. */
                        font-weight: 400 !important;
                        letter-spacing: 0 !important;
                        -webkit-font-smoothing: none;
                        text-rendering: optimizeSpeed;
                    }
                    .print-container {
                        max-width: none !important;
                        /*
                         * Keep some breathing room inside the page margin
                         * so the right-most border doesn't get clipped.
                         */
                        width: 100% !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    .delivery-to {
                        border: 1px solid #000 !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        border: 1px solid #000 !important;
                        width: 100% !important;
                    }
                    th, td {
                        border: 1px solid #000 !important;
                        font-weight: 700 !important;
                    }
                    table.no-border,
                    table.no-border th,
                    table.no-border td {
                        border: none !important;
                    }
                    table.no-row-lines tbody td {
                        border-top: 0 !important;
                        border-bottom: 0 !important;
                    }
                    table.no-row-lines thead th {
                        border-top: 0 !important;
                        border-bottom: 2px solid #000 !important;
                    }
                }
            `}</style>
        </div>
    );
}
