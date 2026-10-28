import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

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

    echo.private(channelName)
        .listen(`.${eventName}`, onChange)
        // Re-fetch after reconnect to include writes missed while disconnected.
        .subscribed(onChange)
        .error((error) => console.error('Marketing WebSocket subscription failed:', error));

    return () => {
        echo.leave(channelName);
        echo.disconnect();
    };
};
