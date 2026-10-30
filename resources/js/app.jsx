import { canAccessMenuAction, menuKeyForPath } from './lib/menu-permissions';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Swal from 'sweetalert2';
import '../css/app.css';
import { initializeTheme } from './hooks/use-appearance';

const accessDeniedText = 'Akses delete tidak diizinkan untuk menu ini.';

let currentUser;
router.on('navigate', (event) => {
    currentUser = event.detail.page.props.auth?.user ?? null;
});

const getCurrentUser = () => {
    if (currentUser !== undefined) return currentUser;
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
    const menuKey = menuKeyForPath(getPathname(url));
    return menuKey !== null && !canAccessMenuAction(getCurrentUser(), menuKey, 'delete');
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
