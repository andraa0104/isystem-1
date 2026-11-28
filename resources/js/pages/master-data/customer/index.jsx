import { MenuAction } from '@/components/menu-action';
import { ActionIconButton } from '@/components/action-icon-button';
import { ErrorState } from '@/components/data-states/ErrorState';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { useMasterDataRows } from '@/hooks/use-master-data-rows';
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { confirmDelete } from '@/lib/confirm-delete';
import { formatDateId } from '@/lib/formatters';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUpDown,
    Building2,
    Download,
    Eye,
    MapPin,
    Pencil,
    Plus,
    Printer,
    Search,
    Sparkles,
    Trash2,
    Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Master Data', href: '/master-data/customer' },
    { title: 'Customer', href: '/master-data/customer' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const initialFormState = {
    nm_cs: '',
    alamat_cs: '',
    kota_cs: '',
    telp_cs: '',
    fax_cs: '',
    npwp_cs: '',
    npwp1_cs: '',
    npwp2_cs: '',
    Attnd: [''],
};

// Global cache untuk menyimpan data modal customer
const customerDetailCache = {};

export default function CustomerIndex() {
    // --- States Utama ---

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [codeOrder, setCodeOrder] = useState('asc');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [viewCustomer, setViewCustomer] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState(null);
    const [viewTab, setViewTab] = useState('profil'); // profil | riwayat

    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);
    const [editCustomerId, setEditCustomerId] = useState(null);

    const [doHistory, setDoHistory] = useState([]);
    const [doSearchTerm, setDoSearchTerm] = useState('');
    const [debouncedDoSearchTerm, setDebouncedDoSearchTerm] = useState('');
    const [doPageSize, setDoPageSize] = useState(5);
    const [doCurrentPage, setDoCurrentPage] = useState(1);

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: createProcessing,
        reset: resetCreate,
        errors: createErrors,
    } = useForm(initialFormState);
    const {
        data: editData,
        setData: setEditData,
        put,
        processing: editProcessing,
        reset: resetEdit,
        errors: editErrors,
    } = useForm(initialFormState);

    const { flash, errors } = usePage().props;

    const {
        rows: customersList,
        total: totalItems,
        loading: tableLoading,
        error: tableError,
        refresh: refreshRows,
    } = useMasterDataRows('/master-data/customer/rows', {
        search: debouncedSearchTerm.trim(),
        page: currentPage,
        per_page: pageSize === Infinity ? 'all' : pageSize,
        order: codeOrder,
    });

    // --- Debounce Input Pencarian (Optimasi Filter Tabel) ---
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedDoSearchTerm(doSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [doSearchTerm]);

    // --- Pemrosesan Data List Utama ---
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedCustomers = customersList;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // --- Pemrosesan Data List Riwayat DO Modal ---
    const filteredDoHistory = useMemo(() => {
        const term = debouncedDoSearchTerm.trim().toLowerCase();
        if (!term) {
            return doHistory;
        }
        return doHistory.filter((item) =>
            String(item.no_do ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [doHistory, debouncedDoSearchTerm]);

    const doTotalItems = filteredDoHistory.length;
    const doTotalPages = useMemo(() => {
        if (doPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(doTotalItems / doPageSize));
    }, [doPageSize, doTotalItems]);

    const displayedDoHistory = useMemo(() => {
        if (doPageSize === Infinity) {
            return filteredDoHistory;
        }
        const startIndex = (doCurrentPage - 1) * doPageSize;
        return filteredDoHistory.slice(startIndex, startIndex + doPageSize);
    }, [filteredDoHistory, doCurrentPage, doPageSize]);

    useEffect(() => {
        if (doCurrentPage > doTotalPages) {
            setDoCurrentPage(doTotalPages);
        }
    }, [doCurrentPage, doTotalPages]);

    // --- Logika Fetching API Modal ---
    const fetchCustomerDetail = async (kdCustomer) => {
        const response = await fetch(
            `/master-data/customer/${encodeURIComponent(kdCustomer)}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw await readApiError(response);
        return response.json();
    };

    const handleView = async (customer) => {
        if (!customer?.kd_cs) return;

        setIsViewModalOpen(true);
        setViewError(null);
        setViewTab('profil');
        setDoSearchTerm('');
        setDebouncedDoSearchTerm('');
        setDoPageSize(5);
        setDoCurrentPage(1);

        // Gunakan cache jika sudah ada agar loading instan saat dibuka kembali
        if (customerDetailCache[customer.kd_cs]) {
            const payload = customerDetailCache[customer.kd_cs];
            setViewCustomer(payload.customer ?? null);
            setDoHistory(payload.deliveryOrders ?? []);
            setViewLoading(false);
            return;
        }

        setViewLoading(true);
        setViewCustomer(null);
        setDoHistory([]);

        try {
            const payload = await fetchCustomerDetail(customer.kd_cs);
            customerDetailCache[customer.kd_cs] = payload; // Simpan ke cache
            setViewCustomer(payload.customer ?? null);
            setDoHistory(payload.deliveryOrders ?? []);
        } catch (error) {
            setViewError(
                normalizeApiError(error, 'Gagal memuat data customer.'),
            );
        } finally {
            setViewLoading(false);
        }
    };

    const handleEdit = async (customer) => {
        if (!customer?.kd_cs) return;

        setIsEditModalOpen(true);
        setEditError(null);
        setEditCustomerId(customer.kd_cs);

        // Gunakan cache jika sudah pernah diload
        if (customerDetailCache[customer.kd_cs]) {
            const payload = customerDetailCache[customer.kd_cs];
            let fixedAttnd = payload.customer?.Attnd || [''];
            if (typeof fixedAttnd === 'string') {
                fixedAttnd = fixedAttnd
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (fixedAttnd.length === 0) fixedAttnd = [''];
            }
            setEditData({
                ...initialFormState,
                ...payload.customer,
                Attnd: fixedAttnd,
            });
            setEditLoading(false);
            return;
        }

        setEditLoading(true);
        try {
            const payload = await fetchCustomerDetail(customer.kd_cs);
            customerDetailCache[customer.kd_cs] = payload; // Simpan ke cache
            let fixedAttnd = payload.customer?.Attnd || [''];
            if (typeof fixedAttnd === 'string') {
                fixedAttnd = fixedAttnd
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (fixedAttnd.length === 0) fixedAttnd = [''];
            }
            setEditData({
                ...initialFormState,
                ...payload.customer,
                Attnd: fixedAttnd,
            });
        } catch (error) {
            setEditError(
                normalizeApiError(error, 'Gagal memuat data customer.'),
            );
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (customer) => {
        if (!customer?.kd_cs) return;

        try {
            let payload = customerDetailCache[customer.kd_cs];
            if (!payload) {
                payload = await fetchCustomerDetail(customer.kd_cs);
                customerDetailCache[customer.kd_cs] = payload;
            }

            const doCount = Array.isArray(payload?.deliveryOrders)
                ? payload.deliveryOrders.length
                : 0;
            if (doCount > 0) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Tidak bisa dihapus',
                    text: `Customer ini sudah dipakai di ${doCount} DO.`,
                });
                return;
            }
        } catch (error) {
            const normalized = normalizeApiError(
                error,
                'Gagal memeriksa relasi transaksi customer.',
            );
            await Swal.fire({
                icon: 'error',
                title:
                    normalized.summary ||
                    'Gagal memeriksa relasi transaksi customer.',
                html: normalized.detail
                    ? `<pre style="text-align:left;white-space:pre-wrap;max-height:240px;overflow:auto;margin:0;">${String(
                        normalized.detail,
                    )
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')}</pre>`
                    : undefined,
            });
            return;
        }

        const ok = await confirmDelete({
            title: 'Hapus data customer?',
            text: 'Data yang dihapus tidak dapat dikembalikan.',
        });
        if (!ok) return;

        router.delete(
            `/master-data/customer/${encodeURIComponent(customer.kd_cs)}`,
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const flashError = page?.props?.flash?.error;
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true,
                    });

                    if (flashError) {
                        Toast.fire({
                            icon: 'error',
                            title: flashError,
                        });
                        return; // Stop on error
                    }

                    delete customerDetailCache[customer.kd_cs];

                    Toast.fire({
                        icon: 'success',
                        title:
                            page?.props?.flash?.success ||
                            'Customer berhasil dihapus.',
                    });

                    refreshRows();
                },
            },
        );
    };

    const handleCreateSubmit = (event) => {
        event.preventDefault();
        post('/master-data/customer', {
            preserveScroll: true,
            onSuccess: (page) => {
                const flashError = page.props?.flash?.error;
                const flashSuccess = page.props?.flash?.success;

                if (flashError) {
                    const ErrToast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 4000,
                        timerProgressBar: true,
                    });
                    ErrToast.fire({
                        icon: 'error',
                        title: flashError,
                    });
                    return;
                }

                setTimeout(() => {
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true,
                    });
                    Toast.fire({
                        icon: 'success',
                        title:
                            typeof page !== 'undefined' &&
                                page?.props?.flash?.success
                                ? page.props.flash.success
                                : 'Berhasil disimpan.',
                    });
                }, 500);

                resetCreate();
                setIsCreateModalOpen(false);
                refreshRows();
            },
            onError: (errs) => {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'Periksa kembali isian form.',
                    timer: 3000,
                    showConfirmButton: false,
                });
            },
        });
    };

    const handleEditSubmit = (event) => {
        event.preventDefault();
        if (!editCustomerId) return;

        put(`/master-data/customer/${encodeURIComponent(editCustomerId)}`, {
            preserveScroll: true,
            onSuccess: (page) => {
                const flashError = page.props?.flash?.error;
                const flashSuccess = page.props?.flash?.success;

                if (flashError) {
                    Swal.fire({
                        title: 'Gagal',
                        text: flashError,
                        icon: 'error',
                    });
                    return; // Stop here, do not close modal or reset if it failed!
                }

                if (customerDetailCache[editCustomerId]) {
                    customerDetailCache[editCustomerId].customer = {
                        ...editData,
                    };
                }

                setTimeout(() => {
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true,
                    });
                    Toast.fire({
                        icon: 'success',
                        title:
                            typeof page !== 'undefined' &&
                                page?.props?.flash?.success
                                ? page.props.flash.success
                                : 'Berhasil disimpan.',
                    });
                }, 500);

                resetEdit();
                setEditCustomerId(null);
                setIsEditModalOpen(false);
                refreshRows();
            },
            onError: (errs) => {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'Periksa kembali isian form.',
                    timer: 3000,
                    showConfirmButton: false,
                });
            },
        });
    };

    return (
        <>
            <Head title="Data Customer" />
            <div className="relative isolate min-h-full overflow-hidden bg-gradient-to-br from-background via-background to-emerald-500/[0.04]">
                <div className="relative bg-gradient-to-br from-background via-background to-emerald-500/[0.04]">
                    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
                        <div className="absolute -left-32 -top-36 size-[420px] rounded-full bg-emerald-500/[0.08] blur-[110px] dark:bg-emerald-500/[0.12]" />
                        <div className="absolute -right-28 top-1/3 size-[360px] rounded-full bg-cyan-500/[0.07] blur-[110px] dark:bg-cyan-500/[0.1]" />
                    </div>
                    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
                        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                                className="relative overflow-hidden rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.12] via-card/90 to-cyan-500/[0.07] p-6 shadow-xl shadow-emerald-950/[0.04] backdrop-blur sm:p-8"
                            >
                                <div className="absolute -right-8 -top-16 size-64 rounded-full border border-emerald-500/10" />
                                <div className="absolute right-10 top-8 size-36 rounded-full border border-cyan-500/10" />
                                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                                    <div className="max-w-2xl">
                                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-background/60 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-700 shadow-sm dark:text-emerald-300">
                                            <Sparkles className="size-3.5" /> MASTER DATA
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Data Customer</h1>
                                        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                                            Kelola informasi customer, kontak, dan riwayat transaksi dalam satu tempat.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" className="h-11 border-border/70 bg-background/70 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-background" onClick={() => window.open('/master-data/customer/export', '_blank')}>
                                            <Download className="mr-2 size-4" /> Export Data
                                        </Button>
                                        <MenuAction action="create" className="h-11 shadow-lg shadow-emerald-900/10 transition-all hover:-translate-y-0.5" onClick={() => setIsCreateModalOpen(true)}>
                                            <Plus className="mr-2 size-4" /> Tambah Customer
                                        </MenuAction>
                                    </div>
                                </div>
                            </motion.section>

                            {tableError && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm text-destructive">
                                    <span>{tableError}</span>
                                    <Button type="button" variant="outline" size="sm" onClick={refreshRows}>Coba lagi</Button>
                                </motion.div>
                            )}

                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
                                <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/90 shadow-xl shadow-slate-950/[0.04] backdrop-blur">
                                    <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-5 sm:px-7">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400">
                                                    <Users className="size-5" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">Direktori Customer</CardTitle>
                                                    <CardDescription className="mt-1">Cari, tinjau, dan kelola data customer.</CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                                                <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                                                <span><strong className="font-semibold text-foreground">{totalItems}</strong> customer terdaftar</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-5 p-5 sm:p-7">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                            <div className="flex flex-wrap items-end gap-3">
                                                <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                                    <span>Tampilkan</span>
                                                    <select className="block h-10 min-w-24 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" value={pageSize === Infinity ? 'all' : pageSize} onChange={(event) => { const value = event.target.value; setPageSize(value === 'all' ? Infinity : Number(value)); setCurrentPage(1); }}>
                                                        <option value={5}>5 baris</option><option value={10}>10 baris</option><option value={25}>25 baris</option><option value={50}>50 baris</option><option value="all">Semua</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                                    <span>Urutkan kode</span>
                                                    <span className="relative block">
                                                        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                        <select className="h-10 min-w-40 appearance-none rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" value={codeOrder} onChange={(event) => { setCodeOrder(event.target.value); setCurrentPage(1); }}>
                                                            <option value="asc">Kode CS A–Z</option><option value="desc">Kode CS Z–A</option>
                                                        </select>
                                                    </span>
                                                </label>
                                            </div>
                                            <label className="w-full space-y-1.5 text-xs font-medium text-muted-foreground xl:max-w-sm">
                                                <span>Cari customer</span>
                                                <span className="relative block">
                                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                    <input type="search" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" placeholder="Nama, kode, atau alamat customer..." value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }} />
                                                </span>
                                            </label>
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/60 shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[760px] text-left text-sm">
                                                    <thead className="sticky top-0 z-10 bg-muted/90 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur-xl">
                                                        <tr>
                                                            <th className="w-16 px-5 py-4 font-semibold">No</th>
                                                            <th className="w-44 px-5 py-4 font-semibold">Kode CS</th>
                                                            <th className="min-w-56 px-5 py-4 font-semibold">Nama Customer</th>
                                                            <th className="px-5 py-4 font-semibold">Alamat</th>
                                                            <th className="w-36 px-5 py-4 text-center font-semibold">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/60">
                                                        {tableLoading ? (
                                                            <tr><td className="px-5 py-5" colSpan={5}><div className="space-y-3"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div></td></tr>
                                                        ) : displayedCustomers.length === 0 ? (
                                                            <tr><td className="px-5 py-16 text-center" colSpan={5}>
                                                                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Users className="size-6" /></div>
                                                                <p className="mt-4 font-semibold text-foreground">Customer belum ditemukan</p>
                                                                <p className="mt-1 text-sm text-muted-foreground">Ubah kata kunci pencarian atau tambahkan data customer baru.</p>
                                                                <MenuAction action="create" type="button" size="sm" className="mt-4" onClick={() => setIsCreateModalOpen(true)}><Plus className="mr-2 size-4" /> Tambah Customer</MenuAction>
                                                            </td></tr>
                                                        ) : displayedCustomers.map((item, index) => (
                                                            <motion.tr key={`${item.kd_cs}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.25) }} className="group transition-colors hover:bg-emerald-500/[0.035]">
                                                                <td className="px-5 py-4 text-xs font-medium tabular-nums text-muted-foreground">{(pageSize === Infinity ? index : (currentPage - 1) * pageSize + index) + 1}</td>
                                                                <td className="px-5 py-4"><span className="inline-flex rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">{renderValue(item.kd_cs)}</span></td>
                                                                <td className="px-5 py-4"><div className="font-semibold text-foreground transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{renderValue(item.nm_cs)}</div></td>
                                                                <td className="max-w-[420px] px-5 py-4"><div className="flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" /><span className="line-clamp-2">{renderValue(item.alamat_cs)}</span></div></td>
                                                                <td className="px-5 py-4"><div className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/80 p-1 shadow-sm transition-all group-hover:border-emerald-500/20 group-hover:shadow-md">
                                                                    <ActionIconButton label="Detail" onClick={() => handleView(item)}><Eye className="size-4" /></ActionIconButton>
                                                                    <MenuAction action="update" as={ActionIconButton} label="Edit" onClick={() => handleEdit(item)}><Pencil className="size-4" /></MenuAction>
                                                                    <MenuAction action="delete" as={ActionIconButton} label="Hapus" onClick={() => handleDelete(item)}><Trash2 className="size-4 text-destructive" /></MenuAction>
                                                                </div></td>
                                                            </motion.tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {pageSize !== Infinity && totalItems > 0 && (
                                            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                                <span>Menampilkan <strong className="font-semibold text-foreground">{Math.min((currentPage - 1) * pageSize + 1, totalItems)}–{Math.min(currentPage * pageSize, totalItems)}</strong> dari <strong className="font-semibold text-foreground">{totalItems}</strong> data</span>
                                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ArrowDown className="mr-2 size-3.5 rotate-90" /> Sebelumnya</Button>
                                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Berikutnya <ArrowDown className="ml-2 size-3.5 -rotate-90" /></Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </div>
                    </main>
                </div>
            </div>

            {isCreateModalOpen && (
                <Dialog
                    open={isCreateModalOpen}
                    onOpenChange={(open) => {
                        setIsCreateModalOpen(open);
                        if (!open) {
                            resetCreate();
                        }
                    }}
                >
                    <DialogContent className="!w-[calc(100%-2rem)] !max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Tambah Customer</DialogTitle>
                            <DialogDescription className="sr-only">
                                Form untuk menambahkan customer baru
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            className="space-y-6"
                            onSubmit={handleCreateSubmit}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="nm_cs">Nama Customer</Label>
                                    <Input
                                        id="nm_cs"
                                        value={createData.nm_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'nm_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    {createErrors.nm_cs && (
                                        <p className="text-xs text-rose-600">
                                            {createErrors.nm_cs}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="kota_cs">Kota</Label>
                                    <Input
                                        id="kota_cs"
                                        value={createData.kota_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'kota_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="alamat_cs">Alamat</Label>
                                    <Input
                                        id="alamat_cs"
                                        value={createData.alamat_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'alamat_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="telp_cs">Telpon</Label>
                                    <Input
                                        id="telp_cs"
                                        value={createData.telp_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'telp_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fax_cs">Fax</Label>
                                    <Input
                                        id="fax_cs"
                                        value={createData.fax_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'fax_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="npwp_cs">NPWP</Label>
                                    <Input
                                        id="npwp_cs"
                                        value={createData.npwp_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'npwp_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-4 md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Attended (PIC PO)</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCreateData('Attnd', [
                                                    ...(Array.isArray(
                                                        createData.Attnd,
                                                    )
                                                        ? createData.Attnd
                                                        : []),
                                                    '',
                                                ])
                                            }
                                        >
                                            <Plus className="mr-2 h-3 w-3" />{' '}
                                            Tambah PIC
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {(Array.isArray(createData.Attnd)
                                            ? createData.Attnd
                                            : ['']
                                        ).map((pic, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2"
                                            >
                                                <Input
                                                    value={pic}
                                                    placeholder="Nama PIC"
                                                    onChange={(e) => {
                                                        const newAttnd = [
                                                            ...(Array.isArray(
                                                                createData.Attnd,
                                                            )
                                                                ? createData.Attnd
                                                                : ['']),
                                                        ];
                                                        newAttnd[index] =
                                                            e.target.value;
                                                        setCreateData(
                                                            'Attnd',
                                                            newAttnd,
                                                        );
                                                    }}
                                                />
                                                {index > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                        onClick={() => {
                                                            const newAttnd = [
                                                                ...(Array.isArray(
                                                                    createData.Attnd,
                                                                )
                                                                    ? createData.Attnd
                                                                    : []),
                                                            ];
                                                            newAttnd.splice(
                                                                index,
                                                                1,
                                                            );
                                                            setCreateData(
                                                                'Attnd',
                                                                newAttnd,
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="npwp1_cs">
                                        Alamat NPWP 1
                                    </Label>
                                    <Input
                                        id="npwp1_cs"
                                        value={createData.npwp1_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'npwp1_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="npwp2_cs">
                                        Alamat NPWP 2
                                    </Label>
                                    <Input
                                        id="npwp2_cs"
                                        value={createData.npwp2_cs}
                                        onChange={(event) =>
                                            setCreateData(
                                                'npwp2_cs',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <MenuAction
                                    action="create"
                                    type="submit"
                                    disabled={createProcessing}
                                >
                                    {createProcessing
                                        ? 'Menyimpan...'
                                        : 'Simpan Data'}
                                </MenuAction>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {isViewModalOpen && (
                <Dialog
                    open={isViewModalOpen}
                    onOpenChange={(open) => {
                        setIsViewModalOpen(open);
                        if (!open) {
                            setViewCustomer(null);
                            setViewError(null);
                            setViewTab('profil');
                            setDoHistory([]);
                            setDoSearchTerm('');
                            setDebouncedDoSearchTerm('');
                            setDoPageSize(5);
                            setDoCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!w-[calc(100%-2rem)] !max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Detail Customer</DialogTitle>
                            <DialogDescription className="sr-only">
                                Detail informasi dan riwayat DO customer
                            </DialogDescription>
                        </DialogHeader>
                        {viewLoading && (
                            <div className="flex flex-col gap-4 py-4">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        )}
                        {!viewLoading && viewError && (
                            <ErrorState error={viewError} />
                        )}
                        {!viewLoading && !viewError && !viewCustomer && (
                            <p className="text-sm text-muted-foreground">
                                Data customer tidak tersedia.
                            </p>
                        )}
                        {!viewLoading && viewCustomer && (
                            <div className="space-y-6 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            viewTab === 'profil'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => setViewTab('profil')}
                                    >
                                        Profil
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            viewTab === 'riwayat'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => setViewTab('riwayat')}
                                    >
                                        Riwayat DO
                                    </Button>
                                </div>
                                {viewTab === 'profil' ? (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Kode CS
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.kd_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Nama CS
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.nm_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="text-muted-foreground">
                                                Alamat
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.alamat_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Kota
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.kota_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Telpon
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.telp_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Fax
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.fax_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                NPWP
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.npwp_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Alamat NPWP 1
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.npwp1_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Alamat NPWP 2
                                            </span>
                                            <div className="font-medium">
                                                {renderValue(
                                                    viewCustomer.npwp2_cs,
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Attended
                                            </span>
                                            <div className="font-medium">
                                                {(() => {
                                                    let attnd =
                                                        viewCustomer.Attnd ||
                                                        [];
                                                    if (
                                                        typeof attnd ===
                                                        'string'
                                                    ) {
                                                        attnd = attnd
                                                            .split(',')
                                                            .map((s) =>
                                                                s.trim(),
                                                            )
                                                            .filter(Boolean);
                                                    }
                                                    if (
                                                        !Array.isArray(attnd) ||
                                                        attnd.length === 0
                                                    )
                                                        return '-';
                                                    if (attnd.length === 1)
                                                        return attnd[0];
                                                    return (
                                                        <ul className="list-inside list-disc">
                                                            {attnd.map(
                                                                (item, i) => (
                                                                    <li key={i}>
                                                                        {item}
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {viewTab === 'riwayat' ? (
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Riwayat Delivery Order
                                        </h3>
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <label>
                                                Tampilkan
                                                <select
                                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                                    value={
                                                        doPageSize === Infinity
                                                            ? 'all'
                                                            : doPageSize
                                                    }
                                                    onChange={(event) => {
                                                        const value =
                                                            event.target.value;
                                                        setDoPageSize(
                                                            value === 'all'
                                                                ? Infinity
                                                                : Number(value),
                                                        );
                                                        setDoCurrentPage(1);
                                                    }}
                                                >
                                                    <option value={5}>5</option>
                                                    <option value={10}>
                                                        10
                                                    </option>
                                                    <option value={25}>
                                                        25
                                                    </option>
                                                    <option value={50}>
                                                        50
                                                    </option>
                                                    <option value="all">
                                                        Semua
                                                    </option>
                                                </select>
                                            </label>
                                            <label>
                                                Cari DO
                                                <input
                                                    type="search"
                                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                                    placeholder="Cari nomor DO..."
                                                    value={doSearchTerm}
                                                    onChange={(event) => {
                                                        setDoSearchTerm(
                                                            event.target.value,
                                                        );
                                                        setDoCurrentPage(1);
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-muted-foreground">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">
                                                            Nomor DO
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Date
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Ref PO
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Aksi
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayedDoHistory.length ===
                                                        0 && (
                                                            <tr>
                                                                <td
                                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                                    colSpan={4}
                                                                >
                                                                    Data DO belum
                                                                    tersedia.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    {displayedDoHistory.map(
                                                        (item) => (
                                                            <tr
                                                                key={item.no_do}
                                                                className="border-t border-sidebar-border/70"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    {renderValue(
                                                                        item.no_do,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {formatDateId(
                                                                        item.date,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {renderValue(
                                                                        item.ref_po,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <ActionIconButton
                                                                        label="Cetak"
                                                                        asChild
                                                                    >
                                                                        <a
                                                                            href={`/marketing/delivery-order/${encodeURIComponent(
                                                                                item.no_do,
                                                                            )}/print`}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                        >
                                                                            <Printer className="h-4 w-4" />
                                                                        </a>
                                                                    </ActionIconButton>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {doPageSize !== Infinity &&
                                            doTotalItems > 0 && (
                                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                                    <span>
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setDoCurrentPage(
                                                                    (page) =>
                                                                        Math.max(
                                                                            1,
                                                                            page -
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                doCurrentPage ===
                                                                1
                                                            }
                                                        >
                                                            Sebelumnya
                                                        </Button>
                                                        <span>
                                                            Halaman{' '}
                                                            {doCurrentPage} dari{' '}
                                                            {doTotalPages}
                                                        </span>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setDoCurrentPage(
                                                                    (page) =>
                                                                        Math.min(
                                                                            doTotalPages,
                                                                            page +
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                doCurrentPage ===
                                                                doTotalPages
                                                            }
                                                        >
                                                            Berikutnya
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}

            {isEditModalOpen && (
                <Dialog
                    open={isEditModalOpen}
                    onOpenChange={(open) => {
                        setIsEditModalOpen(open);
                        if (!open) {
                            resetEdit();
                            setEditCustomerId(null);
                            setEditError(null);
                        }
                    }}
                >
                    <DialogContent className="!w-[calc(100%-2rem)] !max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Edit Customer</DialogTitle>
                            <DialogDescription className="sr-only">
                                Form untuk mengubah data customer
                            </DialogDescription>
                        </DialogHeader>
                        {editLoading && (
                            <div className="flex flex-col gap-4 py-4">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        )}
                        {!editLoading && editError && (
                            <ErrorState error={editError} />
                        )}
                        {!editLoading && !editError && (
                            <form
                                className="space-y-6"
                                onSubmit={(event) => event.preventDefault()}
                            >
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-nm_cs">
                                            Nama Customer
                                        </Label>
                                        <Input
                                            id="edit-nm_cs"
                                            value={editData.nm_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'nm_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        {editErrors.nm_cs && (
                                            <p className="text-xs text-rose-600">
                                                {editErrors.nm_cs}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-kota_cs">
                                            Kota
                                        </Label>
                                        <Input
                                            id="edit-kota_cs"
                                            value={editData.kota_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'kota_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="edit-alamat_cs">
                                            Alamat
                                        </Label>
                                        <Input
                                            id="edit-alamat_cs"
                                            value={editData.alamat_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'alamat_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-telp_cs">
                                            Telpon
                                        </Label>
                                        <Input
                                            id="edit-telp_cs"
                                            value={editData.telp_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'telp_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-fax_cs">Fax</Label>
                                        <Input
                                            id="edit-fax_cs"
                                            value={editData.fax_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'fax_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-npwp_cs">
                                            NPWP
                                        </Label>
                                        <Input
                                            id="edit-npwp_cs"
                                            value={editData.npwp_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'npwp_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-4 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Attended (PIC PO)</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setEditData('Attnd', [
                                                        ...(Array.isArray(
                                                            editData.Attnd,
                                                        )
                                                            ? editData.Attnd
                                                            : []),
                                                        '',
                                                    ])
                                                }
                                            >
                                                <Plus className="mr-2 h-3 w-3" />{' '}
                                                Tambah PIC
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {(Array.isArray(editData.Attnd)
                                                ? editData.Attnd
                                                : ['']
                                            ).map((pic, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Input
                                                        value={pic}
                                                        placeholder="Nama PIC"
                                                        onChange={(e) => {
                                                            const newAttnd = [
                                                                ...(Array.isArray(
                                                                    editData.Attnd,
                                                                )
                                                                    ? editData.Attnd
                                                                    : ['']),
                                                            ];
                                                            newAttnd[index] =
                                                                e.target.value;
                                                            setEditData(
                                                                'Attnd',
                                                                newAttnd,
                                                            );
                                                        }}
                                                    />
                                                    {index > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                            onClick={() => {
                                                                const newAttnd =
                                                                    [
                                                                        ...(Array.isArray(
                                                                            editData.Attnd,
                                                                        )
                                                                            ? editData.Attnd
                                                                            : []),
                                                                    ];
                                                                newAttnd.splice(
                                                                    index,
                                                                    1,
                                                                );
                                                                setEditData(
                                                                    'Attnd',
                                                                    newAttnd,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="edit-npwp1_cs">
                                            Alamat NPWP 1
                                        </Label>
                                        <Input
                                            id="edit-npwp1_cs"
                                            value={editData.npwp1_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'npwp1_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="edit-npwp2_cs">
                                            Alamat NPWP 2
                                        </Label>
                                        <Input
                                            id="edit-npwp2_cs"
                                            value={editData.npwp2_cs}
                                            onChange={(event) =>
                                                setEditData(
                                                    'npwp2_cs',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setIsEditModalOpen(false)
                                        }
                                    >
                                        Batal
                                    </Button>
                                    <MenuAction
                                        action="update"
                                        type="button"
                                        disabled={editProcessing}
                                        onClick={handleEditSubmit}
                                    >
                                        {editProcessing
                                            ? 'Menyimpan...'
                                            : 'Simpan Perubahan'}
                                    </MenuAction>
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

CustomerIndex.layout = (page) => {
    return <AppLayout children={page} breadcrumbs={breadcrumbs} />;
};
