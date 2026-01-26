<?php

namespace App\Http\Controllers\Marketing;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class QuotationController
{
    private array $columnCache = [];

    private function resolveColumn(string $table, array $candidates, string $fallback): string
    {
        if (!isset($this->columnCache[$table])) {
            $columns = DB::select('SHOW COLUMNS FROM '.$table);
            $this->columnCache[$table] = array_map(
                static fn ($column) => $column->Field ?? '',
                $columns
            );
        }

        foreach ($candidates as $candidate) {
            foreach ($this->columnCache[$table] as $column) {
                if ($column !== '' && strcasecmp($column, $candidate) === 0) {
                    return $column;
                }
            }
        }

        return $fallback;
    }

    private function wrapColumn(string $column): string
    {
        return '`'.str_replace('`', '``', $column).'`';
    }

    public function details($noPenawaran)
    {
        $detailNo = trim((string) $noPenawaran);
        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        $hargaColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga', 'harga'],
            'Harga'
        );
        $hargaModalColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga_Modal', 'Harga_modal', 'harga_modal'],
            'Harga_Modal'
        );

        $details = DB::table('tb_penawarandetail')
            ->selectRaw(
                'ID, '.
                $this->wrapColumn($noPenawaranColumn).' as No_penawaran, '.
                'Material, '.
                'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                .' THEN '.$this->wrapColumn($hargaModalColumn)
                .' ELSE '.$this->wrapColumn($hargaColumn).' END as Harga, '.
                'Qty, '.
                'Satuan, '.
                'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                .' THEN '.$this->wrapColumn($hargaColumn)
                .' ELSE '.$this->wrapColumn($hargaModalColumn).' END as Harga_modal, '.
                'Margin, '.
                'Remark'
            )
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [$detailNo])
            ->orderBy('ID')
            ->get();

        return response()->json([
            'details' => $details,
        ]);
    }

    public function destroy(Request $request, $noPenawaran)
    {
        $noPenawaran = trim((string) $noPenawaran);
        if ($noPenawaran === '') {
            return response()->json(['message' => 'No penawaran tidak valid.'], 400);
        }

        try {
            DB::transaction(function () use ($noPenawaran) {
                DB::table('tb_penawarandetail')
                    ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                    ->delete();

                DB::table('tb_penawaran')
                    ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                    ->delete();
            });
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['message' => 'Data quotation berhasil dihapus.']);
    }

    public function index(Request $request)
    {
        $penawaran = DB::table('tb_penawaran as p')
            ->select(
                'p.No_penawaran',
                'p.Tgl_penawaran',
                'p.Tgl_Posting',
                'p.Customer',
                'p.Alamat',
                'p.Telp',
                'p.Fax',
                'p.Email',
                'p.Attend',
                'p.Payment',
                'p.Validity',
                'p.Delivery',
                'p.Franco',
                'p.Note1',
                'p.Note2',
                'p.Note3',
                DB::raw('1 as can_delete')
            )
            ->orderBy('p.Tgl_Posting', 'desc')
            ->orderBy('p.No_penawaran', 'desc')
            ->get();

        $detailNo = trim((string) $request->query('detail_no', ''));
        $detailNo = $detailNo !== '' ? $detailNo : null;
        $penawaranDetail = collect();
        if ($detailNo) {
            $noPenawaranColumn = $this->resolveColumn(
                'tb_penawarandetail',
                ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
                'No_penawaran'
            );
            $hargaColumn = $this->resolveColumn(
                'tb_penawarandetail',
                ['Harga', 'harga'],
                'Harga'
            );
            $hargaModalColumn = $this->resolveColumn(
                'tb_penawarandetail',
                ['Harga_Modal', 'Harga_modal', 'harga_modal'],
                'Harga_Modal'
            );

            $penawaranDetail = DB::table('tb_penawarandetail')
                ->selectRaw(
                    'ID, '.
                    $this->wrapColumn($noPenawaranColumn).' as No_penawaran, '.
                    'Material, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaModalColumn)
                    .' ELSE '.$this->wrapColumn($hargaColumn).' END as Harga, '.
                    'Qty, '.
                    'Satuan, '.
                    'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                    .' THEN '.$this->wrapColumn($hargaColumn)
                    .' ELSE '.$this->wrapColumn($hargaModalColumn).' END as Harga_modal, '.
                    'Margin, '.
                    'Remark'
                )
                ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [$detailNo])
                ->orderBy('ID')
                ->get();
        }

        return Inertia::render('marketing/quotation/index', [
            'penawaran' => $penawaran,
            'penawaranDetail' => $penawaranDetail,
            'detailNo' => $detailNo,
        ]);
    }

    public function create()
    {
        return Inertia::render('marketing/quotation/create', [
            'customers' => [],
            'materials' => [],
        ]);
    }

    public function customers()
    {
        $customers = DB::table('tb_cs')
            ->select(
                'kd_cs as kd_cs',
                'nm_cs as nm_cs',
                'Attnd as attnd',
                'alamat_cs as alamat_cs',
                'telp_cs as telp_cs',
                'fax_cs as fax_cs'
            )
            ->orderBy('nm_cs')
            ->get();

        return response()->json([
            'customers' => $customers,
        ]);
    }

    public function materials()
    {
        $materials = DB::table('tb_material')
            ->select(
                'Material as material',
                'Unit as unit',
                'Stok as stok',
                'Remark as remark'
            )
            ->orderBy('Material')
            ->get();

        return response()->json([
            'materials' => $materials,
        ]);
    }


    public function edit($noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran',
                'Tgl_penawaran',
                'Tgl_Posting',
                'Customer',
                'Alamat',
                'Telp',
                'Fax',
                'Email',
                'Attend',
                'Payment',
                'Validity',
                'Delivery',
                'Franco',
                'Note1',
                'Note2',
                'Note3'
            )
            ->where('No_penawaran', $noPenawaran)
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        $hargaModalColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga_Modal', 'Harga_modal', 'harga_modal'],
            'Harga_Modal'
        );

        $quotationDetails = DB::table('tb_penawarandetail')
            ->select(
                'ID',
                DB::raw($this->wrapColumn($noPenawaranColumn).' as No_penawaran'),
                'Material',
                'Harga',
                'Qty',
                'Satuan',
                DB::raw($this->wrapColumn($hargaModalColumn).' as Harga_modal'),
                'Margin',
                'Remark'
            )
            ->where($noPenawaranColumn, $noPenawaran)
            ->orderBy($noPenawaranColumn)
            ->get();

        return Inertia::render('marketing/quotation/edit', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'customers' => [],
            'materials' => [],
        ]);
    }

    public function print(Request $request, $noPenawaran)
    {
        $quotation = DB::table('tb_penawaran')
            ->select(
                'No_penawaran',
                'Tgl_penawaran',
                'Customer',
                'Alamat',
                'Telp',
                'Email',
                'Attend',
                'Payment',
                'Validity',
                'Delivery',
                'Franco'
            )
            ->where('No_penawaran', $noPenawaran)
            ->first();

        if (!$quotation) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        $hargaColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga', 'harga'],
            'Harga'
        );
        $hargaModalColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga_Modal', 'Harga_modal', 'harga_modal'],
            'Harga_Modal'
        );

        $quotationDetails = DB::table('tb_penawarandetail')
            ->selectRaw(
                'ID, '.
                $this->wrapColumn($noPenawaranColumn).' as No_penawaran, '.
                'Material, '.
                'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                .' THEN '.$this->wrapColumn($hargaModalColumn)
                .' ELSE '.$this->wrapColumn($hargaColumn).' END as Harga, '.
                'Qty, '.
                'Satuan, '.
                'CASE WHEN '.$this->wrapColumn($hargaModalColumn).' > '.$this->wrapColumn($hargaColumn)
                .' THEN '.$this->wrapColumn($hargaColumn)
                .' ELSE '.$this->wrapColumn($hargaModalColumn).' END as Harga_modal, '.
                'Remark'
            )
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [$noPenawaran])
            ->orderBy('ID')
            ->get();

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $lookupKey = is_string($database) ? strtolower($database) : '';
        $lookupKey = preg_replace('/[^a-z0-9]/', '', $lookupKey ?? '');
        if ($lookupKey === '') {
            $lookupKey = 'dbsja';
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

        return Inertia::render('marketing/quotation/print', [
            'quotation' => $quotation,
            'quotationDetails' => $quotationDetails,
            'company' => $company,
        ]);
    }

    public function update(Request $request, $noPenawaran)
    {
        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $exists = DB::table('tb_penawaran')
            ->where('No_penawaran', $noPenawaran)
            ->exists();

        if (!$exists) {
            return redirect()
                ->route('marketing.quotation.index')
                ->with('error', 'Data quotation tidak ditemukan.');
        }

        try {
            DB::transaction(function () use ($request, $materials, $noPenawaran) {
                DB::table('tb_penawaran')
                    ->where('No_penawaran', $noPenawaran)
                    ->update([
                        'Tgl_penawaran' => $request->input('tgl_penawaran')
                            ?? Carbon::today()->toDateString(),
                        'Customer' => $request->input('customer'),
                        'Alamat' => $request->input('alamat'),
                        'Telp' => $request->input('telp'),
                        'Fax' => $request->input('fax'),
                        'Email' => $request->input('email'),
                        'Attend' => $request->input('attend'),
                        'Payment' => $request->input('payment'),
                        'Validity' => $request->input('validity'),
                        'Delivery' => $request->input('delivery'),
                        'Franco' => $request->input('franco'),
                        'Note1' => $request->input('note1'),
                        'Note2' => $request->input('note2'),
                        'Note3' => $request->input('note3'),
                    ]);

                $noPenawaranColumn = $this->resolveColumn(
                    'tb_penawarandetail',
                    ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
                    'No_penawaran'
                );
                DB::table('tb_penawarandetail')
                    ->where($noPenawaranColumn, $noPenawaran)
                    ->delete();

                foreach ($materials as $item) {
                    $hargaModalColumn = $this->resolveColumn(
                        'tb_penawarandetail',
                        ['Harga_Modal', 'Harga_modal', 'harga_modal'],
                        'Harga_Modal'
                    );
                    DB::table('tb_penawarandetail')->insert([
                        $noPenawaranColumn => $noPenawaran,
                        'Material' => $item['material'] ?? null,
                        'Qty' => $item['quantity'] ?? null,
                        'Harga' => $item['harga_penawaran'] ?? null,
                        $hargaModalColumn => $item['harga_modal'] ?? null,
                        'Satuan' => $item['satuan'] ?? null,
                        'Margin' => $item['margin'] ?? null,
                        'Remark' => $item['remark'] ?? null,
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil diperbarui.');
    }


    public function updateDetail(Request $request, $noPenawaran, $detailId)
    {
        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        $exists = DB::table('tb_penawarandetail')
            ->where($noPenawaranColumn, $noPenawaran)
            ->where('ID', $detailId)
            ->exists();

        if (!$exists) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        $hargaModalColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['Harga_Modal', 'Harga_modal', 'harga_modal'],
            'Harga_Modal'
        );
        DB::table('tb_penawarandetail')
            ->where($noPenawaranColumn, $noPenawaran)
            ->where('ID', $detailId)
            ->update([
                'Material' => $request->input('material'),
                'Qty' => $request->input('quantity'),
                'Harga' => $request->input('harga_penawaran'),
                $hargaModalColumn => $request->input('harga_modal'),
                'Satuan' => $request->input('satuan'),
                'Margin' => $request->input('margin'),
                'Remark' => $request->input('remark'),
            ]);

        return back()->with('success', 'Detail quotation berhasil diperbarui.');
    }

    public function destroyDetail($noPenawaran, $detailId)
    {
        $noPenawaranColumn = $this->resolveColumn(
            'tb_penawarandetail',
            ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
            'No_penawaran'
        );
        $deleted = DB::table('tb_penawarandetail')
            ->where($noPenawaranColumn, $noPenawaran)
            ->where('ID', $detailId)
            ->delete();

        if (!$deleted) {
            return back()->with('error', 'Detail quotation tidak ditemukan.');
        }

        return back()->with('success', 'Detail quotation berhasil dihapus.');
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

        $materials = $request->input('materials', []);
        if (!is_array($materials)) {
            $materials = [];
        }

        $maxAttempts = 3;
        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use ($request, $materials, $prefix) {
                    $lastNumber = DB::table('tb_penawaran')
                        ->where('No_penawaran', 'like', $prefix.'%')
                        ->orderBy('No_penawaran', 'desc')
                        ->lockForUpdate()
                        ->value('No_penawaran');

                    $sequence = 1;
                    if ($lastNumber) {
                        $suffix = substr($lastNumber, strlen($prefix));
                        $sequence = max(1, (int) $suffix + 1);
                    }

                    $noPenawaran = $prefix.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);

                    if (DB::table('tb_penawaran')->where('No_penawaran', $noPenawaran)->exists()) {
                        throw new \RuntimeException('duplicate_no_penawaran');
                    }

                    DB::table('tb_penawaran')->insert([
                    'No_penawaran' => $noPenawaran,
                    'Tgl_penawaran' => $request->input('tgl_penawaran')
                        ?? Carbon::today()->toDateString(),
                    'Tgl_Posting' => Carbon::today()->toDateString(),
                    'Customer' => $request->input('customer'),
                    'Alamat' => $request->input('alamat'),
                    'Telp' => $request->input('telp'),
                    'Fax' => $request->input('fax'),
                    'Email' => $request->input('email'),
                    'Attend' => $request->input('attend'),
                    'Payment' => $request->input('payment'),
                    'Validity' => $request->input('validity'),
                    'Delivery' => $request->input('delivery'),
                    'Franco' => $request->input('franco'),
                    'Note1' => $request->input('note1'),
                    'Note2' => $request->input('note2'),
                    'Note3' => $request->input('note3'),
                ]);

                foreach ($materials as $item) {
                    $noPenawaranColumn = $this->resolveColumn(
                        'tb_penawarandetail',
                        ['No_Penawaran', 'No_penawaran', 'no_penawaran'],
                        'No_penawaran'
                    );
                    $hargaModalColumn = $this->resolveColumn(
                        'tb_penawarandetail',
                        ['Harga_Modal', 'Harga_modal', 'harga_modal'],
                        'Harga_Modal'
                    );
                    DB::table('tb_penawarandetail')->insert([
                        $noPenawaranColumn => $noPenawaran,
                        'Material' => $item['material'] ?? null,
                        'Qty' => $item['quantity'] ?? null,
                        'Harga' => $item['harga_penawaran'] ?? null,
                        $hargaModalColumn => $item['harga_modal'] ?? null,
                        'Satuan' => $item['satuan'] ?? null,
                        'Margin' => $item['margin'] ?? null,
                        'Remark' => $item['remark'] ?? null,
                    ]);
                }
                });
                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isDuplicate = str_contains($message, 'duplicate_no_penawaran')
                    || str_contains($message, 'duplicate')
                    || ($exception instanceof \Illuminate\Database\QueryException
                        && $exception->getCode() === '23000');

                if ($attempt < $maxAttempts && $isDuplicate) {
                    continue;
                }

                return back()->with('error', $exception->getMessage());
            }
        }

        return redirect()
            ->route('marketing.quotation.index')
            ->with('success', 'Data quotation berhasil disimpan.');
    }
}
