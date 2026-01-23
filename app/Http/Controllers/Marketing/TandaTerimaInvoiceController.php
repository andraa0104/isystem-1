<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TandaTerimaInvoiceController
{
    public function index()
    {
        return Inertia::render('Penjualan/tanda-terima-invoice/index');
    }

    public function create()
    {
        return Inertia::render('Penjualan/tanda-terima-invoice/create');
    }

    public function edit(Request $request, string $noTtInv = null)
    {
        $noTtInv = $noTtInv ?: $request->query('no_ttinv');
        if (!$noTtInv) {
            return redirect()
                ->route('penjualan.tanda-terima-invoice.index')
                ->with('error', 'Nomor tanda terima tidak ditemukan.');
        }

        return Inertia::render('Penjualan/tanda-terima-invoice/edit', [
            'noTtInv' => $noTtInv,
        ]);
    }

    public function listData()
    {
        $rows = DB::table('tb_ttinv')
            ->select(
                'no_ttinv',
                DB::raw("max(tgl_doc) as tgl_doc"),
                DB::raw('count(no_inv) as qty_invoice'),
                DB::raw("max(coalesce(nm_penerima, '')) as nm_penerima")
            )
            ->groupBy('no_ttinv')
            ->orderBy('no_ttinv', 'desc')
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function editData(Request $request, string $noTtInv = null)
    {
        $noTtInv = $noTtInv ?: $request->query('no_ttinv');
        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima tidak ditemukan.',
            ], 422);
        }

        $items = DB::table('tb_ttinv')
            ->select(
                'no_ttinv',
                'no_inv',
                'no_faktur',
                'tgl',
                'nm_cs',
                'ref_po',
                'total',
                'remark',
                'tgl_doc'
            )
            ->where('no_ttinv', $noTtInv)
            ->orderBy('no')
            ->get();

        $header = $items->first();

        return response()->json([
            'header' => $header,
            'items' => $items,
        ]);
    }

    public function listInvoices()
    {
        $rows = DB::table('tb_kdfakturpenjualan')
            ->select(
                'no_fakturpenjualan',
                'tgl_doc',
                'no_fakturpajak',
                'ref_po',
                'nm_cs',
                'g_total'
            )
            ->orderBy('no_fakturpenjualan', 'desc')
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function details(Request $request, string $noTtInv = null)
    {
        $noTtInv = $noTtInv ?: $request->query('no_ttinv');
        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima tidak ditemukan.',
            ], 422);
        }

        $items = DB::table('tb_ttinv')
            ->select(
                'no_ttinv',
                'no_inv',
                'no_faktur',
                'ref_po',
                'total',
                'remark',
                'tgl',
                'tgl_doc',
                'tgl_pos',
                'nm_cs',
                'nm_penerima',
                'tgl_terima'
            )
            ->where('no_ttinv', $noTtInv)
            ->orderBy('no_inv')
            ->get();

        $header = $items->first();
        $grandTotal = $items->sum(function ($item) {
            return (float) ($item->total ?? 0);
        });

        return response()->json([
            'header' => $header,
            'items' => $items,
            'grand_total' => $grandTotal,
        ]);
    }

    public function receiveInfo(Request $request, string $noTtInv = null)
    {
        $noTtInv = $noTtInv ?: $request->query('no_ttinv');
        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima tidak ditemukan.',
            ], 422);
        }

        $header = DB::table('tb_kdttinv')
            ->select('no_ttinv', 'tgl_doc', 'g_total')
            ->where('no_ttinv', $noTtInv)
            ->first();

        return response()->json([
            'data' => $header,
        ]);
    }

    public function storeReceive(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        $nmPenerima = $request->input('nm_penerima');
        $tglTerima = $request->input('tgl_terima');

        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima wajib diisi.',
            ], 422);
        }

        $tglTerimaFormatted = $tglTerima
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $tglTerima)->format('d.m.Y')
            : null;

        DB::transaction(function () use ($noTtInv, $nmPenerima, $tglTerimaFormatted) {
            DB::table('tb_kdttinv')
                ->where('no_ttinv', $noTtInv)
                ->update([
                    'nm_penerima' => $nmPenerima,
                    'tgl_terima' => $tglTerimaFormatted,
                ]);

            DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->update([
                    'nm_penerima' => $nmPenerima,
                    'tgl_terima' => $tglTerimaFormatted,
                ]);
        });

        return response()->json([
            'message' => 'Invoice berhasil diterima.',
        ]);
    }

    public function store(Request $request)
    {
        $date = $request->input('date');
        $grandTotal = $request->input('grand_total', 0);
        $invoices = $request->input('invoices', []);

        if (!is_array($invoices) || count($invoices) === 0) {
            return response()->json([
                'message' => 'Data invoice wajib diisi.',
            ], 422);
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $prefix = 'GEN';
        if (is_string($database) && $database !== '') {
            $lookup = $database;
            if (Str::startsWith(Str::lower($lookup), 'db')) {
                $lookup = substr($lookup, 2);
            }
            $prefix = strtoupper($lookup);
        }

        $ttPrefix = $prefix.'-TT/INV/';
        $startIndex = strlen($ttPrefix) + 1;
        $lastNumber = DB::table('tb_kdttinv')
            ->where('no_ttinv', 'like', $ttPrefix.'%')
            ->select(DB::raw("max(cast(substring(no_ttinv, $startIndex) as unsigned)) as max_no"))
            ->value('max_no');
        $nextNumber = ((int) $lastNumber) + 1;
        $noTtInv = $ttPrefix.str_pad((string) $nextNumber, 7, '0', STR_PAD_LEFT);

        $tglDoc = $date
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $date)->format('d.m.Y')
            : null;
        $tglPos = \Carbon\Carbon::now()->format('d.m.Y');

        DB::transaction(function () use (
            $invoices,
            $noTtInv,
            $tglDoc,
            $tglPos,
            $grandTotal
        ) {
            DB::table('tb_kdttinv')->insert([
                'no_ttinv' => $noTtInv,
                'tgl_doc' => $tglDoc,
                'g_total' => $grandTotal,
                'nm_penerima' => ' ',
                'tgl_terima' => ' ',
                'tgl_pos' => $tglPos,
            ]);

            foreach ($invoices as $index => $row) {
                DB::table('tb_ttinv')->insert([
                    'no_ttinv' => $noTtInv,
                    'no' => $index + 1,
                    'no_inv' => $row['no_inv'] ?? '',
                    'no_faktur' => $row['no_faktur'] ?? '',
                    'tgl' => $row['tgl'] ?? '',
                    'nm_cs' => $row['nm_cs'] ?? '',
                    'ref_po' => $row['ref_po'] ?? '',
                    'total' => $row['total'] ?? 0,
                    'remark' => $row['remark'] ?? '-',
                    'nm_penerima' => ' ',
                    'tgl_terima' => ' ',
                    'tgl_doc' => $tglDoc,
                    'tgl_pos' => $tglPos,
                ]);
            }
        });

        return response()->json([
            'message' => 'Tanda terima berhasil dibuat.',
            'no_ttinv' => $noTtInv,
        ]);
    }

    public function update(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        $date = $request->input('date');
        $invoices = $request->input('invoices', []);

        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima wajib diisi.',
            ], 422);
        }

        if (!is_array($invoices) || count($invoices) === 0) {
            return response()->json([
                'message' => 'Data invoice wajib diisi.',
            ], 422);
        }

        $tglDoc = $date
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $date)->format('d.m.Y')
            : null;
        $tglPos = \Carbon\Carbon::now()->format('d.m.Y');

        DB::transaction(function () use ($noTtInv, $invoices, $tglDoc, $tglPos) {
            DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->update([
                    'tgl_doc' => $tglDoc,
                    'tgl_pos' => $tglPos,
                ]);

            $existing = DB::table('tb_ttinv')
                ->select('no_inv', 'no_faktur', 'ref_po')
                ->where('no_ttinv', $noTtInv)
                ->get();

            $existingKeys = $existing->map(function ($item) {
                return implode('|', [
                    (string) ($item->no_inv ?? ''),
                    (string) ($item->no_faktur ?? ''),
                    (string) ($item->ref_po ?? ''),
                ]);
            })->toArray();

            $grandTotal = 0;
            foreach ($invoices as $index => $row) {
                $noInv = $row['no_inv'] ?? '';
                $noFaktur = $row['no_faktur'] ?? '';
                $refPo = $row['ref_po'] ?? '';
                $total = $row['total'] ?? 0;
                $remark = $row['remark'] ?? '-';

                $key = implode('|', [$noInv, $noFaktur, $refPo]);
                $grandTotal += (float) $total;

                if (in_array($key, $existingKeys, true)) {
                    DB::table('tb_ttinv')
                        ->where('no_ttinv', $noTtInv)
                        ->where('no_inv', $noInv)
                        ->where('no_faktur', $noFaktur)
                        ->where('ref_po', $refPo)
                        ->update([
                            'remark' => $remark,
                            'tgl_doc' => $tglDoc,
                            'tgl_pos' => $tglPos,
                        ]);
                } else {
                    DB::table('tb_ttinv')->insert([
                        'no_ttinv' => $noTtInv,
                        'no' => $index + 1,
                        'no_inv' => $noInv,
                        'no_faktur' => $noFaktur,
                        'tgl' => $row['tgl'] ?? '',
                        'nm_cs' => $row['nm_cs'] ?? '',
                        'ref_po' => $refPo,
                        'total' => $total,
                        'remark' => $remark,
                        'nm_penerima' => ' ',
                        'tgl_terima' => ' ',
                        'tgl_doc' => $tglDoc,
                        'tgl_pos' => $tglPos,
                    ]);
                }
            }

            DB::table('tb_kdttinv')
                ->where('no_ttinv', $noTtInv)
                ->update([
                    'tgl_doc' => $tglDoc,
                    'tgl_pos' => $tglPos,
                    'g_total' => $grandTotal,
                ]);
        });

        return response()->json([
            'message' => 'Tanda terima berhasil diperbarui.',
        ]);
    }

    public function updateRemark(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        $noInv = $request->input('no_inv');
        $noFaktur = $request->input('no_faktur');
        $refPo = $request->input('ref_po');
        $remark = $request->input('remark', '-');

        if (!$noTtInv || !$noInv) {
            return response()->json([
                'message' => 'Data tidak lengkap.',
            ], 422);
        }

        DB::table('tb_ttinv')
            ->where('no_ttinv', $noTtInv)
            ->where('no_inv', $noInv)
            ->where('no_faktur', $noFaktur)
            ->where('ref_po', $refPo)
            ->update(['remark' => $remark]);

        return response()->json([
            'message' => 'Remark berhasil diperbarui.',
        ]);
    }

    public function deleteItem(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        $noInv = $request->input('no_inv');
        $noFaktur = $request->input('no_faktur');
        $refPo = $request->input('ref_po');

        if (!$noTtInv || !$noInv) {
            return response()->json([
                'message' => 'Data tidak lengkap.',
            ], 422);
        }

        DB::transaction(function () use ($noTtInv, $noInv, $noFaktur, $refPo) {
            $query = DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->where('no_inv', $noInv);

            if ($noFaktur !== null) {
                $query->where('no_faktur', $noFaktur);
            }
            if ($refPo !== null) {
                $query->where('ref_po', $refPo);
            }

            $query->delete();

            $grandTotal = DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

            DB::table('tb_kdttinv')
                ->where('no_ttinv', $noTtInv)
                ->update(['g_total' => $grandTotal]);
        });

        return response()->json([
            'message' => 'Data invoice berhasil dihapus.',
        ]);
    }

    public function addItem(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        $noInv = $request->input('no_inv');
        $noFaktur = $request->input('no_faktur');
        $tgl = $request->input('tgl');
        $tglDoc = $request->input('tgl_doc');
        $nmCs = $request->input('nm_cs');
        $refPo = $request->input('ref_po');
        $total = $request->input('total', 0);
        $remark = $request->input('remark', '-');

        if (!$noTtInv || !$noInv) {
            return response()->json([
                'message' => 'Data tidak lengkap.',
            ], 422);
        }

        if (!$tglDoc) {
            $tglDoc = $tgl;
        }

        DB::transaction(function () use (
            $noTtInv,
            $noInv,
            $noFaktur,
            $tgl,
            $tglDoc,
            $nmCs,
            $refPo,
            $total,
            $remark
        ) {
            $exists = DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->where('no_inv', $noInv)
                ->exists();

            if (!$exists) {
                $nextNo = DB::table('tb_ttinv')
                    ->where('no_ttinv', $noTtInv)
                    ->max('no');
                $nextNo = ((int) $nextNo) + 1;

                DB::table('tb_ttinv')->insert([
                    'no_ttinv' => $noTtInv,
                    'no' => $nextNo,
                    'no_inv' => $noInv,
                    'no_faktur' => $noFaktur,
                    'tgl' => $tgl,
                    'nm_cs' => $nmCs,
                    'ref_po' => $refPo,
                    'total' => $total,
                    'remark' => $remark,
                    'nm_penerima' => ' ',
                    'tgl_terima' => ' ',
                    'tgl_doc' => $tglDoc,
                    'tgl_pos' => \Carbon\Carbon::now()->format('d.m.Y'),
                ]);
            }

            $grandTotal = DB::table('tb_ttinv')
                ->where('no_ttinv', $noTtInv)
                ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

            DB::table('tb_kdttinv')
                ->where('no_ttinv', $noTtInv)
                ->update(['g_total' => $grandTotal]);
        });

        return response()->json([
            'message' => 'Data invoice berhasil ditambahkan.',
        ]);
    }

    public function deleteHeader(Request $request)
    {
        $noTtInv = $request->input('no_ttinv');
        if (!$noTtInv) {
            return response()->json([
                'message' => 'Nomor tanda terima tidak ditemukan.',
            ], 422);
        }

        DB::transaction(function () use ($noTtInv) {
            DB::table('tb_ttinv')->where('no_ttinv', $noTtInv)->delete();
            DB::table('tb_kdttinv')->where('no_ttinv', $noTtInv)->delete();
        });

        return response()->json([
            'message' => 'Tanda terima berhasil dihapus.',
        ]);
    }

    public function print(Request $request, string $noTtInv = null)
    {
        $noTtInv = $noTtInv ?: $request->query('no_ttinv');
        if (!$noTtInv) {
            return redirect()
                ->route('penjualan.tanda-terima-invoice.index')
                ->with('error', 'Nomor tanda terima tidak ditemukan.');
        }

        $items = DB::table('tb_ttinv')
            ->select('no_ttinv', 'no_inv', 'no_faktur', 'ref_po', 'total', 'remark', 'tgl', 'tgl_doc', 'tgl_pos', 'nm_cs')
            ->where('no_ttinv', $noTtInv)
            ->orderBy('no_inv')
            ->get();

        $header = $items->first();
        $grandTotal = $items->sum(function ($item) {
            return (float) ($item->total ?? 0);
        });

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? $database : null;
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        if (
            !$companyConfig &&
            is_string($lookupKey) &&
            Str::startsWith(Str::lower($lookupKey), 'db')
        ) {
            $altKey = substr($lookupKey, 2);
            $companyConfig = config("tenants.companies.$altKey", []);
            $lookupKey = $companyConfig ? $altKey : $lookupKey;
        }
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", strtoupper($lookupKey))
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('Penjualan/tanda-terima-invoice/print', [
            'header' => $header,
            'items' => $items,
            'grandTotal' => $grandTotal,
            'company' => $company,
        ]);
    }
}
