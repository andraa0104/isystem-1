import { ActionIconButton } from '@/components/action-icon-button';
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
import { confirmDelete } from '@/lib/confirm-delete';
import { Head, router, useForm } from '@inertiajs/react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

const formatNumber = (value) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) {
        return '0';
    }

    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.trunc(number));
};

const toNumber = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
};

const stockRows = (material) => [
    {
        label: 'G1',
        stok: material?.stok_g1,
        harga: material?.harga_stokg1,
        kategori: material?.kategori_stok1,
    },
    {
        label: 'G2',
        stok: material?.stok_g2,
        harga: material?.harga_stokg2,
        kategori: material?.kategori_stok2,
    },
    {
        label: 'G3',
        stok: material?.stok_g3,
        harga: material?.harga_stokg3,
        kategori: material?.kategori_stok3,
    },
    {
        label: 'G4',
        stok: material?.stok_g4,
        harga: material?.harga_stokg4,
        kategori: material?.kategori_stok4,
    },
];

const movementCategories = [
    { key: 'fast', title: 'Fast Moving', matcher: 'fast' },
    { key: 'slow', title: 'Slow Moving', matcher: 'slow' },
    { key: 'dead', title: 'Dead Stok', matcher: 'dead' },
];

const materialMovementRows = (material) =>
    stockRows(material).map((row) => ({
        kd_material: material?.kd_material,
        material: material?.material,
        gudang: row.label,
        stok: toNumber(row.stok),
        harga: toNumber(row.harga),
        kategori: row.kategori,
        total: toNumber(row.stok) * toNumber(row.harga),
    }));

export default function MaterialIndex({ materials }) {
    // --- States Utama ---
    const [materialsList, setMaterialsList] = useState([]);
    const [tableLoading, setTableLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [stockFilter, setStockFilter] = useState('all');
    const [codeOrder, setCodeOrder] = useState('asc');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [viewingMaterial, setViewingMaterial] = useState(null);
    const [movementModal, setMovementModal] = useState(null);
    const [movementSearchTerm, setMovementSearchTerm] = useState('');
    const [movementPageSize, setMovementPageSize] = useState(5);
    const [movementCurrentPage, setMovementCurrentPage] = useState(1);

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

    // --- Pemisahan Frontend & Backend (Initial Fetch) ---
    useEffect(() => {
        // Jika data dari backend belum ada (karena Inertia::lazy)
        if (!materials || materials.length === 0) {
            setTableLoading(true);
            router.reload({
                only: ['materials'],
                preserveState: true,
                onSuccess: (page) => {
                    setMaterialsList(page.props.materials || []);
                },
                onFinish: () => {
                    setTableLoading(false);
                },
            });
        } else {
            setMaterialsList(materials);
            setTableLoading(false);
        }
    }, [materials]);

    // --- Debounce Input Pencarian (Optimasi Filter Tabel) ---
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Pemrosesan Data List ---
    const filteredMaterials = useMemo(() => {
        const term = debouncedSearchTerm.trim().toLowerCase();
        let items = [...materialsList];

        if (stockFilter === 'top') {
            items.sort((a, b) => Number(b.stok ?? 0) - Number(a.stok ?? 0));
        } else if (stockFilter === 'low') {
            items = items
                .filter((item) => Number(item.stok ?? 0) > 0)
                .sort((a, b) => Number(a.stok ?? 0) - Number(b.stok ?? 0));
        } else if (stockFilter === 'empty') {
            items = items.filter((item) => Number(item.stok ?? 0) <= 0);
        } else {
            items.sort((a, b) =>
                codeOrder === 'desc'
                    ? compareCode(b.kd_material, a.kd_material)
                    : compareCode(a.kd_material, b.kd_material),
            );
        }

        if (!term) {
            return items;
        }

        return items.filter((item) => {
            const values = [item.kd_material, item.material, item.unit];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term),
            );
        });
    }, [materialsList, debouncedSearchTerm, stockFilter, codeOrder]);

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

    const movementData = useMemo(() => {
        const base = movementCategories.reduce((acc, category) => {
            acc[category.key] = {
                ...category,
                count: 0,
                total: 0,
                rows: [],
                warehouses: [],
            };
            return acc;
        }, {});

        materialsList.forEach((material) => {
            const grouped = movementCategories.reduce((acc, category) => {
                acc[category.key] = null;
                return acc;
            }, {});

            materialMovementRows(material).forEach((row) => {
                const kategori = String(row.kategori ?? '').toLowerCase();
                const category = movementCategories.find((item) =>
                    kategori.includes(item.matcher),
                );

                if (!category) {
                    return;
                }

                if (!grouped[category.key]) {
                    grouped[category.key] = {
                        kd_material: material?.kd_material,
                        material: material?.material,
                        stocks: {},
                        prices: {},
                        total: 0,
                    };
                }

                grouped[category.key].stocks[row.gudang] = row.stok;
                grouped[category.key].prices[row.gudang] = row.harga;
                grouped[category.key].total += row.total;
            });

            Object.entries(grouped).forEach(([key, row]) => {
                if (!row) {
                    return;
                }

                base[key].count += 1;
                base[key].total += row.total;
                base[key].rows.push(row);
                Object.keys(row.stocks).forEach((gudang) => {
                    if (!base[key].warehouses.includes(gudang)) {
                        base[key].warehouses.push(gudang);
                    }
                });
            });
        });

        Object.values(base).forEach((category) => {
            category.warehouses.sort((a, b) => a.localeCompare(b));
        });

        return base;
    }, [materialsList]);

    const selectedMovement = movementModal ? movementData[movementModal] : null;
    const movementWarehouses = selectedMovement?.warehouses ?? [];
    const movementRows = useMemo(() => {
        const term = movementSearchTerm.trim().toLowerCase();
        const rows = selectedMovement?.rows ?? [];
        const filteredRows = term
            ? rows.filter((row) =>
                  [row.kd_material, row.material].some((value) =>
                      String(value ?? '').toLowerCase().includes(term),
                  ),
              )
            : rows;

        return [...filteredRows].sort((a, b) =>
            compareCode(a.kd_material, b.kd_material),
        );
    }, [movementSearchTerm, selectedMovement]);

    const movementTotalItems = movementRows.length;
    const movementTotalPages = useMemo(() => {
        return Math.max(1, Math.ceil(movementTotalItems / movementPageSize));
    }, [movementPageSize, movementTotalItems]);

    const displayedMovementRows = useMemo(() => {
        const startIndex = (movementCurrentPage - 1) * movementPageSize;
        return movementRows.slice(startIndex, startIndex + movementPageSize);
    }, [movementCurrentPage, movementPageSize, movementRows]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (movementCurrentPage > movementTotalPages) {
            setMovementCurrentPage(movementTotalPages);
        }
    }, [movementCurrentPage, movementTotalPages]);

    // --- Handlers ---
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
        // Form Edit langsung mengambil data dari props tabel, sehingga tidak butuh loading/fetch API
        setEditingMaterial(material);
        setEditData({
            material: material.material ?? '',
            unit: material.unit ?? '',
            stok: material.stok ?? 0,
            remark: material.kategori_stok1 ?? '',
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = (event) => {
        event.preventDefault();
        if (!editingMaterial?.kd_material) {
            return;
        }
        put(
            `/master-data/material/${encodeURIComponent(editingMaterial.kd_material)}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    resetEdit();
                    setEditingMaterial(null);
                    setIsEditModalOpen(false);
                },
            },
        );
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
        router.delete(
            `/master-data/material/${encodeURIComponent(material.kd_material)}`,
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <>
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

                <div className="grid gap-4 md:grid-cols-3">
                    {movementCategories.map((category) => {
                        const item = movementData[category.key];

                        return (
                            <Card
                                key={category.key}
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer transition-colors hover:bg-muted/40"
                                onClick={() => {
                                    setMovementModal(category.key);
                                    setMovementSearchTerm('');
                                    setMovementPageSize(5);
                                    setMovementCurrentPage(1);
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                    ) {
                                        event.preventDefault();
                                        setMovementModal(category.key);
                                        setMovementSearchTerm('');
                                        setMovementPageSize(5);
                                        setMovementCurrentPage(1);
                                    }
                                }}
                            >
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {category.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-2xl font-semibold tabular-nums">
                                        {formatNumber(item?.count)}
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">
                                            Total harga stok
                                        </div>
                                        <div className="font-semibold tabular-nums">
                                            Rp {formatNumber(item?.total)}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
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
                                                    : Number(value),
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
                                        <option value="empty">
                                            Stok kosong
                                        </option>
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
                                <table className="w-full table-auto text-sm">
                                    <thead className="sticky top-0 z-10 bg-background/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                        <tr>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-left">
                                                No
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-left">
                                                Kode Material
                                            </th>
                                            <th className="w-full whitespace-nowrap px-2 py-2 text-left">
                                                Nama Material
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-left">
                                                Satuan
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-right">
                                                Total Stok
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-center">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableLoading ? (
                                            <tr>
                                                <td className="px-4 py-4" colSpan={6}>
                                                    <div className="flex flex-col gap-3">
                                                        <Skeleton className="h-6 w-full opacity-60" />
                                                        <Skeleton className="h-6 w-full opacity-60" />
                                                        <Skeleton className="h-6 w-full opacity-60" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : displayedMaterials.length === 0 ? (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={6}
                                                >
                                                    <div>
                                                        Data material belum
                                                        tersedia.
                                                    </div>
                                                    <div className="mt-3">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() =>
                                                                setIsModalOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            Tambah Material
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedMaterials.map(
                                                (item, index) => (
                                                    <tr
                                                        key={`${item.kd_material}-${index}`}
                                                        className="border-t border-sidebar-border/70"
                                                    >
                                                        <td className="w-1 whitespace-nowrap px-2 py-2">
                                                            {(pageSize === Infinity
                                                                ? index
                                                                : (currentPage -
                                                                      1) *
                                                                      pageSize +
                                                                  index) + 1}
                                                        </td>
                                                        <td className="w-1 whitespace-nowrap px-2 py-2 font-medium">
                                                            {renderValue(
                                                                item.kd_material,
                                                            )}
                                                        </td>
                                                        <td className="w-full min-w-0 px-2 py-2">
                                                            <div
                                                                className="truncate"
                                                                title={item.material}
                                                            >
                                                                {renderValue(
                                                                    item.material,
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="w-1 whitespace-nowrap px-2 py-2">
                                                            {renderValue(item.unit)}
                                                        </td>
                                                        <td className="w-1 whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                                            {formatNumber(item.stok)}
                                                        </td>
                                                        <td className="w-1 whitespace-nowrap px-2 py-2">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <ActionIconButton
                                                                    label="Lihat detail stok"
                                                                    onClick={() =>
                                                                        setViewingMaterial(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </ActionIconButton>
                                                                <ActionIconButton
                                                                    label="Edit"
                                                                    onClick={() =>
                                                                        handleEdit(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </ActionIconButton>
                                                                <ActionIconButton
                                                                    label="Hapus"
                                                                    onClick={() =>
                                                                        handleDelete(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </ActionIconButton>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )
                                        )}
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
                                        totalItems,
                                    )}
                                    -
                                    {Math.min(
                                        currentPage * pageSize,
                                        totalItems,
                                    )}{' '}
                                    dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1),
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
                                                Math.min(totalPages, page + 1),
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

            <Dialog
                open={Boolean(viewingMaterial)}
                onOpenChange={(open) => {
                    if (!open) {
                        setViewingMaterial(null);
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detail Stok Material</DialogTitle>
                        <DialogDescription className="sr-only">
                            Detail stok material per gudang.
                        </DialogDescription>
                    </DialogHeader>

                    {viewingMaterial && (
                        <div className="space-y-4 text-sm">
                            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-3">
                                <div>
                                    <div className="text-muted-foreground">
                                        Kode Material
                                    </div>
                                    <div className="font-semibold">
                                        {renderValue(
                                            viewingMaterial.kd_material,
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        Nama Material
                                    </div>
                                    <div className="font-semibold">
                                        {renderValue(viewingMaterial.material)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        Satuan
                                    </div>
                                    <div className="font-semibold">
                                        {renderValue(viewingMaterial.unit)}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-md border">
                                <table className="w-full table-auto text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-left">
                                                Gudang
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-right">
                                                Stok
                                            </th>
                                            <th className="w-1 whitespace-nowrap px-2 py-2 text-right">
                                                Harga
                                            </th>
                                            <th className="w-full whitespace-nowrap px-2 py-2 text-left">
                                                Kategori
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockRows(viewingMaterial).map(
                                            (row) => (
                                                <tr
                                                    key={row.label}
                                                    className="border-t border-sidebar-border/70"
                                                >
                                                    <td className="w-1 whitespace-nowrap px-2 py-2 font-medium">
                                                        {row.label}
                                                    </td>
                                                    <td className="w-1 whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                                        {formatNumber(row.stok)}
                                                    </td>
                                                    <td className="w-1 whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                                        {formatNumber(row.harga)}
                                                    </td>
                                                    <td className="w-full min-w-0 px-2 py-2">
                                                        <div
                                                            className="truncate"
                                                            title={renderValue(
                                                                row.kategori,
                                                            )}
                                                        >
                                                            {renderValue(
                                                                row.kategori,
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(movementModal)}
                onOpenChange={(open) => {
                    if (!open) {
                        setMovementModal(null);
                        setMovementSearchTerm('');
                        setMovementPageSize(5);
                        setMovementCurrentPage(1);
                    }
                }}
            >
                <DialogContent className="w-[calc(100vw-2rem)] max-w-none p-4 sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-4rem)] lg:max-w-[1800px]">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedMovement?.title ?? 'Kategori Material'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Daftar material berdasarkan kategori stok.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
                            <div>
                                <div className="text-sm text-muted-foreground">
                                    Jumlah data
                                </div>
                                <div className="text-xl font-semibold tabular-nums">
                                    {formatNumber(selectedMovement?.count)}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">
                                    Total harga stok
                                </div>
                                <div className="text-xl font-semibold tabular-nums">
                                    Rp {formatNumber(selectedMovement?.total)}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={movementPageSize}
                                    onChange={(event) => {
                                        setMovementPageSize(
                                            Number(event.target.value),
                                        );
                                        setMovementCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari kode atau material..."
                                    value={movementSearchTerm}
                                    onChange={(event) => {
                                        setMovementSearchTerm(
                                            event.target.value,
                                        );
                                        setMovementCurrentPage(1);
                                    }}
                                />
                            </label>
                        </div>

                        <div className="overflow-hidden rounded-md border">
                            <div className="max-h-[64vh] overflow-auto overscroll-contain">
                                <table className="w-full min-w-[1100px] table-fixed text-sm">
                                    <thead className="sticky top-0 z-10 bg-background/95 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                        <tr>
                                            <th className="w-14 whitespace-nowrap px-3 py-2 text-left">
                                                No
                                            </th>
                                            <th className="w-36 whitespace-nowrap px-3 py-2 text-left">
                                                Kode Material
                                            </th>
                                            <th className="min-w-0 px-3 py-2 text-left">
                                                Nama Material
                                            </th>
                                            {movementWarehouses.flatMap(
                                                (gudang) => [
                                                    <th
                                                        key={`${gudang}-stok`}
                                                        className="w-24 whitespace-nowrap px-3 py-2 text-right"
                                                    >
                                                        Stok {gudang}
                                                    </th>,
                                                    <th
                                                        key={`${gudang}-harga`}
                                                        className="w-32 whitespace-nowrap px-3 py-2 text-right"
                                                    >
                                                        Harga {gudang}
                                                    </th>,
                                                ],
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedMovementRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={
                                                        3 +
                                                        movementWarehouses.length *
                                                            2
                                                    }
                                                >
                                                    Data material tidak tersedia.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedMovementRows.map(
                                                (row, index) => (
                                                    <tr
                                                        key={`${row.kd_material}-${index}`}
                                                        className="border-t border-sidebar-border/70"
                                                    >
                                                        <td className="w-14 whitespace-nowrap px-3 py-2">
                                                            {(movementCurrentPage -
                                                                1) *
                                                                movementPageSize +
                                                                index +
                                                                1}
                                                        </td>
                                                        <td className="w-36 whitespace-nowrap px-3 py-2 font-medium">
                                                            {renderValue(
                                                                row.kd_material,
                                                            )}
                                                        </td>
                                                        <td className="min-w-0 px-3 py-2">
                                                            <div
                                                                className="truncate"
                                                                title={
                                                                    row.material
                                                                }
                                                            >
                                                                {renderValue(
                                                                    row.material,
                                                                )}
                                                            </div>
                                                        </td>
                                                        {movementWarehouses.flatMap(
                                                            (gudang) => [
                                                                <td
                                                                    key={`${gudang}-stok`}
                                                                    className="w-24 whitespace-nowrap px-3 py-2 text-right tabular-nums"
                                                                >
                                                                    {row.stocks?.[
                                                                        gudang
                                                                    ] ===
                                                                    undefined
                                                                        ? '-'
                                                                        : formatNumber(
                                                                              row
                                                                                  .stocks[
                                                                                  gudang
                                                                              ],
                                                                          )}
                                                                </td>,
                                                                <td
                                                                    key={`${gudang}-harga`}
                                                                    className="w-32 whitespace-nowrap px-3 py-2 text-right tabular-nums"
                                                                >
                                                                    {row.prices?.[
                                                                        gudang
                                                                    ] ===
                                                                    undefined
                                                                        ? '-'
                                                                        : `Rp ${formatNumber(
                                                                              row
                                                                                  .prices[
                                                                                  gudang
                                                                              ],
                                                                          )}`}
                                                                </td>,
                                                            ],
                                                        )}
                                                    </tr>
                                                ),
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {movementTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (movementCurrentPage - 1) *
                                            movementPageSize +
                                            1,
                                        movementTotalItems,
                                    )}
                                    -
                                    {Math.min(
                                        movementCurrentPage * movementPageSize,
                                        movementTotalItems,
                                    )}{' '}
                                    dari {movementTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setMovementCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={movementCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {movementCurrentPage} dari{' '}
                                        {movementTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setMovementCurrentPage((page) =>
                                                Math.min(
                                                    movementTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            movementCurrentPage ===
                                            movementTotalPages
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
                            <DialogDescription className="sr-only">
                                Form untuk menambah material baru
                            </DialogDescription>
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
                            <DialogDescription className="sr-only">
                                Form untuk mengubah data material
                            </DialogDescription>
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
                                            event.target.value,
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
                                            event.target.value,
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
        </>
    );
}

MaterialIndex.layout = (page) => {
    return <AppLayout children={page} breadcrumbs={breadcrumbs} />;
};
