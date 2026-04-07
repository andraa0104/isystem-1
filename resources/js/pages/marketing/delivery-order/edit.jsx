import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const formatDate = (date) => {
    if (!date) return '';
    // try parse dd.mm.yyyy or yyyy-mm-dd etc to yyyy-mm-dd for input
    const match = String(date).match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
    if (match) {
        const [, d, m, y] = match;
        return `${y}-${m}-${d}`;
    }
    const dObj = new Date(date);
    if (Number.isNaN(dObj.getTime())) return '';
    const day = String(dObj.getDate()).padStart(2, '0');
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const year = dObj.getFullYear();
    return `${year}-${month}-${day}`;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

export default function DeliveryOrderEdit({
    deliveryOrder,
    items = [],
    prItems = [],
}) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sourceItems, setSourceItems] = useState(prItems);
    const [selectedLineNo, setSelectedLineNo] = useState(null);

    const [formData, setFormData] = useState({
        date: formatDate(deliveryOrder?.date),
        ref_po: deliveryOrder?.ref_po ?? '',
        kd_cs: deliveryOrder?.kd_cs ?? '',
        nm_cs: deliveryOrder?.nm_cs ?? '',
        items: items ?? [],
    });

    const [inputItem, setInputItem] = useState({
        no: '',
        kd_material: '',
        material: '',
        qty: '',
        unit: '',
        remark: '',
        last_stock: 0,
        original_qty: 0,
        stock_now: 0,
    });

    useEffect(() => {
        setFormData({
            date: formatDate(deliveryOrder?.date),
            ref_po: deliveryOrder?.ref_po ?? '',
            kd_cs: deliveryOrder?.kd_cs ?? '',
            nm_cs: deliveryOrder?.nm_cs ?? '',
            items: items ?? [],
        });
        setSourceItems(prItems);
    }, [deliveryOrder, items, prItems]);

    const prLookup = useMemo(() => {
        const map = new Map();
        sourceItems.forEach((item) => {
            if (item.kd_material) {
                map.set(`kd:${item.kd_material}`, item);
            }
            if (item.material) {
                map.set(`mat:${item.material}`, item);
            }
        });
        return map;
    }, [sourceItems]);

    const handleSelectItem = (item) => {
        const source =
            (item.kd_material && prLookup.get(`kd:${item.kd_material}`)) ||
            (item.material && prLookup.get(`mat:${item.material}`));
        const lastStock = Number(source?.last_stock ?? 0);
        const originalQty = Number(item.qty ?? 0);
        const stockNow = lastStock; // If NewQty == OriginalQty, StockNow = LastStock

        setSelectedLineNo(item.no);
        setInputItem({
            no: item.no,
            kd_material: item.kd_material ?? '',
            material: item.material ?? '',
            qty: item.qty ?? '',
            unit: item.unit ?? '',
            remark: item.remark ?? '',
            last_stock: lastStock,
            original_qty: originalQty,
            stock_now: stockNow,
        });
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setInputItem((prev) => {
            const newValue = { ...prev, [name]: value };
            if (name === 'qty') {
                const qtyVal = Number(value || 0);
                newValue.stock_now =
                    prev.last_stock + prev.original_qty - qtyVal;
            }
            return newValue;
        });
    };

    const handleUpdateItem = () => {
        if (!inputItem.no) {
            return;
        }

        router.put(
            `/marketing/delivery-order/${encodeURIComponent(
                deliveryOrder.no_do,
            )}/detail/${encodeURIComponent(inputItem.no)}`,
            {
                qty: inputItem.qty,
                remark: inputItem.remark,
                date: formData.date,
                stock_now: inputItem.stock_now,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
                onSuccess: () => {
                    setFormData((prev) => ({
                        ...prev,
                        items: prev.items.map((row) =>
                            String(row.no) === String(inputItem.no)
                                ? {
                                      ...row,
                                      qty: inputItem.qty,
                                      remark: inputItem.remark,
                                  }
                                : row,
                        ),
                    }));
                },
            },
        );
    };

    const showToast = (message, variant = 'error') => {
        if (!message) return;
        Swal.fire({
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false,
            icon: variant === 'success' ? 'success' : 'error',
            title: message,
        });
    };

    const handleDeleteItem = (item) => {
        if (!item?.no) return;

        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement) {
            activeEl.blur();
        }

        Swal.fire({
            title: 'Hapus material?',
            text: `Data material no ${item.no} akan dihapus.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            allowEscapeKey: () => !Swal.isLoading(),
            preConfirm: async () => {
                try {
                    const response = await fetch(
                        `/marketing/delivery-order/${encodeURIComponent(
                            deliveryOrder.no_do,
                        )}/detail/${encodeURIComponent(item.no)}`,
                        {
                            method: 'DELETE',
                            headers: {
                                Accept: 'application/json',
                                'X-CSRF-TOKEN':
                                    document
                                        .querySelector(
                                            'meta[name="csrf-token"]',
                                        )
                                        ?.getAttribute('content') ?? '',
                            },
                        },
                    );

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(
                            data?.message ||
                                'Gagal menghapus data material DO.',
                        );
                    }

                    return data;
                } catch (error) {
                    Swal.showValidationMessage(error.message);
                    throw error;
                }
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            setFormData((prev) => ({
                ...prev,
                items: prev.items.filter(
                    (row) => String(row.no) !== String(item.no),
                ),
            }));

            if (String(selectedLineNo) === String(item.no)) {
                setSelectedLineNo(null);
                setInputItem({
                    no: '',
                    kd_material: '',
                    material: '',
                    qty: '',
                    unit: '',
                    remark: '',
                    last_stock: 0,
                    stock_now: 0,
                });
            }

            showToast(
                result.value?.message || 'Data material DO berhasil dihapus.',
                'success',
            );
        });
    };

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const handleSaveStep1 = () => {
        router.put(
            `/marketing/delivery-order/${encodeURIComponent(
                deliveryOrder.no_do,
            )}`,
            {
                date: formData.date,
                ref_po: formData.ref_po,
                kd_cs: formData.kd_cs,
                nm_cs: formData.nm_cs,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
                onSuccess: () => {},
                onError: () => {},
            },
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Marketing', href: '/marketing/delivery-order' },
                {
                    title: 'Edit Delivery Order',
                    href: `/marketing/delivery-order/${encodeURIComponent(
                        deliveryOrder.no_do,
                    )}/edit`,
                },
            ]}
        >
            <Head title="Edit Delivery Order" />
            <div className="flex-1 p-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Edit Delivery Order</h1>
                    <div className="text-sm text-muted-foreground">
                        Step {step} of 2
                    </div>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data DO</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Nomor DO</Label>
                                    <Input
                                        readOnly
                                        value={deliveryOrder?.no_do ?? ''}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date</Label>
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
                                </div>
                                <div className="space-y-2">
                                    <Label>Ref PO</Label>
                                    <Input readOnly value={formData.ref_po} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kode Customer</Label>
                                    <Input readOnly value={formData.kd_cs} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nama Customer</Label>
                                    <Input readOnly value={formData.nm_cs} />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={handleSaveStep1}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting
                                            ? 'Menyimpan...'
                                            : 'Simpan Data'}
                                    </Button>
                                    <Button onClick={nextStep}>
                                        Next{' '}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Data Material</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-2 lg:col-span-4">
                                        <Label>Material</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                placeholder="Kode"
                                                value={inputItem.kd_material}
                                                className="w-40"
                                            />
                                            <Input
                                                readOnly
                                                placeholder="Nama Material"
                                                value={inputItem.material}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Qty</Label>
                                        <Input
                                            type="number"
                                            name="qty"
                                            value={inputItem.qty}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Satuan</Label>
                                        <Input
                                            readOnly
                                            name="unit"
                                            value={inputItem.unit}
                                        />
                                    </div>
                                    <div className="space-y-2 lg:col-span-2">
                                        <Label>Remark</Label>
                                        <Input
                                            name="remark"
                                            value={inputItem.remark}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Stock</Label>
                                        <Input
                                            readOnly
                                            value={inputItem.last_stock}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Stock Now</Label>
                                        <Input
                                            readOnly
                                            value={inputItem.stock_now}
                                        />
                                    </div>
                                    <div className="flex flex-col items-end justify-end gap-2 lg:col-span-4">
                                        {inputItem.stock_now < 0 && (
                                            <p className="text-xs font-semibold text-destructive">
                                                Stock now tidak boleh minus.
                                            </p>
                                        )}
                                        <Button
                                            onClick={handleUpdateItem}
                                            disabled={
                                                isSubmitting ||
                                                !inputItem.no ||
                                                inputItem.stock_now < 0
                                            }
                                        >
                                            {isSubmitting
                                                ? 'Menyimpan...'
                                                : 'Edit Data'}
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                        Data Material DO
                                    </h3>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>No</TableHead>
                                                    <TableHead>
                                                        Material
                                                    </TableHead>
                                                    <TableHead className="w-[100px]">
                                                        Qty
                                                    </TableHead>
                                                    <TableHead className="w-[100px]">
                                                        Satuan
                                                    </TableHead>
                                                    <TableHead>
                                                        Remark
                                                    </TableHead>
                                                    <TableHead className="w-[80px]">
                                                        Action
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formData.items.map(
                                                    (item, i) => (
                                                        <TableRow
                                                            key={i}
                                                            className="cursor-pointer hover:bg-muted/50"
                                                            onClick={() =>
                                                                handleSelectItem(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <TableCell>
                                                                {item.no ??
                                                                    i + 1}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.material}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.qty}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.unit}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.remark}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(
                                                                        event,
                                                                    ) => {
                                                                        event.stopPropagation();
                                                                        handleDeleteItem(
                                                                            item,
                                                                        );
                                                                    }}
                                                                    aria-label="Hapus material"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ),
                                                )}
                                                {formData.items.length ===
                                                    0 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={6}
                                                            className="text-center"
                                                        >
                                                            Belum ada material
                                                            ditambahkan.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {selectedLineNo && (
                                        <div className="pt-2 text-xs text-muted-foreground">
                                            Editing item no {selectedLineNo}.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
