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
                    @if ($warehouse === 'all')
                        <th>Total Stok</th>
                        @foreach (['g1' => 'G1', 'g2' => 'G2', 'g3' => 'G3', 'g4' => 'G4'] as $key => $label)
                            <th>Stok {{ $label }}</th>
                            <th>Harga {{ $label }}</th>
                            <th>Kategori {{ $label }}</th>
                        @endforeach
                    @else
                        <th>Stok {{ strtoupper($warehouse) }}</th>
                        <th>Harga {{ strtoupper($warehouse) }}</th>
                        <th>Kategori {{ strtoupper($warehouse) }}</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @forelse ($materials as $index => $material)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td>{{ $material->kd_material ?? '-' }}</td>
                        <td>{{ $material->material ?? '-' }}</td>
                        <td>{{ $material->unit ?? '-' }}</td>
                        @if ($warehouse === 'all')
                            <td>{{ $material->stok ?? '-' }}</td>
                            @foreach (['g1' => 1, 'g2' => 2, 'g3' => 3, 'g4' => 4] as $key => $number)
                                <td>{{ $material->{'stok_'.$key} ?? '-' }}</td>
                                <td>{{ $material->{'harga_stok'.$key} ?? '-' }}</td>
                                <td>{{ $material->{'kategori_stok'.$number} ?? '-' }}</td>
                            @endforeach
                        @else
                            @php($number = substr($warehouse, 1))
                            <td>{{ $material->stok ?? '-' }}</td>
                            <td>{{ $material->{'harga_stok'.$warehouse} ?? '-' }}</td>
                            <td>{{ $material->{'kategori_stok'.$number} ?? '-' }}</td>
                        @endif
                    </tr>
                @empty
                    <tr>
                        <td colspan="{{ $warehouse === 'all' ? 17 : 7 }}" style="text-align: center;">
                            Data material belum tersedia.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </body>
</html>
