import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Spinner } from '@/components/ui/spinner';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useEffect, useState } from 'react';

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
            qty: item.qty ?? '',
            satuan: item.unit ?? '',
            priceEstimate: item.unit_price ?? '',
            totalPrice: item.total_price ?? '',
            priceInPo: item.price_po ?? '',
            margin: item.margin ?? '',
            remark: item.renmark ?? '',
        }))
    );

    const openEditCard = (item) => {
        setEditingDetailNo(item.detailNo);
        setEditingDraft({
            kodeMaterial: item.kodeMaterial ?? '',
            namaMaterial: item.namaMaterial ?? '',
            stok: item.stok ?? '',
            qty: item.qty ?? '',
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
            if (field === 'priceEstimate' || field === 'priceInPo') {
                next.margin = calculateMargin(next.priceInPo, next.priceEstimate);
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
                setMaterialItems((prev) => prev.filter((it) => it.id !== item.id));
                return;
            }

            router.delete(
                `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onStart: () => setDeletingMaterialId(item.detailNo),
                    onFinish: () => setDeletingMaterialId(null),
                    onSuccess: () => {
                        setMaterialItems((prev) => prev.filter((it) => it.id !== item.id));
                        if (editingDetailNo === item.detailNo) {
                            closeEditCard();
                        }
                    },
                }
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
            qty: editingDraft.qty,
            unit: editingDraft.satuan,
            stok: editingDraft.stok,
            unit_price: editingDraft.priceEstimate,
            total_price: calculateTotalPrice(editingDraft.qty, editingDraft.priceEstimate),
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
                onFinish: () => setSavingMaterialId(null),
                onSuccess: () => {
                    setMaterialItems((prev) =>
                        prev.map((it) =>
                            it.detailNo === item.detailNo
                                ? {
                                      ...it,
                                      kodeMaterial: payload.kd_material,
                                      namaMaterial: payload.material,
                                      stok: payload.stok,
                                      qty: payload.qty,
                                      satuan: payload.unit,
                                      priceEstimate: payload.unit_price,
                                      totalPrice: payload.total_price,
                                      priceInPo: payload.price_po,
                                      margin: payload.margin,
                                      remark: payload.renmark,
                                  }
                                : it
                        )
                    );
                    closeEditCard();
                },
            }
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
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit PR" />
            <form className="flex h-full flex-1 flex-col gap-4 p-4" onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit PR</h1>
                        <p className="text-sm text-muted-foreground">Perbarui data PR dalam dua langkah</p>
                    </div>
                    <div className="text-sm text-muted-foreground">Step {step} dari 2</div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        1. Data PO Masuk
                    </span>
                    <span className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
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
                                <span className="text-muted-foreground">Date</span>
                                <Input type="date" value={formData.date} onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))} />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Ref PO</span>
                                <Input value={formData.refPo} onChange={(event) => setFormData((prev) => ({ ...prev, refPo: event.target.value }))} />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">For Customer</span>
                                <Input value={formData.forCustomer} onChange={(event) => setFormData((prev) => ({ ...prev, forCustomer: event.target.value }))} />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Payment</span>
                                <select className="h-9 w-full rounded-md border border-sidebar-border/70 bg-background px-3 text-sm" value={formData.payment} onChange={(event) => setFormData((prev) => ({ ...prev, payment: event.target.value }))}>
                                    <option value="Cash Trans">Cash Trans</option>
                                    <option value="Cash Tunai">Cash Tunai</option>
                                    <option value="Credit">Credit</option>
                                </select>
                            </label>
                        </CardContent>
                        <div className="flex justify-end gap-2 px-6 pb-6">
                            <Button type="button" onClick={() => setStep(2)}>Lanjut</Button>
                        </div>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Material</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {materialItems.length === 0 && (
                                <div className="rounded-xl border border-sidebar-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                    Belum ada material.
                                </div>
                            )}

                            {materialItems.map((item, index) => {
                                const isEditing = editingDetailNo === item.detailNo;
                                const source = isEditing && editingDraft ? editingDraft : item;
                                const computedMargin = isEditing
                                    ? calculateMargin(source.priceInPo, source.priceEstimate)
                                    : source.margin;

                                return (
                                    <div key={item.id} className="rounded-xl border border-sidebar-border/70 bg-card p-4">
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">No. {index + 1}</p>
                                                <p className="text-sm font-semibold leading-snug">{renderValue(item.namaMaterial)}</p>
                                                <p className="text-xs text-muted-foreground">Kode: {renderValue(item.kodeMaterial)}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit material"
                                                    onClick={() => openEditCard(item)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Hapus material"
                                                    disabled={deletingMaterialId === item.detailNo}
                                                    onClick={() => handleDeleteMaterial(item)}
                                                >
                                                    {deletingMaterialId === item.detailNo ? (
                                                        <Spinner className="h-4 w-4" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                            <div className="grid gap-2">
                                                <Label>Margin (%)</Label>
                                                <Input value={formatPercent(computedMargin)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Stok</Label>
                                                <Input value={renderValue(source.stok)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty PO In</Label>
                                                <Input value={renderValue(item.qty)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty PR</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={source.qty}
                                                    readOnly={!isEditing}
                                                    onChange={(event) => updateDraft('qty', event.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Satuan</Label>
                                                <Input
                                                    value={source.satuan}
                                                    readOnly={!isEditing}
                                                    onChange={(event) => updateDraft('satuan', event.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga PO In</Label>
                                                <Input value={renderValue(source.priceInPo)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga Modal</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={source.priceEstimate}
                                                    readOnly={!isEditing}
                                                    onChange={(event) => updateDraft('priceEstimate', event.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Total Price Modal</Label>
                                                <Input
                                                    value={calculateTotalPrice(source.qty, source.priceEstimate)}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2 xl:col-span-2">
                                                <Label>Remark</Label>
                                                <Input
                                                    value={source.remark}
                                                    readOnly={!isEditing}
                                                    onChange={(event) => updateDraft('remark', event.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="mt-4 flex items-center justify-end gap-2">
                                                <Button type="button" variant="outline" onClick={closeEditCard}>
                                                    Batal
                                                </Button>
                                                <Button
                                                    type="button"
                                                    disabled={savingMaterialId === item.detailNo}
                                                    onClick={() => handleSaveCard(item)}
                                                >
                                                    {savingMaterialId === item.detailNo && <Spinner className="mr-2" />}
                                                    Simpan
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button variant="outline" type="button" onClick={() => setStep(1)}>
                                Kembali
                            </Button>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Spinner className="mr-2" />}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/marketing/purchase-requirement">Batal</Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </form>
        </AppLayout>
    );
}
