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

export default function DeliveryOrderAddCreate() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        date: formatDate(new Date()),
        ref_do: '',
        ref_po: '',
        kd_cs: '',
        nm_cs: '',
        items: [],
    });

    const [refPo, setRefPo] = useState('');

    const [isDoModalOpen, setIsDoModalOpen] = useState(false);
    const [doLoading, setDoLoading] = useState(false);
    const [doList, setDoList] = useState([]);
    const [doSearchTerm, setDoSearchTerm] = useState('');
    const [doPageSize, setDoPageSize] = useState(5);
    const [doCurrentPage, setDoCurrentPage] = useState(1);

    const [sourceItems, setSourceItems] = useState([]);
    const [inputItem, setInputItem] = useState({
        kd_material: '',
        material: '',
        qty: '',
        unit: '',
        remark: '',
        price: '',
        total: '',
        last_stock: 0,
        stock_now: 0,
    });
    const [materialPrices, setMaterialPrices] = useState([]);

    const filteredDoList = useMemo(() => {
        const term = doSearchTerm.trim().toLowerCase();
        if (!term) {
            return doList;
        }
        return doList.filter((item) => {
            return (
                String(item.no_do ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.ref_po ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.nm_cs ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });
    }, [doList, doSearchTerm]);

    const doTotalItems = filteredDoList.length;
    const doTotalPages = useMemo(() => {
        if (doPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(doTotalItems / doPageSize));
    }, [doPageSize, doTotalItems]);

    const displayedDoList = useMemo(() => {
        if (doPageSize === Infinity) {
            return filteredDoList;
        }
        const startIndex = (doCurrentPage - 1) * doPageSize;
        return filteredDoList.slice(startIndex, startIndex + doPageSize);
    }, [doCurrentPage, doPageSize, filteredDoList]);

    const fetchOutstandingDo = () => {
        if (doLoading || doList.length > 0) {
            return;
        }
        setDoLoading(true);
        fetch('/marketing/delivery-order-add/outstanding-do', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setDoList(
                    Array.isArray(data?.deliveryOrders)
                        ? data.deliveryOrders
                        : [],
                );
            })
            .catch(() => {
                setDoList([]);
            })
            .finally(() => {
                setDoLoading(false);
            });
    };

    useEffect(() => {
        if (isDoModalOpen) {
            fetchOutstandingDo();
        }
    }, [isDoModalOpen]);

    useEffect(() => {
        setDoCurrentPage(1);
    }, [doPageSize, doSearchTerm]);

    useEffect(() => {
        if (doCurrentPage > doTotalPages) {
            setDoCurrentPage(doTotalPages);
        }
    }, [doCurrentPage, doTotalPages]);

    const handleSelectDo = (item) => {
        setFormData((prev) => ({
            ...prev,
            ref_do: item.no_do,
            ref_po: item.ref_po ?? '',
            kd_cs: item.kd_cs ?? '',
            nm_cs: item.nm_cs ?? '',
        }));
        setRefPo(item.ref_po ?? '');
        setIsDoModalOpen(false);
        setSourceItems([]);
    };

    const fetchMaterials = () => {
        if (!refPo) {
            setSourceItems([]);
            return;
        }
        fetch(
            `/marketing/delivery-order-add/pr-materials?ref_po=${encodeURIComponent(
                refPo,
            )}`,
            {
                headers: { Accept: 'application/json' },
            },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setSourceItems(Array.isArray(data?.items) ? data.items : []);
            })
            .catch(() => {
                setSourceItems([]);
            });
    };

    const loadMaterialPrices = () => {
        if (materialPrices.length > 0) return;
        fetch('/marketing/purchase-requirement/materials', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setMaterialPrices(Array.isArray(data?.materials) ? data.materials : []);
            })
            .catch(() => {
                setMaterialPrices([]);
            });
    };

    useEffect(() => {
        if (step === 2) {
            fetchMaterials();
            loadMaterialPrices();
        }
    }, [step, refPo]);

    const getPriceByKd = (kd) => {
        const found = materialPrices.find(
            (m) => String(m.kd_material) === String(kd),
        );
        return found?.harga ?? '';
    };

    const handleSourceItemClick = (item) => {
        const qty = item.sisa_pr ?? item.qty ?? '';
        const priceRaw =
            getPriceByKd(item.kd_material) ??
            item.price_po ??
            item.harga ??
            0;
        const price = Number(priceRaw || 0);
        const lastStock = Number(item.last_stock || 0);
        const stockNow = Number(qty || 0) - lastStock;
        const total = price * Number(qty || 0);

        setInputItem({
            kd_material: item.kd_material ?? '',
            material: item.material ?? '',
            qty: qty,
            unit: item.unit ?? '',
            remark: item.remark ?? '',
            price: price,
            total: total,
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
                next.stock_now = qtyVal - Number(prev.last_stock || 0);
                next.total = Number(prev.price || 0) * qtyVal;
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
            kd_material: '',
            material: '',
            qty: '',
            unit: '',
            remark: '',
            price: '',
            total: '',
            last_stock: 0,
            stock_now: 0,
        });
    };

    const handleRemoveItem = (index) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = () => {
        if (!formData.ref_do || formData.items.length === 0) {
            return;
        }
        router.post(
            '/marketing/delivery-order-add',
            {
                date: formData.date,
                ref_do: formData.ref_do,
                ref_po: formData.ref_po,
                kd_cs: formData.kd_cs,
                nm_cs: formData.nm_cs,
                items: formData.items.map((item, index) => ({
                    no: index + 1,
                    kd_mat: item.kd_material,
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

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Marketing', href: '/marketing/delivery-order-add' },
                { title: 'Create DOB', href: '#' },
            ]}
        >
            <Head title="Create Delivery Order Add" />
            <div className="flex-1 p-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        Buat Delivery Order Add
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
                                    <Label>Cari DO</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setIsDoModalOpen(true)
                                            }
                                            className="w-full justify-start"
                                        >
                                            <Search className="mr-2 h-4 w-4" />
                                            {formData.ref_do ||
                                                'Cari DO Outstanding...'}
                                        </Button>
                                    </div>
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
                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={nextStep}
                                    disabled={!formData.ref_do}
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
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                        List Material dari PR
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
                                                    <TableHead className="w-[120px]">
                                                        Satuan
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sourceItems.map((item, i) => (
                                                    <TableRow
                                                        key={i}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() =>
                                                            handleSourceItemClick(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        <TableCell>
                                                            {renderValue(
                                                                item.no ?? i + 1,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.material}
                                                        </TableCell>
                                                        <TableCell>
                                                            {renderValue(
                                                                item.sisa_pr,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.unit}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {sourceItems.length === 0 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={4}
                                                            className="text-center"
                                                        >
                                                            Tidak ada data
                                                            material.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

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
                                        <Input readOnly value={inputItem.price} />
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
                                                                {
                                                                    item.kd_material
                                                                }
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
                                                                {item.remark}
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
                                    isSubmitting ||
                                    !formData.ref_do ||
                                    formData.items.length === 0
                                }
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={isDoModalOpen} onOpenChange={setIsDoModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Cari DO Outstanding</DialogTitle>
                        <DialogDescription>
                            Pilih DO outstanding untuk membuat DOB.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={
                                    doPageSize === Infinity ? 'all' : doPageSize
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setDoPageSize(
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
                                placeholder="Cari No DO, Ref PO, Customer..."
                                value={doSearchTerm}
                                onChange={(event) =>
                                    setDoSearchTerm(event.target.value)
                                }
                            />
                            <Button onClick={() => fetchOutstandingDo()}>
                                Cari
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead>No DO</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ref PO</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {doLoading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center"
                                        >
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : displayedDoList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center"
                                        >
                                            Tidak ada DO outstanding.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedDoList.map((item) => (
                                        <TableRow key={item.no_do}>
                                            <TableCell>{item.no_do}</TableCell>
                                            <TableCell>{item.date}</TableCell>
                                            <TableCell>{item.ref_po}</TableCell>
                                            <TableCell>{item.nm_cs}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSelectDo(item)
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

                    {doPageSize !== Infinity && doTotalItems > 0 && (
                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setDoCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                disabled={doCurrentPage === 1}
                            >
                                Prev
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {doCurrentPage} of {doTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setDoCurrentPage((page) =>
                                        Math.min(doTotalPages, page + 1),
                                    )
                                }
                                disabled={doCurrentPage === doTotalPages}
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
