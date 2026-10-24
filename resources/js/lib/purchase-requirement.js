export const getPrProgress = (detail) => {
    const parse = (value) => {
        const number = Number(
            String(value ?? 0)
                .replaceAll(',', '')
                .trim(),
        );
        return Number.isFinite(number) ? number : 0;
    };
    const qty = Math.max(0, parse(detail.qty));
    const rawRemaining = detail.sisa_pr;
    const remaining = Math.min(
        qty,
        Math.max(
            0,
            rawRemaining === null ||
                rawRemaining === undefined ||
                String(rawRemaining).trim() === ''
                ? qty
                : parse(rawRemaining),
        ),
    );
    const processed = qty - remaining;
    return {
        qty,
        remaining,
        processed,
        percent: qty > 0 ? Math.round((processed / qty) * 1000) / 10 : 0,
    };
};

export const readPrFilters = (storage, key) => {
    try {
        const value = JSON.parse(storage.getItem(key) || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return {};
        return {
            search:
                typeof value.search === 'string'
                    ? value.search.slice(0, 200)
                    : '',
            status: ['all', 'outstanding', 'sisa_po', 'realized'].includes(
                value.status,
            )
                ? value.status
                : 'outstanding',
            period: [
                'all',
                'today',
                'this_week',
                'this_month',
                'this_year',
                'range',
            ].includes(value.period)
                ? value.period
                : 'all',
            size: [5, 10, 25, 50, 100, 'all'].includes(value.size)
                ? value.size
                : 5,
            startDate: /^\d{4}-\d{2}-\d{2}$/.test(value.startDate)
                ? value.startDate
                : '',
            endDate: /^\d{4}-\d{2}-\d{2}$/.test(value.endDate)
                ? value.endDate
                : '',
        };
    } catch {
        return {};
    }
};

export const getPrPaginationKey = (params) => {
    const key = new URLSearchParams(params);
    ['page', 'known_total', 'fetch_type'].forEach((name) => key.delete(name));
    key.sort();
    return key.toString();
};

export const applyKnownPrTotal = (params, previousPage) => {
    const page = Math.max(1, Number(params.get('page')) || 1);
    const key = getPrPaginationKey(params);
    if (
        previousPage?.key === key &&
        previousPage.page !== page &&
        Number.isFinite(Number(previousPage.total))
    ) {
        params.set('known_total', String(Math.max(0, Number(previousPage.total))));
    }
    return key;
};
