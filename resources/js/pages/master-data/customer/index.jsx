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
import { formatDateId } from '@/lib/formatters';
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Master Data', href: '/master-data/customer' },
    { title: 'Customer', href: '/master-data/customer' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const compareCode = (a, b) =>
    String(a ?? '').localeCompare(String(b ?? ''), 'id', {
        numeric: true,
        sensitivity: 'base',
    });

const initialFormState = {
    nm_cs: '',
    alamat_cs: '',
    kota_cs: '',
    telp_cs: '',
    fax_cs: '',
    npwp_cs: '',
    npwp1_cs: '',
    npwp2_cs: '',
    Attnd: '',
};

export default function CustomerIndex({ customers = [] }) {
    const [searchTerm, setSearchTerm] = useState('');
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

    const filteredCustomers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let items = [...customers];
        items.sort((a, b) =>
            codeOrder === 'desc'
                ? compareCode(b.kd_cs, a.kd_cs)
                : compareCode(a.kd_cs, b.kd_cs)
        );
        if (!term) {
            return items;
        }
        return items.filter((item) =>
            String(item.nm_cs ?? '').toLowerCase().includes(term)
        );
    }, [customers, searchTerm, codeOrder]);

    const totalItems = filteredCustomers.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedCustomers = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredCustomers;
        }
        const startIndex = (currentPage - 1) * pageSize;
        return filteredCustomers.slice(startIndex, startIndex + pageSize);
    }, [filteredCustomers, currentPage, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const filteredDoHistory = useMemo(() => {
        const term = doSearchTerm.trim().toLowerCase();
        if (!term) {
            return doHistory;
        }
        return doHistory.filter((item) =>
            String(item.no_do ?? '').toLowerCase().includes(term)
        );
    }, [doHistory, doSearchTerm]);

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

    const fetchCustomerDetail = async (kdCustomer) => {
        const response = await fetch(
            `/master-data/customer/${encodeURIComponent(kdCustomer)}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw await readApiError(response);
        return response.json();
    };

    const handleView = async (customer) => {
        if (!customer?.kd_cs) {
            return;
        }
        setIsViewModalOpen(true);
        setViewLoading(true);
        setViewError(null);
        setViewCustomer(null);
        setDoHistory([]);
        setDoSearchTerm('');
        setDoPageSize(5);
        setDoCurrentPage(1);
        try {
            const payload = await fetchCustomerDetail(customer.kd_cs);
            setViewCustomer(payload.customer ?? null);
            setDoHistory(payload.deliveryOrders ?? []);
        } catch (error) {
            setViewError(normalizeApiError(error, 'Gagal memuat data customer.'));
        } finally {
            setViewLoading(false);
        }
    };

    const handleEdit = async (customer) => {
        if (!customer?.kd_cs) {
            return;
        }
        setIsEditModalOpen(true);
        setEditLoading(true);
        setEditError(null);
        setEditCustomerId(customer.kd_cs);
        try {
            const payload = await fetchCustomerDetail(customer.kd_cs);
            setEditData({
                ...initialFormState,
                ...payload.customer,
            });
        } catch (error) {
            setEditError(normalizeApiError(error, 'Gagal memuat data customer.'));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (customer) => {
        if (!customer?.kd_cs) {
            return;
        }
        try {
            const payload = await fetchCustomerDetail(customer.kd_cs);
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

        router.delete(`/master-data/customer/${encodeURIComponent(customer.kd_cs)}`, {
            preserveScroll: true,
        });
    };

    const handleCreateSubmit = (event) => {
        event.preventDefault();
        post('/master-data/customer', {
            preserveScroll: true,
            onSuccess: () => {
                resetCreate();
                setIsCreateModalOpen(false);
            },
        });
    };

    const handleEditSubmit = (event) => {
        event.preventDefault();
        if (!editCustomerId) {
            return;
        }
        put(`/master-data/customer/${encodeURIComponent(editCustomerId)}`, {
            preserveScroll: true,
            onSuccess: () => {
                resetEdit();
                setEditCustomerId(null);
                setIsEditModalOpen(false);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Data Customer" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            Data Customer
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Kelola daftar customer.
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Data
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Customer</CardTitle>
                        <CardDescription>
                            Cari dan kelola data customer.
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
                                            Kode CS A-Z
                                        </option>
                                        <option value="desc">
                                            Kode CS Z-A
                                        </option>
                                    </select>
                                </label>
                            </div>
                            <label>
                                Cari Customer
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari nama customer..."
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
                                            Kode CS
                                        </th>
                                        <th className="sticky left-[160px] z-[2] min-w-[240px] bg-background/95 px-4 py-3 text-left">
                                            Nama CS
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
                                    {displayedCustomers.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                <div>Data customer belum tersedia.</div>
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => setIsCreateModalOpen(true)}
                                                    >
                                                        Tambah Customer
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {displayedCustomers.map((item, index) => (
                                        <tr
                                            key={`${item.kd_cs}-${index}`}
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
                                                {renderValue(item.kd_cs)}
                                            </td>
                                            <td className="sticky left-[160px] z-[1] bg-background/95 px-4 py-3">
                                                {renderValue(item.nm_cs)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.alamat_cs)}
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
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Tambah Customer</DialogTitle>
                        </DialogHeader>
                        <form
                            className="space-y-4"
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
                                                event.target.value
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
                                                event.target.value
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
                                                event.target.value
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
                                                event.target.value
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
                                                event.target.value
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
                                                event.target.value
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="Attnd">Attended</Label>
                                    <Input
                                        id="Attnd"
                                        value={createData.Attnd}
                                        onChange={(event) =>
                                            setCreateData(
                                                'Attnd',
                                                event.target.value
                                            )
                                        }
                                    />
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
                                                event.target.value
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
                                                event.target.value
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
                                <Button type="submit" disabled={createProcessing}>
                                    {createProcessing
                                        ? 'Menyimpan...'
                                        : 'Simpan Data'}
                                </Button>
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
                            setDoPageSize(5);
                            setDoCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Customer</DialogTitle>
                        </DialogHeader>
                        {viewLoading && (
                            <p className="text-sm text-muted-foreground">
                                Memuat data customer...
                            </p>
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
                                        Riwayat DO
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <span className="text-muted-foreground">
                                            Kode CS
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.kd_cs)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Nama CS
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.nm_cs)}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-muted-foreground">
                                            Alamat
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(
                                                viewCustomer.alamat_cs
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Kota
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.kota_cs)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Telpon
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.telp_cs)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Fax
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.fax_cs)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            NPWP
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.npwp_cs)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Alamat NPWP 1
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(
                                                viewCustomer.npwp1_cs
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Alamat NPWP 2
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(
                                                viewCustomer.npwp2_cs
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Attended
                                        </span>
                                        <div className="font-medium">
                                            {renderValue(viewCustomer.Attnd)}
                                        </div>
                                    </div>
                                </div>

                                {viewTab === 'riwayat' ? (
                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">Riwayat Delivery Order</h3>
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
                                                            : Number(value)
                                                    );
                                                    setDoCurrentPage(1);
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
                                            Cari DO
                                            <input
                                                type="search"
                                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                                placeholder="Cari nomor DO..."
                                                value={doSearchTerm}
                                                onChange={(event) => {
                                                    setDoSearchTerm(
                                                        event.target.value
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
                                                                    item.no_do
                                                                )}
                                                            </td>
															<td className="px-4 py-3">
																{formatDateId(item.date)}
															</td>
                                                            <td className="px-4 py-3">
                                                                {renderValue(
                                                                    item.ref_po
                                                                )}
                                                            </td>
															<td className="px-4 py-3">
																<ActionIconButton label="Cetak" asChild>
																	<a
																		href={`/marketing/delivery-order/${encodeURIComponent(
																			item.no_do
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

	                                    {doPageSize !== Infinity &&
	                                        doTotalItems > 0 && (
	                                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                                <span>
                                                    Menampilkan{' '}
                                                    {Math.min(
                                                        (doCurrentPage - 1) *
                                                            doPageSize +
                                                            1,
                                                        doTotalItems
                                                    )}
                                                    -
                                                    {Math.min(
                                                        doCurrentPage *
                                                            doPageSize,
                                                        doTotalItems
                                                    )}{' '}
                                                    dari {doTotalItems} data
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
                                                                        page - 1
                                                                    )
                                                            )
                                                        }
                                                        disabled={
                                                            doCurrentPage === 1
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span>
                                                        Halaman {doCurrentPage}{' '}
                                                        dari {doTotalPages}
                                                    </span>
	                                                    <Button
	                                                        variant="outline"
	                                                        size="sm"
	                                                        onClick={() =>
	                                                            setDoCurrentPage(
	                                                                (page) =>
	                                                                    Math.min(
	                                                                        doTotalPages,
	                                                                        page + 1
	                                                                    )
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
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Customer</DialogTitle>
                        </DialogHeader>
                        {editLoading && (
                            <p className="text-sm text-muted-foreground">
                                Memuat data customer...
                            </p>
                        )}
                        {!editLoading && editError && (
                            <ErrorState error={editError} />
                        )}
                        {!editLoading && !editError && (
                            <form
                                className="space-y-4"
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
                                                    event.target.value
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
                                                    event.target.value
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
                                                    event.target.value
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
                                                    event.target.value
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
                                                    event.target.value
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
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-Attnd">
                                            Attended
                                        </Label>
                                        <Input
                                            id="edit-Attnd"
                                            value={editData.Attnd}
                                            onChange={(event) =>
                                                setEditData(
                                                    'Attnd',
                                                    event.target.value
                                                )
                                            }
                                        />
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
                                                    event.target.value
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
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsEditModalOpen(false)}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={editProcessing}
                                        onClick={handleEditSubmit}
                                    >
                                        {editProcessing
                                            ? 'Menyimpan...'
                                            : 'Simpan Perubahan'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
