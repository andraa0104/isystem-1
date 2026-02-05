export async function readApiError(response) {
    const status = response?.status;
    const contentType = response?.headers?.get?.('content-type') || '';

    const buildDetail = (data) => {
        if (!data || typeof data !== 'object') {
            return String(data ?? '');
        }

        const lines = [];
        if (data.status || status) lines.push(`status: ${data.status ?? status}`);
        if (data.exception) lines.push(`exception: ${data.exception}`);
        if (data.file || data.line) {
            lines.push(`location: ${data.file ?? '-'}:${data.line ?? '-'}`);
        }

        if (data.sql_state) lines.push(`sql_state: ${data.sql_state}`);
        if (data.driver_code !== undefined && data.driver_code !== null) {
            lines.push(`driver_code: ${data.driver_code}`);
        }
        if (data.driver_message) lines.push(`driver_message: ${data.driver_message}`);

        if (data.sql) lines.push(`sql: ${data.sql}`);
        if (data.bindings !== undefined) {
            try {
                lines.push(`bindings: ${JSON.stringify(data.bindings)}`);
            } catch {
                lines.push(`bindings: ${String(data.bindings)}`);
            }
        }

        if (data.trace) {
            lines.push('');
            lines.push('trace:');
            lines.push(String(data.trace));
        }

        return lines.join('\n').trim();
    };

    try {
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return {
                summary: data?.message || response.statusText || 'Request failed',
                detail: buildDetail(data),
                status,
            };
        }

        const text = await response.text();
        const clipped = String(text ?? '').slice(0, 2000);
        return {
            summary: response.statusText || 'Request failed',
            detail: clipped || undefined,
            status,
        };
    } catch (error) {
        return {
            summary: response?.statusText || 'Request failed',
            detail: error?.stack || error?.message || String(error),
            status,
        };
    }
}

export function normalizeApiError(error, fallbackSummary = 'Terjadi kesalahan.') {
    if (!error) {
        return { summary: fallbackSummary, detail: undefined, status: undefined };
    }
    if (typeof error === 'string') {
        return { summary: fallbackSummary, detail: error, status: undefined };
    }
    if (error.summary) {
        return error;
    }
    if (error instanceof Error) {
        return {
            summary: fallbackSummary,
            detail: error.stack || error.message,
            status: undefined,
        };
    }
    return {
        summary: fallbackSummary,
        detail: String(error),
        status: undefined,
    };
}

