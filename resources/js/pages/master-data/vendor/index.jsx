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
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { ActionIconButton } from '@/components/action-icon-button';
import { ErrorState } from '@/components/data-states/ErrorState';
import { confirmDelete } from '@/lib/confirm-delete';
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useEffect, useMemo, useState } from 'react';

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

const compareCode = (a, b) =>
    String(a ?? '').localeCompare(String(b ?? ''), 'id', {
        numeric: true,
        sensitivity: 'base',
    });

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

export default function VendorIndex({ vendors = [] }) {
    const [searchTerm, setSearchTerm] = useState('');
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

    const filteredVendors = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let items = [...vendors];
        items.sort((a, b) =>
            codeOrder === 'desc'
                ? compareCode(b.kd_vdr, a.kd_vdr)
                : compareCode(a.kd_vdr, b.kd_vdr)
        );
        if (!term) {
            return items;
        }
        return items.filter((item) =>
            String(item.nm_vdr ?? '').toLowerCase().includes(term)
        );
    }, [vendors, searchTerm, codeOrder]);

    const totalItems = filteredVendors.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedVendors = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredVendors;
        }
        const startIndex = (currentPage - 1) * pageSize;
        return filteredVendors.slice(startIndex, startIndex + pageSize);
    }, [filteredVendors, currentPage, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const filteredPoHistory = useMemo(() => {
        const term = poSearchTerm.trim().toLowerCase();
        if (!term) {
            return poHistory;
        }
        return poHistory.filter((item) =>
            String(item.no_po ?? '').toLowerCase().includes(term)
        );
    }, [poHistory, poSearchTerm]);

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

    const fetchVendorDetail = async (kdVendor) => {
        const response = await fetch(
            `/master-data/vendor/${encodeURIComponent(kdVendor)}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw await readApiError(response);
        return response.json();
    };

    const handleView = async (vendor) => {
        if (!vendor?.kd_vdr) {
            return;
        }
        setIsViewModalOpen(true);
        setViewLoading(true);
        setViewError(null);
        setViewVendor(null);
        setPoHistory([]);
        setPoSearchTerm('');
        setPoCurrentPage(1);
        setPoPageSize(5);
        try {
            const payload = await fetchVendorDetail(vendor.kd_vdr);
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
        setEditLoading(true);
        setEditError(null);
        setEditStep(1);
        setEditVendorId(vendor.kd_vdr);
        try {
            const payload = await fetchVendorDetail(vendor.kd_vdr);
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
            const payload = await fetchVendorDetail(vendor.kd_vdr);
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

        router.delete(`/master-data/vendor/${encodeURIComponent(vendor.kd_vdr)}`, {
            preserveScroll: true,
        });
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
                    <p className="text-xs text-rose-600">
                        {errors.almt_vdr}
                    </p>
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
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Data Vendor" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            Data Vendor
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Kelola daftar vendor.
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Data
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Vendor</CardTitle>
                        <CardDescription>
                            Cari dan kelola data vendor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-3">
                                <label>
                                    Tampilkan
                                    <select
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={
                                            pageSize === Infinity
                                                ? 'all'
                                                : pageSize
                                        }
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setPageSize(
                                                value === 'all'
                                                    ? Infinity
                                                    : Number(value)
                                            );
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
                                <label>
                                    Urut kode
                                    <select
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={codeOrder}
                                        onChange={(event) => {
                                            setCodeOrder(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="asc">
                                            Kode Vendor A-Z
                                        </option>
                                        <option value="desc">
                                            Kode Vendor Z-A
                                        </option>
                                    </select>
                                </label>
                            </div>
                            <label>
                                Cari Vendor
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari nama vendor..."
                                    value={searchTerm}
                                    onChange={(event) => {
                                        setSearchTerm(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </label>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-sidebar-border/70">
                            <div className="max-h-[65vh] overflow-auto overscroll-contain">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-background/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            No
                                        </th>
                                        <th className="sticky left-0 z-[2] w-[160px] bg-background/95 px-4 py-3 text-left">
                                            Kode Vendor
                                        </th>
                                        <th className="sticky left-[160px] z-[2] min-w-[240px] bg-background/95 px-4 py-3 text-left">
                                            Nama Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Alamat
                                        </th>
                                        <th className="sticky right-0 z-[2] bg-background/95 px-4 py-3 text-center">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedVendors.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                <div>Data vendor belum tersedia.</div>
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => setIsCreateModalOpen(true)}
                                                    >
                                                        Tambah Vendor
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {displayedVendors.map((item, index) => (
                                        <tr
                                            key={`${item.kd_vdr}-${index}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {(pageSize === Infinity
                                                    ? index
                                                    : (currentPage - 1) *
                                                          pageSize +
                                                      index) + 1}
                                            </td>
                                            <td className="sticky left-0 z-[1] w-[160px] bg-background/95 px-4 py-3 font-medium">
                                                {renderValue(item.kd_vdr)}
                                            </td>
                                            <td className="sticky left-[160px] z-[1] bg-background/95 px-4 py-3">
                                                {renderValue(item.nm_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.almt_vdr)}
                                            </td>
                                            <td className="sticky right-0 z-[1] bg-background/95 px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <ActionIconButton label="Detail" onClick={() => handleView(item)}>
                                                        <Eye className="h-4 w-4" />
                                                    </ActionIconButton>
                                                    <ActionIconButton label="Edit" onClick={() => handleEdit(item)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </ActionIconButton>
                                                    <ActionIconButton label="Hapus" onClick={() => handleDelete(item)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ActionIconButton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>

                        {pageSize !== Infinity && totalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (currentPage - 1) * pageSize + 1,
                                        totalItems
                                    )}
                                    -
                                    {Math.min(
                                        currentPage * pageSize,
                                        totalItems
                                    )}{' '}
                                    dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1)
                                            )
                                        }
                                        disabled={currentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {currentPage} dari {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.min(totalPages, page + 1)
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Berikutnya
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
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Tambah Vendor</DialogTitle>
                        </DialogHeader>
                        <form
                            className="space-y-6"
                            onSubmit={(event) => event.preventDefault()}
                        >
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>Step {createStep} dari 2</span>
                                <span>
                                    {createStep === 1
                                        ? 'Data Vendor'
                                        : 'Data Pajak & Bank'}
                                </span>
                            </div>
                            {createStep === 1
                                ? renderVendorStepOne(
                                      createData,
                                      setCreateData,
                                      createErrors
                                  )
                                : renderVendorStepTwo(createData, setCreateData)}
                            <div className="flex flex-wrap justify-end gap-2">
                                {createStep === 2 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCreateStep(1)}
                                    >
                                        Kembali
                                    </Button>
                                )}
                                {createStep === 1 ? (
                                    <Button
                                        type="button"
                                        onClick={() => setCreateStep(2)}
                                    >
                                        Lanjut
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        disabled={createProcessing}
                                        onClick={handleCreateSubmit}
                                    >
                                        {createProcessing
                                            ? 'Menyimpan...'
                                            : 'Simpan Data'}
                                    </Button>
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
                            setPoCurrentPage(1);
                            setPoPageSize(5);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Vendor</DialogTitle>
                        </DialogHeader>
                        {viewLoading && (
                            <p className="text-sm text-muted-foreground">
                                Memuat data vendor...
                            </p>
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
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={viewTab === 'profil' ? 'default' : 'outline'}
                                        onClick={() => setViewTab('profil')}
                                    >
                                        Profil
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={viewTab === 'riwayat' ? 'default' : 'outline'}
                                        onClick={() => setViewTab('riwayat')}
                                    >
                                        Riwayat PO
                                    </Button>
                                </div>
                                {viewTab === 'profil' ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <span className="text-muted-foreground">
                                            Kode Vendor
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.kd_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Nama Vendor
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.nm_vdr)}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-muted-foreground">
                                            Alamat
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.almt_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Telepon
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.telp_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Fax
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.fax_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Email
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.eml_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Attended
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.attn_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            NPWP
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.npwp_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Alamat NPWP 1
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.npwp1_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Alamat NPWP 2
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.npwp2_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Rekening 1
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.rek1_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Nama Bank 1
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.bank1_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Atas Nama 1
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.an1_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Rekening 2
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.rek2_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Nama Bank 2
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.bank2_vdr)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Atas Nama 2
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewVendor.an2_vdr)}
                                        </div>
                                    </div>
                                </div>
                                ) : null}

                                {viewTab === 'riwayat' ? (
                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">Riwayat PO</h3>
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
                                                            : Number(value)
                                                    );
                                                    setPoCurrentPage(1);
                                                }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value="all">Semua</option>
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
                                                        event.target.value
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
												<th className="px-4 py-3 text-left">
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
                                                            tersedia.
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
                                                                    item.no_po
                                                                )}
                                                            </td>
															<td className="px-4 py-3 text-right tabular-nums">
																{formatRupiah(
																	item.s_total
																)}
															</td>
															<td className="px-4 py-3 text-right tabular-nums">
																{formatRupiah(
																	item.h_ppn
																)}
															</td>
															<td className="px-4 py-3 text-right tabular-nums">
																{formatRupiah(
																	item.g_total
																)}
															</td>
																<td className="px-4 py-3">
																	<ActionIconButton label="Cetak" asChild>
																		<a
																			href={`/pembelian/purchase-order/${encodeURIComponent(
																				item.no_po
																			)}/print`}
																			target="_blank"
																			rel="noreferrer"
																		>
																			<Printer className="h-4 w-4" />
																		</a>
																	</ActionIconButton>
																</td>
														</tr>
													)
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
                                                        (poCurrentPage - 1) *
                                                            poPageSize +
                                                            1,
                                                        poTotalItems
                                                    )}
                                                    -
                                                    {Math.min(
                                                        poCurrentPage *
                                                            poPageSize,
                                                        poTotalItems
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
                                                                        page - 1
                                                                    )
                                                            )
                                                        }
                                                        disabled={
                                                            poCurrentPage === 1
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span>
                                                        Halaman {poCurrentPage}{' '}
                                                        dari {poTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setPoCurrentPage(
                                                                (page) =>
                                                                    Math.min(
                                                                        poTotalPages,
                                                                        page + 1
                                                                    )
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
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Vendor</DialogTitle>
                        </DialogHeader>
                        {editLoading && (
                            <p className="text-sm text-muted-foreground">
                                Memuat data vendor...
                            </p>
                        )}
                        {!editLoading && editError && (
                            <ErrorState error={editError} />
                        )}
                        {!editLoading && !editError && (
                            <form
                                className="space-y-6"
                                onSubmit={(event) => event.preventDefault()}
                            >
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Step {editStep} dari 2</span>
                                    <span>
                                        {editStep === 1
                                            ? 'Data Vendor'
                                            : 'Data Pajak & Bank'}
                                    </span>
                                </div>
                                {editStep === 1
                                    ? renderVendorStepOne(
                                          editData,
                                          setEditData,
                                          editErrors
                                      )
                                    : renderVendorStepTwo(
                                          editData,
                                          setEditData
                                      )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    {editStep === 2 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setEditStep(1)}
                                        >
                                            Kembali
                                        </Button>
                                    )}
                                    {editStep === 1 ? (
                                        <Button
                                            type="button"
                                            onClick={() => setEditStep(2)}
                                        >
                                            Lanjut
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            disabled={editProcessing}
                                            onClick={handleEditSubmit}
                                        >
                                            {editProcessing
                                                ? 'Menyimpan...'
                                                : 'Simpan Perubahan'}
                                        </Button>
                                    )}
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
