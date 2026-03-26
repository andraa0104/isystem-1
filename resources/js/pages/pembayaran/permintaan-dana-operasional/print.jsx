import { Head } from '@inertiajs/react';

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        toNumber(value),
    );

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

export default function PermintaanDanaOperasionalPrint({
    company = {},
    header = {},
    details = [],
    totals = {},
    printDate = '',
}) {
    const pageMargins = {
        top: '11mm',
        right: '8mm',
        bottom: '8mm',
        left: '8mm',
    };

    const pageStyle = `
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
            margin: 0 auto;
        }

        @media print {
            @page {
                size: A4;
                margin: ${pageMargins.top} ${pageMargins.right} ${pageMargins.bottom} ${pageMargins.left};
            }
            .print-page { margin: 0 !important; }
            .no-print { display: none !important; }
        }

        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #111; padding: 6px 6px; font-size: 11px; vertical-align: top; }
        th { background: #f3f4f6; text-transform: uppercase; letter-spacing: .02em; font-size: 10px; }
        .sig-line { border-top: 1px solid #111; width: 140px; margin: 60px auto 0; }
    `;

    return (
        <div className="bg-white text-black">
            <Head title={`Print PDO ${header?.no_pdo ?? ''}`} />
            <style>{pageStyle}</style>

            <div className="print-page p-1">
                <div className="grid grid-cols-[1fr_1fr] items-start gap-4 text-[11px]">
                    <div className="leading-relaxed">
                        <div className="text-[16px] font-semibold uppercase">
                            {renderValue(company?.name)}
                        </div>
                        {company?.address && <div>{company.address}</div>}
                        {company?.kota && <div>{company.kota}</div>}
                        {company?.phone && <div>Telp : {company.phone}</div>}
                    </div>
                    <div />
                </div>

                <div className="mt-3 grid grid-cols-2 text-[11px]">
                    <div className="space-y-1">
                        <div>
                            No.{' '}
                            <span className="font-semibold">
                                {renderValue(header?.no_pdo)}
                            </span>
                        </div>
                        <div>
                            Date:{' '}
                            <span className="font-semibold">
                                {renderValue(header?.posting_date)}
                            </span>
                        </div>
                        <div>
                            Print Date:{' '}
                            <span className="font-semibold">
                                {renderValue(printDate)}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1 text-right" style={{fontSize: '12px'}}>
                        <div>
                            Kas Bank:{' '}
                            <span className="font-semibold">
                                {formatRupiah(header?.kas_bank)}
                            </span>
                        </div>
                        <div>
                            Kas Tunai:{' '}
                            <span className="font-semibold">
                                {formatRupiah(header?.kas_tunai)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-2 text-center text-[20px] font-semibold uppercase underline">
                    PERMINTAAN DANA OPERASIONAL
                </div>

                <div className="mt-3">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 34 }}>NO.</th>
                                <th>NO. DOC.</th>
                                <th>NO. INVOICE</th>
                                <th>INV. DATE</th>
                                <th>REF. PO OUT</th>
                                <th>VENDOR</th>
                                <th style={{ width: 130 }}>PDO</th>
                                <th>REMARK</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.length === 0 && (
                                <tr>
                                    <td colSpan={8}>Tidak ada data.</td>
                                </tr>
                            )}
                            {details.map((row, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{renderValue(row?.no_fi)}</td>
                                    <td>{renderValue(row?.no_inv)}</td>
                                    <td>{renderValue(row?.inv_date)}</td>
                                    <td>{renderValue(row?.ref_po)}</td>
                                    <td>{renderValue(row?.vendor)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {formatRupiah(row?.pdo_now)}
                                    </td>
                                    <td>{renderValue(row?.remark)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-right font-semibold underline" style={{fontSize: '14px'}}
                                >
                                    Total :
                                </td>
                                <td
                                    style={{
                                        textAlign: 'right',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                    }}
                                >
                                    {formatRupiah(totals?.pdo_now)}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-9 text-center text-[11px]">
                    <div>
                        Diminta Oleh,
                        <div className="sig-line" />
                    </div>
                    <div>
                        Diketahui Oleh,
                        <div className="sig-line" />
                    </div>
                    <div>
                        Diperiksa Oleh,
                        <div className="sig-line" />
                    </div>
                    <div>
                        Disetujui Oleh,
                        <div className="sig-line" />
                    </div>
                </div>

                <div className="mt-3 text-[10px]">
                    * Invoice / Nota Asli Terlampir.
                </div>
            </div>
        </div>
    );
}
