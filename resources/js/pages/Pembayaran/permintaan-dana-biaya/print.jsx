import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(toNumber(value));

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;

const formatShortDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
};

export default function PermintaanDanaBiayaPrint({
    company = {},
    header = {},
    details = [],
    totals = {},
    printDate = '',
}) {
    const pageStyle = `
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .print-page {
            box-sizing: border-box;
            width: 210mm;
            min-height: 297mm;
            padding: 10mm 12mm 8mm 12mm;
            margin: 0 auto;
        }
        @media screen {
            body { background: #f3f4f6; }
            .print-page { background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.12); margin: 18px auto; }
        }
        @media print {
            @page { size: A4; margin: 8mm 10mm; }
            .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #111; padding: 6px 6px; font-size: 11px; vertical-align: top; }
        th { background: #f3f4f6; text-transform: uppercase; letter-spacing: .02em; font-size: 10px; }
        .sig-line { border-top: 1px solid #111; width: 140px; margin: 65px auto 0; }
    `;

    return (
        <div className="bg-white text-black">
            <Head title={`Print PDB ${header?.no_pdb ?? ''}`} />
            <style>{pageStyle}</style>
            <div className="print-page">
                <div className="text-[11px]">
                    <div className="text-[16px] font-semibold uppercase">
                        {renderValue(company?.name)}
                    </div>
                    {company?.address && <div>{company.address}</div>}
                    {company?.kota && <div>{company.kota}</div>}
                    {company?.phone && <div>Telp : {company.phone}</div>}
                </div>

                <div className="mt-4 grid grid-cols-2 text-[11px]">
                    <div className="space-y-1">
                        <div>No. : {renderValue(header?.no_pdb)}</div>
                        <div>Date : {formatShortDate(header?.tgl_buat)}</div>
                        <div>Print Date : {renderValue(printDate)}</div>
                    </div>
                    <div className="space-y-1 text-right" style={{ fontWeight: 'bold', fontSize: '12px' }}>
                        <div>Kas Bank : {formatRupiah(header?.kas_bank)}</div>
                        <div>Kas Tunai : {formatRupiah(header?.kas_tunai)}</div>
                    </div>
                </div>

                <div className="mt-4 text-center text-[18px] font-semibold underline">
                    PERMINTAAN DANA BIAYA
                </div>

                <div className="mt-3">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>No</th>
                                <th style={{ width: '160px' }}>No. Doc.</th>
                                <th>Keterangan</th>
                                <th style={{ width: '120px' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center' }}>
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {details.map((row, idx) => (
                                <tr key={`${row?.kode_bayar}-${idx}`}>
                                    <td>{idx + 1}</td>
                                    <td>{renderValue(row?.kode_bayar)}</td>
                                    <td>{renderValue(row?.keterangan)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatRupiah(row?.jumlah)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800}}>
                                    Total
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                    {formatRupiah(totals?.jumlah)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-8 grid grid-cols-4 gap-6 text-[11px] text-center">
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

                <div className="mt-3 text-[10px]">* Invoice / Nota Asli Terlampir.</div>
            </div>
        </div>
    );
}
