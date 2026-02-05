import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TTL_MS = 120_000;
const STORAGE_PREFIX = 'dashcache:';
const memoryCache = new Map();

const readFromSessionStorage = (key) => {
    try {
        if (typeof sessionStorage === 'undefined') return null;
        const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const writeToSessionStorage = (key, payload) => {
    try {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(payload));
    } catch {
        // ignore quota / private mode errors
    }
};

const getCachedValue = (key, ttlMs) => {
    const now = Date.now();
    const inMemory = memoryCache.get(key);
    if (inMemory && now - inMemory.ts < ttlMs) return inMemory.data;

    const fromStorage = readFromSessionStorage(key);
    if (fromStorage && now - fromStorage.ts < ttlMs) {
        memoryCache.set(key, fromStorage);
        return fromStorage.data;
    }
    return null;
};

const setCachedValue = (key, data) => {
    const payload = { ts: Date.now(), data };
    memoryCache.set(key, payload);
    writeToSessionStorage(key, payload);
};

const toErrorMessage = (error) => {
    if (!error) return 'Terjadi kesalahan.';
    const message =
        error?.response?.data?.message ||
        error?.message ||
        'Terjadi kesalahan.';
    return String(message);
};

export default function useCachedRequest({
    key,
    fetcher,
    enabled = false,
    ttlMs = DEFAULT_TTL_MS,
    initialData = null,
}) {
    const resolvedTtl = ttlMs ?? DEFAULT_TTL_MS;
    const initialCached = useMemo(
        () => getCachedValue(key, resolvedTtl),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key],
    );

    const [status, setStatus] = useState(() => {
        if (initialCached !== null) return 'success';
        if (initialData !== null && initialData !== undefined) return 'success';
        return 'idle';
    });
    const [data, setData] = useState(() => {
        if (initialCached !== null) return initialCached;
        if (initialData !== null && initialData !== undefined) return initialData;
        return null;
    });
    const [error, setError] = useState(null);

    const activeRequestId = useRef(0);

    useEffect(() => {
        const cached = getCachedValue(key, resolvedTtl);
        if (cached !== null) {
            setStatus('success');
            setData(cached);
            setError(null);
            return;
        }

        if (initialData !== null && initialData !== undefined) {
            setStatus('success');
            setData(initialData);
            setError(null);
            return;
        }

        setStatus('idle');
        setData(null);
        setError(null);
    }, [key, resolvedTtl, initialData]);

    const load = useCallback(
        async (force = false) => {
            const requestId = ++activeRequestId.current;

            if (!force) {
                const cached = getCachedValue(key, resolvedTtl);
                if (cached !== null) {
                    setStatus('success');
                    setData(cached);
                    setError(null);
                    return cached;
                }
            }

            setStatus('loading');
            setError(null);

            try {
                const result = await fetcher();
                if (activeRequestId.current !== requestId) return null;
                setCachedValue(key, result);
                setData(result);
                setStatus('success');
                return result;
            } catch (err) {
                if (activeRequestId.current !== requestId) return null;
                setStatus('error');
                setError(toErrorMessage(err));
                return null;
            }
        },
        [fetcher, key, resolvedTtl],
    );

    const retry = useCallback(() => load(true), [load]);
    const refresh = useCallback((force = false) => load(force), [load]);

    useEffect(() => {
        if (!enabled) return;
        if (status === 'idle') load(false);
    }, [enabled, status, load]);

    return { status, data, error, load, retry, refresh };
}
