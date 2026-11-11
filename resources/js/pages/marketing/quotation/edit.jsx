import InputError from '@/components/input-error';
import QuotationAttendInput from '@/components/quotation-attend-input';
import RichTextEditor from '@/components/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
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
    FileText,
    Mail,
    MapPin,
    Package,
    Pencil,
    Phone,
    Plus,
    Printer,
    Save,
    Search,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const buildBreadcrumbs = (noPenawaran) => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
    {
        title: noPenawaran || 'Edit Quotation',
        href: window.location.pathname,
    },
];

const steps = [
    { id: 'customer', label: '1. Data Customer', icon: Building2 },
    { id: 'detail', label: '2. Ketentuan & Catatan', icon: FileText },
    { id: 'material', label: '3. Rincian Material', icon: Package },
];

const renderValue = (value) => (value ?? '')?.toString();

const parseNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiahInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return `Rp ${Number(digits).toLocaleString('id-ID')}`;
};

const formatInteger = (value) => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.trunc(number),
    );
};

const fillOrSpace = (value) => {
    const text = String(value ?? '').trim();
    return text === '' ? ' ' : text;
};

const resizeTextareaToContent = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
};

const getCsrfToken = () =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

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
        hargaModal: renderValue(detail.Harga_modal),
        hargaPenawaran: renderValue(detail.Harga),
        margin: renderValue(detail.Margin),
        remark: renderValue(detail.Remark),
    }));

export default function QuotationEdit({
    quotation = null,
    quotationDetails = [],
    customers = [],
    materials = [],
}) {
    const [activeStep, setActiveStep] = useState(0);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [materialModalOpen, setMaterialModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingMaterialId, setDeletingMaterialId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    // Native Tailwind Notification / Confirmation Modals
    const [successModal, setSuccessModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        noPenawaran: quotation?.No_penawaran || '',
    });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Ya, Lanjut',
        cancelText: 'Batal',
        variant: 'warning',
        onConfirm: null,
    });

    const [customerList, setCustomerList] = useState(customers);
    const [materialList, setMaterialList] = useState(materials);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [materialError, setMaterialError] = useState('');

    const hargaPenawaranRef = useRef(null);
    const namaMaterialRef = useRef(null);
    const customerSelectionSeq = useRef(0);
    const customerRequestSeq = useRef(0);
    const materialRequestSeq = useRef(0);

    // Form States
    const [customerForm, setCustomerForm] = useState(() =>
        buildCustomerForm(quotation),
    );
    const [detailForm, setDetailForm] = useState(() =>
        buildDetailForm(quotation),
    );
    const [materialForm, setMaterialForm] = useState({
        nama: '',
        satuan: '',
        quantity: '1',
        hargaModal: '',
        hargaPenawaran: '',
        remark: '',
    });
    const [materialFormErrors, setMaterialFormErrors] = useState({});

    const [materialItems, setMaterialItems] = useState(() =>
        buildMaterialItems(quotationDetails),
    );
    const [editingMaterialId, setEditingMaterialId] = useState(null);

    // Modal Search States
    const [customerSearch, setCustomerSearch] = useState('');
    const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerPage, setCustomerPage] = useState(1);

    const [materialSearch, setMaterialSearch] = useState('');
    const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialPage, setMaterialPage] = useState(1);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedCustomerSearch(customerSearch.trim());
        }, 250);
        return () => clearTimeout(handler);
    }, [customerSearch]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedMaterialSearch(materialSearch.trim());
        }, 250);
        return () => clearTimeout(handler);
    }, [materialSearch]);

    useEffect(() => {
        setCustomerPage(1);
    }, [debouncedCustomerSearch]);

    useEffect(() => {
        setMaterialPage(1);
    }, [debouncedMaterialSearch]);

    // Fetch customer list for modal
    const loadCustomers = () => {
        const requestId = ++customerRequestSeq.current;
        setCustomerLoading(true);
        setCustomerError('');

        fetch('/marketing/quotation/customers', {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (requestId !== customerRequestSeq.current) return null;
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.message || 'Gagal memuat daftar customer.');
                }
                return data;
            })
            .then((data) => {
                if (!data || requestId !== customerRequestSeq.current) return;
                setCustomerList(data?.customers ?? []);
            })
            .catch((error) => {
                if (requestId !== customerRequestSeq.current) return;
                setCustomerError(error?.message || 'Gagal memuat customer.');
            })
            .finally(() => {
                if (requestId === customerRequestSeq.current) {
                    setCustomerLoading(false);
                }
            });
    };

    // Fetch material list for modal
    const loadMaterials = () => {
        const requestId = ++materialRequestSeq.current;
        setMaterialLoading(true);
        setMaterialError('');

        const params = new URLSearchParams({ pageSize: 'all' });
        fetch(`/marketing/quotation/materials?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (requestId !== materialRequestSeq.current) return null;
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.message || 'Gagal memuat data material.');
                }
                return data;
            })
            .then((data) => {
                if (!data || requestId !== materialRequestSeq.current) return;
                setMaterialList(data?.materials ?? []);
            })
            .catch((error) => {
                if (requestId !== materialRequestSeq.current) return;
                setMaterialError(error?.message || 'Gagal memuat material.');
            })
            .finally(() => {
                if (requestId === materialRequestSeq.current) {
                    setMaterialLoading(false);
                }
            });
    };

    // Filtered Customers
    const filteredCustomers = useMemo(() => {
        const query = debouncedCustomerSearch.toLowerCase();
        if (!query) return customerList;
        return customerList.filter((item) => {
            const kd = renderValue(item.kd_cs).toLowerCase();
            const nm = renderValue(item.nm_cs).toLowerCase();
            const att = renderValue(item.attnd).toLowerCase();
            return kd.includes(query) || nm.includes(query) || att.includes(query);
        });
    }, [customerList, debouncedCustomerSearch]);

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity || !customerPageSize) return 1;
        return Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
    }, [filteredCustomers.length, customerPageSize]);

    const displayedCustomers = useMemo(() => {
        if (customerPageSize === Infinity || !customerPageSize) return filteredCustomers;
        const start = (customerPage - 1) * customerPageSize;
        return filteredCustomers.slice(start, start + customerPageSize);
    }, [filteredCustomers, customerPage, customerPageSize]);

    // Filtered Materials
    const filteredMaterials = useMemo(() => {
        const query = debouncedMaterialSearch.toLowerCase();
        if (!query) return materialList;
        return materialList.filter((item) => {
            const kd = renderValue(item.kd_material).toLowerCase();
            const mat = renderValue(item.material).toLowerCase();
            return kd.includes(query) || mat.includes(query);
        });
    }, [materialList, debouncedMaterialSearch]);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity || !materialPageSize) return 1;
        return Math.max(1, Math.ceil(filteredMaterials.length / materialPageSize));
    }, [filteredMaterials.length, materialPageSize]);

    const displayedMaterials = useMemo(() => {
        if (materialPageSize === Infinity || !materialPageSize) return filteredMaterials;
        const start = (materialPage - 1) * materialPageSize;
        return filteredMaterials.slice(start, start + materialPageSize);
    }, [filteredMaterials, materialPage, materialPageSize]);

    // Select Customer
    const handleSelectCustomer = async (item) => {
        const customerName = item.nm_cs ?? '';
        const selectionId = ++customerSelectionSeq.current;

        setCustomerForm((prev) => ({
            ...prev,
            nama: customerName,
            alamat: item.almt ?? '',
            telepon: item.tlp ?? '',
            fax: item.fax ?? '',
            email: item.email ?? '',
            attend: item.attnd ?? '',
            kode: item.kd_cs ?? '',
        }));
        setCustomerModalOpen(false);

        try {
            const response = await fetch(
                `/marketing/quotation/suggest-franco?customer=${encodeURIComponent(customerName)}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json().catch(() => ({}));
            if (selectionId !== customerSelectionSeq.current) return;
            if (response.ok && data) {
                if (data.franco) {
                    setDetailForm((prev) => ({ ...prev, franco: data.franco }));
                }
                if (data.attend) {
                    setCustomerForm((prev) => ({
                        ...prev,
                        attend: prev.attend || data.attend,
                    }));
                }
            }
        } catch {
            // Ignore background error
        }
    };

    // Select Material
    const handleSelectMaterial = async (item) => {
        const materialName = item.material ?? '';
        setMaterialForm((prev) => ({
            ...prev,
            nama: materialName,
            satuan: item.unit ?? prev.satuan,
        }));
        setMaterialModalOpen(false);

        try {
            const response = await fetch(
                `/marketing/quotation/get-last-price?material=${encodeURIComponent(materialName)}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json().catch(() => ({}));
            if (response.ok && data) {
                if (data.harga_modal !== undefined && data.harga_modal !== null) {
                    setMaterialForm((prev) => ({
                        ...prev,
                        hargaModal: String(data.harga_modal),
                    }));
                }
                if (data.harga !== undefined && data.harga !== null) {
                    setMaterialForm((prev) => ({
                        ...prev,
                        hargaPenawaran: String(data.harga),
                    }));
                }
            }
        } catch {
            // Ignore background error
        }
    };

    // Realtime Calculations for Material Form
    const marginValue = useMemo(() => {
        const modal = parseNumber(materialForm.hargaModal);
        const penawaran = parseNumber(materialForm.hargaPenawaran);
        if (!modal || !penawaran) return '';
        const margin = ((penawaran - modal) / modal) * 100;
        return Number.isFinite(margin) ? margin.toFixed(2) : '';
    }, [materialForm.hargaModal, materialForm.hargaPenawaran]);

    const totalModalValue = useMemo(() => {
        const qty = parseNumber(materialForm.quantity);
        const modal = parseNumber(materialForm.hargaModal);
        if (!qty || !modal) return 0;
        return qty * modal;
    }, [materialForm.quantity, materialForm.hargaModal]);

    const totalHargaPenawaranValue = useMemo(() => {
        const qty = parseNumber(materialForm.quantity);
        const penawaran = parseNumber(materialForm.hargaPenawaran);
        if (!qty || !penawaran) return 0;
        return qty * penawaran;
    }, [materialForm.quantity, materialForm.hargaPenawaran]);

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
            penawaranStr !== ''
        );
    }, [materialForm]);

    // Overall Totals
    const { totalModalAll, totalPenawaranAll, grossProfit, averageMargin } =
        useMemo(() => {
            let totalModal = 0;
            let totalPenawaran = 0;

            materialItems.forEach((item) => {
                const qty = parseNumber(item.quantity);
                const penawaran = parseNumber(item.hargaPenawaran);
                const modal = parseNumber(item.hargaModal);
                totalPenawaran += qty * penawaran;
                totalModal += qty * modal;
            });

            const profit = totalPenawaran - totalModal;
            const avgMargin =
                totalModal > 0 ? ((totalPenawaran - totalModal) / totalModal) * 100 : 0;

            return {
                totalModalAll: totalModal,
                totalPenawaranAll: totalPenawaran,
                grossProfit: profit,
                averageMargin: avgMargin,
            };
        }, [materialItems]);

    // Validation
    const validateMaterialForm = () => {
        const nextErrors = {};
        const nama = String(materialForm.nama ?? '').trim();
        const satuan = String(materialForm.satuan ?? '').trim();
        const qtyStr = String(materialForm.quantity ?? '').trim();
        const modalStr = String(materialForm.hargaModal ?? '').trim();
        const penawaranStr = String(materialForm.hargaPenawaran ?? '').trim();

        if (!nama) nextErrors.nama = 'Nama material wajib diisi.';
        if (!satuan) nextErrors.satuan = 'Satuan wajib diisi.';
        if (!qtyStr) {
            nextErrors.quantity = 'Quantity wajib diisi.';
        } else if (parseNumber(qtyStr) <= 0) {
            nextErrors.quantity = 'Quantity tidak boleh 0.';
        }
        if (!modalStr) nextErrors.hargaModal = 'Harga modal wajib diisi.';
        if (!penawaranStr) nextErrors.hargaPenawaran = 'Harga penawaran wajib diisi.';

        setMaterialFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const addMaterialItem = () => {
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

    const handleAddMaterial = () => {
        if (!validateMaterialForm()) return;

        if (parseNumber(marginValue) < 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Peringatan Margin Minus',
                message:
                    'Estimasi margin untuk material ini bernilai minus (< 0%). Apakah Anda yakin ingin tetap menambahkannya ke daftar?',
                confirmText: 'Ya, Tetap Tambah',
                cancelText: 'Batal',
                variant: 'warning',
                onConfirm: () => {
                    addMaterialItem();
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                },
            });
            return;
        }

        addMaterialItem();
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

    const handleSaveMaterial = () => {
        const targetItem = materialItems.find((item) => item.id === editingMaterialId);
        if (!targetItem || !validateMaterialForm()) return;

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

        const updateItem = () => {
            setMaterialItems((prev) =>
                prev.map((item) => (item.id === editingMaterialId ? nextMaterial : item)),
            );
            handleCancelEditMaterial();
        };

        if (parseNumber(nextMaterial.margin) < 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Peringatan Margin Minus',
                message:
                    'Estimasi margin untuk material ini bernilai minus (< 0%). Apakah Anda yakin ingin menyimpan perubahan ini?',
                confirmText: 'Ya, Simpan',
                cancelText: 'Batal',
                variant: 'warning',
                onConfirm: () => {
                    updateItem();
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                },
            });
            return;
        }

        updateItem();
    };

    const handleRemoveMaterial = (id, detailId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Item Material',
            message: 'Apakah Anda yakin ingin menghapus item material ini dari quotation?',
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            variant: 'danger',
            onConfirm: () => {
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));

                const finishRemove = () => {
                    setMaterialItems((prev) => prev.filter((item) => item.id !== id));
                    if (editingMaterialId === id) {
                        handleCancelEditMaterial();
                    }
                };

                if (detailId && quotation?.No_penawaran) {
                    setDeletingMaterialId(id);
                    router.delete(
                        `/marketing/quotation/${encodeURIComponent(quotation.No_penawaran)}/detail/${detailId}`,
                        {
                            preserveScroll: true,
                            preserveState: true,
                            onFinish: () => setDeletingMaterialId(null),
                            onSuccess: finishRemove,
                            onError: () => {
                                setErrorMessage('Gagal menghapus detail material.');
                            },
                        },
                    );
                    return;
                }

                finishRemove();
            },
        });
    };

    // Submit handler
    const handleSubmit = (event) => {
        event?.preventDefault?.();
        if (!quotation?.No_penawaran || isSubmitting) return;

        setErrorMessage('');

        if (!customerForm.nama) {
            setActiveStep(0);
            setErrorMessage('Nama Customer wajib diisi sebelum menyimpan.');
            return;
        }

        if (materialItems.length === 0) {
            setActiveStep(2);
            setErrorMessage('Tambahkan minimal 1 item material sebelum menyimpan.');
            return;
        }

        setIsSubmitting(true);

        const payload = {
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

        fetch(`/marketing/quotation/${encodeURIComponent(quotation.No_penawaran)}`, {
            method: 'PUT',
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
                    throw new Error(data?.message || 'Gagal memperbarui quotation.');
                }
                setIsSubmitting(false);
                setSuccessModal({
                    isOpen: true,
                    title: 'Quotation Berhasil Diperbarui',
                    message:
                        data?.message ||
                        `Perubahan dokumen quotation ${quotation.No_penawaran} berhasil disimpan.`,
                    noPenawaran: quotation.No_penawaran,
                });
            })
            .catch((error) => {
                setIsSubmitting(false);
                setErrorMessage(error?.message || 'Gagal memperbarui quotation.');
            });
    };

    return (
        <>
            <Head title={`Edit Quotation: ${quotation?.No_penawaran ?? ''}`} />

            <div className="w-full flex-1 flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto">
                {/* ── HEADER HALAMAN ─────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/marketing/quotation"
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Kembali ke Daftar Quotation"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-foreground">
                                    Edit Quotation
                                </h1>
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {quotation?.No_penawaran}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Perbarui data penawaran harga customer
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {quotation?.No_penawaran && (
                            <a
                                href={`/marketing/quotation/${encodeURIComponent(quotation.No_penawaran)}/print`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors"
                            >
                                <Printer className="size-3.5" />
                                Cetak PDF
                            </a>
                        )}

                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || materialItems.length === 0}
                            className="h-9 px-4 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner className="mr-2 size-4" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 size-4" />
                                    Simpan Perubahan
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* ── ERROR ALERT BANNER ─────────────────────────────── */}
                {errorMessage && (
                    <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage('')}
                            className="text-xs underline hover:opacity-80"
                        >
                            Tutup
                        </button>
                    </div>
                )}

                {/* ── STEP NAVIGATION TABS (SEDERHANA & CEPAT) ───────── */}
                <div className="grid grid-cols-3 gap-2 border-b border-border pb-1">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = activeStep === index;
                        const isDone =
                            (index === 0 && customerForm.nama) ||
                            (index === 1 && detailForm.payment) ||
                            (index === 2 && materialItems.length > 0);

                        return (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => setActiveStep(index)}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors border ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                        : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <Icon className="size-4 shrink-0" />
                                <span className="hidden sm:inline">{step.label}</span>
                                <span className="sm:hidden">Step {index + 1}</span>
                                {isDone && !isActive && (
                                    <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        <Check className="size-2.5" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── FORM CONTAINER ─────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* ══ STEP 1: DATA CUSTOMER ════════════════════════ */}
                    {activeStep === 0 && (
                        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                            <div className="border-b border-border pb-3">
                                <h2 className="text-base font-bold text-foreground">
                                    Informasi Customer & Tanggal Penawaran
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Perbarui rincian identitas perusahaan atau kontak pemesan.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1.5 lg:col-span-1">
                                    <Label htmlFor="tgl_penawaran" className="text-xs font-semibold">
                                        Tanggal Penawaran <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="tgl_penawaran"
                                        type="date"
                                        className="h-9 rounded-lg"
                                        value={customerForm.tglPenawaran}
                                        onChange={(e) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                tglPenawaran: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                                    <Label htmlFor="nama_customer" className="text-xs font-semibold">
                                        Nama Perusahaan / Customer{' '}
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="nama_customer"
                                            placeholder="Nama customer..."
                                            className="h-9 rounded-lg font-medium"
                                            value={customerForm.nama}
                                            onChange={(e) =>
                                                setCustomerForm((prev) => ({
                                                    ...prev,
                                                    nama: e.target.value,
                                                }))
                                            }
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0"
                                            onClick={() => {
                                                setCustomerModalOpen(true);
                                                loadCustomers();
                                            }}
                                        >
                                            <Search className="mr-1.5 size-3.5" />
                                            Cari Customer
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="attend" className="text-xs font-semibold">
                                        Ditujukan Kepada (Attend / UP)
                                    </Label>
                                    <QuotationAttendInput
                                        id="attend"
                                        customer={customerForm.nama}
                                        value={customerForm.attend}
                                        onValueChange={(attend) => {
                                            customerSelectionSeq.current += 1;
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                attend,
                                            }));
                                        }}
                                    />
                                </div>

                                <div className="space-y-1.5 lg:col-span-1">
                                    <Label htmlFor="telepon" className="text-xs font-semibold">
                                        No. Telepon
                                    </Label>
                                    <Input
                                        id="telepon"
                                        placeholder="08123456789"
                                        className="h-9 rounded-lg"
                                        value={customerForm.telepon}
                                        onChange={(e) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                telepon: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5 lg:col-span-1">
                                    <Label htmlFor="fax" className="text-xs font-semibold">
                                        Fax
                                    </Label>
                                    <Input
                                        id="fax"
                                        placeholder="-"
                                        className="h-9 rounded-lg"
                                        value={customerForm.fax}
                                        onChange={(e) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                fax: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="email" className="text-xs font-semibold">
                                        Email Customer
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="customer@email.com"
                                        className="h-9 rounded-lg"
                                        value={customerForm.email}
                                        onChange={(e) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                email: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                                    <Label htmlFor="alamat" className="text-xs font-semibold">
                                        Alamat Lengkap Perusahaan
                                    </Label>
                                    <textarea
                                        id="alamat"
                                        rows={2}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="Alamat customer..."
                                        value={customerForm.alamat}
                                        onChange={(e) =>
                                            setCustomerForm((prev) => ({
                                                ...prev,
                                                alamat: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 2: DETAIL KETENTUAN ═════════════════════ */}
                    {activeStep === 1 && (
                        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                            <div className="border-b border-border pb-3">
                                <h2 className="text-base font-bold text-foreground">
                                    Syarat Transaksi & Catatan Penawaran
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Tentukan termin pembayaran, pengiriman, dan ketentuan penawaran.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="payment" className="text-xs font-semibold">
                                        Payment Term
                                    </Label>
                                    <Input
                                        id="payment"
                                        placeholder="Contoh: 30 Hari / Cash"
                                        className="h-9 rounded-lg"
                                        value={detailForm.payment}
                                        onChange={(e) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                payment: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="validity" className="text-xs font-semibold">
                                        Masa Berlaku (Validity)
                                    </Label>
                                    <Input
                                        id="validity"
                                        placeholder="Contoh: 7 Hari / 14 Hari"
                                        className="h-9 rounded-lg"
                                        value={detailForm.validity}
                                        onChange={(e) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                validity: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="delivery" className="text-xs font-semibold">
                                        Delivery Time
                                    </Label>
                                    <Input
                                        id="delivery"
                                        placeholder="Contoh: 3 Hari Kerja"
                                        className="h-9 rounded-lg"
                                        value={detailForm.delivery}
                                        onChange={(e) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                delivery: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="franco" className="text-xs font-semibold">
                                        Franco / Tempat Penyerahan
                                    </Label>
                                    <Input
                                        id="franco"
                                        placeholder="Contoh: SAMARINDA"
                                        className="h-9 rounded-lg"
                                        value={detailForm.franco}
                                        onChange={(e) =>
                                            setDetailForm((prev) => ({
                                                ...prev,
                                                franco: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="border-t border-border pt-4 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Catatan Tambahan (Opsional)
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="note1" className="text-xs font-medium text-muted-foreground">
                                            Catatan 1
                                        </Label>
                                        <Input
                                            id="note1"
                                            placeholder="Contoh: Harga belum termasuk PPN 11%"
                                            className="h-9 rounded-lg"
                                            value={detailForm.note1}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note1: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="note2" className="text-xs font-medium text-muted-foreground">
                                            Catatan 2
                                        </Label>
                                        <Input
                                            id="note2"
                                            placeholder="Contoh: Barang indent 2-3 minggu dari order"
                                            className="h-9 rounded-lg"
                                            value={detailForm.note2}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note2: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="note3" className="text-xs font-medium text-muted-foreground">
                                            Catatan 3
                                        </Label>
                                        <Input
                                            id="note3"
                                            placeholder="Catatan pelengkap lainnya..."
                                            className="h-9 rounded-lg"
                                            value={detailForm.note3}
                                            onChange={(e) =>
                                                setDetailForm((prev) => ({
                                                    ...prev,
                                                    note3: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 3: DATA MATERIAL & REKAPITULASI ═════════ */}
                    {activeStep === 2 && (
                        <div className="flex flex-col gap-5">
                            {/* Card Input Material Baru */}
                            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                                    <div>
                                        <h2 className="text-base font-bold text-foreground">
                                            {editingMaterialId
                                                ? 'Edit Rincian Material'
                                                : 'Input Item Material Baru'}
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Masukkan spesifikasi barang, harga modal, dan harga penawaran.
                                        </p>
                                    </div>

                                    {marginValue !== '' && (
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            <span className="text-muted-foreground">Margin Item:</span>
                                            <span
                                                className={`px-2 py-0.5 rounded font-mono font-bold ${
                                                    Number(marginValue) < 0
                                                        ? 'bg-destructive/15 text-destructive'
                                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                }`}
                                            >
                                                {marginValue}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Row 1: Nama Material + Cari */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="nama_material" className="text-xs font-semibold">
                                        Nama & Spesifikasi Material <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <textarea
                                            id="nama_material"
                                            ref={namaMaterialRef}
                                            rows={1}
                                            className={`min-h-9 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary ${
                                                materialFormErrors.nama
                                                    ? 'border-destructive'
                                                    : 'border-input'
                                            }`}
                                            placeholder="Ketik nama spesifikasi barang atau klik Cari Katalog..."
                                            value={materialForm.nama}
                                            onChange={(e) => {
                                                resizeTextareaToContent(e.currentTarget);
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    nama: e.target.value,
                                                }));
                                                if (e.target.value.trim()) {
                                                    setMaterialFormErrors((prev) => ({
                                                        ...prev,
                                                        nama: '',
                                                    }));
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0"
                                            onClick={() => {
                                                setMaterialModalOpen(true);
                                                loadMaterials();
                                            }}
                                        >
                                            <Search className="mr-1.5 size-3.5" />
                                            Cari Katalog Material
                                        </Button>
                                    </div>
                                    <InputError message={materialFormErrors.nama} />
                                </div>

                                {/* Row 2: 7 Kolom Spesifikasi & Harga */}
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="satuan" className="text-xs font-semibold">
                                            Satuan <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="satuan"
                                            placeholder="Pcs/Kg/Btg"
                                            className="h-9 rounded-lg"
                                            value={materialForm.satuan}
                                            onChange={(e) => {
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    satuan: e.target.value,
                                                }));
                                                if (e.target.value.trim()) {
                                                    setMaterialFormErrors((prev) => ({
                                                        ...prev,
                                                        satuan: '',
                                                    }));
                                                }
                                            }}
                                        />
                                        <InputError message={materialFormErrors.satuan} />
                                    </div>

                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="quantity" className="text-xs font-semibold">
                                            Quantity <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="1"
                                            className="h-9 rounded-lg font-semibold"
                                            value={materialForm.quantity}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    quantity: val,
                                                }));
                                                if (val.trim() && parseNumber(val) > 0) {
                                                    setMaterialFormErrors((prev) => ({
                                                        ...prev,
                                                        quantity: '',
                                                    }));
                                                }
                                            }}
                                        />
                                        <InputError message={materialFormErrors.quantity} />
                                    </div>

                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="harga_modal" className="text-xs font-semibold">
                                            Harga Modal <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="harga_modal"
                                            placeholder="Rp 0"
                                            className="h-9 rounded-lg font-mono text-sm"
                                            value={formatRupiahInput(materialForm.hargaModal)}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    hargaModal: val,
                                                }));
                                                if (val) {
                                                    setMaterialFormErrors((prev) => ({
                                                        ...prev,
                                                        hargaModal: '',
                                                    }));
                                                }
                                            }}
                                        />
                                        <InputError message={materialFormErrors.hargaModal} />
                                    </div>

                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="total_modal" className="text-xs font-semibold text-muted-foreground">
                                            Total Modal
                                        </Label>
                                        <Input
                                            id="total_modal"
                                            disabled
                                            readOnly
                                            placeholder="Rp 0"
                                            className="h-9 rounded-lg font-mono text-sm bg-muted/40 cursor-not-allowed"
                                            value={totalModalValue > 0 ? formatRupiahInput(totalModalValue) : ''}
                                        />
                                    </div>

                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="harga_penawaran" className="text-xs font-semibold">
                                            Harga Penawaran <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="harga_penawaran"
                                            ref={hargaPenawaranRef}
                                            placeholder="Rp 0"
                                            className="h-9 rounded-lg font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                                            value={formatRupiahInput(materialForm.hargaPenawaran)}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setMaterialForm((prev) => ({
                                                    ...prev,
                                                    hargaPenawaran: val,
                                                }));
                                                if (val) {
                                                    setMaterialFormErrors((prev) => ({
                                                        ...prev,
                                                        hargaPenawaran: '',
                                                    }));
                                                }
                                            }}
                                        />
                                        <InputError message={materialFormErrors.hargaPenawaran} />
                                    </div>

                                    <div className="space-y-1 col-span-1">
                                        <Label htmlFor="total_harga_penawaran" className="text-xs font-semibold text-muted-foreground">
                                            Total Penawaran
                                        </Label>
                                        <Input
                                            id="total_harga_penawaran"
                                            disabled
                                            readOnly
                                            placeholder="Rp 0"
                                            className="h-9 rounded-lg font-mono text-sm font-semibold bg-muted/40 text-emerald-600 dark:text-emerald-400 cursor-not-allowed"
                                            value={
                                                totalHargaPenawaranValue > 0
                                                    ? formatRupiahInput(totalHargaPenawaranValue)
                                                    : ''
                                            }
                                        />
                                    </div>

                                    <div className="space-y-1 col-span-2 md:col-span-2 xl:col-span-1">
                                        <Label htmlFor="margin" className="text-xs font-semibold text-muted-foreground">
                                            Margin Estimasi
                                        </Label>
                                        <Input
                                            id="margin"
                                            disabled
                                            readOnly
                                            className={`h-9 rounded-lg font-mono text-sm font-bold bg-muted/40 ${
                                                Number(marginValue) < 0
                                                    ? 'text-destructive'
                                                    : 'text-foreground'
                                            }`}
                                            value={marginValue ? `${marginValue}%` : '-'}
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Remark */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="remark" className="text-xs font-semibold text-muted-foreground">
                                        Catatan / Remark Spesifik Item (Opsional)
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

                                {/* Action Button Form */}
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                    {editingMaterialId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-9 rounded-lg text-xs"
                                            onClick={handleCancelEditMaterial}
                                        >
                                            Batal Edit
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        disabled={!isMaterialFormValid}
                                        onClick={
                                            editingMaterialId ? handleSaveMaterial : handleAddMaterial
                                        }
                                        className={`h-9 px-4 rounded-lg text-xs font-semibold ${
                                            editingMaterialId
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-primary text-primary-foreground'
                                        }`}
                                    >
                                        {editingMaterialId ? (
                                            <>
                                                <Save className="mr-1.5 size-3.5" />
                                                Simpan Perubahan Item
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="mr-1.5 size-3.5" />
                                                Tambah ke Tabel Material
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Tabel Daftar Material */}
                            <div className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="p-4 border-b border-border flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">
                                            Daftar Item Penawaran
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Total {materialItems.length} item material tercatat.
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2.5 w-10 text-center">No</th>
                                                <th className="px-3 py-2.5 min-w-[200px]">Nama & Remark</th>
                                                <th className="px-3 py-2.5 w-24 text-right">Qty</th>
                                                <th className="px-3 py-2.5 w-28 text-right">Harga Modal</th>
                                                <th className="px-3 py-2.5 w-28 text-right">Total Modal</th>
                                                <th className="px-3 py-2.5 w-28 text-right">Harga Penawaran</th>
                                                <th className="px-3 py-2.5 w-28 text-right">Total Penawaran</th>
                                                <th className="px-3 py-2.5 w-20 text-center">Margin</th>
                                                <th className="px-3 py-2.5 w-20 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {materialItems.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={9}
                                                        className="py-10 text-center text-xs text-muted-foreground"
                                                    >
                                                        Belum ada material yang ditambahkan. Gunakan formulir di atas untuk menambahkan item.
                                                    </td>
                                                </tr>
                                            ) : (
                                                materialItems.map((item, index) => {
                                                    const qty = parseNumber(item.quantity);
                                                    const modal = parseNumber(item.hargaModal);
                                                    const penawaran = parseNumber(item.hargaPenawaran);
                                                    const subtotalModal = qty * modal;
                                                    const subtotalPenawaran = qty * penawaran;
                                                    const marginNum = parseNumber(item.margin);

                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className={`hover:bg-muted/40 transition-colors ${
                                                                editingMaterialId === item.id
                                                                    ? 'bg-blue-500/10'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">
                                                                {index + 1}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="font-semibold text-foreground">
                                                                    {item.nama}
                                                                </div>
                                                                {item.remark && (
                                                                    <div
                                                                        className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: item.remark,
                                                                        }}
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                                                                {formatInteger(item.quantity)}{' '}
                                                                <span className="font-normal text-muted-foreground">
                                                                    {item.satuan}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                                                                {formatRupiahInput(item.hargaModal)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-medium">
                                                                {formatRupiahInput(subtotalModal)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                                {formatRupiahInput(item.hargaPenawaran)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                                {formatRupiahInput(subtotalPenawaran)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center font-mono font-semibold">
                                                                <span
                                                                    className={`px-1.5 py-0.5 rounded text-[11px] ${
                                                                        marginNum < 0
                                                                            ? 'bg-destructive/15 text-destructive'
                                                                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                                    }`}
                                                                >
                                                                    {item.margin}%
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditMaterial(item)}
                                                                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="size-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={deletingMaterialId === item.id}
                                                                        onClick={() =>
                                                                            handleRemoveMaterial(item.id, item.detailId)
                                                                        }
                                                                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-50"
                                                                        title="Hapus"
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Ringkasan Rekapitulasi */}
                                {materialItems.length > 0 && (
                                    <div className="border-t border-border bg-muted/20 p-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div className="rounded-lg border border-border bg-card p-3">
                                                <span className="text-muted-foreground">Total Modal:</span>
                                                <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                                                    {formatRupiahInput(totalModalAll)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-card p-3">
                                                <span className="text-muted-foreground">Total Penawaran:</span>
                                                <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {formatRupiahInput(totalPenawaranAll)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-card p-3">
                                                <span className="text-muted-foreground">Estimasi Gross Profit:</span>
                                                <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                                                    {formatRupiahInput(grossProfit)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border bg-card p-3">
                                                <span className="text-muted-foreground">Rata-rata Margin:</span>
                                                <div
                                                    className={`text-sm font-mono font-bold mt-0.5 ${
                                                        averageMargin < 0
                                                            ? 'text-destructive'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {averageMargin.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── FOOTER STEPPER NAVIGASI ────────────────────────── */}
                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <div>
                            {activeStep > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-3 text-xs font-semibold"
                                    onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                                >
                                    <ArrowLeft className="mr-1.5 size-3.5" />
                                    Sebelumnya
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {activeStep < steps.length - 1 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 px-4 text-xs font-semibold"
                                    onClick={() =>
                                        setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))
                                    }
                                >
                                    Lanjut ke Step {activeStep + 2}
                                    <ArrowRight className="ml-1.5 size-3.5" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={isSubmitting || materialItems.length === 0}
                                    className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Spinner className="mr-2 size-3.5" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-1.5 size-3.5" />
                                            Simpan Perubahan
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* ══ MODAL CARI CUSTOMER (TAILWIND CSS SEDERHANA) ════════ */}
            {customerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Building2 className="size-5 text-primary" />
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        Pilih Customer dari Database
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cari berdasarkan kode atau nama customer.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCustomerModalOpen(false)}
                                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Ketik nama atau kode customer..."
                                    className="h-9 pl-9 text-xs rounded-lg"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <span>Tampilkan:</span>
                                <select
                                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
                                    value={customerPageSize === Infinity ? 'all' : customerPageSize}
                                    onChange={(e) =>
                                        setCustomerPageSize(
                                            e.target.value === 'all' ? Infinity : Number(e.target.value),
                                        )
                                    }
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 w-12 text-center">No</th>
                                        <th className="px-3 py-2 w-28">Kode CS</th>
                                        <th className="px-3 py-2">Nama Customer</th>
                                        <th className="px-3 py-2 w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {displayedCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                                                {customerLoading
                                                    ? 'Memuat data customer...'
                                                    : customerError || 'Data customer tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedCustomers.map((item, index) => (
                                            <tr
                                                key={`${item.kd_cs}-${index}`}
                                                className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                onDoubleClick={() => handleSelectCustomer(item)}
                                            >
                                                <td className="px-3 py-2 text-center text-muted-foreground font-mono">
                                                    {(customerPage - 1) *
                                                        (customerPageSize === Infinity ? 0 : customerPageSize) +
                                                        index +
                                                        1}
                                                </td>
                                                <td className="px-3 py-2 font-mono font-bold text-primary">
                                                    {item.kd_cs}
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-foreground">
                                                    {item.nm_cs}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-7 px-2.5 text-xs font-semibold rounded-lg"
                                                        onClick={() => handleSelectCustomer(item)}
                                                    >
                                                        Pilih
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {customerPageSize !== Infinity && customerTotalPages > 1 && (
                            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                                <span>
                                    Halaman {customerPage} dari {customerTotalPages}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        disabled={customerPage === 1}
                                        onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        disabled={customerPage === customerTotalPages}
                                        onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ MODAL CARI MATERIAL (TAILWIND CSS SEDERHANA) ════════ */}
            {materialModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Boxes className="size-5 text-teal-600 dark:text-teal-400" />
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        Pilih Material dari Database Gudang
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cari kode atau spesifikasi material.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMaterialModalOpen(false)}
                                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Cari kode atau nama material..."
                                    className="h-9 pl-9 text-xs rounded-lg"
                                    value={materialSearch}
                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <span>Tampilkan:</span>
                                <select
                                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
                                    value={materialPageSize === Infinity ? 'all' : materialPageSize}
                                    onChange={(e) =>
                                        setMaterialPageSize(
                                            e.target.value === 'all' ? Infinity : Number(e.target.value),
                                        )
                                    }
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 w-32">Kode Material</th>
                                        <th className="px-3 py-2">Nama Material</th>
                                        <th className="px-3 py-2 w-20 text-center">Satuan</th>
                                        <th className="px-3 py-2 w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {displayedMaterials.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                                                {materialLoading
                                                    ? 'Memuat data material...'
                                                    : materialError || 'Data material tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedMaterials.map((item, index) => (
                                            <tr
                                                key={item.kd_material ?? `${item.material}-${index}`}
                                                className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                onDoubleClick={() => handleSelectMaterial(item)}
                                            >
                                                <td className="px-3 py-2 font-mono font-bold text-primary">
                                                    {item.kd_material ?? '-'}
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-foreground">
                                                    {item.material ?? '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-muted-foreground">
                                                    {item.unit ?? '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-7 px-2.5 text-xs font-semibold rounded-lg"
                                                        onClick={() => handleSelectMaterial(item)}
                                                    >
                                                        Pilih
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {materialPageSize !== Infinity && materialTotalPages > 1 && (
                            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                                <span>
                                    Halaman {materialPage} dari {materialTotalPages}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        disabled={materialPage === 1}
                                        onClick={() => setMaterialPage((p) => Math.max(1, p - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        disabled={materialPage === materialTotalPages}
                                        onClick={() => setMaterialPage((p) => Math.min(materialTotalPages, p + 1))}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ POPUP NOTIFIKASI SUKSES (TAILWIND CSS BAWAAN) ════════ */}
            {successModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start gap-3.5">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-foreground">
                                    {successModal.title}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {successModal.message}
                                </p>
                                {successModal.noPenawaran && (
                                    <div className="inline-block mt-1 font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                        No. Dokumen: {successModal.noPenawaran}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() =>
                                    setSuccessModal((prev) => ({
                                        ...prev,
                                        isOpen: false,
                                    }))
                                }
                            >
                                Tetap di Halaman Ini
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => router.visit('/marketing/quotation')}
                            >
                                Ke Daftar Quotation
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ POPUP KONFIRMASI (TAILWIND CSS BAWAAN) ═══════════════ */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start gap-3">
                            <div
                                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                                    confirmModal.variant === 'danger'
                                        ? 'bg-destructive/15 text-destructive'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                }`}
                            >
                                <AlertCircle className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-foreground">
                                    {confirmModal.title}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {confirmModal.message}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() =>
                                    setConfirmModal((prev) => ({
                                        ...prev,
                                        isOpen: false,
                                    }))
                                }
                            >
                                {confirmModal.cancelText}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className={`h-8 rounded-lg text-xs font-semibold ${
                                    confirmModal.variant === 'danger'
                                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                        : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                                onClick={() => {
                                    if (confirmModal.onConfirm) {
                                        confirmModal.onConfirm();
                                    }
                                }}
                            >
                                {confirmModal.confirmText}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

QuotationEdit.layout = (page) => (
    <AppLayout
        children={page}
        breadcrumbs={buildBreadcrumbs(page.props?.quotation?.No_penawaran)}
    />
);
