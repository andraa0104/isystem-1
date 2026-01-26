import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

// Ensure session cleared hanya ketika tab/close, bukan reload
if (typeof window !== 'undefined') {
    let logoutSent = false;
    const isReloadNavigation = () => {
        // modern Navigation Timing Level 2
        const navEntry = performance.getEntriesByType?.('navigation')?.[0];
        if (navEntry?.type === 'reload') return true;
        // legacy NavigationTiming
        if (performance?.navigation?.type === 1) return true; // TYPE_RELOAD
        return false;
    };
    const sendLogout = () => {
        if (logoutSent) return;
        logoutSent = true;
        try {
            navigator.sendBeacon?.('/logout-simple');
        } catch (e) {
            /* noop */
        }
    };
    const handlePageHide = (event) => {
        // Skip if this is a reload navigation
        if (isReloadNavigation()) return;
        // Some browsers set persisted=true for bfcache; treat as non-close
        if (event?.persisted) return;
        sendLogout();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('unload', (event) => {
        if (isReloadNavigation()) return;
        if (event?.persisted) return;
        sendLogout();
    });
}
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./pages/${name}.jsx`, import.meta.glob('./pages/**/*.jsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<StrictMode>
                <App {...props}/>
            </StrictMode>);
    },
    progress: {
        color: '#4B5563',
    },
});
// This will set light / dark mode on load...
initializeTheme();
