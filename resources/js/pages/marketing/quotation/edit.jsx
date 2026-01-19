
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';
import { useEffect, useMemo, useState } from 'react';

const buildBreadcrumbs = (noPenawaran) => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
    {
        title: 'Edit Quotation',
        href: noPenawaran
            ? `/marketing/quotation/${encodeURIComponent(noPenawaran)}/edit`
            : '/marketing/quotation',
    },
];

const steps = [
    { id: 'customer', label: 'Data Customer' },
    { id: 'detail', label: 'Detail' },
    { id: 'material', label: 'Data Material' },
];

const renderValue = (value) => (value ?? '')?.toString();

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const calculateMargin = (modalValue, penawaranValue) => {
    const modal = parseNumber(modalValue);
    const penawaran = parseNumber(penawaranValue);
    if (!modal || !penawaran) {
        return '';
    }

    const margin = ((penawaran - modal) / modal) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const todayDate = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
};

const buildCustomerForm = (quotation) => ({
    tglPenawaran: quotation?.Tgl_penawaran || todayDate(),
    nama: renderValue(quotation?.Customer),
    alamat: renderValue(quotation?.Alamat),
    telepon: renderValue(quotation?.Telp),
    fax: renderValue(quotation?.Fax),
    email: renderValue(quotation?.Email),
    attend: renderValue(quotation?.Attend),
    kode: renderValue(quotation?.Kode ?? ''),
});

const buildDetailForm = (quotation) => ({
    payment: renderValue(quotation?.Payment ?? quotation?.payment),
    validity: renderValue(quotation?.Validity),
    delivery: renderValue(quotation?.Delivery),
    franco: renderValue(quotation?.Franco),
    note1: renderValue(quotation?.Note1),
    note2: renderValue(quotation?.Note2),
    note3: renderValue(quotation?.Note3),
});

const buildMaterialItems = (details = []) =>
    details.map((detail, index) => ({
        id: detail.ID ?? `${detail.No_penawaran ?? 'ITEM'}-${index}`,
        detailId: detail.ID ?? null,
        nama: renderValue(detail.Material),
        satuan: renderValue(detail.Satuan),
        quantity: renderValue(detail.Qty),
        hargaModal: renderValue(detail.Harga),
        hargaPenawaran: renderValue(detail.Harga_modal),
        margin: renderValue(detail.Margin),
        remark: renderValue(detail.Remark),
    }));


export default function QuotationEdit({ quotation = null, quotationDetails = [], customers = [], materials = [] }) {
    const [activeStep, setActiveStep] = useState(0);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [materialModalOpen, setMaterialModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingMaterialId, setDeletingMaterialId] = useState(null);
    const [savingMaterialId, setSavingMaterialId] = useState(null);
    const [customerList, setCustomerList] = useState(customers);
    const [materialList, setMaterialList] = useState(materials);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [materialError, setMaterialError] = useState('');

    const [customerForm, setCustomerForm] = useState(() =>
        buildCustomerForm(quotation)
    );

    const [detailForm, setDetailForm] = useState(() =>
        buildDetailForm(quotation)
    );

    const [materialForm, setMaterialForm] = useState({
        nama: '',
        satuan: '',
        quantity: '',
        hargaModal: '',
        hargaPenawaran: '',
        remark: '',
    });

    const [materialItems, setMaterialItems] = useState(() =>
        buildMaterialItems(quotationDetails)
    );
    const [editingMaterialId, setEditingMaterialId] = useState(null);
    const [editingMaterial, setEditingMaterial] = useState(null);

    const [customerSearch, setCustomerSearch] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(10);
    const [customerPage, setCustomerPage] = useState(1);

    const [materialSearch, setMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(10);
    const [materialPage, setMaterialPage] = useState(1);

    const breadcrumbs = useMemo(
        () => buildBreadcrumbs(quotation?.No_penawaran),
        [quotation]
    );

    const filteredCustomers = useMemo(() => {
        const term = customerSearch.trim().toLowerCase();
        if (!term) {
            return customerList;
        }

        return customerList.filter((item) => {
            const values = [item.kd_cs, item.nm_cs, item.attnd];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [customerSearch, customerList]);

    const customerTotalItems = filteredCustomers.length;
    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(customerTotalItems / customerPageSize));
    }, [customerPageSize, customerTotalItems]);

    const displayedCustomers = useMemo(() => {
        if (customerPageSize === Infinity) {
            return filteredCustomers;
        }

        const startIndex = (customerPage - 1) * customerPageSize;
        return filteredCustomers.slice(startIndex, startIndex + customerPageSize);
    }, [customerPage, customerPageSize, filteredCustomers]);

    const filteredMaterials = useMemo(() => {
        const term = materialSearch.trim().toLowerCase();
        if (!term) {
            return materialList;
        }

        return materialList.filter((item) => {
            const values = [item.material, item.unit, item.remark];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [materialSearch, materialList]);

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

        const startIndex = (materialPage - 1) * materialPageSize;
        return filteredMaterials.slice(startIndex, startIndex + materialPageSize);
    }, [filteredMaterials, materialPage, materialPageSize]);

    const marginValue = useMemo(() => {
        const modal = parseNumber(materialForm.hargaModal);
        const penawaran = parseNumber(materialForm.hargaPenawaran);
        if (!modal || !penawaran) {
            return '';
        }

        const margin = ((penawaran - modal) / modal) * 100;
        return Number.isFinite(margin) ? margin.toFixed(2) : '';
    }, [materialForm.hargaModal, materialForm.hargaPenawaran]);

    useEffect(() => {
        setCustomerForm(buildCustomerForm(quotation));
        setDetailForm(buildDetailForm(quotation));
    }, [quotation]);

    useEffect(() => {
        setMaterialItems(buildMaterialItems(quotationDetails));
    }, [quotationDetails]);


    useEffect(() => {
        setCustomerPage(1);
    }, [customerPageSize, customerSearch]);

    useEffect(() => {
        if (customerPage > customerTotalPages) {
            setCustomerPage(customerTotalPages);
        }
    }, [customerPage, customerTotalPages]);

    useEffect(() => {
        setMaterialPage(1);
    }, [materialPageSize, materialSearch]);

    useEffect(() => {
        if (materialPage > materialTotalPages) {
            setMaterialPage(materialTotalPages);
        }
    }, [materialPage, materialTotalPages]);

    const handleSelectCustomer = (item) => {
        setCustomerForm({
            nama: renderValue(item.nm_cs),
            alamat: renderValue(item.alamat_cs),
            telepon: renderValue(item.telp_cs),
            fax: renderValue(item.fax_cs),
            email: renderValue(item.email_cs ?? item.email ?? ''),
            attend: renderValue(item.attnd),
            kode: renderValue(item.kd_cs),
        });
        setCustomerModalOpen(false);
    };

    const handleSelectMaterial = (item) => {
        setMaterialForm((prev) => ({
            ...prev,
            nama: renderValue(item.material),
            satuan: renderValue(item.unit),
        }));
        setMaterialModalOpen(false);
    };

    const loadCustomers = async () => {
        if (customerLoading || customerList.length > 0) {
            return;
        }
        setCustomerLoading(true);
        setCustomerError('');
        try {
            const response = await fetch('/marketing/quotation/customers', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            setCustomerList(Array.isArray(data?.customers) ? data.customers : []);
        } catch (error) {
            setCustomerError('Gagal memuat data customer.');
        } finally {
            setCustomerLoading(false);
        }
    };

    const loadMaterials = async () => {
        if (materialLoading || materialList.length > 0) {
            return;
        }
        setMaterialLoading(true);
        setMaterialError('');
        try {
            const response = await fetch('/marketing/quotation/materials', {
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
        if (!materialForm.nama || !materialForm.quantity) {
            return;
        }

        const newItem = {
            id: `${Date.now()}-${Math.random()}`,
            detailId: null,
            nama: materialForm.nama,
            satuan: materialForm.satuan,
            quantity: materialForm.quantity,
            hargaModal: materialForm.hargaModal,
            hargaPenawaran: materialForm.hargaPenawaran,
            margin: marginValue,
            remark: materialForm.remark,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialForm({
            nama: '',
            satuan: '',
            quantity: '',
            hargaModal: '',
            hargaPenawaran: '',
            remark: '',
        });
    };

    const handleRemoveMaterial = (id, detailId) => {
        Swal.fire({
            title: 'Hapus material?',
            text: 'Apakah yakin data ini dihapus?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) {
                return;
            }

            const finishRemove = () => {
                setMaterialItems((prev) =>
                    prev.filter((item) => item.id !== id)
                );
                if (editingMaterialId === id) {
                    setEditingMaterialId(null);
                    setEditingMaterial(null);
                }
            };

            if (detailId && quotation?.No_penawaran) {
                router.delete(
                    `/marketing/quotation/${encodeURIComponent(
                        quotation.No_penawaran
                    )}/detail/${detailId}`,
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onStart: () => setDeletingMaterialId(id),
                        onFinish: () => setDeletingMaterialId(null),
                        onSuccess: finishRemove,
                    }
                );
                return;
            }

            setDeletingMaterialId(id);
            finishRemove();
            setDeletingMaterialId(null);
        });
    };

    const handleEditMaterial = (item) => {
        setEditingMaterialId(item.id);
        setEditingMaterial({
            ...item,
            margin:
                calculateMargin(item.hargaModal, item.hargaPenawaran) ||
                item.margin,
        });
    };

    const handleEditMaterialChange = (field, value) => {
        setEditingMaterial((prev) => {
            if (!prev) {
                return prev;
            }
            const next = { ...prev, [field]: value };
            if (field === 'hargaModal' || field === 'hargaPenawaran') {
                next.margin = calculateMargin(
                    next.hargaModal,
                    next.hargaPenawaran
                );
            }
            return next;
        });
    };

    const handleCancelEditMaterial = () => {
        setEditingMaterialId(null);
        setEditingMaterial(null);
    };

    const handleSaveMaterial = () => {
        if (!quotation?.No_penawaran || !editingMaterial?.detailId) {
            return;
        }

        router.put(
            `/marketing/quotation/${encodeURIComponent(
                quotation.No_penawaran
            )}/detail/${editingMaterial.detailId}`,
            {
                material: editingMaterial.nama,
                quantity: editingMaterial.quantity,
                harga_modal: editingMaterial.hargaModal,
                harga_penawaran: editingMaterial.hargaPenawaran,
                satuan: editingMaterial.satuan,
                margin: editingMaterial.margin,
                remark: editingMaterial.remark,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSavingMaterialId(editingMaterialId),
                onFinish: () => setSavingMaterialId(null),
                onSuccess: () => {
                    setMaterialItems((prev) =>
                        prev.map((item) =>
                            item.id === editingMaterialId
                                ? { ...editingMaterial }
                                : item
                        )
                    );
                    handleCancelEditMaterial();
                },
            }
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!quotation?.No_penawaran) {
            return;
        }
        router.put(`/marketing/quotation/${encodeURIComponent(quotation.No_penawaran)}`, {
            tgl_penawaran: customerForm.tglPenawaran || todayDate(),
            customer: customerForm.nama,
            alamat: customerForm.alamat,
            telp: customerForm.telepon,
            fax: customerForm.fax,
            email: customerForm.email,
            attend: customerForm.attend,
            payment: detailForm.payment,
            validity: detailForm.validity,
            delivery: detailForm.delivery,
            franco: detailForm.franco,
            note1: detailForm.note1,
            note2: detailForm.note2,
            note3: detailForm.note3,
            materials: materialItems.map((item) => ({
                material: item.nama,
                quantity: item.quantity,
                harga_modal: item.hargaModal,
                harga_penawaran: item.hargaPenawaran,
                satuan: item.satuan,
                margin: item.margin,
                remark: item.remark,
            })),
        }, {
            onStart: () => setIsSubmitting(true),
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Quotation" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Edit Quotation</h1>
                    <p className="text-sm text-muted-foreground">
                        Perbarui data penawaran.
                    </p>
                </div>

                <form
                    className="grid gap-6 rounded-xl border border-sidebar-border/70 p-4"
                    onSubmit={handleSubmit}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            Step {activeStep + 1} dari {steps.length}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {steps.map((step, index) => (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setActiveStep(index)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                        index === activeStep
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-sidebar-border/70 text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {step.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeStep === 0 && (
                        <div className="grid gap-4">
                            <h2 className="text-base font-semibold">
                                Step 1 - Data Customer
                            </h2>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="tgl_penawaran">
                                        Tanggal Penawaran
                                    </Label>
                                    <Input
                                        id="tgl_penawaran"
                                        type="date"
                                        value={
                                            customerForm.tglPenawaran ||
                                            todayDate()
                                        }
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                tglPenawaran: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="nama_customer">
                                        Nama Customer
                                    </Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            id="nama_customer"
                                            value={customerForm.nama}
                                            onChange={(event) =>
                                                setCustomerForm((prev) => ({
                                                    ...prev,
                                                    nama: event.target.value,
                                                }))
                                            }
                                            placeholder="Pilih customer"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setCustomerModalOpen(true);
                                                loadCustomers();
                                            }}
                                        >
                                            Cari Customer
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="attend">Attend</Label>
                                    <Input
                                        id="attend"
                                        value={customerForm.attend}
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                attend: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="alamat">Alamat</Label>
                                    <textarea
                                        id="alamat"
                                        rows={3}
                                        className="rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                        value={customerForm.alamat}
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                alamat: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="telepon">Telepon</Label>
                                    <Input
                                        id="telepon"
                                        value={customerForm.telepon}
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                telepon: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="fax">Fax</Label>
                                    <Input
                                        id="fax"
                                        value={customerForm.fax}
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                fax: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={customerForm.email}
                                        onChange={(event) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                email: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 1 && (
                        <div className="grid gap-4">
                            <h2 className="text-base font-semibold">
                                Step 2 - Detail
                            </h2>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="payment">Payment</Label>
                                    <select
                                        id="payment"
                                        className="rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                        value={detailForm.payment}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                payment: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">Pilih</option>
                                        <option value="Cash">Cash</option>
                                        <option value="7 Hari">7 Hari</option>
                                        <option value="15 Hari">15 Hari</option>
                                        <option value="30 Hari">30 Hari</option>
                                        <option value="45 Hari">45 Hari</option>
                                        <option value="60 Hari">60 Hari</option>
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="validity">Validity</Label>
                                    <Input
                                        id="validity"
                                        value={detailForm.validity}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                validity: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="delivery">
                                        Delivery Time
                                    </Label>
                                    <Input
                                        id="delivery"
                                        value={detailForm.delivery}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                delivery: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="franco">Franco</Label>
                                    <Input
                                        id="franco"
                                        value={detailForm.franco}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                franco: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="note1">Note 1</Label>
                                    <Input
                                        id="note1"
                                        value={detailForm.note1}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                note1: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="note2">Note 2</Label>
                                    <Input
                                        id="note2"
                                        value={detailForm.note2}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                note2: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="note3">Note 3</Label>
                                    <Input
                                        id="note3"
                                        value={detailForm.note3}
                                        onChange={(event) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                note3: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 2 && (
                        <div className="grid gap-4">
                            <h2 className="text-base font-semibold">
                                Step 3 - Data Material
                            </h2>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="nama_material">
                                        Nama Material
                                    </Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            id="nama_material"
                                            value={materialForm.nama}
                                            onChange={(event) =>
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    nama: event.target.value,
                                                }))
                                            }
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setMaterialModalOpen(true);
                                                loadMaterials();
                                            }}
                                        >
                                            Cari Material
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="satuan">Satuan</Label>
                                    <Input
                                        id="satuan"
                                        value={materialForm.satuan}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="quantity">Quantity</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        value={materialForm.quantity}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                quantity: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="harga_modal">
                                        Harga Modal
                                    </Label>
                                    <Input
                                        id="harga_modal"
                                        type="number"
                                        value={materialForm.hargaModal}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                hargaModal: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="harga_penawaran">
                                        Harga Penawaran
                                    </Label>
                                    <Input
                                        id="harga_penawaran"
                                        type="number"
                                        value={materialForm.hargaPenawaran}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                hargaPenawaran: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="margin">Margin (%)</Label>
                                    <Input
                                        id="margin"
                                        value={marginValue ? `${marginValue}%` : ''}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <Label htmlFor="remark">Remark</Label>
                                    <textarea
                                        id="remark"
                                        rows={3}
                                        className="rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
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
                                <Button
                                    type="button"
                                    onClick={handleAddMaterial}
                                >
                                    Tambah Material
                                </Button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                No
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Nama Material
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Satuan
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Quantity
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Harga Modal
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Harga Penawaran
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
                                                    colSpan={9}
                                                >
                                                    Belum ada material.
                                                </td>
                                            </tr>
                                        )}
                                        {materialItems.map((item, index) => {
                                            const isEditing =
                                                editingMaterialId === item.id;
                                            const isDeleting =
                                                deletingMaterialId === item.id;
                                            const isSaving =
                                                savingMaterialId === item.id;
                                            const row = isEditing
                                                ? editingMaterial
                                                : item;
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="border-t border-sidebar-border/70"
                                                >
                                                    <td className="px-4 py-3">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                value={row?.nama ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'nama',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.nama
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                value={row?.satuan ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'satuan',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.satuan || '-'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                value={row?.quantity ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'quantity',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.quantity
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                value={row?.hargaModal ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'hargaModal',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.hargaModal
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                value={row?.hargaPenawaran ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'hargaPenawaran',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.hargaPenawaran
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {row?.margin
                                                            ? `${row.margin}%`
                                                            : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                value={row?.remark ?? ''}
                                                                onChange={(event) =>
                                                                    handleEditMaterialChange(
                                                                        'remark',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            item.remark || '-'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {isEditing ? (
                                                                <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    onClick={
                                                                        handleSaveMaterial
                                                                    }
                                                                    disabled={
                                                                        !row?.detailId ||
                                                                        isSaving ||
                                                                        isDeleting
                                                                    }
                                                                >
                                                                    {isSaving && (
                                                                        <Spinner className="mr-2" />
                                                                    )}
                                                                    {isSaving
                                                                        ? 'Menyimpan...'
                                                                        : 'Simpan'}
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    onClick={
                                                                        handleCancelEditMaterial
                                                                    }
                                                                    disabled={
                                                                        isSaving ||
                                                                        isDeleting
                                                                    }
                                                                >
                                                                    Batal
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    onClick={() =>
                                                                        handleEditMaterial(
                                                                            item
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isDeleting
                                                                    }
                                                                >
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    onClick={() =>
                                                                        handleRemoveMaterial(
                                                                            item.id,
                                                                            item.detailId
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isDeleting
                                                                    }
                                                                >
                                                                    {isDeleting && (
                                                                        <Spinner className="mr-2" />
                                                                    )}
                                                                    {isDeleting
                                                                        ? 'Menghapus...'
                                                                        : 'Hapus'}
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border/70 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setActiveStep((prev) => Math.max(0, prev - 1))
                                }
                                disabled={activeStep === 0}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setActiveStep((prev) =>
                                        Math.min(steps.length - 1, prev + 1)
                                    )
                                }
                                disabled={activeStep === steps.length - 1}
                            >
                                Berikutnya
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Spinner className="mr-2" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/marketing/quotation">Batal</Link>
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            <Dialog
                open={customerModalOpen}
                onOpenChange={(open) => {
                    setCustomerModalOpen(open);
                    if (open) {
                        loadCustomers();
                        setCustomerSearch('');
                        setCustomerPageSize(10);
                        setCustomerPage(1);
                    }
                }}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Pilih Customer</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={
                                    customerPageSize === Infinity
                                        ? 'all'
                                        : customerPageSize
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setCustomerPageSize(
                                        value === 'all' ? Infinity : Number(value)
                                    );
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Cari
                            <input
                                type="search"
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm"
                                placeholder="Cari customer..."
                                value={customerSearch}
                                onChange={(event) =>
                                    setCustomerSearch(event.target.value)
                                }
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">No</th>
                                    <th className="px-4 py-3 text-left">
                                        Kode CS
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Nama Customer
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Attend
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedCustomers.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-muted-foreground"
                                            colSpan={5}
                                        >
                                            {customerLoading
                                                ? 'Memuat data customer...'
                                                : customerError ||
                                                  'Data customer belum tersedia.'}
                                        </td>
                                    </tr>
                                )}
                                {displayedCustomers.map((item, index) => (
                                    <tr
                                        key={`${item.kd_cs}-${index}`}
                                        className="border-t border-sidebar-border/70"
                                        onDoubleClick={() =>
                                            handleSelectCustomer(item)
                                        }
                                    >
                                        <td className="px-4 py-3">
                                            {(customerPageSize === Infinity
                                                ? index
                                                : (customerPage - 1) *
                                                      customerPageSize +
                                                  index) + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.kd_cs}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.nm_cs}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.attnd}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                    handleSelectCustomer(item)
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

                    {customerPageSize !== Infinity && customerTotalItems > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                                Menampilkan{' '}
                                {Math.min(
                                    (customerPage - 1) * customerPageSize + 1,
                                    customerTotalItems
                                )}
                                -
                                {Math.min(
                                    customerPage * customerPageSize,
                                    customerTotalItems
                                )}{' '}
                                dari {customerTotalItems} data
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCustomerPage((page) =>
                                            Math.max(1, page - 1)
                                        )
                                    }
                                    disabled={customerPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Halaman {customerPage} dari{' '}
                                    {customerTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCustomerPage((page) =>
                                            Math.min(customerTotalPages, page + 1)
                                        )
                                    }
                                    disabled={customerPage === customerTotalPages}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={materialModalOpen}
                onOpenChange={(open) => {
                    setMaterialModalOpen(open);
                    if (open) {
                        loadMaterials();
                        setMaterialSearch('');
                        setMaterialPageSize(10);
                        setMaterialPage(1);
                    }
                }}
            >
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Pilih Material</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                                        value === 'all' ? Infinity : Number(value)
                                    );
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Cari
                            <input
                                type="search"
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm"
                                placeholder="Cari material..."
                                value={materialSearch}
                                onChange={(event) =>
                                    setMaterialSearch(event.target.value)
                                }
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">No</th>
                                    <th className="px-4 py-3 text-left">
                                        Material
                                    </th>
                                    <th className="px-4 py-3 text-left">Unit</th>
                                    <th className="px-4 py-3 text-left">Stok</th>
                                    <th className="px-4 py-3 text-left">
                                        Remark
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
                                            colSpan={6}
                                        >
                                            {materialLoading
                                                ? 'Memuat data material...'
                                                : materialError ||
                                                  'Data material belum tersedia.'}
                                        </td>
                                    </tr>
                                )}
                                {displayedMaterials.map((item, index) => (
                                    <tr
                                        key={`${item.material}-${index}`}
                                        className="border-t border-sidebar-border/70"
                                        onDoubleClick={() =>
                                            handleSelectMaterial(item)
                                        }
                                    >
                                        <td className="px-4 py-3">
                                            {(materialPageSize === Infinity
                                                ? index
                                                : (materialPage - 1) *
                                                      materialPageSize +
                                                  index) + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.material}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.unit}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.stok}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.remark || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                    handleSelectMaterial(item)
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

                    {materialPageSize !== Infinity && materialTotalItems > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                                Menampilkan{' '}
                                {Math.min(
                                    (materialPage - 1) * materialPageSize + 1,
                                    materialTotalItems
                                )}
                                -
                                {Math.min(
                                    materialPage * materialPageSize,
                                    materialTotalItems
                                )}{' '}
                                dari {materialTotalItems} data
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setMaterialPage((page) =>
                                            Math.max(1, page - 1)
                                        )
                                    }
                                    disabled={materialPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Halaman {materialPage} dari {materialTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setMaterialPage((page) =>
                                            Math.min(materialTotalPages, page + 1)
                                        )
                                    }
                                    disabled={materialPage === materialTotalPages}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
