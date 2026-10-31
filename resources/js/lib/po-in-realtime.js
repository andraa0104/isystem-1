import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { createReconnectRefreshHandler } from './purchase-order-in';

export const subscribeToPoInChanges = (channelName, onChange, eventName = 'purchase-order-in.changed') => {
    const key = import.meta.env.VITE_REVERB_APP_KEY;
    if (!key || !channelName) return () => {};

    const scheme = import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '');
    const echo = new Echo({
        broadcaster: 'reverb',
        Pusher,
        key,
        wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
        wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8081),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: { headers: { Accept: 'application/json' } },
    });

    const refreshAfterReconnect = createReconnectRefreshHandler(onChange);

    echo.private(channelName)
        .listen(`.${eventName}`, onChange)
        // Subscription pertama terjadi bersama load awal halaman, jadi tidak perlu
        // mengambil data lagi. Reconnect berikutnya tetap melakukan refresh agar
        // perubahan yang terlewat saat koneksi putus dapat dimuat kembali.
        .subscribed(refreshAfterReconnect)
        .error((error) => console.error('Marketing WebSocket subscription failed:', error));

    return () => {
        echo.leave(channelName);
        echo.disconnect();
    };
};
