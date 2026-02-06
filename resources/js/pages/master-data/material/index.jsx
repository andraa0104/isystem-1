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
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { confirmDelete } from '@/lib/confirm-delete';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Master Data', href: '/master-data/material' },
    { title: 'Material', href: '/master-data/material' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const compareCode = (a, b) =>
    String(a ?? '').localeCompare(String(b ?? ''), 'id', {
        numeric: true,
        sensitivity: 'base',
    });

export default function MaterialIndex({ materials = [] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [stockFilter, setStockFilter] = useState('all');
    const [codeOrder, setCodeOrder] = useState('asc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);

    const { data, setData, post, processing, reset, errors } = useForm({
        material: '',
        unit: '',
        stok: 0,
        remark: '',
    });
    const {
        data: editData,
        setData: setEditData,
        put,
        processing: editProcessing,
        reset: resetEdit,
        errors: editErrors,
    } = useForm({
        material: '',
        unit: '',
        stok: 0,
        remark: '',
    });

    const filteredMaterials = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let items = [...materials];

        if (stockFilter === 'top') {
            items.sort(
                (a, b) => Number(b.stok ?? 0) - Number(a.stok ?? 0)
            );
        } else if (stockFilter === 'low') {
            items = items
                .filter((item) => Number(item.stok ?? 0) > 0)
                .sort(
                    (a, b) => Number(a.stok ?? 0) - Number(b.stok ?? 0)
                );
        } else if (stockFilter === 'empty') {
            items = items.filter((item) => Number(item.stok ?? 0) <= 0);
        } else {
            items.sort((a, b) =>
                codeOrder === 'desc'
                    ? compareCode(b.kd_material, a.kd_material)
                    : compareCode(a.kd_material, b.kd_material)
            );
        }

        if (!term) {
            return items;
        }

        return items.filter((item) =>
            String(item.material ?? '').toLowerCase().includes(term)
        );
    }, [materials, searchTerm, stockFilter, codeOrder]);

    const totalItems = filteredMaterials.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedMaterials = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredMaterials;
        }
        const startIndex = (currentPage - 1) * pageSize;
        return filteredMaterials.slice(startIndex, startIndex + pageSize);
    }, [filteredMaterials, currentPage, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleSubmit = (event) => {
        event.preventDefault();
        post('/master-data/material', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setIsModalOpen(false);
            },
        });
    };

    const handleEdit = (material) => {
        setEditingMaterial(material);
        setEditData({
            material: material.material ?? '',
            unit: material.unit ?? '',
            stok: material.stok ?? 0,
            remark: material.remark ?? '',
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = (event) => {
        event.preventDefault();
        if (!editingMaterial?.kd_material) {
            return;
        }
        put(`/master-data/material/${encodeURIComponent(editingMaterial.kd_material)}`, {
            preserveScroll: true,
            onSuccess: () => {
                resetEdit();
                setEditingMaterial(null);
                setIsEditModalOpen(false);
            },
        });
    };

    const handleDelete = async (material) => {
        if (!material?.kd_material) {
            return;
        }
        const ok = await confirmDelete({
            title: 'Hapus material?',
            text: `Kode material: ${material.kd_material}`,
        });
        if (!ok) return;
        router.delete(`/master-data/material/${encodeURIComponent(material.kd_material)}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Data Material" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            Data Material
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Kelola daftar material produksi.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <a
                                href="/master-data/material/export"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Export Data
                            </a>
                        </Button>
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Data
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Material</CardTitle>
                        <CardDescription>
                            Tampilkan dan cari data material.
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
                                    Filter stok
                                    <select
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={stockFilter}
                                        onChange={(event) => {
                                            setStockFilter(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">Semua data</option>
                                        <option value="top">
                                            Stok terbanyak
                                        </option>
                                        <option value="low">
                                            Stok sedikit (&gt; 0)
                                        </option>
                                        <option value="empty">Stok kosong</option>
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
                                        disabled={stockFilter !== 'all'}
                                    >
                                        <option value="asc">
                                            Kode Material A-Z
                                        </option>
                                        <option value="desc">
                                            Kode Material Z-A
                                        </option>
                                    </select>
                                </label>
                            </div>
                            <label>
                                Cari Material
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari nama material..."
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
                                            Kode Material
                                        </th>
                                        <th className="sticky left-[160px] z-[2] min-w-[240px] bg-background/95 px-4 py-3 text-left">
                                            Nama Material
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Satuan
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Stok
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Harga
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Remark
                                        </th>
                                        <th className="sticky right-0 z-[2] bg-background/95 px-4 py-3 text-center">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
									{displayedMaterials.length === 0 && (
										<tr>
											<td
												className="px-4 py-6 text-center text-muted-foreground"
												colSpan={7}
											>
												<div>Data material belum tersedia.</div>
												<div className="mt-3">
													<Button
														type="button"
														size="sm"
														onClick={() => setIsModalOpen(true)}
													>
														Tambah Material
													</Button>
												</div>
											</td>
										</tr>
									)}
                                    {displayedMaterials.map((item, index) => (
                                        <tr
                                            key={`${item.kd_material}-${index}`}
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
                                                {renderValue(item.kd_material)}
                                            </td>
                                            <td className="sticky left-[160px] z-[1] bg-background/95 px-4 py-3">
                                                {renderValue(item.material)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.unit)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {renderValue(item.stok)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {renderValue(item.harga)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.remark)}
                                            </td>
                                            <td className="sticky right-0 z-[1] bg-background/95 px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
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

            {isModalOpen && (
                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            reset();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Tambah Material</DialogTitle>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor="material">Nama Material</Label>
                                <Input
                                    id="material"
                                    value={data.material}
                                    onChange={(event) =>
                                        setData('material', event.target.value)
                                    }
                                    placeholder="Masukkan nama material"
                                />
                                {errors.material && (
                                    <p className="text-xs text-rose-600">
                                        {errors.material}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit">Satuan</Label>
                                <Input
                                    id="unit"
                                    value={data.unit}
                                    onChange={(event) =>
                                        setData('unit', event.target.value)
                                    }
                                    placeholder="Contoh: pcs"
                                />
                                {errors.unit && (
                                    <p className="text-xs text-rose-600">
                                        {errors.unit}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stok">Stok</Label>
                                <Input
                                    id="stok"
                                    type="number"
                                    min="0"
                                    value={data.stok}
                                    onChange={(event) =>
                                        setData('stok', event.target.value)
                                    }
                                />
                                {errors.stok && (
                                    <p className="text-xs text-rose-600">
                                        {errors.stok}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="remark">Remark</Label>
                                <Input
                                    id="remark"
                                    value={data.remark}
                                    onChange={(event) =>
                                        setData('remark', event.target.value)
                                    }
                                    placeholder="Catatan tambahan"
                                />
                                {errors.remark && (
                                    <p className="text-xs text-rose-600">
                                        {errors.remark}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing
                                        ? 'Menyimpan...'
                                        : 'Simpan Data'}
                                </Button>
                            </div>
                        </form>
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
                            setEditingMaterial(null);
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Material</DialogTitle>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={handleUpdate}>
                            <div className="space-y-2">
                                <Label htmlFor="edit-material">
                                    Nama Material
                                </Label>
                                <Input
                                    id="edit-material"
                                    value={editData.material}
                                    onChange={(event) =>
                                        setEditData(
                                            'material',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Masukkan nama material"
                                />
                                {editErrors.material && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.material}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-unit">Satuan</Label>
                                <Input
                                    id="edit-unit"
                                    value={editData.unit}
                                    onChange={(event) =>
                                        setEditData('unit', event.target.value)
                                    }
                                    placeholder="Contoh: pcs"
                                />
                                {editErrors.unit && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.unit}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-stok">Stok</Label>
                                <Input
                                    id="edit-stok"
                                    type="number"
                                    min="0"
                                    value={editData.stok}
                                    disabled
                                />
                                {editErrors.stok && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.stok}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-remark">Remark</Label>
                                <Input
                                    id="edit-remark"
                                    value={editData.remark}
                                    onChange={(event) =>
                                        setEditData(
                                            'remark',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Catatan tambahan"
                                />
                                {editErrors.remark && (
                                    <p className="text-xs text-rose-600">
                                        {editErrors.remark}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={editProcessing}>
                                    {editProcessing
                                        ? 'Menyimpan...'
                                        : 'Simpan Perubahan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
