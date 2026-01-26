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
import { ArrowLeft, ArrowRight, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

const formatDate = (date) => {
    if (!date) return '';
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

export default function DeliveryOrderAddEdit({ deliveryOrder, items = [] }) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDate, setIsSavingDate] = useState(false);
    const [selectedLineNo, setSelectedLineNo] = useState(null);

    const [formData, setFormData] = useState({
        date: formatDate(deliveryOrder?.date),
        ref_do: deliveryOrder?.ref_do ?? '',
        ref_po: deliveryOrder?.ref_po ?? '',
        kd_cs: deliveryOrder?.kd_cs ?? '',
        nm_cs: deliveryOrder?.nm_cs ?? '',
        items: items ?? [],
    });

    const [inputItem, setInputItem] = useState({
        no: '',
        kd_mat: '',
        mat: '',
        qty: '',
        original_qty: 0,
        unit: '',
        remark: '',
        harga: '',
        total: '',
        last_stock: 0,
        stock_now: 0,
    });

    useEffect(() => {
        setFormData({
            date: formatDate(deliveryOrder?.date),
            ref_do: deliveryOrder?.ref_do ?? '',
            ref_po: deliveryOrder?.ref_po ?? '',
            kd_cs: deliveryOrder?.kd_cs ?? '',
            nm_cs: deliveryOrder?.nm_cs ?? '',
            items: items ?? [],
        });
    }, [deliveryOrder, items]);

    const handleSelectItem = (item) => {
        const qty = item.qty ?? '';
        const lastStock = Number(item.last_stock || 0);
        const stockNow = Number(qty || 0) - Number(qty || 0);

        setSelectedLineNo(item.no);
        setInputItem({
            no: item.no,
            kd_mat: item.kd_mat ?? '',
            mat: item.mat ?? '',
            qty: qty,
            original_qty: Number(qty || 0),
            unit: item.unit ?? '',
            remark: item.remark ?? '',
            harga: item.harga ?? '',
            total: Number(item.harga || 0) * Number(qty || 0),
            last_stock: lastStock,
            stock_now: stockNow,
        });
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setInputItem((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'qty') {
                const qtyVal = Number(value || 0);
                next.stock_now = Number(prev.original_qty || 0) - qtyVal;
                next.total = Number(prev.harga || 0) * qtyVal;
            }
            if (name === 'harga') {
                const priceVal = Number(value || 0);
                next.total = priceVal * Number(prev.qty || 0);
            }
            return next;
        });
    };

    const handleUpdateItem = () => {
        if (!inputItem.no) {
            return;
        }

        router.put(
            `/marketing/delivery-order-add/${encodeURIComponent(
                deliveryOrder.no_dob,
            )}/detail/${encodeURIComponent(inputItem.no)}`,
            {
                qty: inputItem.qty,
                harga: inputItem.harga,
                remark: inputItem.remark,
                ref_po: formData.ref_po,
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
                                      harga: inputItem.harga,
                                      total:
                                          Number(inputItem.harga || 0) *
                                          Number(inputItem.qty || 0),
                                  }
                                : row,
                        ),
                    }));
                },
            },
        );
    };

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const handleSaveDate = () => {
        if (!formData.date) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Tanggal tidak boleh kosong.',
                showConfirmButton: false,
                timer: 2000,
            });
            return;
        }

        router.put(
            `/marketing/delivery-order-add/${encodeURIComponent(
                deliveryOrder.no_dob,
            )}`,
            { date: formData.date, no_dob: deliveryOrder.no_dob },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setIsSavingDate(true),
                onError: (errors) => {
                    const message =
                        errors?.message ||
                        (errors &&
                            typeof errors === 'object' &&
                            Object.values(errors)[0]) ||
                        'Gagal menyimpan tanggal.';
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'error',
                        title: String(message),
                        showConfirmButton: false,
                        timer: 2200,
                    });
                },
                onFinish: () => setIsSavingDate(false),
            },
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Marketing', href: '/marketing/delivery-order-add' },
                { title: 'Edit DOB', href: '#' },
            ]}
        >
            <Head title="Edit Delivery Order Add" />
            <div className="flex-1 p-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        Edit Delivery Order Add
                    </h1>
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
                                    <Label>No DOT</Label>
                                    <Input readOnly value={deliveryOrder?.no_dob ?? ''} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                date: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ref DO</Label>
                                    <Input readOnly value={formData.ref_do} />
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
                            <div className="flex flex-wrap justify-end gap-2 pt-4">
                                <Button
                                    variant="secondary"
                                    onClick={handleSaveDate}
                                    disabled={isSavingDate}
                                >
                                    {isSavingDate ? 'Menyimpan...' : 'Simpan Data'}
                                </Button>
                                <Button onClick={nextStep}>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
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
                                                value={inputItem.kd_mat}
                                                className="w-40"
                                            />
                                            <Input
                                                readOnly
                                                placeholder="Nama Material"
                                                value={inputItem.mat}
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
                                        <Input readOnly value={inputItem.unit} />
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
                                        <Label>Price</Label>
                                        <Input
                                            name="harga"
                                            value={inputItem.harga}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Price</Label>
                                        <Input readOnly value={inputItem.total} />
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
                                    <div className="flex items-end justify-end lg:col-span-4">
                                        <Button
                                            onClick={handleUpdateItem}
                                            disabled={
                                                isSubmitting || !inputItem.no
                                            }
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            {isSubmitting
                                                ? 'Menyimpan...'
                                                : 'Edit Data'}
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                        Data Material DOB
                                    </h3>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>No</TableHead>
                                                    <TableHead>
                                                        Kode Material
                                                    </TableHead>
                                                    <TableHead>
                                                        Material
                                                    </TableHead>
                                                    <TableHead className="w-[100px]">
                                                        Qty
                                                    </TableHead>
                                                    <TableHead className="w-[120px]">
                                                        Satuan
                                                    </TableHead>
                                                    <TableHead>
                                                        Harga
                                                    </TableHead>
                                                    <TableHead>Total</TableHead>
                                                    <TableHead>Remark</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formData.items.map((item, i) => (
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
                                                            {item.no ?? i + 1}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.kd_mat}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.mat}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.qty}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.unit}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.harga}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.total}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.remark}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {formData.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={8}
                                                            className="text-center"
                                                        >
                                                            Belum ada data
                                                            material.
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
