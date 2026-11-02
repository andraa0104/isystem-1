<?php

namespace App\Services\Marketing;

use Illuminate\Database\Connection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class QuotationService
{
    private const BATCH_SIZE = 100;

    private const HEADER_FIELDS = [
        'Customer' => 'customer', 'Alamat' => 'alamat', 'Telp' => 'telp',
        'Fax' => 'fax', 'Email' => 'email', 'Attend' => 'attend',
        'Payment' => 'payment', 'Validity' => 'validity', 'Delivery' => 'delivery',
        'Franco' => 'franco', 'Note1' => 'note1', 'Note2' => 'note2', 'Note3' => 'note3',
    ];

    /** @var \WeakMap<Connection, array<string, array<string, string>>> */
    private \WeakMap $columnCache;

    public function __construct()
    {
        $this->columnCache = new \WeakMap;
    }

    private function resolveColumn(Connection $connection, array $candidates, string $fallback): string
    {
        // Cache by connection and database without retaining purged tenant connections.
        $databases = $this->columnCache[$connection] ?? [];
        $database = $connection->getDatabaseName();
        if (! isset($databases[$database])) {
            $columns = $connection->getSchemaBuilder()->getColumnListing('tb_penawarandetail');
            $databases[$database] = array_change_key_case(array_combine($columns, $columns), CASE_LOWER);
            $this->columnCache[$connection] = $databases;
        }

        foreach ($candidates as $candidate) {
            if (isset($databases[$database][strtolower($candidate)])) {
                return $databases[$database][strtolower($candidate)];
            }
        }

        return $fallback;
    }

    private function detailNumberColumn(Connection $connection): string
    {
        return $this->resolveColumn($connection, ['No_Penawaran', 'No_penawaran', 'no_penawaran'], 'No_penawaran');
    }

    private function valueOrSpace(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? ' ' : $text;
    }

    /** Preserve compatibility with legacy database character sets. */
    private function sanitizeText(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        return str_replace(
            ["\u{201C}", "\u{201D}", "\u{2033}", "\u{2018}", "\u{2019}", "\u{2032}", 'â€', 'â€œ', 'â€³', 'â€˜', 'â€™', 'â€²'],
            ['"', '"', '"', "'", "'", "'", '"', '"', '"', "'", "'", "'"],
            $text,
        );
    }

    private function headerData(array $data): array
    {
        $header = ['Tgl_penawaran' => $data['tgl_penawaran'] ?? Carbon::today()->toDateString()];
        foreach (self::HEADER_FIELDS as $column => $field) {
            $header[$column] = $this->sanitizeText($this->valueOrSpace($data[$field] ?? null));
        }

        return $header;
    }

    private function detailData(array $item, string $costColumn, bool $normalizeMargin = false): array
    {
        $margin = $item['margin'] ?? null;
        if ($normalizeMargin && $margin !== null) {
            $margin = (string) $margin;
            if (trim($margin) !== '' && ! str_contains($margin, '%')) {
                $margin = trim($margin).'%';
            }
        }

        return [
            'Material' => $this->sanitizeText($item['material'] ?? null),
            'Qty' => $item['quantity'] ?? null,
            'Harga' => $item['harga_penawaran'] ?? null,
            $costColumn => $item['harga_modal'] ?? null,
            'Satuan' => $item['satuan'] ?? null,
            'Margin' => $margin,
            'Remark' => $this->sanitizeText($this->valueOrSpace($item['remark'] ?? null)),
        ];
    }

    private function insertDetails(Connection $connection, string $number, array $data, bool $normalizeMargin = false): void
    {
        $materials = $data['materials'] ?? [];
        if (! is_array($materials) || $materials === []) {
            return;
        }

        $numberColumn = $this->detailNumberColumn($connection);
        $costColumn = $this->resolveColumn($connection, ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');

        // Nine bindings per row; bounded batches also work with SQLite's older 999-binding limit.
        foreach (array_chunk($materials, self::BATCH_SIZE) as $batch) {
            $rows = [];
            foreach ($batch as $item) {
                $rows[] = [$numberColumn => $number] + $this->detailData($item, $costColumn, $normalizeMargin);
            }
            $connection->table('tb_penawarandetail')->insert($rows);
        }
    }

    /** Find the first unused number with one read per batch, rather than per collision. */
    private function availableNumber(Connection $connection, string $prefix, int $start): int
    {
        while (true) {
            $candidates = [];
            for ($offset = 0; $offset < self::BATCH_SIZE; $offset++) {
                $number = $start + $offset;
                $candidates[$number] = $prefix.str_pad((string) $number, 7, '0', STR_PAD_LEFT);
            }

            $occupied = $connection->table('tb_penawaran')
                ->whereIn('No_penawaran', array_values($candidates))
                ->lockForUpdate()
                ->pluck('No_penawaran')
                ->mapWithKeys(fn ($value) => [strtoupper(trim($value)) => true])
                ->all();

            foreach ($candidates as $number => $candidate) {
                if (! isset($occupied[strtoupper($candidate)])) {
                    return $number;
                }
            }

            $start += self::BATCH_SIZE;
        }
    }

    public function createQuotation(array $data, string $prefix, int $maxAttempts = 10): bool
    {
        $connection = DB::connection();
        $header = $this->headerData($data);
        $maxAttempts = max(1, $maxAttempts);

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $connection->transaction(function () use ($connection, $data, $header, $prefix) {
                    $counter = $connection->table('tb_counter')->where('nama_tabel', 'tb_penawaran')
                        ->lockForUpdate()->first(['nomor_terakhir']);
                    if (! $counter) {
                        throw new RuntimeException('Data counter tb_penawaran tidak ditemukan.');
                    }

                    $oldNumber = (int) $counter->nomor_terakhir;
                    $newNumber = $this->availableNumber($connection, $prefix, $oldNumber + 1);
                    $updated = $connection->table('tb_counter')->where('nama_tabel', 'tb_penawaran')
                        ->where('nomor_terakhir', $oldNumber)->update(['nomor_terakhir' => $newNumber]);
                    if ($updated === 0) {
                        throw new RuntimeException('counter_tb_penawaran_dipakai');
                    }

                    $number = $prefix.str_pad((string) $newNumber, 7, '0', STR_PAD_LEFT);
                    $connection->table('tb_penawaran')->insert([
                        'No_penawaran' => $number,
                        'Tgl_Posting' => Carbon::today()->toDateString(),
                    ] + $header);
                    $this->insertDetails($connection, $number, $data, normalizeMargin: true);
                }, attempts: 3);

                return true;
            } catch (\Throwable $exception) {
                $counterConflict = $exception instanceof RuntimeException
                    && $exception->getMessage() === 'counter_tb_penawaran_dipakai';
                // Retry duplicate keys only, not every SQLSTATE 23000 (e.g. foreign-key failures).
                $duplicate = $exception instanceof UniqueConstraintViolationException
                    && str_starts_with(
                        $exception->getSql(),
                        'insert into '.$connection->getQueryGrammar()->wrapTable('tb_penawaran').' ',
                    );
                if ($attempt < $maxAttempts && ($counterConflict || $duplicate)) {
                    continue;
                }
                if ($counterConflict) {
                    throw new RuntimeException('Nomor sedang dipakai user lain.', 409, $exception);
                }
                throw $exception;
            }
        }

        return false;
    }

    public function updateQuotation(string $noPenawaran, array $data): bool
    {
        $connection = DB::connection();
        $noPenawaran = trim($noPenawaran);
        $header = $this->headerData($data);

        $connection->transaction(function () use ($connection, $noPenawaran, $data, $header) {
            // Lock before replacing details so two saves cannot interleave their delete/insert operations.
            $quotation = $connection->table('tb_penawaran')->where('No_penawaran', $noPenawaran)
                ->lockForUpdate()->first(['No_penawaran']);
            if (! $quotation) {
                throw new RuntimeException('Data quotation tidak ditemukan.', 404);
            }

            $connection->table('tb_penawaran')->where('No_penawaran', $noPenawaran)->update($header);
            $connection->table('tb_penawarandetail')->where($this->detailNumberColumn($connection), $noPenawaran)->delete();
            $this->insertDetails($connection, $noPenawaran, $data);
        }, attempts: 3);

        return true;
    }

    public function deleteQuotation(string $noPenawaran): bool
    {
        $noPenawaran = trim($noPenawaran);
        if ($noPenawaran === '') {
            throw new RuntimeException('No penawaran tidak valid.', 400);
        }

        $connection = DB::connection();
        $connection->transaction(function () use ($connection, $noPenawaran) {
            $connection->table('tb_penawaran')->where('No_penawaran', $noPenawaran)->lockForUpdate()->first(['No_penawaran']);
            $connection->table('tb_penawarandetail')->where($this->detailNumberColumn($connection), $noPenawaran)->delete();
            $connection->table('tb_penawaran')->where('No_penawaran', $noPenawaran)->delete();
        }, attempts: 3);

        return true;
    }

    public function updateQuotationDetail(string $noPenawaran, int $detailId, array $data): bool
    {
        $connection = DB::connection();
        $costColumn = $this->resolveColumn($connection, ['Harga_Modal', 'Harga_modal', 'harga_modal'], 'Harga_Modal');
        $query = $connection->table('tb_penawarandetail')
            ->where($this->detailNumberColumn($connection), trim($noPenawaran))->where('ID', $detailId);
        $updated = (clone $query)->update($this->detailData($data, $costColumn));
        // MySQL may report zero changed rows for an identical payload. It is still a successful save.
        if ($updated === 0 && ! $query->exists()) {
            throw new RuntimeException('Detail quotation tidak ditemukan.', 404);
        }

        return true;
    }

    public function deleteQuotationDetail(string $noPenawaran, int $detailId): bool
    {
        $connection = DB::connection();
        $deleted = $connection->table('tb_penawarandetail')
            ->where($this->detailNumberColumn($connection), trim($noPenawaran))->where('ID', $detailId)->delete();
        if ($deleted === 0) {
            throw new RuntimeException('Detail quotation tidak ditemukan.', 404);
        }

        return true;
    }
}
