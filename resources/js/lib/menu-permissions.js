export const menuByPathPrefix = [
    ['/laporan/audit-rekonsiliasi', 'Laporan:Audit & Rekonsiliasi'],
    ['/laporan/jurnal-umum', 'Laporan:Jurnal Umum'],
    ['/laporan/jurnal-penyesuaian', 'Laporan:Jurnal Penyesuaian'],
    ['/laporan/buku-besar', 'Laporan:Buku Besar'],
    ['/laporan/buku-kas', 'Laporan:Buku Kas'],
    ['/laporan/saldo-akun', 'Laporan:Saldo Akun (NABB)'],
    ['/laporan/neraca-saldo', 'Laporan:Neraca Saldo'],
    ['/laporan/neraca-lajur', 'Laporan:Neraca Lajur'],
    ['/laporan/neraca-akhir', 'Laporan:Neraca Akhir'],
    ['/laporan/rugi-laba', 'Laporan:Rugi Laba'],
    ['/laporan/perubahan-modal', 'Laporan:Perubahan Modal'],
    ['/master-data/material', 'Master Data:Material'],
    ['/master-data/vendor', 'Master Data:Vendor'],
    ['/master-data/customer', 'Master Data:Customer'],
    ['/marketing/quotation', 'Marketing:Quotation'],
    ['/marketing/purchase-order-in', 'Marketing:Purchase Order In (PO In)'],
    ['/marketing/purchase-requirement', 'Marketing:Purchase Requirement (PR)'],
    ['/marketing/delivery-order-add', 'Marketing:Delivery Order Add (DOA)'],
    ['/marketing/delivery-order', 'Marketing:Delivery Order (DO)'],
    ['/marketing/performance', 'Marketing:Performance'],
    ['/pembelian/delivery-order-cost', 'Pembelian:Delivery Order Cost (APB)'],
    ['/pembelian/purchase-order', 'Pembelian:Purchase Order'],
    ['/pembelian/invoice-masuk', 'Pembelian:Invoice Masuk'],
    [
        '/pembayaran/permintaan-dana-operasional',
        'Pembayaran:Permintaan Dana Operasional',
    ],
    ['/pembayaran/permintaan-dana-biaya', 'Pembayaran:Permintaan Dana Biaya'],
    ['/pembayaran/biaya-kirim-pembelian', 'Pembayaran:Biaya Kirim Pembelian'],
    ['/pembayaran/biaya-kirim-penjualan', 'Pembayaran:Biaya Kirim Penjualan'],
    ['/pembayaran/payment-cost', 'Pembayaran:Payment Cost'],
    ['/inventory/data-material', 'Inventory:Data Material'],
    ['/inventory/penerimaan-material', 'Inventory:Penerimaan Material'],
    ['/inventory/transfer-material', 'Inventory:Transfer Material'],
    ['/penjualan/faktur-penjualan/kwitansi', 'Penjualan:Kwitansi'],
    ['/penjualan/faktur-penjualan', 'Penjualan:Faktur Penjualan'],
    ['/penjualan/review-tagihan', 'Penjualan:Review Tagihan'],
    ['/penjualan/tanda-terima-invoice', 'Penjualan:Tanda Terima Invoice'],
    ['/keuangan/mutasi-kas', 'Keuangan:Mutasi Kas'],
    ['/keuangan/input-pembelian', 'Keuangan:Input Pembelian'],
    ['/keuangan/input-penjualan', 'Keuangan:Input Penjualan'],
    ['/keuangan/penyesuaian', 'Keuangan:Penyesuaian'],
    ['/keuangan/jurnal-lainnya', 'Keuangan:Jurnal Lainnya'],
];

const actions = new Set(['view', 'create', 'update', 'delete']);

export function menuKeyForPath(url) {
    let pathname;
    try {
        pathname = new URL(String(url), 'http://localhost').pathname;
    } catch {
        return null;
    }
    return (
        menuByPathPrefix.find(
            ([prefix]) =>
                pathname === prefix || pathname.startsWith(prefix + '/'),
        )?.[1] ?? null
    );
}

export function canAccessMenuAction(user, menuKey, action) {
    if (!user || !menuKey || !actions.has(action)) return false;
    if (
        String(user.level ?? '')
            .trim()
            .toLowerCase() === 'admin'
    )
        return true;
    const permission = user.menu_access?.[menuKey];
    if (typeof permission === 'boolean') return action === 'view' && permission;
    return permission?.[action] === true;
}
