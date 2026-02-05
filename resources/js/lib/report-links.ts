type BukuBesarUrlParams = {
    kodeAkun: string;
    periodType?: 'month' | 'year' | string;
    period?: string;
    source?: 'all' | 'trx' | 'ajp' | string;
    pageSize?: number | 'all' | string;
};

export function buildBukuBesarUrl({
    kodeAkun,
    periodType,
    period,
    source = 'all',
    pageSize = 50,
}: BukuBesarUrlParams): string {
    const params = new URLSearchParams();
    const kode = String(kodeAkun ?? '').trim();

    if (periodType && period) {
        params.set('periodType', String(periodType));
        params.set('period', String(period));
    }

    params.set('account', kode);
    params.set('source', String(source));
    params.set('search', '');
    params.set('pageSize', String(pageSize));

    return `/laporan/buku-besar?${params.toString()}`;
}

