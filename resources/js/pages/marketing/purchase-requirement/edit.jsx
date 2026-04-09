import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Edit PR', href: '/marketing/purchase-requirement' },
];

const toDateInputValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const match = trimmed.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
        if (match) {
            const [, day, month, year] = match;
            return `${year}-${month}-${day}`;
        }
        if (trimmed.length >= 10) {
            return trimmed.slice(0, 10);
        }
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
        return String(value);
    }
    return `${number.toFixed(2)}%`;
};

const calculateMargin = (priceInPo, priceEstimate) => {
    const estimate = parseNumber(priceEstimate);
    const po = parseNumber(priceInPo);
    if (!estimate) return '';
    const margin = ((po - estimate) / estimate) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qty, priceEstimate) => {
    const total = parseNumber(qty) * parseNumber(priceEstimate);
    return total ? Math.round(total).toString() : '';
};

export default function PurchaseRequirementEdit({
    purchaseRequirement,
    purchaseRequirementDetails = [],
}) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingDetailNo, setEditingDetailNo] = useState(null);
    const [editingDraft, setEditingDraft] = useState(null);
    const [savingMaterialId, setSavingMaterialId] = useState(null);
    const [deletingMaterialId, setDeletingMaterialId] = useState(null);

    const detailDateSource = purchaseRequirementDetails?.[0]?.date;

    const [formData, setFormData] = useState({
        date: toDateInputValue(detailDateSource),
        refPo: purchaseRequirement?.ref_po ?? '',
        forCustomer: purchaseRequirement?.for_customer ?? '',
        payment: purchaseRequirement?.payment ?? 'Cash Trans',
    });

    useEffect(() => {
        const detailDate = purchaseRequirementDetails?.[0]?.date;
        setFormData({
            date: toDateInputValue(detailDate),
            refPo: purchaseRequirement?.ref_po ?? '',
            forCustomer: purchaseRequirement?.for_customer ?? '',
            payment: purchaseRequirement?.payment ?? 'Cash Trans',
        });
    }, [purchaseRequirement, purchaseRequirementDetails]);

    const [materialItems, setMaterialItems] = useState(
        (purchaseRequirementDetails ?? []).map((item, index) => ({
            id: item.no ?? `${Date.now()}-${index}`,
            detailNo: item.no ?? null,
            kodeMaterial: item.kd_material ?? '',
            namaMaterial: item.material ?? '',
            stok: item.stok ?? '',
            qty: item.sisa_pr ?? item.qty ?? '', // Sisa PR
            qtyDetail: item.qty ?? 0, // tb_detailpr.qty
            satuan: item.unit ?? '',
            priceEstimate: item.unit_price ?? '',
            totalPrice: item.total_price ?? '',
            priceInPo: item.price_po ?? '',
            margin: item.margin ?? '',
            remark: item.renmark ?? '',
            qtyPo: parseNumber(item.qty_po),
        })),
    );

    // Material Selection Modal States
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState(null);

    const materialTotalPages =
        materialPageSize === Infinity
            ? 1
            : Math.ceil(materialTotal / materialPageSize);

    const loadMaterials = useCallback(async () => {
        setMaterialLoading(true);
        setMaterialError(null);
        try {
            const params = new URLSearchParams({
                search: materialSearchTerm,
                per_page:
                    materialPageSize === Infinity ? 'all' : materialPageSize,
                page: materialCurrentPage,
            });
            const response = await fetch(
                `/marketing/purchase-requirement/api/materials?${params}`,
            );
            if (!response.ok) throw new Error('Failed to fetch materials');
            const data = await response.json();
            setMaterialList(data.materials || []);
            setMaterialTotal(data.total || 0);
        } catch (error) {
            setMaterialError(error.message);
        } finally {
            setMaterialLoading(false);
        }
    }, [materialSearchTerm, materialPageSize, materialCurrentPage]);

    useEffect(() => {
        if (isMaterialModalOpen) {
            loadMaterials();
        }
    }, [isMaterialModalOpen, loadMaterials]);

    // List-level search & pagination (Step 2 existing items)
    const [listSearch, setListSearch] = useState('');
    const [listPageSize, setListPageSize] = useState(5);
    const [listCurrentPage, setListCurrentPage] = useState(1);

    const filteredItems = materialItems.filter((item) => {
        const q = listSearch.toLowerCase();
        return (
            !q ||
            item.kodeMaterial.toLowerCase().includes(q) ||
            item.namaMaterial.toLowerCase().includes(q)
        );
    });

    const listTotalPages =
        listPageSize === Infinity
            ? 1
            : Math.ceil(filteredItems.length / listPageSize);

    const paginatedItems =
        listPageSize === Infinity
            ? filteredItems
            : filteredItems.slice(
                  (listCurrentPage - 1) * listPageSize,
                  listCurrentPage * listPageSize,
              );

    // Reset page when search changes
    useEffect(() => {
        setListCurrentPage(1);
    }, [listSearch, listPageSize]);

    const openEditCard = (item) => {
        setEditingDetailNo(item.detailNo);
        setEditingDraft({
            kodeMaterial: item.kodeMaterial ?? '',
            namaMaterial: item.namaMaterial ?? '',
            stok: item.stok ?? '',
            qtyDetail: item.qtyDetail ?? 0, // tb_detailpr.qty (derived)
            originalQtyDetail: item.qtyDetail ?? 0, // fixed reference
            qty: item.qty ?? '',                      // sisa_pr (editable)
            originalSisaPr: parseFloat(item.qty ?? 0),  // fixed reference for delta
            satuan: item.satuan ?? '',
            priceEstimate: item.priceEstimate ?? '',
            priceInPo: item.priceInPo ?? '',
            margin: item.margin ?? '',
            remark: item.remark ?? '',
        });
    };

    const closeEditCard = () => {
        setEditingDetailNo(null);
        setEditingDraft(null);
    };

    const updateDraft = (field, value) => {
        setEditingDraft((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [field]: value };
            // When Qty changes → auto-recalc Sisa PR = max(0, qty - stok)
            if (field === 'qtyDetail') {
                const qty = parseFloat(value) || 0;
                const stok = parseFloat(next.stok) || 0;
                next.qty = String(Math.max(0, qty - stok));
            }
            // When Sisa PR changes → Qty = originalQty + (newSisaPR - originalSisaPR)
            if (field === 'qty') {
                const newSisaPr = parseFloat(value) || 0;
                const origSisaPr = parseFloat(next.originalSisaPr) || 0;
                const origQty = parseFloat(next.originalQtyDetail) || 0;
                const delta = newSisaPr - origSisaPr;
                next.qtyDetail = String(Math.max(0, origQty + delta));
            }
            // When Harga Modal changes → recalc margin
            if (field === 'priceEstimate' || field === 'priceInPo') {
                next.margin = calculateMargin(
                    next.priceInPo,
                    next.priceEstimate,
                );
            }
            return next;
        });
    };

    const handleDeleteMaterial = (item) => {
        Swal.fire({
            title: 'Hapus material?',
            text: 'Apakah yakin data ini dihapus?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;

            if (!purchaseRequirement?.no_pr || !item.detailNo) {
                setMaterialItems((prev) =>
                    prev.filter((it) => it.id !== item.id),
                );
                return;
            }

            router.delete(
                `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onStart: () => setDeletingMaterialId(item.detailNo),
                    onError: () => setDeletingMaterialId(null),
                    onSuccess: () => {
                        setMaterialItems((prev) =>
                            prev.filter((it) => it.id !== item.id),
                        );
                        if (editingDetailNo === item.detailNo) {
                            closeEditCard();
                        }
                    },
                },
            );
        });
    };

    const handleSaveCard = (item) => {
        if (!purchaseRequirement?.no_pr || !item.detailNo || !editingDraft) {
            return;
        }

        if (parseNumber(editingDraft.qty) < 0) {
            return;
        }

        const payload = {
            date: formData.date,
            payment: formData.payment,
            for_customer: formData.forCustomer,
            ref_po: formData.refPo,
            kd_material: editingDraft.kodeMaterial,
            material: editingDraft.namaMaterial,
            qty: editingDraft.qtyDetail, // tb_detailpr.qty (raw)
            unit: editingDraft.satuan,
            stok: editingDraft.stok,
            unit_price: editingDraft.priceEstimate,
            total_price: calculateTotalPrice(
                editingDraft.qtyDetail, // qty × harga modal
                editingDraft.priceEstimate,
            ),
            price_po: editingDraft.priceInPo,
            margin: editingDraft.margin,
            renmark: editingDraft.remark,
        };

        router.put(
            `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}`,
            payload,
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSavingMaterialId(item.detailNo),
                onError: () => setSavingMaterialId(null),
                onSuccess: () => {
                    setMaterialItems((prev) =>
                        prev.map((it) =>
                            it.detailNo === item.detailNo
                                ? {
                                      ...it,
                                      kodeMaterial: payload.kd_material,
                                      namaMaterial: payload.material,
                                      stok: payload.stok,
                                      qtyDetail: payload.qty, // raw qty stored in tb_detailpr.qty
                                      qty: editingDraft.qty, // sisa_pr (computed frontend)
                                      satuan: payload.unit,
                                      priceEstimate: payload.unit_price,
                                      totalPrice: payload.total_price,
                                      priceInPo: payload.price_po,
                                      margin: payload.margin,
                                      remark: payload.renmark,
                                  }
                                : it,
                        ),
                    );
                    closeEditCard();
                },
            },
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        router.put(
            `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement?.no_pr ?? '')}`,
            {
                date: formData.date,
                payment: formData.payment,
                for_customer: formData.forCustomer,
                ref_po: formData.refPo,
                materials: materialItems.map((item, index) => ({
                    no: index + 1,
                    kd_material: item.kodeMaterial,
                    material: item.namaMaterial,
                    qty: item.qty,
                    unit: item.satuan,
                    stok: item.stok,
                    unit_price: item.priceEstimate,
                    total_price: item.totalPrice,
                    price_po: item.priceInPo,
                    margin: item.margin,
                    renmark: item.remark,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onError: () => setIsSubmitting(false),
                onSuccess: (page) => {
                    if (page?.props?.flash?.error) {
                        setIsSubmitting(false);
                    }
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit PR" />
            <form
                className="flex h-full flex-1 flex-col gap-4 p-4"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit PR</h1>
                        <p className="text-sm text-muted-foreground">
                            Perbarui data PR dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                        1. Data PO Masuk
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                        2. Data Material
                    </span>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data PO Masuk</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Date
                                </span>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            date: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref PO
                                </span>
                                <Input
                                    value={formData.refPo}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refPo: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    For Customer
                                </span>
                                <Input
                                    value={formData.forCustomer}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            forCustomer: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Payment
                                </span>
                                <select
                                    className="h-9 w-full rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                    value={formData.payment}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            payment: event.target.value,
                                        }))
                                    }
                                >
                                    <option value="Cash Trans">
                                        Cash Trans
                                    </option>
                                    <option value="Cash Tunai">
                                        Cash Tunai
                                    </option>
                                    <option value="Credit">Credit</option>
                                </select>
                            </label>
                        </CardContent>
                        <div className="flex justify-end gap-2 px-6 pb-6">
                            <Button type="button" onClick={() => setStep(2)}>
                                Lanjut
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <CardTitle>Data Material</CardTitle>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsMaterialModalOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Tambah
                                Material
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Search & page-size controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>Tampilkan</span>
                                    <select
                                        className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={
                                            listPageSize === Infinity
                                                ? 'all'
                                                : listPageSize
                                        }
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setListPageSize(
                                                v === 'all'
                                                    ? Infinity
                                                    : Number(v),
                                            );
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </div>
                                <div className="relative max-w-xs flex-1">
                                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="h-9 pl-9"
                                        placeholder="Cari kode atau nama material..."
                                        value={listSearch}
                                        onChange={(e) =>
                                            setListSearch(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {paginatedItems.length === 0 && (
                                <div className="rounded-xl border border-sidebar-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                    {materialItems.length === 0
                                        ? 'Belum ada material.'
                                        : 'Tidak ada material yang cocok.'}
                                </div>
                            )}

                            {paginatedItems.map((item, index) => {
                                const globalIndex = filteredItems.indexOf(item);
                                const isEditing =
                                    editingDetailNo === item.detailNo;
                                const source =
                                    isEditing && editingDraft
                                        ? editingDraft
                                        : item;
                                const computedMargin = isEditing
                                    ? calculateMargin(
                                          source.priceInPo,
                                          source.priceEstimate,
                                      )
                                    : source.margin;

                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-sidebar-border/70 bg-card p-4"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    No. {globalIndex + 1}
                                                </p>
                                                <p className="text-sm leading-snug font-semibold">
                                                    {renderValue(
                                                        item.namaMaterial,
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Kode:{' '}
                                                    {renderValue(
                                                        item.kodeMaterial,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit material"
                                                    onClick={() =>
                                                        openEditCard(item)
                                                    }
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {item.qtyPo <= 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Hapus material"
                                                        disabled={
                                                            deletingMaterialId ===
                                                            item.detailNo
                                                        }
                                                        onClick={() =>
                                                            handleDeleteMaterial(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        {deletingMaterialId ===
                                                        item.detailNo ? (
                                                            <Spinner className="h-4 w-4" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                            <div className="grid gap-2">
                                                <Label>Margin (%)</Label>
                                                <Input
                                                    value={formatPercent(
                                                        computedMargin,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Stok</Label>
                                                <Input
                                                    value={renderValue(
                                                        source.stok,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        isEditing
                                                            ? source.qtyDetail
                                                            : item.qtyDetail
                                                    }
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'qtyDetail',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Sisa PR</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={source.qty}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'qty',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Satuan</Label>
                                                <Input
                                                    value={source.satuan}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'satuan',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga PO In</Label>
                                                <Input
                                                    value={renderValue(
                                                        source.priceInPo,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga Modal</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={source.priceEstimate}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'priceEstimate',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Total Price Modal</Label>
                                                <Input
                                                    value={calculateTotalPrice(
                                                        source.qtyDetail,
                                                        source.priceEstimate,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2 xl:col-span-2">
                                                <Label>Remark</Label>
                                                <Input
                                                    value={source.remark}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'remark',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="mt-4 flex items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={closeEditCard}
                                                >
                                                    Batal
                                                </Button>
                                                <Button
                                                    type="button"
                                                    disabled={
                                                        savingMaterialId ===
                                                        item.detailNo
                                                    }
                                                    onClick={() =>
                                                        handleSaveCard(item)
                                                    }
                                                >
                                                    {savingMaterialId ===
                                                        item.detailNo && (
                                                        <Spinner className="mr-2" />
                                                    )}
                                                    Simpan
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Pagination controls */}
                            {listPageSize !== Infinity &&
                                filteredItems.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {Math.min(
                                                (listCurrentPage - 1) *
                                                    listPageSize +
                                                    1,
                                                filteredItems.length,
                                            )}
                                            {' – '}
                                            {Math.min(
                                                listCurrentPage * listPageSize,
                                                filteredItems.length,
                                            )}{' '}
                                            dari {filteredItems.length} material
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={listCurrentPage === 1}
                                                onClick={() =>
                                                    setListCurrentPage((p) =>
                                                        Math.max(1, p - 1),
                                                    )
                                                }
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="font-medium text-foreground">
                                                {listCurrentPage} /{' '}
                                                {listTotalPages || 1}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    listCurrentPage >=
                                                    (listTotalPages || 1)
                                                }
                                                onClick={() =>
                                                    setListCurrentPage((p) =>
                                                        Math.min(
                                                            listTotalPages || p,
                                                            p + 1,
                                                        ),
                                                    )
                                                }
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                )}
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && (
                                        <Spinner className="mr-2" />
                                    )}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/marketing/purchase-requirement">
                                        Batal
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                <Dialog
                    open={isMaterialModalOpen}
                    onOpenChange={setIsMaterialModalOpen}
                >
                    <DialogContent className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none border-none p-0 shadow-2xl">
                        <DialogHeader className="border-b bg-muted/30 p-6">
                            <DialogTitle className="text-xl">
                                Pilih Material
                            </DialogTitle>
                            <DialogDescription>
                                Pilih material dari database inventory untuk PR
                                ini.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 space-y-6 overflow-auto p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs font-bold tracking-tighter text-muted-foreground uppercase">
                                        Per Page
                                    </Label>
                                    <select
                                        className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
                                        value={
                                            materialPageSize === Infinity
                                                ? 'all'
                                                : materialPageSize
                                        }
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setMaterialPageSize(
                                                value === 'all'
                                                    ? Infinity
                                                    : Number(value),
                                            );
                                            setMaterialCurrentPage(1);
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </div>
                                <div className="relative max-w-md flex-1">
                                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="h-10 border-sidebar-border pl-9"
                                        placeholder="Cari kode atau nama material..."
                                        value={materialSearchTerm}
                                        onChange={(event) => {
                                            setMaterialSearchTerm(
                                                event.target.value,
                                            );
                                            setMaterialCurrentPage(1);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-sidebar-border bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Nama Material</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead className="text-right">
                                                Stok
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Harga Est.
                                            </TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialList.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={6}
                                                    className="h-32 text-center text-muted-foreground"
                                                >
                                                    {materialLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Spinner /> Memuat
                                                            data...
                                                        </div>
                                                    ) : (
                                                        materialError ||
                                                        'Tidak ada data material.'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            materialList.map((m) => (
                                                <TableRow key={m.kd_material}>
                                                    <TableCell className="font-mono text-xs">
                                                        {m.kd_material}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {m.material}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground uppercase">
                                                        {m.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {m.stok}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-primary">
                                                        {new Intl.NumberFormat(
                                                            'id-ID',
                                                            {
                                                                style: 'currency',
                                                                currency: 'IDR',
                                                                maximumFractionDigits: 0,
                                                            },
                                                        ).format(m.harga)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-8"
                                                            onClick={() => {
                                                                const newItem =
                                                                    {
                                                                        id: `${Date.now()}`,
                                                                        detailNo:
                                                                            null,
                                                                        kodeMaterial:
                                                                            m.kd_material,
                                                                        namaMaterial:
                                                                            m.material,
                                                                        stok: m.stok,
                                                                        qty: 0,
                                                                        satuan: m.unit,
                                                                        priceEstimate:
                                                                            m.harga ||
                                                                            0,
                                                                        totalPrice: 0,
                                                                        priceInPo: 0,
                                                                        margin: '0%',
                                                                        remark: '',
                                                                        qtyPo: 0,
                                                                    };
                                                                setMaterialItems(
                                                                    (prev) => [
                                                                        ...prev,
                                                                        newItem,
                                                                    ],
                                                                );
                                                                setIsMaterialModalOpen(
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            Pilih
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {materialPageSize !== Infinity &&
                                materialTotal > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {Math.min(
                                                (materialCurrentPage - 1) *
                                                    materialPageSize +
                                                    1,
                                                materialTotal,
                                            )}
                                            -
                                            {Math.min(
                                                materialCurrentPage *
                                                    materialPageSize,
                                                materialTotal,
                                            )}{' '}
                                            dari {materialTotal} data
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setMaterialCurrentPage(
                                                        (p) =>
                                                            Math.max(1, p - 1),
                                                    )
                                                }
                                                disabled={
                                                    materialCurrentPage === 1
                                                }
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="text-sm font-medium text-foreground">
                                                {materialCurrentPage} /{' '}
                                                {materialTotalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setMaterialCurrentPage(
                                                        (p) =>
                                                            Math.min(
                                                                materialTotalPages ||
                                                                    p,
                                                                p + 1,
                                                            ),
                                                    )
                                                }
                                                disabled={
                                                    materialCurrentPage >=
                                                    materialTotalPages
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
            </form>
        </AppLayout>
    );
}
