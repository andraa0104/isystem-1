import InputError from '@/components/input-error';
import QuotationAttendInput from '@/components/quotation-attend-input';
import RichTextEditor from '@/components/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Boxes,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    FileText,
    Mail,
    MapPin,
    Package,
    PackageSearch,
    Pencil,
    Phone,
    Plus,
    Printer,
    Save,
    Search,
    Sparkles,
    Trash2,
    TrendingDown,
    TrendingUp,
    Truck,
    User,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
    { title: 'Tambah Quotation', href: '/marketing/quotation/create' },
];

const steps = [
    {
        id: 'customer',
        label: 'Data Customer',
        desc: 'Identitas & kontak klien',
        icon: Building2,
    },
    {
        id: 'detail',
        label: 'Detail Ketentuan',
        desc: 'Syarat transaksi & catatan',
        icon: FileText,
    },
    {
        id: 'material',
        label: 'Data Material',
        desc: 'Rincian barang & penawaran',
        icon: Boxes,
    },
];

const renderValue = (value) => (value ?? '')?.toString();

const formatPercent = (value) => {
    const text = renderValue(value).trim();
    if (!text) {
        return '-';
    }
    return text.endsWith('%') ? text : `${text}%`;
};

const parseNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiahInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) {
        return '';
    }
    return `Rp ${Number(digits).toLocaleString('id-ID')}`;
};

const formatInteger = (value) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) {
        return '0';
    }

    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.trunc(number));
};

const fillOrSpace = (value) => {
    const text = String(value ?? '').trim();
    return text === '' ? ' ' : text;
};

const showToast = (message, variant = 'error') => {
    if (!message) {
        return;
    }

    window.dispatchEvent(
        new CustomEvent('app:toast', {
            detail: { message, variant },
        }),
    );
};

const resizeTextareaToContent = (element) => {
    if (!element) return;

    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
};

const getFirstErrorMessage = (errors, fallback) => {
    const first = Object.values(errors ?? {})[0];
    return (Array.isArray(first) ? first[0] : first) || fallback;
};

const getCsrfToken = () =>
    document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

const todayDate = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
};

export default function QuotationCreate({ customers = [], materials = [] }) {
    const [activeStep, setActiveStep] = useState(0);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [materialModalOpen, setMaterialModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customerList, setCustomerList] = useState(customers);
    const [materialList, setMaterialList] = useState(materials);
    const [customerTotalItems, setCustomerTotalItems] = useState(
        customers.length,
    );
    const [materialTotalItems, setMaterialTotalItems] = useState(
        materials.length,
    );
    const [customerLoading, setCustomerLoading] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [materialError, setMaterialError] = useState('');
    const hargaPenawaranRef = useRef(null);
    const namaMaterialRef = useRef(null);
    const customerRequestSeq = useRef(0);
    const customerSelectionSeq = useRef(0);
    const materialRequestSeq = useRef(0);

    const [customerForm, setCustomerForm] = useState({
        tglPenawaran: todayDate(),
        nama: '',
        alamat: '',
        telepon: '',
        fax: '',
        email: '',
        attend: '',
        kode: '',
    });

    const [detailForm, setDetailForm] = useState({
        payment: '30 Hari',
        validity: '7 Hari',
        delivery: '3 Hari Kerja setelah PO kami terima/Menyesuaikan',
        franco: '',
        note1: '',
        note2: '',
        note3: '',
    });

    const [materialForm, setMaterialForm] = useState({
        nama: '',
        satuan: '',
        quantity: '1',
        hargaModal: '',
        hargaPenawaran: '',
        remark: '',
    });
    const [materialFormErrors, setMaterialFormErrors] = useState({});

    const [materialItems, setMaterialItems] = useState([]);
    const [editingMaterialId, setEditingMaterialId] = useState(null);

    const [customerSearch, setCustomerSearch] = useState('');
    const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerPage, setCustomerPage] = useState(1);

    const [materialSearch, setMaterialSearch] = useState('');
    const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialPage, setMaterialPage] = useState(1);

    const filteredCustomers = useMemo(() => {
        return customerList;
    }, [customerList]);

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(customerTotalItems / customerPageSize));
    }, [customerPageSize, customerTotalItems]);

    const displayedCustomers = useMemo(() => {
        return filteredCustomers;
    }, [filteredCustomers]);

    const filteredMaterials = useMemo(() => {
        return materialList;
    }, [materialList]);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(materialTotalItems / materialPageSize));
    }, [materialPageSize, materialTotalItems]);

    const displayedMaterials = useMemo(() => {
        return filteredMaterials;
    }, [filteredMaterials]);

    const marginValue = useMemo(() => {
        const modal = parseNumber(materialForm.hargaModal);
        const penawaran = parseNumber(materialForm.hargaPenawaran);
        if (!modal || !penawaran) {
            return '';
        }

        const margin = ((penawaran - modal) / modal) * 100;
        return Number.isFinite(margin) ? margin.toFixed(2) : '';
    }, [materialForm.hargaModal, materialForm.hargaPenawaran]);

    const isMaterialFormValid = useMemo(() => {
        const nama = String(materialForm.nama ?? '').trim();
        const satuan = String(materialForm.satuan ?? '').trim();
        const qtyStr = String(materialForm.quantity ?? '').trim();
        const modalStr = String(materialForm.hargaModal ?? '').trim();
        const penawaranStr = String(materialForm.hargaPenawaran ?? '').trim();

        return (
            nama !== '' &&
            satuan !== '' &&
            qtyStr !== '' &&
            parseNumber(qtyStr) > 0 &&
            modalStr !== '' &&
            modalStr !== '...' &&
            penawaranStr !== ''
        );
    }, [
        materialForm.nama,
        materialForm.satuan,
        materialForm.quantity,
        materialForm.hargaModal,
        materialForm.hargaPenawaran,
    ]);

    // Financial calculations summary
    const summaryTotals = useMemo(() => {
        let totalQty = 0;
        let totalPenawaran = 0;
        let totalModal = 0;

        materialItems.forEach((item) => {
            const qty = parseNumber(item.quantity);
            const penawaran = parseNumber(item.hargaPenawaran);
            const modal = parseNumber(item.hargaModal);

            totalQty += qty;
            totalPenawaran += qty * penawaran;
            totalModal += qty * modal;
        });

        const overallMarginPct =
            totalModal > 0
                ? (((totalPenawaran - totalModal) / totalModal) * 100).toFixed(2)
                : '0.00';

        return {
            itemsCount: materialItems.length,
            totalQty,
            totalPenawaran,
            totalModal,
            overallMarginPct,
        };
    }, [materialItems]);

    useEffect(() => {
        resizeTextareaToContent(namaMaterialRef.current);
    }, [activeStep, materialForm.nama]);

    useEffect(() => {
        setCustomerPage(1);
    }, [customerPageSize, customerSearch]);

    useEffect(() => {
        const handler = setTimeout(
            () => setDebouncedCustomerSearch(customerSearch.trim()),
            400,
        );
        return () => clearTimeout(handler);
    }, [customerSearch]);

    useEffect(() => {
        if (customerPage > customerTotalPages) {
            setCustomerPage(customerTotalPages);
        }
    }, [customerPage, customerTotalPages]);

    useEffect(() => {
        setMaterialPage(1);
    }, [materialPageSize, materialSearch]);

    useEffect(() => {
        const handler = setTimeout(
            () => setDebouncedMaterialSearch(materialSearch.trim()),
            400,
        );
        return () => clearTimeout(handler);
    }, [materialSearch]);

    useEffect(() => {
        if (materialPage > materialTotalPages) {
            setMaterialPage(materialTotalPages);
        }
    }, [materialPage, materialTotalPages]);

    useEffect(() => {
        if (!customerModalOpen) return;

        loadCustomers({
            search: debouncedCustomerSearch,
            page: customerPage,
            pageSize: customerPageSize,
        });
    }, [
        customerModalOpen,
        debouncedCustomerSearch,
        customerPage,
        customerPageSize,
    ]);

    useEffect(() => {
        if (!materialModalOpen) return;

        loadMaterials({
            search: debouncedMaterialSearch,
            page: materialPage,
            pageSize: materialPageSize,
        });
    }, [
        materialModalOpen,
        debouncedMaterialSearch,
        materialPage,
        materialPageSize,
    ]);

    const handleSelectCustomer = async (item) => {
        const selectionSeq = ++customerSelectionSeq.current;
        const customerName = renderValue(item.nm_cs);
        setCustomerForm((prev) => ({
            ...prev,
            nama: customerName,
            alamat: renderValue(item.alamat_cs),
            telepon: renderValue(item.telp_cs),
            fax: renderValue(item.fax_cs),
            email: renderValue(item.email_cs ?? item.email ?? ''),
            attend: '',
            kode: renderValue(item.kd_cs),
        }));
        setCustomerModalOpen(false);

        // Ambil Franco dan Attend dari quotation terakhir customer.
        try {
            const response = await fetch(
                `/marketing/quotation/suggest-franco?customer=${encodeURIComponent(
                    customerName,
                )}`,
            );
            if (response.ok) {
                const data = await response.json();
                if (selectionSeq !== customerSelectionSeq.current) return;
                setCustomerForm((prev) => ({
                    ...prev,
                    attend: data.attend ?? '',
                }));
                setDetailForm((prev) => ({
                    ...prev,
                    franco: data.franco,
                }));
            }
        } catch (error) {
            if (selectionSeq !== customerSelectionSeq.current) return;
            console.error('Gagal mengambil data quotation terakhir:', error);
            setDetailForm((prev) => ({
                ...prev,
                franco: prev.franco || 'SAMARINDA',
            }));
        }
    };

    const focusHargaPenawaran = () => {
        window.setTimeout(() => {
            hargaPenawaranRef.current?.focus();
            hargaPenawaranRef.current?.select();
        }, 80);
    };

    const handleSelectMaterial = async (item) => {
        const materialName = renderValue(item.material);

        setMaterialForm((prev) => ({
            ...prev,
            nama: materialName,
            satuan: renderValue(item.unit),
            hargaModal: '...',
        }));
        setMaterialFormErrors((prev) => ({
            ...prev,
            nama: '',
            satuan: '',
        }));
        setMaterialModalOpen(false);
        focusHargaPenawaran();

        try {
            const response = await fetch(
                `/marketing/quotation/get-last-price?material=${encodeURIComponent(
                    materialName,
                )}`,
            );

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            setMaterialForm((prev) => ({
                ...prev,
                hargaModal: data.harga > 0 ? String(data.harga) : '',
            }));
            if (data.harga > 0) {
                setMaterialFormErrors((prev) => ({
                    ...prev,
                    hargaModal: '',
                }));
            }
        } catch (error) {
            console.error('Gagal mengambil harga terakhir:', error);
            setMaterialForm((prev) => ({
                ...prev,
                hargaModal: prev.hargaModal === '...' ? '' : prev.hargaModal,
            }));
        }
    };

    const loadCustomers = async ({
        search = '',
        page = 1,
        pageSize = 5,
    } = {}) => {
        const requestSeq = customerRequestSeq.current + 1;
        customerRequestSeq.current = requestSeq;
        setCustomerLoading(true);
        setCustomerError('');
        try {
            const params = new URLSearchParams({
                search,
                page: String(page),
                pageSize: pageSize === Infinity ? 'all' : String(pageSize),
            });
            const response = await fetch(
                `/marketing/quotation/customers?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            if (requestSeq !== customerRequestSeq.current) return;
            setCustomerList(
                Array.isArray(data?.customers) ? data.customers : [],
            );
            setCustomerTotalItems(Number(data?.total ?? 0));
        } catch (error) {
            if (requestSeq !== customerRequestSeq.current) return;
            setCustomerError('Gagal memuat data customer.');
            setCustomerList([]);
            setCustomerTotalItems(0);
        } finally {
            if (requestSeq === customerRequestSeq.current) {
                setCustomerLoading(false);
            }
        }
    };

    const loadMaterials = async ({
        search = '',
        page = 1,
        pageSize = 5,
    } = {}) => {
        const requestSeq = materialRequestSeq.current + 1;
        materialRequestSeq.current = requestSeq;
        setMaterialLoading(true);
        setMaterialError('');
        try {
            const params = new URLSearchParams({
                search,
                page: String(page),
                pageSize: pageSize === Infinity ? 'all' : String(pageSize),
            });
            const response = await fetch(
                `/marketing/quotation/materials?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            if (!response.ok) {
                throw new Error('Request failed');
            }
            const data = await response.json();
            if (requestSeq !== materialRequestSeq.current) return;
            setMaterialList(
                Array.isArray(data?.materials) ? data.materials : [],
            );
            setMaterialTotalItems(Number(data?.total ?? 0));
        } catch (error) {
            if (requestSeq !== materialRequestSeq.current) return;
            setMaterialError('Gagal memuat data material.');
            setMaterialList([]);
            setMaterialTotalItems(0);
        } finally {
            if (requestSeq === materialRequestSeq.current) {
                setMaterialLoading(false);
            }
        }
    };

    const validateMaterialForm = () => {
        const nextErrors = {};

        if (!String(materialForm.nama ?? '').trim()) {
            nextErrors.nama = 'Nama material wajib diisi.';
        }

        if (!String(materialForm.satuan ?? '').trim()) {
            nextErrors.satuan = 'Satuan wajib diisi.';
        }

        const qtyStr = String(materialForm.quantity ?? '').trim();
        if (!qtyStr) {
            nextErrors.quantity = 'Quantity wajib diisi.';
        } else if (parseNumber(qtyStr) <= 0) {
            nextErrors.quantity = 'Quantity tidak boleh 0.';
        }

        const modalStr = String(materialForm.hargaModal ?? '').trim();
        if (!modalStr || modalStr === '...') {
            nextErrors.hargaModal = 'Harga modal wajib diisi.';
        }

        if (!String(materialForm.hargaPenawaran ?? '').trim()) {
            nextErrors.hargaPenawaran = 'Harga penawaran wajib diisi.';
        }

        setMaterialFormErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            if (nextErrors.nama) {
                namaMaterialRef.current?.focus();
            } else if (nextErrors.satuan) {
                document.getElementById('satuan')?.focus();
            } else if (nextErrors.quantity) {
                document.getElementById('quantity')?.focus();
            } else if (nextErrors.hargaModal) {
                document.getElementById('harga_modal')?.focus();
            } else if (nextErrors.hargaPenawaran) {
                hargaPenawaranRef.current?.focus();
            }
            return false;
        }

        return true;
    };

    const handleAddMaterial = async () => {
        if (!validateMaterialForm()) {
            return;
        }

        if (parseNumber(marginValue) < 0) {
            const result = await Swal.fire({
                title: 'Margin Minus',
                text: 'Margin material ini minus. Tetap lanjut tambah material?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Ya, lanjut',
                cancelButtonText: 'Batal',
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        const newItem = {
            id: `${Date.now()}-${Math.random()}`,
            nama: materialForm.nama,
            satuan: materialForm.satuan,
            quantity: materialForm.quantity,
            hargaModal: materialForm.hargaModal,
            hargaPenawaran: materialForm.hargaPenawaran,
            margin: marginValue,
            remark: materialForm.remark,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialFormErrors({});
        setMaterialForm({
            nama: '',
            satuan: '',
            quantity: '1',
            hargaModal: '',
            hargaPenawaran: '',
            remark: '',
        });
    };

    const handleRemoveMaterial = (id) => {
        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
        if (editingMaterialId === id) {
            handleCancelEditMaterial();
        }
    };

    const handleEditMaterial = (item) => {
        setEditingMaterialId(item.id);
        setActiveStep(2);
        setMaterialFormErrors({});
        setMaterialForm({
            nama: item.nama ?? '',
            satuan: item.satuan ?? '',
            quantity: item.quantity ?? '',
            hargaModal: item.hargaModal ?? '',
            hargaPenawaran: item.hargaPenawaran ?? '',
            remark: item.remark ?? '',
        });
        window.requestAnimationFrame(() => {
            namaMaterialRef.current?.focus();
        });
    };

    const handleCancelEditMaterial = () => {
        setEditingMaterialId(null);
        setMaterialFormErrors({});
        setMaterialForm({
            nama: '',
            satuan: '',
            quantity: '1',
            hargaModal: '',
            hargaPenawaran: '',
            remark: '',
        });
    };

    const handleSaveMaterial = async () => {
        const targetItem = materialItems.find(
            (item) => item.id === editingMaterialId,
        );
        if (!targetItem) {
            return;
        }

        if (!validateMaterialForm()) {
            return;
        }

        const nextMaterial = {
            ...targetItem,
            nama: materialForm.nama,
            satuan: materialForm.satuan,
            quantity: materialForm.quantity,
            hargaModal: materialForm.hargaModal,
            hargaPenawaran: materialForm.hargaPenawaran,
            margin: marginValue,
            remark: materialForm.remark,
        };

        if (parseNumber(nextMaterial.margin) < 0) {
            const result = await Swal.fire({
                title: 'Margin Minus',
                text: 'Margin material ini minus. Tetap lanjut simpan material?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Ya, lanjut',
                cancelButtonText: 'Batal',
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        setMaterialItems((prev) =>
            prev.map((item) =>
                item.id === editingMaterialId ? nextMaterial : item,
            ),
        );
        handleCancelEditMaterial();
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        const payload = {
            db: customerForm.db,
            tgl_penawaran: customerForm.tglPenawaran || todayDate(),
            customer: fillOrSpace(customerForm.nama),
            alamat: fillOrSpace(customerForm.alamat),
            telp: fillOrSpace(customerForm.telepon),
            fax: fillOrSpace(customerForm.fax),
            email: fillOrSpace(customerForm.email),
            attend: fillOrSpace(customerForm.attend),
            payment: fillOrSpace(detailForm.payment),
            validity: fillOrSpace(detailForm.validity),
            delivery: fillOrSpace(detailForm.delivery),
            franco: fillOrSpace(detailForm.franco),
            note1: fillOrSpace(detailForm.note1),
            note2: fillOrSpace(detailForm.note2),
            note3: fillOrSpace(detailForm.note3),
            materials: materialItems.map((item) => ({
                material: item.nama,
                quantity: item.quantity,
                harga_modal: item.hargaModal,
                harga_penawaran: item.hargaPenawaran,
                satuan: item.satuan,
                margin: item.margin,
                remark: item.remark,
            })),
        };

        fetch('/marketing/quotation', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(payload),
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Gagal menyimpan quotation.',
                    );
                }

                window.sessionStorage.setItem(
                    'app:pending-toast',
                    JSON.stringify({
                        message:
                            data?.message || 'Quotation berhasil disimpan.',
                        variant: 'success',
                    }),
                );
                window.location.assign(
                    data?.redirect || '/marketing/quotation',
                );
            })
            .catch((error) => {
                showToast(error?.message || 'Gagal menyimpan quotation.');
                setIsSubmitting(false);
            });
    };

    // Helper step status
    const isStep1Complete = !!customerForm.nama;
    const isStep2Complete =
        !!detailForm.payment && !!detailForm.validity && !!detailForm.delivery;
    const isStep3Complete = materialItems.length > 0;

    return (
        <>
            <Head title="Tambah Quotation Baru" />

            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                {/* ── TOP HERO HEADER ──────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Sparkles className="size-3.5" />
                                Penawaran Baru
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                • {todayDate()}
                            </span>
                        </div>
                        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                            Buat Penawaran Harga
                        </h1>
                        <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                            Susun penawaran resmi untuk pelanggan dengan estimasi
                            harga, margin, dan syarat pembayaran yang akurat.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild size="sm">
                            <Link href="/marketing/quotation">
                                <ArrowLeft className="mr-1.5 size-4" />
                                Kembali ke Daftar
                            </Link>
                        </Button>
                        {materialItems.length > 0 && (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                                {isSubmitting ? (
                                    <Spinner className="mr-1.5 size-4" />
                                ) : (
                                    <Save className="mr-1.5 size-4" />
                                )}
                                {isSubmitting
                                    ? 'Menyimpan...'
                                    : 'Simpan Quotation'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── STEPPER PROGRESS BAR ─────────────────────────────────────────── */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card/60 backdrop-blur-sm p-3 sm:p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {steps.map((step, index) => {
                            const IconComponent = step.icon;
                            const isActive = index === activeStep;
                            const isCompleted =
                                (index === 0 && isStep1Complete) ||
                                (index === 1 && isStep2Complete) ||
                                (index === 2 && isStep3Complete);

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setActiveStep(index)}
                                    className={`group flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
                                        isActive
                                            ? 'bg-primary/10 border border-primary/30 shadow-sm'
                                            : 'hover:bg-muted/50 border border-transparent'
                                    }`}
                                >
                                    <div
                                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-105 ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                                                : isCompleted
                                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                  : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {isCompleted && !isActive ? (
                                            <Check className="size-5" />
                                        ) : (
                                            <IconComponent className="size-5" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Langkah 0{index + 1}
                                            </span>
                                            {isCompleted && (
                                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                            )}
                                        </div>
                                        <div
                                            className={`text-sm font-bold truncate ${
                                                isActive
                                                    ? 'text-primary'
                                                    : 'text-foreground'
                                            }`}
                                        >
                                            {step.label}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                                            {step.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── FORM CONTAINER ───────────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    {/* ══ STEP 1: DATA CUSTOMER ════════════════════════════════════════ */}
                    {activeStep === 0 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            {/* Card A: Informasi Utama Customer */}
                            <Card className="border-sidebar-border/70 shadow-sm lg:col-span-7">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                <Building2 className="size-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-bold">
                                                    Identitas Pelanggan
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    Pilih customer dari
                                                    database atau ketik nama
                                                    baru
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {customerForm.kode && (
                                            <Badge
                                                variant="outline"
                                                className="font-mono text-xs"
                                            >
                                                Kode: {customerForm.kode}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="space-y-1.5 sm:col-span-1">
                                            <Label
                                                htmlFor="tgl_penawaran"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Tanggal Penawaran
                                            </Label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                                <Input
                                                    id="tgl_penawaran"
                                                    type="date"
                                                    className="pl-9 text-sm font-medium"
                                                    value={
                                                        customerForm.tglPenawaran ||
                                                        todayDate()
                                                    }
                                                    onChange={(e) =>
                                                        setCustomerForm(
                                                            (prev) => ({
                                                                ...prev,
                                                                tglPenawaran:
                                                                    e.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 sm:col-span-1">
                                            <Label
                                                htmlFor="attend"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Ditujukan Kepada (Attend / UP)
                                            </Label>
                                            <QuotationAttendInput
                                                id="attend"
                                                customer={customerForm.nama}
                                                value={customerForm.attend}
                                                onValueChange={(attend) => {
                                                    customerSelectionSeq.current += 1;
                                                    setCustomerForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            attend,
                                                        }),
                                                    );
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label
                                                htmlFor="nama_customer"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Nama Customer{' '}
                                                <span className="text-destructive">
                                                    *
                                                </span>
                                            </Label>
                                            <span className="text-[11px] text-muted-foreground">
                                                Ketik manual atau klik cari
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Building2 className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                                <Input
                                                    id="nama_customer"
                                                    className="pl-9 font-medium"
                                                    value={customerForm.nama}
                                                    onChange={(e) =>
                                                        setCustomerForm(
                                                            (prev) => ({
                                                                ...prev,
                                                                nama: e.target
                                                                    .value,
                                                            }),
                                                        )
                                                    }
                                                    placeholder="Contoh: PT Semesta Mandiri..."
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="shrink-0 border"
                                                onClick={() => {
                                                    setCustomerModalOpen(true);
                                                    loadCustomers();
                                                }}
                                            >
                                                <Search className="mr-1.5 size-4" />
                                                Cari Customer
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="alamat"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Alamat Lengkap Kantor / Pabrik
                                        </Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 size-4 text-muted-foreground" />
                                            <textarea
                                                id="alamat"
                                                rows={3}
                                                className="w-full resize-y rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                value={customerForm.alamat}
                                                onChange={(e) =>
                                                    setCustomerForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            alamat: e.target
                                                                .value,
                                                        }),
                                                    )
                                                }
                                                placeholder="Jl. Pangeran Antasari No..."
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Card B: Kontak & Komunikasi */}
                            <Card className="border-sidebar-border/70 shadow-sm lg:col-span-5">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            <Phone className="size-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold">
                                                Kontak & Saluran
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Nomor telepon, fax, dan email
                                                tujuan invoice
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="telepon"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Nomor Telepon
                                        </Label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="telepon"
                                                className="pl-9 font-mono text-sm"
                                                value={customerForm.telepon}
                                                onChange={(e) =>
                                                    setCustomerForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            telepon:
                                                                e.target.value,
                                                        }),
                                                    )
                                                }
                                                placeholder="(0541) 123456 / 0812..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="fax"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Nomor Fax
                                        </Label>
                                        <div className="relative">
                                            <Printer className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="fax"
                                                className="pl-9 font-mono text-sm"
                                                value={customerForm.fax}
                                                onChange={(e) =>
                                                    setCustomerForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            fax: e.target.value,
                                                        }),
                                                    )
                                                }
                                                placeholder="(0541) 654321"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="email"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Alamat Email
                                        </Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                className="pl-9 text-sm"
                                                value={customerForm.email}
                                                onChange={(e) =>
                                                    setCustomerForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            email: e.target
                                                                .value,
                                                        }),
                                                    )
                                                }
                                                placeholder="purchasing@customer.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
                                        <p className="font-semibold text-blue-600 dark:text-blue-400">
                                            💡 Info Otomatis
                                        </p>
                                        <p className="mt-0.5">
                                            Saat Anda memilih customer dari
                                            database, sistem akan otomatis
                                            menyarankan nilai Franco &amp;
                                            Attend dari riwayat quotation
                                            terakhir.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* ══ STEP 2: DETAIL KETENTUAN ══════════════════════════════════════ */}
                    {activeStep === 1 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            {/* Card A: Syarat Komersial */}
                            <Card className="border-sidebar-border/70 shadow-sm lg:col-span-6">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                            <CreditCard className="size-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold">
                                                Syarat & Ketentuan Transaksi
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Jangka waktu pembayaran, masa
                                                berlaku, dan lokasi franco
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="payment"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Ketentuan Pembayaran (Payment Terms)
                                        </Label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                                            <select
                                                id="payment"
                                                className="w-full rounded-md border border-input bg-background pl-9 pr-8 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                value={detailForm.payment}
                                                onChange={(e) =>
                                                    setDetailForm((prev) => ({
                                                        ...prev,
                                                        payment:
                                                            e.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="">
                                                    -- Pilih Pembayaran --
                                                </option>
                                                <option value="Cash">
                                                    Cash (Tunai)
                                                </option>
                                                <option value="7 Hari">
                                                    7 Hari
                                                </option>
                                                <option value="15 Hari">
                                                    15 Hari
                                                </option>
                                                <option value="30 Hari">
                                                    30 Hari (Default)
                                                </option>
                                                <option value="45 Hari">
                                                    45 Hari
                                                </option>
                                                <option value="60 Hari">
                                                    60 Hari
                                                </option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="validity"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Masa Berlaku Penawaran (Validity)
                                        </Label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="validity"
                                                className="pl-9 text-sm"
                                                value={detailForm.validity}
                                                onChange={(e) =>
                                                    setDetailForm((prev) => ({
                                                        ...prev,
                                                        validity:
                                                            e.target.value,
                                                    }))
                                                }
                                                placeholder="Contoh: 7 Hari / 14 Hari"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="delivery"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Waktu Pengiriman (Delivery Time)
                                        </Label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="delivery"
                                                className="pl-9 text-sm"
                                                value={detailForm.delivery}
                                                onChange={(e) =>
                                                    setDetailForm((prev) => ({
                                                        ...prev,
                                                        delivery:
                                                            e.target.value,
                                                    }))
                                                }
                                                placeholder="Contoh: 3 Hari Kerja setelah PO kami terima/Menyesuaikan"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="franco"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Franco (Lokasi Penyerahan)
                                        </Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                            <Input
                                                id="franco"
                                                className="pl-9 text-sm"
                                                value={detailForm.franco}
                                                onFocus={(e) =>
                                                    e.target.select()
                                                }
                                                onChange={(e) =>
                                                    setDetailForm((prev) => ({
                                                        ...prev,
                                                        franco: e.target.value,
                                                    }))
                                                }
                                                placeholder="Contoh: SAMARINDA / BALIKPAPAN"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Card B: Catatan Tambahan (Notes) */}
                            <Card className="border-sidebar-border/70 shadow-sm lg:col-span-6">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                            <FileText className="size-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold">
                                                Catatan Tambahan (Notes)
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Syarat khusus, klausul garansi,
                                                atau instruksi tambahan
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="note1"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Catatan 1 (Note 1)
                                        </Label>
                                        <Input
                                            id="note1"
                                            value={detailForm.note1}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note1: e.target.value,
                                                }))
                                            }
                                            placeholder="Harga belum termasuk PPN 11%..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="note2"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Catatan 2 (Note 2)
                                        </Label>
                                        <Input
                                            id="note2"
                                            value={detailForm.note2}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note2: e.target.value,
                                                }))
                                            }
                                            placeholder="Barang yang sudah dibeli tidak dapat ditukar..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="note3"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Catatan 3 (Note 3)
                                        </Label>
                                        <Input
                                            id="note3"
                                            value={detailForm.note3}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note3: e.target.value,
                                                }))
                                            }
                                            placeholder="Pembayaran transfer ke rekening..."
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* ══ STEP 3: DATA MATERIAL & REKAPITULASI ══════════════════════════ */}
                    {activeStep === 2 && (
                        <div className="flex flex-col gap-6">
                            {/* Summary Metrics Bar */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-xl border border-sidebar-border/70 bg-card/60 p-3.5 shadow-sm">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Total Item
                                    </span>
                                    <div className="mt-1 flex items-baseline gap-1.5">
                                        <span className="text-xl sm:text-2xl font-black text-foreground">
                                            {summaryTotals.itemsCount}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Barang
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-sidebar-border/70 bg-card/60 p-3.5 shadow-sm">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Total Qty
                                    </span>
                                    <div className="mt-1 flex items-baseline gap-1.5">
                                        <span className="text-xl sm:text-2xl font-black text-foreground">
                                            {formatInteger(
                                                summaryTotals.totalQty,
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Unit/Pcs
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-sidebar-border/70 bg-card/60 p-3.5 shadow-sm">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Total Penawaran
                                    </span>
                                    <div className="mt-1">
                                        <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                                            Rp{' '}
                                            {summaryTotals.totalPenawaran.toLocaleString(
                                                'id-ID',
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-sidebar-border/70 bg-card/60 p-3.5 shadow-sm">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Rata-rata Margin
                                    </span>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        {Number(
                                            summaryTotals.overallMarginPct,
                                        ) >= 0 ? (
                                            <TrendingUp className="size-4 text-emerald-500" />
                                        ) : (
                                            <TrendingDown className="size-4 text-destructive" />
                                        )}
                                        <span
                                            className={`text-lg sm:text-xl font-black ${
                                                Number(
                                                    summaryTotals.overallMarginPct,
                                                ) >= 0
                                                    ? 'text-foreground'
                                                    : 'text-destructive'
                                            }`}
                                        >
                                            {summaryTotals.overallMarginPct}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Form Input / Edit Material */}
                            <Card
                                className={`border-sidebar-border/70 shadow-sm transition-colors ${
                                    editingMaterialId
                                        ? 'border-blue-500/40 ring-1 ring-blue-500/20 bg-blue-50/10 dark:bg-blue-950/10'
                                        : ''
                                }`}
                            >
                                <CardHeader className="pb-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`flex size-8 items-center justify-center rounded-lg ${
                                                    editingMaterialId
                                                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                                        : 'bg-primary/10 text-primary'
                                                }`}
                                            >
                                                {editingMaterialId ? (
                                                    <Pencil className="size-4" />
                                                ) : (
                                                    <Plus className="size-4" />
                                                )}
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-bold">
                                                    {editingMaterialId
                                                        ? 'Edit Rincian Material'
                                                        : 'Tambah Material ke Penawaran'}
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    Isi spesifikasi, harga
                                                    modal, harga penawaran, dan
                                                    catatan remark
                                                </CardDescription>
                                            </div>
                                        </div>

                                        {marginValue !== '' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                    Live Margin:
                                                </span>
                                                <Badge
                                                    variant={
                                                        Number(marginValue) < 0
                                                            ? 'destructive'
                                                            : Number(
                                                                    marginValue,
                                                                ) >= 20
                                                              ? 'default'
                                                              : 'secondary'
                                                    }
                                                    className="font-mono text-xs font-bold"
                                                >
                                                    {marginValue}%
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Baris 1: Nama Material & Cari */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="nama_material"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Nama & Spesifikasi Material{' '}
                                            <span className="text-destructive">
                                                *
                                            </span>
                                        </Label>
                                        <div className="flex flex-row gap-2">
                                            <textarea
                                                id="nama_material"
                                                ref={namaMaterialRef}
                                                rows={1}
                                                className={`min-h-10 min-w-0 flex-1 resize-none overflow-hidden rounded-md border bg-background px-3 py-2 text-sm [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                                    materialFormErrors.nama
                                                        ? 'border-destructive focus-visible:ring-destructive/20'
                                                        : 'border-input'
                                                }`}
                                                placeholder="Contoh: UNP 100 x 50 x 5 mm x 6M..."
                                                value={materialForm.nama}
                                                onChange={(e) => {
                                                    resizeTextareaToContent(
                                                        e.currentTarget,
                                                    );
                                                    const value =
                                                        e.target.value;
                                                    setMaterialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            nama: value,
                                                        }),
                                                    );
                                                    if (value.trim()) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                nama: '',
                                                            }),
                                                        );
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="shrink-0 border"
                                                onClick={() => {
                                                    setMaterialModalOpen(true);
                                                    loadMaterials();
                                                }}
                                            >
                                                <Search className="mr-1.5 size-4" />
                                                Cari Katalog
                                            </Button>
                                        </div>
                                        <InputError
                                            message={materialFormErrors.nama}
                                        />
                                    </div>

                                    {/* Baris 2: Satuan, Quantity, Modal, Penawaran, Margin */}
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                        <div className="space-y-1.5 col-span-1">
                                            <Label
                                                htmlFor="satuan"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Satuan{' '}
                                                <span className="text-destructive">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                id="satuan"
                                                placeholder="Pcs/Btg/Kg"
                                                className={
                                                    materialFormErrors.satuan
                                                        ? 'border-destructive'
                                                        : ''
                                                }
                                                value={materialForm.satuan}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    setMaterialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            satuan: value,
                                                        }),
                                                    );
                                                    if (value.trim()) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                satuan: '',
                                                            }),
                                                        );
                                                    }
                                                }}
                                            />
                                            <InputError
                                                message={
                                                    materialFormErrors.satuan
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5 col-span-1">
                                            <Label
                                                htmlFor="quantity"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Quantity{' '}
                                                <span className="text-destructive">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                id="quantity"
                                                type="number"
                                                min="1"
                                                className={
                                                    materialFormErrors.quantity
                                                        ? 'border-destructive'
                                                        : ''
                                                }
                                                value={materialForm.quantity}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    setMaterialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            quantity: value,
                                                        }),
                                                    );
                                                    if (
                                                        value.trim() &&
                                                        parseNumber(value) > 0
                                                    ) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                quantity: '',
                                                            }),
                                                        );
                                                    } else if (
                                                        value.trim() &&
                                                        parseNumber(value) <= 0
                                                    ) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                quantity:
                                                                    'Quantity tidak boleh 0.',
                                                            }),
                                                        );
                                                    }
                                                }}
                                            />
                                            <InputError
                                                message={
                                                    materialFormErrors.quantity
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                            <Label
                                                htmlFor="harga_modal"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Harga Modal{' '}
                                                <span className="text-destructive">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                id="harga_modal"
                                                type="text"
                                                placeholder="Rp 0"
                                                className={`font-mono text-sm ${
                                                    materialFormErrors.hargaModal
                                                        ? 'border-destructive'
                                                        : ''
                                                }`}
                                                value={formatRupiahInput(
                                                    materialForm.hargaModal,
                                                )}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value.replace(
                                                            /\D/g,
                                                            '',
                                                        );
                                                    setMaterialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            hargaModal: value,
                                                        }),
                                                    );
                                                    if (value) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                hargaModal: '',
                                                            }),
                                                        );
                                                    }
                                                }}
                                            />
                                            <InputError
                                                message={
                                                    materialFormErrors.hargaModal
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                            <Label
                                                htmlFor="harga_penawaran"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Harga Penawaran{' '}
                                                <span className="text-destructive">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                id="harga_penawaran"
                                                ref={hargaPenawaranRef}
                                                type="text"
                                                placeholder="Rp 0"
                                                className={`font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400 ${
                                                    materialFormErrors.hargaPenawaran
                                                        ? 'border-destructive'
                                                        : ''
                                                }`}
                                                value={formatRupiahInput(
                                                    materialForm.hargaPenawaran,
                                                )}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value.replace(
                                                            /\D/g,
                                                            '',
                                                        );
                                                    setMaterialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            hargaPenawaran:
                                                                value,
                                                        }),
                                                    );
                                                    if (value) {
                                                        setMaterialFormErrors(
                                                            (prev) => ({
                                                                ...prev,
                                                                hargaPenawaran:
                                                                    '',
                                                            }),
                                                        );
                                                    }
                                                }}
                                            />
                                            <InputError
                                                message={
                                                    materialFormErrors.hargaPenawaran
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                            <Label
                                                htmlFor="margin"
                                                className="text-xs font-semibold text-muted-foreground"
                                            >
                                                Margin Estimasi
                                            </Label>
                                            <Input
                                                id="margin"
                                                className={`font-mono text-sm font-bold bg-muted/50 ${
                                                    Number(marginValue) < 0
                                                        ? 'text-destructive border-destructive/40'
                                                        : 'text-foreground'
                                                }`}
                                                value={
                                                    marginValue
                                                        ? `${marginValue}%`
                                                        : '-'
                                                }
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    {/* Baris 3: Remark */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="remark"
                                            className="text-xs font-semibold text-muted-foreground"
                                        >
                                            Catatan / Remark Tambahan (Opsional)
                                        </Label>
                                        <RichTextEditor
                                            id="remark"
                                            value={materialForm.remark}
                                            onChange={(remark) =>
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    remark,
                                                }))
                                            }
                                        />
                                    </div>

                                    {/* Action Buttons Form Material */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sidebar-border/50">
                                        <div className="text-xs text-muted-foreground">
                                            {isMaterialFormValid ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <CheckCircle2 className="size-3.5" />
                                                    Data material siap
                                                    ditambahkan
                                                </span>
                                            ) : (
                                                <span>
                                                    Lengkapi nama, satuan, qty,
                                                    modal, & penawaran
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingMaterialId && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={
                                                        handleCancelEditMaterial
                                                    }
                                                >
                                                    Batal Edit
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                disabled={!isMaterialFormValid}
                                                onClick={
                                                    editingMaterialId
                                                        ? handleSaveMaterial
                                                        : handleAddMaterial
                                                }
                                                className={
                                                    editingMaterialId
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        : 'bg-primary text-primary-foreground'
                                                }
                                            >
                                                {editingMaterialId ? (
                                                    <>
                                                        <Save className="mr-1.5 size-4" />
                                                        Simpan Perubahan
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="mr-1.5 size-4" />
                                                        Tambah ke Daftar
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Modern Table List Material */}
                            <Card className="border-sidebar-border/70 shadow-sm overflow-hidden">
                                <CardHeader className="border-b border-sidebar-border/50 bg-muted/20 py-3.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Boxes className="size-4 text-muted-foreground" />
                                            <CardTitle className="text-sm font-bold">
                                                Daftar Item Penawaran (
                                                {materialItems.length})
                                            </CardTitle>
                                        </div>
                                        {materialItems.length > 0 && (
                                            <span className="text-xs font-mono font-medium text-muted-foreground">
                                                Subtotal:{' '}
                                                <strong className="text-foreground">
                                                    Rp{' '}
                                                    {summaryTotals.totalPenawaran.toLocaleString(
                                                        'id-ID',
                                                    )}
                                                </strong>
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[860px] text-sm text-left border-collapse">
                                        <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                                            <tr>
                                                <th className="px-4 py-3 w-12 text-center">
                                                    #
                                                </th>
                                                <th className="px-4 py-3">
                                                    Nama & Spesifikasi Material
                                                </th>
                                                <th className="px-4 py-3 text-center">
                                                    Qty
                                                </th>
                                                <th className="px-4 py-3 text-center">
                                                    Satuan
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Harga Modal
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Harga Penawaran
                                                </th>
                                                <th className="px-4 py-3 text-center">
                                                    Margin
                                                </th>
                                                <th className="px-4 py-3">
                                                    Remark
                                                </th>
                                                <th className="px-4 py-3 w-24 text-center">
                                                    Aksi
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sidebar-border/70">
                                            {materialItems.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={9}
                                                        className="py-12 text-center"
                                                    >
                                                        <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                                                            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                                                                <PackageSearch className="size-6" />
                                                            </div>
                                                            <h3 className="mt-3 text-sm font-bold text-foreground">
                                                                Belum Ada
                                                                Material
                                                            </h3>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Gunakan form di
                                                                atas untuk
                                                                memasukkan item
                                                                material yang
                                                                akan ditawarkan
                                                                ke customer.
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                materialItems.map(
                                                    (item, index) => {
                                                        const isEditing =
                                                            editingMaterialId ===
                                                            item.id;
                                                        const marginNum =
                                                            parseNumber(
                                                                item.margin,
                                                            );

                                                        return (
                                                            <tr
                                                                key={item.id}
                                                                className={`transition-colors hover:bg-muted/40 ${
                                                                    isEditing
                                                                        ? 'bg-blue-500/10'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <td className="px-4 py-3.5 text-center font-mono text-xs text-muted-foreground">
                                                                    {index + 1}
                                                                </td>
                                                                <td className="px-4 py-3.5 font-medium text-foreground max-w-xs break-words">
                                                                    {item.nama}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-center font-semibold text-foreground">
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3.5 text-center text-xs text-muted-foreground">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="font-normal"
                                                                    >
                                                                        {item.satuan ||
                                                                            '-'}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                                                                    {formatRupiahInput(
                                                                        item.hargaModal,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono text-sm font-bold text-foreground">
                                                                    {formatRupiahInput(
                                                                        item.hargaPenawaran,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-center">
                                                                    <Badge
                                                                        variant={
                                                                            marginNum <
                                                                            0
                                                                                ? 'destructive'
                                                                                : marginNum >=
                                                                                    20
                                                                                  ? 'default'
                                                                                  : 'secondary'
                                                                        }
                                                                        className="font-mono text-xs font-semibold"
                                                                    >
                                                                        {formatPercent(
                                                                            item.margin,
                                                                        )}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                                                                    {item.remark ||
                                                                        '-'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-center">
                                                                    {isEditing ? (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 text-xs text-blue-600"
                                                                            onClick={
                                                                                handleCancelEditMaterial
                                                                            }
                                                                        >
                                                                            Batal
                                                                        </Button>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="size-7 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                                                                                title="Edit Material"
                                                                                onClick={() =>
                                                                                    handleEditMaterial(
                                                                                        item,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Pencil className="size-3.5" />
                                                                                <span className="sr-only">
                                                                                    Edit
                                                                                </span>
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                                title="Hapus Material"
                                                                                onClick={() =>
                                                                                    handleRemoveMaterial(
                                                                                        item.id,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Trash2 className="size-3.5" />
                                                                                <span className="sr-only">
                                                                                    Hapus
                                                                                </span>
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    },
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ── BOTTOM STICKY NAVIGATION FOOTER ──────────────────────────────── */}
                    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sidebar-border/70 bg-card/90 p-4 shadow-lg backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setActiveStep((prev) =>
                                        Math.max(0, prev - 1),
                                    )
                                }
                                disabled={activeStep === 0}
                                className="h-9 px-3"
                            >
                                <ArrowLeft className="mr-1.5 size-4" />
                                Sebelumnya
                            </Button>

                            {activeStep < steps.length - 1 && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                        setActiveStep((prev) =>
                                            Math.min(
                                                steps.length - 1,
                                                prev + 1,
                                            ),
                                        )
                                    }
                                    className="h-9 px-3 border"
                                >
                                    Langkah Berikutnya
                                    <ArrowRight className="ml-1.5 size-4" />
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild size="sm">
                                <Link href="/marketing/quotation">Batal</Link>
                            </Button>

                            {activeStep === steps.length - 1 && (
                                <Button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        materialItems.length === 0
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                                >
                                    {isSubmitting ? (
                                        <Spinner className="mr-1.5 size-4" />
                                    ) : (
                                        <Save className="mr-1.5 size-4" />
                                    )}
                                    {isSubmitting
                                        ? 'Menyimpan Quotation...'
                                        : 'Simpan Quotation'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* ══ MODAL CARI CUSTOMER (MODERN DESIGN) ════════════════════════════════ */}
            <Dialog
                open={customerModalOpen}
                onOpenChange={(open) => {
                    setCustomerModalOpen(open);
                    if (open) {
                        setCustomerSearch('');
                        setDebouncedCustomerSearch('');
                        setCustomerPageSize(5);
                        setCustomerPage(1);
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-sidebar-border/70">
                    <DialogHeader className="p-4 sm:p-5 border-b border-sidebar-border/70 bg-card">
                        <div className="flex items-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Building2 className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">
                                    Pilih Customer dari Database
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Cari berdasarkan nama perusahaan, kode CS,
                                    atau attend PIC.
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    className="pl-9 text-sm"
                                    placeholder="Ketik nama atau kode customer..."
                                    value={customerSearch}
                                    onChange={(e) =>
                                        setCustomerSearch(e.target.value)
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Tampilkan:</span>
                                <select
                                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
                                    value={
                                        customerPageSize === Infinity
                                            ? 'all'
                                            : customerPageSize
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setCustomerPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                    }}
                                >
                                    <option value={5}>5 Baris</option>
                                    <option value={10}>10 Baris</option>
                                    <option value={25}>25 Baris</option>
                                    <option value={50}>50 Baris</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">
                                            No
                                        </th>
                                        <th className="px-4 py-3 w-32">
                                            Kode CS
                                        </th>
                                        <th className="px-4 py-3">
                                            Nama Customer
                                        </th>
                                        <th className="px-4 py-3">
                                            Attend (PIC)
                                        </th>
                                        <th className="px-4 py-3 w-20 text-center">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {displayedCustomers.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="py-10 text-center text-xs text-muted-foreground"
                                            >
                                                {customerLoading
                                                    ? 'Memuat data customer...'
                                                    : customerError ||
                                                      'Data customer tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedCustomers.map(
                                            (item, index) => (
                                                <tr
                                                    key={`${item.kd_cs}-${index}`}
                                                    className="transition-colors hover:bg-muted/40 cursor-pointer"
                                                    onDoubleClick={() =>
                                                        handleSelectCustomer(
                                                            item,
                                                        )
                                                    }
                                                >
                                                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                                                        {(customerPageSize ===
                                                        Infinity
                                                            ? index
                                                            : (customerPage -
                                                                  1) *
                                                                  customerPageSize +
                                                              index) + 1}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                                                        {item.kd_cs}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-foreground">
                                                        {item.nm_cs}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                                        {item.attnd || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7 text-xs border"
                                                            onClick={() =>
                                                                handleSelectCustomer(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            Pilih
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {customerPageSize !== Infinity &&
                        customerTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border/70 bg-card p-3 sm:p-4 text-xs text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (customerPage - 1) * customerPageSize +
                                            1,
                                        customerTotalItems,
                                    )}{' '}
                                    -{' '}
                                    {Math.min(
                                        customerPage * customerPageSize,
                                        customerTotalItems,
                                    )}{' '}
                                    dari {customerTotalItems} customer
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                            setCustomerPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={customerPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="font-medium text-foreground">
                                        Halaman {customerPage} dari{' '}
                                        {customerTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                            setCustomerPage((page) =>
                                                Math.min(
                                                    customerTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            customerPage === customerTotalPages
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                </DialogContent>
            </Dialog>

            {/* ══ MODAL CARI MATERIAL (MODERN DESIGN) ════════════════════════════════ */}
            <Dialog
                open={materialModalOpen}
                onOpenChange={(open) => {
                    setMaterialModalOpen(open);
                    if (open) {
                        setMaterialSearch('');
                        setDebouncedMaterialSearch('');
                        setMaterialPageSize(5);
                        setMaterialPage(1);
                    }
                }}
            >
                <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-sidebar-border/70">
                    <DialogHeader className="p-4 sm:p-5 border-b border-sidebar-border/70 bg-card">
                        <div className="flex items-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                <Boxes className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">
                                    Pilih Material dari Database Stok
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Cek ketersediaan stok fisik gudang (G1-G4)
                                    dan harga beli terakhir.
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    className="pl-9 text-sm"
                                    placeholder="Cari kode atau nama material..."
                                    value={materialSearch}
                                    onChange={(e) =>
                                        setMaterialSearch(e.target.value)
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Tampilkan:</span>
                                <select
                                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
                                    value={
                                        materialPageSize === Infinity
                                            ? 'all'
                                            : materialPageSize
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setMaterialPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                    }}
                                >
                                    <option value={5}>5 Baris</option>
                                    <option value={10}>10 Baris</option>
                                    <option value={25}>25 Baris</option>
                                    <option value={50}>50 Baris</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                    <tr>
                                        <th
                                            className="px-3 py-2.5 w-28"
                                            rowSpan={2}
                                        >
                                            Kode
                                        </th>
                                        <th className="px-3 py-2.5" rowSpan={2}>
                                            Nama Material
                                        </th>
                                        <th
                                            className="px-2 py-1.5 text-center border-b border-sidebar-border/60 bg-muted/60"
                                            colSpan={5}
                                        >
                                            Stok Fisik Gudang
                                        </th>
                                        <th
                                            className="px-3 py-2.5 w-20 text-center"
                                            rowSpan={2}
                                        >
                                            Satuan
                                        </th>
                                        <th
                                            className="px-3 py-2.5 w-20 text-center"
                                            rowSpan={2}
                                        >
                                            Aksi
                                        </th>
                                    </tr>
                                    <tr className="bg-muted/30 text-[10px] text-muted-foreground">
                                        <th className="px-2 py-1 text-right">
                                            G1
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                            G2
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                            G3
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                            G4
                                        </th>
                                        <th className="px-2 py-1 text-right font-bold text-foreground">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {displayedMaterials.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="py-10 text-center text-xs text-muted-foreground"
                                            >
                                                {materialLoading
                                                    ? 'Memuat data material...'
                                                    : materialError ||
                                                      'Data material tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedMaterials.map(
                                            (item, index) => (
                                                <tr
                                                    key={
                                                        item.kd_material ??
                                                        `${item.material}-${index}`
                                                    }
                                                    className="transition-colors hover:bg-muted/40 cursor-pointer"
                                                    onDoubleClick={() =>
                                                        handleSelectMaterial(
                                                            item,
                                                        )
                                                    }
                                                >
                                                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                                                        {item.kd_material ??
                                                            '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-medium text-foreground">
                                                        {item.material ?? '-'}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatInteger(
                                                            item.stok_g1,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatInteger(
                                                            item.stok_g2,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatInteger(
                                                            item.stok_g3,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatInteger(
                                                            item.stok_g4,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                        {formatInteger(
                                                            item.stok,
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal"
                                                        >
                                                            {item.unit ?? '-'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7 text-xs border"
                                                            onClick={() =>
                                                                handleSelectMaterial(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            Pilih
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {materialPageSize !== Infinity &&
                        materialTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border/70 bg-card p-3 sm:p-4 text-xs text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (materialPage - 1) * materialPageSize +
                                            1,
                                        materialTotalItems,
                                    )}{' '}
                                    -{' '}
                                    {Math.min(
                                        materialPage * materialPageSize,
                                        materialTotalItems,
                                    )}{' '}
                                    dari {materialTotalItems} material
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                            setMaterialPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={materialPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="font-medium text-foreground">
                                        Halaman {materialPage} dari{' '}
                                        {materialTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                            setMaterialPage((page) =>
                                                Math.min(
                                                    materialTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            materialPage === materialTotalPages
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                </DialogContent>
            </Dialog>
        </>
    );
}

QuotationCreate.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
