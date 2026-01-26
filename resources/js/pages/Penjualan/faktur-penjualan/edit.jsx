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
import Swal from 'sweetalert2';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Edit Invoice', href: '/penjualan/faktur-penjualan' },
];

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(
        toNumber(value),
    );

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;

const toDateInput = (value) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (match) {
        const [, d, m, y] = match;
        return `${y}-${m}-${d}`;
    }
    const dObj = new Date(value);
    if (Number.isNaN(dObj.getTime())) return '';
    const day = String(dObj.getDate()).padStart(2, '0');
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const year = dObj.getFullYear();
    return `${year}-${month}-${day}`;
};

export default function FakturPenjualanEdit({
    invoice,
    materialRows: initialRows = [],
}) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [doMaterials, setDoMaterials] = useState([]);
    const [doAddMaterials, setDoAddMaterials] = useState([]);
    const [materialsLoading, setMaterialsLoading] = useState(false);

    const [formData, setFormData] = useState({
        no_fakturpenjualan: invoice?.no_fakturpenjualan ?? '',
        date: toDateInput(invoice?.tgl_doc),
        due_date: toDateInput(invoice?.jth_tempo),
        no_fakturpajak: invoice?.no_fakturpajak ?? '',
        ppn: invoice?.ppn ?? '',
        ref_po_in: invoice?.ref_po ?? '',
        kd_cs: invoice?.kd_cs ?? '',
        nm_cs: invoice?.nm_cs ?? '',
    });

    const [materialRows, setMaterialRows] = useState(initialRows);
    const [materialInput, setMaterialInput] = useState({
        no_ref: '',
        kd_material: '',
        material: '',
        qty: '',
        unit: '',
        price: '',
        total: '',
        hpp: '',
        total_hpp: '',
        source_type: '',
    });
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (step !== 2 || !formData.ref_po_in) {
            return;
        }
        setMaterialsLoading(true);
        Promise.all([
            fetch(
                `/penjualan/faktur-penjualan/do-materials?ref_po_in=${encodeURIComponent(
                    formData.ref_po_in,
                )}`,
                { headers: { Accept: 'application/json' } },
            ),
            fetch(
                `/penjualan/faktur-penjualan/do-add-materials?no_do=${encodeURIComponent(
                    materialRows[0]?.no_ref ?? '',
                )}&ref_po_in=${encodeURIComponent(formData.ref_po_in)}`,
                { headers: { Accept: 'application/json' } },
            ),
        ])
            .then(async ([doResponse, doAddResponse]) => {
                if (!doResponse.ok || !doAddResponse.ok) {
                    throw new Error('Request failed');
                }
                const doData = await doResponse.json();
                const doAddData = await doAddResponse.json();
                setDoMaterials(Array.isArray(doData?.items) ? doData.items : []);
                setDoAddMaterials(
                    Array.isArray(doAddData?.items) ? doAddData.items : [],
                );
            })
            .catch(() => {
                setDoMaterials([]);
                setDoAddMaterials([]);
            })
            .finally(() => setMaterialsLoading(false));
    }, [step, formData.ref_po_in, materialRows]);

    const handleSelectMaterial = (item, type) => {
        const qty = toNumber(item.qty);
        const hpp = toNumber(item.hpp);
        setMaterialInput({
            no_ref: type === 'do' ? item.no_do ?? '' : item.no_dob ?? '',
            kd_material: item.kd_material ?? '',
            material: item.mat ?? '',
            qty: item.qty ?? '',
            unit: item.unit ?? '',
            price: item.harga ?? '',
            total: item.total ?? '',
            hpp: item.hpp ?? '',
            total_hpp: qty * hpp,
            source_type: type,
        });
        setIsLocked(true);
    };

    const handleRowClick = (row) => {
        setMaterialInput({ ...row });
        setIsLocked(true);
    };

    const handleMaterialInputChange = (event) => {
        const { name, value } = event.target;
        setMaterialInput((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'qty' || name === 'hpp') {
                const qty = toNumber(name === 'qty' ? value : next.qty);
                const hpp = toNumber(name === 'hpp' ? value : next.hpp);
                next.total_hpp = qty * hpp;
            }
            if (name === 'price' || name === 'qty') {
                const qty = toNumber(name === 'qty' ? value : next.qty);
                const price = toNumber(name === 'price' ? value : next.price);
                next.total = qty * price;
            }
            return next;
        });
    };

    const handleUpsertRow = () => {
        if (!materialInput.material) return;
        setMaterialRows((prev) => {
            const idx = prev.findIndex(
                (row) =>
                    row.no_ref === materialInput.no_ref &&
                    row.kd_material === materialInput.kd_material,
            );
            if (idx === -1) {
                return [...prev, materialInput];
            }
            const next = [...prev];
            next[idx] = materialInput;
            return next;
        });
        setIsLocked(false);
        setMaterialInput({
            no_ref: '',
            kd_material: '',
            material: '',
            qty: '',
            unit: '',
            price: '',
            total: '',
            hpp: '',
            total_hpp: '',
            source_type: '',
        });
    };

    const handleDeleteRow = (row) => {
        setMaterialRows((prev) =>
            prev.filter(
                (item) =>
                    !(
                        item.no_ref === row.no_ref &&
                        item.kd_material === row.kd_material
                    ),
            ),
        );
    };

    const handleSave = () => {
        setIsSubmitting(true);
        router.put(
            `/penjualan/faktur-penjualan/${encodeURIComponent(
                invoice?.no_fakturpenjualan ?? '',
            )}`,
            {
                date: formData.date,
                due_date: formData.due_date,
                no_fakturpajak: formData.no_fakturpajak,
                ppn: formData.ppn,
                materials: materialRows,
                h_ppn: totalPpn,
                harga: grandTotalPrice,
                g_total: grandTotalWithPpn,
            },
            {
                onSuccess: () => {
                },
                onError: (errors) => {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'error',
                        title:
                            errors?.message ||
                            'Gagal menyimpan perubahan.',
                        showConfirmButton: false,
                        timer: 3500,
                    });
                },
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    const grandTotalPrice = useMemo(() => {
        return materialRows.reduce(
            (total, item) => total + toNumber(item.total),
            0,
        );
    }, [materialRows]);

    const grandTotalHpp = useMemo(() => {
        return materialRows.reduce(
            (total, item) => total + toNumber(item.total_hpp),
            0,
        );
    }, [materialRows]);

    const totalPpn = useMemo(() => {
        const ppnValue = toNumber(formData.ppn);
        return (ppnValue / 100) * grandTotalPrice;
    }, [formData.ppn, grandTotalPrice]);

    const margin = useMemo(() => {
        if (!grandTotalPrice) {
            return 0;
        }
        return ((grandTotalPrice - grandTotalHpp) / grandTotalPrice) * 100;
    }, [grandTotalPrice, grandTotalHpp]);

    const grandTotalWithPpn = useMemo(() => {
        return grandTotalPrice + totalPpn;
    }, [grandTotalPrice, totalPpn]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Invoice" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit Invoice</h1>
                        <p className="text-sm text-muted-foreground">
                            Perbarui data invoice.
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data DO</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    No Invoice
                                </span>
                                <Input
                                    value={formData.no_fakturpenjualan}
                                    readOnly
                                />
                            </label>
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
                                    Jatuh Tempo
                                </span>
                                <Input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            due_date: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nomor Faktur Pajak
                                </span>
                                <Input
                                    value={formData.no_fakturpajak}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            no_fakturpajak: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">PPN</span>
                                <Input
                                    value={formData.ppn}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            ppn: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Ref PO In</span>
                                <Input value={formData.ref_po_in} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Kode Customer
                                </span>
                                <Input value={formData.kd_cs} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nama Customer
                                </span>
                                <Input value={formData.nm_cs} readOnly />
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
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>List Data Material DO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No DO</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialsLoading &&
                                            doMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        Memuat data material DO...
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {!materialsLoading &&
                                            doMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        Tidak ada data material
                                                        DO.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {doMaterials.map((item) => (
                                            <TableRow
                                                key={`do-${item.no_do}-${item.mat}`}
                                                className="cursor-pointer hover:bg-muted/60"
                                                onClick={() =>
                                                    handleSelectMaterial(item, 'do')
                                                }
                                            >
                                                <TableCell>{item.no_do}</TableCell>
                                                <TableCell>{item.mat}</TableCell>
                                                <TableCell>{item.qty}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.harga)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>List Data Material DO Add</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No DOT</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialsLoading &&
                                            doAddMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        Memuat data material DO
                                                        Add...
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {!materialsLoading &&
                                            doAddMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        Tidak ada data material
                                                        DO Add.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {doAddMaterials.map((item) => (
                                            <TableRow
                                                key={`dot-${item.no_dob}-${item.mat}`}
                                                className="cursor-pointer hover:bg-muted/60"
                                                onClick={() =>
                                                    handleSelectMaterial(item, 'dot')
                                                }
                                            >
                                                <TableCell>{item.no_dob}</TableCell>
                                                <TableCell>{item.mat}</TableCell>
                                                <TableCell>{item.qty}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.harga)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Detail Material</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Nomor DO/DOT</Label>
                                    <Input
                                        name="no_ref"
                                        value={materialInput.no_ref}
                                        onChange={handleMaterialInputChange}
                                        readOnly={isLocked}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Kode Material</Label>
                                    <Input
                                        name="kd_material"
                                        value={materialInput.kd_material}
                                        onChange={handleMaterialInputChange}
                                        readOnly={isLocked}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Material</Label>
                                    <Input
                                        name="material"
                                        value={materialInput.material}
                                        onChange={handleMaterialInputChange}
                                        readOnly={isLocked}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Qty</Label>
                                    <Input
                                        name="qty"
                                        value={materialInput.qty}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Satuan</Label>
                                    <Input
                                        name="unit"
                                        value={materialInput.unit}
                                        onChange={handleMaterialInputChange}
                                        readOnly={isLocked}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price</Label>
                                    <Input
                                        name="price"
                                        value={materialInput.price}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input
                                        name="total"
                                        value={materialInput.total}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>HPP</Label>
                                    <Input
                                        name="hpp"
                                        value={materialInput.hpp}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total HPP</Label>
                                    <Input
                                        value={formatRupiah(materialInput.total_hpp)}
                                        readOnly
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button type="button" onClick={handleUpsertRow}>
                                        Simpan Detail
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Material DO dan DOT</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No</TableHead>
                                            <TableHead>No DO/DOT</TableHead>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total Price</TableHead>
                                            <TableHead>Hpp</TableHead>
                                            <TableHead>Total Hpp</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11}>
                                                    Belum ada data material.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {materialRows.map((item, index) => (
                                            <TableRow
                                                key={`${item.no_ref}-${item.kd_material}`}
                                                className="cursor-pointer hover:bg-muted/60"
                                                onClick={() => handleRowClick(item)}
                                            >
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>{item.no_ref}</TableCell>
                                                <TableCell>
                                                    {item.kd_material}
                                                </TableCell>
                                                <TableCell>{item.material}</TableCell>
                                                <TableCell>{item.qty}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.price)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.hpp)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total_hpp)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleDeleteRow(item);
                                                        }}
                                                    >
                                                        Hapus
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Ringkasan</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Grand Total Price</Label>
                                    <Input value={formatRupiah(grandTotalPrice)} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total PPN</Label>
                                    <Input value={formatRupiah(totalPpn)} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total HPP</Label>
                                    <Input value={formatRupiah(grandTotalHpp)} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Margin</Label>
                                    <Input value={`${formatNumber(margin)}%`} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total Price + PPN</Label>
                                    <Input value={formatRupiah(grandTotalWithPpn)} readOnly />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
