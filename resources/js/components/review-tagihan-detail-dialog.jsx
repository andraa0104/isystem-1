import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';

const pageSizes = [5, 10, 25, 50, 100];
const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export default function ReviewTagihanDetailDialog({ bucket, referenceDate, onClose, onInvoiceClick, onCustomerClick }) {
    const mode = bucket.type ?? 'aging';
    const risk = mode === 'risk';
    const cashflow = mode === 'cashflow';
    const columnCount = risk ? 6 : cashflow ? 10 : 8;
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState({ search: '', page: 1, perPage: 5 });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            const keyword = search.trim();
            setQuery((current) => current.search === keyword ? current : { ...current, search: keyword, page: 1 });
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const abort = new AbortController();
        const params = new URLSearchParams({ page: String(query.page), per_page: String(query.perPage) });
        if (mode === 'aging') params.set('bucket', bucket.key);
        else {
            params.set('type', mode);
            if (mode === 'risk') params.set('tier', bucket.key);
            else params.set('horizon', String(bucket.horizon));
        }
        const endpoint = mode === 'aging' ? 'aging-invoices' : 'portfolio-details';
        if (referenceDate) params.set('reference_date', referenceDate);
        if (query.search) params.set('search', query.search);
        setLoading(true);
        setError('');
        const load = async () => {
            try {
                const response = await fetch(`/penjualan/review-tagihan/${endpoint}?${params}`, {
                    headers: { Accept: 'application/json' }, signal: abort.signal,
                });
                if (!response.ok) throw new Error('Gagal memuat rincian data. Silakan coba lagi.');
                const data = await response.json();
                if (!Array.isArray(data?.data)) throw new Error('Respons rincian data tidak valid.');
                if (abort.signal.aborted) return;
                if (data.current_page > data.last_page) {
                    setQuery((current) => ({ ...current, page: Math.max(1, data.last_page) }));
                    return;
                }
                setResult(data);
            } catch (exception) {
                if (!abort.signal.aborted) setError(exception.message);
            } finally {
                if (!abort.signal.aborted) setLoading(false);
            }
        };
        load();
        return () => abort.abort();
    }, [bucket.key, bucket.horizon, mode, referenceDate, query, retry]);

    const rows = result?.data ?? [];
    const totalPages = Math.max(1, result?.last_page ?? 1);
    const pageBalance = rows.reduce((total, row) => total + Number((risk ? row.total_saldo : row.saldo_piutang) || 0), 0);

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[92vh] !w-[96vw] !max-w-[1400px] flex-col">
                <DialogHeader>
                    <DialogTitle>{bucket.label}</DialogTitle>
                    <DialogDescription>
                        {risk ? 'Daftar customer pada kategori risiko ini.' : cashflow ? 'Faktur yang berkontribusi pada estimasi pencairan kas.' : 'Daftar faktur yang masih memiliki saldo piutang.'} Umur dihitung per {referenceDate || 'hari ini'}.
                        {bucket.description && ` ${bucket.description}`}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm">
                        Tampilkan
                        <select
                            aria-label="Jumlah data per halaman"
                            className="ml-2 rounded-md border bg-background px-2 py-1.5"
                            value={query.perPage}
                            onChange={(event) => setQuery((current) => ({ ...current, perPage: Number(event.target.value), page: 1 }))}
                        >
                            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                        <span className="ml-2">data</span>
                    </label>
                    <Input
                        aria-label={risk ? 'Cari nama customer' : 'Cari faktur, customer, atau referensi PO'}
                        placeholder={risk ? 'Cari nama customer...' : 'Cari no. faktur, customer, atau referensi PO...'}
                        className="w-full sm:w-96"
                        maxLength={200}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                <div className="min-h-0 overflow-auto rounded-md border" aria-busy={loading}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                {risk ? <>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Jumlah Faktur</TableHead>
                                    <TableHead>Probabilitas Gagal Bayar</TableHead>
                                    <TableHead>Umur Tempo Terlama</TableHead>
                                    <TableHead className="text-right">Saldo Piutang</TableHead>
                                </> : <>
                                    <TableHead>No. Faktur</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Referensi PO</TableHead>
                                    <TableHead>Tanggal Faktur</TableHead>
                                    <TableHead>Jatuh Tempo</TableHead>
                                    <TableHead>Umur Tempo</TableHead>
                                    <TableHead className="text-right">Saldo Piutang</TableHead>
                                    {cashflow && <>
                                        <TableHead>Peluang Pembayaran</TableHead>
                                        <TableHead className="text-right">Estimasi Pencairan</TableHead>
                                    </>}
                                </>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={columnCount} className="py-8 text-center" role="status">Memuat rincian data...</TableCell></TableRow>
                            ) : error ? (
                                <TableRow><TableCell colSpan={columnCount} className="py-8 text-center">
                                    <p role="alert">{error}</p>
                                    <Button type="button" variant="outline" className="mt-2" onClick={() => setRetry((value) => value + 1)}>Coba lagi</Button>
                                </TableCell></TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow><TableCell colSpan={columnCount} className="py-8 text-center">Tidak ada data yang sesuai.</TableCell></TableRow>
                            ) : rows.map((row, index) => (
                                <TableRow key={`${row.no_fakturpenjualan ?? row.nm_cs}:${index}`}>
                                    <TableCell>{(result.from ?? 1) + index}</TableCell>
                                    {risk ? <>
                                        <TableCell className="font-medium">
                                            <button type="button" className="text-left text-primary underline-offset-4 hover:underline" onClick={() => onCustomerClick(row.nm_cs)}>
                                                {row.nm_cs}
                                            </button>
                                        </TableCell>
                                        <TableCell>{row.invoice_count}</TableCell>
                                        <TableCell>{row.default_prob}%</TableCell>
                                        <TableCell>{row.max_overdue_days} hari</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">{currency.format(Number(row.total_saldo || 0))}</TableCell>
                                    </> : <>
                                        <TableCell>
                                            <button type="button" className="text-left font-medium text-primary underline-offset-4 hover:underline" onClick={() => onInvoiceClick(row)}>
                                                {row.no_fakturpenjualan}
                                            </button>
                                        </TableCell>
                                        <TableCell>
                                            <button type="button" className="text-left text-primary underline-offset-4 hover:underline" onClick={() => onCustomerClick(row.nm_cs)}>
                                                {row.nm_cs}
                                            </button>
                                        </TableCell>
                                        <TableCell>{row.ref_po || '-'}</TableCell>
                                        <TableCell>{row.tgl_doc || '-'}</TableCell>
                                        <TableCell>{row.effective_due_date || row.jth_tempo || '-'}</TableCell>
                                        <TableCell>{row.umur_tempo < 0 ? `${Math.abs(row.umur_tempo)} hari lagi` : Number(row.umur_tempo) === 0 ? 'Hari ini' : `${row.umur_tempo} hari lewat tempo`}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">{currency.format(Number(row.saldo_piutang || 0))}</TableCell>
                                        {cashflow && <>
                                            <TableCell>{Number(row.payment_probability).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{currency.format(Number(row.expected_recovery || 0))}</TableCell>
                                        </>}
                                    </>}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-live="polite">
                    <div>
                        {!loading && !error && <>
                            <p>Menampilkan {result?.from ?? 0}-{result?.to ?? 0} dari {result?.total ?? 0} {risk ? 'customer' : 'faktur'}</p>
                            <p className="text-xs text-muted-foreground">Saldo pada halaman ini: {currency.format(pageBalance)}</p>
                            {cashflow && <p className="text-xs text-muted-foreground">Estimasi pencairan pada halaman ini: {currency.format(rows.reduce((total, row) => total + Number(row.expected_recovery || 0), 0))}</p>}
                        </>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={loading || !!error || query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}>Sebelumnya</Button>
                        <span>Halaman {query.page} dari {totalPages}</span>
                        <Button type="button" variant="outline" disabled={loading || !!error || query.page >= totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Selanjutnya</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
