import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatDate = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
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

const formatStock = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return '-';
    }

    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(number);
};

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    const normalized = String(value).replace(/%/g, '').trim();
    return normalized === '' ? '-' : `${normalized}%`;
};

export default function PurchaseRequirementPrint({
    purchaseRequirement,
    purchaseRequirementDetails = [],
    company = {},
}) {
    // Print margin settings (top, right, bottom, left)
    const pageMargins = {
        top: '6mm',
        right: '3mm',
        bottom: '6mm',
        left: '3mm',
    };

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
    }
    @media print and (orientation: landscape) {
        .purchase-requirement-print {
            width: 100% !important;
            max-width: none !important;
        }
    }
    @media print and (orientation: portrait) {
        .purchase-requirement-print {
            width: 100% !important;
        }
        .purchase-requirement-print .code-material-cell {
            overflow-wrap: anywhere;
            word-break: break-word;
            font-size: 10px;
        }
        .purchase-requirement-print .material-cell {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
    }`;

    const companyLines = [];
    if (company.address) {
        companyLines.push(company.address);
    }
    if (company.kota) {
        companyLines.push(company.kota);
    }
    if (company.phone) {
        companyLines.push(`Telp./Fax. : ${company.phone}`);
    }
    if (company.email) {
        companyLines.push(`Email : ${company.email}`);
    }

    const totalQty = purchaseRequirementDetails.reduce(
        (sum, item) => sum + (Number(item.qty) || 0),
        0,
    );
    const totalPrice = purchaseRequirementDetails.reduce(
        (sum, item) => sum + (Number(item.total_price) || 0),
        0,
    );

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print PR ${purchaseRequirement?.no_pr ?? ''}`} />
            <style>{pageStyle}</style>
            <div className="purchase-requirement-print mx-auto w-full max-w-[900px] px-8 py-6 text-[12px] leading-[1.35]">
                <div className="text-[18px] font-semibold uppercase">
                    {company.name || '-'}
                </div>
                {companyLines.map((line, index) => (
                    <div
                        key={`${line}-${index}`}
                        className="text-[12px] italic"
                    >
                        {line}
                    </div>
                ))}

                <div className="mt-6 text-[13px] font-semibold underline">
                    Permintaan Pembelian
                </div>

                <table className="mt-4 w-full text-[12px]">
                    <tbody>
                        <tr>
                            <td className="w-[90px]">No PR</td>
                            <td className="w-[12px]">:</td>
                            <td>{renderValue(purchaseRequirement?.no_pr)}</td>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td>{formatDate(purchaseRequirement?.date)}</td>
                        </tr>
                        <tr>
                            <td>Payment</td>
                            <td>:</td>
                            <td>{renderValue(purchaseRequirement?.payment)}</td>
                        </tr>
                        <tr>
                            <td>For CST</td>
                            <td>:</td>
                            <td>
                                {renderValue(purchaseRequirement?.for_customer)}
                            </td>
                        </tr>
                        <tr>
                            <td>Ref PO</td>
                            <td>:</td>
                            <td>{renderValue(purchaseRequirement?.ref_po)}</td>
                        </tr>
                        <tr>
                            <td>Jenis PR</td>
                            <td>:</td>
                            <td>{renderValue(purchaseRequirement?.jenis_pr)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-4">
                    <table className="w-full table-fixed border-collapse border border-black text-[11px]">
                        <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[9%]" />
                            <col className="w-[24%]" />
                            <col className="w-[5%]" />
                            <col className="w-[5%]" />
                            <col className="w-[5%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            <col className="w-[11%]" />
                            <col className="w-[7%]" />
                            <col className="w-[8%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-black">
                                <th className="border-r border-black px-1 py-1 text-center">
                                    NO
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Code Mat.
                                </th>
                                <th className="border-r border-black px-2 py-1 text-center">
                                    Material
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Qty
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Unit
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Stok
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Unit Price
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Total Price
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Price PO In
                                </th>
                                <th className="border-r border-black px-1 py-1 text-center">
                                    Margin
                                </th>
                                <th className="px-1 py-1 text-center">
                                    Remark
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseRequirementDetails.length === 0 && (
                                <tr className="border-t border-black">
                                    <td
                                        className="px-2 py-2 text-center"
                                        colSpan={11}
                                    >
                                        Tidak ada detail PR.
                                    </td>
                                </tr>
                            )}
                            {purchaseRequirementDetails.map((detail, index) => (
                                <tr
                                    key={`${detail.no ?? index}`}
                                    className="border-t border-black"
                                >
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {detail.no ?? index + 1}
                                    </td>
                                    <td className="code-material-cell border-r border-black px-1 py-1 align-top">
                                        {renderValue(detail.kd_material)}
                                    </td>
                                    <td className="material-cell border-r border-black px-2 py-1 align-top">
                                        {renderValue(detail.material)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {renderValue(detail.qty)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {renderValue(detail.unit)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top">
                                        {formatStock(detail.stok)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-right align-top">
                                        Rp {formatNumber(detail.unit_price)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-right align-top">
                                        Rp. {formatNumber(detail.total_price)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-right align-top">
                                        Rp. {formatNumber(detail.price_po)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center align-top break-all">
                                        {formatPercent(detail.margin)}
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        {renderValue(detail.renmark)}
                                    </td>
                                </tr>
                            ))}
                            {purchaseRequirementDetails.length > 0 && (
                                <tr className="border-t border-black">
                                    <td
                                        className="border-r border-black px-1 py-1 text-center"
                                        colSpan={3}
                                    >
                                        Total
                                    </td>
                                    <td className="border-r border-black px-1 py-1 text-center">
                                        {formatNumber(totalQty)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1" />
                                    <td className="border-r border-black px-1 py-1" />
                                    <td className="border-r border-black px-1 py-1" />
                                    <td className="border-r border-black px-1 py-1 text-right">
                                        Rp. {formatNumber(totalPrice)}
                                    </td>
                                    <td className="border-r border-black px-1 py-1" />
                                    <td className="border-r border-black px-1 py-1" />
                                    <td className="px-1 py-1" />
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 grid grid-cols-3 text-[12px]">
                    <div>Diminta Oleh,</div>
                    <div className="text-center">Disetujui Oleh,</div>
                    <div className="w-[90px] justify-self-end text-left">
                        Diketahui Oleh,
                    </div>
                </div>
                <div className="mt-16 grid grid-cols-3 text-[12px]">
                    <div>Marketing Office</div>
                    <div className="text-center">Head Office</div>
                    <div className="w-[90px] justify-self-end text-left">
                        Direksi
                    </div>
                </div>
            </div>
        </div>
    );
}
