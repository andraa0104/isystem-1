<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderInService
{
    private const DETAIL_BATCH_SIZE = 50;

    private function parseDateOrNull(?string $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) === 1) {
            return $text;
        }

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $text, $matches) === 1) {
            return $matches[3].'-'.$matches[2].'-'.$matches[1];
        }

        return null;
    }

    private function generateKodePoin(string $prefix): string
    {
        $latest = DB::table('tb_poin')
            ->select('kode_poin')
            ->where('kode_poin', 'like', $prefix.'.POIN-%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();

        $nextNumber = 1;
        if ($latest && isset($latest->kode_poin)) {
            $current = (string) $latest->kode_poin;
            if (preg_match('/(\d{1,})$/', $current, $matches) === 1) {
                $nextNumber = ((int) $matches[1]) + 1;
            }
        }

        return $prefix.'.POIN-'.str_pad((string) $nextNumber, 8, '0', STR_PAD_LEFT);
    }

    private function normalizeMaterialCode(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private function resolveCustomerForPoin(array $validated): object
    {
        $customerCode = trim((string) ($validated['kd_customer'] ?? ''));
        $customerName = trim((string) ($validated['customer_name'] ?? ''));
        $customerByCode = null;

        if ($customerCode !== '') {
            $customerByCode = DB::table('tb_cs')
                ->whereRaw('lower(trim(kd_cs)) = lower(trim(?))', [$customerCode])
                ->first(['kd_cs', 'nm_cs']);

            if (
                $customerByCode &&
                $customerName !== '' &&
                strtolower(trim((string) $customerByCode->nm_cs)) === strtolower($customerName)
            ) {
                return $customerByCode;
            }
        }

        if ($customerName !== '') {
            $customerByName = DB::table('tb_cs')
                ->whereRaw('lower(trim(nm_cs)) = lower(trim(?))', [$customerName])
                ->orderByDesc('kd_cs')
                ->first(['kd_cs', 'nm_cs']);

            if ($customerByName) {
                return $customerByName;
            }
        }

        if ($customerCode !== '') {
            if ($customerByCode) {
                return $customerByCode;
            }
        }

        throw ValidationException::withMessages([
            'customer_name' => "Customer {$customerName} tidak ditemukan di master customer.",
        ]);
    }

    public function hasPartialDo(string $kodePoin): bool
    {
        return DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->whereRaw('coalesce(sisa_qtydo, 0) <> 0')
            ->whereRaw('coalesce(sisa_qtydo, 0) <> coalesce(qty, 0)')
            ->exists();
    }

    public function recalculateHeaderTotals(string $kodePoin): void
    {
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first(['ppn_input_percent']);

        if (! $header) {
            return;
        }

        $totalPrice = (float) (DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->selectRaw('coalesce(sum(coalesce(cast(qty as decimal(18,4)), 0) * coalesce(cast(price_po_in as decimal(18,4)), 0)), 0) as total_price')
            ->value('total_price') ?? 0);
        $ppnPercentInput = (float) ($header->ppn_input_percent ?? 0);
        $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
        $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);
        $dpp = $ppnPercentInput > 0
            ? round((11 / $ppnPercentInput) * $totalPrice, 2)
            : $totalPrice;
        $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
        $grandTotal = round($totalPrice + $ppnValue, 2);

        DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->update([
                'total_price' => $totalPrice,
                'dpp' => $dpp,
                'ppn_amount' => $ppnValue,
                'grand_total' => $grandTotal,
                'updated_at' => now('Asia/Singapore'),
            ]);
    }

    public function deletePurchaseOrderIn(string $kodePoin): void
    {
        DB::transaction(function () use ($kodePoin) {
            $header = DB::table('tb_poin')->where('kode_poin', $kodePoin)
                ->lockForUpdate()->first(['kode_poin']);
            if (! $header) {
                throw new \RuntimeException('Data PO In tidak ditemukan.', 404);
            }
            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->delete();

            DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->delete();
        }, attempts: 3);
    }

    public function createPurchaseOrderIn(array $validated, string $dbPrefix): string
    {
        $noPoin = trim((string) $validated['no_poin']);

        return DB::transaction(function () use ($validated, $noPoin, $dbPrefix) {
            $duplicateExists = DB::table('tb_poin')
                ->whereRaw('lower(trim(no_poin)) = lower(trim(?))', [$noPoin])
                ->lockForUpdate()
                ->exists();

            if ($duplicateExists) {
                throw ValidationException::withMessages([
                    'no_poin' => "No PO In {$noPoin} sudah ada di database.",
                ]);
            }

            $nowGmt8 = now('Asia/Singapore');
            $kodePoin = $this->generateKodePoin($dbPrefix);
            $datePoin = $this->parseDateOrNull($validated['date'] ?? null);
            $deliveryDate = $this->parseDateOrNull($validated['delivery_date'] ?? null);

            $ppnPercentInput = (float) ($validated['ppn_percent'] ?? 0);
            $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
            $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);

            $totalPrice = (float) ($validated['total_price'] ?? 0);
            if ($totalPrice <= 0 && is_array($validated['materials'] ?? null)) {
                $totalPrice = collect($validated['materials'])->sum(function ($item) {
                    $qty = (float) ($item['qty'] ?? 0);
                    $price = (float) ($item['price_po_in'] ?? 0);

                    return $qty * $price;
                });
            }

            $dpp = $ppnPercentInput > 0
                ? round((11 / $ppnPercentInput) * $totalPrice, 2)
                : $totalPrice;
            $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
            $grandTotal = round($totalPrice + $ppnValue, 2);
            $resolvedCustomer = $this->resolveCustomerForPoin($validated);

            $headerId = (int) (DB::table('tb_poin')->max('id') ?? 0) + 1;
            DB::table('tb_poin')->insert([
                'id' => $headerId,
                'kode_poin' => $kodePoin,
                'no_poin' => $noPoin,
                'date_poin' => $datePoin,
                'delivery_date' => $deliveryDate,
                'kode_customer' => trim((string) $resolvedCustomer->kd_cs),
                'customer_name' => trim((string) $resolvedCustomer->nm_cs),
                'payment_term' => trim((string) ($validated['payment_term'] ?? '')),
                'franco_loco' => trim((string) $validated['franco_loco']),
                'sender_name' => trim((string) $validated['sender_name']),
                'note_doc' => trim((string) ($validated['note'] ?? '')),
                'ppn_input_percent' => $ppnPercentInputValue,
                'ppn_percent_used' => $ppnPercentUsed,
                'total_price' => $totalPrice,
                'dpp' => $dpp,
                'ppn_amount' => $ppnValue,
                'grand_total' => $grandTotal,
                'created_at' => $nowGmt8,
                'updated_at' => $nowGmt8,
            ]);

            $detailId = (int) (DB::table('tb_detailpoin')->max('id') ?? 0) + 1;
            $detailData = [];
            foreach (($validated['materials'] ?? []) as $index => $item) {
                $qty = (float) ($item['qty'] ?? 0);
                $price = (float) ($item['price_po_in'] ?? 0);
                $totalDetail = isset($item['total_price_po_in'])
                    ? (float) $item['total_price_po_in']
                    : ($qty * $price);

                $kdMaterial = $this->normalizeMaterialCode($item['kd_material'] ?? null);

                $detailRow = [
                    'id' => $detailId + $index,
                    'id_poin' => $headerId,
                    'kode_poin' => $kodePoin,
                    'kd_material' => $kdMaterial,
                    'material' => trim((string) ($item['material'] ?? '')),
                    'qty' => $qty,
                    'sisa_qtypr' => $qty,
                    'sisa_qtydo' => $qty,
                    'satuan' => trim((string) ($item['satuan'] ?? '')),
                    'price_po_in' => $price,
                    'total_price_po_in' => $totalDetail,
                    'remark' => trim((string) ($item['remark'] ?? '')),
                    'created_at' => $nowGmt8,
                    'updated_at' => $nowGmt8,
                ];

                $detailRow['no_poin'] = $noPoin;

                $detailData[] = $detailRow;
            }

            foreach (array_chunk($detailData, self::DETAIL_BATCH_SIZE) as $batch) {
                DB::table('tb_detailpoin')->insert($batch);
            }

            return $kodePoin;
        }, attempts: 3);
    }

    public function updatePurchaseOrderIn(string $kodePoin, array $validated): void
    {
        DB::transaction(function () use ($validated, $kodePoin) {
            $header = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->lockForUpdate()
                ->first();

            if (! $header) {
                throw new \RuntimeException('Data PO In tidak ditemukan.');
            }

            $hasPartialDo = $this->hasPartialDo($kodePoin);
            if ($hasPartialDo) {
                $current = $header;
                if ($current) {
                    $hasChanged =
                        trim((string) $validated['no_poin']) !== trim((string) ($current->no_poin ?? '')) ||
                        $this->parseDateOrNull($validated['date'] ?? null) !== $current->date_poin ||
                        $this->parseDateOrNull($validated['delivery_date'] ?? null) !== $current->delivery_date ||
                        trim((string) $validated['customer_name']) !== trim((string) ($current->customer_name ?? '')) ||
                        trim((string) ($validated['payment_term'] ?? '')) !== trim((string) ($current->payment_term ?? '')) ||
                        trim((string) $validated['franco_loco']) !== trim((string) ($current->franco_loco ?? '')) ||
                        trim((string) $validated['sender_name']) !== trim((string) ($current->sender_name ?? '')) ||
                        trim((string) ($validated['note'] ?? '')) !== trim((string) ($current->note_doc ?? '')) ||
                        (float) ($validated['ppn_percent'] ?? 0) !== (float) ($current->ppn_input_percent ?? 0);

                    if ($hasChanged) {
                        throw ValidationException::withMessages([
                            'no_poin' => 'Header PO tidak boleh diubah karena sudah ada DO terkirim (status partial).',
                        ]);
                    }
                }
            }

            $oldNoPoin = trim((string) ($header->no_poin ?? ''));
            $newNoPoin = trim((string) $validated['no_poin']);

            $duplicateExists = DB::table('tb_poin')
                ->whereRaw('lower(trim(no_poin)) = lower(trim(?))', [$newNoPoin])
                ->where('kode_poin', '<>', $kodePoin)
                ->exists();

            if ($duplicateExists) {
                throw ValidationException::withMessages([
                    'no_poin' => "No PO In {$newNoPoin} sudah ada di database.",
                ]);
            }

            $nowGmt8 = now('Asia/Singapore');
            $datePoin = $this->parseDateOrNull($validated['date'] ?? null);
            $deliveryDate = $this->parseDateOrNull($validated['delivery_date'] ?? null);
            $resolvedCustomer = $this->resolveCustomerForPoin($validated);
            $ppnPercentInput = (float) ($validated['ppn_percent'] ?? 0);
            $ppnPercentInputValue = $ppnPercentInput <= 0 ? 0.0 : $ppnPercentInput;
            $ppnPercentUsed = $ppnPercentInputValue <= 0 ? 0.0 : min(11.0, $ppnPercentInputValue);

            $totalPrice = (float) (DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->selectRaw('coalesce(sum(coalesce(cast(qty as decimal(18,4)), 0) * coalesce(cast(price_po_in as decimal(18,4)), 0)), 0) as total_price')
                ->value('total_price') ?? 0);

            $dpp = $ppnPercentInput > 0
                ? round((11 / $ppnPercentInput) * $totalPrice, 2)
                : $totalPrice;
            $ppnValue = round($totalPrice * ($ppnPercentUsed / 100), 2);
            $grandTotal = round($totalPrice + $ppnValue, 2);

            DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->update([
                    'no_poin' => $newNoPoin,
                    'date_poin' => $datePoin,
                    'delivery_date' => $deliveryDate,
                    'kode_customer' => trim((string) $resolvedCustomer->kd_cs),
                    'customer_name' => trim((string) $resolvedCustomer->nm_cs),
                    'payment_term' => trim((string) ($validated['payment_term'] ?? '')),
                    'franco_loco' => trim((string) $validated['franco_loco']),
                    'sender_name' => trim((string) $validated['sender_name']),
                    'note_doc' => trim((string) ($validated['note'] ?? '')),
                    'ppn_input_percent' => $ppnPercentInputValue,
                    'ppn_percent_used' => $ppnPercentUsed,
                    'total_price' => $totalPrice,
                    'dpp' => $dpp,
                    'ppn_amount' => $ppnValue,
                    'grand_total' => $grandTotal,
                    'updated_at' => $nowGmt8,
                ]);

            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->update([
                    'no_poin' => $newNoPoin,
                    'updated_at' => $nowGmt8,
                ]);

            $this->syncPurchaseRequirementRefPo($oldNoPoin, $newNoPoin);
        }, attempts: 3);
    }

    /** Update PR references in bounded statements, rather than one UPDATE per related row. */
    private function syncPurchaseRequirementRefPo(string $oldRefPo, string $newRefPo): void
    {
        $oldRefPo = trim($oldRefPo);
        $newRefPo = trim($newRefPo);
        if ($oldRefPo === '' || $newRefPo === '' || strcasecmp($oldRefPo, $newRefPo) === 0) {
            return;
        }

        $connection = DB::connection();
        $grammar = $connection->getQueryGrammar();
        foreach (['tb_pr' => ['no_pr'], 'tb_detailpr' => ['no_pr', 'no']] as $table => $keys) {
            // LIKE finds candidates; exact comma-separated tokens are checked below in PHP.
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], strtolower($oldRefPo)).'%';
            $query = $connection->table($table)->whereRaw("lower(ref_po) like ? escape '!'", [$pattern]);
            foreach ($keys as $key) {
                $query->orderBy($key);
            }
            // Read keys before updating: offset pagination would skip rows as ref_po stops matching.
            $query->get([...$keys, 'ref_po'])->chunk(100)->each(function ($rows) use ($connection, $grammar, $table, $keys, $oldRefPo, $newRefPo) {
                $cases = [];
                $conditions = [];
                $caseBindings = [];
                $whereBindings = [];
                foreach ($rows as $row) {
                    $parts = array_map('trim', explode(',', (string) $row->ref_po));
                    $changed = false;
                    foreach ($parts as &$part) {
                        if (strcasecmp($part, $oldRefPo) === 0) {
                            $part = $newRefPo;
                            $changed = true;
                        }
                    }
                    unset($part);
                    if (! $changed) {
                        continue;
                    }
                    $condition = implode(' and ', array_map(fn ($key) => $grammar->wrap($key).' = ?', $keys));
                    $values = array_map(fn ($key) => $row->{$key}, $keys);
                    $cases[] = 'when ('.$condition.') then ?';
                    array_push($caseBindings, ...$values);
                    $caseBindings[] = implode(', ', $parts);
                    $conditions[] = '('.$condition.')';
                    array_push($whereBindings, ...$values);
                }
                if ($cases !== []) {
                    $column = $grammar->wrap('ref_po');
                    $sql = 'update '.$grammar->wrapTable($table).' set '.$column.' = case '
                        .implode(' ', $cases).' else '.$column.' end where '.implode(' or ', $conditions);
                    $connection->update($sql, array_merge($caseBindings, $whereBindings));
                }
            });
        }
    }

    public function addPurchaseOrderDetail(string $kodePoin, array $validated): array
    {
        return DB::transaction(function () use ($kodePoin, $validated) {
            $header = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->lockForUpdate()->first(['id', 'no_poin']);

            if (! $header) {
                throw new \Exception('Data PO In tidak ditemukan.', 404);
            }

            if ($this->hasPartialDo($kodePoin)) {
                throw ValidationException::withMessages([
                    'kd_material' => 'Material tidak dapat ditambahkan karena PO In ini memiliki pengiriman partial.',
                ]);
            }

            $qty = (float) ($validated['qty'] ?? 0);
            $price = (float) ($validated['price_po_in'] ?? 0);
            $total = array_key_exists('total_price_po_in', $validated)
                ? (float) $validated['total_price_po_in']
                : ($qty * $price);
            $nowGmt8 = now('Asia/Singapore');

            $kdMaterial = $this->normalizeMaterialCode($validated['kd_material'] ?? null);
            $sisaQtyPr = $qty;
            $detailId = ((int) (DB::table('tb_detailpoin')->max('id') ?? 0)) + 1;

            $insertData = [
                'id' => $detailId,
                'id_poin' => $header->id,
                'kode_poin' => $kodePoin,
                'kd_material' => $kdMaterial,
                'material' => trim((string) $validated['material']),
                'qty' => $qty,
                'sisa_qtypr' => $sisaQtyPr,
                'sisa_qtydo' => $qty,
                'satuan' => trim((string) ($validated['satuan'] ?? '')),
                'price_po_in' => $price,
                'total_price_po_in' => $total,
                'remark' => trim((string) ($validated['remark'] ?? '')),
                'created_at' => $nowGmt8,
                'updated_at' => $nowGmt8,
                'no_poin' => trim((string) ($header->no_poin ?? '')),
            ];

            DB::table('tb_detailpoin')->insert($insertData);
            $this->recalculateHeaderTotals($kodePoin);

            return [
                'id' => $detailId,
                'sisa_qtypr' => $sisaQtyPr,
                'sisa_qtydo' => $qty,
            ];
        }, attempts: 3);
    }

    public function updatePurchaseOrderDetail(string $kodePoin, int $detailId, array $validated): void
    {
        DB::transaction(function () use ($kodePoin, $detailId, $validated) {
            $headerExists = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->lockForUpdate()->first(['kode_poin']);

            if (! $headerExists) {
                throw new \Exception('Data PO In tidak ditemukan.', 404);
            }

            $detail = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->lockForUpdate()->first();

            if (! $detail) {
                throw new \Exception('Data material tidak ditemukan.', 404);
            }

            $qty = (float) ($validated['qty'] ?? 0);
            $originalQty = (float) ($detail->qty ?? 0);
            $sisaQtyPrBefore = (float) ($detail->sisa_qtypr ?? 0);
            $usedQtyPr = max(0, $originalQty - $sisaQtyPrBefore);
            $sisaQtyDoBefore = (float) ($detail->sisa_qtydo ?? $originalQty);

            $hasPartialDo = $this->hasPartialDo($kodePoin);
            if ($hasPartialDo) {
                $isEditableItem = ($sisaQtyDoBefore != 0.0);
                if (! $isEditableItem) {
                    throw ValidationException::withMessages([
                        'qty' => 'Material ini tidak dapat diubah karena sudah terkirim sepenuhnya.',
                    ]);
                }

                $deliveredQty = $originalQty - $sisaQtyDoBefore;
                if ($qty < $deliveredQty) {
                    throw ValidationException::withMessages([
                        'qty' => 'Qty tidak boleh kurang dari jumlah yang sudah terkirim ('.number_format($deliveredQty, 0, ',', '.').').',
                    ]);
                }

                if ($qty < $usedQtyPr) {
                    throw ValidationException::withMessages([
                        'qty' => 'Qty tidak boleh kurang dari qty yang sudah ada pada tb_detailpr ('.number_format($usedQtyPr, 0, ',', '.').').',
                    ]);
                }

                $hasOtherChanges =
                    (string) $this->normalizeMaterialCode($validated['kd_material'] ?? null) !== (string) $detail->kd_material ||
                    trim((string) $validated['material']) !== trim((string) $detail->material) ||
                    trim((string) ($validated['satuan'] ?? '')) !== trim((string) ($detail->satuan ?? '')) ||
                    (float) ($validated['price_po_in'] ?? 0) !== (float) ($detail->price_po_in ?? 0) ||
                    trim((string) ($validated['remark'] ?? '')) !== trim((string) ($detail->remark ?? ''));

                if ($hasOtherChanges) {
                    throw ValidationException::withMessages([
                        'qty' => 'Hanya Qty yang boleh diubah untuk menutup sisa DO.',
                    ]);
                }
            } else {
                if ($sisaQtyPrBefore == 0.0 && $qty <= $originalQty) {
                    throw ValidationException::withMessages([
                        'qty' => 'Sisa Qty PR sudah 0. Qty harus lebih dari qty awal.',
                    ]);
                }

                if ($sisaQtyPrBefore != 0.0 && $qty < $usedQtyPr) {
                    throw ValidationException::withMessages([
                        'qty' => 'Qty tidak boleh kurang dari qty yang sudah ada pada tb_detailpr.',
                    ]);
                }

                $usedQtyDo = max(0, $originalQty - $sisaQtyDoBefore);
                if ($qty < $usedQtyDo) {
                    throw ValidationException::withMessages([
                        'qty' => 'Qty tidak boleh kurang dari qty yang sudah ada penerimaan material (MI).',
                    ]);
                }
            }

            $price = (float) ($validated['price_po_in'] ?? 0);
            $total = array_key_exists('total_price_po_in', $validated)
                ? (float) $validated['total_price_po_in']
                : ($qty * $price);
            $nowGmt8 = now('Asia/Singapore');

            $kdMaterial = $this->normalizeMaterialCode($validated['kd_material'] ?? null);
            $sisaQtyPr = max(0, $sisaQtyPrBefore + ($qty - $originalQty));
            $sisaQtyDo = max(0.0, $sisaQtyDoBefore + ($qty - $originalQty));

            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->update([
                    'kd_material' => $kdMaterial,
                    'material' => trim((string) $validated['material']),
                    'qty' => $qty,
                    'sisa_qtypr' => $sisaQtyPr,
                    'sisa_qtydo' => $sisaQtyDo,
                    'satuan' => trim((string) ($validated['satuan'] ?? '')),
                    'price_po_in' => $price,
                    'total_price_po_in' => $total,
                    'remark' => trim((string) ($validated['remark'] ?? '')),
                    'updated_at' => $nowGmt8,
                ]);

            $this->recalculateHeaderTotals($kodePoin);
        }, attempts: 3);
    }

    public function deletePurchaseOrderDetail(string $kodePoin, int $detailId): void
    {
        DB::transaction(function () use ($kodePoin, $detailId) {
            $poHeader = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->lockForUpdate()->first(['no_poin', 'customer_name']);

            if (! $poHeader) {
                throw new \RuntimeException('Data PO In tidak ditemukan.', 404);
            }

            if ($this->hasPartialDo($kodePoin)) {
                throw new \RuntimeException('Material tidak dapat dihapus karena PO In ini memiliki pengiriman partial.', 422);
            }

            $detail = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->first();

            if (! $detail) {
                throw new \RuntimeException('Data material tidak ditemukan.', 404);
            }

            if ($poHeader) {
                $hasPr = DB::table('tb_detailpr')
                    ->where('ref_po', trim((string) $poHeader->no_poin))
                    ->whereRaw('lower(trim(for_customer)) = lower(trim(?))', [(string) $poHeader->customer_name])
                    ->where('kd_material', $detail->kd_material)
                    ->exists();

                if ($hasPr) {
                    throw new \RuntimeException('Material tidak dapat dihapus karena sudah dibuat PR.', 422);
                }
            }

            if (isset($detail->sisa_qtypr) && isset($detail->qty) && isset($detail->sisa_qtydo)) {
                $sisaQtyPr = (float) ($detail->sisa_qtypr ?? 0);
                $sisaQtyDo = (float) ($detail->sisa_qtydo ?? 0);
                $qty = (float) ($detail->qty ?? 0);
                if ($sisaQtyPr < $qty) {
                    throw new \RuntimeException('Material tidak dapat dihapus karena sudah dibuat PR.', 422);
                }
                if ($sisaQtyDo < $qty) {
                    throw new \RuntimeException('Material tidak dapat dihapus karena sudah ada penerimaan material (MI).', 422);
                }
            }

            $count = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->count();

            if ($count <= 1) {
                throw new \RuntimeException('Gagal menghapus. Minimal harus ada 1 material dalam PO In.', 400);
            }

            $deleted = DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->where('id', $detailId)
                ->delete();

            if (! $deleted) {
                throw new \RuntimeException('Data material tidak ditemukan.', 404);
            }

            $this->recalculateHeaderTotals($kodePoin);
        }, attempts: 3);
    }
}
