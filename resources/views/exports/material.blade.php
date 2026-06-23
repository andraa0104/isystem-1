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
        <h1>Export Data Material</h1>
        <table>
            <thead>
                <tr>
                    <th>Nomor</th>
                    <th>Kode Material</th>
                    <th>Nama Material</th>
                    <th>Satuan</th>
                    <th>Total Stok</th>
                    <th>Stok G1</th>
                    <th>Harga G1</th>
                    <th>Kategori G1</th>
                    <th>Stok G2</th>
                    <th>Harga G2</th>
                    <th>Kategori G2</th>
                    <th>Stok G3</th>
                    <th>Harga G3</th>
                    <th>Kategori G3</th>
                    <th>Stok G4</th>
                    <th>Harga G4</th>
                    <th>Kategori G4</th>
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
                        <td>{{ $material->stok_g1 ?? '-' }}</td>
                        <td>{{ $material->harga_stokg1 ?? '-' }}</td>
                        <td>{{ $material->kategori_stok1 ?? '-' }}</td>
                        <td>{{ $material->stok_g2 ?? '-' }}</td>
                        <td>{{ $material->harga_stokg2 ?? '-' }}</td>
                        <td>{{ $material->kategori_stok2 ?? '-' }}</td>
                        <td>{{ $material->stok_g3 ?? '-' }}</td>
                        <td>{{ $material->harga_stokg3 ?? '-' }}</td>
                        <td>{{ $material->kategori_stok3 ?? '-' }}</td>
                        <td>{{ $material->stok_g4 ?? '-' }}</td>
                        <td>{{ $material->harga_stokg4 ?? '-' }}</td>
                        <td>{{ $material->kategori_stok4 ?? '-' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="17" style="text-align: center;">
                            Data material belum tersedia.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </body>
</html>
