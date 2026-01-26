import { Head } from '@inertiajs/react';
import { useMemo } from 'react';

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '-';
    }

    return new Intl.NumberFormat('id-ID').format(number);
};

const formatDate = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];

    const day = String(date.getDate()).padStart(2, '0');
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

export default function QuotationPrint({
    quotation,
    quotationDetails = [],
    company = {},
}) {
    // Print margin settings (top, right, bottom, left)
    const pageMargins = {
        top: '6mm',
        right: '3mm',
        bottom: '3mm',
        left: '6mm',
    };

    // Force margins in print (align with PR print)
    const pageStyle = `@media print {
        @page {
            size: auto;
            margin: ${pageMargins.top} ${pageMargins.right} ${pageMargins.bottom} ${pageMargins.left} !important;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
        }
    }`;

    const companyLines = useMemo(() => {
        const lines = [];
        if (company.address) {
            lines.push(company.address);
        }
        if (company.kota) {
            lines.push(company.kota);
        }
        if (company.phone) {
            lines.push(`Telp./Fax. : ${company.phone}`);
        }
        if (company.email) {
            lines.push(`Email : ${company.email}`);
        }
        return lines;
    }, [company.address, company.kota, company.email, company.phone]);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print Quotation ${quotation?.No_penawaran ?? ''}`} />
            <style>{pageStyle}</style>
            <div className="mx-auto w-full max-w-[820px] px-8 py-6 font-['Times_New_Roman'] text-[11px] leading-[1.25]">
                <div className="space-y-0.5">
                    <div className="text-[20px] font-semibold uppercase">
                        {company.name || '-'}
                    </div>
                    {companyLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                </div>

                <div className="mt-3 text-[14px] font-semibold italic underline">
                    Sales Quotation No. {renderValue(quotation?.No_penawaran)}
                </div>

                <table className="mt-4 w-full text-[12px]">
                    <tbody>
                        <tr>
                            <td className="w-[90px] align-top">To</td>
                            <td className="w-[12px] align-top">: </td>
                            <td className="align-top font-semibold">
                                {renderValue(quotation?.Customer)}
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td />
                            <td className="leading-snug whitespace-pre-line">
                                {renderValue(quotation?.Alamat)}
                            </td>
                        </tr>
                        <tr>
                            <td>Telp.</td>
                            <td>: </td>
                            <td>{renderValue(quotation?.Telp)}</td>
                        </tr>
                        <tr>
                            <td>Email</td>
                            <td>: </td>
                            <td>{renderValue(quotation?.Email)}</td>
                        </tr>
                        <tr>
                            <td>Attn</td>
                            <td>: </td>
                            <td>{renderValue(quotation?.Attend)}</td>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>: </td>
                            <td>{formatDate(quotation?.Tgl_penawaran)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-3">
                    <table className="w-full table-fixed border-collapse border border-black text-[11px]">
                        <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[40%]" />
                            <col className="w-[5%]" />
                            <col className="w-[6%]" />
                            <col className="w-[10%]" />
                            <col className="w-[19%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-black">
                                <th className="border-r border-black px-1 py-1 text-center">
                                    No.
                                </th>
                                <th className="border-r border-black px-2 py-1 text-center">
                                    Description
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Qty
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Unit
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Price (Idr)
                                </th>
                                <th className="px-1 py-1 text-center">
                                    Remark
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotationDetails.length === 0 && (
                                <tr className="border-t border-black">
                                    <td
                                        className="px-2 py-2 text-center"
                                        colSpan={6}
                                    >
                                        Tidak ada detail penawaran.
                                    </td>
                                </tr>
                            )}
                            {quotationDetails.map((detail, index) => (
                                <tr
                                    key={`${detail.No_penawaran}-${detail.ID ?? index}`}
                                    className="border-t border-black"
                                >
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {index + 1}
                                    </td>
                                    <td className="border-r border-black px-2 py-1 align-top">
                                        {renderValue(detail.Material)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {renderValue(detail.Qty)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {renderValue(detail.Satuan)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-right align-top">
                                        {formatNumber(detail.Harga)}
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        {renderValue(detail.Remark)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-2 text-[12px]">
                    <div className="text-[14px] font-semibold italic underline">
                        Note &gt;&gt;&gt;&gt;&gt;
                    </div>
                    <table className="mt-1 w-full">
                        <tbody>
                            <tr>
                                <td className="w-[160px] align-top">
                                    Payment Terms
                                </td>
                                <td className="w-[12px] align-top">: </td>
                                <td>{renderValue(quotation?.Payment)}</td>
                            </tr>
                            <tr>
                                <td>Validity</td>
                                <td>: </td>
                                <td>{renderValue(quotation?.Validity)}</td>
                            </tr>
                            <tr>
                                <td>Delivery Time</td>
                                <td>: </td>
                                <td>{renderValue(quotation?.Delivery)}</td>
                            </tr>
                            <tr>
                                <td>Franco/Loco</td>
                                <td>: </td>
                                <td>{renderValue(quotation?.Franco)}</td>
                            </tr>
                            <tr>
                                <td>Detail @ Price</td>
                                <td>: </td>
                                <td>
                                    Harga belum termasuk PPn 11% dan Harga
                                    sewaktu-waktu dapat berubah (Tidak Mengikat)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-3 text-[12px]">
                    <p>
                        Demikian penawaran harga ini kami sampaikan sesuai
                        permintaan Bapak/Ibu. Besar harapan kami penawaran ini
                        dapat diterima.
                    </p>
                    <p>
                        Atas kepercayaan dan kerjasamanya, kami ucapkan terima
                        kasih.
                    </p>
                </div>

                <table className="mt-6 w-full text-[12px]">
                    <tbody>
                        <tr>
                            <td className="w-1/2 align-top">Best Regards,</td>
                            <td className="w-1/2 text-center align-top">
                                Acknowledge by,
                            </td>
                        </tr>
                        <tr>
                            <td className="h-12" />
                            <td className="h-12" />
                        </tr>
                        <tr>
                            <td className="text font-semibold underline">
                                Marketing Office
                            </td>
                            <td className="text text-center font-semibold underline">
                                Head Office
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
