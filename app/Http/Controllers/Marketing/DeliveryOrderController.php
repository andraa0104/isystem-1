<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class DeliveryOrderController
{
    private function materialWarehouseOptions(array $kdMaterials)
    {
        $kdMaterials = collect($kdMaterials)->filter()->unique()->values()->all();
        if (empty($kdMaterials) || !Schema::hasTable('tb_barang')) {
            return collect();
        }

        $rows = DB::table('tb_barang')
            ->whereIn('kd_material', $kdMaterials)
            ->get([
                'kd_material',
                'stok_g1',
                'stok_g2',
                'stok_g3',
                'stok_g4',
                'katagori_stok1',
                'katagori_stok2',
                'katagori_stok3',
                'katagori_stok4',
                'harga_stokg1',
                'harga_stokg2',
                'harga_stokg3',
                'harga_stokg4',
            ]);

        return $rows->mapWithKeys(function ($row) {
            $options = collect([
                ['value' => 'g1', 'gudang' => 'G1', 'kategori' => $row->katagori_stok1 ?? '', 'stock' => $row->stok_g1 ?? 0, 'price' => $row->harga_stokg1 ?? 0],
                ['value' => 'g2', 'gudang' => 'G2', 'kategori' => $row->katagori_stok2 ?? '', 'stock' => $row->stok_g2 ?? 0, 'price' => $row->harga_stokg2 ?? 0],
                ['value' => 'g3', 'gudang' => 'G3', 'kategori' => $row->katagori_stok3 ?? '', 'stock' => $row->stok_g3 ?? 0, 'price' => $row->harga_stokg3 ?? 0],
                ['value' => 'g4', 'gudang' => 'G4', 'kategori' => $row->katagori_stok4 ?? '', 'stock' => $row->stok_g4 ?? 0, 'price' => $row->harga_stokg4 ?? 0],
            ])->filter(fn ($option) => $this->parseNumber($option['stock']) > 0)
                ->map(function ($option) {
                    $kategori = trim((string) ($option['kategori'] ?? ''));
                    $option['label'] = $kategori !== ''
                        ? "{$option['gudang']} - {$kategori}"
                        : $option['gudang'];
                    $option['stock'] = $this->parseNumber($option['stock']);
                    $option['price'] = $this->parseNumber($option['price']);
                    return $option;
                })
                ->values();

            return [(string) $row->kd_material => $options];
        });
    }

    private function selectedWarehouseOption(?string $kdMaterial, mixed $warehouseCode): ?array
    {
        if (!$kdMaterial) {
            return null;
        }

        $options = $this->materialWarehouseOptions([$kdMaterial])->get($kdMaterial, collect());
        if ($options->isEmpty()) {
            return null;
        }

        $selected = strtolower(trim((string) $warehouseCode));
        return $options->firstWhere('value', $selected) ?? $options->first();
    }

    private function warehouseStockColumn(mixed $warehouseCode): ?string
    {
        return match (strtolower(trim((string) $warehouseCode))) {
            'g1' => 'stok_g1',
            'g2' => 'stok_g2',
            'g3' => 'stok_g3',
            'g4' => 'stok_g4',
            default => null,
        };
    }

    private function zeroedWarehousePayload(string $stockColumn, mixed $stockValue): array
    {
        $payload = [$stockColumn => $stockValue];
        if ($this->parseNumber($stockValue) > 0) {
            return $payload;
        }

        $suffix = match ($stockColumn) {
            'stok_g1' => '1',
            'stok_g2' => '2',
            'stok_g3' => '3',
            'stok_g4' => '4',
            default => null,
        };

        if (!$suffix) {
            return $payload;
        }

        $hargaColumn = "harga_stokg{$suffix}";
        $kategoriColumn = "katagori_stok{$suffix}";
        $alternateKategoriColumn = "kategori_stok{$suffix}";

        if (Schema::hasColumn('tb_barang', $hargaColumn)) {
            $payload[$hargaColumn] = 0.00;
        }
        if (Schema::hasColumn('tb_barang', $kategoriColumn)) {
            $payload[$kategoriColumn] = 0;
        }
        if (Schema::hasColumn('tb_barang', $alternateKategoriColumn)) {
            $payload[$alternateKategoriColumn] = 0;
        }

        return $payload;
    }

    private function parseNumber($value): float
    {
        if ($value === null) {
            return 0.0;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $clean = str_replace(',', '', (string) $value);
        return is_numeric($clean) ? (float) $clean : 0.0;
    }

    private function nextMibNoDoc(): string
    {
        $last = DB::table('tb_kdmib')
            ->select('no_doc')
            ->where('no_doc', 'like', 'MIB%')
            ->orderByDesc('no_doc')
            ->lockForUpdate()
            ->first();

        $lastNum = 0;
        if ($last && isset($last->no_doc)) {
            $digits = preg_replace('/\D+/', '', (string) $last->no_doc);
            if ($digits !== '') {
                $lastNum = (int) $digits;
            }
        }

        return 'MIB' . str_pad((string) ($lastNum + 1), 7, '0', STR_PAD_LEFT);
    }

    private function restoreDeletedMaterialsToStockAndMib($rows, string $sourceDocNo): void
    {
        if ($rows->isEmpty() || !Schema::hasTable('tb_material')) {
            return;
        }

        $mibRows = [];

        foreach ($rows as $row) {
            $qty = $this->parseNumber($row->qty ?? 0);
            $doHarga = $this->parseNumber($row->harga ?? 0);
            $matName = trim((string) ($row->mat ?? ''));
            $kdMat = trim((string) ($row->kd_mat ?? ''));

            if ($qty <= 0 || ($kdMat === '' && $matName === '')) {
                continue;
            }

            $materialQuery = DB::table('tb_material');
            if ($kdMat !== '') {
                $materialQuery->where('kd_material', $kdMat);
            } else {
                $materialQuery->whereRaw('lower(trim(material)) = ?', [strtolower($matName)]);
            }

            $materialRow = $materialQuery->first();
            if (!$materialRow) {
                continue;
            }

            $materialHarga = $this->parseNumber($materialRow->harga ?? 0);
            $sameMainStockPrice = $materialHarga === 0.0 || abs($materialHarga - $doHarga) <= 0.000001;

            if ($sameMainStockPrice) {
                $materialUpdate = [];
                if (Schema::hasColumn('tb_material', 'stok')) {
                    $materialUpdate['stok'] = $this->parseNumber($materialRow->stok ?? 0) + $qty;
                }
                if (Schema::hasColumn('tb_material', 'rest_stock')) {
                    $materialUpdate['rest_stock'] = $this->parseNumber($materialRow->rest_stock ?? 0) + $qty;
                }
                if (Schema::hasColumn('tb_material', 'harga')) {
                    $materialUpdate['harga'] = $doHarga;
                }

                if (!empty($materialUpdate)) {
                    DB::table('tb_material')
                        ->where('kd_material', $materialRow->kd_material)
                        ->update($materialUpdate);
                }

                continue;
            }

            $mibRows[] = [
                'no' => $row->no ?? count($mibRows) + 1,
                'kd_mat' => $materialRow->kd_material,
                'material' => $materialRow->material ?? $matName,
                'qty' => $qty,
                'unit' => (string) ($row->unit ?? ''),
                'price' => $doHarga,
                'total_price' => $this->parseNumber($row->total ?? 0) ?: ($qty * $doHarga),
            ];
        }

        if (empty($mibRows) || !Schema::hasTable('tb_kdmib') || !Schema::hasTable('tb_mib')) {
            return;
        }

        $noDoc = $this->nextMibNoDoc();
        $today = now()->format('d.m.Y');
        $sourceText = "HAPUS MATERIAL DARI {$sourceDocNo}";
        $header = [
            'no_doc' => $noDoc,
            'ref_po' => $sourceText,
            'ref_pr' => $sourceText,
            'vdr' => $sourceText,
            'doc_tgl' => $today,
            'posting_tgl' => $today,
        ];
        $header = array_filter($header, fn ($_, $col) => Schema::hasColumn('tb_kdmib', $col), ARRAY_FILTER_USE_BOTH);
        DB::table('tb_kdmib')->insert($header);

        $mibColumns = Schema::getColumnListing('tb_mib');
        $inserts = array_map(function ($row) use ($noDoc, $mibColumns) {
            $insert = [
                'no_doc' => $noDoc,
                'no' => $row['no'],
                'kd_mat' => $row['kd_mat'],
                'material' => $row['material'],
                'qty' => $row['qty'],
                'rest_mat' => $row['qty'],
                'unit' => $row['unit'],
                'price' => $row['price'],
                'total_price' => $row['total_price'],
                'transfer' => 0,
                'id_po' => 0,
                'keterangan' => 'STOK',
            ];

            return array_intersect_key($insert, array_flip($mibColumns));
        }, $mibRows);

        DB::table('tb_mib')->insert($inserts);
    }

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');
        
        return Inertia::render('marketing/delivery-order/index', [
            'deliveryOrders' => [],
            'outstandingCount' => 0,
            'realizedCount' => 0,
            'outstandingTotal' => 0,
            'realizedTotal' => 0,
            'period' => $period,
        ]);
    }

    public function data(Request $request)
    {
        $period = $request->query('period', 'today');
        $fetchType = $request->query('fetch_type', 'all'); 
        
        $now = now();
        $year = $now->format('Y');
        $month = $now->format('m');
        $todayDate = $now->format('Y-m-d');

        $dateExpression = fn ($column) => "coalesce(date($column), str_to_date($column, '%d.%m.%Y'), str_to_date($column, '%d-%m-%Y'), str_to_date($column, '%d/%m/%Y'), str_to_date($column, '%Y-%m-%d'))";

        $applyDateFilter = function ($query, $column) use ($period, $now, $year, $month, $todayDate, $request, $dateExpression) {
            $expr = $dateExpression($column);

            if ($period === 'today') {
                $query->whereRaw("date($expr) = ?", [$todayDate]);
            } elseif ($period === 'this_month') {
                $query->whereRaw("year($expr) = ? and month($expr) = ?", [$year, $month]);
            } elseif ($period === 'this_year') {
                $query->whereRaw("year($expr) = ?", [$year]);
            } elseif ($period === 'this_week') {
                $start = $now->startOfWeek()->toDateString();
                $end = $now->endOfWeek()->toDateString();
                $query->whereRaw("date($expr) BETWEEN ? AND ?", [$start, $end]);
            } elseif ($period === 'range') {
                $startDate = $request->query('start_date');
                $endDate = $request->query('end_date');
                if ($startDate && $endDate) {
                    $query->whereRaw("date($expr) BETWEEN ? AND ?", [$startDate, $endDate]);
                }
            }
        };

        $response = ['period' => $period];

        if ($fetchType === 'table' || $fetchType === 'all') {
            $deliveryOrdersQuery = DB::table('tb_do')
                ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
                ->distinct()
                ->orderBy('no_do', 'desc')
                ->orderBy('date', 'desc');

            if ($period !== 'all') {
                $applyDateFilter($deliveryOrdersQuery, "coalesce(nullif(tb_do.pos_tgl, ''), tb_do.date)");
            }

            if ($period === 'all') {
                $deliveryOrdersQuery->limit(5000);
            }

            $response['deliveryOrders'] = $deliveryOrdersQuery->get();
        }

        if ($fetchType === 'summary' || $fetchType === 'all') {
            $outstandingListQuery = DB::table('tb_do')
                ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
                ->where('val_inv', 0)
                ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv');

            $response['outstandingCount'] = DB::query()
                ->fromSub($outstandingListQuery, 'outstanding_do')
                ->count();

            $response['outstandingTotal'] = DB::table('tb_do')
                ->where('val_inv', 0)
                ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

            $realizedQuery = DB::table('tb_kddo as k')
                ->join('tb_fakturpenjualan as f', function ($join) {
                    $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_do))'));
                });

            if ($period !== 'all') {
                $applyDateFilter($realizedQuery, 'f.tgl_pos');
            }

            $realizedNos = $realizedQuery->distinct('k.no_do')->pluck('k.no_do');
            $response['realizedCount'] = $realizedNos->count();

            if ($realizedNos->isEmpty()) {
                $response['realizedTotal'] = 0;
            } else {
                $response['realizedTotal'] = (float) DB::table('tb_do')
                    ->whereIn(DB::raw('lower(trim(no_do))'), $realizedNos->map(fn ($n) => strtolower(trim($n))))
                    ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));
            }
        }

        return response()->json($response);
    }

    public function update(Request $request, $noDo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Data DO tidak ditemukan.');
        }

        try {
            $dateInput = $request->input('date');
            $formattedDate = $dateInput;
            try {
                $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
            } catch (\Throwable $e) {
                $formattedDate = $dateInput;
            }

            DB::transaction(function () use ($noDo, $formattedDate, $request) {
                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->update([
                        'date' => $formattedDate,
                    ]);

                DB::table('tb_kddo')
                    ->where('no_do', $noDo)
                    ->update([
                        'tgl' => $formattedDate,
                    ]);
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal memperbarui data: ' . $e->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil diperbarui.');
            return inertia_location('/marketing/delivery-order');
        }

        return back()->with('success', 'Data DO berhasil diperbarui.');
    }

    public function details(Request $request)
    {
        $noDo = $request->query('no_do');
        if (!$noDo) {
            return response()->json([
                'deliveryOrderDetails' => [],
                'customerAddress' => null,
            ]);
        }

        $query = DB::table('tb_do')
            ->select('no_do', 'mat', 'qty', 'unit', 'harga', 'total', 'remark', 'nm_cs', 'ref_po')
            ->where('no_do', $noDo);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('mat', 'like', "%{$search}%");
        }

        if ($request->boolean('realized_only')) {
            $query->whereIn('ref_po', function($sub) use ($noDo) {
                $sub->select('ref_po')
                    ->from('tb_fakturpenjualan')
                    ->where('no_do', $noDo);
            });
        } 
        // Pastikan tidak ada tutup kurung kurawal ekstra '}' di area ini

        $deliveryOrderDetails = $query->orderBy('no_do')->get();

        $first = $deliveryOrderDetails->first();
        $customerAddress = null;
        if ($first?->nm_cs) {
            $customerAddress = DB::table('tb_cs')
                ->where('nm_cs', $first->nm_cs)
                ->value('alamat_cs');
        }

        return response()->json([
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
        ]);
    }

    public function outstanding(Request $request)
    {
        // KEMBALIKAN KE get() AGAR MODAL TIDAK KOSONG
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->where('val_inv', 0)
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'val_inv')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');
        $now = now();
        $year = $now->format('Y');
        $month = $now->format('m');
        $todayDate = $now->format('Y-m-d');
        $todayDot = $now->format('d.m.Y');

        // [PENERAPAN] Buat kunci cache dinamis berdasarkan tanggal
        $cacheKey = 'do_realized_' . $period;
        if ($period === 'today') {
            $cacheKey .= '_' . $todayDate;
        } elseif ($period === 'this_month') {
            $cacheKey .= '_' . $year . '_' . $month;
        } elseif ($period === 'this_year') {
            $cacheKey .= '_' . $year;
        } elseif ($period === 'this_week') {
            $cacheKey .= '_' . $now->startOfWeek()->toDateString();
        }

        // [PENERAPAN] Simpan hasil ke dalam Valkey Cache
        $cachedData = \Illuminate\Support\Facades\Cache::tags(['do_data'])->remember($cacheKey, 86400, function () use ($period, $now, $year, $month, $todayDate, $todayDot) {
            $query = DB::table('tb_kddo as k')
                ->join('tb_fakturpenjualan as f', function ($join) {
                    $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_do))'));
                })
                ->select(
                    'k.no_do',
                    'k.pos_tgl as date',
                    'k.ref_po',
                    'f.nm_cs'
                )
                ->distinct();

            if ($period === 'today') {
                $query->where(function($q) use ($todayDate, $todayDot) {
                    $q->whereDate('f.tgl_pos', $todayDate)
                      ->orWhere('f.tgl_pos', $todayDot)
                      ->orWhere('f.tgl_pos', 'like', $todayDate . '%');
                });
            } elseif ($period === 'this_month') {
                $query->where(function($q) use ($month, $year) {
                    $q->whereYear('f.tgl_pos', $year)->whereMonth('f.tgl_pos', $month)
                      ->orWhere('f.tgl_pos', 'like', "%.{$month}.{$year}%")
                      ->orWhere('f.tgl_pos', 'like', "%-{$month}-{$year}%")
                      ->orWhere('f.tgl_pos', 'like', "%/{$month}/{$year}%");
                });
            } elseif ($period === 'this_year') {
                $query->where(function($q) use ($year) {
                    $q->whereYear('f.tgl_pos', $year)
                      ->orWhere('f.tgl_pos', 'like', "%.{$year}%")
                      ->orWhere('f.tgl_pos', 'like', "%-{$year}%")
                      ->orWhere('f.tgl_pos', 'like', "%/{$year}%");
                });
            } elseif ($period === 'this_week') {
                $start = $now->startOfWeek()->toDateString();
                $end = $now->endOfWeek()->toDateString();
                $expr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%d.%m.%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%Y-%m-%d'))";
                $query->whereRaw("($expr) BETWEEN ? AND ?", [$start, $end]);
            }

            $deliveryOrders = $query
                ->orderBy('k.pos_tgl', 'desc')
                ->orderBy('k.no_do', 'desc')
                ->get();

            $realizedTotal = DB::table('tb_do')
                ->whereIn(DB::raw('lower(trim(no_do))'), $deliveryOrders->pluck('no_do')->map(fn ($n) => strtolower(trim($n))))
                ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

            return [
                'deliveryOrders' => $deliveryOrders,
                'realizedTotal' => (float) $realizedTotal,
            ];
        });

        return response()->json($cachedData);
    }

    public function print(Request $request, $noDo)
    {
        $deliveryOrderDetails = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'mat', 'qty', 'unit', 'harga', 'total', 'remark')
            ->where('no_do', $noDo)
            ->orderBy('no_do')
            ->get();

        $deliveryOrder = $deliveryOrderDetails->first();

        if (!$deliveryOrder) {
            return redirect()
                ->route('marketing.delivery-order.index')
                ->with('error', 'Data DO tidak ditemukan.');
        }

        $customerAddress = DB::table('tb_cs')
            ->where('nm_cs', $deliveryOrder->nm_cs)
            ->value('alamat_cs');

        $grandTotal = $deliveryOrderDetails
            ->reduce(function ($total, $detail) {
                $value = is_numeric($detail->total ?? null)
                    ? (float) $detail->total
                    : 0.0;

                return $total + $value;
            }, 0.0);

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = $database;
        if (is_string($lookupKey) && str_starts_with($lookupKey, 'DB')) {
            $lookupKey = substr($lookupKey, 2);
        }
        $companyConfig = $lookupKey
            ? config("tenants.companies.$lookupKey", [])
            : [];
        $fallbackName = $lookupKey
            ? config("tenants.labels.$lookupKey", $lookupKey)
            : config('app.name');

        $company = [
            'name' => $companyConfig['name'] ?? $fallbackName,
            'address' => $companyConfig['address'] ?? '',
            'phone' => $companyConfig['phone'] ?? '',
            'kota' => $companyConfig['kota'] ?? '',
            'email' => $companyConfig['email'] ?? '',
        ];

        return Inertia::render('marketing/delivery-order/print', [
            'deliveryOrder' => $deliveryOrder,
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
            'grandTotal' => $grandTotal,
            'company' => $company,
        ]);
    }
    public function create()
    {
        return Inertia::render('marketing/delivery-order/create');
    }

    public function edit(Request $request, $noDo)
    {
        $items = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->orderBy('no')
            ->get();

        $header = $items->first();
        if (!$header) {
            return redirect()
                ->route('marketing.delivery-order.index')
                ->with('error', 'Data DO tidak ditemukan.');
        }

        $refPr = null;
        if (Schema::hasColumn('tb_do', 'ref_pr')) {
            $refPr = $header->ref_pr ?? null;
        }
        if (!$refPr) {
            $normalizedRefPo = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $header->ref_po));
            $refPr = DB::table('tb_pr')
                ->select('no_pr', 'ref_po')
                ->get()
                ->first(function ($row) use ($normalizedRefPo) {
                    $candidate = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $row->ref_po));
                    return $candidate === $normalizedRefPo;
                })
                ?->no_pr;
        }

        $prItems = collect();
        $kodePoin = DB::table('tb_poin')
            ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim((string) $header->ref_po))])
            ->value('kode_poin');

        if ($kodePoin) {
            $rawItems = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->get();

            $kdMats = $rawItems->map(fn($item) => $item->kd_material ?? $item->kd_mat ?? $item->kd_mtrl)->filter()->unique()->all();
            $stocks = DB::table('tb_material')
                ->whereIn('kd_material', $kdMats)
                ->pluck('stok', 'kd_material');
            $warehouseOptions = $this->materialWarehouseOptions($kdMats);

            $prItems = $rawItems->map(function ($item) use ($stocks, $warehouseOptions) {
                $kdMaterial = $item->kd_material
                    ?? $item->kd_mat
                    ?? $item->kd_mtrl
                    ?? null;
                $material = $item->material ?? $item->mat ?? $item->mtrl ?? null;
	                $unit = $item->satuan ?? $item->unit ?? $item->Unit ?? '';
	                $remark = $item->renmark ?? $item->remark ?? $item->keterangan ?? '';
	                $sisa = $item->sisa_qtydo ?? $item->sisaqtydo ?? null;
	                $qty = $item->qty ?? $item->Qty ?? $item->quantity ?? null;

                $lastStock = $stocks->get($kdMaterial) ?? 0;

                return (object) [
                    'kd_material' => $kdMaterial,
	                    'material' => $material,
	                    'qty' => $qty,
	                    'unit' => $unit,
	                    'remark' => $remark,
	                    'sisa_qtydo' => $sisa,
	                    'last_stock' => (float) $lastStock,
	                    'warehouse_options' => $warehouseOptions->get((string) $kdMaterial, collect())->values(),
	                ];
            });
        }

        // Ambil data stok terbaru untuk item yang sudah ada di DO
        $kdMatsDO = $items->pluck('kd_mat')->filter()->unique()->all();
        $materialsDO = DB::table('tb_material')
            ->whereIn('kd_material', $kdMatsDO)
            ->pluck('stok', 'kd_material');
        $warehouseOptionsDO = $this->materialWarehouseOptions($kdMatsDO);

        $mappedItems = $items->map(function ($item) use ($materialsDO, $warehouseOptionsDO) {
            $lastStock = $materialsDO->get($item->kd_mat) ?? 0;
            $options = $warehouseOptionsDO->get((string) ($item->kd_mat ?? ''), collect())->values();
            $matchedWarehouse = $options->first(function ($option) use ($item) {
                return abs($this->parseNumber($option['price'] ?? 0) - $this->parseNumber($item->harga ?? 0)) <= 0.000001;
            });

            return [
                'no' => $item->no,
                'kd_material' => $item->kd_mat ?? null,
                'material' => $item->mat ?? null,
                'qty' => $item->qty ?? null,
                'original_qty' => $item->qty ?? null, // Simpan qty awal sebelum diedit
                'unit' => $item->unit ?? null,
                'remark' => $item->remark ?? null,
                'last_stock' => (float) $lastStock,
                'stock_now' => (float) $lastStock, // Set stock_now default sama dengan last_stock
                'warehouse_code' => $matchedWarehouse['value'] ?? null,
                'warehouse_label' => $matchedWarehouse['label'] ?? null,
                'warehouse_options' => $options,
            ];
        });

        return Inertia::render('marketing/delivery-order/edit', [
            'deliveryOrder' => [
                'no_do' => $header->no_do,
                'date' => $header->date,
                'ref_po' => $header->ref_po,
                'kd_cs' => $header->kd_cs,
                'nm_cs' => $header->nm_cs,
            ],
            'items' => $mappedItems,
            'refPr' => $refPr,
            'prItems' => $prItems,
        ]);
    }

    public function store(Request $request)
    {
        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $allowed = config('tenants.databases', []);
        $rawPrefix = in_array($database, $allowed, true) ? $database : 'SJA';
        $labelPrefix = config("tenants.labels.$rawPrefix");
        $prefixSource = $labelPrefix ?: $rawPrefix;
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $prefixSource));
        if (str_starts_with($prefix, 'DB')) {
            $prefix = substr($prefix, 2);
        }
        if ($prefix === '') {
            $prefix = 'SJA';
        }
        $prefix = $prefix.'.DO-';

        $lastNumber = DB::table('tb_do')
            ->where('no_do', 'like', $prefix.'%')
            ->orderBy('no_do', 'desc')
            ->value('no_do');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noDo = $prefix.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT);

        $items = $request->input('items', []);
        if (!is_array($items)) {
            $items = [];
        }

        $parseNumber = static function ($value) {
            if ($value === null) {
                return 0.0;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }
            $clean = str_replace(',', '', (string) $value);
            return is_numeric($clean) ? (float) $clean : 0.0;
        };

        try {
            DB::transaction(function () use ($request, $items, $noDo, $parseNumber) {
                $dateInput = $request->input('date');
                try {
                    $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                    $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
                } catch (\Throwable $e) {
                    $formattedDate = $dateInput;
                }
                $todayFormatted = now()->format('d.m.Y');

                DB::table('tb_kddo')->insert([
                    'no_do' => $noDo,
                    'tgl' => $formattedDate,
                    'pos_tgl' => $todayFormatted,
                    'ref_po' => $request->input('ref_po'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                // Bulk Pre-fetching
                $refPo = $request->input('ref_po');
                $kodePoin = $request->input('kode_poin');
                $kdMaterialsFromItems = collect($items)->pluck('kd_material')->filter()->unique()->all();
                $materialNamesFromItems = collect($items)->pluck('material')->filter()->unique()->all();

                $materials = DB::table('tb_material')
                    ->whereIn('kd_material', $kdMaterialsFromItems)
                    ->orWhereIn(DB::raw('lower(trim(material))'), collect($materialNamesFromItems)->map(fn($n) => strtolower(trim($n))))
                    ->get();
                $materialsMap = $materials->keyBy(fn($row) => strtolower(trim((string)$row->material)));
                $materialsByCode = $materials->keyBy(fn($row) => strtolower(trim((string)$row->kd_material)));

                $doPayload = [];
                $ttldoPayload = [];
                $materialUpdates = [];
                $detailPoinUpdates = [];

                foreach ($items as $index => $item) {
                    $material = $item['material'] ?? null;
                    $kdMaterial = $item['kd_material'] ?? null;
                    $materialLower = strtolower(trim((string)$material));
                    $kdMaterialLower = strtolower(trim((string)$kdMaterial));

                    $resolvedKdMat = $kdMaterial;

                    $materialRow = $materialLower ? $materialsMap->get($materialLower) : null;
                    if (!$materialRow && $resolvedKdMat) {
                        $materialRow = $materialsByCode->get(strtolower(trim((string)$resolvedKdMat)));
                    }
                    if (!$resolvedKdMat && $materialRow?->kd_material) {
                        $resolvedKdMat = $materialRow->kd_material;
                    }

                    $warehouseCode = $item['warehouse_code'] ?? null;
                    $warehouseOption = $this->selectedWarehouseOption($resolvedKdMat, $warehouseCode);
                    $effectivePrice = $warehouseOption['price'] ?? ($materialRow->harga ?? 0);
                    $effectiveTotal = $parseNumber($item['qty'] ?? 0) * $parseNumber($effectivePrice);

                    $doPayload[] = [
                        'no_do' => $noDo,
                        'date' => $formattedDate,
                        'pos_tgl' => $todayFormatted,
                        'ref_po' => $refPo,
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
                        'harga' => $effectivePrice,
                        'total' => $effectiveTotal,
                        'val_inv' => 0,
                        'inv' => ' ',
                    ];

                    $ttldoPayload[] = [
                        'no' => $item['no'] ?? ($index + 1),
                        'qty' => $item['qty'] ?? null,
                        'mat' => $material,
                        'kd_mat' => $resolvedKdMat,
                        'unit' => $item['unit'] ?? null,
                        'price' => $effectivePrice,
                        'total' => $effectiveTotal,
                        'remark' => ($item['remark'] ?? null) === null ? ' ' : $item['remark'],
                    ];

	                    $stockNow = $item['stock_now'] ?? null;
	                    if ($resolvedKdMat && $stockNow !== null) {
	                        $materialUpdates[] = [
	                            'kd_material' => $resolvedKdMat,
	                            'stok' => $stockNow,
                                'warehouse_code' => $warehouseOption['value'] ?? $warehouseCode,
	                        ];
	                    }

                    if ($kodePoin && $resolvedKdMat) {
                        $detailPoinUpdates[] = [
                            'kode_poin' => $kodePoin,
                            'kd_material' => $resolvedKdMat,
                            'qty' => $parseNumber($item['qty'] ?? 0),
                        ];
                    }
                }

                // Batch Inserts
                if (!empty($doPayload)) {
                    DB::table('tb_do')->insert($doPayload);
                }
                if (!empty($ttldoPayload)) {
                    DB::table('tb_ttldo')->insert($ttldoPayload);
                }

                // Batch updates (executed as single queries since Laravel doesn't have bulk update easily)
	                foreach ($materialUpdates as $up) {
                        $stockColumn = $this->warehouseStockColumn($up['warehouse_code'] ?? null);
                        if ($stockColumn && Schema::hasTable('tb_barang') && Schema::hasColumn('tb_barang', $stockColumn)) {
                            DB::table('tb_barang')
                                ->where('kd_material', $up['kd_material'])
                                ->update($this->zeroedWarehousePayload($stockColumn, $up['stok']));
                        }
	                }

                if (Schema::hasColumn('tb_detailpoin', 'sisa_qtydo')) {
                    foreach ($detailPoinUpdates as $up) {
                        $q = DB::table('tb_detailpoin')
                            ->where('kode_poin', $up['kode_poin']);
                        if ($up['kd_material']) {
                            $q->where('kd_material', $up['kd_material']);
                        }
                        $q->update([
                            'sisa_qtydo' => DB::raw(sprintf(
                                'case when coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F < 0 then 0 else coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F end',
                                $up['qty'],
                                $up['qty']
                            )),
                        ]);
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal menyimpan data: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil disimpan.');
            return inertia_location('/marketing/delivery-order');
        }

        return redirect()
            ->route('marketing.delivery-order.index')
            ->with('success', 'Data DO berhasil disimpan.');
    }

    public function updateDetail(Request $request, $noDo, $lineNo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Detail DO tidak ditemukan.');
        }

        $parseNumber = static function ($value) {
            if ($value === null) {
                return 0.0;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }
            $clean = str_replace(',', '', (string) $value);
            return is_numeric($clean) ? (float) $clean : 0.0;
        };

        $newQtyInput = $request->input('qty');
        $newQty = $parseNumber($newQtyInput);
        $oldQty = $parseNumber($row->qty ?? 0);
        $remarkInput = $request->input('remark');
        $remarkValue = $remarkInput === null ? ' ' : $remarkInput;
        $refPr = $request->input('ref_pr');
        $newDateInput = $request->input('date');
        $stockNow = $request->input('stock_now');
        $warehouseCode = $request->input('warehouse_code');
        $warehouseOption = $this->selectedWarehouseOption($row->kd_mat ?? null, $warehouseCode);
        $effectivePrice = $warehouseOption['price'] ?? $this->parseNumber($row->harga ?? 0);
        $warehouseOptions = $this->materialWarehouseOptions([$row->kd_mat ?? null])->get((string) ($row->kd_mat ?? ''), collect());
        $oldWarehouseOption = $warehouseOptions->first(function ($option) use ($row) {
            return abs($this->parseNumber($option['price'] ?? 0) - $this->parseNumber($row->harga ?? 0)) <= 0.000001;
        });

        try {
            $parsed = $newDateInput ? \Carbon\Carbon::parse($newDateInput) : null;
            $newDate = $parsed ? $parsed->format('d.m.Y') : $newDateInput;
        } catch (\Throwable $e) {
            $newDate = $newDateInput;
        }

        try {
            DB::transaction(function () use (
                $noDo,
                $lineNo,
                $row,
                $newQtyInput,
                $remarkValue,
                $refPr,
                $oldQty,
                $newQty,
                $newDate,
                $stockNow,
                $warehouseOption,
                $oldWarehouseOption,
                $effectivePrice,
                $parseNumber
            ) {
                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->where('no', $lineNo)
                    ->update([
                        'date' => $newDate,
                        'qty' => $newQtyInput,
                        'remark' => $remarkValue,
                        'harga' => $effectivePrice,
                        'total' => (float)$newQty * (float)$effectivePrice,
                    ]);

                if ($row->kd_mat && $stockNow !== null && Schema::hasTable('tb_barang')) {
                    $newStockColumn = $this->warehouseStockColumn($warehouseOption['value'] ?? null);
                    $oldStockColumn = $this->warehouseStockColumn($oldWarehouseOption['value'] ?? null);

                    if ($oldStockColumn && $newStockColumn && $oldStockColumn !== $newStockColumn && Schema::hasColumn('tb_barang', $oldStockColumn)) {
                        DB::table('tb_barang')
                            ->where('kd_material', $row->kd_mat)
                            ->update([
                                $oldStockColumn => DB::raw(sprintf(
                                    'coalesce(cast(%s as decimal(65,4)), 0) + %.4F',
                                    $oldStockColumn,
                                    $oldQty
                                )),
                            ]);
                    }

                    if ($newStockColumn && Schema::hasColumn('tb_barang', $newStockColumn)) {
                        DB::table('tb_barang')
                            ->where('kd_material', $row->kd_mat)
                            ->update($this->zeroedWarehousePayload($newStockColumn, $stockNow));
                    }
                }

                if (!$refPr) {
                    return;
                }

                $kdMat = $row->kd_mat ?? null;
                $material = $row->mat ?? null;
                if (!$kdMat && !$material) {
                    return;
                }

                $detailPrQuery = DB::table('tb_detailpr')
                    ->where('no_pr', $refPr);
                if ($kdMat) {
                    $detailPrQuery->where('kd_material', $kdMat);
                } else {
                    $detailPrQuery->where('material', $material);
                }
                $detailPr = $detailPrQuery->first();
                if (!$detailPr) {
                    return;
                }

                $currentSisa = $parseNumber($detailPr->sisa_pr ?? $detailPr->Sisa_pr ?? 0);
                $newSisa = $currentSisa + $oldQty - $newQty;
                if ($newSisa < 0) {
                    $newSisa = 0;
                }

                $detailPrQuery->update([
                    'sisa_pr' => $newSisa,
                ]);
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal memperbarui detail: ' . $exception->getMessage());
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil diperbarui.');
            return inertia_location('/marketing/delivery-order');
        }

        return redirect()
            ->route('marketing.delivery-order.index')
            ->with('success', 'Data DO berhasil diperbarui.');
    }

    public function storeDetail(Request $request, $noDo)
    {
        $header = DB::table('tb_kddo')->where('no_do', $noDo)->first();
        if (!$header) {
            return back()->with('error', 'Data DO tidak ditemukan.');
        }

        $kdMaterial = $request->input('kd_material');
        $material = $request->input('material');
        $qty = $this->parseNumber($request->input('qty'));
        $warehouseOption = $this->selectedWarehouseOption($kdMaterial, $request->input('warehouse_code'));
        $stockNow = $request->input('stock_now');
        $remark = $request->input('remark') === null ? ' ' : $request->input('remark');
        $dateInput = $request->input('date');

        if (!$kdMaterial || !$material || $qty <= 0 || !$warehouseOption) {
            return back()->with('error', 'Material, qty, dan gudang wajib diisi.');
        }

        try {
            $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
            $date = $parsed ? $parsed->format('d.m.Y') : $dateInput;
        } catch (\Throwable $e) {
            $date = $dateInput;
        }

        try {
            DB::transaction(function () use ($request, $noDo, $header, $kdMaterial, $material, $qty, $warehouseOption, $stockNow, $remark, $date) {
                $nextNo = ((int) (DB::table('tb_do')->where('no_do', $noDo)->max('no') ?? 0)) + 1;
                $price = $this->parseNumber($warehouseOption['price'] ?? 0);
                $total = $qty * $price;

                DB::table('tb_do')->insert([
                    'no_do' => $noDo,
                    'date' => $date,
                    'pos_tgl' => now()->format('d.m.Y'),
                    'ref_po' => $header->ref_po,
                    'kd_cs' => $header->kd_cs,
                    'nm_cs' => $header->nm_cs,
                    'no' => $nextNo,
                    'mat' => $material,
                    'kd_mat' => $kdMaterial,
                    'qty' => $qty,
                    'unit' => $request->input('unit'),
                    'remark' => $remark,
                    'harga' => $price,
                    'total' => $total,
                    'val_inv' => 0,
                    'inv' => ' ',
                ]);

                DB::table('tb_ttldo')->insert([
                    'no' => $nextNo,
                    'qty' => $qty,
                    'mat' => $material,
                    'kd_mat' => $kdMaterial,
                    'unit' => $request->input('unit'),
                    'price' => $price,
                    'total' => $total,
                    'remark' => $remark,
                ]);

                $stockColumn = $this->warehouseStockColumn($warehouseOption['value'] ?? null);
                if ($stockNow !== null && $stockColumn && Schema::hasColumn('tb_barang', $stockColumn)) {
                    DB::table('tb_barang')
                        ->where('kd_material', $kdMaterial)
                        ->update($this->zeroedWarehousePayload($stockColumn, $stockNow));
                }

                if ($header->ref_po && Schema::hasColumn('tb_detailpoin', 'sisa_qtydo')) {
                    $kodePoin = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [strtolower(trim((string) $header->ref_po))])
                        ->value('kode_poin');

                    if ($kodePoin) {
                        DB::table('tb_detailpoin')
                            ->where('kode_poin', $kodePoin)
                            ->where('kd_material', $kdMaterial)
                            ->update([
                                'sisa_qtydo' => DB::raw(sprintf(
                                    'case when coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F < 0 then 0 else coalesce(cast(sisa_qtydo as decimal(18,4)), 0) - %.4F end',
                                    $qty,
                                    $qty
                                )),
                            ]);
                    }
                }

                $refPr = $request->input('ref_pr');
                if ($refPr) {
                    DB::table('tb_detailpr')
                        ->where('no_pr', $refPr)
                        ->where('kd_material', $kdMaterial)
                        ->update([
                            'sisa_pr' => DB::raw(sprintf(
                                'case when coalesce(cast(sisa_pr as decimal(18,4)), 0) - %.4F < 0 then 0 else coalesce(cast(sisa_pr as decimal(18,4)), 0) - %.4F end',
                                $qty,
                                $qty
                            )),
                        ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal menambah detail DO: ' . $exception->getMessage());
        }

        return back()->with('success', 'Material DO berhasil ditambahkan.');
    }

    public function destroyDetail(Request $request, $noDo, $lineNo)
    {
        $row = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            $message = 'Detail DO tidak ditemukan.';
            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 404);
            }
            return back()->with('error', $message);
        }

        $qty = is_numeric($row->qty ?? null) ? (float) $row->qty : 0;
        $kdMat = strtolower(trim((string) ($row->kd_mat ?? '')));
        $refPo = strtolower(trim((string) ($row->ref_po ?? '')));

        try {
            DB::transaction(function () use ($noDo, $lineNo, $qty, $kdMat, $refPo, $row) {
                // Business rule: Minimal 1 material
                $count = DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->count();

                if ($count <= 1) {
                    throw new \RuntimeException('Gagal menghapus. Minimal harus ada 1 material dalam DO.');
                }

                if ($qty > 0 && $kdMat !== '' && $refPo !== '') {
                    $kodePoin = DB::table('tb_poin')
                        ->whereRaw('lower(trim(no_poin)) = ?', [$refPo])
                        ->value('kode_poin');

                    if ($kodePoin) {
                        $updatePayload = [];

                        if (Schema::hasColumn('tb_detailpoin', 'sisa_qtypr')) {
                            $updatePayload['sisa_qtypr'] = DB::raw(sprintf(
                                'coalesce(cast(sisa_qtypr as decimal(18,4)), 0) + %.4F',
                                $qty
                            ));
                        }

                        if (Schema::hasColumn('tb_detailpoin', 'sisa_qtydo')) {
                            $updatePayload['sisa_qtydo'] = DB::raw(sprintf(
                                'coalesce(cast(sisa_qtydo as decimal(18,4)), 0) + %.4F',
                                $qty
                            ));
                        }

                        if (!empty($updatePayload)) {
                            DB::table('tb_detailpoin')
                                ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string) $kodePoin))])
                                ->whereRaw('lower(trim(kd_material)) = ?', [$kdMat])
                                ->update($updatePayload);
                        }
                    }
                }

                $this->restoreDeletedMaterialsToStockAndMib(collect([$row]), (string) $noDo);

                DB::table('tb_do')
                    ->where('no_do', $noDo)
                    ->where('no', $lineNo)
                    ->delete();
            });
        } catch (\Throwable $exception) {
            return back()->with('error', 'Gagal menghapus material: ' . $exception->getMessage());
        }

        $successMessage = 'Data material DO berhasil dihapus.';
        if ($request->expectsJson()) {
            return response()->json(['message' => $successMessage]);
        }
        if ($request->header('X-Inertia')) {
            session()->flash('success', $successMessage);
            return inertia_location('/marketing/delivery-order');
        }

        return back()->with('success', $successMessage);
    }

    public function destroy(Request $request, $noDo)
    {
        $rows = DB::table('tb_do')
            ->where('no_do', $noDo)
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['message' => 'Data DO tidak ditemukan.'], 404);
        }

        try {
            DB::transaction(function () use ($rows, $noDo) {
                // Bulk Pre-fetching
                $refPos = $rows->pluck('ref_po')->filter()->unique()->all();

                $poinMap = collect();
                if (!empty($refPos)) {
                    $poinMap = DB::table('tb_poin')
                        ->whereIn(DB::raw('lower(trim(no_poin))'), collect($refPos)->map(fn($n) => strtolower(trim($n))))
                        ->get()
                        ->keyBy(fn($row) => strtolower(trim($row->no_poin)));
                }

                $detailPoinUpdates = [];

                foreach ($rows as $row) {
                    $qty = $this->parseNumber($row->qty ?? 0);
                    $kdMat = $row->kd_mat ?? null;
                    $matName = $row->mat ?? null;
                    $refPo = $row->ref_po ?? null;
                    $refPoLower = strtolower(trim((string)$refPo));

                    $kodePoin = $refPoLower ? $poinMap->get($refPoLower)?->kode_poin : null;

                    if ($kdMat) {
                        if ($kodePoin) {
                            $detailPoinUpdates[] = [
                                'kode_poin' => $kodePoin,
                                'kd_material' => $kdMat,
                                'qty' => $qty,
                                'material' => null,
                            ];
                        }
                    } elseif ($matName) {
                        if ($kodePoin) {
                            $detailPoinUpdates[] = [
                                'kode_poin' => $kodePoin,
                                'kd_material' => null,
                                'qty' => $qty,
                                'material' => $matName,
                            ];
                        }
                    }
                }

                $hasSisaQtyDo = Schema::hasColumn('tb_detailpoin', 'sisa_qtydo');
                if ($hasSisaQtyDo) {
                    foreach ($detailPoinUpdates as $up) {
                        $q = DB::table('tb_detailpoin')
                            ->where('kode_poin', $up['kode_poin']);
                        if ($up['kd_material']) {
                            $q->where('kd_material', $up['kd_material']);
                        } else {
                            $q->where('material', $up['material']);
                        }
                        $q->increment('sisa_qtydo', $up['qty']);
                    }
                }

                $this->restoreDeletedMaterialsToStockAndMib($rows, (string) $noDo);

                DB::table('tb_do')->where('no_do', $noDo)->delete();
                DB::table('tb_kddo')->where('no_do', $noDo)->delete();
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal menghapus DO: ' . $e->getMessage());
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Data DO berhasil dihapus.']);
        }

        if ($request->header('X-Inertia')) {
            session()->flash('success', 'Data DO berhasil dihapus.');
            return inertia_location('/marketing/delivery-order');
        }
    }

    public function searchPr(Request $request)
    {
    $search = $request->input('search');
    $perPageInput = $request->input('per_page', 5);
    
    // Batasi 'all' agar tidak menarik seluruh database yang bisa menyebabkan timeout
    $perPage = $perPageInput === 'all' ? 100 : (is_numeric($perPageInput) ? (int) $perPageInput : 5);

    $query = DB::table('tb_poin as p')
        ->whereExists(function ($subQuery) {
            $subQuery->select(DB::raw(1))
                ->from('tb_detailpoin as d')
                // OPTIMASI: Gunakan join standar daripada whereRaw jika memungkinkan
                ->whereColumn('d.kode_poin', 'p.kode_poin')
                // Hindari cast(decimal) di query jika kolom sudah numerik
                ->where('d.sisa_qtydo', '>', 0);
        })
        ->select('p.kode_poin', 'p.no_poin', 'p.date_poin', 'p.customer_name');

    if ($search) {
        $query->where(function ($q) use ($search) {
            $q->where('p.kode_poin', 'like', "%{$search}%")
              ->orWhere('p.no_poin', 'like', "%{$search}%")
              ->orWhere('p.customer_name', 'like', "%{$search}%");
        });
    }

    // Gunakan simplePaginate untuk performa lebih cepat jika data sangat besar
    return response()->json($query->orderByDesc('p.id')->paginate($perPage));
    }

    public function getPrDetails(Request $request)
    {
        $noPoin = $request->input('no_poin');

        $poin = DB::table('tb_poin')->where('no_poin', $noPoin)->first();

        if (!$poin) {
            return response()->json(['error' => 'PO In not found'], 404);
        }

        $kdCs = DB::table('tb_cs')
            ->where('nm_cs', $poin->customer_name)
            ->value('kd_cs');

        try {
            $rawItems = DB::table('tb_detailpoin')
                ->whereRaw('lower(trim(kode_poin)) = ?', [strtolower(trim((string) $poin->kode_poin))])
                ->whereRaw('coalesce(cast(sisa_qtydo as decimal(18,4)), 0) <> 0')
                ->get();
        } catch (\Throwable $exception) {
            return response()->json([
                'error' => 'Gagal mengambil detail PO In.',
                'message' => $exception->getMessage(),
            ], 500);
        }

        // Kita tetap perlu pluck('stok') dari tb_material untuk kalkulasi stock_now di frontend
        $kdMats = $rawItems->map(fn($item) => $item->kd_material)->filter()->unique()->all();
        $stocks = DB::table('tb_material')
            ->whereIn('kd_material', $kdMats)
            ->pluck('stok', 'kd_material');
        $warehouseOptions = $this->materialWarehouseOptions($kdMats);

        $items = $rawItems->map(function ($item) use ($stocks, $warehouseOptions) {
            // Prioritaskan mengambil kolom 'satuan', lalu 'unit' jika 'satuan' tidak ada
            $unit = $item->satuan ?? $item->unit ?? $item->Unit ?? '';
            $kdMaterial = $item->kd_material ?? null;

            return (object) [
                'kd_material' => $kdMaterial,
                'material' => $item->material ?? null,
                'qty' => $item->sisa_qtydo ?? $item->qty ?? null,
                'unit' => $unit, // Ini akan terisi dari tb_detailpoin.satuan
                'remark' => $item->renmark ?? $item->remark ?? $item->keterangan ?? '',
                'sisa_qtydo' => $item->sisa_qtydo ?? null,
                'last_stock' => (float) ($stocks->get($kdMaterial ?? '') ?? 0),
                'warehouse_options' => $warehouseOptions->get((string) $kdMaterial, collect())->values(),
            ];
        });

        return response()->json([
            'pr' => $poin,
            'kd_cs' => $kdCs,
            'items' => $items,
        ]);
    }
}
