<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Carbon\Carbon;

class DeliveryOrderAddController
{
    public function outstandingMetric(Request $request)
    {
        $metric = $request->query('metric');

        if ($metric === 'count') {
            return response()->json([
                'value' => DB::table('tb_dob')->where('status', 0)->distinct('no_dob')->count('no_dob'),
            ]);
        }

        if ($metric === 'total') {
            return response()->json([
                'value' => (float) DB::table('tb_dob')->where('status', 0)
                    ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)')),
            ]);
        }

        return response()->json(['message' => 'Metric tidak valid.'], 422);
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

    private function barangStockTotalExpression(string $alias = ''): string
    {
        $prefix = $alias !== '' ? "{$alias}." : '';

        return "(
            coalesce(cast({$prefix}stok_g1 as decimal(18,4)), 0) +
            coalesce(cast({$prefix}stok_g2 as decimal(18,4)), 0) +
            coalesce(cast({$prefix}stok_g3 as decimal(18,4)), 0) +
            coalesce(cast({$prefix}stok_g4 as decimal(18,4)), 0)
        )";
    }

    private function materialWarehouseOptions(string $kdMaterial)
    {
        if ($kdMaterial === '' || !Schema::hasTable('tb_barang')) {
            return collect();
        }

        $row = DB::table('tb_barang')
            ->where('kd_material', $kdMaterial)
            ->first([
                'stok_g1',
                'stok_g2',
                'stok_g3',
                'stok_g4',
                'harga_stokg1',
                'harga_stokg2',
                'harga_stokg3',
                'harga_stokg4',
            ]);

        if (!$row) {
            return collect();
        }

        return collect([
            ['value' => 'g1', 'stock_column' => 'stok_g1', 'stock' => $row->stok_g1 ?? 0, 'price' => $row->harga_stokg1 ?? 0],
            ['value' => 'g2', 'stock_column' => 'stok_g2', 'stock' => $row->stok_g2 ?? 0, 'price' => $row->harga_stokg2 ?? 0],
            ['value' => 'g3', 'stock_column' => 'stok_g3', 'stock' => $row->stok_g3 ?? 0, 'price' => $row->harga_stokg3 ?? 0],
            ['value' => 'g4', 'stock_column' => 'stok_g4', 'stock' => $row->stok_g4 ?? 0, 'price' => $row->harga_stokg4 ?? 0],
        ])->map(function ($option) {
            $option['stock'] = $this->parseNumber($option['stock']);
            $option['price'] = $this->parseNumber($option['price']);
            return $option;
        });
    }

    private function warehouseOptionForPrice(string $kdMaterial, float $price)
    {
        $options = $this->materialWarehouseOptions($kdMaterial);

        return $options->first(function ($option) use ($price) {
            return $option['stock'] > 0 && abs($option['price'] - $price) <= 0.000001;
        }) ?? $options->first(fn ($option) => $option['stock'] > 0) ?? $options->first();
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
        if ($rows->isEmpty() || !Schema::hasTable('tb_barang')) {
            return;
        }

        $mibRows = [];

        foreach ($rows as $row) {
            $qty = $this->parseNumber($row->qty ?? 0);
            $dobHarga = $this->parseNumber($row->harga ?? 0);
            $matName = trim((string) ($row->mat ?? ''));
            $kdMat = trim((string) ($row->kd_mat ?? ''));

            if ($qty <= 0 || ($kdMat === '' && $matName === '')) {
                continue;
            }

            $materialQuery = DB::table('tb_barang');
            if ($kdMat !== '') {
                $materialQuery->where('kd_material', $kdMat);
            } else {
                $materialQuery->whereRaw('lower(trim(material)) = ?', [strtolower($matName)]);
            }

            $materialRow = $materialQuery->first();
            if (!$materialRow) {
                continue;
            }

            $warehouseOption = $this->warehouseOptionForPrice((string) $materialRow->kd_material, $dobHarga);
            $stockColumn = $warehouseOption['stock_column'] ?? null;
            $materialHarga = $this->parseNumber($warehouseOption['price'] ?? 0);
            $sameMainStockPrice = $stockColumn && ($materialHarga === 0.0 || abs($materialHarga - $dobHarga) <= 0.000001);

            if ($sameMainStockPrice) {
                DB::table('tb_barang')
                    ->where('kd_material', $materialRow->kd_material)
                    ->update([
                        $stockColumn => $this->parseNumber($materialRow->{$stockColumn} ?? 0) + $qty,
                    ]);

                continue;
            }

            $mibRows[] = [
                'no' => $row->no ?? count($mibRows) + 1,
                'kd_mat' => $materialRow->kd_material,
                'material' => $materialRow->material ?? $matName,
                'qty' => $qty,
                'unit' => (string) ($row->unit ?? ''),
                'price' => $dobHarga,
                'total_price' => $this->parseNumber($row->total ?? 0) ?: ($qty * $dobHarga),
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

    public function create()
    {
        return Inertia::render('marketing/delivery-order-add/create');
    }

    public function edit(Request $request, $noDob)
    {
        $items = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->orderBy('no')
            ->get();

        $header = $items->first();
        if (!$header) {
            return redirect()
                ->route('marketing.delivery-order-add.index')
                ->with('error', 'Data DOB tidak ditemukan.');
        }

        $refDo = $header->ref_do ?? null;
        $refPo = null;
        if ($refDo) {
            $refPo = DB::table('tb_do')
                ->where('no_do', $refDo)
                ->value('ref_po');
        }

        $mappedItems = $items->map(function ($item) {
            $lastStock = 0;
            if ($item->kd_mat) {
                $lastStock = DB::table('tb_barang')
                    ->where('kd_material', $item->kd_mat)
                    ->selectRaw($this->barangStockTotalExpression() . ' as stok')
                    ->value('stok');
            }

            return [
                'no' => $item->no,
                'kd_mat' => $item->kd_mat ?? null,
                'mat' => $item->mat ?? null,
                'qty' => $item->qty ?? null,
                'unit' => $item->unit ?? null,
                'remark' => $item->remark ?? null,
                'harga' => $item->harga ?? null,
                'total' => $item->total ?? null,
                'last_stock' => (float) ($lastStock ?? 0),
            ];
        });

        return Inertia::render('marketing/delivery-order-add/edit', [
            'deliveryOrder' => [
                'no_dob' => $header->no_dob,
                'date' => $header->date,
                'ref_do' => $header->ref_do,
                'ref_po' => $refPo,
                'kd_cs' => $header->kd_cs,
                'nm_cs' => $header->nm_cs,
            ],
            'items' => $mappedItems,
        ]);
    }

    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        $deliveryOrders = DB::table('tb_dob')
            ->select('no_dob', 'ref_do', 'nm_cs', 'status')
            ->groupBy('no_dob', 'ref_do', 'nm_cs', 'status')
            ->orderBy('no_dob', 'desc')
            ->get();

        $outstandingCount = DB::table('tb_dob')
            ->where('status', 0)
            ->distinct('no_dob')
            ->count('no_dob');

        $outstandingTotal = DB::table('tb_dob')
            ->where('status', 0)
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        // DOT terealisasi: tb_fakturpenjualan.no_do = tb_kddob.no_dob, filter tgl_pos
        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $realizedQuery = DB::table('tb_kddob as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_dob))'));
            });

        $now = now();
        if ($period === 'today') {
            $realizedQuery->whereRaw("{$docDateExpr} = ?", [$now->toDateString()]);
        } elseif ($period === 'this_week') {
            $realizedQuery->whereRaw("{$docDateExpr} between ? and ?", [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString(),
            ]);
        } elseif ($period === 'this_month') {
            $realizedQuery->whereRaw("month({$docDateExpr}) = ?", [$now->month])
                ->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $realizedQuery->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        }

        $realizedNos = $realizedQuery->distinct('k.no_dob')->pluck('k.no_dob');
        $realizedCount = $realizedNos->count();
        $realizedTotal = DB::table('tb_dob')
            ->whereIn(DB::raw('lower(trim(no_dob))'), $realizedNos->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return Inertia::render('marketing/delivery-order-add/index', [
            'deliveryOrders' => $deliveryOrders,
            'outstandingCount' => $outstandingCount,
            'outstandingTotal' => $outstandingTotal,
            'realizedCount' => $realizedCount,
            'realizedTotal' => (float) $realizedTotal,
            'period' => $period,
        ]);
    }

    public function details(Request $request)
    {
        $noDob = $request->query('no_dob');
        if (!$noDob) {
            return response()->json([
                'details' => [],
                'header' => null,
            ]);
        }

        $detailsQuery = DB::table('tb_dob')->where('no_dob', $noDob);
        $details = $detailsQuery
            ->orderBy('no_dob')
            ->get();

        $header = $details->first();

        if ($request->boolean('realized_only') && $header?->ref_do) {
            $refPo = DB::table('tb_do')
                ->where(DB::raw('lower(trim(no_do))'), strtolower(trim($header->ref_do)))
                ->value('ref_po');

            if ($refPo) {
                $details = DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->whereExists(function ($q) use ($refPo) {
                        $q->select(DB::raw(1))
                            ->from('tb_kdfakturpenjualan')
                            ->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim($refPo))]);
                    })
                    ->orderBy('no_dob')
                    ->get();
            } else {
                $details = collect();
            }
        }

        return response()->json([
            'details' => $details,
            'header' => $header ? [
                'no_dob' => $header->no_dob,
                'nm_cs' => $header->nm_cs,
                'ref_do' => $header->ref_do,
                'date' => $header->date,
                'pos_tgl' => $header->pos_tgl,
            ] : null,
        ]);
    }

    public function outstandingDo()
    {
        $deliveryOrders = DB::table('tb_do')
            ->select('no_do', 'date', 'ref_po', 'nm_cs', 'kd_cs')
            ->where('val_inv', 0)
            ->groupBy('no_do', 'date', 'ref_po', 'nm_cs', 'kd_cs')
            ->orderBy('date', 'desc')
            ->orderBy('no_do', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function prMaterials(Request $request)
    {
        $refPo = $request->query('ref_po');
        $refDo = $request->query('ref_do');
        if (!$refPo) {
            return response()->json([
                'items' => [],
            ]);
        }

        $rawItems = DB::table('tb_do')
            ->when($refDo, function ($query) use ($refDo) {
                $query->whereRaw('lower(trim(no_do)) = ?', [strtolower(trim((string) $refDo))]);
            })
            ->whereRaw('lower(trim(ref_po)) = ?', [strtolower(trim((string) $refPo))])
            ->whereRaw('coalesce(cast(replace(qty, \',\', \'\') as decimal(18,4)), 0) > 0')
            ->orderBy('no')
            ->get();

        $items = $rawItems->map(function ($item) {
            $kdMaterial = $item->kd_material
                ?? $item->kd_mat
                ?? $item->kd_mtrl
                ?? null;
            $lastStock = 0;
            if ($kdMaterial) {
                $lastStock = DB::table('tb_barang')
                    ->where('kd_material', $kdMaterial)
                    ->selectRaw($this->barangStockTotalExpression() . ' as stok')
                    ->value('stok');
            }

            return [
                'no' => $item->no ?? null,
                'kd_material' => $kdMaterial,
                'material' => $item->material ?? $item->mat ?? $item->mtrl ?? null,
                'qty' => $item->qty ?? null,
                'sisa_pr' => $item->qty ?? null,
                'unit' => $item->unit ?? $item->satuan ?? $item->Unit ?? null,
                'remark' => $item->renmark ?? $item->remark ?? null,
                'price_po' => $item->harga ?? $item->price_po ?? null,
                'last_stock' => (float) ($lastStock ?? 0),
            ];
        });

        return response()->json([
            'items' => $items,
        ]);
    }

    public function outstanding()
    {
        $deliveryOrders = DB::table('tb_dob')
            ->select('no_dob', 'ref_do', 'nm_cs', 'status')
            ->where('status', 0)
            ->groupBy('no_dob', 'ref_do', 'nm_cs', 'status')
            ->orderBy('no_dob', 'desc')
            ->get();

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
        ]);
    }

    public function realized(Request $request)
    {
        $period = $request->query('period', 'today');

        $docDateExpr = "coalesce(date(f.tgl_pos), str_to_date(f.tgl_pos, '%Y-%m-%d'), str_to_date(f.tgl_pos, '%Y/%m/%d'), str_to_date(f.tgl_pos, '%d/%m/%Y'), str_to_date(f.tgl_pos, '%d-%m-%Y'), str_to_date(f.tgl_pos, '%d.%m.%Y'))";

        $query = DB::table('tb_kddob as k')
            ->join('tb_fakturpenjualan as f', function ($join) {
                $join->on(DB::raw('lower(trim(f.no_do))'), '=', DB::raw('lower(trim(k.no_dob))'));
            })
            ->leftJoin('tb_dob as d', function ($join) {
                $join->on(DB::raw('lower(trim(d.no_dob))'), '=', DB::raw('lower(trim(k.no_dob))'));
            })
            ->select(
                'k.no_dob',
                'k.no_do as ref_do',
                'f.nm_cs',
                DB::raw("coalesce(f.tgl_pos, k.pos_tgl) as date"),
                DB::raw('coalesce(cast(d.total as decimal(18,4)), 0) as total')
            )
            ->distinct();

        $now = now();
        if ($period === 'today') {
            $query->whereRaw("{$docDateExpr} = ?", [$now->toDateString()]);
        } elseif ($period === 'this_week') {
            $query->whereRaw("{$docDateExpr} between ? and ?", [
                $now->startOfWeek()->toDateString(),
                $now->endOfWeek()->toDateString(),
            ]);
        } elseif ($period === 'this_month') {
            $query->whereRaw("month({$docDateExpr}) = ?", [$now->month])
                ->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        } elseif ($period === 'this_year') {
            $query->whereRaw("year({$docDateExpr}) = ?", [$now->year]);
        }

        $deliveryOrders = $query
            ->orderBy('k.pos_tgl', 'desc')
            ->orderBy('k.no_dob', 'desc')
            ->get();

        $realizedTotal = DB::table('tb_dob')
            ->whereIn(DB::raw('lower(trim(no_dob))'), $deliveryOrders->pluck('no_dob')->map(fn ($n) => strtolower(trim($n))))
            ->sum(DB::raw('coalesce(cast(total as decimal(18,4)), 0)'));

        return response()->json([
            'deliveryOrders' => $deliveryOrders,
            'realizedTotal' => (float) $realizedTotal,
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
        $prefix = $prefix.'.DOT-';

        $lastNumber = DB::table('tb_dob')
            ->where('no_dob', 'like', $prefix.'%')
            ->orderBy('no_dob', 'desc')
            ->value('no_dob');

        $sequence = 1;
        if ($lastNumber) {
            $suffix = substr($lastNumber, strlen($prefix));
            $sequence = max(1, (int) $suffix + 1);
        }

        $noDob = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

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
            DB::transaction(function () use ($request, $items, $noDob, $parseNumber) {
                $dateInput = $request->input('date');
                try {
                    $parsed = $dateInput ? \Carbon\Carbon::parse($dateInput) : null;
                    $formattedDate = $parsed ? $parsed->format('d.m.Y') : $dateInput;
                } catch (\Throwable $e) {
                    $formattedDate = $dateInput;
                }
                $todayFormatted = now()->format('d.m.Y');

                DB::table('tb_kddob')->insert([
                    'no_dob' => $noDob,
                    'date' => $formattedDate,
                    'pos_tgl' => $todayFormatted,
                    'ref_do' => $request->input('ref_do'),
                    'kd_cs' => $request->input('kd_cs'),
                    'nm_cs' => $request->input('nm_cs'),
                ]);

                foreach ($items as $index => $item) {
                    $qtyValue = $parseNumber($item['qty'] ?? 0);

                    $materialRow = null;
                    if (!empty($item['kd_mat'])) {
                        $materialRow = DB::table('tb_barang')
                            ->where('kd_material', $item['kd_mat'])
                            ->select('kd_material')
                            ->selectRaw('coalesce(harga_stokg1, 0) as harga')
                            ->first();
                    }
                    if (!$materialRow && !empty($item['mat'])) {
                        $materialRow = DB::table('tb_barang')
                            ->whereRaw('lower(trim(material)) = ?', [strtolower(trim($item['mat']))])
                            ->select('kd_material')
                            ->selectRaw('coalesce(harga_stokg1, 0) as harga')
                            ->first();
                    }

                    $resolvedKdMat = $item['kd_mat'] ?? $materialRow->kd_material ?? null;
                    $priceFromMaterial = $materialRow->harga ?? $item['harga'] ?? 0;
                    $effectiveTotal = $qtyValue * $parseNumber($priceFromMaterial);

                    DB::table('tb_dob')->insert([
                        'no_dob' => $noDob,
                        'date' => $formattedDate,
                        'pos_tgl' => $todayFormatted,
                        'ref_do' => $request->input('ref_do'),
                        'kd_cs' => $request->input('kd_cs'),
                        'nm_cs' => $request->input('nm_cs'),
                        'no' => $item['no'] ?? ($index + 1),
                        'kd_mat' => $resolvedKdMat,
                        'mat' => $item['mat'] ?? null,
                        'qty' => $item['qty'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                        'harga' => $priceFromMaterial,
                        'total' => $effectiveTotal,
                        'status' => 0,
                    ]);

                    DB::table('tb_ttldo')->insert([
                        'no' => $item['no'] ?? ($index + 1),
                        'qty' => $item['qty'] ?? null,
                        'mat' => $item['mat'] ?? null,
                        'kd_mat' => $resolvedKdMat,
                        'unit' => $item['unit'] ?? null,
                        'price' => $priceFromMaterial,
                        'total' => $effectiveTotal,
                        'remark' => ($item['remark'] ?? null) === null
                            ? ' '
                            : $item['remark'],
                    ]);

                    $kdMat = $resolvedKdMat;
                    if ($kdMat) {
                        $materialRow = DB::table('tb_barang')
                            ->where('kd_material', $kdMat)
                            ->first();
                        if ($materialRow) {
                            $warehouseOption = $this->warehouseOptionForPrice((string) $kdMat, $parseNumber($priceFromMaterial));
                            $stockColumn = $warehouseOption['stock_column'] ?? null;
                            if (!$stockColumn) {
                                continue;
                            }

                            $currentStok = $parseNumber($materialRow->{$stockColumn} ?? 0);
                            $newStok = $currentStok - $qtyValue;
                            if ($newStok < 0) {
                                $newStok = 0;
                            }

                            DB::table('tb_barang')
                                ->where('kd_material', $kdMat)
                                ->update([$stockColumn => $newStok]);
                        }
                    }
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.delivery-order-add.index')
            ->with('success', 'Data DOB berhasil disimpan.');
    }

    public function update(Request $request, $noDob)
    {
        $request->validate([
            'date' => ['required'],
            'no_dob' => ['nullable', 'string'],
        ]);

        $rawDate = $request->input('date');
        $targetNoDob = $request->input('no_dob', $noDob);

        try {
            $carbonDate = Carbon::parse($rawDate);
            $formattedDate = $carbonDate->format('d.m.Y');
        } catch (\Throwable $e) {
            $formattedDate = $rawDate;
        }

        try {
            DB::transaction(function () use ($targetNoDob, $formattedDate) {
                DB::table('tb_dob')
                    ->where(DB::raw('lower(trim(no_dob))'), strtolower(trim($targetNoDob)))
                    ->update(['date' => $formattedDate]);

                DB::table('tb_kddob')
                    ->where(DB::raw('lower(trim(no_dob))'), strtolower(trim($targetNoDob)))
                    ->update(['date' => $formattedDate]);
            });
        } catch (\Throwable $e) {
            return back()->with('error', 'Gagal memperbarui tanggal: '.$e->getMessage());
        }

        return back()->with('success', 'Tanggal DO berhasil diperbarui.');
    }

    public function updateDetail(Request $request, $noDob, $lineNo)
    {
        $row = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            return back()->with('error', 'Detail DOB tidak ditemukan.');
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
        $stockNowInput = $request->input('stock_now');
        $stockNowValue = $stockNowInput === null ? null : $parseNumber($stockNowInput);
        $newHarga = $parseNumber($request->input('harga', $row->harga ?? 0));
        $newTotal = $newHarga * $newQty;

        try {
            DB::transaction(function () use (
                $noDob,
                $lineNo,
                $row,
                $newQtyInput,
                $newHarga,
                $newTotal,
                $remarkValue,
                $stockNowValue,
                $oldQty,
                $newQty,
                $parseNumber
            ) {
                DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->where('no', $lineNo)
                    ->update([
                        'qty' => $newQtyInput,
                        'harga' => $newHarga,
                        'remark' => $remarkValue,
                        'total' => $newTotal,
                    ]);

                $kdMat = $row->kd_mat ?? null;
                if (!$kdMat) {
                    return;
                }

                $materialRow = DB::table('tb_barang')
                    ->where('kd_material', $kdMat)
                    ->first();
                if ($materialRow) {
                    $warehouseOption = $this->warehouseOptionForPrice((string) $kdMat, $newHarga);
                    $stockColumn = $warehouseOption['stock_column'] ?? null;
                    if (!$stockColumn) {
                        return;
                    }

                    if ($stockNowValue !== null) {
                        $newStok = $stockNowValue;
                    } else {
                        $currentStok = $parseNumber($materialRow->{$stockColumn} ?? 0);
                        $newStok = $currentStok + $oldQty - $newQty;
                        if ($newStok < 0) {
                            $newStok = 0;
                        }
                    }

                    DB::table('tb_barang')
                        ->where('kd_material', $kdMat)
                        ->update([$stockColumn => $newStok]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Data DOB berhasil diperbarui.');
    }

    public function print(Request $request, $noDob)
    {
        $deliveryOrderDetails = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->orderBy('no_dob')
            ->get();

        $deliveryOrder = $deliveryOrderDetails->first();

        if (!$deliveryOrder) {
            return redirect()
                ->route('marketing.delivery-order-add.index')
                ->with('error', 'Data DO bantu tidak ditemukan.');
        }

        $customerAddress = null;
        if ($deliveryOrder?->nm_cs) {
            $customerAddress = DB::table('tb_cs')
                ->where('nm_cs', $deliveryOrder->nm_cs)
                ->value('alamat_cs');
        }

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

        return Inertia::render('marketing/delivery-order-add/print', [
            'deliveryOrder' => $deliveryOrder,
            'deliveryOrderDetails' => $deliveryOrderDetails,
            'customerAddress' => $customerAddress,
            'grandTotal' => $grandTotal,
            'company' => $company,
        ]);
    }

    public function destroyDetail(Request $request, $noDob, $lineNo)
    {
        $row = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->where('no', $lineNo)
            ->first();

        if (!$row) {
            $message = 'Detail DOB tidak ditemukan.';
            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 404);
            }
            return back()->with('error', $message);
        }

        try {
            DB::transaction(function () use ($noDob, $lineNo, $row) {
                // Business rule: Minimal 1 material
                $count = DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->count();

                if ($count <= 1) {
                    throw new \RuntimeException('Gagal menghapus. Minimal harus ada 1 material dalam DOB.');
                }

                $this->restoreDeletedMaterialsToStockAndMib(collect([$row]), (string) $noDob);

                DB::table('tb_dob')
                    ->where('no_dob', $noDob)
                    ->where('no', $lineNo)
                    ->delete();
            });
        } catch (\Throwable $e) {
            $message = 'Gagal menghapus material: '.$e->getMessage();
            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 400);
            }
            return back()->with('error', $message);
        }

        $successMessage = 'Material berhasil dihapus.';
        if ($request->expectsJson()) {
            return response()->json(['message' => $successMessage]);
        }
        return back()->with('success', $successMessage);
    }

    public function destroy(Request $request, $noDob)
    {
        $rows = DB::table('tb_dob')
            ->where('no_dob', $noDob)
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['message' => 'Data DOT tidak ditemukan.'], 404);
        }

        try {
            DB::transaction(function () use ($rows, $noDob) {
                $this->restoreDeletedMaterialsToStockAndMib($rows, (string) $noDob);

                DB::table('tb_dob')->where('no_dob', $noDob)->delete();
                DB::table('tb_kddob')->where('no_dob', $noDob)->delete();
            });
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menghapus DOT: '.$e->getMessage(),
            ], 500);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Data DOT berhasil dihapus.']);
        }

        return redirect()
            ->route('marketing.delivery-order-add.index')
            ->with('success', 'Data DOT berhasil dihapus.');
    }
}
