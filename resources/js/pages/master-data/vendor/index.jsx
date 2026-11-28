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
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileText,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    Truck,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Master Data', href: '/master-data/vendor' },
    { title: 'Vendor', href: '/master-data/vendor' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    return `Rp ${Number(value).toLocaleString('id-ID')}`;
};

const initialFormState = {
    kd_vdr: '',
    nm_vdr: '',
    almt_vdr: '',
    telp_vdr: '',
    fax_vdr: '',
    eml_vdr: '',
    attn_vdr: '',
    npwp_vdr: '',
    npwp1_vdr: '',
    npwp2_vdr: '',
    rek1_vdr: '',
    bank1_vdr: '',
    an1_vdr: '',
    rek2_vdr: '',
    bank2_vdr: '',
    an2_vdr: '',
};

// Global cache untuk menyimpan data pre-fetch modal
const vendorDetailCache = {};

export default function VendorIndex() {
    // --- States ---

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [codeOrder, setCodeOrder] = useState('asc');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewVendor, setViewVendor] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState(null);
    const [viewTab, setViewTab] = useState('profil'); // profil | riwayat

    const [poHistory, setPoHistory] = useState([]);
    const [poSearchTerm, setPoSearchTerm] = useState('');
    const [debouncedPoSearchTerm, setDebouncedPoSearchTerm] = useState('');
    const [poPageSize, setPoPageSize] = useState(5);
    const [poCurrentPage, setPoCurrentPage] = useState(1);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editStep, setEditStep] = useState(1);
    const [editVendorId, setEditVendorId] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);

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

    const {
        rows: vendorsList,
        total: totalItems,
        loading: tableLoading,
        error: tableError,
        refresh: refreshRows,
    } = useMasterDataRows('/master-data/vendor/rows', {
        search: debouncedSearchTerm.trim(),
        page: currentPage,
        per_page: pageSize === Infinity ? 'all' : pageSize,
        order: codeOrder,
    });

    // --- Debounce untuk input pencarian (Optimasi Loading Filter) ---
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedPoSearchTerm(poSearchTerm), 300);
        return () => clearTimeout(timer);
    }, [poSearchTerm]);

    // --- Pemrosesan Data List ---
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedVendors = vendorsList;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const filteredPoHistory = useMemo(() => {
        const term = debouncedPoSearchTerm.trim().toLowerCase();
        if (!term) {
            return poHistory;
        }
        return poHistory.filter((item) =>
            String(item.no_po ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [poHistory, debouncedPoSearchTerm]);

    const poTotalItems = filteredPoHistory.length;
    const poTotalPages = useMemo(() => {
        if (poPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(poTotalItems / poPageSize));
    }, [poPageSize, poTotalItems]);

    const displayedPoHistory = useMemo(() => {
        if (poPageSize === Infinity) {
            return filteredPoHistory;
        }
        const startIndex = (poCurrentPage - 1) * poPageSize;
        return filteredPoHistory.slice(startIndex, startIndex + poPageSize);
    }, [filteredPoHistory, poCurrentPage, poPageSize]);

    useEffect(() => {
        if (poCurrentPage > poTotalPages) {
            setPoCurrentPage(poTotalPages);
        }
    }, [poCurrentPage, poTotalPages]);

    // --- Logika Preload & Modal API ---
    const fetchVendorDetail = async (kdVendor) => {
        const response = await fetch(
            `/master-data/vendor/${encodeURIComponent(kdVendor)}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw await readApiError(response);
        return response.json();
    };

    // Preload akan dipanggil saat user meletakkan kursor (hover) di atas tombol Detail/Edit
    const handlePreload = (kd_vdr) => {
        if (!kd_vdr || vendorDetailCache[kd_vdr]) return;

        fetchVendorDetail(kd_vdr)
            .then((data) => {
                vendorDetailCache[kd_vdr] = data;
            })
            .catch(() => { }); // Abaikan error prefetch, biarkan ditangani saat diklik
    };

    const handleView = async (vendor) => {
        if (!vendor?.kd_vdr) {
            return;
        }
        setIsViewModalOpen(true);
        setViewError(null);
        setViewTab('profil');
        setPoSearchTerm('');
        setPoCurrentPage(1);
        setPoPageSize(5);

        // Cek Cache terlebih dahulu agar instan
        if (vendorDetailCache[vendor.kd_vdr]) {
            const payload = vendorDetailCache[vendor.kd_vdr];
            setViewVendor(payload.vendor ?? null);
            setPoHistory(payload.purchaseOrders ?? []);
            setViewLoading(false);
            return;
        }

        setViewLoading(true);
        setPoHistory([]);
        setViewVendor(null);

        try {
            const payload = await fetchVendorDetail(vendor.kd_vdr);
            vendorDetailCache[vendor.kd_vdr] = payload; // Simpan ke cache
            setViewVendor(payload.vendor ?? null);
            setPoHistory(payload.purchaseOrders ?? []);
        } catch (error) {
            setViewError(normalizeApiError(error, 'Gagal memuat data vendor.'));
        } finally {
            setViewLoading(false);
        }
    };

    const handleEdit = async (vendor) => {
        if (!vendor?.kd_vdr) {
            return;
        }
        setIsEditModalOpen(true);
        setEditError(null);
        setEditStep(1);
        setEditVendorId(vendor.kd_vdr);

        // Cek Cache terlebih dahulu agar instan
        if (vendorDetailCache[vendor.kd_vdr]) {
            const payload = vendorDetailCache[vendor.kd_vdr];
            setEditData({
                ...initialFormState,
                ...payload.vendor,
            });
            setEditLoading(false);
            return;
        }

        setEditLoading(true);
        try {
            const payload = await fetchVendorDetail(vendor.kd_vdr);
            vendorDetailCache[vendor.kd_vdr] = payload; // Simpan ke cache
            setEditData({
                ...initialFormState,
                ...payload.vendor,
            });
        } catch (error) {
            setEditError(normalizeApiError(error, 'Gagal memuat data vendor.'));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (vendor) => {
        if (!vendor?.kd_vdr) {
            return;
        }
        try {
            // Gunakan Cache jika tersedia untuk pengecekan validasi hapus
            let payload = vendorDetailCache[vendor.kd_vdr];
            if (!payload) {
                payload = await fetchVendorDetail(vendor.kd_vdr);
                vendorDetailCache[vendor.kd_vdr] = payload;
            }

            const poCount = Array.isArray(payload?.purchaseOrders)
                ? payload.purchaseOrders.length
                : 0;
            if (poCount > 0) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Tidak bisa dihapus',
                    text: `Vendor ini sudah dipakai di ${poCount} PO.`,
                });
                return;
            }
        } catch (error) {
            const normalized = normalizeApiError(
                error,
                'Gagal memeriksa relasi transaksi vendor.',
            );
            await Swal.fire({
                icon: 'error',
                title:
                    normalized.summary ||
                    'Gagal memeriksa relasi transaksi vendor.',
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
            title: 'Hapus data vendor?',
            text: 'Data yang dihapus tidak dapat dikembalikan.',
        });
        if (!ok) return;

        router.delete(
            `/master-data/vendor/${encodeURIComponent(vendor.kd_vdr)}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    refreshRows();
                    // Hapus data dari cache jika berhasil dihapus dari server
                    delete vendorDetailCache[vendor.kd_vdr];
                }
            },
        );
    };

    const handleCreateSubmit = (event) => {
        event.preventDefault();
        if (createStep === 1) {
            setCreateStep(2);
            return;
        }
        post('/master-data/vendor', {
            preserveScroll: true,
            onSuccess: () => {
                refreshRows();
                resetCreate();
                setCreateStep(1);
                setIsCreateModalOpen(false);
            },
        });
    };

    const handleEditSubmit = (event) => {
        event.preventDefault();
        if (!editVendorId) {
            return;
        }
        put(`/master-data/vendor/${encodeURIComponent(editVendorId)}`, {
            preserveScroll: true,
            onSuccess: () => {
                refreshRows();
                // Update cache dengan data baru
                if (vendorDetailCache[editVendorId]) {
                    vendorDetailCache[editVendorId].vendor = { ...editData };
                }
                resetEdit();
                setEditVendorId(null);
                setEditStep(1);
                setIsEditModalOpen(false);
            },
        });
    };

    const renderVendorStepOne = (formData, setFormData, errors) => (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nm_vdr">Nama Vendor</Label>
                <Input
                    id="nm_vdr"
                    value={formData.nm_vdr}
                    onChange={(event) =>
                        setFormData('nm_vdr', event.target.value)
                    }
                />
                {errors.nm_vdr && (
                    <p className="text-xs text-rose-600">{errors.nm_vdr}</p>
                )}
            </div>
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="almt_vdr">Alamat</Label>
                <Input
                    id="almt_vdr"
                    value={formData.almt_vdr}
                    onChange={(event) =>
                        setFormData('almt_vdr', event.target.value)
                    }
                />
                {errors.almt_vdr && (
                    <p className="text-xs text-rose-600">{errors.almt_vdr}</p>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="telp_vdr">Telepon</Label>
                <Input
                    id="telp_vdr"
                    value={formData.telp_vdr}
                    onChange={(event) =>
                        setFormData('telp_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="fax_vdr">Fax</Label>
                <Input
                    id="fax_vdr"
                    value={formData.fax_vdr}
                    onChange={(event) =>
                        setFormData('fax_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="eml_vdr">Email</Label>
                <Input
                    id="eml_vdr"
                    value={formData.eml_vdr}
                    onChange={(event) =>
                        setFormData('eml_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="attn_vdr">Attended</Label>
                <Input
                    id="attn_vdr"
                    value={formData.attn_vdr}
                    onChange={(event) =>
                        setFormData('attn_vdr', event.target.value)
                    }
                />
            </div>
        </div>
    );

    const renderVendorStepTwo = (formData, setFormData) => (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="npwp_vdr">NPWP</Label>
                <Input
                    id="npwp_vdr"
                    value={formData.npwp_vdr}
                    onChange={(event) =>
                        setFormData('npwp_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="npwp1_vdr">Alamat NPWP 1</Label>
                <Input
                    id="npwp1_vdr"
                    value={formData.npwp1_vdr}
                    onChange={(event) =>
                        setFormData('npwp1_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="npwp2_vdr">Alamat NPWP 2</Label>
                <Input
                    id="npwp2_vdr"
                    value={formData.npwp2_vdr}
                    onChange={(event) =>
                        setFormData('npwp2_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="rek1_vdr">Rekening 1</Label>
                <Input
                    id="rek1_vdr"
                    value={formData.rek1_vdr}
                    onChange={(event) =>
                        setFormData('rek1_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="bank1_vdr">Nama Bank 1</Label>
                <Input
                    id="bank1_vdr"
                    value={formData.bank1_vdr}
                    onChange={(event) =>
                        setFormData('bank1_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="an1_vdr">Atas Nama 1</Label>
                <Input
                    id="an1_vdr"
                    value={formData.an1_vdr}
                    onChange={(event) =>
                        setFormData('an1_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="rek2_vdr">Rekening 2</Label>
                <Input
                    id="rek2_vdr"
                    value={formData.rek2_vdr}
                    onChange={(event) =>
                        setFormData('rek2_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="bank2_vdr">Nama Bank 2</Label>
                <Input
                    id="bank2_vdr"
                    value={formData.bank2_vdr}
                    onChange={(event) =>
                        setFormData('bank2_vdr', event.target.value)
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="an2_vdr">Atas Nama 2</Label>
                <Input
                    id="an2_vdr"
                    value={formData.an2_vdr}
                    onChange={(event) =>
                        setFormData('an2_vdr', event.target.value)
                    }
                />
            </div>
        </div>
    );

    return (
        <>
            <Head title="Data Vendor" />

            {/* ── Error Banner ───────────────────────────────────────────────── */}
            {tableError && (
                <div role="alert" className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400">
                    {tableError}
                    <Button type="button" variant="outline" size="sm" onClick={refreshRows}>Coba lagi</Button>
                </div>
            )}

            <div className="flex flex-col gap-6 p-6">

                {/* ── Page Header ─────────────────────────────────────────────── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-lg">
                    {/* Background decorative orbs */}
                    <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-64 rounded-full bg-teal-400/20 blur-2xl" />

                    <div className="relative flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25 transition-transform duration-200 hover:scale-105">
                                <Truck className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white">
                                    Master Vendor
                                </h1>
                                <p className="mt-0.5 text-sm text-emerald-100">
                                    Kelola dan pantau seluruh data vendor perusahaan
                                </p>
                            </div>
                        </div>
                        <MenuAction
                            action="create"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-white/20 text-white border-white/30 hover:bg-white/30 transition-all duration-200"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Vendor
                        </MenuAction>
                    </div>

                    {/* Stat chips */}
                    <div className="relative mt-4 flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/20">
                            <Users className="h-3.5 w-3.5 text-emerald-200" />
                            <span>{totalItems} Vendor Terdaftar</span>
                        </div>
                    </div>
                </div>

                {/* ── Main Table Card ─────────────────────────────────────────── */}
                <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md">
                    <CardHeader className="border-b border-border/60 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    Daftar Vendor
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Cari, filter, dan kelola data vendor
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4">
                        {/* ── Filter Bar ─────────────────────────────────────── */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Per-page select */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <label className="flex items-center gap-1.5">
                                        Tampilkan
                                        <select
                                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm transition-colors hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            value={pageSize === Infinity ? 'all' : pageSize}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setPageSize(value === 'all' ? Infinity : Number(value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value="all">Semua</option>
                                        </select>
                                    </label>
                                </div>
                                {/* Sort select */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <label className="flex items-center gap-1.5">
                                        Urut
                                        <select
                                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm transition-colors hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            value={codeOrder}
                                            onChange={(event) => {
                                                setCodeOrder(event.target.value);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value="asc">Kode A-Z</option>
                                            <option value="desc">Kode Z-A</option>
                                        </select>
                                    </label>
                                </div>
                            </div>

                            {/* Search input */}
                            <div className="relative flex items-center">
                                <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="search"
                                    className="w-64 rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm transition-all hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 md:w-72"
                                    placeholder="Cari nama vendor..."
                                    value={searchTerm}
                                    onChange={(event) => {
                                        setSearchTerm(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                        </div>

                        {/* ── Table ──────────────────────────────────────────── */}
                        <div className="overflow-hidden rounded-xl border border-border">
                            <div className="max-h-[65vh] overflow-auto overscroll-contain">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">No</th>
                                            <th className="sticky left-0 z-[2] w-[160px] bg-muted/80 px-4 py-3 text-left font-semibold">
                                                Kode Vendor
                                            </th>
                                            <th className="sticky left-[160px] z-[2] min-w-[240px] bg-muted/80 px-4 py-3 text-left font-semibold">
                                                Nama Vendor
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold">Alamat</th>
                                            <th className="sticky right-0 z-[2] bg-muted/80 px-4 py-3 text-center font-semibold">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableLoading ? (
                                            <tr>
                                                <td className="px-4 py-6" colSpan={5}>
                                                    <div className="flex flex-col gap-3">
                                                        <Skeleton className="h-8 w-full" />
                                                        <Skeleton className="h-8 w-full opacity-70" />
                                                        <Skeleton className="h-8 w-full opacity-50" />
                                                        <Skeleton className="h-8 w-3/4 opacity-30" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : displayedVendors.length === 0 ? (
                                            <tr>
                                                <td className="px-4 py-14 text-center" colSpan={5}>
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                                            <Truck className="h-7 w-7 text-muted-foreground/50" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">
                                                            Data vendor belum tersedia atau tidak ditemukan
                                                        </p>
                                                        <MenuAction
                                                            action="create"
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => setIsCreateModalOpen(true)}
                                                        >
                                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                            Tambah Vendor
                                                        </MenuAction>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedVendors.map((item, index) => (
                                                <tr
                                                    key={`${item.kd_vdr}-${index}`}
                                                    className="border-b border-border/60 transition-colors duration-150 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10"
                                                >
                                                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                        {(pageSize === Infinity
                                                            ? index
                                                            : (currentPage - 1) * pageSize + index) + 1}
                                                    </td>
                                                    <td className="sticky left-0 z-[1] w-[160px] bg-background px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50">
                                                            {renderValue(item.kd_vdr)}
                                                        </span>
                                                    </td>
                                                    <td className="sticky left-[160px] z-[1] bg-background px-4 py-3 font-medium text-foreground">
                                                        {renderValue(item.nm_vdr)}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            {item.almt_vdr && <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                                                            {renderValue(item.almt_vdr)}
                                                        </div>
                                                    </td>
                                                    <td className="sticky right-0 z-[1] bg-background px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <ActionIconButton
                                                                label="Detail"
                                                                onMouseEnter={() => handlePreload(item.kd_vdr)}
                                                                onClick={() => handleView(item)}
                                                                className="h-7 w-7 p-0 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-900/30 dark:hover:text-sky-300"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </ActionIconButton>
                                                            <MenuAction
                                                                action="update"
                                                                as={ActionIconButton}
                                                                label="Edit"
                                                                onMouseEnter={() => handlePreload(item.kd_vdr)}
                                                                onClick={() => handleEdit(item)}
                                                                className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </MenuAction>
                                                            <MenuAction
                                                                action="delete"
                                                                as={ActionIconButton}
                                                                label="Hapus"
                                                                onMouseEnter={() => handlePreload(item.kd_vdr)}
                                                                onClick={() => handleDelete(item)}
                                                                className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/30"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </MenuAction>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Pagination ─────────────────────────────────────── */}
                        {pageSize !== Infinity && totalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm text-muted-foreground">
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 px-2.5 transition-all duration-150"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 px-2.5 transition-all duration-150"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.min(totalPages, page + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Berikutnya
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {isCreateModalOpen && (
                <Dialog
                    open={isCreateModalOpen}
                    onOpenChange={(open) => {
                        setIsCreateModalOpen(open);
                        if (!open) {
                            resetCreate();
                            setCreateStep(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                    <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Tambah Vendor
                            </DialogTitle>
                        </DialogHeader>
                        <form
                            className="space-y-6"
                            onSubmit={(event) => event.preventDefault()}
                        >
                            {/* Step indicator */}
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
                                    createStep === 1
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                )}>1</div>
                                <div className={cn('h-0.5 flex-1 rounded-full transition-all duration-300', createStep >= 2 ? 'bg-emerald-500' : 'bg-muted')} />
                                <div className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
                                    createStep === 2
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-muted text-muted-foreground'
                                )}>2</div>
                                <span className="ml-2 text-sm text-muted-foreground">
                                    {createStep === 1 ? 'Data Vendor' : 'Data Pajak & Bank'}
                                </span>
                            </div>
                            {createStep === 1
                                ? renderVendorStepOne(
                                    createData,
                                    setCreateData,
                                    createErrors,
                                )
                                : renderVendorStepTwo(
                                    createData,
                                    setCreateData,
                                )}
                            <div className="flex flex-wrap justify-end gap-2">
                                {createStep === 2 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCreateStep(1)}
                                    >
                                        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                        Kembali
                                    </Button>
                                )}
                                {createStep === 1 ? (
                                    <Button
                                        type="button"
                                        onClick={() => setCreateStep(2)}
                                    >
                                        Lanjut
                                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                ) : (
                                    <MenuAction
                                        action="create"
                                        type="button"
                                        disabled={createProcessing}
                                        onClick={handleCreateSubmit}
                                    >
                                        {createProcessing
                                            ? 'Menyimpan...'
                                            : 'Simpan Data'}
                                    </MenuAction>
                                )}
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
                            setViewVendor(null);
                            setViewError(null);
                            setViewTab('profil');
                            setPoHistory([]);
                            setPoSearchTerm('');
                            setDebouncedPoSearchTerm('');
                            setPoCurrentPage(1);
                            setPoPageSize(5);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
                                    <Eye className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                </div>
                                Detail Vendor
                            </DialogTitle>
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
                        {!viewLoading && !viewError && !viewVendor && (
                            <p className="text-sm text-muted-foreground">
                                Data vendor tidak tersedia.
                            </p>
                        )}
                        {!viewLoading && viewVendor && (
                            <div className="space-y-6 text-sm">
                                {/* Modern Tab Bar */}
                                <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setViewTab('profil')}
                                        className={cn(
                                            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                                            viewTab === 'profil'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <Building2 className="h-3.5 w-3.5" />
                                        Profil
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewTab('riwayat')}
                                        className={cn(
                                            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                                            viewTab === 'riwayat'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        Riwayat PO
                                    </button>
                                </div>
                                {viewTab === 'profil' ? (
                                    <div className="space-y-4">
                                        {/* Vendor Identity Card */}
                                        <div className="rounded-xl border border-border bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-4 dark:from-emerald-900/10 dark:to-teal-900/10">
                                            <div className="mb-3 flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                                                    <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground">{renderValue(viewVendor.nm_vdr)}</div>
                                                    <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                        {renderValue(viewVendor.kd_vdr)}
                                                    </span>
                                                </div>
                                            </div>
                                            {viewVendor.almt_vdr && (
                                                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                    {viewVendor.almt_vdr}
                                                </div>
                                            )}
                                        </div>

                                        {/* Contact Info */}
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg border border-border bg-background p-3">
                                                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                    <Phone className="h-3 w-3" /> Telepon
                                                </div>
                                                <div className="font-medium">{renderValue(viewVendor.telp_vdr)}</div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-background p-3">
                                                <div className="mb-1 text-xs font-medium text-muted-foreground">Fax</div>
                                                <div className="font-medium">{renderValue(viewVendor.fax_vdr)}</div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-background p-3">
                                                <div className="mb-1 text-xs font-medium text-muted-foreground">Email</div>
                                                <div className="font-medium">{renderValue(viewVendor.eml_vdr)}</div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-background p-3">
                                                <div className="mb-1 text-xs font-medium text-muted-foreground">Attended</div>
                                                <div className="font-medium">{renderValue(viewVendor.attn_vdr)}</div>
                                            </div>
                                        </div>

                                        {/* Tax Info */}
                                        <div className="rounded-xl border border-border bg-background p-4">
                                            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informasi Pajak</h4>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <div className="text-xs text-muted-foreground">NPWP</div>
                                                    <div className="font-medium">{renderValue(viewVendor.npwp_vdr)}</div>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <div className="text-xs text-muted-foreground">Alamat NPWP 1</div>
                                                    <div className="font-medium">{renderValue(viewVendor.npwp1_vdr)}</div>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <div className="text-xs text-muted-foreground">Alamat NPWP 2</div>
                                                    <div className="font-medium">{renderValue(viewVendor.npwp2_vdr)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bank Info */}
                                        <div className="rounded-xl border border-border bg-background p-4">
                                            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informasi Rekening Bank</h4>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                                                    <div className="text-xs font-semibold text-muted-foreground">Rekening 1</div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">No. Rekening</div>
                                                        <div className="font-medium tabular-nums">{renderValue(viewVendor.rek1_vdr)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Bank</div>
                                                        <div className="font-medium">{renderValue(viewVendor.bank1_vdr)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Atas Nama</div>
                                                        <div className="font-medium">{renderValue(viewVendor.an1_vdr)}</div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                                                    <div className="text-xs font-semibold text-muted-foreground">Rekening 2</div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">No. Rekening</div>
                                                        <div className="font-medium tabular-nums">{renderValue(viewVendor.rek2_vdr)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Bank</div>
                                                        <div className="font-medium">{renderValue(viewVendor.bank2_vdr)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Atas Nama</div>
                                                        <div className="font-medium">{renderValue(viewVendor.an2_vdr)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {viewTab === 'riwayat' ? (
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Riwayat PO
                                        </h3>
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <label>
                                                Tampilkan
                                                <select
                                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                                    value={
                                                        poPageSize === Infinity
                                                            ? 'all'
                                                            : poPageSize
                                                    }
                                                    onChange={(event) => {
                                                        const value =
                                                            event.target.value;
                                                        setPoPageSize(
                                                            value === 'all'
                                                                ? Infinity
                                                                : Number(value),
                                                        );
                                                        setPoCurrentPage(1);
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
                                                Cari PO
                                                <input
                                                    type="search"
                                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                                    placeholder="Cari nomor PO..."
                                                    value={poSearchTerm}
                                                    onChange={(event) => {
                                                        setPoSearchTerm(
                                                            event.target.value,
                                                        );
                                                        setPoCurrentPage(1);
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-muted-foreground">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">
                                                            Nomor PO
                                                        </th>
                                                        <th className="px-4 py-3 text-right">
                                                            Sub Total
                                                        </th>
                                                        <th className="px-4 py-3 text-right">
                                                            PPN
                                                        </th>
                                                        <th className="px-4 py-3 text-right">
                                                            Grand Total
                                                        </th>
                                                        <th className="px-4 py-3 text-center">
                                                            Aksi
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayedPoHistory.length ===
                                                        0 && (
                                                            <tr>
                                                                <td
                                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                                    colSpan={5}
                                                                >
                                                                    Data PO belum
                                                                    tersedia atau tidak ditemukan.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    {displayedPoHistory.map(
                                                        (item) => (
                                                            <tr
                                                                key={item.no_po}
                                                                className="border-t border-sidebar-border/70"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    {renderValue(
                                                                        item.no_po,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right tabular-nums">
                                                                    {formatRupiah(
                                                                        item.s_total,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right tabular-nums">
                                                                    {formatRupiah(
                                                                        item.h_ppn,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right tabular-nums">
                                                                    {formatRupiah(
                                                                        item.g_total,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center justify-center">
                                                                        <ActionIconButton
                                                                            label="Cetak"
                                                                            asChild
                                                                        >
                                                                            <a
                                                                                href={`/pembelian/purchase-order/${encodeURIComponent(
                                                                                    item.no_po,
                                                                                )}/print`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                            >
                                                                                <Printer className="h-4 w-4" />
                                                                            </a>
                                                                        </ActionIconButton>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {poPageSize !== Infinity &&
                                            poTotalItems > 0 && (
                                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                                    <span>
                                                        Menampilkan{' '}
                                                        {Math.min(
                                                            (poCurrentPage -
                                                                1) *
                                                            poPageSize +
                                                            1,
                                                            poTotalItems,
                                                        )}
                                                        -
                                                        {Math.min(
                                                            poCurrentPage *
                                                            poPageSize,
                                                            poTotalItems,
                                                        )}{' '}
                                                        dari {poTotalItems} data
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setPoCurrentPage(
                                                                    (page) =>
                                                                        Math.max(
                                                                            1,
                                                                            page -
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                poCurrentPage ===
                                                                1
                                                            }
                                                        >
                                                            Sebelumnya
                                                        </Button>
                                                        <span>
                                                            Halaman{' '}
                                                            {poCurrentPage} dari{' '}
                                                            {poTotalPages}
                                                        </span>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setPoCurrentPage(
                                                                    (page) =>
                                                                        Math.min(
                                                                            poTotalPages,
                                                                            page +
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                poCurrentPage ===
                                                                poTotalPages
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
                            setEditVendorId(null);
                            setEditStep(1);
                            setEditError(null);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                    <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                Edit Vendor
                            </DialogTitle>
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
                                {/* Step indicator */}
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
                                        editStep === 1
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    )}>1</div>
                                    <div className={cn('h-0.5 flex-1 rounded-full transition-all duration-300', editStep >= 2 ? 'bg-amber-500' : 'bg-muted')} />
                                    <div className={cn(
                                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
                                        editStep === 2
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'bg-muted text-muted-foreground'
                                    )}>2</div>
                                    <span className="ml-2 text-sm text-muted-foreground">
                                        {editStep === 1 ? 'Data Vendor' : 'Data Pajak & Bank'}
                                    </span>
                                </div>
                                {editStep === 1
                                    ? renderVendorStepOne(
                                        editData,
                                        setEditData,
                                        editErrors,
                                    )
                                    : renderVendorStepTwo(
                                        editData,
                                        setEditData,
                                    )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    {editStep === 2 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setEditStep(1)}
                                        >
                                            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                            Kembali
                                        </Button>
                                    )}
                                    {editStep === 1 ? (
                                        <Button
                                            type="button"
                                            onClick={() => setEditStep(2)}
                                        >
                                            Lanjut
                                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    ) : (
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
                                    )}
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

VendorIndex.layout = (page) => {
    return <AppLayout children={page} breadcrumbs={breadcrumbs} />;
};
