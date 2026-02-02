import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        toNumber(value),
    );

const formatLongDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
};

const formatShortDate = (value) => {
    if (!value) return '-';
    const raw = String(value);
    if (raw.includes('.')) return raw; // already dd.mm.yyyy
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
};

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const raw = String(value).trim();
    if (raw.includes('%')) return raw.replace(/\s+/g, ' ');
    const number = Number(raw);
    if (Number.isNaN(number)) return raw;
    return `${number.toFixed(2)} %`;
};

const formatMarginCell = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const raw = String(value).trim().replace('%', '').trim();
    const number = Number(raw);
    if (Number.isNaN(number)) return raw;
    return `${number.toFixed(1)} %`;
};

export default function BiayaKirimPenjualanPrint({
    company = {},
    header = {},
    details = [],
    printDate = '',
}) {
    const pageMargins = {
        top: '11mm',
        right: '8mm',
        bottom: '5mm',
        left: '8mm',
    };

    const pageStyle = `
        :root {
            --page-pad-top: ${pageMargins.top};
            --page-pad-right: ${pageMargins.right};
            --page-pad-bottom: ${pageMargins.bottom};
            --page-pad-left: ${pageMargins.left};
        }

        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: Arial, Helvetica, sans-serif;
        }

        .print-page {
            box-sizing: border-box;
            width: 210mm;
            min-height: 297mm;
            padding: var(--page-pad-top) var(--page-pad-right) var(--page-pad-bottom) var(--page-pad-left);
            margin: 0 auto;
        }

        @media screen {
            body { background: #f3f4f6; }
            .print-page {
                background: #fff;
                box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                margin: 18px auto;
            }
        }

        @media print {
            /* Use @page margin so EVERY printed page uses the same margins */
            @page {
                size: A4;
                /* Don't rely on CSS variables here: some browsers ignore var() inside @page, resulting in 0 margin. */
                margin: ${pageMargins.top} ${pageMargins.right} ${pageMargins.bottom} ${pageMargins.left};
            }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            html, body { background: #fff !important; }
            .print-page {
                box-shadow: none !important;
                margin: 0 !important;
                /* Padding handled by @page margin in print */
                padding: 0 !important;
            }
        }
    `;

    const headerBorderStyle = { borderBottom: '2pt solid #000' };
    const rowBorderStyle = { borderBottom: '1.2pt solid #000' };
    const topBorderStyle = { borderTop: '2pt solid #000' };

    const companyLines = [];
    if (company.address) companyLines.push(company.address);
    if (company.kota) companyLines.push(company.kota);
    if (company.phone) companyLines.push(`Telp : ${company.phone}`);
    if (company.email) companyLines.push(`Email : ${company.email}`);

    const sortedDetails = [...(details ?? [])].sort((a, b) => {
        const doCompare = String(a?.no_do ?? '').localeCompare(
            String(b?.no_do ?? ''),
        );
        if (doCompare !== 0) return doCompare;
        return String(a?.material ?? '').localeCompare(String(b?.material ?? ''));
    });

    const vendorName = header?.nama_vendor ?? header?.nma_vendor;

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print BKJ ${header?.no_bkj ?? ''}`} />
            <style>{pageStyle}</style>

            <div className="no-print mx-auto max-w-[980px] px-6 py-4 text-right">
                <button
                    type="button"
                    className="rounded-md border px-3 py-1 text-sm"
                    onClick={() => window.print()}
                >
                    Print
                </button>
            </div>

            <div className="print-page text-[12px] p-1 leading-[1.35] text-black">
                <div>
                    <div className="text-[16px] font-semibold uppercase">
                        {company.name || '-'}
                    </div>
                    {companyLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                </div>

                <div className="mt-6 text-center text-[16px] font-semibold">
                    BIAYA KIRIM PENJUALAN
                </div>

                <div className="mt-5 grid grid-cols-2 gap-10">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-[150px] align-top">No.</td>
                                <td className="w-[12px] align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(header?.no_bkj)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Vendor (Ekspedisi)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(vendorName)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">No. Invoice</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {renderValue(header?.no_inv)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Tgl. Invoice</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatLongDate(header?.tgl_inv)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Total Invoice (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.jumlah_inv)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Total Beban (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.jumlah_beban)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Total DOT (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.total_dot)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Total Beli (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.gtotal_beli)}
                                </td>
                            </tr>
                            <tr>
                                <td className="align-top">Beli+Beban Jual (Rp.)</td>
                                <td className="align-top">:</td>
                                <td className="font-semibold">
                                    {formatNumber(header?.totalbeli_biayajual)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex items-start justify-end">
                        <table
                            className="w-full max-w-[360px] border-2 border-black text-[12px]"
                            cellPadding={0}
                            cellSpacing={0}
                        >
                            <tbody>
                                <tr>
                                    <td className="px-3 py-1">
                                        Total Harga Penjualan (Rp.)
                                    </td>
                                    <td className="px-1 py-1">:</td>
                                    <td className="px-3 py-1 text-right font-semibold">
                                        {formatNumber(header?.gtotal_jual)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-3 py-1">
                                        Margin Sebelum Biaya Jual
                                    </td>
                                    <td className="px-1 py-1">:</td>
                                    <td className="px-3 py-1 text-right font-semibold">
                                        {formatPercent(header?.margin_sbj)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-3 py-1">
                                        Margin Sesudah Biaya Jual
                                    </td>
                                    <td className="px-1 py-1">:</td>
                                    <td className="px-3 py-1 text-right font-semibold">
                                        {formatPercent(header?.margin_final)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-3 py-1">Tanggal Document</td>
                                    <td className="px-1 py-1">:</td>
                                    <td className="px-3 py-1 text-right font-semibold">
                                        {formatLongDate(header?.tanggal)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-3 py-1">Tanggal Print</td>
                                    <td className="px-1 py-1">:</td>
                                    <td className="px-3 py-1 text-right font-semibold">
                                        {printDate}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-4 pt-2" style={topBorderStyle}>
                    <table className="w-full table-fixed border-collapse text-[11px]">
                        <thead>
                            <tr>
                                <th
                                    className="w-[28px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    No.
                                </th>
                                <th
                                    className="w-[90px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Ref. DO / Tgl.
                                </th>
                                <th
                                    className="w-[160px] px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Customer / PO Cust.
                                </th>
                                <th
                                    className="px-2 py-1 text-left"
                                    style={headerBorderStyle}
                                >
                                    Material / DOT / Qty
                                </th>
                                <th
                                    className="w-[80px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Harga Beli
                                </th>
                                <th
                                    className="w-[110px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Biaya Beli/Total
                                </th>
                                <th
                                    className="w-[80px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Harga Jual
                                </th>
                                <th
                                    className="w-[55px] px-2 py-1 text-right"
                                    style={headerBorderStyle}
                                >
                                    Margin
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDetails.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-2 py-4 text-center">
                                        Tidak ada detail.
                                    </td>
                                </tr>
                            ) : (
                                sortedDetails.map((row, index) => (
                                    <tr
                                        key={`${row?.no_do ?? 'do'}-${row?.code_mat ?? 'mat'}-${index}`}
                                        className="align-top"
                                        style={rowBorderStyle}
                                    >
                                        <td className="px-2 py-1">{index + 1}</td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.no_do)}
                                            </div>
                                            <div>{formatShortDate(row?.tgl_do)}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.customer)}
                                            </div>
                                            <div>{renderValue(row?.po_cust)}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="font-semibold">
                                                {renderValue(row?.material)}
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-[20px]">
                                                    {renderValue(row?.no_dob)}
                                                </div>
                                                <div className="text-right">
                                                    {renderValue(row?.qty)}{' '}
                                                    {renderValue(row?.unit)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <div className="font-semibold">
                                                {formatNumber(row?.harga_beli)}
                                            </div>
                                            <div>{formatNumber(row?.total_beli)}</div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <div className="font-semibold">
                                                {formatNumber(row?.biaya_beli)}
                                            </div>
                                            <div>
                                                {formatNumber(row?.totalbeli_biaya)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <div className="font-semibold">
                                                {formatNumber(row?.harga_jual)}
                                            </div>
                                            <div>{formatNumber(row?.total_jual)}</div>
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            {formatMarginCell(
                                                row?.margin_final,
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 text-[12px]">
                    <div className="grid grid-cols-4 gap-10 text-center">
                        <div>
                            <div className="text-center">Dibuat Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Purchasing / Marketing
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Diketahui Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head Office Area
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Diperiksa Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head of Accounting
                            </div>
                        </div>
                        <div>
                            <div className="text-center">Disetujui Oleh,</div>
                            <div className="mt-14 border-t border-black pt-1">
                                Head Of Management
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 text-[11px] font-semibold">
                        * Berkas Terlampir / Keterangan lainnya :
                    </div>
                </div>
            </div>
        </div>
    );
}
