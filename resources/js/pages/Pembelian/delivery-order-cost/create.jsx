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
import { ArrowLeft, ArrowRight, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

export default function DeliveryOrderCostCreate() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        date: formatDate(new Date()),
        ref_permintaan: '',
        kd_cs: '',
        nm_cs: '',
        items: [],
    });

    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialList, setMaterialList] = useState([]);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialPage, setMaterialPage] = useState(1);
    const [materialTotalPages, setMaterialTotalPages] = useState(1);

    const [inputItem, setInputItem] = useState({
        kd_mat: '',
        material: '',
        qty: '',
        unit: '',
        remark: '',
        price: '',
        total: '',
    });

    const fetchMaterials = (page = 1) => {
        setMaterialLoading(true);
        fetch(
            `/pembelian/delivery-order-cost/materials?search=${encodeURIComponent(
                materialSearchTerm,
            )}&page=${page}&per_page=${encodeURIComponent(materialPageSize)}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setMaterialList(Array.isArray(data?.data) ? data.data : []);
                setMaterialPage(data?.current_page ?? 1);
                setMaterialTotalPages(data?.last_page ?? 1);
            })
            .catch(() => {
                setMaterialList([]);
            })
            .finally(() => {
                setMaterialLoading(false);
            });
    };

    useEffect(() => {
        if (isMaterialModalOpen) {
            fetchMaterials(1);
        }
    }, [isMaterialModalOpen, materialSearchTerm, materialPageSize]);

    const handleSelectMaterial = (item) => {
        const price = item.harga ?? '';
        const qtyValue = Number(inputItem.qty || 0);
        const total = Number(price || 0) * qtyValue;

        setInputItem({
            kd_mat: item.kd_material ?? '',
            material: item.material ?? '',
            qty: inputItem.qty ?? '',
            unit: item.unit ?? '',
            remark: item.remark ?? '',
            price: price,
            total: total,
        });
        setIsMaterialModalOpen(false);
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setInputItem((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'qty') {
                const qtyVal = Number(value || 0);
                next.total = Number(prev.price || 0) * qtyVal;
            }
            if (name === 'price') {
                const priceVal = Number(value || 0);
                next.total = priceVal * Number(prev.qty || 0);
            }
            return next;
        });
    };

    const handleAddItem = () => {
        if (!inputItem.material || !inputItem.qty) {
            return;
        }
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    ...inputItem,
                },
            ],
        }));
        setInputItem({
            kd_mat: '',
            material: '',
            qty: '',
            unit: '',
            remark: '',
            price: '',
            total: '',
        });
    };

    const handleRemoveItem = (index) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const handleSubmit = () => {
        if (!formData.ref_permintaan || formData.items.length === 0) {
            return;
        }
        router.post(
            '/pembelian/delivery-order-cost',
            {
                date: formData.date,
                ref_permintaan: formData.ref_permintaan,
                kd_cs: formData.kd_cs,
                nm_cs: formData.nm_cs,
                items: formData.items.map((item, index) => ({
                    no: index + 1,
                    kd_mat: item.kd_mat,
                    mat: item.material,
                    qty: item.qty,
                    unit: item.unit,
                    remark: item.remark,
                    harga: item.price,
                    total: item.total,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    const materialPaginationText = useMemo(
        () => `Page ${materialPage} of ${materialTotalPages}`,
        [materialPage, materialTotalPages],
    );

    return (
                <AppLayout
                    breadcrumbs={[
                        { title: 'Dashboard', href: '/dashboard' },
                        { title: 'Pembelian', href: '/pembelian/delivery-order-cost' },
                        { title: 'Create DO Biaya', href: '#' },
                    ]}
                >
                    <Head title="Create Delivery Order Cost" />
            <div className="flex-1 p-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                            Buat Delivery Order Cost
                    </h1>
                    <div className="text-sm text-muted-foreground">
                        Step {step} of 2
                    </div>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Permintaan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                    <Label>Alokasi Biaya</Label>
                                    <Input
                                        value={formData.ref_permintaan}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                ref_permintaan:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Departement</Label>
                                    <Input
                                        value={formData.kd_cs}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                kd_cs: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nama Pemohon</Label>
                                    <Input
                                        value={formData.nm_cs}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                nm_cs: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={nextStep}
                                    disabled={!formData.ref_permintaan}
                                >
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
                                        <Label>Cari Material</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setIsMaterialModalOpen(true)
                                                }
                                                className="w-full justify-start"
                                            >
                                                <Search className="mr-2 h-4 w-4" />
                                                {inputItem.material
                                                    ? inputItem.material
                                                    : 'Cari material...'}
                                            </Button>
                                        </div>
                                    </div>
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
                                        <Input readOnly value={inputItem.unit} />
                                    </div>
                                    <div className="space-y-2 lg:col-span-2">
                                        <Label>Remark</Label>
                                        <Input
                                            readOnly
                                            value={inputItem.remark}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Price</Label>
                                        <Input
                                            name="price"
                                            value={inputItem.price}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Price</Label>
                                        <Input readOnly value={inputItem.total} />
                                    </div>
                                    <div className="flex items-end justify-end lg:col-span-4">
                                        <Button
                                            onClick={handleAddItem}
                                            disabled={!inputItem.material}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Tambah Data
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                        Data Material DO Biaya
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
                                                    <TableHead>Price</TableHead>
                                                    <TableHead>Total</TableHead>
                                                    <TableHead>Remark</TableHead>
                                                    <TableHead className="w-[70px]">
                                                        Aksi
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formData.items.map(
                                                    (item, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>
                                                                {i + 1}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.kd_mat}
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
                                                                {item.price}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.total}
                                                            </TableCell>
                                                            <TableCell>
                                                                {renderValue(
                                                                    item.remark,
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        handleRemoveItem(
                                                                            i,
                                                                        )
                                                                    }
                                                                    aria-label="Hapus"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ),
                                                )}
                                                {formData.items.length ===
                                                    0 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={9}
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
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={
                                    isSubmitting || formData.items.length === 0
                                }
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={isMaterialModalOpen}
                onOpenChange={setIsMaterialModalOpen}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Cari Material</DialogTitle>
                        <DialogDescription>
                            Pilih material untuk DO biaya.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <label className="text-sm text-muted-foreground">
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
                                            : Number(value),
                                    );
                                }}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <div className="flex flex-1 items-center gap-2">
                            <Input
                                placeholder="Cari material..."
                                value={materialSearchTerm}
                                onChange={(event) =>
                                    setMaterialSearchTerm(event.target.value)
                                }
                            />
                            <Button onClick={() => fetchMaterials(1)}>
                                Cari
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Satuan</TableHead>
                                    <TableHead>Remark</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {materialLoading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center"
                                        >
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : materialList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center"
                                        >
                                            Tidak ada data material.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    materialList.map((item) => (
                                        <TableRow key={item.kd_material}>
                                            <TableCell>
                                                {item.material}
                                            </TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell>{item.remark}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSelectMaterial(
                                                            item,
                                                        )
                                                    }
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

                    {materialPageSize !== Infinity && materialList.length > 0 && (
                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    fetchMaterials(materialPage - 1)
                                }
                                disabled={materialPage <= 1}
                            >
                                Prev
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                {materialPaginationText}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    fetchMaterials(materialPage + 1)
                                }
                                disabled={materialPage >= materialTotalPages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
