import { useCallback, useEffect, useState } from 'react';

export function useMasterDataRows(url, parameters, { enabled = true } = {}) {
    const [result, setResult] = useState({ rows: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const query = new URLSearchParams(parameters).toString();
    const refresh = useCallback(() => setRevision((value) => value + 1), []);

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const load = async () => {
            try {
                const response = await fetch(`${url}?${query}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });
                if (!response.ok)
                    throw new Error('Gagal memuat data. Silakan coba lagi.');
                const data = await response.json();
                if (!Array.isArray(data.rows))
                    throw new Error('Respons data tidak valid.');
                if (!controller.signal.aborted) setResult(data);
            } catch (exception) {
                if (!controller.signal.aborted) {
                    setError(exception.message);
                    setResult({ rows: [], total: 0 });
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [url, query, revision, enabled]);

    return {
        rows: result.rows,
        total: Number(result.total),
        loading,
        error,
        refresh,
        revision,
    };
}
