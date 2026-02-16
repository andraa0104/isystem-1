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
import { readApiError, normalizeApiError } from '@/lib/api-error';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Purchase Order', href: '/pembelian/purchase-order' },
    { title: 'Tambah PO', href: '/pembelian/purchase-order/create' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const withRequiredSpace = (value) => {
    const normalized = String(value ?? '');
    return normalized.trim() === '' ? ' ' : normalized;
};

const parseNumber = (value) => {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
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

const todayValue = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
};

export default function PurchaseOrderCreate({
    purchaseRequirements = [],
    purchaseRequirementDetails = [],
    vendors = [],
}) {
    const [step, setStep] = useState(1);
    const [isPrModalOpen, setIsPrModalOpen] = useState(false);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [prList, setPrList] = useState(purchaseRequirements);
    const [prDetailList, setPrDetailList] = useState(purchaseRequirementDetails);
    const [vendorList, setVendorList] = useState(vendors);
    const [prLoading, setPrLoading] = useState(false);
    const [prError, setPrError] = useState(null);
    const [prDetailLoading, setPrDetailLoading] = useState(false);
    const [prDetailError, setPrDetailError] = useState(null);
    const [vendorLoading, setVendorLoading] = useState(false);
    const [vendorError, setVendorError] = useState(null);

    const [prSearchTerm, setPrSearchTerm] = useState('');
    const [prPageSize, setPrPageSize] = useState(10);
    const [prCurrentPage, setPrCurrentPage] = useState(1);

    const [vendorSearchTerm, setVendorSearchTerm] = useState('');
    const [vendorPageSize, setVendorPageSize] = useState(10);
    const [vendorCurrentPage, setVendorCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPr: '',
        forCustomer: '',
        refPoMasuk: '',
        refQuota: '',
        kodeVendor: '',
        namaVendor: '',
        attended: '',
        ppn: '',
        paymentTerms: '',
        deliveryTime: 'SEGERA',
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
        sisaQty: '',
        satuan: '',
        basePrice: '',
    });

    const [includePpn, setIncludePpn] = useState(false);
    const [materialItems, setMaterialItems] = useState([]);

    const filteredPr = useMemo(() => {
        const term = prSearchTerm.trim().toLowerCase();
        if (!term) {
            return prList;
        }

        return prList.filter((item) => {
            const values = [item.no_pr, item.ref_po, item.for_customer];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [prSearchTerm, prList]);

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
            return vendorList;
        }

        return vendorList.filter((item) =>
            String(item.nm_vdr ?? '').toLowerCase().includes(term)
        );
    }, [vendorSearchTerm, vendorList]);

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

    const selectedPrMaterials = useMemo(() => {
        if (!formData.refPr) {
            return [];
        }

        return prDetailList.filter((detail) => {
            if (detail.no_pr !== formData.refPr) {
                return false;
            }

            const sisaQty = parseNumber(detail.sisa_pr ?? detail.Sisa_pr);
            return sisaQty > 0;
        });
    }, [formData.refPr, prDetailList]);

    const basePriceValue = parseNumber(materialForm.basePrice);
    const qtyValue = parseNumber(materialForm.qty);
    const sisaQtyValue = parseNumber(materialForm.sisaQty);
    const appliedPpn = includePpn ? parseNumber(formData.ppn) : 0;
    const divisor = includePpn ? 1 + appliedPpn / 100 : 1;
    const netPrice = divisor ? basePriceValue / divisor : basePriceValue;
    const ppnValue = includePpn ? basePriceValue - netPrice : 0;
    const priceWithPpn = includePpn ? netPrice : basePriceValue;
    const totalPriceValue =
        qtyValue * (includePpn ? basePriceValue : netPrice);
    const isQtyExceedsSisa = materialForm.qty !== '' && qtyValue > sisaQtyValue;
    const canAddMaterial =
        !!materialForm.kodeMaterial &&
        qtyValue > 0 &&
        !isQtyExceedsSisa &&
        basePriceValue > 0;

    const handlePrSelect = (item) => {
        setFormData((prev) => ({
            ...prev,
            refPr: item.no_pr ?? '',
            forCustomer: item.for_customer ?? '',
            refPoMasuk: item.ref_po ?? '',
            refQuota: item.ref_quota ?? '',
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

    const loadPrs = async () => {
        if (prLoading || prList.length > 0) {
            return;
        }
        setPrLoading(true);
        setPrError(null);
        try {
            const response = await fetch('/pembelian/purchase-order/outstanding-pr', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setPrList(
                Array.isArray(data?.purchaseRequirements)
                    ? data.purchaseRequirements
                    : []
            );
        } catch (error) {
            setPrError(normalizeApiError(error, 'Gagal memuat data PR.'));
        } finally {
            setPrLoading(false);
        }
    };

    const loadPrDetails = async (noPr) => {
        if (!noPr || prDetailLoading) {
            return;
        }
        setPrDetailLoading(true);
        setPrDetailError(null);
        try {
            const response = await fetch(
                `/pembelian/purchase-order/pr-details?no_pr=${encodeURIComponent(noPr)}`,
                { headers: { Accept: 'application/json' } }
            );
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setPrDetailList(
                Array.isArray(data?.purchaseRequirementDetails)
                    ? data.purchaseRequirementDetails
                    : []
            );
        } catch (error) {
            setPrDetailError(normalizeApiError(error, 'Gagal memuat detail PR.'));
        } finally {
            setPrDetailLoading(false);
        }
    };

    const loadVendors = async () => {
        if (vendorLoading || vendorList.length > 0) {
            return;
        }
        setVendorLoading(true);
        setVendorError(null);
        try {
            const response = await fetch('/pembelian/purchase-order/vendors', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setVendorList(Array.isArray(data?.vendors) ? data.vendors : []);
        } catch (error) {
            setVendorError(normalizeApiError(error, 'Gagal memuat data vendor.'));
        } finally {
            setVendorLoading(false);
        }
    };

    const handleMaterialSelect = (item) => {
        const sisaQty = item.sisa_pr ?? item.Sisa_pr;
        setMaterialForm((prev) => ({
            ...prev,
            kodeMaterial: item.kd_material ?? '',
            material: item.material ?? '',
            qty: sisaQty ?? '',
            sisaQty: sisaQty ?? '',
            satuan: item.unit ?? '',
        }));
    };

    const handleAddMaterial = () => {
        if (!canAddMaterial) {
            return;
        }

        const newItem = {
            id: `${Date.now()}-${Math.random()}`,
            kodeMaterial: materialForm.kodeMaterial,
            material: materialForm.material,
            qty: materialForm.qty,
            satuan: materialForm.satuan,
            price: priceWithPpn,
            ppn: ppnValue,
            totalPrice: totalPriceValue,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialForm({
            kodeMaterial: '',
            material: '',
            qty: '',
            sisaQty: '',
            satuan: '',
            basePrice: '',
        });
        setIncludePpn(false);
    };

    const totalPriceSum = materialItems.reduce(
        (sum, item) =>
            sum + parseNumber(item.qty) * parseNumber(item.price),
        0
    );
    const totalPpnSum = materialItems.reduce(
        (sum, item) => sum + parseNumber(item.qty) * parseNumber(item.ppn),
        0
    );
    const grandTotalSum = totalPriceSum + totalPpnSum;

    const handleSubmit = () => {
        if (materialItems.length === 0) {
            return;
        }

        router.post(
            '/pembelian/purchase-order',
            {
                date: formData.date,
                ref_pr: formData.refPr,
                ref_quota: formData.refQuota,
                for_cus: formData.forCustomer,
                ref_poin: formData.refPoMasuk,
                ppn: formData.ppn,
                nm_vdr: formData.namaVendor,
                kd_vdr: formData.kodeVendor,
                payment_terms: formData.paymentTerms,
                del_time: formData.deliveryTime,
                franco_loco: formData.francoLoco,
                ket1: withRequiredSpace(formData.note1),
                ket2: withRequiredSpace(formData.note2),
                ket3: withRequiredSpace(formData.note3),
                ket4: withRequiredSpace(formData.note4),
                s_total: totalPriceSum,
                h_ppn: totalPpnSum,
                g_total: grandTotalSum,
                materials: materialItems.map((item, index) => ({
                    no: index + 1,
                    kd_mat: item.kodeMaterial,
                    material: item.material,
                    qty: item.qty,
                    unit: item.satuan,
                    price: item.price,
                    total_price: item.totalPrice,
                    ppn: item.ppn,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
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
        if (formData.refPr) {
            loadPrDetails(formData.refPr);
        } else {
            setPrDetailList([]);
        }
    }, [formData.refPr]);

    useEffect(() => {
        if (includePpn) {
            setFormData((prev) => ({
                ...prev,
                ppn: prev.ppn,
            }));
        }
    }, [includePpn]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah PO" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PO</h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data PO dalam tiga langkah
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
                        2. Data Vendor
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
                        <CardContent className="grid gap-4 md:grid-cols-3">
                            <label className="space-y-2 text-sm md:col-span-3">
                                <span className="text-muted-foreground">
                                    Cari PR Outstanding
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsPrModalOpen(true);
                                        loadPrs();
                                    }}
                                >
                                    Cari PR
                                </Button>
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
                                <span className="text-muted-foreground">Ref PR</span>
                                <Input value={formData.refPr} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref PO Masuk
                                </span>
                                <Input
                                    value={formData.refPoMasuk}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refPoMasuk: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-3">
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
                            <CardTitle>Data Vendor</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">
                                    Cari Vendor
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsVendorModalOpen(true);
                                        loadVendors();
                                    }}
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
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
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
                                                Sisa Qty
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Satuan
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Remark
                                            </th>
                                        </tr>
	                                    </thead>
	                                    <tbody>
	                                        <PlainTableStateRows
	                                            columns={6}
	                                            loading={prDetailLoading && selectedPrMaterials.length === 0}
	                                            error={selectedPrMaterials.length === 0 ? prDetailError : null}
	                                            onRetry={
	                                                formData.refPr
	                                                    ? () => loadPrDetails(formData.refPr)
	                                                    : undefined
	                                            }
	                                            isEmpty={
	                                                !prDetailLoading &&
	                                                !prDetailError &&
	                                                selectedPrMaterials.length === 0
	                                            }
	                                            emptyTitle="Belum ada material PR."
	                                        />
	                                        {selectedPrMaterials.map((item, index) => (
	                                            <tr
	                                                key={`${item.no_pr}-${index}`}
	                                                className="border-t border-sidebar-border/70 cursor-pointer"
                                                onClick={() =>
                                                    handleMaterialSelect(item)
                                                }
                                            >
                                                <td className="px-4 py-3">
                                                    {renderValue(item.kd_material)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.material)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.qty)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.sisa_pr ?? item.Sisa_pr)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.unit)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.renmark)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

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
                                        className={isQtyExceedsSisa ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                        value={materialForm.qty}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                qty: event.target.value,
                                            }))
                                        }
                                    />
                                    {isQtyExceedsSisa && (
                                        <p className="text-xs text-red-600">
                                            Qty melebihi sisa qty ({renderValue(materialForm.sisaQty)}).
                                        </p>
                                    )}
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
                                    <Label>Price</Label>
                                    <Input
                                        type="number"
                                        value={
                                            includePpn
                                                ? priceWithPpn.toString()
                                                : materialForm.basePrice
                                        }
                                        readOnly={includePpn}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                basePrice: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>PPN</Label>
                                    <Input
                                        type="number"
                                        value={includePpn ? ppnValue : 0}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={includePpn}
                                            onChange={(event) =>
                                                setIncludePpn(event.target.checked)
                                            }
                                        />
                                        Include PPN
                                    </label>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input
                                        value={
                                            totalPriceValue
                                                ? totalPriceValue.toString()
                                                : ''
                                        }
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <Button type="button" onClick={handleAddMaterial} disabled={!canAddMaterial}>
                                        Tambah Data
                                    </Button>
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
                                                Total Price
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materialItems.length === 0 && (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={8}
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
                                                    {renderValue(item.totalPrice)}
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
                                    <Input
                                        value={formatRupiah(totalPpnSum)}
                                        readOnly
                                    />
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
                                disabled={isSubmitting || materialItems.length === 0}
                            >
                                {isSubmitting && <Spinner className="mr-2" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </Card>
                )}

                <Dialog
                    open={isPrModalOpen}
                    onOpenChange={(open) => {
                        setIsPrModalOpen(open);
                        if (open) {
                            loadPrs();
                        } else {
                            setPrSearchTerm('');
                            setPrPageSize(10);
                            setPrCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>PR Outstanding</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
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
                                        setPrCurrentPage(1);
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
                                    placeholder="Cari no PR, ref PO, customer..."
                                    value={prSearchTerm}
                                    onChange={(event) =>
                                        setPrSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            No PR
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Ref PO
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
	                                </thead>
	                                <tbody>
	                                    <PlainTableStateRows
	                                        columns={4}
	                                        loading={prLoading && displayedPr.length === 0}
	                                        error={displayedPr.length === 0 ? prError : null}
	                                        onRetry={loadPrs}
	                                        isEmpty={
	                                            !prLoading &&
	                                            !prError &&
	                                            displayedPr.length === 0
	                                        }
	                                        emptyTitle="Tidak ada PR outstanding."
	                                    />
	                                    {displayedPr.map((item) => (
	                                        <tr
	                                            key={item.no_pr}
	                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {renderValue(item.no_pr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.for_customer)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.ref_po)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handlePrSelect(item)
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

                        {prPageSize !== Infinity && prTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (prCurrentPage - 1) * prPageSize + 1,
                                        prTotalItems
                                    )}
                                    -
                                    {Math.min(
                                        prCurrentPage * prPageSize,
                                        prTotalItems
                                    )}{' '}
                                    dari {prTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPrCurrentPage((page) =>
                                                Math.max(1, page - 1)
                                            )
                                        }
                                        disabled={prCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {prCurrentPage} dari {prTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPrCurrentPage((page) =>
                                                Math.min(prTotalPages, page + 1)
                                            )
                                        }
                                        disabled={prCurrentPage === prTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isVendorModalOpen}
                    onOpenChange={(open) => {
                        setIsVendorModalOpen(open);
                        if (open) {
                            loadVendors();
                        } else {
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
	                                    <PlainTableStateRows
	                                        columns={7}
	                                        loading={vendorLoading && displayedVendors.length === 0}
	                                        error={displayedVendors.length === 0 ? vendorError : null}
	                                        onRetry={loadVendors}
	                                        isEmpty={
	                                            !vendorLoading &&
	                                            !vendorError &&
	                                            displayedVendors.length === 0
	                                        }
	                                        emptyTitle="Tidak ada data vendor."
	                                    />
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
