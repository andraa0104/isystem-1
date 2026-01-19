<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Export Data Material</title>
        <style>
            body {
                font-family: Arial, Helvetica, sans-serif;
                margin: 24px;
                color: #0f172a;
            }
            h1 {
                font-size: 20px;
                margin: 0 0 16px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            th,
            td {
                border: 1px solid #cbd5f5;
                padding: 8px;
                text-align: left;
                vertical-align: top;
            }
            th {
                background: #f1f5f9;
                font-weight: 600;
            }
            tbody tr:nth-child(even) {
                background: #f8fafc;
            }
        </style>
    </head>
    <body>
        @php
            $formatRupiah = function ($value) {
                if ($value === null || $value === '') {
                    return '-';
                }
                return 'Rp ' . number_format((float) $value, 0, ',', '.');
            };
        @endphp
        <h1>Export Data Material</h1>
        <table>
            <thead>
                <tr>
                    <th>Nomor</th>
                    <th>Kode Material</th>
                    <th>Nama Material</th>
                    <th>Satuan</th>
                    <th>Stok</th>
                    <th>Harga</th>
                    <th>Remark</th>
                    <th>Rest Stok</th>
                    <th>Posting Date</th>
                    <th>Created By</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($materials as $index => $material)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td>{{ $material->kd_material ?? '-' }}</td>
                        <td>{{ $material->material ?? '-' }}</td>
                        <td>{{ $material->unit ?? '-' }}</td>
                        <td>{{ $material->stok ?? '-' }}</td>
                        <td>{{ $formatRupiah($material->harga ?? null) }}</td>
                        <td>{{ $material->remark ?? '-' }}</td>
                        <td>{{ $material->rest_stock ?? '-' }}</td>
                        <td>{{ $material->tgl_buat ?? '-' }}</td>
                        <td>{{ $material->pembuat ?? '-' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="10" style="text-align: center;">
                            Data material belum tersedia.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </body>
</html>
