import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Swal from 'sweetalert2';
import '../css/app.css';
import { initializeTheme } from './hooks/use-appearance';

const accessDeniedText = 'Akses delete tidak diizinkan untuk menu ini.';

const menuByPathPrefix = [
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

const getCurrentUser = () => {
    const page = document.getElementById('app')?.dataset?.page;
    if (!page) {
        return null;
    }

    try {
        return JSON.parse(page)?.props?.auth?.user ?? null;
    } catch {
        return null;
    }
};

const getPathname = (url) => {
    try {
        return new URL(String(url), window.location.origin).pathname;
    } catch {
        return String(url).split('?')[0];
    }
};

const userCannotDelete = (url) => {
    const user = getCurrentUser();
    if (!user?.has_privileges) {
        return false;
    }

    const level = String(user.level ?? '').toLowerCase();
    if (level === 'admin') {
        return false;
    }

    const path = getPathname(url);
    const menuKey = menuByPathPrefix.find(([prefix]) =>
        path.startsWith(prefix),
    )?.[1];

    if (!menuKey) {
        return false;
    }

    return user.menu_access?.[menuKey]?.delete !== true;
};

const getAccessDeniedMessage = (value) => {
    const message =
        typeof value === 'string'
            ? value
            : (value?.message ??
              value?.error ??
              value?.props?.flash?.error ??
              '');

    return String(message)
        .toLowerCase()
        .includes('akses delete tidak diizinkan')
        ? message
        : '';
};

const showAccessDeniedToast = (message = accessDeniedText) => {
    Swal.close();
    window.dispatchEvent(
        new CustomEvent('app:toast', {
            detail: { message, variant: 'error' },
        }),
    );
};

const originalDelete = router.delete.bind(router);
router.delete = (url, options = {}) => {
    if (userCannotDelete(url)) {
        options.onStart?.();
        options.onError?.({ message: accessDeniedText });
        options.onFinish?.();
        window.setTimeout(() => showAccessDeniedToast(accessDeniedText), 0);
        return;
    }

    return originalDelete(url, {
        ...options,
        onSuccess: (page) => {
            const message = getAccessDeniedMessage(page);
            if (message) {
                options.onError?.({ message });
                window.setTimeout(() => showAccessDeniedToast(message), 0);
                return;
            }

            options.onSuccess?.(page);
        },
        onError: (errors) => {
            const message =
                getAccessDeniedMessage(errors) ||
                Object.values(errors ?? {})
                    .map((value) => getAccessDeniedMessage(value))
                    .find(Boolean);

            options.onError?.(errors);

            if (message) {
                window.setTimeout(() => showAccessDeniedToast(message), 0);
            }
        },
        onException: (exception) => {
            const message = getAccessDeniedMessage(exception);
            if (message) {
                options.onError?.({ message });
                window.setTimeout(() => showAccessDeniedToast(message), 0);
                return false;
            }

            return options.onException?.(exception);
        },
    });
};

// Catatan:
// Jangan auto-logout via event unload/pagehide.
// Browser sering memicu event ini saat refresh / pindah halaman sehingga user bisa ter-logout sendiri.
if (typeof window !== 'undefined') {
    const sendHeartbeat = () => {
        try {
            fetch('/heartbeat-simple', {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                keepalive: true,
            }).catch(() => {});
        } catch {
            /* noop */
        }
    };

    sendHeartbeat();
    window.setInterval(sendHeartbeat, 30_000);
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) sendHeartbeat();
    });
}
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.jsx`,
            import.meta.glob('./pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
// This will set light / dark mode on load...
initializeTheme();
