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

const toWords = (number) => {
    const units = [
        '',
        'satu',
        'dua',
        'tiga',
        'empat',
        'lima',
        'enam',
        'tujuh',
        'delapan',
        'sembilan',
        'sepuluh',
        'sebelas',
    ];

    if (number < 12) {
        return units[number];
    }
    if (number < 20) {
        return `${units[number - 10]} belas`;
    }
    if (number < 100) {
        const tens = Math.floor(number / 10);
        const rest = number % 10;
        return `${units[tens]} puluh${rest ? ` ${toWords(rest)}` : ''}`;
    }
    if (number < 200) {
        return `seratus${number % 100 ? ` ${toWords(number - 100)}` : ''}`;
    }
    if (number < 1000) {
        const hundreds = Math.floor(number / 100);
        const rest = number % 100;
        return `${units[hundreds]} ratus${rest ? ` ${toWords(rest)}` : ''}`;
    }
    if (number < 2000) {
        return `seribu${number % 1000 ? ` ${toWords(number - 1000)}` : ''}`;
    }
    if (number < 1000000) {
        const thousands = Math.floor(number / 1000);
        const rest = number % 1000;
        return `${toWords(thousands)} ribu${rest ? ` ${toWords(rest)}` : ''}`;
    }
    if (number < 1000000000) {
        const millions = Math.floor(number / 1000000);
        const rest = number % 1000000;
        return `${toWords(millions)} juta${rest ? ` ${toWords(rest)}` : ''}`;
    }
    if (number < 1000000000000) {
        const billions = Math.floor(number / 1000000000);
        const rest = number % 1000000000;
        return `${toWords(billions)} miliar${rest ? ` ${toWords(rest)}` : ''}`;
    }
    return String(number);
};

const formatTerbilang = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return '-';
    }
    const rounded = Math.round(number);
    if (rounded === 0) {
        return 'nol rupiah';
    }
    return `${toWords(rounded)} rupiah`;
};

const getValue = (source, keys) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
    }
    return '-';
};

export default function PurchaseOrderPrint({
    purchaseOrder,
    purchaseOrderDetails = [],
    company = {},
}) {
    const companyLines = [];
    if (company.address) {
        companyLines.push(company.address);
    }
    if (company.kota) {
        companyLines.push(company.kota);
    }
    if (company.phone) {
        companyLines.push(`Telp/Fax : ${company.phone}`);
    }
    if (company.email) {
        companyLines.push(`Email : ${company.email}`);
    }

    const detail = purchaseOrderDetails[0] ?? {};
    const ppnLabel = purchaseOrder?.ppn
        ? `PPN ${purchaseOrder.ppn}`
        : 'PPN';
    const terbilang = formatTerbilang(purchaseOrder?.g_total);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print PO ${purchaseOrder?.no_po ?? ''}`} />
            <div className="mx-auto flex min-h-screen w-full max-w-[900px] flex-col px-8 py-8 text-[12px] leading-[1.35]">
                <div className="text-[16px] font-semibold uppercase">
                    {company.name || '-'}
                </div>
                {companyLines.map((line, index) => (
                    <div key={`${line}-${index}`} className="text-[12px]">
                        {line}
                    </div>
                ))}

                <div className="mt-6 text-center text-[18px] font-semibold">
                    PURCHASE ORDER
                </div>

                <table className="mt-4 w-full text-[11px]">
                    <tbody>
                        <tr>
                            <td className="w-1/2 align-top pr-6">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[70px]">Kepada</td>
                                            <td className="w-[12px]">:</td>
                                            <td className="font-semibold">
                                                {renderValue(purchaseOrder?.nm_vdr)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Alamat</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.almt_vdr)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Telp.</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.telp_vdr)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Email</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.eml_vdr)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Attn.</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.attn_vdr)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="w-1/2 align-top pl-6">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[90px]">No. PO</td>
                                            <td className="w-[12px]">:</td>
                                            <td className="font-semibold">
                                                {renderValue(purchaseOrder?.no_po)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Date</td>
                                            <td>:</td>
                                            <td>{formatDate(purchaseOrder?.tgl)}</td>
                                        </tr>
                                        <tr>
                                            <td>No. PR</td>
                                            <td>:</td>
                                            <td>{renderValue(purchaseOrder?.ref_pr)}</td>
                                        </tr>
                                        <tr>
                                            <td>Print Date</td>
                                            <td>:</td>
                                            <td>{formatDate(new Date())}</td>
                                        </tr>
                                        <tr>
                                            <td>Ref. Quota</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.ref_quota)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-6 border-b border-black pb-2">
                    <table className="w-full table-fixed border-collapse border border-black text-[11px]">
                        <colgroup>
                            <col className="w-[6%]" />
                            <col className="w-[14%]" />
                            <col className="w-[36%]" />
                            <col className="w-[8%]" />
                            <col className="w-[8%]" />
                            <col className="w-[14%]" />
                            <col className="w-[14%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-black">
                                <th className="border-r border-black px-2 py-2 text-left">
                                    No.
                                </th>
                                <th className="border-r border-black px-2 py-2 text-left">
                                    Code Mat.
                                </th>
                                <th className="border-r border-black px-2 py-2 text-left">
                                    Material
                                </th>
                                <th className="border-r border-black px-2 py-2 text-right">
                                    Qty
                                </th>
                                <th className="border-r border-black px-2 py-2 text-left">
                                    Unit
                                </th>
                                <th className="border-r border-black px-2 py-2 text-right">
                                    Unit Price
                                </th>
                                <th className="px-2 py-2 text-right">
                                    Total Price
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseOrderDetails.length === 0 && (
                                <tr className="border-t border-black">
                                    <td
                                        className="px-2 py-2 text-center"
                                        colSpan={7}
                                    >
                                        Tidak ada detail PO.
                                    </td>
                                </tr>
                            )}
                            {purchaseOrderDetails.map((row, index) => (
                                <tr
                                    key={`${row.no ?? index}`}
                                    className="border-t border-black"
                                >
                                    <td className="border-r border-black px-2 py-2">
                                        {renderValue(row.no ?? index + 1)}
                                    </td>
                                    <td className="border-r border-black px-2 py-2">
                                        {getValue(row, ['kd_material', 'kd_mat'])}
                                    </td>
                                    <td className="border-r border-black px-2 py-2">
                                        {renderValue(row.material)}
                                    </td>
                                    <td className="border-r border-black px-2 py-2 text-right">
                                        {renderValue(row.qty)}
                                    </td>
                                    <td className="border-r border-black px-2 py-2">
                                        {renderValue(row.unit)}
                                    </td>
                                    <td className="border-r border-black px-2 py-2 text-right">
                                        {formatNumber(row.price)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        {formatNumber(row.total_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 border-t border-black pt-3 text-[11px]">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-1/2 align-top pr-6">
                                    <div className="font-semibold underline">
                                        Terbilang :
                                    </div>
                                    <div className="mt-1 capitalize">
                                        {terbilang}
                                    </div>
                                </td>
                                <td className="w-1/2 align-top pl-6">
                                    <table className="w-full">
                                        <tbody>
                                            <tr>
                                                <td className="w-[90px]">
                                                    Sub Total
                                                </td>
                                                <td className="w-[12px]">:</td>
                                                <td className="text-right">
                                                    {formatNumber(
                                                        purchaseOrder?.s_total
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>{ppnLabel}</td>
                                                <td>:</td>
                                                <td className="text-right">
                                                    {formatNumber(
                                                        purchaseOrder?.h_ppn
                                                    )}
                                                </td>
                                            </tr>
                                            <tr className="font-semibold">
                                                <td>Grand Total</td>
                                                <td>:</td>
                                                <td className="text-right">
                                                    {formatNumber(
                                                        purchaseOrder?.g_total
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="mt-2 border-b border-black" />
                </div>

                <table className="mt-4 w-full text-[11px]">
                    <tbody>
                        <tr>
                            <td className="w-1/2 align-top pr-6">
                                <div className="font-semibold underline">Note :</div>
                                <div className="mt-2 space-y-1">
                                    <div>{renderValue(detail?.ket1)}</div>
                                    <div>{renderValue(detail?.ket2)}</div>
                                    <div>{renderValue(detail?.ket3)}</div>
                                    <div>{renderValue(detail?.ket4)}</div>
                                </div>
                            </td>
                            <td className="w-1/2 align-top pl-6">
                                <div>Mata Uang : IDR</div>
                                <table className="mt-2 w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[90px]">NPWP</td>
                                            <td className="w-[12px]">:</td>
                                            <td>
                                                {renderValue(purchaseOrder?.npwp_vdr)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Alamat NPWP</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(
                                                    purchaseOrder?.almt_vdr
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className="mt-4 w-full text-[11px]">
                    <tbody>
                        <tr>
                            <td className="w-1/2 align-top pr-6">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[90px]">Payment</td>
                                            <td className="w-[12px]">:</td>
                                            <td>
                                                {renderValue(detail?.payment_terms)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Delivery Time</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(detail?.del_time)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Franco Loco</td>
                                            <td>:</td>
                                            <td>
                                                {renderValue(detail?.franco_loco)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="w-1/2" />
                        </tr>
                    </tbody>
                </table>

                <div className="mt-12 grid grid-cols-2 text-center text-[11px]">
                    <div className="space-y-12">
                        <div>Dibuat Oleh,</div>
                        <div>Purchasing</div>
                    </div>
                    <div className="space-y-12">
                        <div>Disetujui Oleh,</div>
                        <div>Head Office</div>
                    </div>
                </div>

                <footer className="mt-auto pt-16 text-[11px]">
                    <div className="border-t border-black pt-3">
                        <div className="grid grid-cols-[80px_12px_1fr] gap-2">
                            <span>For Customer</span>
                            <span>:</span>
                            <span>{renderValue(purchaseOrder?.for_cus)}</span>
                        </div>
                        <div className="grid grid-cols-[80px_12px_1fr] gap-2">
                            <span>Ref PO</span>
                            <span>:</span>
                            <span>{renderValue(purchaseOrder?.pr_ref_po)}</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
