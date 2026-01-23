import { Head } from '@inertiajs/react';

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

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

const formatDateLong = (value) => {
    const date = parseInvoiceDate(value);
    if (!date) return renderValue(value);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
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

const capitalize = (value) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function KwitansiPrint({ kwitansi, company = {}, cityLabel }) {
    const printMarginTop = '0.2in';
    const printMarginRight = '0.4in';
    const printMarginBottom = '0.4in';
    const printMarginLeft = '0.4in';

    const totalValue = toNumber(kwitansi?.ttl_faktur);
    const terbilang = formatTerbilang(totalValue).toUpperCase();

    return (
        <div className="min-h-screen bg-white text-black">
            <Head title={`Print Kwitansi ${kwitansi?.no_kwitansi ?? ''}`} />
            <style>{`
                @page { size: 9.5in 11in; margin: ${printMarginTop} ${printMarginRight} ${printMarginBottom} ${printMarginLeft}; }
                @media print {
                    * { -webkit-print-color-adjust: economy; print-color-adjust: economy; }
                    body { font-family: "Courier New", Courier, monospace; }
                }
            `}</style>
            <div className="mx-auto w-full max-w-[900px] p-8 text-[12px] leading-tight">
                <div className="border border-black p-6">
                    <div className="text-center text-[18px] font-semibold tracking-[0.4em]">
                        KWITANSI
                    </div>
                    <div className="mt-4 text-[12px]">
                        <div className="grid grid-cols-[160px_12px_1fr] items-start gap-2">
                            <span>No.</span>
                            <span className="text-center">:</span>
                            <span className="font-semibold">
                                {renderValue(kwitansi?.no_kwitansi)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3 text-[12px]">
                        <div className="grid grid-cols-[160px_12px_1fr] items-start gap-2">
                            <span>Telah Terima Dari</span>
                            <span className="text-center">:</span>
                            <span className="font-semibold">
                                {renderValue(kwitansi?.cs)}
                            </span>
                        </div>
                        <div className="grid grid-cols-[160px_12px_1fr] items-start gap-2">
                            <span>Uang Sejumlah</span>
                            <span className="text-center">:</span>
                            <span>{terbilang}</span>
                        </div>
                        <div className="grid grid-cols-[160px_12px_1fr] items-start gap-2">
                            <span>Untuk Pembayaran</span>
                            <span className="text-center">:</span>
                            <span>
                                Faktur dengan nomor{' '}
                                {renderValue(kwitansi?.ref_faktur)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                        <div className="border border-black px-3 py-2 text-[12px] font-semibold">
                            <div className="flex items-center gap-8">
                                <span>Rp</span>
                                <span>{formatNumber(totalValue)}</span>
                            </div>
                        </div>
                        <div className="text-right text-[12px]">
                            {renderValue(cityLabel)}, {formatDateLong(kwitansi?.tgl)}
                        </div>
                    </div>

                    <div className="mt-10 text-right text-[12px] font-semibold">
                        {renderValue(company?.name)}
                    </div>
                </div>
            </div>
        </div>
    );
}
