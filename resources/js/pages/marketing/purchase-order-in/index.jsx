import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { ClipboardCheck, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
];

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const statusTone = (status) => {
    if (status === 'Ready') {
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';
    }
    if (status === 'Waiting Approval') {
        return 'border-amber-500/40 bg-amber-500/10 text-amber-600';
    }
    return 'border-rose-500/40 bg-rose-500/10 text-rose-600';
};

const toDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isInPeriod = (value, period) => {
    const date = toDate(value);
    if (!date) {
        return false;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (period === 'today') {
        return startOfDate.getTime() === startOfToday.getTime();
    }

    if (period === 'this_week') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const weekStart = new Date(startOfToday);
        weekStart.setDate(startOfToday.getDate() - diffToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return startOfDate >= weekStart && startOfDate <= weekEnd;
    }

    if (period === 'this_month') {
        return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
        );
    }

    return date.getFullYear() === now.getFullYear();
};

export default function PurchaseOrderInIndex({ purchaseOrderIns = [] }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [realizedPeriod, setRealizedPeriod] = useState('today');
    const [activeModal, setActiveModal] = useState(null);
    const [modalSearch, setModalSearch] = useState('');
    const [modalPageSize, setModalPageSize] = useState(5);
    const [modalPage, setModalPage] = useState(1);

    const periodLabelMap = {
        today: 'Hari Ini',
        this_week: 'Minggu Ini',
        this_month: 'Bulan Ini',
        this_year: 'Tahun Ini',
    };

    const outstandingItems = useMemo(
        () => purchaseOrderIns.filter((item) => item.status !== 'Ready'),
        [purchaseOrderIns]
    );

    const realizedItemsByPeriod = useMemo(
        () =>
            purchaseOrderIns.filter(
                (item) =>
                    item.status === 'Ready' &&
                    isInPeriod(item.date, realizedPeriod)
            ),
        [purchaseOrderIns, realizedPeriod]
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return purchaseOrderIns.filter((item) => {
            if (status !== 'all' && item.status !== status) {
                return false;
            }
            if (!term) {
                return true;
            }
            return [item.no_poin, item.vendor, item.ref_po].some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [purchaseOrderIns, search, status]);

    const modalItems =
        activeModal === 'outstanding' ? outstandingItems : realizedItemsByPeriod;

    const modalFilteredItems = useMemo(() => {
        const term = modalSearch.trim().toLowerCase();
        if (!term) {
            return modalItems;
        }
        return modalItems.filter((item) =>
            [item.no_poin, item.vendor, item.ref_po, item.status]
                .some((value) => String(value ?? '').toLowerCase().includes(term))
        );
    }, [modalItems, modalSearch]);

    const modalTotalItems = modalFilteredItems.length;
    const modalTotalPages = useMemo(() => {
        if (modalPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(modalTotalItems / modalPageSize));
    }, [modalTotalItems, modalPageSize]);

    const modalDisplayedItems = useMemo(() => {
        if (modalPageSize === Infinity) {
            return modalFilteredItems;
        }
        const start = (modalPage - 1) * modalPageSize;
        return modalFilteredItems.slice(start, start + modalPageSize);
    }, [modalFilteredItems, modalPage, modalPageSize]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Purchase Order In" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4">
                <section className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 p-5 text-white shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-white/70">
                                Marketing Workspace
                            </p>
                            <h1 className="mt-1 text-2xl font-semibold">Purchase Order In (PO In)</h1>
                            <p className="mt-1 text-sm text-white/75">
                                Monitoring dokumen masuk, approval, dan kesiapan proses secara terpusat.
                            </p>
                        </div>
                        <Button
                            className="bg-white text-slate-900 hover:bg-white/90"
                            onClick={() => router.visit('/marketing/purchase-order-in/create')}
                        >
                            Tambah PO IN
                        </Button>
                    </div>
                </section>

                <section className="grid gap-3 md:grid-cols-2">
                    <article
                        className="cursor-pointer rounded-xl border border-sidebar-border/70 bg-background p-4 shadow-sm transition hover:border-amber-400/50 hover:shadow-md"
                        onClick={() => {
                            setActiveModal('outstanding');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                            <ClipboardCheck className="size-4 text-amber-600" />
                        </div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">PO IN Outstanding</p>
                        <p className="mt-1 text-2xl font-semibold">{outstandingItems.length}</p>
                    </article>

                    <article
                        className="cursor-pointer rounded-xl border border-sidebar-border/70 bg-background p-4 shadow-sm transition hover:border-emerald-400/50 hover:shadow-md"
                        onClick={() => {
                            setActiveModal('realized');
                            setModalSearch('');
                            setModalPageSize(5);
                            setModalPage(1);
                        }}
                    >
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="inline-flex rounded-lg bg-muted p-2">
                                <ClipboardCheck className="size-4 text-emerald-600" />
                            </span>
                            <select
                                className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs"
                                value={realizedPeriod}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setRealizedPeriod(event.target.value)}
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                            </select>
                        </div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">PO IN Terealisasi</p>
                        <p className="mt-1 text-2xl font-semibold">{realizedItemsByPeriod.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{periodLabelMap[realizedPeriod]}</p>
                    </article>
                </section>

                <section className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="relative w-full max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pl-9 pr-3 text-sm"
                                placeholder="Cari no PO In, vendor, atau referensi PO..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <select
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            <option value="Ready">Ready</option>
                            <option value="Waiting Approval">Waiting Approval</option>
                            <option value="Revision">Revision</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">No</th>
                                    <th className="px-4 py-3 text-left">No PO In</th>
                                    <th className="px-4 py-3 text-left">Tanggal</th>
                                    <th className="px-4 py-3 text-left">Vendor</th>
                                    <th className="px-4 py-3 text-left">Ref PO</th>
                                    <th className="px-4 py-3 text-left">Grand Total</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-muted-foreground" colSpan={8}>
                                            Belum ada data PO In.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((item, index) => (
                                    <tr key={item.no_poin} className="border-t border-sidebar-border/70">
                                        <td className="px-4 py-3">{index + 1}</td>
                                        <td className="px-4 py-3 font-semibold">{item.no_poin}</td>
                                        <td className="px-4 py-3">{item.date}</td>
                                        <td className="px-4 py-3">{item.vendor}</td>
                                        <td className="px-4 py-3">{item.ref_po}</td>
                                        <td className="px-4 py-3">{formatRupiah(item.grand_total)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href="/marketing/purchase-order-in/create">Lihat</Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <Dialog
                    open={activeModal !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setActiveModal(null);
                        }
                    }}
                >
                    <DialogContent className="h-[96vh] w-[99vw] max-w-[99vw] sm:!max-w-[99vw] p-4">
                        <DialogHeader>
                            <DialogTitle>
                                {activeModal === 'outstanding'
                                    ? 'Data PO IN Outstanding'
                                    : `Data PO IN Terealisasi (${periodLabelMap[realizedPeriod]})`}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="relative w-full max-w-md">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pl-9 pr-3 text-sm"
                                    placeholder="Cari data di modal..."
                                    value={modalSearch}
                                    onChange={(event) => {
                                        setModalSearch(event.target.value);
                                        setModalPage(1);
                                    }}
                                />
                            </div>
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                    value={modalPageSize === Infinity ? 'all' : String(modalPageSize)}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setModalPageSize(value === 'all' ? Infinity : Number(value));
                                        setModalPage(1);
                                    }}
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                        </div>

                        <div className="max-h-[78vh] overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">No</th>
                                        <th className="px-4 py-3 text-left">No PO In</th>
                                        <th className="px-4 py-3 text-left">Tanggal</th>
                                        <th className="px-4 py-3 text-left">Vendor</th>
                                        <th className="px-4 py-3 text-left">Ref PO</th>
                                        <th className="px-4 py-3 text-left">Grand Total</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalDisplayedItems.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                                                Tidak ada data.
                                            </td>
                                        </tr>
                                    )}
                                    {modalDisplayedItems.map((item, index) => (
                                        <tr key={`${item.no_poin}-${index}`} className="border-t border-sidebar-border/70">
                                            <td className="px-4 py-3">
                                                {modalPageSize === Infinity
                                                    ? index + 1
                                                    : (modalPage - 1) * modalPageSize + index + 1}
                                            </td>
                                            <td className="px-4 py-3 font-semibold">{item.no_poin}</td>
                                            <td className="px-4 py-3">{item.date}</td>
                                            <td className="px-4 py-3">{item.vendor}</td>
                                            <td className="px-4 py-3">{item.ref_po}</td>
                                            <td className="px-4 py-3">{formatRupiah(item.grand_total)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                            <p className="text-muted-foreground">
                                Total {modalTotalItems} data
                            </p>
                            {modalPageSize !== Infinity && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={modalPage === 1}
                                        onClick={() =>
                                            setModalPage((prev) => Math.max(1, prev - 1))
                                        }
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-muted-foreground">
                                        Halaman {modalPage} / {modalTotalPages}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={modalPage >= modalTotalPages}
                                        onClick={() =>
                                            setModalPage((prev) =>
                                                Math.min(modalTotalPages, prev + 1)
                                            )
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
