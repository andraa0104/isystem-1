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
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

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

export default function DeliveryOrderCreate() {
    const { auth } = usePage().props;
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        date: formatDate(new Date()),
        ref_po: '',
        kd_cs: '',
        nm_cs: '',
        items: [], // Added items
    });

    // Step 1: PR Search
    const [isPrModalOpen, setIsPrModalOpen] = useState(false);
    const [prSearchTerm, setPrSearchTerm] = useState('');
    const [prList, setPrList] = useState([]);
    const [prLoading, setPrLoading] = useState(false);
    const [prPage, setPrPage] = useState(1);
    const [prTotalPages, setPrTotalPages] = useState(1);
    const [selectedPrNo, setSelectedPrNo] = useState(null);
    const [prPageSize, setPrPageSize] = useState(10);

    // Step 2: Details
    const [sourceItems, setSourceItems] = useState([]); // Items from PR
    const [inputItem, setInputItem] = useState({
        kd_material: '',
        material: '',
        qty: '',
        unit: '',
        remark: '',
        last_stock: 0,
        stock_now: 0,
    });

    // --- Step 1 Handler ---
    const fetchPrs = async (page = 1) => {
        setPrLoading(true);
        try {
            const response = await axios.get(
                '/marketing/delivery-order/search-pr',
                {
                    params: {
                        search: prSearchTerm,
                        page,
                        per_page: prPageSize,
                    },
                },
            );
            setPrList(response.data.data);
            setPrTotalPages(response.data.last_page);
            setPrPage(response.data.current_page);
        } catch (error) {
            console.error('Error fetching PRs', error);
        } finally {
            setPrLoading(false);
        }
    };

    useEffect(() => {
        if (isPrModalOpen) {
            fetchPrs(1);
        }
    }, [isPrModalOpen, prSearchTerm, prPageSize]);

    const handleSelectPr = async (pr) => {
        if (!pr) return;
        setSelectedPrNo(pr.no_pr);

        try {
            const response = await axios.get(
                '/marketing/delivery-order/get-pr-details',
                {
                    params: { no_pr: pr.no_pr },
                },
            );
            const { pr: prData, kd_cs, items } = response.data;

            setFormData((prev) => ({
                ...prev,
                ref_po: prData.ref_po,
                nm_cs: prData.for_customer,
                kd_cs: kd_cs, // From tb_cs
            }));

            setSourceItems(items);
            setIsPrModalOpen(false);
        } catch (error) {
            console.error('Error details', error);
        }
    };

    // --- Step 2 Handler ---
    const handleSourceItemClick = (item) => {
        const qty = item.qty || item.sisa_pr; // Default to qty/sisa
        const lastStock = Number(item.last_stock || 0);
        const stockNow = lastStock - Number(qty);

        setInputItem({
            kd_material: item.kd_material,
            material: item.material,
            qty: qty,
            unit: item.unit,
            remark: item.remark,
            last_stock: lastStock,
            stock_now: stockNow,
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputItem((prev) => {
            const newValue = { ...prev, [name]: value };
            if (name === 'qty') {
                const qtyVal = Number(value || 0);
                newValue.stock_now = prev.last_stock - qtyVal;
            }
            return newValue;
        });
    };

    const handleAddItem = () => {
        if (!inputItem.material) return;
        setFormData((prev) => ({
            ...prev,
            items: [...prev.items, { ...inputItem }],
        }));
        // Reset or keep? Usually reset after add
        setInputItem({
            kd_material: '',
            material: '',
            qty: '',
            unit: '',
            remark: '',
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

    // --- Navigation ---
    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const handleSubmit = () => {
        if (!selectedPrNo || formData.items.length === 0) {
            return;
        }

        router.post(
            '/marketing/delivery-order',
            {
                date: formData.date,
                ref_po: formData.ref_po,
                kd_cs: formData.kd_cs,
                nm_cs: formData.nm_cs,
                ref_pr: selectedPrNo,
                items: formData.items.map((item, index) => ({
                    no: index + 1,
                    kd_material: item.kd_material,
                    material: item.material,
                    qty: item.qty,
                    unit: item.unit,
                    remark: item.remark,
                    stock_now: item.stock_now,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Marketing', href: '/marketing/delivery-order' },
                { title: 'Create DO', href: '#' },
            ]}
        >
            <Head title="Create Delivery Order" />
            <div className="flex-1 p-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Buat Delivery Order</h1>
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
                                    <Label>Cari PR</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setIsPrModalOpen(true)
                                            }
                                            className="w-full justify-start"
                                        >
                                            <Search className="mr-2 h-4 w-4" />
                                            {selectedPrNo ??
                                                'Cari PR Outstanding...'}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                date: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ref PO</Label>
                                    <Input
                                        value={formData.ref_po}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                ref_po: e.target.value,
                                            })
                                        }
                                    />
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
                                    disabled={!formData.ref_po}
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
                                {/* Table 1: Source */}
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                        List Material dari PR
                                    </h3>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
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
                                                            {item.material}
                                                        </TableCell>
                                                        <TableCell>
                                                            {renderValue(
                                                                item.qty ||
                                                                    item.sisa_pr,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.unit}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.remark}
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

                                {/* Inputs */}
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
                                    <div className="flex items-end justify-end lg:col-span-4">
                                        <Button
                                            onClick={handleAddItem}
                                            disabled={!inputItem.material}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Tambah Material
                                        </Button>
                                    </div>
                                </div>

                                {/* Table 2: Added Items */}
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
                                                        <TableRow key={i}>
                                                            <TableCell>
                                                                {i + 1}
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
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleRemoveItem(
                                                                            i,
                                                                        )
                                                                    }
                                                                >
                                                                    Del
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
                                    !selectedPrNo ||
                                    formData.items.length === 0
                                }
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Simpan DO'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Cari PR */}
            <Dialog open={isPrModalOpen} onOpenChange={setIsPrModalOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Cari PR Outstanding</DialogTitle>
                        <DialogDescription>
                            Pilih PR outstanding untuk mengisi data DO.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={prPageSize === Infinity ? 'all' : prPageSize}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPrPageSize(
                                        value === 'all'
                                            ? Infinity
                                            : Number(value)
                                    );
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <div className="flex flex-1 items-center gap-2">
                        <Input
                            placeholder="Cari No PR, Ref PO, Customer..."
                            value={prSearchTerm}
                            onChange={(e) => setPrSearchTerm(e.target.value)}
                        />
                        <Button onClick={() => fetchPrs(1)}>Cari</Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead>No PR</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ref PO</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {prLoading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center"
                                        >
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : prList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center"
                                        >
                                            Tidak ada data PR outstanding.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    prList.map((pr) => (
                                        <TableRow
                                            key={pr.no_pr}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleSelectPr(pr)}
                                        >
                                            <TableCell>{pr.no_pr}</TableCell>
                                            <TableCell>{pr.date}</TableCell>
                                            <TableCell>{pr.ref_po}</TableCell>
                                            <TableCell>
                                                {pr.for_customer}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSelectPr(pr)
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

                    {prPageSize !== Infinity && (
                        <div className="flex items-center justify-between pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPrs(prPage - 1)}
                            disabled={prPage <= 1}
                        >
                            Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {prPage} of {prTotalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPrs(prPage + 1)}
                            disabled={prPage >= prTotalPages}
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
