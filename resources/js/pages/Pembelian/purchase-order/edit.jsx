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
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Pencil, Trash2 } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Purchase Order', href: '/pembelian/purchase-order' },
    { title: 'Edit PO', href: '/pembelian/purchase-order' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const parseNumber = (value) => {
    const normalized = String(value ?? '')
        .replace(/,/g, '')
        .replace(/[^\d.-]/g, '')
        .trim();
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiah = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return 'Rp. 0';
    }
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const normalizeDateInput = (value) => {
    if (!value) return '';
    // if already ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // accept dd.mm.yyyy or dd/mm/yyyy
    const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
        const [_, d, m, y] = match;
        const year = String(y).length === 2 ? `20${y}` : y.padStart(4, '0');
        return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // fallback to Date parse
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return '';
};

export default function PurchaseOrderEdit({
    purchaseOrder = {},
    purchaseOrderDetails = [],
    purchaseRequirements = [],
    purchaseRequirementDetails = [],
    vendors = [],
}) {
    const [step, setStep] = useState(1);
    const [isPrModalOpen, setIsPrModalOpen] = useState(false);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savingMaterialId, setSavingMaterialId] = useState(null);

    const [prSearchTerm, setPrSearchTerm] = useState('');
    const [prPageSize, setPrPageSize] = useState(10);
    const [prCurrentPage, setPrCurrentPage] = useState(1);

    const [vendorSearchTerm, setVendorSearchTerm] = useState('');
    const [vendorPageSize, setVendorPageSize] = useState(10);
    const [vendorCurrentPage, setVendorCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        refPr: '',
        refQuota: '',
        forCustomer: '',
        refPoMasuk: '',
        noPo: '',
        date: '',
        kodeVendor: '',
        namaVendor: '',
        attended: '',
        ppn: '',
        paymentTerms: '',
        deliveryTime: '',
        francoLoco: '',
        note1: '',
        note2: '',
        note3: '',
        note4: '',
    });

    const [materialForm, setMaterialForm] = useState({
        kodeMaterial: '',
        material: '',
        qty: '',
        satuan: '',
        price: '',
        ppn: '',
    });
    const [includePpn, setIncludePpn] = useState(false);
    const [editingMaterialId, setEditingMaterialId] = useState(null);
    const [materialItems, setMaterialItems] = useState([]);

    const filteredPr = useMemo(() => {
        const term = prSearchTerm.trim().toLowerCase();
        if (!term) {
            return purchaseRequirements;
        }

        return purchaseRequirements.filter((item) => {
            const values = [item.no_pr, item.ref_po, item.for_customer];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [prSearchTerm, purchaseRequirements]);

    const prTotalItems = filteredPr.length;
    const prTotalPages = useMemo(() => {
        if (prPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(prTotalItems / prPageSize));
    }, [prPageSize, prTotalItems]);

    const displayedPr = useMemo(() => {
        if (prPageSize === Infinity) {
            return filteredPr;
        }

        const startIndex = (prCurrentPage - 1) * prPageSize;
        return filteredPr.slice(startIndex, startIndex + prPageSize);
    }, [filteredPr, prCurrentPage, prPageSize]);

    const filteredVendors = useMemo(() => {
        const term = vendorSearchTerm.trim().toLowerCase();
        if (!term) {
            return vendors;
        }

        return vendors.filter((item) =>
            String(item.nm_vdr ?? '').toLowerCase().includes(term)
        );
    }, [vendorSearchTerm, vendors]);

    const vendorTotalItems = filteredVendors.length;
    const vendorTotalPages = useMemo(() => {
        if (vendorPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(vendorTotalItems / vendorPageSize));
    }, [vendorPageSize, vendorTotalItems]);

    const displayedVendors = useMemo(() => {
        if (vendorPageSize === Infinity) {
            return filteredVendors;
        }
        const startIndex = (vendorCurrentPage - 1) * vendorPageSize;
        return filteredVendors.slice(startIndex, startIndex + vendorPageSize);
    }, [filteredVendors, vendorCurrentPage, vendorPageSize]);

    const basePriceValue = parseNumber(materialForm.price);
    const appliedPpnRaw = includePpn
        ? parseNumber(formData.ppn)
        : parseNumber(materialForm.ppn);
    const ppnRate = Number.isFinite(appliedPpnRaw) ? appliedPpnRaw / 100 : 0;
    const divisor = includePpn ? 1 + ppnRate : 1;
    const netPrice = divisor ? basePriceValue / divisor : basePriceValue;
    const isPriceEmpty =
        materialForm.price === '' || materialForm.price === null || Number.isNaN(materialForm.price);
    const qtyValue = parseNumber(materialForm.qty);
    const grossAmount = qtyValue * (includePpn ? basePriceValue : netPrice);
    const totalPriceValue = isPriceEmpty ? '' : grossAmount;
    const ppnTotal = includePpn
        ? grossAmount - qtyValue * netPrice // PPN yang tercakup dalam harga
        : 0;

    const handlePrSelect = (item) => {
        setFormData((prev) => ({
            ...prev,
            refPr: item.no_pr ?? '',
            forCustomer: item.for_customer ?? '',
            refPoMasuk: item.ref_po ?? '',
            noPo: item.no_po ?? prev.noPo,
        }));
        setIsPrModalOpen(false);
    };

    const handleVendorSelect = (item) => {
        setFormData((prev) => ({
            ...prev,
            kodeVendor: item.kd_vdr ?? '',
            namaVendor: item.nm_vdr ?? '',
            attended: item.attn_vdr ?? '',
        }));
        setIsVendorModalOpen(false);
    };

    const handleEditMaterial = (item) => {
        setEditingMaterialId(item.id);
        setSavingMaterialId(null);
        setMaterialForm({
            kodeMaterial: item.kodeMaterial ?? '',
            material: item.material ?? '',
            qty: item.qty ?? '',
            satuan: item.satuan ?? '',
            price: item.price ?? '',
            // PPN tetap sesuai detail; jangan auto-isi dari step 2
            ppn: item.ppn ?? '',
            inEx: item.inEx ?? 'EX',
        });
        setIncludePpn((item.inEx ?? 'EX') === 'IN');
    };

    const handleDeleteMaterial = (item) => {
        if (!purchaseOrder?.no_po) return;

        Swal.fire({
            title: 'Hapus material?',
            text: `Kode ${item.kodeMaterial}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.delete(
                `/pembelian/purchase-order/${encodeURIComponent(
                    purchaseOrder.no_po
                )}/detail/${encodeURIComponent(item.kodeMaterial)}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setMaterialItems((prev) =>
                            prev.filter(
                                (mat) =>
                                    String(mat.kodeMaterial) !==
                                    String(item.kodeMaterial)
                            )
                        );
                        Swal.fire('Terhapus', 'Material berhasil dihapus.', 'success');
                    },
                    onError: () => {
                        // Pesan error sudah dibawa oleh flash; tampilkan default.
                        Swal.fire('Gagal', 'Gagal menghapus material.', 'error');
                    },
                }
            );
        });
    };

    const handleCancelEditMaterial = () => {
        setEditingMaterialId(null);
        setSavingMaterialId(null);
        setMaterialForm({
            kodeMaterial: '',
            material: '',
            qty: '',
            satuan: '',
            price: '',
            ppn: '',
            inEx: 'EX',
        });
        setIncludePpn(false);
    };

    const handleSaveMaterial = () => {
        if (!editingMaterialId || !purchaseOrder?.no_po) {
            return;
        }

        const isPriceEmpty =
            materialForm.price === '' || materialForm.price === null;

        const payload = {
            price: isPriceEmpty ? '' : includePpn ? netPrice : materialForm.price,
            ppn: includePpn ? `${formData.ppn ?? 0}%` : materialForm.ppn,
            total_price: isPriceEmpty ? '' : totalPriceValue,
            qty: materialForm.qty,
        };

        router.put(
            `/pembelian/purchase-order/${encodeURIComponent(
                purchaseOrder.no_po
            )}/detail/${editingMaterialId}`,
            payload,
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSavingMaterialId(editingMaterialId),
                onFinish: () => setSavingMaterialId(null),
                onSuccess: () => {
                    setMaterialItems((prev) =>
                        prev.map((item) =>
                            item.id === editingMaterialId
                                ? {
                                    ...item,
                                    price: payload.price,
                                    ppn: payload.ppn,
                                    totalPrice: payload.total_price,
                                    qty: materialForm.qty,
                                    inEx: includePpn ? 'IN' : 'EX',
                                }
                            : item
                    )
                );
                    setSavingMaterialId(null);
                    handleCancelEditMaterial();
                },
                onError: () => setSavingMaterialId(null),
            }
        );
    };

    useEffect(() => {
        setPrCurrentPage(1);
    }, [prPageSize, prSearchTerm]);

    useEffect(() => {
        setVendorCurrentPage(1);
    }, [vendorPageSize, vendorSearchTerm]);

    useEffect(() => {
        if (prCurrentPage > prTotalPages) {
            setPrCurrentPage(prTotalPages);
        }
    }, [prCurrentPage, prTotalPages]);

    useEffect(() => {
        if (vendorCurrentPage > vendorTotalPages) {
            setVendorCurrentPage(vendorTotalPages);
        }
    }, [vendorCurrentPage, vendorTotalPages]);

    useEffect(() => {
        if (!purchaseOrder) {
            return;
        }

        const rawPpn =
            purchaseOrderDetails[0]?.ppn ?? purchaseOrder.ppn ?? '';
        const parsedPpn =
            typeof rawPpn === 'string' ? rawPpn.replace('%', '') : rawPpn;

        setFormData((prev) => ({
            ...prev,
            refPr: purchaseOrder.ref_pr ?? '',
            refQuota:
                purchaseOrderDetails[0]?.ref_quota ??
                purchaseOrder.ref_quota ??
                '',
            forCustomer: purchaseOrder.for_cus ?? '',
            refPoMasuk: purchaseOrder.ref_poin ?? purchaseOrder.ref_po ?? '',
            noPo: purchaseOrder.no_po ?? '',
            date: normalizeDateInput(purchaseOrder.tgl ?? ''),
            namaVendor: purchaseOrder.nm_vdr ?? '',
            ppn: parsedPpn ?? '',
            note1: purchaseOrderDetails[0]?.ket1 ?? '',
            note2: purchaseOrderDetails[0]?.ket2 ?? '',
            note3: purchaseOrderDetails[0]?.ket3 ?? '',
            note4: purchaseOrderDetails[0]?.ket4 ?? '',
            paymentTerms: purchaseOrderDetails[0]?.payment_terms ?? '',
            deliveryTime: purchaseOrderDetails[0]?.del_time ?? '',
            francoLoco: purchaseOrderDetails[0]?.franco_loco ?? '',
        }));
    }, [purchaseOrder, purchaseOrderDetails]);

    useEffect(() => {
        if (!editingMaterialId) {
            setSavingMaterialId(null);
        }
    }, [editingMaterialId]);

    useEffect(() => {
        if (materialItems.length > 0 || purchaseOrderDetails.length === 0) {
            return;
        }

        const mapped = purchaseOrderDetails.map((detail, index) => ({
            id: detail.id ?? `${detail.no ?? index}-${Date.now()}`,
            no: detail.no ?? index + 1,
            kodeMaterial: detail.kd_mat ?? detail.kd_material ?? '',
            material: detail.material ?? '',
            qty: detail.qty ?? '',
            satuan: detail.unit ?? '',
            price: detail.price ?? '',
            ppn: detail.ppn ?? '',
            totalPrice: detail.total_price ?? '',
            kdVendor: detail.kd_vdr ?? '',
            inEx: detail.in_ex ?? detail.inex ?? 'EX',
        }));

        setMaterialItems(mapped);
    }, [materialItems.length, purchaseOrderDetails]);

    useEffect(() => {
        const detailVendor = purchaseOrderDetails[0]?.kd_vdr;
        if (!detailVendor || vendors.length === 0) {
            return;
        }

        const vendor = vendors.find((item) => item.kd_vdr === detailVendor);
        if (!vendor) {
            return;
        }

        setFormData((prev) => ({
            ...prev,
            kodeVendor: vendor.kd_vdr ?? prev.kodeVendor,
            namaVendor: vendor.nm_vdr ?? prev.namaVendor,
            attended: vendor.attn_vdr ?? prev.attended,
        }));
    }, [purchaseOrderDetails, vendors]);

    const {
        netSum: totalPriceSum,
        ppnSum: totalPpnSum,
        grossSum: grandTotalSum,
    } = materialItems.reduce(
        (acc, item) => {
            const rate = parseNumber(item.ppn) / 100;
            const qty = parseNumber(item.qty);
            const price = parseNumber(item.price);
            const hasQty = Number.isFinite(qty) ? qty : 0;

            const totalPriceField = parseNumber(item.totalPrice);
            const inEx = (item.inEx ?? 'EX').toUpperCase();

            if (inEx === 'IN') {
                const gross =
                    totalPriceField > 0
                        ? totalPriceField
                        : price * hasQty;
                const net = rate > 0 ? gross / (1 + rate) : gross;
                const ppn = gross - net;
                acc.netSum += net;
                acc.ppnSum += ppn;
                acc.grossSum += gross;
            } else {
                const net = price * hasQty;
                acc.netSum += net;
                acc.grossSum += net;
            }
            return acc;
        },
        { netSum: 0, ppnSum: 0, grossSum: 0 }
    );

    const handleSubmit = () => {
        router.put(
            `/pembelian/purchase-order/${encodeURIComponent(
                purchaseOrder?.no_po ?? ''
            )}`,
            {
                ref_pr: formData.refPr,
                ref_quota: formData.refQuota,
                for_cus: formData.forCustomer,
                ref_poin: formData.refPoMasuk,
                kd_vdr: formData.kodeVendor,
                ppn: formData.ppn,
                nm_vdr: formData.namaVendor,
                kd_vdr: formData.kodeVendor,
                payment_terms: formData.paymentTerms,
                del_time: formData.deliveryTime,
                franco_loco: formData.francoLoco,
                ket1: formData.note1,
                ket2: formData.note2,
                ket3: formData.note3,
                ket4: formData.note4,
                date: formData.date,
                s_total: totalPriceSum,
                h_ppn: totalPpnSum,
                g_total: grandTotalSum,
                materials: materialItems.map((item, index) => ({
                    id: item.id,
                    no: item.no ?? index + 1,
                    kd_mat: item.kodeMaterial,
                    material: item.material,
                    qty: item.qty,
                    unit: item.satuan,
                    price: item.price,
                    ppn: item.ppn,
                    total_price: item.totalPrice,
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
            <Head title="Edit PO" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit PO</h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data PO dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 3
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
                        1. Data PO
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 2
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        2. Data Vendor & Header
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 3
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        3. Data Material
                    </span>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data PO</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    No PO
                                </span>
                                <Input value={formData.noPo} readOnly />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">
                                    Ref PR
                                </span>
                                <Input value={formData.refPr} readOnly />
                            </label>

                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    For Customer
                                </span>
                                <Input value={formData.forCustomer} readOnly />
                            </label>
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
                                <span className="text-muted-foreground">
                                    Ref PO Masuk
                                </span>
                                <Input
                                    value={formData.refPoMasuk}
                                    readOnly
                                />
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
                            <CardTitle>Vendor & Header</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">
                                    Cari Vendor
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsVendorModalOpen(true)}
                                >
                                    Cari Vendor
                                </Button>
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Kode Vendor
                                </span>
                                <Input value={formData.kodeVendor} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nama Vendor
                                </span>
                                <Input value={formData.namaVendor} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref Quota
                                </span>
                                <Input
                                    value={formData.refQuota}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refQuota: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Attended</span>
                                <Input
                                    value={formData.attended}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            attended: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">PPN</span>
                                <Input
                                    type="number"
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
                                <span className="text-muted-foreground">
                                    Payment Terms
                                </span>
                                <Input
                                    value={formData.paymentTerms}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            paymentTerms: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Delivery Time
                                </span>
                                <Input
                                    value={formData.deliveryTime}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            deliveryTime: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Franco Loco
                                </span>
                                <Input
                                    value={formData.francoLoco}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            francoLoco: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">Note 1</span>
                                <Input
                                    value={formData.note1}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            note1: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">Note 2</span>
                                <Input
                                    value={formData.note2}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            note2: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">Note 3</span>
                                <Input
                                    value={formData.note3}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            note3: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">Note 4</span>
                                <Input
                                    value={formData.note4}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            note4: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <Button type="button" onClick={() => setStep(3)}>
                                Lanjut
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 3 && (
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
                                    <Label>Material</Label>
                                    <Input value={materialForm.material} readOnly />
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
                                        disabled={!editingMaterialId}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Satuan</Label>
                                    <Input value={materialForm.satuan} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price</Label>
                                    <Input
                                        type="number"
                                        value={
                                            includePpn
                                                ? netPrice.toString()
                                                : materialForm.price
                                        }
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                price: event.target.value,
                                            }))
                                        }
                                        disabled={!editingMaterialId || includePpn}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>PPN</Label>
                                    <Input
                                        type="number"
                                        value={includePpn ? ppnTotal : materialForm.ppn || 0}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                ppn: event.target.value,
                                            }))
                                        }
                                        readOnly
                                        disabled={!editingMaterialId}
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={includePpn}
                                            onChange={(event) => {
                                                const checked = event.target.checked;
                                                setIncludePpn(checked);
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    inEx: checked ? 'IN' : 'EX',
                                                }));
                                            }}
                                            disabled={!editingMaterialId}
                                        />
                                        Include PPN
                                    </label>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input
                                        value={
                                            editingMaterialId
                                                ? totalPriceValue
                                                : ''
                                        }
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            onClick={handleSaveMaterial}
                                            disabled={
                                                !editingMaterialId ||
                                                savingMaterialId ===
                                                    editingMaterialId
                                            }
                                        >
                                            {savingMaterialId === editingMaterialId
                                                ? 'Menyimpan...'
                                                : 'Simpan Data'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleCancelEditMaterial}
                                            disabled={!editingMaterialId}
                                        >
                                            Batal
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                No
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Kode Material
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Material
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Qty
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Satuan
                                            </th>
                                    <th className="px-4 py-3 text-left">
                                        Price
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        PPN
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        IN/EX
                                    </th>
                                            <th className="px-4 py-3 text-left">
                                                Total Price
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
                                                    colSpan={9}
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
                                                    {renderValue(item.material)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.qty)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.satuan)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.price)}
                                                </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.ppn)}
                                            </td>
                                <td className="px-4 py-3">
                                                {item.inEx ?? 'EX'}
                                </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.totalPrice)}
                                            </td>
                                                <td className="px-4 py-3 space-x-1">
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleEditMaterial(
                                                                item
                                                            )
                                                        }
                                                        aria-label="Edit material"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleDeleteMaterial(
                                                                item
                                                            )
                                                        }
                                                        aria-label="Hapus material"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label>Total Harga Sebelum PPN</Label>
                                    <Input
                                        value={formatRupiah(totalPriceSum)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total PPN</Label>
                                    <Input value={formatRupiah(totalPpnSum)} readOnly />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total</Label>
                                    <Input
                                        value={formatRupiah(grandTotalSum)}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(2)}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Spinner className="mr-2" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </Card>
                )}

                {/* PR modal intentionally removed on edit */}

                <Dialog
                    open={isVendorModalOpen}
                    onOpenChange={(open) => {
                        setIsVendorModalOpen(open);
                        if (!open) {
                            setVendorSearchTerm('');
                            setVendorPageSize(10);
                            setVendorCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Data Vendor</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        vendorPageSize === Infinity
                                            ? 'all'
                                            : vendorPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setVendorPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value)
                                        );
                                        setVendorCurrentPage(1);
                                    }}
                                >
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
                                    placeholder="Cari nama vendor..."
                                    value={vendorSearchTerm}
                                    onChange={(event) =>
                                        setVendorSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            Kode Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Nama Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Alamat
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Kontak
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Email
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Attended
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedVendors.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={7}
                                            >
                                                Tidak ada data vendor.
                                            </td>
                                        </tr>
                                    )}
                                    {displayedVendors.map((item) => (
                                        <tr
                                            key={item.kd_vdr}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {renderValue(item.kd_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.nm_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.almt_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.telp_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.eml_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.attn_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleVendorSelect(item)
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

                        {vendorPageSize !== Infinity && vendorTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (vendorCurrentPage - 1) * vendorPageSize +
                                            1,
                                        vendorTotalItems
                                    )}
                                    -
                                    {Math.min(
                                        vendorCurrentPage * vendorPageSize,
                                        vendorTotalItems
                                    )}{' '}
                                    dari {vendorTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setVendorCurrentPage((page) =>
                                                Math.max(1, page - 1)
                                            )
                                        }
                                        disabled={vendorCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {vendorCurrentPage} dari{' '}
                                        {vendorTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setVendorCurrentPage((page) =>
                                                Math.min(
                                                    vendorTotalPages,
                                                    page + 1
                                                )
                                            )
                                        }
                                        disabled={vendorCurrentPage === vendorTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
