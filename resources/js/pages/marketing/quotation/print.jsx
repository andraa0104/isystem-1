import { FormattedRemark } from '@/components/rich-text-editor';
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

const getCellText = (value) =>
    String(value ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

const getDetailColumnWidths = (details) => {
    if (!details || details.length === 0) {
        return ['4%', '54%', '4%', '6%', '11%', '21%'];
    }

    const remarkMetrics = details.map((detail) => {
        const raw = String(detail?.Remark ?? '');
        const cleanText = getCellText(raw);
        const lines = raw
            .split(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|\r?\n/)
            .map((line) => line.replace(/<[^>]*>/g, '').trim())
            .filter(Boolean);

        const longestLine = Math.max(0, ...lines.map((l) => l.length));

        return {
            length: cleanText.length,
            lines: lines.length,
            longestLine,
        };
    });

    const longestRemark = Math.max(0, ...remarkMetrics.map((m) => m.length));
    const maxRemarkLine = Math.max(
        0,
        ...remarkMetrics.map((m) => m.longestLine),
    );

    const descriptionLengths = details.map(
        (detail) => getCellText(detail?.Material).length,
    );
    const longestDescription = Math.max(0, ...descriptionLengths);

    const longestPrice = Math.max(
        0,
        ...details.map((detail) => formatNumber(detail?.Harga).length),
    );
    const longestUnit = Math.max(
        'Unit'.length,
        ...details.map((detail) => getCellText(detail?.Satuan).length),
    );

    // Kolom tetap: No. 4%, Qty 4%. Unit dan Price mengikuti isi data.
    const unitWidth = clamp(3 + Math.ceil(longestUnit / 4), 5, 7);
    const priceWidth = clamp(7 + Math.ceil(longestPrice / 4), 8, 14);
    const availableWidth = 100 - 4 - 4 - unitWidth - priceWidth;

    // Lebar kolom Remark diatur dinamis:
    // - Jika kosong sampai maksimal 25 karakter: diperlebar (20% - 24%) agar seimbang dan teks pendek muat 1 baris.
    // - Jika di atas 25 karakter / spesifikasi panjang: melebar dinamis proporsional (24% - 37%).
    let targetRemarkWidth = 21;
    const effectiveRemarkLen = Math.max(maxRemarkLine, Math.min(longestRemark, 35));

    if (longestRemark === 0) {
        targetRemarkWidth = 21;
    } else if (effectiveRemarkLen <= 25) {
        // Skala halus dari 21% hingga 24% untuk teks <= 25 karakter
        const ratio = effectiveRemarkLen / 25;
        targetRemarkWidth = clamp(21 + Math.round(ratio * 3), 21, 24);
    } else if (longestRemark > 150 || maxRemarkLine >= 35) {
        targetRemarkWidth = 37;
    } else {
        // Skala dari 24% hingga 37% untuk teks 26 - 35 karakter
        const ratio = (effectiveRemarkLen - 25) / (35 - 25);
        targetRemarkWidth = clamp(24 + Math.round(ratio * (37 - 24)), 24, 37);
    }

    // Pastikan Description selalu mendapatkan ruang yang cukup (minimal 35% dari availableWidth)
    const maxAllowedRemark = Math.max(21, availableWidth - 36);
    const remarkWidth = clamp(targetRemarkWidth, 21, maxAllowedRemark);
    const descriptionWidth = availableWidth - remarkWidth;

    return [
        '4%',
        `${descriptionWidth}%`,
        '4%',
        `${unitWidth}%`,
        `${priceWidth}%`,
        `${remarkWidth}%`,
    ];
};

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

    const detailColumnWidths = useMemo(
        () => getDetailColumnWidths(quotationDetails),
        [quotationDetails],
    );

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
                            {detailColumnWidths.map((width, index) => (
                                <col key={index} style={{ width }} />
                            ))}
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
                                    <td className="border-r border-black px-2 py-1 align-top break-words whitespace-pre-line">
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
                                        <FormattedRemark
                                            value={detail.Remark}
                                            className="[overflow-wrap:anywhere]"
                                        />
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
                            <tr>
                                <td>Note</td>
                                <td>: </td>
                                <td>{renderValue(quotation?.Note1)}</td>
                            </tr>
                            <tr>
                                <td>{renderValue(quotation?.Note2)}</td>
                            </tr>
                            <tr>
                                <td>{renderValue(quotation?.Note3)}</td>
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
                                <div className="inline-block min-w-[120px] text-left">
                                    Acknowledge by,
                                </div>
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
                            <td className="text-center font-semibold">
                                <div className="inline-block min-w-[120px] text-left underline">
                                    Head Office
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
