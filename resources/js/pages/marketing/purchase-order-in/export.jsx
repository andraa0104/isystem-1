import { Head } from '@inertiajs/react';

const text = (value) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

const parseDatabaseNumber = (value) => {
    if (value === null || value === undefined || value === '') return NaN;
    return typeof value === 'number' ? value : Number(String(value).trim());
};

const formatFixedId = (value, minimumDecimals, maximumDecimals) => {
    const parsed = parseDatabaseNumber(value);
    if (!Number.isFinite(parsed)) return '-';

    const fixed = parsed.toFixed(maximumDecimals);
    let [integer, decimals = ''] = fixed.split('.');
    const negative = integer.startsWith('-');
    integer = integer.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    decimals = decimals.replace(/0+$/, '');
    decimals = decimals.padEnd(minimumDecimals, '0');

    return `${negative ? '-' : ''}${integer}${decimals ? `,${decimals}` : ''}`;
};

const formatNumber = (value) => {
    return formatFixedId(value, 0, 2);
};

const formatPercent = (value) => {
    return formatFixedId(value, 2, 2);
};

const formatDate = (value, includeTime = false) => {
    if (!value) return '-';

    const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (!match) return text(value);

    const [, year, month, day, hour, minute, second] = match;
    const date = `${day}.${month}.${year}`;
    if (!includeTime || !hour) return date;

    return `${date} ${hour}:${minute}:${second ?? '00'}`;
};

export default function PurchaseOrderInExport({
    purchaseOrders = [],
    startDate,
    endDate,
}) {
    return (
        <div className="min-h-screen bg-white p-6 text-slate-950">
            <Head title="Export Data Purchase Order In" />
            <style>{`@media print {
                @page { size: landscape; margin: 8mm; }
                body { margin: 0 !important; }
                .export-page { padding: 0 !important; }
            }`}</style>

            <main className="export-page">
                <h1 className="mb-4 text-xl font-bold">
                    Export Data Purchase Order In
                </h1>
                <p className="mb-4 text-sm">
                    Range Date Doc: {formatDate(startDate)} s/d{' '}
                    {formatDate(endDate)}
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1900px] border-collapse text-[11px]">
                        <thead>
                            <tr className="bg-slate-100">
                                {[
                                    'No Doc',
                                    'Date Doc',
                                    'Ref PO',
                                    'Customer',
                                    'Date PO',
                                    'Delivery Date',
                                    'Franco/Loco',
                                    'Keterangan',
                                    'PPN (%)',
                                    'Total Price',
                                    'Price PPN',
                                    'Grand Total',
                                    'Material',
                                    'Qty',
                                    'Satuan',
                                    'Price',
                                    'Total Price Material',
                                    'Remark',
                                ].map((label) => (
                                    <th
                                        key={label}
                                        className="border border-slate-300 p-2 text-left whitespace-nowrap"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseOrders.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={18}
                                        className="border border-slate-300 p-4 text-center"
                                    >
                                        Data Purchase Order In belum tersedia.
                                    </td>
                                </tr>
                            )}
                            {purchaseOrders.flatMap((order) => {
                                const details = order.details?.length
                                    ? order.details
                                    : [null];
                                const rowSpan = details.length;

                                return details.map((detail, index) => (
                                    <tr
                                        key={`${order.kode_poin}-${detail?.id ?? index}`}
                                        className="even:bg-slate-50"
                                    >
                                        {index === 0 && (
                                            <>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                                >
                                                    {text(order.kode_poin)}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                                >
                                                    {formatDate(
                                                        order.created_at,
                                                        true,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top"
                                                >
                                                    {text(order.no_poin)}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top"
                                                >
                                                    {text(order.customer_name)}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                                >
                                                    {formatDate(
                                                        order.date_poin,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top whitespace-nowrap"
                                                >
                                                    {formatDate(
                                                        order.delivery_date,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top"
                                                >
                                                    {text(order.franco_loco)}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 align-top"
                                                >
                                                    {text(order.note_doc)}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 text-right align-top whitespace-nowrap"
                                                >
                                                    {formatPercent(
                                                        order.ppn_input_percent,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 text-right align-top whitespace-nowrap"
                                                >
                                                    {formatNumber(
                                                        order.total_price,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 text-right align-top whitespace-nowrap"
                                                >
                                                    {formatNumber(
                                                        order.ppn_amount,
                                                    )}
                                                </td>
                                                <td
                                                    rowSpan={rowSpan}
                                                    className="border border-slate-300 p-2 text-right align-top whitespace-nowrap"
                                                >
                                                    {formatNumber(
                                                        order.grand_total,
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        <td className="border border-slate-300 p-2 align-top">
                                            {text(detail?.material)}
                                        </td>
                                        <td className="border border-slate-300 p-2 text-right align-top whitespace-nowrap">
                                            {detail
                                                ? formatNumber(detail.qty)
                                                : '-'}
                                        </td>
                                        <td className="border border-slate-300 p-2 align-top">
                                            {text(detail?.satuan)}
                                        </td>
                                        <td className="border border-slate-300 p-2 text-right align-top whitespace-nowrap">
                                            {detail
                                                ? formatNumber(
                                                      detail.price_po_in,
                                                  )
                                                : '-'}
                                        </td>
                                        <td className="border border-slate-300 p-2 text-right align-top whitespace-nowrap">
                                            {detail
                                                ? formatNumber(
                                                      detail.total_price_po_in,
                                                  )
                                                : '-'}
                                        </td>
                                        <td className="border border-slate-300 p-2 align-top">
                                            {text(detail?.remark)}
                                        </td>
                                    </tr>
                                ));
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
