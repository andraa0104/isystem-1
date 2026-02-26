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

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) return '-';
    return new Intl.NumberFormat('id-ID').format(number);
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
                    PURCHASE ORDER IN
                </div>

                <table className="mt-4 w-full text-[11px]">
                    <tbody>
                        <tr>
                            <td className="w-1/2 pr-6 align-top">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[70px]">Customer</td>
                                            <td className="w-[12px]">:</td>
                                            <td className="font-semibold">{renderValue(purchaseOrder?.customer_name)}</td>
                                        </tr>
                                        <tr>
                                            <td>Alamat</td>
                                            <td>:</td>
                                            <td>{renderValue(customer?.alamat_cs)}</td>
                                        </tr>
                                        <tr>
                                            <td>Tlp</td>
                                            <td>:</td>
                                            <td>{renderValue(customer?.telp_cs)}</td>
                                        </tr>
                                        <tr>
                                            <td>Attnd.</td>
                                            <td>:</td>
                                            <td>{renderValue(customer?.Attnd)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="w-1/2 pl-6 align-top">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-[90px]">Kode PO In</td>
                                            <td className="w-[12px]">:</td>
                                            <td className="font-semibold">{renderValue(purchaseOrder?.kode_poin)}</td>
                                        </tr>
                                        <tr>
                                            <td>Date</td>
                                            <td>:</td>
                                            <td>{formatDate(purchaseOrder?.date_poin)}</td>
                                        </tr>
                                        <tr>
                                            <td>No. PO In</td>
                                            <td>:</td>
                                            <td>{renderValue(purchaseOrder?.no_poin)}</td>
                                        </tr>
                                        <tr>
                                            <td>Print Date</td>
                                            <td>:</td>
                                            <td>{formatDate(new Date())}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-6 pb-2">
                    <table className="w-full table-fixed border-collapse border border-black text-[11px]">
                        <colgroup>
                            <col className="w-[6%]" />
                            <col className="w-[14%]" />
                            <col className="w-[30%]" />
                            <col className="w-[8%]" />
                            <col className="w-[8%]" />
                            <col className="w-[13%]" />
                            <col className="w-[13%]" />
                            <col className="w-[8%]" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className="border-r border-black px-2 py-2 text-left">No.</th>
                                <th className="border-r border-black px-2 py-2 text-left">Code Mat.</th>
                                <th className="border-r border-black px-2 py-2 text-left">Material</th>
                                <th className="border-r border-black px-2 py-2 text-right">Qty</th>
                                <th className="border-r border-black px-2 py-2 text-left">Unit</th>
                                <th className="border-r border-black px-2 py-2 text-right">Unit Price</th>
                                <th className="border-r border-black px-2 py-2 text-right">Total Price</th>
                                <th className="px-2 py-2 text-left">Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseOrderDetails.map((item, index) => (
                                <tr key={item.id ?? index}>
                                    <td className="border-r border-t border-black px-2 py-2">{renderValue(item?.line_no ?? index + 1)}</td>
                                    <td className="border-r border-t border-black px-2 py-2">{renderValue(item?.kd_material)}</td>
                                    <td className="border-r border-t border-black px-2 py-2">{renderValue(item?.material)}</td>
                                    <td className="border-r border-t border-black px-2 py-2 text-right">{formatNumber(item?.qty)}</td>
                                    <td className="border-r border-t border-black px-2 py-2">{renderValue(item?.satuan)}</td>
                                    <td className="border-r border-t border-black px-2 py-2 text-right">{formatNumber(item?.price_po_in)}</td>
                                    <td className="border-r border-t border-black px-2 py-2 text-right">{formatNumber(item?.total_price_po_in)}</td>
                                    <td className="border-t border-black px-2 py-2">{renderValue(item?.tb_detailpoin_remark ?? item?.remark)}</td>
                                </tr>
                            ))}
                            {purchaseOrderDetails.length === 0 && (
                                <tr>
                                    <td className="border-t border-black px-2 py-2 text-center" colSpan={8}>
                                        Tidak ada data material
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-2 flex items-start justify-between gap-8">
                    <div className="flex-1 text-[11px]">
                        <div className="mb-1 font-semibold underline">Terbilang :</div>
                        <div className="capitalize">{formatTerbilang(grandTotal)}</div>
                    </div>
                    <table className="w-[320px] text-[11px]">
                        <tbody>
                            <tr>
                                <td>Sub Total</td>
                                <td className="w-[12px]">:</td>
                                <td className="text-right">{formatNumber(subtotal)}</td>
                            </tr>
                            {showDpp && (
                                <tr>
                                    <td>DPP</td>
                                    <td>:</td>
                                    <td className="text-right">{formatNumber(dpp)}</td>
                                </tr>
                            )}
                            <tr>
                                <td>PPN {ppnLabel}</td>
                                <td>:</td>
                                <td className="text-right">{formatNumber(ppnAmount)}</td>
                            </tr>
                            <tr className="font-semibold">
                                <td>Grand Total</td>
                                <td>:</td>
                                <td className="text-right">{formatNumber(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 border-t border-black pt-2 text-[11px]">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-1/2 align-top pr-4">
                                    <div className="font-semibold underline">Note :</div>
                                    <div>{renderValue(purchaseOrder?.note_doc)}</div>
                                </td>
                                <td className="w-1/2 align-top pl-4">
                                    <table className="w-full">
                                        <tbody>
                                            <tr>
                                                <td className="w-[100px]">Mata Uang</td>
                                                <td className="w-[12px]">:</td>
                                                <td>IDR</td>
                                            </tr>
                                            <tr>
                                                <td>NPWP</td>
                                                <td>:</td>
                                                <td>{renderValue(customer?.npwp_cs)}</td>
                                            </tr>
                                            <tr>
                                                <td>Alamat NPWP</td>
                                                <td>:</td>
                                                <td>{renderValue(customer?.npwp1_cs)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-5 text-[11px]">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-[100px]">Payment</td>
                                <td className="w-[12px]">:</td>
                                <td>{renderValue(purchaseOrder?.payment_term)}</td>
                            </tr>
                            <tr>
                                <td>Delivery Time</td>
                                <td>:</td>
                                <td>{formatDate(purchaseOrder?.delivery_date)}</td>
                            </tr>
                            <tr>
                                <td>Franco Loco</td>
                                <td>:</td>
                                <td>{renderValue(purchaseOrder?.franco_loco)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 grid grid-cols-2 text-center text-[11px]">
                    <div className="space-y-12">
                        <div>Dibuat Oleh,</div>
                        <div>Marketing </div>
                    </div>
                    <div className="space-y-12">
                        <div>Disetujui Oleh,</div>
                        <div>Head Office</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
