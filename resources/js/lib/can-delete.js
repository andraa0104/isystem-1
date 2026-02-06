const isBlank = (value) =>
    value === null || value === undefined || String(value).trim() === '';

export function canDeleteRow(
    row,
    {
        journalKeys = ['jurnal', 'trx_kas', 'no_jurnal'],
        draftKeys = ['status', 'Status'],
    } = {},
) {
    if (!row) return false;

    const isDraft = draftKeys.some((key) => {
        const value = row?.[key];
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return value === 0;
        const normalized = String(value).trim().toLowerCase();
        return normalized === 'draft' || normalized === '0';
    });
    if (isDraft) return true;

    const hasJournal = journalKeys.some((key) => !isBlank(row?.[key]));
    return !hasJournal;
}

