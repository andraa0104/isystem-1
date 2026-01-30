import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventory', href: '/inventory/transfer-material' },
    { title: 'Transfer Material', href: '/inventory/transfer-material' },
];

const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value),
    );
};

export default function TransferMaterialIndex() {
    const [mode, setMode] = useState(''); // '' | mis | mib

    // Shared list state
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

        // Transfer qty per key
        const [qtyByKey, setQtyByKey] = useState({});
        const [saving, setSaving] = useState(false);

    const getCsrfToken = () => {
        const el = document.querySelector('meta[name="csrf-token"]');
        return el?.getAttribute('content') || '';
    };

    const fetchList = async (opts = {}) => {
        const nextMode = opts.mode ?? mode;
        const nextSearch = opts.search ?? debouncedSearch;
        const nextPage = opts.page ?? page;
        const nextPageSize = opts.pageSize ?? pageSize;

        if (!nextMode) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('search', nextSearch);
            params.set('page', String(nextPage));
            params.set('pageSize', nextPageSize === 'all' ? 'all' : String(nextPageSize));
            const url =
                nextMode === 'mis'
                    ? `/inventory/transfer-material/mis-list?${params.toString()}`
                    : `/inventory/transfer-material/mib-list?${params.toString()}`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch {
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Reset table state when user changes mode
        setRows([]);
        setTotal(0);
        setSearch('');
        setDebouncedSearch('');
        setPage(1);
        setPageSize(5);
        setQtyByKey({});
        setLoading(false);
        setSaving(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, pageSize, mode]);

    useEffect(() => {
        if (!mode) return;
        fetchList();
    }, [mode, debouncedSearch, pageSize, page]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 5;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const handleSave = async () => {
        if (saving) return;
        const items = [];
        if (mode === 'mis') {
            for (const r of rows) {
                const key = `${r.no_doc}__${r.kd_mat}`;
                const qty = Number(qtyByKey[key]) || 0;
                if (qty > 0) {
                    items.push({ no_doc: r.no_doc, kd_mat: r.kd_mat, qty });
                }
            }
            if (items.length === 0) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'warning',
                    title: 'Isi qty transfer minimal 1 baris.',
                    showConfirmButton: false,
                    timer: 2500,
                    timerProgressBar: true,
                });
                return;
            }
            setSaving(true);
            try {
                const res = await fetch('/inventory/transfer-material/mis-transfer', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ items }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const msg = data?.errors?.general || data?.message || 'Gagal transfer.';
                    throw new Error(msg);
                }
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: data?.message || 'Berhasil transfer.',
                    showConfirmButton: false,
                    timer: 2500,
                    timerProgressBar: true,
                });
                setQtyByKey({});
                await fetchList({ mode, search: debouncedSearch, page, pageSize });
            } catch (e) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: e?.message || 'Gagal transfer.',
                    showConfirmButton: false,
                    timer: 3500,
                    timerProgressBar: true,
                });
            } finally {
                setSaving(false);
            }
            return;
        }

        // mode mib
        for (const r of rows) {
            const key = `${r.no_doc}__${r.kd_mat}`;
            const qty = Number(qtyByKey[key]) || 0;
            if (qty > 0) {
                items.push({
                    no_mib: r.no_doc,
                    ref_po: r.ref_po,
                    kd_mat: r.kd_mat,
                    material: r.material,
                    qty,
                    unit: r.unit,
                    price: r.price,
                });
            }
        }
        if (items.length === 0) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Isi qty transfer minimal 1 baris.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/inventory/transfer-material/mib-transfer', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ items }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.errors?.general || data?.message || 'Gagal transfer.';
                throw new Error(msg);
            }
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: data?.message || 'Berhasil transfer.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            setQtyByKey({});
            await fetchList({ mode, search: debouncedSearch, page, pageSize });
        } catch (e) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: e?.message || 'Gagal transfer.',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Transfer Material" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Transfer Material</h1>
                        <p className="text-sm text-muted-foreground">
                            Transfer MIS -&gt; MI dan MIB -&gt; MI
                        </p>
                    </div>
                    <div className="w-full sm:w-72">
                        <Select value={mode} onValueChange={setMode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih transfer..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mis">Transfer MIS -&gt; MI</SelectItem>
                                <SelectItem value="mib">Transfer MIB -&gt; MI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {!mode ? (
                    <div className="rounded-2xl border border-white/10 bg-card/40 p-6 text-sm text-muted-foreground">
                        Pilih dulu jenis transfer di dropdown kanan atas untuk memuat data.
                    </div>
                ) : (
                    <>
                        <div className="rounded-2xl border bg-gradient-to-br from-slate-950/40 via-slate-900/20 to-slate-950/30 p-4 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={
                                        mode === 'mis'
                                            ? 'Cari No MI, No PO, Ref PR, Material...'
                                            : 'Cari No MIB, No PO, Material...'
                                    }
                                    className="md:max-w-md"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Tampil</span>
                                    <Select
                                        value={String(pageSize)}
                                        onValueChange={(val) =>
                                            setPageSize(val === 'all' ? 'all' : Number(val))
                                        }
                                    >
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="all">Semua</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" onClick={handleSave}>
                                        Simpan Transfer
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="relative overflow-x-auto rounded-xl border border-white/10 bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                            </div>
                        </div>
                    )}
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-white/5 text-muted-foreground uppercase text-[11px] tracking-wide">
                            <tr>
                                {mode === 'mis' ? (
                                    <>
                                        <th className="px-3 py-3">No MI</th>
                                        <th className="px-3 py-3">No PO</th>
                                        <th className="px-3 py-3">Ref PR</th>
                                        <th className="px-3 py-3">Kode Material</th>
                                        <th className="px-3 py-3">Material</th>
                                        <th className="px-3 py-3">MIS</th>
                                        <th className="px-3 py-3">Remaining After</th>
                                        <th className="px-3 py-3">Unit</th>
                                        <th className="px-3 py-3">Price</th>
                                        <th className="px-3 py-3">Qty Transfer</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-3 py-3">No MIB</th>
                                        <th className="px-3 py-3">No PO</th>
                                        <th className="px-3 py-3">Kode Material</th>
                                        <th className="px-3 py-3">Material</th>
                                        <th className="px-3 py-3">Sisa Qty</th>
                                        <th className="px-3 py-3">Remaining After</th>
                                        <th className="px-3 py-3">Unit</th>
                                        <th className="px-3 py-3">Price</th>
                                        <th className="px-3 py-3">Qty Transfer</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td
                                        colSpan={mode === 'mis' ? 10 : 9}
                                        className="px-3 py-6 text-center text-muted-foreground"
                                    >
                                        Tidak ada data.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, idx) => {
                                const key = `${r.no_doc}__${r.kd_mat}`;
                                const maxQty =
                                    mode === 'mis'
                                        ? Number(r.mis) || 0
                                        : Number(r.remaining ?? r.qty) || 0;
                                const inputQty = Number(qtyByKey[key]) || 0;
                                const remainingAfter = Math.max(0, maxQty - inputQty);
                                return (
                                    <tr key={`${key}-${idx}`} className="border-t border-white/5">
                                        {mode === 'mis' ? (
                                            <>
                                                <td className="px-3 py-2">{r.no_doc}</td>
                                                <td className="px-3 py-2">{r.ref_po}</td>
                                                <td className="px-3 py-2">{r.ref_pr}</td>
                                                <td className="px-3 py-2">{r.kd_mat}</td>
                                                <td className="px-3 py-2">{r.material}</td>
                                                <td className="px-3 py-2">{formatNumber(r.mis)}</td>
                                                <td className="px-3 py-2">{formatNumber(remainingAfter)}</td>
                                                <td className="px-3 py-2">{r.unit}</td>
                                                <td className="px-3 py-2">{formatNumber(r.price)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-3 py-2">{r.no_doc}</td>
                                                <td className="px-3 py-2">{r.ref_po}</td>
                                                <td className="px-3 py-2">{r.kd_mat}</td>
                                                <td className="px-3 py-2">{r.material}</td>
                                                <td className="px-3 py-2">{formatNumber(maxQty)}</td>
                                                <td className="px-3 py-2">{formatNumber(remainingAfter)}</td>
                                                <td className="px-3 py-2">{r.unit}</td>
                                                <td className="px-3 py-2">{formatNumber(r.price)}</td>
                                            </>
                                        )}
                                        <td className="px-3 py-2">
                                            <Input
                                                value={qtyByKey[key] ?? ''}
                                                onChange={(e) =>
                                                    setQtyByKey((prev) => ({
                                                        ...prev,
                                                        [key]: e.target.value,
                                                    }))
                                                }
                                                placeholder="0"
                                                inputMode="numeric"
                                                className="h-9 w-28"
                                            />
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                Max: {formatNumber(maxQty)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                        </div>

                        <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                            <span>Total data: {formatNumber(total)}</span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={page === 1 || loading || saving}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {page} / {totalPages}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={page >= totalPages || loading || saving}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
