import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

export default function TandaTerimaInvoicePrint({
    header,
    items = [],
    grandTotal = 0,
    company = {},
}) {
    const printMarginTop = '0.2in';
    const printMarginRight = '0.4in';
    const printMarginBottom = '0.4in';
    const printMarginLeft = '0.4in';

    const companyLines = [];
    if (company.address) {
        companyLines.push(company.address);
    }
    if (company.kota) {
        companyLines.push(company.kota);
    }
    if (company.phone) {
        companyLines.push(`Telp : ${company.phone}`);
    }
    if (company.email) {
        companyLines.push(`Email : ${company.email}`);
    }

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print Tanda Terima ${header?.no_ttinv ?? ''}`} />
            <style>{`
                @page { size: 9.5in 11in; margin: ${printMarginTop} ${printMarginRight} ${printMarginBottom} ${printMarginLeft}; }
                @media print {
                    * { -webkit-print-color-adjust: economy; print-color-adjust: economy; }
                    body { font-family: "Courier New", Courier, monospace; }
                    table { border-collapse: collapse !important; }
                }
                table.ttinv th,
                table.ttinv td {
                    border: 1px solid #000;
                }
                table.ttinv tbody td {
                    border-top: 0 !important;
                    border-bottom: 0 !important;
                }
                table.ttinv tbody tr.data-row td {
                    border-bottom: 1px dashed #000 !important;
                }
                table.ttinv tbody tr.grand-total-row td {
                    border-top: 1px solid #000 !important;
                    border-bottom: 0 !important;
                    height: 8px;
                }
                table.ttinv tbody tr.grand-total-value-row td {
                    border-top: 0 !important;
                    border-bottom: 1px solid #000 !important;
                }
                table.ttinv tbody tr.grand-total-row td:nth-child(5),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(5) {
                    border-right: 0 !important;
                }
                table.ttinv tbody tr.grand-total-row td:nth-child(6),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(6) {
                    border-left: 0 !important;
                }
                table.ttinv tbody tr.grand-total-row td:nth-child(2),
                table.ttinv tbody tr.grand-total-row td:nth-child(3),
                table.ttinv tbody tr.grand-total-row td:nth-child(4),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(2),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(3),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(4) {
                    border-left: 0 !important;
                    border-right: 0 !important;
                }
                table.ttinv tbody tr.grand-total-row td:nth-child(5),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(5) {
                    border-left: 0 !important;
                    border-right: 0 !important;
                }
                table.ttinv tbody tr.grand-total-row td:nth-child(1),
                table.ttinv tbody tr.grand-total-value-row td:nth-child(1) {
                    border-right: 0 !important;
                }
                table.ttinv tbody tr.spacer-row td {
                    border-top: 0;
                    border-bottom: 0;
                    height: 24px;
                }
            `}</style>
            <div className="mx-auto w-full max-w-[900px] p-8 text-[12px] leading-tight">
                <div className="text-[12px]">
                    <div className="text-[20px] font-semibold uppercase">
                        {company.name || '-'}
                    </div>
                    {companyLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                </div>

                <div className="mt-4 text-center text-[18px] font-semibold underline">
                    TANDA TERIMA INVOICE
                </div>

                <div className="mt-4 text-[12px]">
                    <div className="grid grid-cols-[40px_12px_1fr] items-start gap-2">
                        <span>No.</span>
                        <span className="text-center">:</span>
                        <span className="font-semibold">
                            {renderValue(header?.no_ttinv)}
                        </span>
                    </div>
                    <div className="grid grid-cols-[40px_12px_1fr] items-start gap-2">
                        <span>Date.</span>
                        <span className="text-center">:</span>
                        <span>{renderValue(header?.tgl_doc)}</span>
                    </div>
                </div>

                <table className="ttinv mt-4 w-full text-[11px]">
                    <thead>
                        <tr>
                            <th className="px-2 py-1 text-center">No.</th>
                            <th className="px-2 py-1">No. Invoice</th>
                            <th className="px-2 py-1">No Faktur Pajak</th>
                            <th className="px-2 py-1">Tgl. Inv</th>
                            <th className="px-2 py-1">Customer</th>
                            <th className="px-2 py-1">Ref. PO</th>
                            <th className="px-2 py-1 text-right">Total (Rp.)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr>
                                <td className="px-2 py-2" colSpan={7}>
                                    Tidak ada data.
                                </td>
                            </tr>
                        )}
                        {items.map((item, index) => (
                            <tr
                                key={`${item.no_inv}-${index}`}
                                className={
                                    index === items.length - 1
                                        ? 'last-row'
                                        : 'data-row'
                                }
                            >
                                <td className="px-2 py-1 text-center">
                                    {index + 1}
                                </td>
                                <td className="px-2 py-1">
                                    {renderValue(item.no_inv)}
                                </td>
                                <td className="px-2 py-1">
                                    {renderValue(item.no_faktur)}
                                </td>
                                <td className="px-2 py-1">
                                    {renderValue(item.tgl)}
                                </td>
                                <td className="px-2 py-1">
                                    {renderValue(item.nm_cs)}
                                </td>
                                <td className="px-2 py-1">
                                    {renderValue(item.ref_po)}
                                </td>
                                <td className="px-2 py-1 text-right">
                                    {formatNumber(item.total)}
                                </td>
                            </tr>
                        ))}
                        {items.length > 0 && (
                            <tr className="spacer-row">
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        )}
                        <tr className="grand-total-row">
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr className="grand-total-value-row">
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="no-divider"></td>
                            <td className="gt-label px-2 py-2 text-right font-semibold">
                                Grand Total
                            </td>
                            <td className="px-2 py-2 text-right font-semibold">
                                Rp. {formatNumber(grandTotal)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-6 grid grid-cols-2 gap-6 text-[11px]">
                    <div>
                        <div>Diserahkan Oleh,</div>
                        <div className="mt-12">______________________</div>
                    </div>
                    <div>
                        <div>Diterima Oleh,</div>
                        <div className="mt-12">______________________</div>
                        <div className="mt-2">Tgl.</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
