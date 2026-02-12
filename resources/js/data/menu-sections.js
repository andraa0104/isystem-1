import {
    Banknote,
    FileText,
    LayoutGrid,
    Package,
    ShoppingBagIcon,
    Truck,
    WeightIcon,
    BookText,
} from 'lucide-react';

export const mainMenuItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
    },
];

export const menuSections = [
    {
        title: 'Marketing',
        icon: WeightIcon,
        items: [
            { title: 'Quotation', href: '/marketing/quotation' },
            {
                title: 'Purchase Requirement (PR)',
                href: '/marketing/purchase-requirement',
            },
            { title: 'Delivery Order (DO)', href: '/marketing/delivery-order' },
            {
                title: 'Delivery Order Add (DOA)',
                href: '/marketing/delivery-order-add',
            },
        ],
    },
    {
        title: 'Pembelian',
        icon: ShoppingBagIcon,
        items: [
            {
                title: 'Delivery Order Cost (APB)',
                href: '/pembelian/delivery-order-cost',
            },
            { title: 'Purchase Order', href: '/pembelian/purchase-order' },
            { title: 'Invoice Masuk', href: '/pembelian/invoice-masuk' },
        ],
    },
    {
        title: 'Pembayaran',
        icon: Banknote,
        items: [
            {
                title: 'Permintaan Dana Operasional',
                href: '/pembayaran/permintaan-dana-operasional',
            },
            {
                title: 'Permintaan Dana Biaya',
                href: '/pembayaran/permintaan-dana-biaya',
            },
            {
                title: 'Biaya Kirim Pembelian',
                href: '/pembayaran/biaya-kirim-pembelian',
            },
            {
                title: 'Biaya Kirim Penjualan',
                href: '/pembayaran/biaya-kirim-penjualan',
            },
            { title: 'Payment Cost', href: '/pembayaran/payment-cost' },
        ],
    },
    {
        title: 'Inventory',
        icon: Package,
        items: [
            { title: 'Data Material', href: '/inventory/data-material' },
            { title: 'Penerimaan Material', href: '/inventory/penerimaan-material' },
            { title: 'Transfer Material', href: '/inventory/transfer-material' },
        ],
    },
    {
        title: 'Penjualan',
        icon: Truck,
        items: [
            { title: 'Faktur Penjualan', href: '/penjualan/faktur-penjualan' },
            { title: 'Kwitansi', href: '/penjualan/faktur-penjualan/kwitansi' },
            { title: 'Tanda Terima Invoice', href: '/penjualan/tanda-terima-invoice' },
        ],
    },
    {
        title: 'Keuangan',
        icon: Banknote,
        items: [
            { title: 'Mutasi Kas', href: '/keuangan/mutasi-kas' },
            { title: 'Input Pembelian', href: '/keuangan/input-pembelian' },
            { title: 'Input Penjualan', href: '/keuangan/input-penjualan' },
            { title: 'Penyesuaian', href: '/keuangan/penyesuaian' },
            { title: 'Jurnal Lainnya', href: '#' },
        ],
    },
    {
        title: 'Master Data',
        icon: BookText,
        items: [
            { title: 'Vendor', href: '/master-data/vendor' },
            { title: 'Customer', href: '/master-data/customer' },
            { title: 'Material', href: '/master-data/material' },
        ],
    },
    {
        title: 'Laporan',
        icon: FileText,
        items: [
            { title: 'Audit & Rekonsiliasi', href: '/laporan/audit-rekonsiliasi' },
            { title: 'Jurnal Umum', href: '/laporan/jurnal-umum' },
            { title: 'Jurnal Penyesuaian', href: '/laporan/jurnal-penyesuaian' },
            { title: 'Buku Besar', href: '/laporan/buku-besar' },
            { title: 'Buku Kas', href: '/laporan/buku-kas' },
            { title: 'Saldo Akun (NABB)', href: '/laporan/saldo-akun' },
            { title: 'Neraca Saldo', href: '/laporan/neraca-saldo' },
            { title: 'Neraca Lajur', href: '/laporan/neraca-lajur' },
            { title: 'Neraca Akhir', href: '/laporan/neraca-akhir' },
            { title: 'Rugi Laba', href: '/laporan/rugi-laba' },
            { title: 'Perubahan Modal', href: '/laporan/perubahan-modal' },
        ],
    },
];

export const footerNavItems = [];

export const getMainItemKey = (title) => `main:${title}`;

export const getSectionItemKey = (sectionTitle, itemTitle) =>
    `${sectionTitle}:${itemTitle}`;
