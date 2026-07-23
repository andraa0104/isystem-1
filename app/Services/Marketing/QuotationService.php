<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;
use Illuminate\Database\QueryException;

class QuotationService
{
    private array $columnCache = [];

    /**
     * Set a value or fallback to a space to bypass strict NOT NULL empty checks.
     */
    private function valueOrSpace(mixed $value): string
    {
        if ($value === null) {
            return ' ';
        }
        $text = trim((string) $value);
        return $text === '' ? ' ' : $text;
    }

    /**
     * Resolve actual column name from database matching one of the candidates.
     */
    private function resolveColumn(string $table, array $candidates, string $fallback): string
    {
        if (!isset($this->columnCache[$table])) {
            $columns = DB::select('SHOW COLUMNS FROM ' . $table);
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

    /**
     * Wrap column in backticks.
     */
    private function wrapColumn(string $column): string
    {
        return '`' . str_replace('`', '``', $column) . '`';
    }

    /**
     * Create a new Quotation with details, handling Counter increment securely.
     */
    public function createQuotation(array $data, string $prefix, int $maxAttempts = 10): bool
    {
        $materials = $data['materials'] ?? [];
        if (!is_array($materials)) {
            $materials = [];
        }

        $attempt = 0;

        while (true) {
            try {
                DB::transaction(function () use ($data, $materials, $prefix) {
                    $counter = DB::table('tb_counter')
                        ->select('nomor_terakhir')
                        ->where('nama_tabel', 'tb_penawaran')
                        ->first();

                    if (!$counter) {
                        throw new \RuntimeException('Data counter tb_penawaran tidak ditemukan.');
                    }

                    $oldNumber = (int) $counter->nomor_terakhir;
                    $newNumber = $oldNumber + 1;

                    $updated = DB::table('tb_counter')
                        ->where('nama_tabel', 'tb_penawaran')
                        ->where('nomor_terakhir', $oldNumber)
                        ->update(['nomor_terakhir' => $newNumber]);

                    if ($updated === 0) {
                        throw new \RuntimeException('counter_tb_penawaran_dipakai');
                    }

                    $noPenawaran = $prefix . str_pad((string) $newNumber, 7, '0', STR_PAD_LEFT);

                    if (DB::table('tb_penawaran')->where('No_penawaran', $noPenawaran)->exists()) {
                        throw new \RuntimeException('duplicate_no_penawaran');
                    }

                    DB::table('tb_penawaran')->insert([
                        'No_penawaran' => $noPenawaran,
                        'Tgl_penawaran' => $data['tgl_penawaran'] ?? Carbon::today()->toDateString(),
                        'Tgl_Posting' => Carbon::today()->toDateString(),
                        'Customer' => $this->valueOrSpace($data['customer'] ?? null),
                        'Alamat' => $this->valueOrSpace($data['alamat'] ?? null),
                        'Telp' => $this->valueOrSpace($data['telp'] ?? null),
                        'Fax' => $this->valueOrSpace($data['fax'] ?? null),
                        'Email' => $this->valueOrSpace($data['email'] ?? null),
                        'Attend' => $this->valueOrSpace($data['attend'] ?? null),
                        'Payment' => $this->valueOrSpace($data['payment'] ?? null),
                        'Validity' => $this->valueOrSpace($data['validity'] ?? null),
                        'Delivery' => $this->valueOrSpace($data['delivery'] ?? null),
                        'Franco' => $this->valueOrSpace($data['franco'] ?? null),
                        'Note1' => $this->valueOrSpace($data['note1'] ?? null),
                        'Note2' => $this->valueOrSpace($data['note2'] ?? null),
                        'Note3' => $this->valueOrSpace($data['note3'] ?? null),
                    ]);

                    $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
                    $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
                    
                    $insertData = [];
                    foreach ($materials as $item) {
                        $marginInput = $item['margin'] ?? null;
                        if ($marginInput !== null && trim($marginInput) !== '' && !str_contains($marginInput, '%')) {
                            $marginInput = trim($marginInput) . '%';
                        }
                        $insertData[] = [
                            $noPenawaranColumn => $noPenawaran,
                            'Material' => $item['material'] ?? null,
                            'Qty' => $item['quantity'] ?? null,
                            'Harga' => $item['harga_penawaran'] ?? null,
                            $hargaModalColumn => $item['harga_modal'] ?? null,
                            'Satuan' => $item['satuan'] ?? null,
                            'Margin' => $marginInput,
                            'Remark' => $this->valueOrSpace($item['remark'] ?? null),
                        ];
                    }

                    if (!empty($insertData)) {
                        DB::table('tb_penawarandetail')->insert($insertData);
                    }
                });

                break;
            } catch (\Throwable $exception) {
                $attempt++;
                $message = strtolower($exception->getMessage());
                $isCounterConflict = str_contains($message, 'counter_tb_penawaran_dipakai');
                $isDuplicate = str_contains($message, 'duplicate_no_penawaran')
                    || str_contains($message, 'duplicate')
                    || ($exception instanceof QueryException && $exception->getCode() === '23000');

                if ($attempt < $maxAttempts && ($isCounterConflict || $isDuplicate)) {
                    continue;
                }

                if ($isCounterConflict) {
                    throw new \Exception('Nomor sedang dipakai user lain.', 409);
                }
                throw $exception;
            }
        }

        Cache::tags(['quotation_data'])->flush();
        return true;
    }

    /**
     * Update an existing Quotation.
     */
    public function updateQuotation(string $noPenawaran, array $data): bool
    {
        $materials = $data['materials'] ?? [];
        if (!is_array($materials)) {
            $materials = [];
        }

        $exists = DB::table('tb_penawaran')
            ->where('No_penawaran', $noPenawaran)
            ->exists();

        if (!$exists) {
            throw new \Exception('Data quotation tidak ditemukan.', 404);
        }

        DB::transaction(function () use ($data, $materials, $noPenawaran) {
            DB::table('tb_penawaran')
                ->where('No_penawaran', $noPenawaran)
                ->update([
                    'Tgl_penawaran' => $data['tgl_penawaran'] ?? Carbon::today()->toDateString(),
                    'Customer' => $this->valueOrSpace($data['customer'] ?? null),
                    'Alamat' => $this->valueOrSpace($data['alamat'] ?? null),
                    'Telp' => $this->valueOrSpace($data['telp'] ?? null),
                    'Fax' => $this->valueOrSpace($data['fax'] ?? null),
                    'Email' => $this->valueOrSpace($data['email'] ?? null),
                    'Attend' => $this->valueOrSpace($data['attend'] ?? null),
                    'Payment' => $this->valueOrSpace($data['payment'] ?? null),
                    'Validity' => $this->valueOrSpace($data['validity'] ?? null),
                    'Delivery' => $this->valueOrSpace($data['delivery'] ?? null),
                    'Franco' => $this->valueOrSpace($data['franco'] ?? null),
                    'Note1' => $this->valueOrSpace($data['note1'] ?? null),
                    'Note2' => $this->valueOrSpace($data['note2'] ?? null),
                    'Note3' => $this->valueOrSpace($data['note3'] ?? null),
                ]);

            $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
            
            DB::table('tb_penawarandetail')
                ->whereRaw('TRIM(' . $this->wrapColumn($noPenawaranColumn) . ') = ?', [trim($noPenawaran)])
                ->delete();

            $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
            $insertData = [];
            foreach ($materials as $item) {
                $insertData[] = [
                    $noPenawaranColumn => $noPenawaran,
                    'Material' => $item['material'] ?? null,
                    'Qty' => $item['quantity'] ?? null,
                    'Harga' => $item['harga_penawaran'] ?? null,
                    $hargaModalColumn => $item['harga_modal'] ?? null,
                    'Satuan' => $item['satuan'] ?? null,
                    'Margin' => $item['margin'] ?? null,
                    'Remark' => $this->valueOrSpace($item['remark'] ?? null),
                ];
            }
            if (!empty($insertData)) {
                DB::table('tb_penawarandetail')->insert($insertData);
            }
        });

        Cache::tags(['quotation_data'])->flush();
        return true;
    }

    /**
     * Delete a Quotation.
     */
    public function deleteQuotation(string $noPenawaran): bool
    {
        $noPenawaran = trim($noPenawaran);
        if ($noPenawaran === '') {
            throw new \Exception('No penawaran tidak valid.', 400);
        }

        DB::transaction(function () use ($noPenawaran) {
            DB::table('tb_penawarandetail')
                ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                ->delete();

            DB::table('tb_penawaran')
                ->whereRaw('lower(trim(No_penawaran)) = ?', [strtolower($noPenawaran)])
                ->delete();
        });

        Cache::tags(['quotation_data'])->flush();
        return true;
    }

    /**
     * Update a single quotation detail.
     */
    public function updateQuotationDetail(string $noPenawaran, int $detailId, array $data): bool
    {
        $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
        
        $exists = DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->exists();

        if (!$exists) {
            throw new \Exception('Detail quotation tidak ditemukan.', 404);
        }

        $hargaModalColumn = $this->resolveColumn('tb_penawarandetail', ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
        
        DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->update([
                'Material' => $data['material'] ?? null,
                'Qty' => $data['quantity'] ?? null,
                'Harga' => $data['harga_penawaran'] ?? null,
                $hargaModalColumn => $data['harga_modal'] ?? null,
                'Satuan' => $data['satuan'] ?? null,
                'Margin' => $data['margin'] ?? null,
                'Remark' => $this->valueOrSpace($data['remark'] ?? null),
            ]);

        Cache::tags(['quotation_data'])->flush();
        return true;
    }

    /**
     * Delete a single quotation detail.
     */
    public function deleteQuotationDetail(string $noPenawaran, int $detailId): bool
    {
        $noPenawaranColumn = $this->resolveColumn('tb_penawarandetail', ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
        
        $deleted = DB::table('tb_penawarandetail')
            ->whereRaw('TRIM('.$this->wrapColumn($noPenawaranColumn).') = ?', [trim($noPenawaran)])
            ->where('ID', $detailId)
            ->delete();

        if (!$deleted) {
            throw new \Exception('Detail quotation tidak ditemukan.', 404);
        }

        Cache::tags(['quotation_data'])->flush();
        return true;
    }
}
