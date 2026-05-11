<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class InvoiceMasukController
{
    private function normalizeDate(?string $value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function applyDocRecDateFilter(
        $query,
        string $period = 'all',
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): void {
        $today = Carbon::now();

        switch ($period) {
            case 'today':
                $query->whereDate('doc_rec', $today->toDateString());
                break;
            case 'this_week':
                $query->whereBetween('doc_rec', [
                    $today->copy()->startOfWeek()->toDateString(),
                    $today->copy()->endOfWeek()->toDateString(),
                ]);
                break;
            case 'this_month':
                $query->whereBetween('doc_rec', [
                    $today->copy()->startOfMonth()->toDateString(),
                    $today->copy()->endOfMonth()->toDateString(),
                ]);
                break;
            case 'this_year':
                $query->whereBetween('doc_rec', [
                    $today->copy()->startOfYear()->toDateString(),
                    $today->copy()->endOfYear()->toDateString(),
                ]);
                break;
            case 'range':
                $from = $this->normalizeDate($dateFrom);
                $to = $this->normalizeDate($dateTo);
                if ($from) {
                    $query->whereDate('doc_rec', '>=', $from);
                }
                if ($to) {
                    $query->whereDate('doc_rec', '<=', $to);
                }
                break;
            case 'all':
            default:
                break;
        }
    }

    public function index(Request $request)
    {
        $unbilledQuery = DB::table('tb_kdinvin')->where('pembayaran', 0);
        $unbilledCount = (int) $unbilledQuery->count();
        $unbilledTotal = (float) $unbilledQuery->sum('sisa_bayar');

        return Inertia::render('pembelian/invoice-masuk/index', [
            'invoices' => [],
            'summary' => [
                'unbilled_count' => $unbilledCount,
                'unbilled_total' => $unbilledTotal,
            ],
            'filters' => [
                'search' => null,
                'status' => 'belum_dibayar',
                'date_period' => 'today',
                'date_from' => null,
                'date_to' => null,
                'pageSize' => 5,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('pembelian/invoice-masuk/create');
    }

    public function edit(string $noDoc)
    {
        $header = DB::table('tb_kdinvin')->where('no_doc', $noDoc)->first();
        if (!$header) {
            return redirect()
                ->route('pembelian.invoice-masuk.index')
                ->with('error', 'Data invoice tidak ditemukan.');
        }

        $items = DB::table('tb_invin')
            ->where('no_doc', $noDoc)
            ->get();

        return Inertia::render('pembelian/invoice-masuk/edit', [
            'invoice' => $header,
            'invoiceItems' => $items,
        ]);
    }
    public function data(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'belum_dibayar');
        $datePeriod = $request->query('date_period', 'today');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        // pageSize tetap dikirim dari frontend tapi pagination dilakukan di sisi klien
        // agar bisa menampilkan total data untuk kontrol pagination.
        $pageSize = $request->query('pageSize', 5);

        $baseQuery = DB::table('tb_kdinvin');
        $this->applyDocRecDateFilter(
            $baseQuery,
            $datePeriod,
            $dateFrom,
            $dateTo
        );

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

        $unbilledSummaryQuery = DB::table('tb_kdinvin')->where('pembayaran', 0);
        $unbilledCount = (int) $unbilledSummaryQuery->count();
        $unbilledTotal = (float) $unbilledSummaryQuery->sum('sisa_bayar');
        $unbilledInvoices = DB::table('tb_kdinvin')
            ->where('pembayaran', 0)
            ->orderByDesc('no_doc')
            ->get();

        return response()->json([
            'invoices' => $invoices,
            'unbilled_invoices' => $unbilledInvoices,
            'summary' => [
                'unbilled_count' => $unbilledCount,
                'unbilled_total' => $unbilledTotal,
            ],
        ]);
    }

    public function paid(Request $request)
    {
        $search = $request->query('search');
        $period = $request->query('period', 'today');

        $baseQuery = DB::table('tb_kdinvin');

        // Paid invoices: have payment date and payment amount > 0
        $baseQuery->whereNotNull('tgl_bayar')
            ->whereRaw("TRIM(COALESCE(tgl_bayar, '')) <> ''")
            ->whereRaw('COALESCE(pembayaran, 0) > 0');

        if ($search) {
            $term = '%'.trim($search).'%';
            $baseQuery->where(function ($query) use ($term) {
                $query->where('no_doc', 'like', $term)
                    ->orWhere('ref_po', 'like', $term)
                    ->orWhere('nm_vdr', 'like', $term);
            });
        }

        $today = Carbon::now();
        switch ($period) {
            case 'this_week':
                $baseQuery->whereBetween('tgl_bayar', [
                    $today->copy()->startOfWeek()->toDateString(),
                    $today->copy()->endOfWeek()->toDateString(),
                ]);
                break;
            case 'this_month':
                $baseQuery->whereBetween('tgl_bayar', [
                    $today->copy()->startOfMonth()->toDateString(),
                    $today->copy()->endOfMonth()->toDateString(),
                ]);
                break;
            case 'this_year':
                $baseQuery->whereBetween('tgl_bayar', [
                    $today->copy()->startOfYear()->toDateString(),
                    $today->copy()->endOfYear()->toDateString(),
                ]);
                break;
            case 'today':
            default:
                $baseQuery->whereDate('tgl_bayar', $today->toDateString());
                break;
        }

        $baseQuery->orderByDesc('tgl_bayar')->orderByDesc('no_doc');

        $invoices = $baseQuery->get();
        $summary = [
            'paid_count' => (int) $invoices->count(),
            'paid_total' => (float) $invoices->sum('pembayaran'),
        ];

        return response()->json([
            'invoices' => $invoices,
            'summary' => $summary,
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
            ],
            'items' => $items,
        ]);
    }

public function poList(Request $request)
    {
        $search = $request->query('search');
        $pageSize = $request->query('pageSize', 5);

        $query = DB::table('tb_po')
            ->join('tb_detailpo', 'tb_po.no_po', '=', 'tb_detailpo.no_po')
            ->select('tb_po.no_po', 'tb_po.tgl', 'tb_po.ref_poin', 'tb_po.nm_vdr')
            ->whereNotNull('tb_po.no_po')
            ->whereRaw("TRIM(tb_po.no_po) <> ''")
            // Filter PO yang materialnya belum di-invoice masuk
            ->whereRaw("COALESCE(tb_detailpo.qty, 0) = COALESCE(tb_detailpo.ir_mat, 0)")
            // Group by agar nomor PO tidak ganda jika ada banyak material di dalamnya
            ->groupBy('tb_po.no_po', 'tb_po.tgl', 'tb_po.ref_poin', 'tb_po.nm_vdr')
            ->orderByDesc('tb_po.no_po');

        if ($search) {
            $term = '%'.trim($search).'%';
            $query->where(function ($q) use ($term) {
                // Tambahkan prefix tb_po. untuk menghindari ambiguous column name
                $q->where('tb_po.no_po', 'like', $term)
                    ->orWhere('tb_po.ref_poin', 'like', $term)
                    ->orWhere('tb_po.nm_vdr', 'like', $term);
            });
        }

        $data = $pageSize === 'all'
            ? $query->get()
            : $query->limit((int) $pageSize)->get();

        return response()->json(['data' => $data]);
    }
    public function poDetail(Request $request)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['message' => 'No PO wajib diisi'], 400);
        }

        // 1. Ambil header PO
        $header = DB::table('tb_po')
            ->where('no_po', $noPo)
            ->first();

        if (!$header) {
            return response()->json(['message' => 'Data PO tidak ditemukan'], 404);
        }

        // 2. Ambil data detail PO 
        // PASTIKAN BARIS INI ADA AGAR VARIABEL $detail TERBENTUK
        $detail = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->first();

        // 3. Ambil kode vendor
        $vendorCode = DB::table('tb_vendor')
            ->where('nm_vdr', $header->nm_vdr)
            ->value('kd_vdr');

        return response()->json([
            'header' => [
                'no_po' => $header->no_po,
                'ref_po' => $header->no_po,
                'nm_vdr' => $header->nm_vdr,
                'kd_vdr' => $vendorCode,
                // Menggunakan pengecekan $detail ? ... : ... agar aman jika detail kosong
                'customer' => $detail ? $detail->for_cus : null,
                'payment_terms' => $detail ? $detail->payment_terms : null, 
                'ppn' => $detail ? $detail->ppn : 0,
                'ref_quota' => $header->ref_quota ?? null,
            ],
        ]);
    }

    public function poMaterials(Request $request)
    {
        $noPo = $request->query('no_po');
        if (!$noPo) {
            return response()->json(['message' => 'No PO wajib diisi'], 400);
        }

        // Fetch materials dengan filter qty = ir_mat (belum di-invoice)
        $items = DB::table('tb_detailpo')
            ->where('no_po', $noPo)
            ->whereRaw('COALESCE(qty, 0) = COALESCE(ir_mat, 0)')
            ->select('kd_mat', 'material', 'qty', 'unit', 'price')
            ->get();

        // Calculate total_price untuk frontend
        foreach ($items as $item) {
            $item->total_price = (float)$item->qty * (float)$item->price;
        }

        return response()->json(['items' => $items]);
    }


    public function store(Request $request)
    {
        $payload = $request->validate([
            'ref_po' => 'required|string',
            'doc_rec' => 'required|date', // field date
            'inv_d' => 'required|date',   // field date receipt
            'p_term' => 'required|string',
            'nm_vdr' => 'required|string',
            'kd_vdr' => 'required|string',
            'ppn' => 'required',
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
                'p_term' => $payload['p_term'],
                'kd_vdr' => $payload['kd_vdr'],
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
            $kdMaterials = array_unique(array_column($payload['items'], 'kd_mat'));

            // Bulk fetch PO details for all items to avoid N+1 queries
            $poDetails = DB::table('tb_detailpo')
                ->where('no_po', $payload['ref_po'])
                ->whereIn('kd_mat', $kdMaterials)
                ->get()
                ->mapWithKeys(fn($item) => [strtolower($item->kd_mat) => $item]);

            $items = [];
            $rowNo = 1;
            foreach ($payload['items'] as $item) {
                $kdMatLower = strtolower($item['kd_mat']);
                $prev = $poDetails->get($kdMatLower);
                $idPo = $prev->id_po ?? 0;
                $idMi = $prev->id ?? 0;

                $items[] = [
                    'no_doc' => $newCode,
                    't_doc' => $payload['no_receipt'],
                    'ref_po' => $payload['ref_po'],
                    'doc_rec' => $docRecDetail,
                    'inv_d' => $invDateDetail,
                    'p_term' => $payload['p_term'],
                    'kd_vdr' => $payload['kd_vdr'],
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

                // Update tb_detailpo using pre-calculated values
                $newIrMat = (float)$item['qty'] - (float)($prev->ir_mat ?? 0);
                $newIrPrice = (float)$item['total_price'] - (float)($prev->ir_price ?? 0);
                $newEndFl = (float)($prev->end_fl ?? 0) + (float)$item['qty'];

                DB::table('tb_detailpo')
                    ->where('no_po', $payload['ref_po'])
                    ->where('kd_mat', $item['kd_mat'])
                    ->update([
                        'ir_mat' => $newIrMat,
                        'ir_price' => $newIrPrice,
                        'end_fl' => $newEndFl,
                        'end_gr' => DB::raw("COALESCE(end_gr, 0) + " . (float)$item['total_price'])
                    ]);

                // Update tb_mi inv status
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

            $detailItems = DB::table('tb_invin')
                ->where('no_doc', $noDoc)
                ->select('kd_mat', 'qty_gr', 'ttl_harga', 'id_mi')
                ->get();

            if ($refPo && count($detailItems) > 0) {
                foreach ($detailItems as $item) {
                    $miDetail = null;
                    if (isset($item->id_mi) && $item->id_mi > 0) {
                        $miDetail = DB::table('tb_detailpo')->where('id', $item->id_mi)->first();
                    } else {
                        $miDetail = DB::table('tb_detailpo')
                            ->where('no_po', $refPo)
                            ->where('kd_mat', $item->kd_mat)
                            ->first();
                    }

                    if ($miDetail) {
                        // Revert ir_mat and ir_price
                        // Base on store logic: new = input - old => old = input - new
                        $restoredIrMat = (float)($item->qty_gr ?? 0) - (float)($miDetail->ir_mat ?? 0);
                        $restoredIrPrice = (float)($item->ttl_harga ?? 0) - (float)($miDetail->ir_price ?? 0);

                        // Update tb_detailpo
                        DB::table('tb_detailpo')
                            ->where('id', $miDetail->id)
                            ->update([
                                'ir_mat' => $restoredIrMat,
                                'ir_price' => $restoredIrPrice,
                                'end_fl' => DB::raw("COALESCE(end_fl, 0) - " . (float)($item->qty_gr ?? 0)),
                                'end_gr' => DB::raw("COALESCE(end_gr, 0) - " . (float)($item->ttl_harga ?? 0))
                            ]);

                        // Update tb_mi inv status
                        DB::table('tb_mi')
                            ->where('no_doc', $miDetail->no_gudang)
                            ->where('kd_mat', $item->kd_mat)
                            ->update(['inv' => 0]);
                    }
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
