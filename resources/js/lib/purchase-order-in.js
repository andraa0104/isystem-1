export const getBusinessDate = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
};

export const getPaginationRange = (pagination, fallbackPerPage = 5) => {
    const total = Math.max(0, Number(pagination.total) || 0);
    if (pagination.per_page === 'all') {
        return { from: total > 0 ? 1 : 0, to: total, total };
    }
    const page = Math.max(1, Number(pagination.page) || 1);
    const perPage = Math.max(
        1,
        Number(pagination.per_page) || Number(fallbackPerPage) || 5,
    );
    return {
        from: Math.min((page - 1) * perPage + 1, total),
        to: Math.min(page * perPage, total),
        total,
    };
};

export const createLatestRequest = () => {
    let generation = 0;
    let controller;
    const cancel = () => {
        generation += 1;
        controller?.abort();
    };
    return {
        cancel,
        start() {
            cancel();
            controller = new AbortController();
            const requestGeneration = generation;
            const { signal } = controller;
            return {
                signal,
                isCurrent: () =>
                    generation === requestGeneration && !signal.aborted,
            };
        },
    };
};

export const readPoInResponse = async (response, failureMessage) => {
    if (!response.ok) throw new Error(failureMessage);
    try {
        const data = await response.json();
        if (!data || typeof data !== 'object') throw new Error(failureMessage);
        return data;
    } catch {
        throw new Error(failureMessage);
    }
};
