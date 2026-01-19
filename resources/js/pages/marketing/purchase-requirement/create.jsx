import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Spinner } from '@/components/ui/spinner';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Tambah PR', href: '/marketing/purchase-requirement/create' },
];

const todayValue = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
        return value;
    }
    return `${number}%`;
};

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export default function PurchaseRequirementCreate({ materials = [] }) {
    const [step, setStep] = useState(1);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(10);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [materialList, setMaterialList] = useState(materials);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState('');

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPo: '',
        forCustomer: '',
        payment: 'Cash Trans',
    });

    const [materialForm, setMaterialForm] = useState({
        kodeMaterial: '',
        namaMaterial: '',
        stok: '',
        qty: '',
        satuan: '',
        priceEstimate: '',
        priceInPo: '',
        remark: '',
    });

    const [materialItems, setMaterialItems] = useState([]);

    const filteredMaterials = useMemo(() => {
        const term = materialSearchTerm.trim().toLowerCase();
        if (!term) {
            return materialList;
        }

        return materialList.filter((item) => {
            const values = [item.kd_material, item.material];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [materialSearchTerm, materialList]);

    const materialTotalItems = filteredMaterials.length;
    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(materialTotalItems / materialPageSize));
    }, [materialPageSize, materialTotalItems]);

    const displayedMaterials = useMemo(() => {
        if (materialPageSize === Infinity) {
            return filteredMaterials;
        }

        const startIndex = (materialCurrentPage - 1) * materialPageSize;
        return filteredMaterials.slice(startIndex, startIndex + materialPageSize);
    }, [filteredMaterials, materialCurrentPage, materialPageSize]);

    useEffect(() => {
        setMaterialCurrentPage(1);
    }, [materialPageSize, materialSearchTerm]);

    useEffect(() => {
        if (materialCurrentPage > materialTotalPages) {
            setMaterialCurrentPage(materialTotalPages);
        }
    }, [materialCurrentPage, materialTotalPages]);

    const totalPriceValue = useMemo(() => {
        const qty = parseNumber(materialForm.qty);
        const estimate = parseNumber(materialForm.priceEstimate);
        const total = qty * estimate;
        return total ? Math.round(total).toString() : '';
    }, [materialForm.priceEstimate, materialForm.qty]);

    const marginValue = useMemo(() => {
        const estimate = parseNumber(materialForm.priceEstimate);
        const priceInPo = parseNumber(materialForm.priceInPo);
        if (!estimate) {
            return '';
        }
        const margin = ((priceInPo - estimate) / estimate) * 100;
        return Number.isFinite(margin) ? margin.toFixed(2) : '';
    }, [materialForm.priceEstimate, materialForm.priceInPo]);

    const handleMaterialSelect = (material) => {
        setMaterialForm((prev) => ({
            ...prev,
            kodeMaterial: material.kd_material ?? '',
            namaMaterial: material.material ?? '',
            stok: material.stok ?? '',
            satuan: material.unit ?? '',
        }));
        setIsMaterialModalOpen(false);
    };

    const loadMaterials = async () => {
        if (materialLoading || materialList.length > 0) {
            return;
        }
        setMaterialLoading(true);
        setMaterialError('');
        try {
            const response = await fetch('/marketing/purchase-requirement/materials', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            setMaterialList(Array.isArray(data?.materials) ? data.materials : []);
        } catch (error) {
            setMaterialError('Gagal memuat data material.');
        } finally {
            setMaterialLoading(false);
        }
    };

    const handleAddMaterial = () => {
        if (!materialForm.namaMaterial || !materialForm.qty) {
            return;
        }

        const newItem = {
            id: `${Date.now()}-${Math.random()}`,
            ...materialForm,
            priceInPo: materialForm.priceInPo?.toString() ?? '',
            totalPrice: totalPriceValue,
            margin: marginValue,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialForm({
            kodeMaterial: '',
            namaMaterial: '',
            stok: '',
            qty: '',
            satuan: '',
            priceEstimate: '',
            priceInPo: '',
            remark: '',
        });
    };

    const handleRemoveMaterial = (id) => {
        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        router.post('/marketing/purchase-requirement', {
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
        }, {
            onStart: () => setIsSubmitting(true),
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah PR" />
            <form
                className="flex h-full flex-1 flex-col gap-4 p-4"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PR</h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data PR dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 1
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        1. Data PO Masuk
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 2
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
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
                                <span className="text-muted-foreground">Date</span>
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
                                <span className="text-muted-foreground">Ref PO</span>
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
                                <span className="text-muted-foreground">Payment</span>
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
                                    <option value="Cash Trans">Cash Trans</option>
                                    <option value="Cash Tunai">Cash Tunai</option>
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
                        <CardHeader>
                            <CardTitle>Data Material</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Kode Material</Label>
                                    <Input value={materialForm.kodeMaterial} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Nama Material</Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            value={materialForm.namaMaterial}
                                            readOnly
                                            placeholder="Pilih material"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsMaterialModalOpen(true);
                                                loadMaterials();
                                            }}
                                        >
                                            Cari Material
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Stok</Label>
                                    <Input value={materialForm.stok} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Qty</Label>
                                    <Input
                                        type="number"
                                        value={materialForm.qty}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                qty: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Satuan</Label>
                                    <Input
                                        value={materialForm.satuan}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                satuan: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price Estimate</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={materialForm.priceEstimate}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                priceEstimate: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input value={totalPriceValue} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price in PO</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={materialForm.priceInPo}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                priceInPo: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Margin</Label>
                                    <Input
                                        value={marginValue ? `${marginValue}%` : ''}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <Label>Remark</Label>
                                    <textarea
                                        className="min-h-[100px] rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                        value={materialForm.remark}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                remark: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" onClick={handleAddMaterial}>
                                    Tambah Material
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Tambahkan item ke daftar material.
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                No
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Kode
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Material
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Stok
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Qty
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Satuan
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Price Estimate
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Total Price
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Price in PO
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Margin
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Remark
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materialItems.length === 0 && (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={11}
                                                >
                                                    Belum ada material ditambahkan.
                                                </td>
                                            </tr>
                                        )}
                                        {materialItems.map((item, index) => (
                                            <tr
                                                key={item.id}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.kodeMaterial)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.namaMaterial)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.stok)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.qty)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.satuan)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(
                                                        item.priceEstimate
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.totalPrice)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.priceInPo)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {formatPercent(item.margin)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.remark)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleRemoveMaterial(
                                                                item.id
                                                            )
                                                        }
                                                    >
                                                        Hapus
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                    onOpenChange={(open) => {
                        setIsMaterialModalOpen(open);
                        if (open) {
                            loadMaterials();
                        } else {
                            setMaterialSearchTerm('');
                            setMaterialPageSize(10);
                            setMaterialCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Pilih Material</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
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
                                                : Number(value)
                                        );
                                        setMaterialCurrentPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari kode/nama material..."
                                    value={materialSearchTerm}
                                    onChange={(event) =>
                                        setMaterialSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            Kode Material
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Nama Material
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Stok
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Satuan
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedMaterials.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {materialLoading
                                                    ? 'Memuat data material...'
                                                    : materialError ||
                                                      'Tidak ada data material.'}
                                            </td>
                                        </tr>
                                    )}
                                    {displayedMaterials.map((item) => (
                                        <tr
                                            key={item.kd_material}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {renderValue(item.kd_material)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.material)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.stok)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.unit)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleMaterialSelect(item)
                                                    }
                                                >
                                                    Pilih
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {materialPageSize !== Infinity &&
                            materialTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (materialCurrentPage - 1) *
                                                materialPageSize +
                                                1,
                                            materialTotalItems
                                        )}
                                        -
                                        {Math.min(
                                            materialCurrentPage * materialPageSize,
                                            materialTotalItems
                                        )}{' '}
                                        dari {materialTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setMaterialCurrentPage((page) =>
                                                    Math.max(1, page - 1)
                                                )
                                            }
                                            disabled={materialCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {materialCurrentPage} dari{' '}
                                            {materialTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setMaterialCurrentPage((page) =>
                                                    Math.min(
                                                        materialTotalPages,
                                                        page + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                materialCurrentPage ===
                                                materialTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>
            </form>
        </AppLayout>
    );
}
