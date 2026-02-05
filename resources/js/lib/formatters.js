export const formatDateId = (value) => {
    if (value === null || value === undefined || value === '') return '-';

    const raw = String(value).trim();
    if (!raw) return '-';

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const date = new Date(`${raw}T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(date);
        }
    }

    // dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy
    const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
        const [, d, m, y] = match;
        const year = String(y).length === 2 ? `20${y}` : y.padStart(4, '0');
        const iso = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(`${iso}T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(date);
        }
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

