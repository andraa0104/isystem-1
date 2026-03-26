import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '-';
    }
    return new Intl.NumberFormat('id-ID').format(number);
};

const parseInvoiceDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (raw.includes('.')) {
        const parts = raw.split('.');
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        }
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateShort = (value) => {
    const date = parseInvoiceDate(value);
    if (!date) return renderValue(value);
    return date
        .toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
        .toUpperCase();
};

const formatDateDash = (value) => {
    const date = parseInvoiceDate(value);
    if (!date) return renderValue(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date
        .toLocaleDateString('en-US', { month: 'short' })
        .toUpperCase();
    return `${day}-${month}-${date.getFullYear()}`;
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

export default function FakturPenjualanPrint({
    invoice,
    details = [],
    company = {},
    customer,
    cityLabel,
    isStg = false,
}) {
    const printMarginTop = '0.2in';
    const printMarginRight = '0.4in';
    const printMarginBottom = '0.3in';
    const printMarginLeft = '0.4in';
    const terbilang = formatTerbilang(invoice?.g_total);
    const dppNilaiLain = (11 / 12) * Number(invoice?.harga || 0);
    const printDate = formatDateDash(new Date());

    const companyLines = [];
    if (company.address) {
        companyLines.push(company.address);
    }
    if (company.kota) {
        companyLines.push(company.kota);
    }
    if (company.phone) {
        companyLines.push(`Telp : ${company.phone}`);
    }
    if (company.email) {
        companyLines.push(`Email : ${company.email}`);
    }

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print Faktur ${invoice?.no_fakturpenjualan ?? ''}`} />
            <style>{`
                @page { size: 8.5in 5.5in; margin: ${printMarginTop} ${printMarginRight} ${printMarginBottom} ${printMarginLeft}; }
                @media print {
                    * { -webkit-print-color-adjust: economy; print-color-adjust: economy; }
                    body { font-family: "Courier New", Courier, monospace; }
                    table { border-collapse: collapse !important; border: 1px solid #000 !important; }
                    th, td { border: 1px solid #000 !important; }
                    table.no-row-lines tbody td {
                        border-top: 0 !important;
                        border-bottom: 0 !important;
                    }
                    table.no-row-lines thead th {
                        border-top: 0 !important;
                        border-bottom: 1px solid #000 !important;
                    }
                }
            `}</style>
            <div className="mx-auto w-full max-w-[900px] p-1 text-[12px] leading-tight">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <div className="text-[20px] font-semibold uppercase">
                            {company.name || '-'}
                        </div>
                        {companyLines.map((line, index) => (
                            <div key={`${line}-${index}`}>{line}</div>
                        ))}
                    </div>
                    <div className="text-[12px]">
                        <div className="font-semibold">Kepada :</div>
                        <div className="font-semibold">
                            {renderValue(invoice?.nm_cs)}
                        </div>
                        <div>{renderValue(customer?.alamat_cs)}</div>
                        <div>{renderValue(customer?.kota_cs)}</div>
                    </div>
                </div>

                <div className="mt-4 text-center text-[20px] font-semibold tracking-[0.3em]">
                    FAKTUR PENJUALAN
                </div>

                <div className="mt-3 grid grid-cols-2 gap-6 text-[12px]">
                    <div className="space-y-1">
                        <div className="flex gap-2">
                            <span className="w-[90px]">No. Faktur</span>
                            <span>:</span>
                            <span className="font-semibold">
                                {renderValue(invoice?.no_fakturpenjualan)}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <span className="w-[90px]">Date</span>
                            <span>:</span>
                            <span>{formatDateShort(invoice?.tgl_doc)}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="w-[90px]">Ref. PO</span>
                            <span>:</span>
                            <span>{renderValue(invoice?.ref_po)}</span>
                        </div>
                    </div>
                    <div className="space-y-1 text-right">
                        <div>
                            Jatuh Tempo : {formatDateDash(invoice?.jth_tempo)}
                        </div>
                        <div>MATA UANG : RUPIAH</div>
                    </div>
                </div>

                <table className="mt-4 w-full border border-black text-[11px] no-row-lines">
                    <colgroup>
                        <col className="w-[14%]" />
                        <col className="w-[4%]" />
                        <col className="w-[9%]" />
                        <col className="w-[35%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-black">
                            <th className="border-r border-black px-2 py-2">
                                No. DO
                            </th>
                            <th className="border-r border-black px-2 py-2">
                                No.
                            </th>
                            <th className="border-r border-black px-2 py-2">
                                Quantity
                            </th>
                            <th className="border-r border-black px-2 py-2">
                                Material
                            </th>
                            <th className="border-r border-black px-2 py-2">
                                Harga Satuan
                            </th>
                            <th className="px-2 py-2">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {details.map((row, index) => (
                            <tr key={`${row.no_do}-${index}`}>
                                <td className="border-r border-black px-2 py-2">
                                    {renderValue(row.no_do)}
                                </td>
                                <td className="border-r border-black px-2 py-2 text-center">
                                    {index + 1}
                                </td>
                                <td className="border-r border-black px-2 py-2 text-center">
                                    {renderValue(row.qty)}{' '}
                                    {renderValue(row.unit)}
                                </td>
                                <td className="border-r border-black px-2 py-2">
                                    {renderValue(row.material)}
                                </td>
                                <td className="border-r border-black px-2 py-2 text-right">
                                    {formatNumber(row.price)}
                                </td>
                                <td className="px-2 py-2 text-right">
                                    {formatNumber(row.ttl_price)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="grid grid-cols-2 gap-6 border border-t-0 border-black text-[11px]">
                    <div className="border-r border-black px-2 py-2">
                        <div className="font-semibold">Terbilang</div>
                        <div className="mt-1 capitalize">{terbilang}</div>
                    </div>
                    <div className="px-2 py-2">
                        <div className="flex justify-between">
                            <span>Sub Total</span>
                            <span>{formatNumber(invoice?.harga)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>DPP Nilai Lain</span>
                            <span>{formatNumber(dppNilaiLain)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>PPN {renderValue(invoice?.ppn)}</span>
                            <span>{formatNumber(invoice?.h_ppn)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>Grand Total</span>
                            <span>{formatNumber(invoice?.g_total)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 border border-t-0 border-black px-2 py-2 text-[11px]" style={{ gridTemplateColumns: '40% 30% 23%' }}>
                    <div className="space-y-1">
                        <div className="font-semibold">
                            TRANSFER PEMBAYARAN KE :
                        </div>
                        <div>{company.name}</div>
                        <div>
                            BANK BCA - CABANG{' '}
                            {isStg ? 'BANJARMASIN' : 'A. YANI, SAMARINDA'}
                        </div>
                        <div>
                            NO. REKENING : {isStg ? '0511908883' : '7935229995'}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div>Untuk pertanyaan lebih lanjut</div>
                        <div>dapat menghubungi:</div>
                        <div>
                            {isStg
                                ? '082251644645 a/n Mira Erliana'
                                : '0821 5628 6588 a/n Maya Astuti'}
                        </div>
                    </div>
                    <div className="text-right">
                        <div>
                            {cityLabel}, {printDate}
                        </div>
                        <div className="mt-8 font-semibold uppercase">
                            {company.name}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
