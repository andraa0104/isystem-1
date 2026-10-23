import { Button } from '@/components/ui/button';
import { createLatestRequest, readPoInResponse } from '@/lib/purchase-order-in';
import { useEffect, useRef, useState } from 'react';

function useOrderPage(noPr, noPo, enabled) {
    const [page, setPage] = useState(1);
    const [revision, setRevision] = useState(0);
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const request = useRef(createLatestRequest());

    useEffect(() => {
        request.current.cancel();
        if (!enabled) return;
        const { signal, isCurrent } = request.current.start();
        setLoading(true);
        setError('');
        setRows([]);
        const params = new URLSearchParams({ no_pr: noPr, page: String(page) });
        if (noPo) params.set('no_po', noPo);
        const load = async () => {
            try {
                const response = await fetch(
                    `/marketing/purchase-requirement/related-orders?${params}`,
                    {
                        signal,
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                    },
                );
                const data = await readPoInResponse(
                    response,
                    'Gagal memuat riwayat PO.',
                );
                if (!Array.isArray(data.orders) || !data.pagination)
                    throw new Error('Respons riwayat PO tidak lengkap.');
                if (!isCurrent()) return;
                setRows(data.orders);
                setPagination(data.pagination);
                if (Number(data.pagination.page) !== page)
                    setPage(Number(data.pagination.page));
            } catch (failure) {
                if (isCurrent()) setError(failure.message);
            } finally {
                if (isCurrent()) setLoading(false);
            }
        };
        load();
        return () => request.current.cancel();
    }, [noPr, noPo, enabled, page, revision]);

    return {
        rows,
        pagination,
        loading,
        error,
        page,
        setPage,
        retry: () => setRevision((value) => value + 1),
    };
}

function PageControls({ state }) {
    if (state.loading)
        return (
            <p className="text-sm text-muted-foreground">
                Memuat riwayat PO...
            </p>
        );
    if (state.error)
        return (
            <div role="alert" className="space-y-2 text-sm">
                <p>{state.error}</p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={state.retry}
                >
                    Coba lagi
                </Button>
            </div>
        );
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{state.pagination.total} data</span>
            {state.pagination.total_pages > 1 && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={state.page <= 1}
                        onClick={() => state.setPage(state.page - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <span>
                        {state.page} / {state.pagination.total_pages}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={state.page >= state.pagination.total_pages}
                        onClick={() => state.setPage(state.page + 1)}
                    >
                        Berikutnya
                    </Button>
                </>
            )}
        </div>
    );
}

function OrderLines({ noPr, order }) {
    const [open, setOpen] = useState(false);
    const state = useOrderPage(noPr, order.no_po, open);
    return (
        <details
            className="rounded-lg border p-3 text-sm"
            onToggle={(event) => setOpen(event.currentTarget.open)}
        >
            <summary className="cursor-pointer font-medium">
                {order.no_po} · {order.vendor || '-'} · {order.line_count}{' '}
                material
            </summary>
            {open && (
                <div className="mt-3 space-y-3">
                    <a
                        className="text-primary underline"
                        href={`/pembelian/purchase-order/${encodeURIComponent(order.no_po)}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Buka dokumen PO
                    </a>
                    {state.rows.map((row, index) => (
                        <p key={index}>
                            {row.tgl} · {row.material}: {row.qty} {row.unit}
                        </p>
                    ))}
                    <PageControls state={state} />
                </div>
            )}
        </details>
    );
}

export default function PrOrderHistory({ noPr }) {
    const [open, setOpen] = useState(false);
    const state = useOrderPage(noPr, null, open);
    return (
        <section className="space-y-3 rounded-xl border border-sidebar-border/70 p-3">
            <Button
                type="button"
                variant="outline"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                {open ? 'Tutup riwayat PO' : 'Lihat riwayat PO terkait'}
            </Button>
            {open && (
                <div className="space-y-3">
                    {!state.loading &&
                        !state.error &&
                        state.rows.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Belum ada PO yang terhubung dengan PR ini.
                            </p>
                        )}
                    {state.rows.map((order) => (
                        <OrderLines
                            key={order.no_po}
                            noPr={noPr}
                            order={order}
                        />
                    ))}
                    <PageControls state={state} />
                </div>
            )}
        </section>
    );
}
