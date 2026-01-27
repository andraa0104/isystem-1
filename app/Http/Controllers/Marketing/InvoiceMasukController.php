<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class InvoiceMasukController
{
    public function index(Request $request)
    {
        return Inertia::render('Pembelian/invoice-masuk/index', [
            'invoices' => [],
            'summary' => [
                'unbilled_count' => 0,
                'unbilled_total' => 0,
            ],
            'filters' => [
                'search' => null,
                'status' => 'all',
                'pageSize' => 5,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Pembelian/invoice-masuk/create');
    }

    public function edit(string $noDoc)
    {
        $header = DB::table('tb_kdinvin')->where('no_doc', $noDoc)->first();
        if (!$header) {
            return redirect()
                ->route('pembelian.invoice-masuk.index')
                ->with('error', 'Data invoice tidak ditemukan.');
        }

        $noGudang = DB::table('tb_kdmi')
            ->where('ref_pr', $header->ref_po)
            ->value('no_doc');

        $items = DB::table('tb_invin')
            ->where('no_doc', $noDoc)
            ->get();

        return Inertia::render('Pembelian/invoice-masuk/edit', [
            'invoice' => $header,
            'invoiceItems' => $items,
            'noGudang' => $noGudang,
        ]);
    }
    public function data(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'all');
        // pageSize tetap dikirim dari frontend tapi pagination dilakukan di sisi klien
        // agar bisa menampilkan total data untuk kontrol pagination.
        $pageSize = $request->query('pageSize', 5);

        $baseQuery = DB::table('tb_kdinvin');

        if ($search) {
            $term = '%'.trim($search).'%';
            $baseQuery->where(function ($query) use ($term) {
                $query->where('no_doc', 'like', $term)
                    ->orWhere('ref_po', 'like', $term)
                    ->orWhere('nm_vdr', 'like', $term);
            });
        }

        switch ($status) {
            case 'belum_dibayar':
                $baseQuery->where('pembayaran', 0);
                break;
            case 'belum_lunas':
                $baseQuery->whereRaw('COALESCE(sisa_bayar, 0) <> 0');
                break;
            case 'belum_dijurnal':
                $baseQuery->where(function ($query) {
                    $query->whereNull('jurnal')
                        ->orWhere('jurnal', '=','')
                        ->orWhere('jurnal', ' =')
                        ->orWhere('jurnal', ' ');
                });
                break;
            case 'all':
            default:
                break;
        }

        $baseQuery->orderByDesc('no_doc');

        // Ambil semua data sesuai filter; pagination dikerjakan di frontend.
        $invoices = $baseQuery->get();

        $unbilledQuery = DB::table('tb_kdinvin')->where('pembayaran', 0);
        $unbilledCount = (int) $unbilledQuery->count();
        $unbilledTotal = (float) $unbilledQuery->sum('sisa_bayar');

        return response()->json([
            'invoices' => $invoices,
            'summary' => [
                'unbilled_count' => $unbilledCount,
                'unbilled_total' => $unbilledTotal,
            ],
        ]);
    }

    public function detail(Request $request, string $noDoc)
    {
        $header = DB::table('tb_kdinvin')
            ->where('no_doc', $noDoc)
            ->first();

        if (!$header) {
            return response()->json([
                'header' => null,
                'items' => [],
                'message' => 'Data invoice tidak ditemukan.',
            ], 404);
        }

        $noGudang = DB::table('tb_kdmi')
            ->where('ref_pr', $header->ref_po)
            ->value('no_doc');

        $items = DB::table('tb_invin')
            ->where('no_doc', $noDoc)
            ->get();

        return response()->json([
            'header' => [
                'no_doc' => $header->no_doc,
                't_doc' => $header->t_doc,
                'ref_po' => $header->ref_po,
                'doc_rec' => $header->doc_rec,
                'inv_d' => $header->inv_d,
                'post' => $header->post,
                'p_term' => $header->p_term,
                'nm_vdr' => $header->nm_vdr,
                'a_idr' => $header->a_idr,
                'tax' => $header->tax,
                'total' => $header->total,
                'pembayaran' => $header->pembayaran,
                'sisa_bayar' => $header->sisa_bayar,
                'tgl_bayar' => $header->tgl_bayar,
                'no_gudang' => $noGudang,
            ],
            'items' => $items,
        ]);
    }

    public function poList(Request $request)
    {
        $search = $request->query('search');
        $pageSize = $request->query('pageSize', 5);

        $query = DB::table('tb_kdmi')
            ->select('no_doc', 'ref_pr', 'vdr', 'posting_tgl')
            ->orderByDesc('no_doc');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('no_doc', 'like', $term)
                    ->orWhere('ref_pr', 'like', $term)
                    ->orWhere('vdr', 'like', $term);
            });
        }

        $data = $pageSize === 'all'
            ? $query->get()
            : $query->limit((int) $pageSize)->get();

        return response()->json(['data' => $data]);
    }

    public function poDetail(Request $request)
    {
        $noGudang = $request->query('no_gudang');
        if (!$noGudang) {
            return response()->json(['message' => 'No gudang wajib diisi'], 400);
        }

        $header = DB::table('tb_kdmi')
            ->where('no_doc', $noGudang)
            ->first();

        if (!$header) {
            return response()->json(['message' => 'Data gudang tidak ditemukan'], 404);
        }

        $vendorCode = DB::table('tb_vendor')
            ->where('nm_vdr', $header->vdr)
            ->value('kd_vdr');

        $poDetail = DB::table('tb_detailpo')
            ->where('no_po', $header->ref_pr)
            ->first();

        return response()->json([
            'header' => [
                'no_gudang' => $header->no_doc,
                'ref_po' => $header->ref_pr,
                'vendor' => $header->vdr,
                'kd_vdr' => $vendorCode,
                'payment_terms' => $poDetail->payment_terms ?? null,
                'ppn' => $poDetail->ppn ?? 0,
            ],
        ]);
    }

    public function poMaterials(Request $request)
    {
        $noGudang = $request->query('no_gudang');
        if (!$noGudang) {
            return response()->json(['message' => 'No gudang wajib diisi'], 400);
        }

        $items = DB::table('tb_mi')
            ->where('no_doc', $noGudang)
            ->select('kd_mat', 'material', 'qty', 'unit', 'price', 'total_price')
            ->get();

        return response()->json(['items' => $items]);
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'ref_po' => 'required|string',
            'doc_rec' => 'required|date', // field date
            'inv_d' => 'required|date',   // field date receipt
            'p_term' => 'nullable|string',
            'nm_vdr' => 'required|string',
            'kd_vdr' => 'nullable|string',
            'ppn' => 'nullable',
            'a_idr' => 'required|numeric',   // subtotal
            'tax' => 'required|numeric',     // price ppn
            'total' => 'required|numeric',   // grand total
            'no_receipt' => 'required|string', // t_doc
            'no_gudang' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.kd_mat' => 'required|string',
            'items.*.material' => 'required|string',
            'items.*.qty' => 'required|numeric',
            'items.*.unit' => 'required|string',
            'items.*.price' => 'required|numeric',
            'items.*.total_price' => 'required|numeric',
        ]);

        // Header (tb_kdinvin) simpan format Y-m-d; detail (tb_invin) ikuti permintaan dd.mm.yyyy
        $postDate = Carbon::now()->format('Y-m-d');
        $docRec = Carbon::parse($payload['doc_rec'])->format('Y-m-d');
        $invDate = Carbon::parse($payload['inv_d'])->format('Y-m-d');
        $postDateDetail = Carbon::now()->format('d.m.Y');
        $docRecDetail = Carbon::parse($payload['doc_rec'])->format('d.m.Y');
        $invDateDetail = Carbon::parse($payload['inv_d'])->format('d.m.Y');
        // PPN tidak disimpan ke kolom tersendiri (kolom ppn tidak ada), tetapi tetap dihitung di frontend.

        $cleanDecimal = function ($val) {
            if ($val === null || $val === '') {
                return '0';
            }
            $str = preg_replace('/[^0-9,.\-]/', '', (string) $val);
            $str = str_replace(',', '.', $str);
            if ($str === '' || $str === '-' || $str === '.')
                return '0';
            return $str;
        };

        $mul = function ($a, $b, $scale = 8) {
            return function_exists('bcmul')
                ? bcmul($a, $b, $scale)
                : number_format((float)$a * (float)$b, $scale, '.', '');
        };
        $add = function ($a, $b, $scale = 8) {
            return function_exists('bcadd')
                ? bcadd($a, $b, $scale)
                : number_format((float)$a + (float)$b, $scale, '.', '');
        };
        $trimZeros = function ($v) {
            return rtrim(rtrim($v, '0'), '.');
        };

        // Hitung ulang subtotal berbasis price * qty dengan presisi 8 desimal
        $subTotalStr = '0';
        foreach ($payload['items'] as $itm) {
            $price = $cleanDecimal($itm['price']);
            $qty = $cleanDecimal($itm['qty']);
            $subTotalStr = $add($subTotalStr, $mul($price, $qty));
        }
        $subTotalStr = $trimZeros($subTotalStr);

        // Gunakan nilai tax & total dari frontend apa adanya (setelah dibersihkan)
        $taxValueStr = $cleanDecimal($payload['tax']);      // biarkan nol di akhir
        $totalValueStr = $cleanDecimal($payload['total']);  // biarkan nol di akhir

        DB::beginTransaction();
        try {
            $lastCode = DB::table('tb_kdinvin')
                ->where('no_doc', 'like', 'FI%')
                ->orderByDesc('no_doc')
                ->value('no_doc');
            $lastNumber = $lastCode ? (int) substr($lastCode, 2) : 0;
            $newNumber = $lastNumber + 1;
            $newCode = 'FI'.str_pad((string) $newNumber, 8, '0', STR_PAD_LEFT);

            DB::table('tb_kdinvin')->insert([
                'no_doc' => $newCode,
                't_doc' => $payload['no_receipt'],
                'ref_po' => $payload['ref_po'],
                'doc_rec' => $docRec,
                'inv_d' => $invDate,
                'post' => $postDate,
                'p_term' => $payload['p_term'] ?? null,
                'kd_vdr' => $payload['kd_vdr'] ?? null,
                'nm_vdr' => $payload['nm_vdr'],
                'a_idr' => $subTotalStr,
                'tax' => $taxValueStr,
                'total' => $totalValueStr,
                'pembayaran' => 0,
                'sisa_bayar' => $totalValueStr,
                'tgl_bayar' => null,
                'Jumlah_PDO' => 0,
                'jurnal' => ' ',
            ]);

            $items = [];
            $rowNo = 1;
            foreach ($payload['items'] as $item) {
                $idPo = DB::table('tb_detailpo')
                    ->where('no_po', $payload['ref_po'])
                    ->where('kd_mat', $item['kd_mat'])
                    ->value('id_po');

                $idMi = DB::table('tb_mi')
                    ->where('no_doc', $payload['no_gudang'])
                    ->where('kd_mat', $item['kd_mat'])
                    ->value('id');

                $items[] = [
                    'no_doc' => $newCode,
                    't_doc' => $payload['no_receipt'],
                    'ref_po' => $payload['ref_po'],
                    'doc_rec' => $docRecDetail,
                    'inv_d' => $invDateDetail,
                    'p_term' => $payload['p_term'] ?? null,
                    'kd_vdr' => $payload['kd_vdr'] ?? null,
                    'nm_vdr' => $payload['nm_vdr'],
                    'a_idr' => $subTotalStr,
                    'tax' => $taxValueStr,
                    'no' => $rowNo++,
                    'kd_mat' => $item['kd_mat'],
                    'mat' => $item['material'],
                    'qty_gr' => $item['qty'],
                    'unit' => $item['unit'] ?? null,
                    'harga' => $item['price'],
                    'ttl_harga' => $item['total_price'],
                    'rest_po' => 0,
                    'post' => $postDateDetail,
                    'id_po' => $idPo,
                    'id_mi' => $idMi,
                ];

                DB::table('tb_mi')
                    ->where('no_doc', $payload['no_gudang'])
                    ->where('kd_mat', $item['kd_mat'])
                    ->update(['inv' => 1]);
            }

            DB::table('tb_invin')->insert($items);

            DB::commit();

            return redirect()
                ->route('pembelian.invoice-masuk.index')
                ->with('success', 'Invoice masuk berhasil disimpan.');
        } catch (\Throwable $e) {
            DB::rollBack();
            return redirect()
                ->back()
                ->with('error', 'Gagal menyimpan invoice: '.$e->getMessage());
        }
    }

    public function update(Request $request, string $noDoc)
    {
        $payload = $request->validate([
            'doc_rec' => 'required|date',
            'inv_d' => 'required|date',
            'no_receipt' => 'required|string',
        ]);

        $docRec = Carbon::parse($payload['doc_rec'])->format('Y-m-d');
        $invDate = Carbon::parse($payload['inv_d'])->format('Y-m-d');
        $docRecDetail = Carbon::parse($payload['doc_rec'])->format('d.m.Y');
        $invDateDetail = Carbon::parse($payload['inv_d'])->format('d.m.Y');

        DB::beginTransaction();
        try {
            DB::table('tb_kdinvin')
                ->where('no_doc', $noDoc)
                ->update([
                    't_doc' => $payload['no_receipt'],
                    'doc_rec' => $docRec,
                    'inv_d' => $invDate,
                ]);

            DB::table('tb_invin')
                ->where('no_doc', $noDoc)
                ->update([
                    't_doc' => $payload['no_receipt'],
                    'doc_rec' => $docRecDetail,
                    'inv_d' => $invDateDetail,
                ]);

            DB::commit();

            return redirect()
                ->route('pembelian.invoice-masuk.index')
                ->with('success', 'Invoice masuk berhasil diperbarui.');
        } catch (\Throwable $e) {
            DB::rollBack();
            return redirect()
                ->back()
                ->with('error', 'Gagal memperbarui invoice: '.$e->getMessage());
        }
    }

    public function destroy(Request $request, string $noDoc)
    {
        DB::beginTransaction();
        try {
            $header = DB::table('tb_kdinvin')->where('no_doc', $noDoc)->first();
            if (!$header) {
                return redirect()
                    ->back()
                    ->with('error', 'Data invoice tidak ditemukan.');
            }

            $refPo = $request->input('ref_po') ?: $header->ref_po;
            if (!$refPo) {
                $refPo = DB::table('tb_invin')
                    ->where('no_doc', $noDoc)
                    ->value('ref_po');
            }

            // update tb_detailpo dulu sebelum data invoice dihapus
            if ($refPo) {
                DB::table('tb_detailpo')
                    ->where('no_po', $refPo)
                    ->update([
                        'end_fl' => 0,
                        'end_gr' => 0,
                    ]);
            }

            $detailItems = DB::table('tb_invin')
                ->where('no_doc', $noDoc)
                ->select('kd_mat', 'qty_gr', 'ttl_harga')
                ->get();

            if ($refPo) {
                foreach ($detailItems as $item) {
                    DB::table('tb_detailpo')
                        ->where('no_po', $refPo)
                        ->where('kd_mat', $item->kd_mat)
                        ->update([
                            'gr_mat' => $item->qty_gr ?? 0,
                            'gr_price' => $item->ttl_harga ?? 0,
                        ]);
                }
            }

            DB::table('tb_invin')->where('no_doc', $noDoc)->delete();
            DB::table('tb_kdinvin')->where('no_doc', $noDoc)->delete();

            DB::commit();

            return redirect()
                ->back()
                ->with('success', 'Invoice berhasil dihapus.');
        } catch (\Throwable $e) {
            DB::rollBack();
            return redirect()
                ->back()
                ->with('error', 'Gagal menghapus invoice: '.$e->getMessage());
        }
    }
}
