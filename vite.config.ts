// import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
    const enableWayfinder = false;
    const hmrHost = process.env.VITE_HMR_HOST || '192.168.1.250';
    // process.env.WAYFINDER_DISABLE !== '1' &&
    // process.env.WAYFINDER_DISABLE !== 'true';

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.jsx'],
                ssr: 'resources/js/ssr.jsx',
                refresh: true,
            }),
            react(),
            tailwindcss(),
            ...(enableWayfinder
                ? [
                      // wayfinder({
                      //    formVariants: true,
                      // }),
                  ]
                : []),
        ],
        esbuild: {
            jsx: 'automatic' as const,
        },
        build: {
            // Chrome/Edge 109 are the last Chromium releases for Windows 7/8.
            target: ['chrome109', 'edge109', 'firefox115', 'safari15.4'],
            cssTarget: ['chrome109', 'firefox115', 'safari15.4'],
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './resources/js'),
            },
        },
        server: {
            host: '0.0.0.0',
            cors: true,
            hmr: {
                host: hmrHost,
            },
            watch: {
                usePolling: true,
            },
        },
    };
});
