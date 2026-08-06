<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderInService
{
    private function parseDateOrNull(?string $value)
    {
        if (empty($value)) return null;
        if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $value)) {
            $parts = explode('-', $value);
            return "{$parts[2]}-{$parts[1]}-{$parts[0]}";
        }
        return $value;
    }

    private function generateKodePoin(string $dbPrefix)
    {
        $dateGmt8 = now('Asia/Singapore');
        $year = $dateGmt8->format('y');
        $month = $dateGmt8->format('m');
        $prefix = "PIN{$dbPrefix}{$year}{$month}";

        $lastPoin = DB::table('tb_poin')
            ->where('kode_poin', 'like', $prefix . '%')
            ->orderByRaw('CAST(SUBSTRING(kode_poin, ' . (strlen($prefix) + 1) . ') AS UNSIGNED) DESC')
            ->first();

        if ($lastPoin) {
            $lastIndex = (int) substr($lastPoin->kode_poin, strlen($prefix));
            $nextIndex = $lastIndex + 1;
        } else {
            $nextIndex = 1;
        }

        return $prefix . str_pad($nextIndex, 4, '0', STR_PAD_LEFT);
    }

    private function normalizeMaterialCode(mixed $value)
    {
        if ($value === null || $value === '' || (is_string($value) && trim($value) === '')) {
            return 0;
        }
        $val = (float) $value;
        return ($val == 0.0) ? 0 : $val;
    }

    private function resolveCustomerForPoin(array $validated)
    {
        $customerName = trim((string) $validated['customer_name']);
        
        $customer = null;
        if (!empty($validated['kd_customer'])) {
            $customer = DB::table('tb_cs')->where('kd_cs', $validated['kd_customer'])->first();
        }
        
        if (!$customer) {
            $customer = DB::table('tb_cs')
                ->whereRaw('lower(trim(nm_cs)) = lower(trim(?))', [$customerName])
                ->first();
        }

        if (!$customer) {
            if (empty($validated['kd_customer'])) {
                $maxKd = DB::table('tb_cs')->max('kd_cs');
                $nextNum = $maxKd ? ((int) substr($maxKd, 2)) + 1 : 1;
                $newKdCs = 'CS' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
            } else {
                $newKdCs = $validated['kd_customer'];
            }

            DB::table('tb_cs')->insert([
                'kd_cs' => $newKdCs,
                'nm_cs' => $customerName,
                'Attnd' => trim((string) ($validated['sender_name'] ?? '')),
            ]);

            $customer = DB::table('tb_cs')->where('kd_cs', $newKdCs)->first();
        } else {
            if (!empty($validated['sender_name'])) {
                $existingSender = trim((string) ($customer->Attnd ?? ''));
                $newSender = trim((string) $validated['sender_name']);

                if (empty($existingSender) || strcasecmp($existingSender, $newSender) !== 0) {
                    DB::table('tb_cs')
                        ->where('kd_cs', $customer->kd_cs)
                        ->update(['Attnd' => $newSender]);
                }
            }
        }

        return $customer;
    }

    public function hasPartialDo(string $kodePoin): bool
    {
        return DB::table('tb_do')
            ->where('kode_poin', $kodePoin)
            ->where('stat', 'partial')
            ->exists();
    }

    public function recalculateHeaderTotals(string $kodePoin): void
    {
        $header = DB::table('tb_poin')->where('kode_poin', $kodePoin)->first();
        if (!$header) return;

        $totalPrice = (float) (DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->selectRaw('coalesce(sum(coalesce(cast(qty as decimal(18,4)), 0) * coalesce(cast(price_po_in as decimal(18,4)), 0)), 0) as total_price')
            ->value('total_price') ?? 0);

        $ppnPercentInput = (float) ($header->ppn_input_percent ?? 0);
        $ppnPercentUsed = (float) ($header->ppn_percent_used ?? 0);

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
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first();

        if (!$header) {
            throw new \Exception('Data PO In tidak ditemukan.', 404);
        }

        DB::transaction(function () use ($kodePoin) {
            DB::table('tb_detailpoin')
                ->where('kode_poin', $kodePoin)
                ->delete();

            DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->delete();
        });
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
                $total = array_key_exists('total_price_po_in', $item)
                    ? (float) $item['total_price_po_in']
                    : ($qty * $price);
                
                $sisaQtyPr = $qty;

                $detailData[] = [
                    'id' => $detailId++,
                    'id_poin' => $headerId,
                    'kode_poin' => $kodePoin,
                    'no_poin' => $noPoin,
                    'kd_material' => $this->normalizeMaterialCode($item['kd_material'] ?? null),
                    'material' => trim((string) $item['material']),
                    'qty' => $qty,
                    'sisa_qtypr' => $sisaQtyPr,
                    'sisa_qtydo' => $qty,
                    'satuan' => trim((string) ($item['satuan'] ?? '')),
                    'price_po_in' => $price,
                    'total_price_po_in' => $total,
                    'remark' => trim((string) ($item['remark'] ?? '')),
                    'created_at' => $nowGmt8,
                    'updated_at' => $nowGmt8,
                ];
            }

            if (!empty($detailData)) {
                DB::table('tb_detailpoin')->insert($detailData);
            }

            return $kodePoin;
        });
    }

    public function updatePurchaseOrderIn(string $kodePoin, array $validated): void
    {
        DB::transaction(function () use ($validated, $kodePoin) {
            $header = DB::table('tb_poin')
                ->where('kode_poin', $kodePoin)
                ->lockForUpdate()
                ->first(['kode_poin', 'no_poin']);

            if (!$header) {
                throw new \RuntimeException('Data PO In tidak ditemukan.');
            }

            $hasPartialDo = $this->hasPartialDo($kodePoin);
            if ($hasPartialDo) {
                $current = DB::table('tb_poin')
                    ->where('kode_poin', $kodePoin)
                    ->first();
                if ($current) {
                    $hasChanged = 
                        trim((string)$validated['no_poin']) !== trim((string)($current->no_poin ?? '')) ||
                        $this->parseDateOrNull($validated['date'] ?? null) !== $current->date_poin ||
                        $this->parseDateOrNull($validated['delivery_date'] ?? null) !== $current->delivery_date ||
                        trim((string)$validated['customer_name']) !== trim((string)($current->customer_name ?? '')) ||
                        trim((string)($validated['payment_term'] ?? '')) !== trim((string)($current->payment_term ?? '')) ||
                        trim((string)$validated['franco_loco']) !== trim((string)($current->franco_loco ?? '')) ||
                        trim((string)$validated['sender_name']) !== trim((string)($current->sender_name ?? '')) ||
                        trim((string)($validated['note'] ?? '')) !== trim((string)($current->note_doc ?? '')) ||
                        (float)($validated['ppn_percent'] ?? 0) !== (float)($current->ppn_input_percent ?? 0);

                    if ($hasChanged) {
                        throw ValidationException::withMessages([
                            'no_poin' => 'Header PO tidak boleh diubah karena sudah ada DO terkirim (status partial).',
                        ]);
                    }
                }
            }

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
                ]);
        });
    }

    public function addPurchaseOrderDetail(string $kodePoin, array $validated): array
    {
        $header = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->first(['id', 'no_poin']);

        if (!$header) {
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
            'no_poin' => trim((string) ($header->no_poin ?? ''))
        ];

        DB::table('tb_detailpoin')->insert($insertData);
        $this->recalculateHeaderTotals($kodePoin);

        return [
            'id' => $detailId,
            'sisa_qtypr' => $sisaQtyPr,
            'sisa_qtydo' => $qty,
        ];
    }
    
    public function updatePurchaseOrderDetail(string $kodePoin, int $detailId, array $validated): void
    {
        $headerExists = DB::table('tb_poin')
            ->where('kode_poin', $kodePoin)
            ->exists();

        if (!$headerExists) {
            throw new \Exception('Data PO In tidak ditemukan.', 404);
        }

        $detail = DB::table('tb_detailpoin')
            ->where('kode_poin', $kodePoin)
            ->where('id', $detailId)
            ->first();

        if (!$detail) {
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
            if (!$isEditableItem) {
                throw ValidationException::withMessages([
                    'qty' => 'Material ini tidak dapat diubah karena sudah terkirim sepenuhnya.',
                ]);
            }

            $deliveredQty = $originalQty - $sisaQtyDoBefore;
            if ($qty < $deliveredQty) {
                throw ValidationException::withMessages([
                    'qty' => 'Qty tidak boleh kurang dari jumlah yang sudah terkirim (' . number_format($deliveredQty, 0, ',', '.') . ').',
                ]);
            }

            if ($qty < $usedQtyPr) {
                throw ValidationException::withMessages([
                    'qty' => 'Qty tidak boleh kurang dari qty yang sudah ada pada tb_detailpr (' . number_format($usedQtyPr, 0, ',', '.') . ').',
                ]);
            }

            $hasOtherChanges = 
                (string)$this->normalizeMaterialCode($validated['kd_material'] ?? null) !== (string)$detail->kd_material ||
                trim((string) $validated['material']) !== trim((string)$detail->material) ||
                trim((string) ($validated['satuan'] ?? '')) !== trim((string)($detail->satuan ?? '')) ||
                (float)($validated['price_po_in'] ?? 0) !== (float)($detail->price_po_in ?? 0) ||
                trim((string) ($validated['remark'] ?? '')) !== trim((string)($detail->remark ?? ''));

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
    }
}
