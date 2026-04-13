import { Button } from '@/components/ui/button';
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
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    Landmark,
    PackageSearch,
    Pencil,
    ReceiptText,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
    { title: 'Tambah PO In', href: '/marketing/purchase-order-in/create' },
];

const toNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(toNumber(value))}`;
const toDisplayDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
    return text;
};

const normalizeDateInput = (value) => {
    const digits = String(value ?? '')
        .replace(/\D/g, '')
        .slice(0, 8);
    if (digits.length <= 2) {
        return digits;
    }
    if (digits.length <= 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const clampDmyValue = (value) => {
    const text = normalizeDateInput(value);
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
        return text;
    }

    let day = Number(match[1]);
    let month = Number(match[2]);
    const year = Number(match[3]);
    month = Math.max(1, Math.min(12, month));
    const maxDay = new Date(year, month, 0).getDate();
    day = Math.max(1, Math.min(maxDay, day));

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
};

const toIsoDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }
    const dmyMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return text;
    }
    return '';
};

const isValidDmyDate = (value) => {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
        return false;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (
        !Number.isInteger(day) ||
        !Number.isInteger(month) ||
        !Number.isInteger(year)
    ) {
        return false;
    }
    if (year < 1900 || month < 1 || month > 12 || day < 1) {
        return false;
    }

    const maxDay = new Date(year, month, 0).getDate();
    return day <= maxDay;
};

export default function PurchaseOrderInCreate({ defaults = {} }) {
    const datePickerRef = useRef(null);
    const deliveryDatePickerRef = useRef(null);
    const qtyRef = useRef(null);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState('');
    const [isMaterialCreateModalOpen, setIsMaterialCreateModalOpen] =
        useState(false);
    const [materialCreateForm, setMaterialCreateForm] = useState({
        material: '',
        unit: '',
        stok: 0,
        remark: '',
    });
    const [materialCreateErrors, setMaterialCreateErrors] = useState({});
    const [isMaterialCreating, setIsMaterialCreating] = useState(false);

    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
    const [customerList, setCustomerList] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [isCustomerCreateModalOpen, setIsCustomerCreateModalOpen] =
        useState(false);
    const [customerCreateForm, setCustomerCreateForm] = useState({
        nm_cs: '',
        alamat_cs: '',
        kota_cs: '',
        telp_cs: '',
        fax_cs: '',
        npwp_cs: '',
        npwp1_cs: '',
        npwp2_cs: '',
        Attnd: '',
    });
    const [customerCreateErrors, setCustomerCreateErrors] = useState({});
    const [isCustomerCreating, setIsCustomerCreating] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        noPoin: '',
        date: toDisplayDate(defaults.date),
        deliveryDate: toDisplayDate(defaults.date),
        customerCode: '',
        customerName: '',
        paymentTerm: defaults.payment_term ?? '30 Hari',
        ppnPercent: '',
        francoLoco: '',
        note: '',
    });

    const [itemForm, setItemForm] = useState({
        kodeMaterial: '',
        material: '',
        qty: '',
        unit: '',
        unitPrice: '',
        totalPricePoIn: '',
        note: '',
    });
    const [items, setItems] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);

    const handleAddItem = () => {
        if (!itemForm.material || !itemForm.qty) {
            return;
        }
        if (editingItemId) {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === editingItemId ? { ...item, ...itemForm } : item,
                ),
            );
            setEditingItemId(null);
        } else {
            setItems((prev) => [
                ...prev,
                { ...itemForm, id: `${Date.now()}-${Math.random()}` },
            ]);
        }
        setValidationErrors((prev) => ({ ...prev, materials: '' }));
        setItemForm({
            kodeMaterial: '',
            material: '',
            qty: '',
            unit: '',
            unitPrice: '',
            totalPricePoIn: '',
            note: '',
        });
    };

    const validateBeforeSave = () => {
        const errors = {};
        if (!String(form.noPoin ?? '').trim()) {
            errors.noPoin = 'No PO In wajib diisi.';
        }
        if (!isValidDmyDate(form.date)) {
            errors.date = 'Date PO In wajib format dd/mm/yyyy yang valid.';
        }
        if (!isValidDmyDate(form.deliveryDate)) {
            errors.deliveryDate =
                'Delivery Date wajib format dd/mm/yyyy yang valid.';
        }
        if (!String(form.customerName ?? '').trim()) {
            errors.customerName = 'Nama Customer wajib diisi.';
        }
        if (!String(form.ppnPercent ?? '').trim()) {
            errors.ppnPercent = 'PPN wajib diisi.';
        }
        if (!String(form.francoLoco ?? '').trim()) {
            errors.francoLoco = 'Franco/Loco wajib diisi.';
        }
        if (!Array.isArray(items) || items.length === 0) {
            errors.materials = 'Data material wajib diisi.';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSavePoIn = () => {
        if (!validateBeforeSave()) {
            return;
        }

        const payload = {
            no_poin: form.noPoin,
            date: toIsoDate(form.date),
            delivery_date: toIsoDate(form.deliveryDate),
            kd_customer: form.customerCode,
            customer_name: form.customerName,
            payment_term: form.paymentTerm,
            ppn_percent: toNumber(form.ppnPercent),
            franco_loco: form.francoLoco,
            note: form.note,
            total_price: totalPrice,
            dpp,
            ppn_value: ppn,
            grand_total: grandTotal,
            materials: items.map((item) => ({
                kd_material: item.kodeMaterial,
                material: item.material,
                qty: toNumber(item.qty),
                satuan: item.unit,
                price_po_in: toNumber(item.unitPrice),
                total_price_po_in:
                    toNumber(item.qty) * toNumber(item.unitPrice),
                remark: item.note,
            })),
        };

        router.post('/marketing/purchase-order-in', payload, {
            preserveScroll: true,
            headers: {
                'X-Skip-Loading-Overlay': '1',
            },
            onStart: () => setIsSubmitting(true),
            onError: () => setIsSubmitting(false),
            onSuccess: (page) => {
                if (page?.props?.flash?.error) {
                    setIsSubmitting(false);
                }
            },
        });
    };

    const handleEditItem = (item) => {
        setItemForm({
            kodeMaterial: item.kodeMaterial ?? '',
            material: item.material ?? '',
            qty: item.qty ?? '',
            unit: item.unit ?? '',
            unitPrice: item.unitPrice ?? '',
            totalPricePoIn: item.totalPricePoIn ?? '',
            note: item.note ?? '',
        });
        setEditingItemId(item.id);
    };

    const handleDeleteItem = (id) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (editingItemId === id) {
            setEditingItemId(null);
            setItemForm({
                kodeMaterial: '',
                material: '',
                qty: '',
                unit: '',
                unitPrice: '',
                totalPricePoIn: '',
                note: '',
            });
        }
    };

    const handleCancelEditItem = () => {
        setEditingItemId(null);
        setItemForm({
            kodeMaterial: '',
            material: '',
            qty: '',
            unit: '',
            unitPrice: '',
            totalPricePoIn: '',
            note: '',
        });
    };

    const itemTotalPricePoIn = useMemo(
        () => toNumber(itemForm.qty) * toNumber(itemForm.unitPrice),
        [itemForm.qty, itemForm.unitPrice],
    );

    const totalPrice = useMemo(
        () =>
            items.reduce(
                (total, item) =>
                    total + toNumber(item.qty) * toNumber(item.unitPrice),
                0,
            ),
        [items],
    );
    const ppnPercentInput = useMemo(
        () => toNumber(form.ppnPercent),
        [form.ppnPercent],
    );
    const ppnPercentValue = useMemo(
        () => Math.min(11, ppnPercentInput),
        [ppnPercentInput],
    );
    const dpp = useMemo(() => {
        if (!ppnPercentInput) {
            return totalPrice;
        }
        return Math.round((11 / ppnPercentInput) * totalPrice);
    }, [ppnPercentInput, totalPrice]);
    const ppn = useMemo(
        () => Math.round(totalPrice * (ppnPercentValue / 100)),
        [totalPrice, ppnPercentValue],
    );
    const grandTotal = useMemo(() => totalPrice + ppn, [totalPrice, ppn]);

    const formatRupiahInput = (value) => {
        const digits = String(value ?? '').replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        return formatRupiah(digits);
    };

    const loadMaterials = async () => {
        setMaterialLoading(true);
        setMaterialError('');
        try {
            const params = new URLSearchParams();
            params.set(
                'per_page',
                materialPageSize === Infinity
                    ? 'all'
                    : String(materialPageSize),
            );
            params.set('page', String(materialCurrentPage));
            if (materialSearchTerm.trim()) {
                params.set('search', materialSearchTerm.trim());
            }
            const response = await fetch(
                `/marketing/purchase-order-in/materials?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            setMaterialList(
                Array.isArray(data?.materials) ? data.materials : [],
            );
            setMaterialTotal(Number(data?.total ?? 0));
        } catch (error) {
            setMaterialError('Gagal memuat data material.');
        } finally {
            setMaterialLoading(false);
        }
    };

    const loadCustomers = async () => {
        setCustomerLoading(true);
        setCustomerError('');
        try {
            const params = new URLSearchParams();
            params.set(
                'per_page',
                customerPageSize === Infinity ? 'all' : customerPageSize,
            );
            params.set('page', customerCurrentPage);
            if (customerSearchTerm.trim()) {
                params.set('search', customerSearchTerm.trim());
            }
            const response = await fetch(
                `/marketing/purchase-order-in/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            setCustomerList(
                Array.isArray(data?.customers) ? data.customers : [],
            );
            setCustomerTotal(Number(data?.total ?? 0));
        } catch (error) {
            setCustomerError('Gagal memuat data customer.');
        } finally {
            setCustomerLoading(false);
        }
    };

    const toast = (icon, title) => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon,
            title,
            showConfirmButton: false,
            timer: 2500,
        });
    };

    const dispatchGlobalToast = (message, variant) => {
        window.dispatchEvent(
            new CustomEvent('app:toast', {
                detail: { message, variant },
            }),
        );
    };

    const handleCreateCustomer = async (event) => {
        event.preventDefault();
        setCustomerCreateErrors({});
        setIsCustomerCreating(true);

        try {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');

            const response = await fetch(
                '/marketing/purchase-order-in/customers',
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': token ?? '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(customerCreateForm),
                },
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 422 && data?.errors) {
                    setCustomerCreateErrors(data.errors);
                }
                throw new Error(
                    data?.message ||
                        (data?.errors &&
                            Object.values(data.errors).flat()[0]) ||
                        'Gagal menyimpan customer.',
                );
            }

            const customer = data?.customer ?? {};
            setForm((prev) => ({
                ...prev,
                customerCode: customer.kd_cs ?? '',
                customerName: customer.nm_cs ?? '',
            }));
            setValidationErrors((prev) => ({ ...prev, customerName: '' }));
            setIsCustomerCreateModalOpen(false);
            setIsCustomerModalOpen(false);
            setCustomerCreateForm({
                nm_cs: '',
                alamat_cs: '',
                kota_cs: '',
                telp_cs: '',
                fax_cs: '',
                npwp_cs: '',
                npwp1_cs: '',
                npwp2_cs: '',
                Attnd: '',
            });
            toast(
                'success',
                data?.message || 'Data customer berhasil disimpan.',
            );
        } catch (error) {
            toast('error', error?.message || 'Gagal menyimpan customer.');
        } finally {
            setIsCustomerCreating(false);
        }
    };

    const handleCreateMaterial = async (event) => {
        event.preventDefault();
        setMaterialCreateErrors({});
        setIsMaterialCreating(true);

        try {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');

            const response = await fetch(
                '/marketing/purchase-order-in/materials',
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': token ?? '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(materialCreateForm),
                },
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 422 && data?.errors) {
                    setMaterialCreateErrors(data.errors);
                }
                throw new Error(
                    data?.message ||
                        (data?.errors &&
                            Object.values(data.errors).flat()[0]) ||
                        'Gagal menyimpan material.',
                );
            }

            const created = data?.material ?? {};
            setItemForm((prev) => ({
                ...prev,
                kodeMaterial: created.kd_material ?? '',
                material: created.material ?? '',
                unit: created.unit ?? '',
                unitPrice: '',
            }));
            setIsMaterialCreateModalOpen(false);
            setIsMaterialModalOpen(false);
            setMaterialCreateForm({
                material: '',
                unit: '',
                stok: 0,
                remark: '',
            });
            dispatchGlobalToast(
                data?.message || 'Data material berhasil disimpan.',
                'success',
            );
        } catch (error) {
            dispatchGlobalToast(
                error?.message || 'Gagal menyimpan material.',
                'error',
            );
        } finally {
            setIsMaterialCreating(false);
        }
    };

    useEffect(() => {
        if (!isCustomerModalOpen) {
            return;
        }
        loadCustomers();
    }, [
        isCustomerModalOpen,
        customerCurrentPage,
        customerPageSize,
        customerSearchTerm,
    ]);

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

    const displayedCustomers = useMemo(() => {
        return customerList;
    }, [customerList]);

    useEffect(() => {
        if (!isMaterialModalOpen) {
            return;
        }
        loadMaterials();
    }, [
        isMaterialModalOpen,
        materialCurrentPage,
        materialPageSize,
        materialSearchTerm,
    ]);

    const materialTotalItems = materialTotal;
    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(materialTotalItems / materialPageSize));
    }, [materialPageSize, materialTotalItems]);

    const displayedMaterials = useMemo(() => materialList, [materialList]);

    const handleMaterialSelect = (material) => {
        setItemForm((prev) => ({
            ...prev,
            kodeMaterial: material.kd_material ?? '',
            material: material.material ?? '',
            unit: material.unit ?? prev.unit,
        }));
        setIsMaterialModalOpen(false);
        // Delay focus to allow modal close animation and state updates to settle
        setTimeout(() => {
            qtyRef.current?.focus();
        }, 100);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah PO In" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4">
                {/* Header section with explicit hex background for maximum compatibility */}
                <section
                    className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5 text-white shadow-lg"
                    style={{ backgroundColor: '#0f172a' }}
                >
                    <h1 className="mt-1 text-2xl font-bold text-white">
                        Form Purchase Order In
                    </h1>
                </section>

                <div className="grid gap-5">
                    <section className="grid gap-5 xl:grid-cols-[4fr_1.3fr]">
                        <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Landmark className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">
                                    Informasi Header
                                </h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="grid gap-4 md:col-span-4 md:grid-cols-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="no_poin">
                                            No PO In
                                        </Label>
                                        <Input
                                            id="no_poin"
                                            className={
                                                validationErrors.noPoin
                                                    ? 'border-red-500 focus-visible:ring-red-500'
                                                    : ''
                                            }
                                            placeholder="PO In dari Customer"
                                            value={form.noPoin}
                                            onChange={(event) => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    noPoin: event.target.value,
                                                }));
                                                setValidationErrors((prev) => ({
                                                    ...prev,
                                                    noPoin: '',
                                                }));
                                            }}
                                        />
                                        {validationErrors.noPoin && (
                                            <p className="text-xs text-red-500">
                                                {validationErrors.noPoin}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="tanggal">
                                            Date PO In
                                        </Label>
                                        <div className="relative flex gap-2">
                                            <Input
                                                id="tanggal"
                                                className={
                                                    validationErrors.date
                                                        ? 'border-red-500 focus-visible:ring-red-500'
                                                        : ''
                                                }
                                                value={form.date}
                                                placeholder="dd/mm/yyyy"
                                                onFocus={(event) =>
                                                    event.target.select()
                                                }
                                                onChange={(event) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        date: normalizeDateInput(
                                                            event.target.value,
                                                        ),
                                                    }))
                                                }
                                                onBlur={(event) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        date: clampDmyValue(
                                                            event.target.value,
                                                        ),
                                                    }));
                                                    setValidationErrors(
                                                        (prev) => ({
                                                            ...prev,
                                                            date: '',
                                                        }),
                                                    );
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="shrink-0 px-3"
                                                onClick={() => {
                                                    if (
                                                        datePickerRef.current
                                                            ?.showPicker
                                                    ) {
                                                        datePickerRef.current.showPicker();
                                                        return;
                                                    }
                                                    datePickerRef.current?.click();
                                                }}
                                                title="Pilih tanggal"
                                            >
                                                <CalendarDays className="size-4" />
                                            </Button>
                                            <input
                                                ref={datePickerRef}
                                                type="date"
                                                className="pointer-events-none absolute h-0 w-0 opacity-0"
                                                value={toIsoDate(form.date)}
                                                onChange={(event) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        date: toDisplayDate(
                                                            event.target.value,
                                                        ),
                                                    }));
                                                    setValidationErrors(
                                                        (prev) => ({
                                                            ...prev,
                                                            date: '',
                                                        }),
                                                    );
                                                }}
                                            />
                                        </div>
                                        {validationErrors.date && (
                                            <p className="text-xs text-red-500">
                                                {validationErrors.date}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="delivery_date">
                                            Delivery Date
                                        </Label>
                                        <div className="relative flex gap-2">
                                            <Input
                                                id="delivery_date"
                                                className={
                                                    validationErrors.deliveryDate
                                                        ? 'border-red-500 focus-visible:ring-red-500'
                                                        : ''
                                                }
                                                value={form.deliveryDate}
                                                placeholder="dd/mm/yyyy"
                                                onFocus={(event) =>
                                                    event.target.select()
                                                }
                                                onChange={(event) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        deliveryDate:
                                                            normalizeDateInput(
                                                                event.target
                                                                    .value,
                                                            ),
                                                    }))
                                                }
                                                onBlur={(event) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        deliveryDate:
                                                            clampDmyValue(
                                                                event.target
                                                                    .value,
                                                            ),
                                                    }));
                                                    setValidationErrors(
                                                        (prev) => ({
                                                            ...prev,
                                                            deliveryDate: '',
                                                        }),
                                                    );
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="shrink-0 px-3"
                                                onClick={() => {
                                                    if (
                                                        deliveryDatePickerRef
                                                            .current?.showPicker
                                                    ) {
                                                        deliveryDatePickerRef.current.showPicker();
                                                        return;
                                                    }
                                                    deliveryDatePickerRef.current?.click();
                                                }}
                                                title="Pilih tanggal"
                                            >
                                                <CalendarDays className="size-4" />
                                            </Button>
                                            <input
                                                ref={deliveryDatePickerRef}
                                                type="date"
                                                className="pointer-events-none absolute h-0 w-0 opacity-0"
                                                value={toIsoDate(
                                                    form.deliveryDate,
                                                )}
                                                onChange={(event) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        deliveryDate:
                                                            toDisplayDate(
                                                                event.target
                                                                    .value,
                                                            ),
                                                    }));
                                                    setValidationErrors(
                                                        (prev) => ({
                                                            ...prev,
                                                            deliveryDate: '',
                                                        }),
                                                    );
                                                }}
                                            />
                                        </div>
                                        {validationErrors.deliveryDate && (
                                            <p className="text-xs text-red-500">
                                                {validationErrors.deliveryDate}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-4 md:col-span-4 md:grid-cols-4">
                                    <div className="grid gap-2 md:col-span-1">
                                        <Label htmlFor="customer_code">
                                            Kode Customer
                                        </Label>
                                        <Input
                                            id="customer_code"
                                            value={form.customerCode}
                                            readOnly
                                            placeholder="Kode customer"
                                        />
                                    </div>
                                    <div className="grid gap-2 md:col-span-3">
                                        <Label htmlFor="customer_name">
                                            Nama Customer
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="customer_name"
                                                className={
                                                    validationErrors.customerName
                                                        ? 'border-red-500 focus-visible:ring-red-500'
                                                        : ''
                                                }
                                                value={form.customerName}
                                                readOnly
                                                placeholder="Pilih customer"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setIsCustomerModalOpen(
                                                        true,
                                                    );
                                                    setCustomerSearchTerm('');
                                                    setCustomerPageSize(5);
                                                    setCustomerCurrentPage(1);
                                                }}
                                            >
                                                Cari Customer
                                            </Button>
                                        </div>
                                        {validationErrors.customerName && (
                                            <p className="text-xs text-red-500">
                                                {validationErrors.customerName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_term">
                                        Payment Term
                                    </Label>
                                    <Input
                                        id="payment_term"
                                        value={form.paymentTerm}
                                        onFocus={(event) =>
                                            event.target.select()
                                        }
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                paymentTerm: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="ppn_percent">PPN (%)</Label>
                                    <Input
                                        id="ppn_percent"
                                        className={
                                            validationErrors.ppnPercent
                                                ? 'border-red-500 focus-visible:ring-red-500'
                                                : ''
                                        }
                                        inputMode="decimal"
                                        value={form.ppnPercent}
                                        onChange={(event) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                ppnPercent:
                                                    event.target.value.replace(
                                                        /[^\d.]/g,
                                                        '',
                                                    ),
                                            }));
                                            setValidationErrors((prev) => ({
                                                ...prev,
                                                ppnPercent: '',
                                            }));
                                        }}
                                    />
                                    {validationErrors.ppnPercent && (
                                        <p className="text-xs text-red-500">
                                            {validationErrors.ppnPercent}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="franco_loco">
                                        Franco/Loco
                                    </Label>
                                    <Input
                                        id="franco_loco"
                                        className={
                                            validationErrors.francoLoco
                                                ? 'border-red-500 focus-visible:ring-red-500'
                                                : ''
                                        }
                                        value={form.francoLoco}
                                        onChange={(event) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                francoLoco: event.target.value,
                                            }));
                                            setValidationErrors((prev) => ({
                                                ...prev,
                                                francoLoco: '',
                                            }));
                                        }}
                                    />
                                    {validationErrors.francoLoco && (
                                        <p className="text-xs text-red-500">
                                            {validationErrors.francoLoco}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2 md:col-span-4">
                                    <Label htmlFor="doc_note">
                                        Catatan Dokumen
                                    </Label>
                                    <textarea
                                        id="doc_note"
                                        rows={3}
                                        className="rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                        value={form.note}
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                note: event.target.value,
                                            }))
                                        }
                                        placeholder="Catatan internal untuk tim marketing/purchasing"
                                    />
                                </div>
                            </div>
                        </article>

                        <aside className="grid content-start gap-3 self-start">
                            <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <ReceiptText className="size-4 text-muted-foreground" />
                                    <h2 className="text-base font-semibold">
                                        Ringkasan
                                    </h2>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between border-t border-sidebar-border/70 pt-3">
                                        <span className="text-muted-foreground">
                                            Total Price
                                        </span>
                                        <span className="font-semibold">
                                            {formatRupiah(totalPrice)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">
                                            DPP
                                        </span>
                                        <span className="font-semibold">
                                            {formatRupiah(dpp)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">
                                            PPN ({form.ppnPercent || '0'}%)
                                        </span>
                                        <span className="font-semibold">
                                            {formatRupiah(ppn)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-sidebar-border/70 pt-3">
                                        <span className="text-muted-foreground">
                                            Grand Total
                                        </span>
                                        <span className="text-lg font-semibold">
                                            {formatRupiah(grandTotal)}
                                        </span>
                                    </div>
                                </div>
                            </article>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    className="flex-1"
                                    type="button"
                                    onClick={handleSavePoIn}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting && (
                                        <Spinner className="mr-2" />
                                    )}
                                    Simpan PO In
                                </Button>
                                <Button
                                    variant="outline"
                                    asChild
                                    className="flex-1"
                                >
                                    <Link href="/marketing/purchase-order-in">
                                        Batal
                                    </Link>
                                </Button>
                            </div>
                        </aside>
                    </section>

                    <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <PackageSearch className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">
                                Item Material
                            </h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-8">
                            <div className="grid gap-2 md:col-span-1">
                                <Label htmlFor="kode_material">
                                    Kode Material
                                </Label>
                                <Input
                                    id="kode_material"
                                    value={itemForm.kodeMaterial}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            kodeMaterial: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-7">
                                <Label htmlFor="material">Material</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="material"
                                        value={itemForm.material}
                                        onChange={(event) =>
                                            setItemForm((prev) => ({
                                                ...prev,
                                                material: event.target.value,
                                            }))
                                        }
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsMaterialModalOpen(true);
                                        }}
                                    >
                                        Cari Material
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2 md:col-span-1">
                                <Label htmlFor="qty">Qty</Label>
                                <Input
                                    id="qty"
                                    ref={qtyRef}
                                    type="number"
                                    value={itemForm.qty}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            qty: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-1">
                                <Label htmlFor="unit">Satuan</Label>
                                <Input
                                    id="unit"
                                    value={itemForm.unit}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            unit: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-3">
                                <Label htmlFor="price">Price PO In</Label>
                                <Input
                                    id="price"
                                    value={formatRupiahInput(
                                        itemForm.unitPrice,
                                    )}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            unitPrice:
                                                event.target.value.replace(
                                                    /[^\d]/g,
                                                    '',
                                                ),
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-3">
                                <Label htmlFor="total_price_po_in">
                                    Total Price PO In
                                </Label>
                                <Input
                                    id="total_price_po_in"
                                    value={formatRupiah(itemTotalPricePoIn)}
                                    readOnly
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-8">
                                <Label htmlFor="item_note">Remark</Label>
                                <Input
                                    id="item_note"
                                    value={itemForm.note}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            note: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Button type="button" onClick={handleAddItem}>
                                {editingItemId
                                    ? 'Simpan Perubahan'
                                    : 'Tambah Item'}
                            </Button>
                            {editingItemId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="ml-2"
                                    onClick={handleCancelEditItem}
                                >
                                    Batal Edit
                                </Button>
                            )}
                        </div>

                        <div className="mt-4 overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-muted-foreground">
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
                                            Price PO In
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Total Price PO In
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Remark
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-8 text-center text-muted-foreground"
                                                colSpan={9}
                                            >
                                                Belum ada item material.
                                            </td>
                                        </tr>
                                    )}
                                    {items.map((item, index) => (
                                        <tr
                                            key={item.id}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {index + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.kodeMaterial || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.material}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.qty}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.unit}
                                            </td>
                                            <td className="px-4 py-3">
                                                {formatRupiah(item.unitPrice)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {formatRupiah(
                                                    toNumber(item.qty) *
                                                        toNumber(
                                                            item.unitPrice,
                                                        ),
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.note || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleEditItem(item)
                                                        }
                                                        title="Edit"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDeleteItem(
                                                                item.id,
                                                            )
                                                        }
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {validationErrors.materials && (
                            <p className="mt-2 text-xs text-red-500">
                                {validationErrors.materials}
                            </p>
                        )}
                    </article>
                </div>
            </div>

            <Dialog
                open={isMaterialModalOpen}
                onOpenChange={(open) => {
                    setIsMaterialModalOpen(open);
                    if (!open) {
                        setMaterialSearchTerm('');
                        setMaterialPageSize(5);
                        setMaterialCurrentPage(1);
                        setMaterialList([]);
                        setMaterialTotal(0);
                        setMaterialCreateErrors({});
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                    <DialogHeader>
                        <DialogTitle>Pilih Material</DialogTitle>
                        <DialogDescription className="sr-only">
                            Pilih data material untuk item PO In.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <label>
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
                                    setMaterialCurrentPage(1);
                                }}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label>
                            Cari
                            <input
                                type="search"
                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                placeholder="Cari kode/nama material..."
                                value={materialSearchTerm}
                                onChange={(event) => {
                                    setMaterialSearchTerm(event.target.value);
                                    setMaterialCurrentPage(1);
                                }}
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        Kode Material
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Nama Material
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Stok
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Satuan
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
                                            colSpan={5}
                                        >
                                            {materialLoading
                                                ? 'Memuat data material...'
                                                : materialError ||
                                                  'Tidak ada data material.'}
                                            {/* {!materialLoading && (
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setIsMaterialCreateModalOpen(
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        Buat Material
                                                    </Button>
                                                </div>
                                            )} */}
                                        </td>
                                    </tr>
                                )}
                                {displayedMaterials.map((item) => (
                                    <tr
                                        key={item.kd_material}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-4 py-3">
                                            {item.kd_material ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.material ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.stok ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.unit ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleMaterialSelect(item)
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

                    {materialPageSize !== Infinity &&
                        materialTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (materialCurrentPage - 1) *
                                            materialPageSize +
                                            1,
                                        materialTotalItems,
                                    )}
                                    -
                                    {Math.min(
                                        materialCurrentPage * materialPageSize,
                                        materialTotalItems,
                                    )}{' '}
                                    dari {materialTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setMaterialCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={materialCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {materialCurrentPage} dari{' '}
                                        {materialTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setMaterialCurrentPage((page) =>
                                                Math.min(
                                                    materialTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            materialCurrentPage ===
                                            materialTotalPages
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isMaterialCreateModalOpen}
                onOpenChange={(open) => {
                    setIsMaterialCreateModalOpen(open);
                    if (!open) {
                        setMaterialCreateErrors({});
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                    <DialogHeader>
                        <DialogTitle>Tambah Material</DialogTitle>
                        <DialogDescription className="sr-only">
                            Form tambah material baru untuk PO In.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleCreateMaterial}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="new_material">
                                    Nama Material
                                </Label>
                                <Input
                                    id="new_material"
                                    value={materialCreateForm.material}
                                    onChange={(event) =>
                                        setMaterialCreateForm((prev) => ({
                                            ...prev,
                                            material: event.target.value,
                                        }))
                                    }
                                />
                                {materialCreateErrors.material && (
                                    <p className="text-xs text-red-500">
                                        {materialCreateErrors.material[0]}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_unit">Satuan</Label>
                                <Input
                                    id="new_unit"
                                    value={materialCreateForm.unit}
                                    onChange={(event) =>
                                        setMaterialCreateForm((prev) => ({
                                            ...prev,
                                            unit: event.target.value,
                                        }))
                                    }
                                />
                                {materialCreateErrors.unit && (
                                    <p className="text-xs text-red-500">
                                        {materialCreateErrors.unit[0]}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_stok">Stok</Label>
                                <Input
                                    id="new_stok"
                                    type="number"
                                    min={0}
                                    value={materialCreateForm.stok}
                                    onChange={(event) =>
                                        setMaterialCreateForm((prev) => ({
                                            ...prev,
                                            stok: event.target.value,
                                        }))
                                    }
                                />
                                {materialCreateErrors.stok && (
                                    <p className="text-xs text-red-500">
                                        {materialCreateErrors.stok[0]}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="new_material_remark">
                                    Remark
                                </Label>
                                <Input
                                    id="new_material_remark"
                                    value={materialCreateForm.remark}
                                    onChange={(event) =>
                                        setMaterialCreateForm((prev) => ({
                                            ...prev,
                                            remark: event.target.value,
                                        }))
                                    }
                                />
                                {materialCreateErrors.remark && (
                                    <p className="text-xs text-red-500">
                                        {materialCreateErrors.remark[0]}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setIsMaterialCreateModalOpen(false)
                                }
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={isMaterialCreating}>
                                {isMaterialCreating
                                    ? 'Menyimpan...'
                                    : 'Simpan Data'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

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
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                    <DialogHeader>
                        <DialogTitle>Pilih Customer</DialogTitle>
                        <DialogDescription className="sr-only">
                            Pilih data customer untuk PO In.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <label>
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
                                        value === 'all'
                                            ? Infinity
                                            : Number(value),
                                    );
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
                                placeholder="Cari kode/nama/kota..."
                                value={customerSearchTerm}
                                onChange={(event) => {
                                    setCustomerSearchTerm(event.target.value);
                                    setCustomerCurrentPage(1);
                                }}
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        Kode CS
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Kota
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
                                            colSpan={4}
                                        >
                                            {customerLoading
                                                ? 'Memuat data customer...'
                                                : customerError ||
                                                  'Tidak ada data customer.'}
                                            {/* {!customerLoading && (
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setIsCustomerCreateModalOpen(
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        Buat Data Customer
                                                    </Button>
                                                </div>
                                            )} */}
                                        </td>
                                    </tr>
                                )}
                                {displayedCustomers.map((item) => (
                                    <tr
                                        key={item.kd_cs}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-4 py-3">
                                            {item.kd_cs ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.nm_cs ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.kota_cs ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        customerCode:
                                                            item.kd_cs ?? '',
                                                        customerName:
                                                            item.nm_cs ?? '',
                                                    }));
                                                    setValidationErrors(
                                                        (prev) => ({
                                                            ...prev,
                                                            customerName: '',
                                                        }),
                                                    );
                                                    setIsCustomerModalOpen(
                                                        false,
                                                    );
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
                                Menampilkan{' '}
                                {Math.min(
                                    (customerCurrentPage - 1) *
                                        customerPageSize +
                                        1,
                                    customerTotal,
                                )}
                                -
                                {Math.min(
                                    customerCurrentPage * customerPageSize,
                                    customerTotal,
                                )}{' '}
                                dari {customerTotal} data
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCustomerCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={customerCurrentPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Halaman {customerCurrentPage} dari{' '}
                                    {customerTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCustomerCurrentPage((p) =>
                                            Math.min(
                                                customerTotalPages || p,
                                                p + 1,
                                            ),
                                        )
                                    }
                                    disabled={
                                        customerTotalPages
                                            ? customerCurrentPage >=
                                              customerTotalPages
                                            : true
                                    }
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isCustomerCreateModalOpen}
                onOpenChange={(open) => {
                    setIsCustomerCreateModalOpen(open);
                    if (!open) {
                        setCustomerCreateErrors({});
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                    <DialogHeader>
                        <DialogTitle>Tambah Customer</DialogTitle>
                        <DialogDescription className="sr-only">
                            Form tambah customer baru untuk PO In.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleCreateCustomer}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="new_nm_cs">Nama Customer</Label>
                                <Input
                                    id="new_nm_cs"
                                    value={customerCreateForm.nm_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            nm_cs: event.target.value,
                                        }))
                                    }
                                />
                                {customerCreateErrors.nm_cs && (
                                    <p className="text-xs text-red-500">
                                        {customerCreateErrors.nm_cs[0]}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_kota_cs">Kota</Label>
                                <Input
                                    id="new_kota_cs"
                                    value={customerCreateForm.kota_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            kota_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="new_alamat_cs">Alamat</Label>
                                <Input
                                    id="new_alamat_cs"
                                    value={customerCreateForm.alamat_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            alamat_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_telp_cs">Telpon</Label>
                                <Input
                                    id="new_telp_cs"
                                    value={customerCreateForm.telp_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            telp_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_fax_cs">Fax</Label>
                                <Input
                                    id="new_fax_cs"
                                    value={customerCreateForm.fax_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            fax_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_npwp_cs">NPWP</Label>
                                <Input
                                    id="new_npwp_cs"
                                    value={customerCreateForm.npwp_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            npwp_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_Attnd">Attended</Label>
                                <Input
                                    id="new_Attnd"
                                    value={customerCreateForm.Attnd}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            Attnd: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="new_npwp1_cs">
                                    Alamat NPWP 1
                                </Label>
                                <Input
                                    id="new_npwp1_cs"
                                    value={customerCreateForm.npwp1_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            npwp1_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="new_npwp2_cs">
                                    Alamat NPWP 2
                                </Label>
                                <Input
                                    id="new_npwp2_cs"
                                    value={customerCreateForm.npwp2_cs}
                                    onChange={(event) =>
                                        setCustomerCreateForm((prev) => ({
                                            ...prev,
                                            npwp2_cs: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setIsCustomerCreateModalOpen(false)
                                }
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={isCustomerCreating}>
                                {isCustomerCreating
                                    ? 'Menyimpan...'
                                    : 'Simpan Data'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
