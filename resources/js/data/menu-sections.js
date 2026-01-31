import {
    Banknote,
    BookOpen,
    FileText,
    LayoutGrid,
    Package,
    ShoppingBagIcon,
    Truck,
    WeightIcon,
    BookText,
    Folder,
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
            { title: 'Permintaan Dana Operaisonal', href: '#' },
            { title: 'Permintaan Dana Biaya', href: '#' },
            { title: 'Biaya Kirim Pembelian', href: '/pembelian/biaya-kirim-pembelian' },
            { title: 'Biaya Kirim Penjualan', href: '/pembelian/biaya-kirim-penjualan' },
            { title: 'Payment Cost', href: '#' },
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
            { title: 'Mutasi Kas', href: '#' },
            { title: 'Input Pembelian', href: '#' },
            { title: 'Input Penjualan', href: '#' },
            { title: 'Penyesuaian', href: '#' },
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
            { title: 'Jurnal Umum', href: '#' },
            { title: 'Jurnal Penyesuaian', href: '#' },
            { title: 'Buku Besar', href: '#' },
            { title: 'Buku Kas', href: '#' },
            { title: 'Neraca Saldo', href: '#' },
            { title: 'Neraca Lajur', href: '#' },
            { title: 'Neraca Akhir', href: '#' },
            { title: 'Rugi Laba', href: '#' },
            { title: 'Perubahan Modal', href: '#' },
        ],
    },
];

export const footerNavItems = [];

export const getMainItemKey = (title) => `main:${title}`;

export const getSectionItemKey = (sectionTitle, itemTitle) =>
    `${sectionTitle}:${itemTitle}`;
