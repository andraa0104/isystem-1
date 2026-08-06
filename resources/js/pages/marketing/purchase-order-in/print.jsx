import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatDate = (value) => {
    if (!value) return '-';
    const text = String(value).trim();
    const dmy = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy) return text;
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`;
};

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) return '-';
    return new Intl.NumberFormat('id-ID', {
        useGrouping: true,
        maximumFractionDigits: 10,
    }).format(number);
};

const formatTerbilang = (value) => {
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

    const toWords = (number) => {
        if (number < 12) return units[number];
        if (number < 20) return `${units[number - 10]} belas`;
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

    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const rounded = Math.round(number);
    if (rounded === 0) return 'nol rupiah';
    return `${toWords(rounded)} rupiah`;
};

export default function PurchaseOrderInPrint({
    purchaseOrder,
    purchaseOrderDetails = [],
    customer = null,
    company = {},
}) {
    const pageStyle = `@media print {
        @page {
            size: auto;
            margin: 4mm 3mm 8mm 3mm !important;
        }
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    }`;

    const ppnInputPercent = Number(purchaseOrder?.ppn_input_percent ?? 0);
    const showDpp = ppnInputPercent === 12;
    const subtotal = Math.round(Number(purchaseOrder?.total_price ?? 0));
    const dpp = Number(purchaseOrder?.dpp ?? 0);
    const ppnAmount = Number(purchaseOrder?.ppn_amount ?? 0);
    const grandTotal = Number(purchaseOrder?.grand_total ?? 0);
    const ppnLabel = `${renderValue(purchaseOrder?.ppn_input_percent)}%`;

    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp/Fax : ${company.phone}`);
    if (company.email) companyLines.push(`Email : ${company.email}`);

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print PO In ${purchaseOrder?.kode_poin ?? ''}`} />
            <style>{pageStyle}</style>
            <div className="mx-auto flex w-full max-w-[900px] flex-col px-8 py-8 text-[12px] leading-[1.35]">
                <div className="flex items-start justify-between border-b-[2px] border-black pb-1">
                    <div className="w-2/3 pr-4">
                        <div className="text-[18px] font-bold tracking-wider text-black uppercase">
                            {company.name || '-'}
                        </div>
                        <div className="mt-1 space-y-0.5">
                            {companyLines.map((line, index) => (
                                <div
                                    key={`${line}-${index}`}
                                    className="text-[11px] text-black"
                                >
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-1/2 text-right">
                        <div className="text-[22px] font-black tracking-widest text-black uppercase">
                            PURCHASE ORDER IN
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-black">
                            {renderValue(purchaseOrder?.kode_poin)}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex w-full gap-5 text-[11px]">
                    <div className="flex-1 rounded-md border border-black p-3">
                        <div className="mb-2 font-bold uppercase underline decoration-black underline-offset-1">
                            Customer Information
                        </div>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-[90px] align-top text-black">
                                        Name
                                    </td>
                                    <td className="w-[12px] align-top text-black">
                                        :
                                    </td>
                                    <td className="align-top font-semibold text-black">
                                        {renderValue(
                                            purchaseOrder?.customer_name,
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        PIC PO Customer
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top font-semibold text-black">
                                        {renderValue(
                                            purchaseOrder?.sender_name,
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        Payment Term
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top text-black">
                                        {renderValue(
                                            purchaseOrder?.payment_term,
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        Delivery Time
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top text-black">
                                        {formatDate(
                                            purchaseOrder?.delivery_date,
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        Franco Loco
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top text-black">
                                        {renderValue(
                                            purchaseOrder?.franco_loco,
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="w-[300px] shrink-0 rounded-md border border-black p-3">
                        <div className="mb-2 font-bold uppercase underline decoration-black underline-offset-2">
                            Document Detail
                        </div>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-[90px] align-top text-black">
                                        Date PO
                                    </td>
                                    <td className="w-[12px] align-top text-black">
                                        :
                                    </td>
                                    <td className="align-top font-medium text-black">
                                        {formatDate(purchaseOrder?.date_poin)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        Customer PO
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top font-medium text-black">
                                        {renderValue(purchaseOrder?.no_poin)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top text-black">
                                        Print Date
                                    </td>
                                    <td className="align-top text-black">:</td>
                                    <td className="align-top font-medium text-black">
                                        {formatDateTime(new Date())} WITA
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-3 pb-2">
                    <table className="w-full table-auto border-collapse border border-black text-[11px]">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border-r border-b border-black px-1 py-1.5 text-center text-black">
                                    No.
                                </th>
                                <th className="w-[9%] border-r border-b border-black px-1 py-1.5 text-center text-black">
                                    Code Mat.
                                </th>
                                <th className="border-r border-b border-black px-2 py-1.5 text-center text-black">
                                    Material
                                </th>
                                <th className="border-r border-b border-black px-1 py-1.5 text-center text-black">
                                    Qty
                                </th>
                                <th className="border-r border-b border-black px-1 py-1.5 text-center text-black">
                                    Unit
                                </th>
                                <th className="border-r border-b border-black px-2 py-1.5 text-center text-black">
                                    Unit Price (Rp.)
                                </th>
                                <th className="border-r border-b border-black px-2 py-1.5 text-center text-black">
                                    Total Price (Rp.)
                                </th>
                                <th className="border-b border-black px-2 py-1.5 text-center text-black">
                                    Remark
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseOrderDetails.map((item, index) => (
                                <tr key={item.id ?? index}>
                                    <td className="border-t border-r border-black px-1 py-1.5 text-center text-black">
                                        {renderValue(index + 1)}
                                    </td>
                                    <td className="border-t border-r border-black px-1 py-1.5 text-center text-black">
                                        {renderValue(item?.kd_material)}
                                    </td>
                                    <td className="border-t border-r border-black px-2 py-1.5 text-black">
                                        {renderValue(item?.material)}
                                    </td>
                                    <td className="border-t border-r border-black px-1 py-1.5 text-center text-black">
                                        {formatNumber(item?.qty)}
                                    </td>
                                    <td className="border-t border-r border-black px-1 py-1.5 text-center text-black">
                                        {renderValue(item?.satuan)}
                                    </td>
                                    <td className="border-t border-r border-black px-2 py-1.5 text-right text-black">
                                        {formatNumber(item?.price_po_in)}
                                    </td>
                                    <td className="border-t border-r border-black px-2 py-1.5 text-right text-black">
                                        {formatNumber(item?.total_price_po_in)}
                                    </td>
                                    <td className="border-t border-black px-2 py-1.5 text-black">
                                        {renderValue(
                                            item?.tb_detailpoin_remark ??
                                                item?.remark,
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {purchaseOrderDetails.length === 0 && (
                                <tr>
                                    <td
                                        className="border-t border-black px-2 py-3 text-center text-black"
                                        colSpan={8}
                                    >
                                        Tidak ada data material
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-2 flex items-start gap-5">
                    <div className="flex-1 rounded-md border border-black bg-gray-50 p-3 text-[11px]">
                        <div className="font-bold text-black underline">
                            Terbilang :
                        </div>
                        <div className="mt-1 font-medium text-black capitalize italic">
                            # {formatTerbilang(grandTotal)} #
                        </div>
                    </div>
                    <div className="w-[300px] shrink-0 rounded-md border border-black p-3 text-[11px]">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="text-black">Sub Total</td>
                                    <td className="w-[12px] text-black">:</td>
                                    <td className="text-right font-medium text-black">
                                        {formatNumber(subtotal)}
                                    </td>
                                </tr>
                                {showDpp && (
                                    <tr>
                                        <td className="text-black">DPP</td>
                                        <td className="text-black">:</td>
                                        <td className="text-right font-medium text-black">
                                            {formatNumber(dpp)}
                                        </td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="text-black">
                                        PPN {ppnLabel}
                                    </td>
                                    <td className="text-black">:</td>
                                    <td className="text-right font-medium text-black">
                                        {formatNumber(ppnAmount)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={3} className="py-1">
                                        <div className="border-t border-black"></div>
                                    </td>
                                </tr>
                                <tr className="text-[12px] font-bold text-black">
                                    <td>Grand Total</td>
                                    <td>:</td>
                                    <td className="text-right">
                                        {formatNumber(grandTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-3 text-[11px]">
                    <div className="w-full">
                        <div className="min-h-[60px] rounded-md border border-black p-3">
                            <div className="font-bold text-black uppercase underline">
                                Note :
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-black">
                                {renderValue(purchaseOrder?.note_doc)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex items-start gap-5 text-[11px]">
                    <div className="flex-1 text-left text-black">
                        <div className="mb-20">Dibuat Oleh,</div>
                        <div className="w-[30%] border-b border-black"></div>
                        <div className="mt-1 font-bold">Marketing</div>
                    </div>
                    <div className="w-[300px] shrink-0 text-left text-black">
                        <div className="mb-20">Diketahui Oleh,</div>
                        <div className="w-[40%] border-b border-black"></div>
                        <div className="mt-1 font-bold">Head Office</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
