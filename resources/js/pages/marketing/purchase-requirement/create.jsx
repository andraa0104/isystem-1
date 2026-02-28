import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Check, Plus, Search, Trash2 } from 'lucide-react';
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

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value).replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatMargin = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const numeric = parseNumber(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '';
};

const formatRupiah = (value) => {
    const numeric = parseNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }

    return `Rp ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(numeric))}`;
};

const parseRupiahInput = (value) => {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
    return digitsOnly;
};

const calculateMargin = (hargaPoIn, hargaModal) => {
    const poIn = parseNumber(hargaPoIn);
    const modal = parseNumber(hargaModal);

    if (modal <= 0) {
        return '';
    }

    const margin = ((poIn - modal) / modal) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qtyPr, hargaModal) => {
    const qty = parseNumber(qtyPr);
    const modal = parseNumber(hargaModal);
    if (qty <= 0 || modal <= 0) {
        return '';
    }
    return (qty * modal).toFixed(2);
};

export default function PurchaseRequirementCreate() {
    const { tenant } = usePage().props;
    const dbPrefix = (tenant?.database ?? '').toLowerCase().replace(/^db/, '').toUpperCase();
    const stokValue = dbPrefix ? `STOK ${dbPrefix}` : 'STOK';

    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
    const [customerList, setCustomerList] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [poinMaterialLoading, setPoinMaterialLoading] = useState(false);
    const [poinMaterialError, setPoinMaterialError] = useState('');
    const [submitError, setSubmitError] = useState('');

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPo: '',
        forCustomer: '',
        payment: 'Cash Trans',
        isStok: false,
    });

    const [materialItems, setMaterialItems] = useState([]);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState('');

    const [materialForm, setMaterialForm] = useState({
        kodeMaterial: '',
        namaMaterial: '',
        satuan: '',
        quantity: '',
        lastStock: 0,
        priceEstimate: '',
        totalPrice: 0,
        remark: '',
    });

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

    const loadCustomers = async () => {
        setCustomerLoading(true);
        setCustomerError('');

        try {
            const params = new URLSearchParams();
            params.set('per_page', customerPageSize === Infinity ? 'all' : String(customerPageSize));
            params.set('page', String(customerCurrentPage));
            if (customerSearchTerm.trim()) {
                params.set('search', customerSearchTerm.trim());
            }

            const response = await fetch(
                `/marketing/purchase-requirement/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            setCustomerList(Array.isArray(data?.customers) ? data.customers : []);
            setCustomerTotal(Number(data?.total ?? 0));
        } catch {
            setCustomerError('Gagal memuat data PO In.');
        } finally {
            setCustomerLoading(false);
        }
    };

    const loadMaterials = async () => {
        setMaterialLoading(true);
        setMaterialError('');

        try {
            const params = new URLSearchParams();
            params.set('per_page', materialPageSize === Infinity ? 'all' : String(materialPageSize));
            params.set('page', String(materialCurrentPage));
            if (materialSearchTerm.trim()) {
                params.set('search', materialSearchTerm.trim());
            }

            const response = await fetch(
                `/marketing/purchase-requirement/materials?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            setMaterialList(Array.isArray(data?.materials) ? data.materials : []);
            setMaterialTotal(Number(data?.total ?? 0));
        } catch {
            setMaterialError('Gagal memuat data material.');
        } finally {
            setMaterialLoading(false);
        }
    };

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(materialTotal / materialPageSize));
    }, [materialTotal, materialPageSize]);

    useEffect(() => {
        if (isMaterialModalOpen) {
            loadMaterials();
        }
    }, [isMaterialModalOpen, materialCurrentPage, materialPageSize, materialSearchTerm]);

    useEffect(() => {
        if (isCustomerModalOpen) {
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCustomerModalOpen, customerCurrentPage, customerPageSize, customerSearchTerm]);

    const loadPoInMaterials = async (kodePoin) => {
        if (!kodePoin) {
            setMaterialItems([]);
            return;
        }

        setPoinMaterialLoading(true);
        setPoinMaterialError('');

        try {
            const params = new URLSearchParams();
            params.set('kode_poin', kodePoin);

            const response = await fetch(
                `/marketing/purchase-requirement/poin-details?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            const items = Array.isArray(data?.items) ? data.items : [];

            setMaterialItems(
                items.map((item, index) => ({
                    id: item.id ?? `${Date.now()}-${index}`,
                    no: item.line_no ?? index + 1,
                    kodeMaterial: item.kd_material ?? '',
                    namaMaterial: item.material ?? '',
                    stok: item.stok ?? 0,
                    qtyPoIn: item.qty_po_in ?? 0,
                    qtyPr: item.qty_pr ?? item.qty_po_in ?? 0,
                    satuan: item.satuan ?? '',
                    hargaPoIn: item.harga_po_in ?? 0,
                    hargaModal: item.harga_modal ?? '',
                    margin: item.margin ?? '',
                    remark: item.remark ?? '',
                }))
            );
        } catch {
            setMaterialItems([]);
            setPoinMaterialError('Gagal memuat material dari PO In terpilih.');
        } finally {
            setPoinMaterialLoading(false);
        }
    };

    const handleAddManualMaterial = () => {
        if (!materialForm.kodeMaterial || parseNumber(materialForm.quantity) <= 0) {
            setSubmitError('Pilih material dan isi quantity terlebih dahulu.');
            return;
        }

        const newItem = {
            id: `manual-${Date.now()}`,
            no: materialItems.length + 1,
            kodeMaterial: materialForm.kodeMaterial,
            namaMaterial: materialForm.namaMaterial,
            stok: materialForm.lastStock,
            qtyPoIn: 0,
            qtyPr: materialForm.quantity,
            satuan: materialForm.satuan,
            hargaPoIn: 0,
            hargaModal: materialForm.priceEstimate,
            totalPrice: materialForm.totalPrice,
            margin: '',
            remark: materialForm.remark,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialForm({
            kodeMaterial: '',
            namaMaterial: '',
            satuan: '',
            quantity: '',
            lastStock: 0,
            priceEstimate: '',
            totalPrice: 0,
            remark: '',
        });
        setSubmitError('');
    };

    const updateMaterialForm = (field, value) => {
        setMaterialForm((prev) => {
            const updated = { ...prev, [field]: value };
            if (field === 'quantity' || field === 'priceEstimate') {
                updated.totalPrice = parseNumber(updated.quantity) * parseNumber(updated.priceEstimate);
            }
            return updated;
        });
    };

    const handleQtyPrChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                const qtyPr = value;
                return {
                    ...item,
                    qtyPr,
                };
            })
        );
    };

    const handleHargaModalChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }

                const hargaModal = value;
                return {
                    ...item,
                    hargaModal,
                    margin: calculateMargin(item.hargaPoIn, hargaModal),
                };
            })
        );
    };

    const handleRemarkChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          remark: value,
                      }
                    : item
            )
        );
    };

    const handleRemoveMaterial = (id) => {
        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setSubmitError('');

        if (materialItems.length === 0) {
            setSubmitError('Belum ada material dari PO In yang dipilih.');
            return;
        }

        const hasInvalidRow = materialItems.some(
            (item) => parseNumber(item.hargaModal) <= 0 || parseNumber(item.qtyPr) < 0
        );
        if (hasInvalidRow) {
            setSubmitError('Harga modal wajib diisi dan Qty PR tidak boleh negatif.');
            return;
        }

        router.post(
            '/marketing/purchase-requirement',
            {
                date: formData.date,
                payment: formData.payment,
                for_customer: formData.forCustomer,
                ref_po: formData.refPo,
                materials: materialItems.map((item, index) => ({
                    no: index + 1,
                    detail_id: String(item.id).startsWith('manual-') ? null : item.id,
                    kd_material: item.kodeMaterial,
                    material: item.namaMaterial,
                    qty: item.qtyPr,
                    unit: item.satuan,
                    stok: item.stok,
                    unit_price: item.hargaModal,
                    total_price: calculateTotalPrice(item.qtyPr, item.hargaModal),
                    price_po: formData.isStok ? item.hargaModal : item.hargaPoIn,
                    margin: formData.isStok ? 0 : item.margin,
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
            <Head title="Tambah PR" />
            <form className="flex h-full flex-1 flex-col gap-4 p-4" onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PR</h1>
                        <p className="text-sm text-muted-foreground">Isi data PR dalam dua langkah</p>
                    </div>
                    <div className="text-sm text-muted-foreground">Step {step} dari 2</div>
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
                            <div className="md:col-span-2 flex items-center space-x-3 bg-primary/5 p-4 rounded-xl border border-primary/10 mb-2">
                                <Checkbox
                                    id="stok"
                                    className="h-5 w-5"
                                    checked={formData.isStok}
                                    onCheckedChange={(checked) => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            isStok: !!checked,
                                            refPo: checked ? stokValue : (prev.refPo === stokValue ? '' : prev.refPo),
                                            forCustomer: checked ? stokValue : (prev.forCustomer === stokValue ? '' : prev.forCustomer),
                                        }));
                                    }}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="stok" className="text-sm font-bold cursor-pointer">
                                        Pesan untuk {stokValue}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Centang jika pembelian ini ditujukan untuk persediaan stok {dbPrefix} sendiri.
                                    </p>
                                </div>
                            </div>
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
                                    readOnly={formData.isStok}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refPo: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">For Customer</span>
                                <div className="flex gap-2">
                                    <Input value={formData.forCustomer} readOnly />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsCustomerModalOpen(true);
                                            setCustomerCurrentPage(1);
                                            setCustomerSearchTerm('');
                                            setCustomerList([]);
                                            setCustomerTotal(0);
                                        }}
                                    >
                                        Cari PO In
                                    </Button>
                                </div>
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
                    <div className="mx-auto w-full space-y-8 animate-in slide-in-from-right duration-500">
                        <div className="grid gap-8 lg:grid-cols-12">
                            {/* Main Entry Section */}
                            <div className="lg:col-span-8 space-y-6">
                                <Card className="border-none shadow-xl ring-1 ring-sidebar-border/70">
                                    <CardHeader className="border-b bg-muted/30">
                                        <CardTitle className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                                                {materialItems.length}
                                            </Badge>
                                            Daftar Material
                                        </CardTitle>
                                        <CardDescription>
                                            {formData.isStok ? 'Tambahkan material untuk stok melalui form di bawah.' : 'Material ditarik dari data PO In terpilih.'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {formData.isStok ? (
                                            <>
                                                <div className="border-b bg-primary/5 p-6 dark:bg-primary/10">
                                                    <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-primary">Input Material Baru</h3>
                                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                                        <div className="space-y-2 md:col-span-2 xl:col-span-5">
                                                            <Label className="text-xs">Material</Label>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <Input
                                                                        placeholder="Pilih Material..."
                                                                        className="h-10 border-primary/20 bg-background pr-10"
                                                                        value={materialForm.namaMaterial}
                                                                        readOnly
                                                                    />
                                                                    {materialForm.kodeMaterial && (
                                                                        <div className="absolute right-3 top-2.5">
                                                                            <Check className="h-5 w-5 text-green-500" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    className="h-10"
                                                                    onClick={() => setIsMaterialModalOpen(true)}
                                                                >
                                                                    <Search className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            {materialForm.kodeMaterial && (
                                                                <p className="text-[14px] font-mono text-muted-foreground">KODE MATERIAL: {materialForm.kodeMaterial}</p>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Stok Saat Ini</Label>
                                                            <Input
                                                                type="text"
                                                                className="h-10 bg-muted/50 font-bold"
                                                                value={materialForm.lastStock}
                                                                readOnly
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Quantity</Label>
                                                            <Input
                                                                type="number"
                                                                className="h-10 border-primary/20"
                                                                placeholder="0"
                                                                value={materialForm.quantity}
                                                                onChange={(e) => updateMaterialForm('quantity', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Harga Est.</Label>
                                                            <Input
                                                                type="text"
                                                                className="h-10 border-primary/20"
                                                                placeholder="Rp 0"
                                                                value={formatRupiah(materialForm.priceEstimate)}
                                                                onChange={(e) => updateMaterialForm('priceEstimate', parseRupiahInput(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className="space-y-2 md:col-span-2 xl:col-span-5">
                                                            <Label className="text-xs">Remark / Catatan</Label>
                                                            <Input
                                                                type="text"
                                                                className="h-10 border-primary/20"
                                                                placeholder="Tambahkan catatan untuk material ini..."
                                                                value={materialForm.remark}
                                                                onChange={(e) => updateMaterialForm('remark', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-4">
                                                        <div className="text-xs">
                                                            <span className="text-muted-foreground italic">Total Item: </span>
                                                            <span className="font-bold text-primary">{formatRupiah(materialForm.totalPrice)}</span>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            onClick={handleAddManualMaterial}
                                                            disabled={!materialForm.kodeMaterial || !materialForm.quantity}
                                                            className="h-10 px-6 shadow-lg shadow-primary/20"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" /> Tambah Manual
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="min-h-[200px] overflow-auto">
                                                    <Table>
                                                        <TableHeader className="bg-muted/30">
                                                            <TableRow>
                                                                <TableHead className="w-[50px] text-center">No</TableHead>
                                                                <TableHead>Deskripsi Material</TableHead>
                                                                <TableHead className="text-right">Qty</TableHead>
                                                                <TableHead>Satuan</TableHead>
                                                                <TableHead className="text-right">Harga Modal</TableHead>
                                                                <TableHead className="text-right">Total</TableHead>
                                                                <TableHead>Remark</TableHead>
                                                                <TableHead className="w-[50px]"></TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {materialItems.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                                        Belum ada material yang ditambahkan.
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                materialItems.map((item, idx) => (
                                                                    <TableRow key={item.id} className="group transition-all">
                                                                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                                                                        <TableCell className="max-w-[300px]">
                                                                            <div className="font-bold">{item.namaMaterial}</div>
                                                                            <div className="flex gap-2 text-[14px] font-mono text-muted-foreground">
                                                                                <span>{item.kodeMaterial}</span>
                                                                                <span>•</span>
                                                                                <span>STOK: {item.stok}</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-medium">{item.qtyPr}</TableCell>
                                                                        <TableCell className="text-xs uppercase text-muted-foreground">{item.satuan}</TableCell>
                                                                        <TableCell className="text-right font-medium">{formatRupiah(item.hargaModal)}</TableCell>
                                                                        <TableCell className="text-right font-bold text-primary">
                                                                            {formatRupiah(calculateTotalPrice(item.qtyPr, item.hargaModal))}
                                                                        </TableCell>
                                                                        <TableCell className="min-w-[150px]">
                                                                            <div className="text-sm text-muted-foreground italic line-clamp-2" title={item.remark}>
                                                                                {item.remark || '-'}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                                onClick={() => handleRemoveMaterial(item.id)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-4 p-6 min-h-[300px]">
                                                {materialItems.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                                        <div className="relative mb-4">
                                                            <Search className="h-16 w-16" />
                                                            <Plus className="absolute -right-2 -top-2 h-8 w-8 text-primary" />
                                                        </div>
                                                        <p className="font-bold text-xl uppercase tracking-tight">Belum Ada Data</p>
                                                        <p className="text-sm">Pilih PO In di Langkah 1 untuk memuat material.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-4">
                                                        {materialItems.map((item, idx) => (
                                                            <div key={item.id} className="relative group border border-sidebar-border bg-background rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
                                                                <div className="absolute -left-3 top-4 h-8 w-8 bg-muted border border-sidebar-border rounded-lg flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                                                                    {String(idx + 1).padStart(2, '0')}
                                                                </div>

                                                                <div className="flex flex-col md:flex-row gap-6">
                                                                    {/* Left Column: Info */}
                                                                    <div className="flex-1 space-y-3">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="space-y-1">
                                                                                <h4 className="font-black text-lg leading-tight uppercase tracking-tight group-hover:text-primary transition-colors">
                                                                                    {item.namaMaterial}
                                                                                </h4>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    <Badge variant="outline" className="font-mono text-[10px] bg-muted/30 border-none px-1.5 h-5">
                                                                                        {item.kodeMaterial}
                                                                                    </Badge>
                                                                                    {item.satuan && (
                                                                                        <Badge variant="outline" className="text-[10px] bg-primary/5 hover:bg-primary/10 border-none px-1.5 h-5">
                                                                                            {item.satuan}
                                                                                        </Badge>
                                                                                    )}
                                                                                    <span className="text-[10px] flex items-center gap-1.5 font-bold text-green-600 bg-green-50 px-2 rounded-full border border-green-100">
                                                                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                                                        Stok: {item.stok}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive group/del"
                                                                                onClick={() => handleRemoveMaterial(item.id)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 transition-transform group-hover/del:scale-110" />
                                                                            </Button>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div className="space-y-2 bg-muted/20 p-3 rounded-xl border border-dashed border-sidebar-border/50">
                                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Quantity</Label>
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[9px] font-bold text-muted-foreground opacity-50 uppercase">Order In</span>
                                                                                        <span className="font-mono font-bold">{item.qtyPoIn}</span>
                                                                                    </div>
                                                                                    <div className="h-8 w-[1px] bg-sidebar-border opacity-50" />
                                                                                    <div className="flex flex-col items-end flex-1">
                                                                                        <span className="text-[9px] font-bold text-primary uppercase">PR Input</span>
                                                                                        <div className="relative w-full max-w-[140px]">
                                                                                            <Input
                                                                                                type="number"
                                                                                                className="h-8 w-full text-right font-black border-primary/20 bg-background shadow-xs ring-offset-0 focus-visible:ring-1 focus-visible:ring-primary"
                                                                                                value={item.qtyPr}
                                                                                                onChange={(e) => handleQtyPrChange(item.id, e.target.value)}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="space-y-2 bg-muted/20 p-3 rounded-xl border border-dashed border-sidebar-border/50">
                                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Harga (IDR)</Label>
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[9px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter">PO IN</span>
                                                                                        <span className="font-mono font-bold text-xs">{formatRupiah(item.hargaPoIn)}</span>
                                                                                    </div>
                                                                                    <div className="h-8 w-[1px] bg-sidebar-border opacity-50" />
                                                                                    <div className="flex flex-col items-end flex-1">
                                                                                        <span className="text-[9px] font-bold text-primary uppercase tracking-tighter italic">Modal Est.</span>
                                                                                        <div className="relative w-full max-w-[140px]">
                                                                                            <Input
                                                                                                type="text"
                                                                                                className="h-8 w-full text-right font-black border-primary/20 bg-background shadow-xs pl-5 text-sm ring-offset-0 focus-visible:ring-1 focus-visible:ring-primary"
                                                                                                value={formatRupiah(item.hargaModal)}
                                                                                                onChange={(e) => handleHargaModalChange(item.id, parseRupiahInput(e.target.value))}
                                                                                            />
                                                                                            <span className="absolute left-1.5 top-2 text-[8px] font-black opacity-30">RP</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right Column: Total & Margin */}
                                                                    <div className="md:w-64 space-y-4">
                                                                        <div className="h-full bg-primary/5 rounded-2xl p-5 border border-primary/10 flex flex-col justify-center items-center group/total">
                                                                            <div className="text-[10px] uppercase font-black tracking-widest text-primary/60 mb-1">Estimated Total</div>
                                                                            <div className="text-2xl font-black text-primary tracking-tighter group-active:scale-95 transition-transform">
                                                                                {formatRupiah(calculateTotalPrice(item.qtyPr, item.hargaModal))}
                                                                            </div>
                                                                            <div className="mt-4 flex items-center gap-2">
                                                                                <Badge
                                                                                    variant={parseNumber(item.margin) < 0 ? 'destructive' : 'outline'}
                                                                                    className={cn(
                                                                                        "font-mono text-xs px-2 h-6 border-none",
                                                                                        parseNumber(item.margin) >= 0 ? "bg-green-500 text-white" : "bg-destructive text-white"
                                                                                    )}
                                                                                >
                                                                                    {formatMargin(item.margin)}%
                                                                                </Badge>
                                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Margin</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Remark: Full Width Bottom */}
                                                                <div className="mt-4 pt-4 border-t border-dashed border-sidebar-border/50">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="rounded-full bg-muted p-1.5">
                                                                            <Plus className="h-3 w-3 text-muted-foreground rotate-45" />
                                                                        </div>
                                                                        <Input
                                                                            type="text"
                                                                            placeholder="Tulis catatan atau instruksi khusus untuk barang ini..."
                                                                            className="border-none bg-transparent hover:bg-muted/30 focus:bg-background h-8 text-xs italic shadow-none px-0"
                                                                            value={item.remark}
                                                                            onChange={(e) => handleRemarkChange(item.id, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Summary Section */}
                            <div className="lg:col-span-4 space-y-6">
                                <Card className="sticky top-24 border-none shadow-2xl ring-2 ring-primary/5 overflow-hidden">
                                    <div className="h-2 bg-primary" />
                                    <CardHeader className="bg-muted/10 pb-4">
                                        <CardTitle className="text-base uppercase tracking-wider text-muted-foreground">Summary PR</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 p-6">
                                        <div className="space-y-3 border-b pb-6 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ref No:</span>
                                                <Badge variant="secondary" className="font-mono">{formData.refPo || '-'}</Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Customer:</span>
                                                <span className="text-right font-bold max-w-[150px] truncate" title={formData.forCustomer}>{formData.forCustomer || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Metode:</span>
                                                <Badge variant="outline">{formData.payment}</Badge>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Subtotal ({materialItems.length} items)</span>
                                                <span className="text-lg font-bold">
                                                    {formatRupiah(
                                                        materialItems.reduce((acc, item) => acc + parseNumber(calculateTotalPrice(item.qtyPr, item.hargaModal)), 0)
                                                    )}
                                                </span>
                                            </div>
                                            <div className="rounded-xl bg-primary/5 p-4 text-center">
                                                <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Total Estimasi</p>
                                                <h4 className="text-2xl font-black text-primary">
                                                    {formatRupiah(
                                                        materialItems.reduce((acc, item) => acc + parseNumber(calculateTotalPrice(item.qtyPr, item.hargaModal)), 0)
                                                    )}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <Button variant="outline" type="button" className="h-12 w-full" onClick={() => setStep(1)}>
                                                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                                            </Button>
                                            <Button
                                                type="submit"
                                                className="h-12 w-full shadow-xl shadow-primary/20"
                                                disabled={isSubmitting || materialItems.length === 0}
                                            >
                                                {isSubmitting ? <Spinner /> : <><Check className="mr-2 h-5 w-5" /> Simpan</>}
                                            </Button>
                                        </div>
                                        {submitError && (
                                            <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-center text-xs font-medium text-destructive animate-bounce">
                                                {submitError}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                <Dialog
                    open={isCustomerModalOpen}
                    onOpenChange={(open) => {
                        setIsCustomerModalOpen(open);
                        if (!open) {
                            setCustomerSearchTerm('');
                            setCustomerPageSize(5);
                            setCustomerCurrentPage(1);
                            setCustomerList([]);
                            setCustomerTotal(0);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Pilih PO In</DialogTitle>
                            <DialogDescription>
                                Pilih PO In untuk mengisi Ref PO, customer, dan detail material.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={customerPageSize === Infinity ? 'all' : customerPageSize}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setCustomerPageSize(value === 'all' ? Infinity : Number(value));
                                        setCustomerCurrentPage(1);
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
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari kode PO In, no PO In, customer..."
                                    value={customerSearchTerm}
                                    onChange={(event) => {
                                        setCustomerSearchTerm(event.target.value);
                                        setCustomerCurrentPage(1);
                                    }}
                                />
                            </label>
                            <Button type="button" variant="outline" onClick={loadCustomers}>
                                Refresh
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Kode PO In</th>
                                        <th className="px-4 py-3 text-left">No PO In</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Customer</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerList.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {customerLoading
                                                    ? 'Memuat data PO In...'
                                                    : customerError || 'Tidak ada data PO In.'}
                                            </td>
                                        </tr>
                                    )}
                                    {customerList.map((item) => (
                                        <tr
                                            key={`${item.kode_poin}-${item.no_poin}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">{renderValue(item.kode_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.no_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.date_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.customer_name)}</td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            refPo: prev.isStok ? stokValue : (item.no_poin ?? ''),
                                                            forCustomer: prev.isStok ? stokValue : (item.customer_name ?? ''),
                                                        }));
                                                        setIsCustomerModalOpen(false);
                                                        loadPoInMaterials(item.kode_poin ?? '');
                                                    }}
                                                >
                                                    Pilih
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {customerPageSize !== Infinity && customerTotal > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((customerCurrentPage - 1) * customerPageSize + 1, customerTotal)}-
                                    {Math.min(customerCurrentPage * customerPageSize, customerTotal)} dari {customerTotal} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCustomerCurrentPage((p) => Math.max(1, p - 1))
                                        }
                                        disabled={customerCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {customerCurrentPage} dari {customerTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCustomerCurrentPage((p) => Math.min(customerTotalPages || p, p + 1))
                                        }
                                        disabled={customerCurrentPage >= customerTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
                    <Dialog
                    open={isMaterialModalOpen}
                    onOpenChange={setIsMaterialModalOpen}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto flex flex-col p-0 border-none shadow-2xl">
                        <DialogHeader className="p-6 bg-muted/30 border-b">
                            <DialogTitle className="text-xl">Pilih Material</DialogTitle>
                            <DialogDescription>
                                Pilih material dari database inventory untuk PR ini.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 flex-1 overflow-auto space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Per Page</Label>
                                    <select
                                        className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
                                        value={materialPageSize === Infinity ? 'all' : materialPageSize}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setMaterialPageSize(value === 'all' ? Infinity : Number(value));
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
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9 h-10 border-sidebar-border"
                                        placeholder="Cari kode atau nama material..."
                                        value={materialSearchTerm}
                                        onChange={(event) => {
                                            setMaterialSearchTerm(event.target.value);
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
                                            <TableHead className="text-right">Stok</TableHead>
                                            <TableHead className="text-right">Harga Est.</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialList.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                    {materialLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Spinner /> Memuat data...
                                                        </div>
                                                    ) : materialError || 'Tidak ada data material.'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            materialList.map((m) => (
                                                <TableRow key={m.kd_material}>
                                                    <TableCell className="font-mono text-xs">{m.kd_material}</TableCell>
                                                    <TableCell className="font-medium">{m.material}</TableCell>
                                                    <TableCell className="text-xs uppercase text-muted-foreground">{m.unit}</TableCell>
                                                    <TableCell className="text-right">{m.stok}</TableCell>
                                                    <TableCell className="text-right font-bold text-primary">{formatRupiah(m.harga)}</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-8"
                                                            onClick={() => {
                                                                updateMaterialForm('kodeMaterial', m.kd_material);
                                                                updateMaterialForm('namaMaterial', m.material);
                                                                updateMaterialForm('satuan', m.unit);
                                                                updateMaterialForm('lastStock', m.stok);
                                                                updateMaterialForm('priceEstimate', m.harga || 0);
                                                                setIsMaterialModalOpen(false);
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

                            {materialPageSize !== Infinity && materialTotal > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground pt-2">
                                    <span>
                                        Menampilkan {Math.min((materialCurrentPage - 1) * materialPageSize + 1, materialTotal)}-
                                        {Math.min(materialCurrentPage * materialPageSize, materialTotal)} dari {materialTotal} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMaterialCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={materialCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm font-medium text-foreground">
                                            {materialCurrentPage} / {materialTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMaterialCurrentPage((p) => Math.min(materialTotalPages || p, p + 1))}
                                            disabled={materialCurrentPage >= materialTotalPages}
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
