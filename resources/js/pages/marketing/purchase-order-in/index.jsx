import { Button } from '@/components/ui/button';
import {
    DialogClose,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { ClipboardCheck, Eye, Printer, Search, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
];

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const toastSuccess = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: message,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
    });
};

const toastError = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: message,
        showConfirmButton: false,
        timer: 3600,
        timerProgressBar: true,
    });
};

const formatDateDisplay = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return '-';
    }
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return `${iso[3]}-${iso[2]}-${iso[1]}`;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return text;
    }
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
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

export default function PurchaseOrderInIndex({
    purchaseOrderIns = [],
    outstandingPurchaseOrderIns = [],
    realizedPurchaseOrderIns = [],
    summary = {},
    filters = {},
    pagination = {},
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [perPage, setPerPage] = useState(String(filters.per_page ?? '5'));
    const [realizedPeriod, setRealizedPeriod] = useState('today');
    const [activeModal, setActiveModal] = useState(null);
    const [modalSearch, setModalSearch] = useState('');
    const [modalPageSize, setModalPageSize] = useState(5);
    const [modalPage, setModalPage] = useState(1);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTableLoading, setDetailTableLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailHeader, setDetailHeader] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailKodePoin, setDetailKodePoin] = useState('');
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailPage, setDetailPage] = useState(1);
    const [detailPagination, setDetailPagination] = useState({
        total: 0,
        page: 1,
        per_page: 5,
        total_pages: 1,
    });
    const [confirmDeleteKode, setConfirmDeleteKode] = useState('');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchTable = (next = {}) => {
        router.get(
            '/marketing/purchase-order-in',
            {
                search,
                per_page: perPage,
                page: 1,
                ...next,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search === (filters.search ?? '')) {
                return;
            }
            fetchTable({ search, page: 1 });
        }, 350);

        return () => clearTimeout(timer);
    }, [search]);

    const periodLabelMap = {
        today: 'Hari Ini',
        this_week: 'Minggu Ini',
        this_month: 'Bulan Ini',
        this_year: 'Tahun Ini',
    };

    const outstandingItems = useMemo(
        () => outstandingPurchaseOrderIns,
        [outstandingPurchaseOrderIns]
    );

    const realizedItemsByPeriod = useMemo(
        () =>
            realizedPurchaseOrderIns.filter(
                (item) =>
                    isInPeriod(item.date_poin, realizedPeriod)
            ),
        [realizedPurchaseOrderIns, realizedPeriod]
    );

    const modalItems =
        activeModal === 'outstanding' ? outstandingItems : realizedItemsByPeriod;

    const modalFilteredItems = useMemo(() => {
        const term = modalSearch.trim().toLowerCase();
        if (!term) {
            return modalItems;
        }
        return modalItems.filter((item) =>
            [item.kode_poin, item.no_poin, item.customer_name]
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

    const loadDetailModal = async (kodePoin, opts = {}) => {
        const isInitial = Boolean(opts.initial);
        if (isInitial) {
            setDetailLoading(true);
        } else {
            setDetailTableLoading(true);
        }
        setDetailError('');
        try {
            const params = new URLSearchParams();
            const nextPage = opts.page ?? detailPage;
            const nextPerPage = opts.perPage ?? detailPageSize;
            const nextSearch = opts.search ?? detailSearch;
            params.set('page', String(nextPage));
            params.set('per_page', nextPerPage === Infinity ? 'all' : String(nextPerPage));
            if (String(nextSearch ?? '').trim()) {
                params.set('search', String(nextSearch).trim());
            }

            const response = await fetch(`/marketing/purchase-order-in/${encodeURIComponent(kodePoin)}/show?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Gagal memuat detail PO In.');
            }
            setDetailHeader(data?.header ?? null);
            setDetailItems(Array.isArray(data?.items) ? data.items : []);
            setDetailPagination({
                total: Number(data?.pagination?.total ?? 0),
                page: Number(data?.pagination?.page ?? 1),
                per_page: data?.pagination?.per_page ?? (nextPerPage === Infinity ? 'all' : nextPerPage),
                total_pages: Number(data?.pagination?.total_pages ?? 1),
            });
        } catch (error) {
            setDetailError(error?.message || 'Gagal memuat detail PO In.');
        } finally {
            if (isInitial) {
                setDetailLoading(false);
            } else {
                setDetailTableLoading(false);
            }
        }
    };

    const openDetailModal = (kodePoin) => {
        setIsDetailModalOpen(true);
        setDetailHeader(null);
        setDetailItems([]);
        setDetailError('');
        setDetailKodePoin(kodePoin);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailPage(1);
        setDetailLoading(true);
    };

    const handleDeletePoIn = async () => {
        if (!confirmDeleteKode) {
            return;
        }

        setIsDeleting(true);
        router.delete(`/marketing/purchase-order-in/${encodeURIComponent(confirmDeleteKode)}`, {
            preserveScroll: true,
            onSuccess: (page) => {
                if (page?.props?.flash?.error) {
                    toastError(page.props.flash.error);
                    setIsDeleting(false);
                    return;
                }
                toastSuccess(page?.props?.flash?.success || 'PO In berhasil dihapus.');
                setActiveModal(null);
                setIsConfirmDeleteOpen(false);
                setConfirmDeleteKode('');
                fetchTable({ page: pagination?.page ?? 1 });
                setIsDeleting(false);
            },
            onError: (errors) => {
                const first = Object.values(errors ?? {})[0];
                const msg = Array.isArray(first) ? first[0] : first;
                toastError(msg || 'Gagal menghapus PO In.');
                setIsDeleting(false);
            },
            onFinish: () => setIsDeleting(false),
        });
    };

    useEffect(() => {
        if (!isDetailModalOpen || !detailKodePoin) {
            return;
        }
        const timer = setTimeout(() => {
            loadDetailModal(detailKodePoin, {
                page: detailPage,
                perPage: detailPageSize,
                search: detailSearch,
                initial: !detailHeader,
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [detailKodePoin, detailPage, detailPageSize, detailSearch, isDetailModalOpen]);

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
                        <p className="mt-1 text-2xl font-semibold">{summary.outstanding ?? 0}</p>
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
                        <p className="mt-1 text-2xl font-semibold">{summary.realized ?? 0}</p>
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
                                placeholder="Cari kode PO IN, no PO IN, atau nama customer..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <select
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                            value={perPage}
                            onChange={(event) => {
                                const value = event.target.value;
                                setPerPage(value);
                                fetchTable({ per_page: value, page: 1 });
                            }}
                        >
                            <option value="5">5 data</option>
                            <option value="10">10 data</option>
                            <option value="25">25 data</option>
                            <option value="50">50 data</option>
                            <option value="all">Semua data</option>
                        </select>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">No</th>
                                    <th className="px-4 py-3 text-left">Kode PO In</th>
                                    <th className="px-4 py-3 text-left">No PO In</th>
                                    <th className="px-4 py-3 text-left">Tanggal</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Grand Total</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseOrderIns.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                                            Belum ada data PO In.
                                        </td>
                                    </tr>
                                )}
                                {purchaseOrderIns.map((item, index) => (
                                    <tr key={item.id ?? item.no_poin} className="border-t border-sidebar-border/70">
                                        <td className="px-4 py-3">
                                            {pagination.per_page === 'all'
                                                ? index + 1
                                                : ((Number(pagination.page || 1) - 1) * Number(pagination.per_page || 5)) + index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{item.kode_poin}</td>
                                        <td className="px-4 py-3 font-semibold">{item.no_poin}</td>
                                        <td className="px-4 py-3">{formatDateDisplay(item.date_poin)}</td>
                                        <td className="px-4 py-3">{item.customer_name}</td>
                                        <td className="px-4 py-3">{formatRupiah(item.grand_total)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openDetailModal(item.kode_poin)}
                                                    title="Lihat"
                                                >
                                                    <Eye className="size-4" />
                                                </Button>
                                                <a
                                                    href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                                    title="Print"
                                                >
                                                    <Printer className="size-4" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {String(pagination.per_page) !== 'all' && Number(pagination.total || 0) > 0 && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                                Menampilkan {Math.min(((Number(pagination.page || 1) - 1) * Number(pagination.per_page || 5)) + 1, Number(pagination.total || 0))}
                                -{Math.min(Number(pagination.page || 1) * Number(pagination.per_page || 5), Number(pagination.total || 0))}
                                {' '}dari {pagination.total} data
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={Number(pagination.page || 1) <= 1}
                                    onClick={() => fetchTable({ page: Math.max(1, Number(pagination.page || 1) - 1) })}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {pagination.page || 1} / {pagination.total_pages || 1}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={Number(pagination.page || 1) >= Number(pagination.total_pages || 1)}
                                    onClick={() => fetchTable({ page: Math.min(Number(pagination.total_pages || 1), Number(pagination.page || 1) + 1) })}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                <Dialog
                    open={isDetailModalOpen}
                    onOpenChange={(open) => {
                        setIsDetailModalOpen(open);
                        if (!open) {
                            setDetailHeader(null);
                            setDetailItems([]);
                            setDetailError('');
                            setDetailKodePoin('');
                            setDetailTableLoading(false);
                        }
                    }}
                >
                    <DialogContent className="!left-[0.5vw] !top-[2vh] !h-[96vh] !w-[99vw] !max-w-[99vw] !translate-x-0 !translate-y-0 overflow-y-auto p-0">
                        <DialogHeader className="sticky top-0 z-20 border-b border-sidebar-border/70 bg-background px-4 py-3 pr-12">
                            <div className="flex items-center justify-between">
                                <DialogTitle>Detail PO In</DialogTitle>
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Tutup">
                                        <X className="size-4" />
                                    </Button>
                                </DialogClose>
                            </div>
                        </DialogHeader>
                        <div className="p-4">
                        {detailLoading && (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                Memuat detail PO In...
                            </div>
                        )}
                        {!detailLoading && detailError && (
                            <div className="py-10 text-center text-sm text-rose-600">{detailError}</div>
                        )}
                        {!detailLoading && !detailError && detailHeader && (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Kode PO In</p>
                                        <p className="font-semibold">{detailHeader.kode_poin ?? '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">No PO In</p>
                                        <p className="font-semibold">{detailHeader.no_poin ?? '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Customer</p>
                                        <p className="font-semibold">{detailHeader.customer_name ?? '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Date PO In</p>
                                        <p className="font-semibold">{formatDateDisplay(detailHeader.date_poin)}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Delivery Date</p>
                                        <p className="font-semibold">{formatDateDisplay(detailHeader.delivery_date)}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">PPN</p>
                                        <p className="font-semibold">{detailHeader.ppn_input_percent ?? 0}%</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="relative w-full max-w-md">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="search"
                                            className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-background pl-9 pr-3 text-sm"
                                            placeholder="Cari material..."
                                            value={detailSearch}
                                            onChange={(event) => {
                                                setDetailSearch(event.target.value);
                                                setDetailPage(1);
                                            }}
                                        />
                                    </div>
                                    <label className="text-sm text-muted-foreground">
                                        Tampilkan
                                        <select
                                            className="ml-2 h-10 rounded-lg border border-sidebar-border/70 bg-background px-3 text-sm"
                                            value={detailPageSize === Infinity ? 'all' : String(detailPageSize)}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setDetailPageSize(value === 'all' ? Infinity : Number(value));
                                                setDetailPage(1);
                                            }}
                                        >
                                            <option value="5">5</option>
                                            <option value="10">10</option>
                                            <option value="25">25</option>
                                            <option value="50">50</option>
                                            <option value="all">Semua</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="overflow-x-hidden rounded-xl border border-sidebar-border/70">
                                    <table className="w-full table-fixed text-sm">
                                        <thead className="bg-muted/40 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 text-left">No</th>
                                                <th className="px-4 py-3 text-left">Kode Material</th>
                                                <th className="px-4 py-3 text-left">Material</th>
                                                <th className="px-4 py-3 text-left">Qty</th>
                                                <th className="px-4 py-3 text-left">Satuan</th>
                                                <th className="px-4 py-3 text-left">Price PO In</th>
                                                <th className="px-4 py-3 text-left">Total Price</th>
                                                <th className="px-4 py-3 text-left">Sisa PR</th>
                                                <th className="px-4 py-3 text-left">Sisa DO</th>
                                                <th className="px-4 py-3 text-left">Remark</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailTableLoading && (
                                                <tr>
                                                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={10}>
                                                        Memuat data material...
                                                    </td>
                                                </tr>
                                            )}
                                            {!detailTableLoading && detailItems.length === 0 && (
                                                <tr>
                                                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={10}>
                                                        Tidak ada detail material.
                                                    </td>
                                                </tr>
                                            )}
                                            {!detailTableLoading && detailItems.map((row, index) => (
                                                <tr key={row.id ?? `${row.kode_poin}-${index}`} className="border-t border-sidebar-border/70">
                                                    <td className="px-4 py-3">
                                                        {detailPagination.per_page === 'all'
                                                            ? index + 1
                                                            : ((Number(detailPagination.page || 1) - 1) * Number(detailPagination.per_page || 5)) + index + 1}
                                                    </td>
                                                    <td className="px-4 py-3 break-words">{row.kd_material ?? '-'}</td>
                                                    <td className="px-4 py-3 break-words">{row.material ?? '-'}</td>
                                                    <td className="px-4 py-3">{row.qty ?? 0}</td>
                                                    <td className="px-4 py-3">{row.satuan ?? '-'}</td>
                                                    <td className="px-4 py-3">{formatRupiah(row.price_po_in ?? 0)}</td>
                                                    <td className="px-4 py-3">{formatRupiah(row.total_price_po_in ?? 0)}</td>
                                                    <td className="px-4 py-3">{row.sisa_qtypr ?? 0}</td>
                                                    <td className="px-4 py-3">{row.sisa_qtydo ?? 0}</td>
                                                    <td className="px-4 py-3 break-words">{row.remark || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                    <p className="text-muted-foreground">Total {detailPagination.total} data</p>
                                    {String(detailPagination.per_page) !== 'all' && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={Number(detailPagination.page || 1) <= 1}
                                                onClick={() =>
                                                    setDetailPage((prev) => Math.max(1, prev - 1))
                                                }
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="text-muted-foreground">
                                                Halaman {detailPagination.page} / {detailPagination.total_pages}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={Number(detailPagination.page) >= Number(detailPagination.total_pages)}
                                                onClick={() =>
                                                    setDetailPage((prev) => Math.min(Number(detailPagination.total_pages || 1), prev + 1))
                                                }
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-3 md:grid-cols-4">
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Total Price</p>
                                        <p className="font-semibold">{formatRupiah(detailHeader.total_price ?? 0)}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">DPP</p>
                                        <p className="font-semibold">{formatRupiah(detailHeader.dpp ?? 0)}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">PPN</p>
                                        <p className="font-semibold">{formatRupiah(detailHeader.ppn_amount ?? 0)}</p>
                                    </div>
                                    <div className="rounded-lg border border-sidebar-border/70 p-3">
                                        <p className="text-xs text-muted-foreground">Grand Total</p>
                                        <p className="font-semibold">{formatRupiah(detailHeader.grand_total ?? 0)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </DialogContent>
                </Dialog>

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
                                        <th className="px-4 py-3 text-left">Kode PO In</th>
                                        <th className="px-4 py-3 text-left">No PO In</th>
                                        <th className="px-4 py-3 text-left">Tanggal</th>
                                        <th className="px-4 py-3 text-left">Customer</th>
                                        <th className="px-4 py-3 text-left">Grand Total</th>
                                        <th className="px-4 py-3 text-left">Action</th>
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
                                            <td className="px-4 py-3 font-semibold">{item.kode_poin}</td>
                                            <td className="px-4 py-3 font-semibold">{item.no_poin}</td>
                                            <td className="px-4 py-3">{formatDateDisplay(item.date_poin)}</td>
                                            <td className="px-4 py-3">{item.customer_name}</td>
                                            <td className="px-4 py-3">{formatRupiah(item.grand_total)}</td>
                                            <td className="px-4 py-3">
                                                {activeModal === 'outstanding' ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setActiveModal(null);
                                                                openDetailModal(item.kode_poin);
                                                            }}
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                        {Number(item.can_delete ?? 0) === 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                title="Hapus"
                                                                onClick={() => {
                                                                    setConfirmDeleteKode(item.kode_poin);
                                                                    setIsConfirmDeleteOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setActiveModal(null);
                                                                openDetailModal(item.kode_poin);
                                                            }}
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                        <a
                                                            href={`/marketing/purchase-order-in/${encodeURIComponent(item.kode_poin)}/print`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                                            title="Print"
                                                        >
                                                            <Printer className="size-4" />
                                                        </a>
                                                    </div>
                                                )}
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

                <Dialog
                    open={isConfirmDeleteOpen}
                    onOpenChange={(open) => {
                        setIsConfirmDeleteOpen(open);
                        if (!open) {
                            setConfirmDeleteKode('');
                        }
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Hapus PO In?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            Data header dan detail material akan dihapus permanen.
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsConfirmDeleteOpen(false);
                                    setConfirmDeleteKode('');
                                }}
                                disabled={isDeleting}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeletePoIn}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Menghapus...' : 'Ya, hapus'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
