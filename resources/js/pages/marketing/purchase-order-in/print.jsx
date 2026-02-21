import { Head, Link } from '@inertiajs/react';

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const toDisplayDate = (value) => {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return text || '-';
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
};

export default function PurchaseOrderInPrint({ header = null, items = [] }) {
    return (
        <>
            <Head title={`Laporan PO In ${header?.kode_poin ?? ''}`} />

            <style>{`
                @page { size: A4; margin: 12mm; }
                body { background: #fff; }
                .print-wrap { max-width: 1120px; margin: 0 auto; color: #111827; }
                .print-title { font-size: 22px; font-weight: 700; letter-spacing: .04em; }
                .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; }
                .muted { color: #6b7280; font-size: 12px; }
                .value { font-weight: 600; font-size: 16px; margin-top: 2px; }
                .report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .report-table th, .report-table td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
                .report-table thead th { background: #f3f4f6; font-weight: 700; }
                .screen-only { display: block; }
                .print-only { display: none; }
                @media print {
                    .screen-only { display: none !important; }
                    .print-only { display: block !important; }
                    .print-wrap { max-width: 100%; }
                }
            `}</style>

            <div className="print-wrap p-4">
                <div className="screen-only mb-5 flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Print Preview Laporan PO In</h1>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                            onClick={() => window.print()}
                        >
                            Print
                        </button>
                        <Link
                            href="/marketing/purchase-order-in"
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                        >
                            Kembali
                        </Link>
                    </div>
                </div>

                <div className="mb-4 flex items-start justify-between border-b border-gray-300 pb-3">
                    <div>
                        <div className="print-title">LAPORAN PURCHASE ORDER IN</div>
                        <p className="text-sm text-gray-600">Marketing Department</p>
                    </div>
                    <div className="text-right text-sm">
                        <p><span className="font-semibold">Kode PO In:</span> {header?.kode_poin ?? '-'}</p>
                        <p><span className="font-semibold">No PO In:</span> {header?.no_poin ?? '-'}</p>
                    </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <div className="card">
                        <p className="muted">Date PO In</p>
                        <p className="value">{toDisplayDate(header?.date_poin)}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Delivery Date</p>
                        <p className="value">{toDisplayDate(header?.delivery_date)}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Customer</p>
                        <p className="value">{header?.customer_name ?? '-'}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Payment Term</p>
                        <p className="value">{header?.payment_term ?? '-'}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Franco/Loco</p>
                        <p className="value">{header?.franco_loco ?? '-'}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Catatan Dokumen</p>
                        <p className="value">{header?.note_doc || '-'}</p>
                    </div>
                </div>

                <table className="report-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Kode Material</th>
                            <th>Material</th>
                            <th>Qty</th>
                            <th>Satuan</th>
                            <th>Price PO In</th>
                            <th>Total Price</th>
                            <th>Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280' }}>
                                    Tidak ada item material.
                                </td>
                            </tr>
                        )}
                        {items.map((item, index) => (
                            <tr key={item.id ?? index}>
                                <td>{item.line_no ?? index + 1}</td>
                                <td>{item.kd_material ?? '-'}</td>
                                <td>{item.material ?? '-'}</td>
                                <td>{item.qty ?? 0}</td>
                                <td>{item.satuan ?? '-'}</td>
                                <td>{formatRupiah(item.price_po_in ?? 0)}</td>
                                <td>{formatRupiah(item.total_price_po_in ?? 0)}</td>
                                <td>{item.remark || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="card">
                        <p className="muted">Total Price</p>
                        <p className="value">{formatRupiah(header?.total_price ?? 0)}</p>
                    </div>
                    <div className="card">
                        <p className="muted">DPP</p>
                        <p className="value">{formatRupiah(header?.dpp ?? 0)}</p>
                    </div>
                    <div className="card">
                        <p className="muted">PPN</p>
                        <p className="value">{formatRupiah(header?.ppn_amount ?? 0)}</p>
                    </div>
                    <div className="card">
                        <p className="muted">Grand Total</p>
                        <p className="value">{formatRupiah(header?.grand_total ?? 0)}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
