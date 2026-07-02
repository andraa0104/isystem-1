<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class EnsureMenuPrivilege
{
    private const ROUTE_MENU_KEYS = [
        'dashboard.' => 'main:Dashboard',
        'laporan.audit-rekonsiliasi.' => 'Laporan:Audit & Rekonsiliasi',
        'laporan.jurnal-umum.' => 'Laporan:Jurnal Umum',
        'laporan.jurnal-penyesuaian.' => 'Laporan:Jurnal Penyesuaian',
        'laporan.buku-besar.' => 'Laporan:Buku Besar',
        'laporan.buku-kas.' => 'Laporan:Buku Kas',
        'laporan.saldo-akun.' => 'Laporan:Saldo Akun (NABB)',
        'laporan.neraca-saldo.' => 'Laporan:Neraca Saldo',
        'laporan.neraca-lajur.' => 'Laporan:Neraca Lajur',
        'laporan.neraca-akhir.' => 'Laporan:Neraca Akhir',
        'laporan.rugi-laba.' => 'Laporan:Rugi Laba',
        'laporan.perubahan-modal.' => 'Laporan:Perubahan Modal',
        'master-data.material.' => 'Master Data:Material',
        'master-data.vendor.' => 'Master Data:Vendor',
        'master-data.customer.' => 'Master Data:Customer',
        'marketing.quotation.' => 'Marketing:Quotation',
        'marketing.purchase-order-in.' => 'Marketing:Purchase Order In (PO In)',
        'marketing.purchase-requirement.' => 'Marketing:Purchase Requirement (PR)',
        'marketing.delivery-order-add.' => 'Marketing:Delivery Order Add (DOA)',
        'marketing.delivery-order.' => 'Marketing:Delivery Order (DO)',
        'pembelian.delivery-order-cost.' => 'Pembelian:Delivery Order Cost (APB)',
        'pembelian.purchase-order.' => 'Pembelian:Purchase Order',
        'pembelian.invoice-masuk.' => 'Pembelian:Invoice Masuk',
        'pembayaran.permintaan-dana-operasional.' => 'Pembayaran:Permintaan Dana Operasional',
        'pembayaran.permintaan-dana-biaya.' => 'Pembayaran:Permintaan Dana Biaya',
        'pembayaran.biaya-kirim-pembelian.' => 'Pembayaran:Biaya Kirim Pembelian',
        'pembayaran.biaya-kirim-penjualan.' => 'Pembayaran:Biaya Kirim Penjualan',
        'pembayaran.payment-cost.' => 'Pembayaran:Payment Cost',
        'inventory.data-material.' => 'Inventory:Data Material',
        'inventory.penerimaan-material.' => 'Inventory:Penerimaan Material',
        'inventory.transfer-material.' => 'Inventory:Transfer Material',
        'penjualan.faktur-penjualan.kwitansi.' => 'Penjualan:Kwitansi',
        'penjualan.faktur-penjualan.' => 'Penjualan:Faktur Penjualan',
        'penjualan.review-tagihan.' => 'Penjualan:Review Tagihan',
        'penjualan.tanda-terima-invoice.' => 'Penjualan:Tanda Terima Invoice',
        'keuangan.mutasi-kas.' => 'Keuangan:Mutasi Kas',
        'keuangan.input-pembelian.' => 'Keuangan:Input Pembelian',
        'keuangan.input-penjualan.' => 'Keuangan:Input Penjualan',
        'keuangan.penyesuaian.' => 'Keuangan:Penyesuaian',
        'keuangan.jurnal-lainnya.' => 'Keuangan:Jurnal Lainnya',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $routeName = (string) ($request->route()?->getName() ?? '');
        $menuKey = $this->menuKeyForRoute($routeName);

        if ($menuKey === null) {
            return $next($request);
        }

        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        $level = $user->tingkat
            ?? $user->level
            ?? $user->Level
            ?? $user->lvl_user
            ?? $user->level_user
            ?? null;

        if (is_string($level) && strtolower($level) === 'admin') {
            return $next($request);
        }

        $action = $this->actionForRoute($request, $routeName);
        $permission = $this->permissionForUser($request, $user->kd_user ?? null, $menuKey);

        if (($permission[$action] ?? false) === true) {
            return $next($request);
        }

        return $this->deny($request, $action);
    }

    private function menuKeyForRoute(string $routeName): ?string
    {
        if ($routeName === 'dashboard') {
            return 'main:Dashboard';
        }

        foreach (self::ROUTE_MENU_KEYS as $prefix => $menuKey) {
            if (str_starts_with($routeName, $prefix)) {
                return $menuKey;
            }
        }

        return null;
    }

    private function actionForRoute(Request $request, string $routeName): string
    {
        $lastSegment = str($routeName)->afterLast('.')->toString();

        if ($request->isMethod('delete')
            || str_contains($routeName, '.destroy')
            || str_contains($routeName, '.delete')
            || str_contains($routeName, '.delete-item')) {
            return 'delete';
        }

        if ($lastSegment === 'edit'
            || str_contains($routeName, '.update')
            || str_contains($routeName, '.receive.store')
            || str_contains($routeName, '.upload-')) {
            return 'update';
        }

        if ($lastSegment === 'create'
            || str_contains($routeName, '.store')
            || str_contains($routeName, '.add-')
            || str_contains($routeName, '.transfer')
            || $request->isMethod('post')
            || $request->isMethod('put')
            || $request->isMethod('patch')) {
            return 'create';
        }

        return 'view';
    }

    private function permissionForUser(Request $request, ?string $kdUser, string $menuKey): array
    {
        if (! $kdUser || ! Storage::disk('local')->exists('privileges.json')) {
            return $this->emptyPermission();
        }

        $decoded = json_decode(Storage::disk('local')->get('privileges.json'), true);
        if (! is_array($decoded)) {
            return $this->emptyPermission();
        }

        $database = $request->session()->get('tenant.database')
            ?? $request->cookie('tenant_database');
        $permission = $decoded['databases'][$database]['users'][$kdUser]['menus'][$menuKey] ?? null;
        if (! is_array($permission)) {
            return [
                'view' => (bool) $permission,
                'create' => false,
                'update' => false,
                'delete' => false,
            ];
        }

        return [
            'view' => (bool) ($permission['view'] ?? false),
            'create' => (bool) ($permission['create'] ?? false),
            'update' => (bool) ($permission['update'] ?? false),
            'delete' => (bool) ($permission['delete'] ?? false),
        ];
    }

    private function emptyPermission(): array
    {
        return [
            'view' => false,
            'create' => false,
            'update' => false,
            'delete' => false,
        ];
    }

    private function deny(Request $request, string $action): Response
    {
        $message = "Akses {$action} tidak diizinkan untuk menu ini.";

        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 403);
        }

        return redirect()
            ->back()
            ->with('error', $message);
    }
}
