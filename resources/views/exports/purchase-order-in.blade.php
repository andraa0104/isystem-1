<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Export Purchase Order In</title>
    <style>
        body { margin: 24px; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
        h1 { margin: 0 0 16px; font-size: 20px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; min-width: 1900px; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-weight: 600; white-space: nowrap; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .number { text-align: right; white-space: nowrap; }
        .nowrap { white-space: nowrap; }
        @media print { @page { size: landscape; margin: 8mm; } body { margin: 0; } }
    </style>
</head>
<body>
    <h1>Export Data Purchase Order In</h1>
    <p>Range Date Doc: {{ $startDate }} s/d {{ $endDate }}</p>
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>No Doc</th><th>Date Doc</th><th>Ref PO</th><th>Customer</th>
                    <th>Date PO</th><th>Delivery Date</th><th>Franco/Loco</th><th>Keterangan</th>
                    <th>PPN (%)</th><th>Total Price</th><th>Price PPN</th><th>Grand Total</th>
                    <th>Material</th><th>Qty</th><th>Satuan</th><th>Price</th><th>Total Price Material</th><th>Remark</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($purchaseOrders as $purchaseOrder)
                    @php
                        $details = $detailsByDocument->get($purchaseOrder->kode_poin, collect());
                        $rowspan = max(1, $details->count());
                        $rows = $details->isEmpty() ? collect([null]) : $details;
                    @endphp
                    @foreach ($rows as $index => $detail)
                        <tr>
                            @if ($index === 0)
                                <td rowspan="{{ $rowspan }}" class="nowrap">{{ $purchaseOrder->kode_poin ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}" class="nowrap">{{ $purchaseOrder->created_at ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}">{{ $purchaseOrder->no_poin ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}">{{ $purchaseOrder->customer_name ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}" class="nowrap">{{ $purchaseOrder->date_poin ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}" class="nowrap">{{ $purchaseOrder->delivery_date ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}">{{ $purchaseOrder->franco_loco ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}">{{ $purchaseOrder->note_doc ?? '-' }}</td>
                                <td rowspan="{{ $rowspan }}" class="number">{{ number_format((float) ($purchaseOrder->ppn_input_percent ?? 0), 2, ',', '.') }}</td>
                                <td rowspan="{{ $rowspan }}" class="number">{{ number_format((float) ($purchaseOrder->total_price ?? 0), 0, ',', '.') }}</td>
                                <td rowspan="{{ $rowspan }}" class="number">{{ number_format((float) ($purchaseOrder->ppn_amount ?? 0), 0, ',', '.') }}</td>
                                <td rowspan="{{ $rowspan }}" class="number">{{ number_format((float) ($purchaseOrder->grand_total ?? 0), 0, ',', '.') }}</td>
                            @endif
                            <td>{{ $detail->material ?? '-' }}</td>
                            <td class="number">{{ isset($detail) ? number_format((float) $detail->qty, 0, ',', '.') : '-' }}</td>
                            <td>{{ $detail->satuan ?? '-' }}</td>
                            <td class="number">{{ isset($detail) ? number_format((float) $detail->price_po_in, 0, ',', '.') : '-' }}</td>
                            <td class="number">{{ isset($detail) ? number_format((float) $detail->total_price_po_in, 0, ',', '.') : '-' }}</td>
                            <td>{{ $detail->remark ?? '-' }}</td>
                        </tr>
                    @endforeach
                @empty
                    <tr><td colspan="18" style="text-align:center">Data Purchase Order In belum tersedia.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</body>
</html>
