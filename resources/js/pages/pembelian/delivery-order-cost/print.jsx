import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatDate = (value) => {
    if (!value) {
        return '-';
    }

    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-');
            return `${day}.${month}.${year}`;
        }
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

export default function DeliveryOrderCostPrint({
    header,
    details = [],
    grandTotal = 0,
    customerAddress = '',
    company = {},
}) {
    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp : ${company.phone}`);

    return (
        <div className="min-h-screen bg-white font-sans text-black">
            <Head title={`Print DOBi ${header?.no_alokasi ?? ''}`} />

            <div className="mx-auto w-full max-w-[900px] p-8 text-[12px] leading-tight">
                <div className="flex items-start justify-between">
                    <div className="w-[60%]">
                        <div className="mb-1 text-[20px] font-bold uppercase">
                            {company.name || 'CV. SEMESTA JAYA ABADI'}
                        </div>
                        {companyLines.map((line, idx) => (
                            <div key={idx} className="capitalize">
                                {line}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="my-4 text-center text-[16px] font-bold uppercase">
                    Alokasi Pemakaian Barang
                </div>

                <div className="mb-4">
                    <table className="w-auto">
                        <tbody>
                            <tr>
                                <td className="w-[110px]">No. Alokasi</td>
                                <td className="w-[10px]">:</td>
                                <td>{renderValue(header?.no_alokasi)}</td>
                            </tr>
                            <tr>
                                <td>Date</td>
                                <td>:</td>
                                <td>{formatDate(header?.date)}</td>
                            </tr>
                            <tr>
                                <td>Ref. Pemakaian</td>
                                <td>:</td>
                                <td>{renderValue(header?.ref_permintaan)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mb-4">
                    <table className="w-full border-collapse border border-black">
                        <colgroup>
                            <col className="w-[50px]" />
                            <col className="w-[70px]" />
                            <col />
                            <col className="w-[100px]" />
                            <col className="w-[100px]" />
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
                            {details.map((item, index) => {
                                const isLast = index === details.length - 1;
                                const cellClass = isLast
                                    ? 'border-x border-t border-black py-2'
                                    : 'border border-black py-2';
                                const cellClassRight = isLast
                                    ? 'border-x border-t border-black py-2 pr-2 text-right'
                                    : 'border border-black py-2 pr-2 text-right';
                                const cellClassLeft = isLast
                                    ? 'border-x border-t border-black py-2 pl-2'
                                    : 'border border-black py-2 pl-2';

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
                            {details.length === 0 && (
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
                                        className="border-x border-b border-black h-[20px]"
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
                        <div className="min-w-[120px] text-right font-semibold">
                            {formatNumber(grandTotal)}
                        </div>
                    </div>
                </div>

                <div className="flex border border-black text-center text-[11px]">
                    <div className="flex flex-1 flex-col border-r border-black">
                        <div className="py-1">Diminta Oleh,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1 font-semibold uppercase">
                            {renderValue(header?.nm_cs)}
                        </div>
                    </div>
                    <div className="flex flex-1 flex-col border-r border-black">
                        <div className="py-1">Diperiksa Oleh,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1">&nbsp;</div>
                    </div>
                    <div className="flex flex-1 flex-col border-r border-black">
                        <div className="py-1">Disetujui Oleh,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1">&nbsp;</div>
                    </div>
                    <div className="flex flex-1 flex-col">
                        <div className="py-1">Diterima Oleh,</div>
                        <div className="h-[60px]"></div>
                        <div className="border-t border-black py-1">&nbsp;</div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0.2in;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
