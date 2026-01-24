import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

// Ensure session cleared on browser/tab close (not on reload)
if (typeof window !== 'undefined') {
    let unloadFired = false;
    const logoutOnClose = (event) => {
        // if the page is being reloaded (same url), skip logout
        const isReload =
            event?.currentTarget?.performance?.navigation?.type ===
            PerformanceNavigation.TYPE_RELOAD;
        if (isReload) return;
        unloadFired = true;
        try {
            navigator.sendBeacon('/logout-simple');
        } catch (e) {
            // noop
        }
    };
    window.addEventListener('pagehide', logoutOnClose);
    window.addEventListener('unload', (e) => {
        if (unloadFired) return;
        logoutOnClose(e);
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
