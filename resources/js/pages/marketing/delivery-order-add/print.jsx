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

export default function DeliveryOrderAddPrint({
    deliveryOrder,
    deliveryOrderDetails = [],
    customerAddress = '',
    company = {},
    grandTotal = 0,
}) {
    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp : ${company.phone}`);

    return (
        <div className="min-h-screen bg-white font-sans text-black">
            <Head title={`Print DOB ${deliveryOrder?.no_dob ?? ''}`} />

            <div className="mx-auto w-full max-w-[900px] p-8 text-[12px] leading-tight">
                <div className="flex items-start justify-between">
                    <div className="w-[60%]">
                        <div className="mb-1 text-[20px] font-extrabold uppercase">
                            {company.name || 'CV. SEMESTA JAYA ABADI'}
                        </div>
                        {companyLines.map((line, idx) => (
                            <div key={idx} className="capitalize">
                                {line}
                            </div>
                        ))}
                    </div>

                    <div className="w-[40%] border border-black p-2">
                        <div className="mb-1 underline">Delivery To :</div>
                        <div className="mb-1 font-bold uppercase">
                            {renderValue(deliveryOrder?.nm_cs)}
                        </div>
                        <div className="uppercase">
                            {renderValue(customerAddress)}
                        </div>
                    </div>
                </div>

                <div className="my-4 text-center text-[16px] font-bold tracking-widest uppercase">
                    Delivery Order Bantu
                </div>

                <div className="mb-4">
                    <table className="no-border w-auto">
                        <tbody>
                            <tr>
                                <td className="w-[80px]">No. DOB</td>
                                <td className="w-[10px]">:</td>
                                <td>{renderValue(deliveryOrder?.no_dob)}</td>
                            </tr>
                            <tr>
                                <td>Date</td>
                                <td>:</td>
                                <td>{formatDate(deliveryOrder?.date)}</td>
                            </tr>
                            <tr>
                                <td>Ref. DO</td>
                                <td>:</td>
                                <td>{renderValue(deliveryOrder?.ref_do)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mb-4">
                    <table className="w-full border-collapse border border-black no-row-lines">
                        <colgroup>
                            <col className="w-[50px]" />
                            <col className="w-[80px]" />
                            <col />
                            <col className="w-[100px]" />
                            <col className="w-[120px]" />
                            <col className="w-[150px]" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className="border border-black py-1 text-center">
                                    No.
                                </th>
                                <th className="border border-black py-1 pr-2 text-right">
                                    Quantity
                                </th>
                                <th className="border border-black py-1 text-center">
                                    Description
                                </th>
                                <th className="border border-black py-1 text-center">
                                    Price
                                </th>
                                <th className="border border-black py-1 text-center">
                                    Total
                                </th>
                                <th className="border border-black py-1 text-center">
                                    Remark
                                </th>
                            </tr>
                        </thead>
                        <tbody className="align-top">
                            {deliveryOrderDetails.map((item, index) => {
                                const cellClass = 'border-x border-black py-2';
                                const cellClassRight =
                                    'border-x border-black py-2 pr-2 text-right';
                                const cellClassLeft =
                                    'border-x border-black py-2 pl-2';

                                return (
                                    <tr key={index} className="align-top">
                                    <td className={`${cellClass} text-center`}>
                                        {index + 1}
                                    </td>
                                    <td className={cellClassRight}>
                                        {formatNumber(item.qty)} {item.unit}
                                    </td>
                                    <td className={cellClassLeft}>
                                        {renderValue(item.mat)}
                                    </td>
                                    <td className={cellClassRight}>
                                        {formatNumber(item.harga)}
                                    </td>
                                    <td className={cellClassRight}>
                                        {formatNumber(item.total)}
                                    </td>
                                    <td className={cellClassLeft}>
                                        {renderValue(item.remark)}
                                    </td>
                                </tr>
                                );
                            })}
                            {deliveryOrderDetails.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="border border-black py-6 text-center"
                                    >
                                        -
                                    </td>
                                </tr>
                            )}
                            <tr className="align-top">
                                {Array.from({ length: 6 }).map((_, idx) => (
                                    <td
                                        key={idx}
                                        className="border-x border-black !border-b-0 h-[20px]"
                                    />
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mb-4 flex justify-end text-[11px]">
                    <div className="flex gap-2 border border-black px-3 py-2">
                        <div>Grand Total</div>
                        <div>:</div>
                        <div>Rp.</div>
                        <div className="min-w-[120px] text-right">
                            {formatNumber(grandTotal)}
                        </div>
                    </div>
                </div>

                <div className="flex border border-black text-center text-[11px]">
                    <div className="flex flex-1 flex-col border-r border-black">
                        <div className="py-1">Created By,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1">&nbsp;</div>
                    </div>
                    <div className="flex flex-1 flex-col border-r border-black">
                        <div className="py-1">Check By,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1">&nbsp;</div>
                    </div>
                    <div className="flex flex-1 flex-col">
                        <div className="py-1">Approved By,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1 font-semibold uppercase">
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: 8.5in 5.5in;
                        margin: 0.15in;
                    }
                    * {
                        -webkit-print-color-adjust: economy;
                        print-color-adjust: economy;
                    }
                    body {
                        font-family: "Courier New", Courier, monospace;
                    }
                    table {
                        border-collapse: collapse !important;
                        border: 0.2px solid #000 !important;
                    }
                    th, td {
                        border: 0.2px solid #000 !important;
                    }
                    table.no-border,
                    table.no-border th,
                    table.no-border td {
                        border: none !important;
                    }
                    .border-b-0 {
                        border-bottom: 0 !important;
                    }
                    table.no-row-lines tbody td {
                        border-top: 0 !important;
                        border-bottom: 0 !important;
                    }
                    table.no-row-lines thead th {
                        border-top: 0 !important;
                        border-bottom: 0.2px solid #000 !important;
                    }
                }
            `}</style>
        </div>
    );
}
