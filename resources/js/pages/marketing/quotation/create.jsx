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
    Save,
    Search,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
    { title: 'Tambah Quotation', href: '/marketing/quotation/create' },
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
    element.style.height = '38px';
    element.style.height = `${Math.max(38, element.scrollHeight)}px`;
};

const getCsrfToken = () =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

const todayDate = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
};

export default function QuotationCreate({ customers = [], materials = [] }) {
    const [activeStep, setActiveStep] = useState(0);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [materialModalOpen, setMaterialModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Native Tailwind Toast Notification
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', title, message, duration }

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => {
            setToast(null);
        }, toast.duration || 5000);
        return () => clearTimeout(timer);
    }, [toast]);
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
    const [customerTotalItems, setCustomerTotalItems] = useState(customers.length);
    const [materialTotalItems, setMaterialTotalItems] = useState(materials.length);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerCountLoading, setCustomerCountLoading] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialCountLoading, setMaterialCountLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [materialError, setMaterialError] = useState('');

    const hargaPenawaranRef = useRef(null);
    const hargaModalRef = useRef(null);
    const namaMaterialRef = useRef(null);
    const customerRequestSeq = useRef(0);
    const customerCountSeq = useRef(0);
    const customerSelectionSeq = useRef(0);
    const materialRequestSeq = useRef(0);
    const materialCountSeq = useRef(0);

    // Form States
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

    // Modal Search States
    const [customerSearch, setCustomerSearch] = useState('');
    const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerPage, setCustomerPage] = useState(1);

    const [materialSearch, setMaterialSearch] = useState('');
    const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialPage, setMaterialPage] = useState(1);

    // Debounce customer search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedCustomerSearch(customerSearch.trim());
        }, 250);
        return () => clearTimeout(handler);
    }, [customerSearch]);

    // Debounce material search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedMaterialSearch(materialSearch.trim());
        }, 250);
        return () => clearTimeout(handler);
    }, [materialSearch]);

    // Reset pagination when search or pageSize changes
    useEffect(() => {
        setCustomerPage(1);
    }, [debouncedCustomerSearch, customerPageSize]);

    useEffect(() => {
        setMaterialPage(1);
    }, [debouncedMaterialSearch, materialPageSize]);

    // Auto resize textarea whenever materialForm.nama or step changes
    useEffect(() => {
        if (namaMaterialRef.current) {
            resizeTextareaToContent(namaMaterialRef.current);
        }
    }, [materialForm.nama, activeStep]);

    // Fetch customer data list (server-side paginated)
    const loadCustomerData = async ({
        search = debouncedCustomerSearch,
        page = customerPage,
        pageSize = customerPageSize,
    } = {}) => {
        const requestId = ++customerRequestSeq.current;
        setCustomerLoading(true);
        setCustomerError('');

        try {
            const params = new URLSearchParams({
                search: (search ?? '').trim(),
                page: String(page),
                pageSize: String(pageSize || 5),
            });
            const response = await fetch(`/marketing/quotation/customers?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Gagal memuat data customer.');
            }
            const data = await response.json();
            if (requestId !== customerRequestSeq.current) return;
            setCustomerList(Array.isArray(data?.customers) ? data.customers : []);
        } catch (error) {
            if (requestId !== customerRequestSeq.current) return;
            setCustomerError(error?.message || 'Gagal memuat customer.');
        } finally {
            if (requestId === customerRequestSeq.current) {
                setCustomerLoading(false);
            }
        }
    };

    // Fetch customer total count & pagination (dipisah di background agar data instan tampil)
    const loadCustomerCount = async (search = debouncedCustomerSearch) => {
        const requestId = ++customerCountSeq.current;
        setCustomerCountLoading(true);

        try {
            const params = new URLSearchParams({
                search: (search ?? '').trim(),
                count_only: '1',
            });
            const response = await fetch(`/marketing/quotation/customers?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return;
            const data = await response.json();
            if (requestId !== customerCountSeq.current) return;
            setCustomerTotalItems(Number(data?.total ?? 0));
        } catch {
            // Background count error ignored
        } finally {
            if (requestId === customerCountSeq.current) {
                setCustomerCountLoading(false);
            }
        }
    };

    // Fetch material data list (server-side paginated)
    const loadMaterialData = async ({
        search = debouncedMaterialSearch,
        page = materialPage,
        pageSize = materialPageSize,
    } = {}) => {
        const requestId = ++materialRequestSeq.current;
        setMaterialLoading(true);
        setMaterialError('');

        try {
            const params = new URLSearchParams({
                search: (search ?? '').trim(),
                page: String(page),
                pageSize: String(pageSize || 5),
            });
            const response = await fetch(`/marketing/quotation/materials?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Gagal memuat data material.');
            }
            const data = await response.json();
            if (requestId !== materialRequestSeq.current) return;
            setMaterialList(Array.isArray(data?.materials) ? data.materials : []);
        } catch (error) {
            if (requestId !== materialRequestSeq.current) return;
            setMaterialError(error?.message || 'Gagal memuat material.');
        } finally {
            if (requestId === materialRequestSeq.current) {
                setMaterialLoading(false);
            }
        }
    };

    // Fetch material total count & pagination (dipisah di background agar data instan tampil)
    const loadMaterialCount = async (search = debouncedMaterialSearch) => {
        const requestId = ++materialCountSeq.current;
        setMaterialCountLoading(true);

        try {
            const params = new URLSearchParams({
                search: (search ?? '').trim(),
                count_only: '1',
            });
            const response = await fetch(`/marketing/quotation/materials?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return;
            const data = await response.json();
            if (requestId !== materialCountSeq.current) return;
            setMaterialTotalItems(Number(data?.total ?? 0));
        } catch {
            // Background count error ignored
        } finally {
            if (requestId === materialCountSeq.current) {
                setMaterialCountLoading(false);
            }
        }
    };

    // Customer Modal: load data when page/pageSize/search changes
    useEffect(() => {
        if (!customerModalOpen) return;
        loadCustomerData({
            search: debouncedCustomerSearch,
            page: customerPage,
            pageSize: customerPageSize,
        });
    }, [customerModalOpen, debouncedCustomerSearch, customerPage, customerPageSize]);

    // Customer Modal: load count ONLY when search changes or modal opens
    useEffect(() => {
        if (!customerModalOpen) return;
        loadCustomerCount(debouncedCustomerSearch);
    }, [customerModalOpen, debouncedCustomerSearch]);

    // Material Modal: load data when page/pageSize/search changes
    useEffect(() => {
        if (!materialModalOpen) return;
        loadMaterialData({
            search: debouncedMaterialSearch,
            page: materialPage,
            pageSize: materialPageSize,
        });
    }, [materialModalOpen, debouncedMaterialSearch, materialPage, materialPageSize]);

    // Material Modal: load count ONLY when search changes or modal opens
    useEffect(() => {
        if (!materialModalOpen) return;
        loadMaterialCount(debouncedMaterialSearch);
    }, [materialModalOpen, debouncedMaterialSearch]);

    const customerTotalPages = useMemo(() => {
        return Math.max(1, Math.ceil((customerTotalItems || 0) / (customerPageSize || 5)));
    }, [customerTotalItems, customerPageSize]);

    const displayedCustomers = customerList;

    const materialTotalPages = useMemo(() => {
        return Math.max(1, Math.ceil((materialTotalItems || 0) / (materialPageSize || 5)));
    }, [materialTotalItems, materialPageSize]);

    const displayedMaterials = materialList;

    // Select Customer
    const handleSelectCustomer = async (item) => {
        const customerName = item.nm_cs ?? '';
        const selectionId = ++customerSelectionSeq.current;

        setCustomerForm((prev) => ({
            ...prev,
            nama: customerName,
            alamat: item.almt ?? item.alamat_cs ?? '',
            telepon: item.tlp ?? item.telp_cs ?? '',
            fax: item.fax ?? item.fax_cs ?? '',
            email: item.email ?? '',
            attend: item.attnd ?? item.attend ?? '',
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
                    setDetailForm((prev) => ({
                        ...prev,
                        franco: data.franco,
                    }));
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
        const materialName = (item.material ?? '').trim();
        setMaterialForm((prev) => ({
            ...prev,
            nama: materialName,
            satuan: item.unit ?? prev.satuan,
            hargaModal: '',
        }));
        setMaterialModalOpen(false);

        window.requestAnimationFrame(() => {
            if (namaMaterialRef.current) {
                resizeTextareaToContent(namaMaterialRef.current);
            }
        });

        let hasModalPrice = false;
        try {
            const response = await fetch(
                `/marketing/quotation/get-last-price?material=${encodeURIComponent(materialName)}`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json().catch(() => ({}));
            if (response.ok && data) {
                // Harga dari tb_invin adalah HARGA MODAL (harga beli PO terakhir)
                const lastPrice = data.harga ?? data.harga_modal ?? 0;
                if (Number(lastPrice) > 0) {
                    hasModalPrice = true;
                    setMaterialForm((prev) => ({
                        ...prev,
                        hargaModal: String(lastPrice),
                    }));
                }
            }
        } catch {
            // Ignore background error
        } finally {
            // Jika ada harga modal, fokuskan ke harga penawaran.
            // Jika harga modal kosong atau tidak ada, fokuskan ke field harga modal.
            setTimeout(() => {
                if (hasModalPrice) {
                    hargaPenawaranRef.current?.focus();
                    hargaPenawaranRef.current?.select();
                } else {
                    hargaModalRef.current?.focus();
                    hargaModalRef.current?.select();
                }
            }, 80);
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

    const handleRemoveMaterial = (id) => {
        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
        if (editingMaterialId === id) {
            handleCancelEditMaterial();
        }
    };

    // Submit handler
    const handleSubmit = (event) => {
        event?.preventDefault?.();
        if (isSubmitting) return;

        setErrorMessage('');

        if (!customerForm.nama) {
            setActiveStep(0);
            const msg = 'Nama Customer wajib diisi sebelum menyimpan.';
            setErrorMessage(msg);
            setToast({
                type: 'error',
                title: 'Validasi Form',
                message: msg,
                duration: 4500,
            });
            return;
        }

        if (materialItems.length === 0) {
            setActiveStep(2);
            const msg = 'Tambahkan minimal 1 item material sebelum menyimpan.';
            setErrorMessage(msg);
            setToast({
                type: 'error',
                title: 'Validasi Form',
                message: msg,
                duration: 4500,
            });
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
                    let errMsg = data?.message || '';
                    if (data?.errors) {
                        const detailErrors = Object.entries(data.errors)
                            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                            .join('\n');
                        errMsg = errMsg ? `${errMsg}\n\n${detailErrors}` : detailErrors;
                    }
                    throw new Error(errMsg || `Error ${response.status}: Gagal menyimpan quotation.`);
                }
                setIsSubmitting(false);
                window.sessionStorage.setItem(
                    'quotation_flash_success',
                    JSON.stringify({
                        title: 'Quotation Berhasil Disimpan!',
                        message:
                            data?.message ||
                            'Data penawaran quotation baru telah berhasil disimpan ke database.',
                        noPenawaran: data?.no_penawaran || '',
                    }),
                );
                window.location.assign(data?.redirect || '/marketing/quotation');
            })
            .catch((error) => {
                setIsSubmitting(false);
                const fullError =
                    error?.message ||
                    'Terjadi kesalahan sistem yang tidak diketahui saat menyimpan quotation.';
                setErrorMessage(fullError);
                setToast({
                    type: 'error',
                    title: 'Gagal Menyimpan Quotation',
                    message: fullError,
                    duration: 7000,
                });
            });
    };

    const handleResetForm = () => {
        setCustomerForm({
            tglPenawaran: todayDate(),
            nama: '',
            alamat: '',
            telepon: '',
            fax: '',
            email: '',
            attend: '',
            kode: '',
        });
        setDetailForm({
            payment: '30 Hari',
            validity: '7 Hari',
            delivery: '3 Hari Kerja setelah PO kami terima/Menyesuaikan',
            franco: '',
            note1: '',
            note2: '',
            note3: '',
        });
        setMaterialItems([]);
        handleCancelEditMaterial();
        setActiveStep(0);
        setSuccessModal({ isOpen: false, title: '', message: '', noPenawaran: '' });
    };

    return (
        <>
            <Head title="Tambah Quotation Baru" />

            <div className="w-full flex-1 flex flex-col gap-5 p-4 sm:p-6">
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
                            <h1 className="text-xl font-bold tracking-tight text-foreground">
                                Buat Quotation Baru
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Input penawaran harga untuk customer • {todayDate()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {materialItems.length > 0 && (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
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
                                        Simpan Quotation
                                    </>
                                )}
                            </Button>
                        )}
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
                                onClick={(e) => {
                                    e.preventDefault();
                                    setActiveStep(index);
                                }}
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
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                            e.preventDefault();
                        }
                    }}
                    className="flex flex-col gap-5"
                >
                    {/* ══ STEP 1: DATA CUSTOMER ════════════════════════ */}
                    {activeStep === 0 && (
                        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                            <div className="border-b border-border pb-3">
                                <h2 className="text-base font-bold text-foreground">
                                    Informasi Customer & Tanggal Penawaran
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Pilih customer dari database atau masukkan data secara manual.
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
                                            placeholder="Contoh: PT. Sumber Makmur Abadi"
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
                                        placeholder="purchasing@company.com"
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
                                        placeholder="Jl. Pangeran Antasari No. 12, Samarinda"
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

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
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

                                <div className="space-y-1.5 md:col-span-2">
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

                                <div className="space-y-1.5 md:col-span-5">
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

                                <div className="space-y-1.5 md:col-span-3">
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
                                            className={`min-h-[38px] flex-1 resize-none overflow-hidden rounded-lg border bg-background px-3 py-2 text-sm font-medium leading-normal focus:outline-none focus:ring-1 focus:ring-primary ${
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
                                            className="h-[38px] px-3.5 rounded-lg text-xs font-semibold shrink-0"
                                            onClick={() => {
                                                setMaterialModalOpen(true);
                                                loadMaterials({ page: 1 });
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
                                            ref={hargaModalRef}
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
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                                            <tr>
                                                <th className="px-3.5 py-3 w-12 text-center">No</th>
                                                <th className="px-3.5 py-3 min-w-[220px]">Nama & Spesifikasi Material</th>
                                                <th className="px-3.5 py-3 w-28 text-center">Qty</th>
                                                <th className="px-3.5 py-3 w-32 text-right">Harga Modal</th>
                                                <th className="px-3.5 py-3 w-36 text-right">Harga Penawaran</th>
                                                <th className="px-3.5 py-3 w-24 text-center">Margin</th>
                                                <th className="px-3.5 py-3 min-w-[200px]">Remark / Catatan</th>
                                                <th className="px-3.5 py-3 w-20 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {materialItems.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={8}
                                                        className="py-10 text-center text-sm text-muted-foreground"
                                                    >
                                                        Belum ada material yang ditambahkan. Gunakan formulir di atas untuk menambahkan item.
                                                    </td>
                                                </tr>
                                            ) : (
                                                materialItems.map((item, index) => {
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
                                                            <td className="px-3.5 py-3 text-center text-sm font-medium text-muted-foreground">
                                                                {index + 1}
                                                            </td>
                                                            <td className="px-3.5 py-3 text-sm font-semibold text-foreground">
                                                                {item.nama}
                                                            </td>
                                                            <td className="px-3.5 py-3 text-center text-sm font-semibold whitespace-nowrap">
                                                                {formatInteger(item.quantity)}{' '}
                                                                <span className="font-normal text-muted-foreground text-xs">
                                                                    {item.satuan}
                                                                </span>
                                                            </td>
                                                            <td className="px-3.5 py-3 text-right text-sm font-medium text-muted-foreground whitespace-nowrap">
                                                                {formatRupiahInput(item.hargaModal)}
                                                            </td>
                                                            <td className="px-3.5 py-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                {formatRupiahInput(item.hargaPenawaran)}
                                                            </td>
                                                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                        marginNum < 0
                                                                            ? 'bg-destructive/15 text-destructive'
                                                                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                                    }`}
                                                                >
                                                                    {item.margin}%
                                                                </span>
                                                            </td>
                                                            <td className="px-3.5 py-3 text-sm text-muted-foreground">
                                                                {item.remark ? (
                                                                    <div
                                                                        className="max-w-md break-words"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: item.remark,
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className="text-muted-foreground/40">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3.5 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditMaterial(item)}
                                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveMaterial(item.id)}
                                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted"
                                                                        title="Hapus"
                                                                    >
                                                                        <Trash2 className="size-4" />
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
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setActiveStep((prev) => Math.max(0, prev - 1));
                                    }}
                                >
                                    <ArrowLeft className="mr-1.5 size-3.5" />
                                    Sebelumnya
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {activeStep < steps.length - 1 ? (
                                <Button
                                    key="btn-next-step"
                                    type="button"
                                    size="sm"
                                    className="h-9 px-4 text-xs font-semibold"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveStep((prev) =>
                                            Math.min(steps.length - 1, prev + 1),
                                        );
                                    }}
                                >
                                    Lanjut ke Step {activeStep + 2}
                                    <ArrowRight className="ml-1.5 size-3.5" />
                                </Button>
                            ) : (
                                <Button
                                    key="btn-save-quotation"
                                    type="button"
                                    size="sm"
                                    onClick={handleSubmit}
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
                                            Simpan Quotation
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
                    <div className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[92vw] 2xl:max-w-[1560px] max-h-[92vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-card">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Building2 className="size-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                                        Pilih Customer dari Database
                                    </h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        Cari berdasarkan kode atau nama customer.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCustomerModalOpen(false)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-3 sm:p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
                            <div className="relative flex-1 min-w-[240px]">
                                <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Ketik nama atau kode customer..."
                                    className="h-10 pl-10 text-sm rounded-lg"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
                                <span>Tampilkan:</span>
                                <select
                                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs sm:text-sm font-semibold"
                                    value={customerPageSize}
                                    onChange={(e) => {
                                        setCustomerPageSize(Number(e.target.value));
                                        setCustomerPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100 data</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 w-16 text-center">No</th>
                                        <th className="px-4 py-3 w-36">Kode CS</th>
                                        <th className="px-4 py-3">Nama Customer</th>
                                        <th className="px-4 py-3 w-28 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {customerLoading ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Spinner className="size-4 animate-spin text-primary" />
                                                    <span>Memuat data customer...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : displayedCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                                {customerError || 'Data customer tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedCustomers.map((item, index) => (
                                            <tr
                                                key={`${item.kd_cs}-${index}`}
                                                className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                onDoubleClick={() => handleSelectCustomer(item)}
                                            >
                                                <td className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                                                    {(customerPage - 1) * customerPageSize + index + 1}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-primary">
                                                    {item.kd_cs}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-foreground">
                                                    {item.nm_cs}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-8 px-3.5 text-xs sm:text-sm font-semibold rounded-lg"
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

                        {(customerTotalItems !== null || customerCountLoading || displayedCustomers.length > 0) && (
                            <div className="p-3.5 border-t border-border flex items-center justify-between text-xs sm:text-sm text-muted-foreground bg-muted/20">
                                <span>
                                    Halaman {customerPage}
                                    {customerCountLoading ? (
                                        <span className="ml-1 text-muted-foreground/70 italic inline-flex items-center gap-1.5">
                                            <Spinner className="size-3 animate-spin text-primary inline" />
                                            (Menghitung total pagination...)
                                        </span>
                                    ) : customerTotalPages > 0 ? (
                                        <>
                                            {' '}dari {customerTotalPages} ({customerTotalItems} total customer)
                                        </>
                                    ) : null}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs sm:text-sm"
                                        disabled={customerPage <= 1 || customerLoading}
                                        onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs sm:text-sm"
                                        disabled={
                                            customerLoading ||
                                            (customerCountLoading
                                                ? displayedCustomers.length < customerPageSize
                                                : customerPage >= customerTotalPages || displayedCustomers.length === 0)
                                        }
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
                    <div className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[92vw] 2xl:max-w-[1560px] max-h-[92vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-card">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                    <Boxes className="size-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                                        Pilih Material dari Database Gudang
                                    </h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        Cari kode atau spesifikasi material.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMaterialModalOpen(false)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-3 sm:p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
                            <div className="relative flex-1 min-w-[240px]">
                                <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Cari kode atau nama material..."
                                    className="h-10 pl-10 text-sm rounded-lg"
                                    value={materialSearch}
                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
                                <span>Tampilkan:</span>
                                <select
                                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs sm:text-sm font-semibold"
                                    value={materialPageSize}
                                    onChange={(e) => {
                                        setMaterialPageSize(Number(e.target.value));
                                        setMaterialPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100 data</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 w-40">Kode Material</th>
                                        <th className="px-4 py-3">Nama Material</th>
                                        <th className="px-4 py-3 w-28 text-center">Satuan</th>
                                        <th className="px-4 py-3 w-28 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {materialLoading ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Spinner className="size-4 animate-spin text-primary" />
                                                    <span>Memuat data material...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : displayedMaterials.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                                {materialError || 'Data material tidak ditemukan.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedMaterials.map((item, index) => (
                                            <tr
                                                key={item.kd_material ?? `${item.material}-${index}`}
                                                className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                onDoubleClick={() => handleSelectMaterial(item)}
                                            >
                                                <td className="px-4 py-3 text-sm font-semibold text-primary">
                                                    {item.kd_material ?? '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-foreground">
                                                    {item.material ?? '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                                                    {item.unit ?? '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-8 px-3.5 text-xs sm:text-sm font-semibold rounded-lg"
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

                        {(materialTotalItems !== null || materialCountLoading || displayedMaterials.length > 0) && (
                            <div className="p-3.5 border-t border-border flex items-center justify-between text-xs sm:text-sm text-muted-foreground bg-muted/20">
                                <span>
                                    Halaman {materialPage}
                                    {materialCountLoading ? (
                                        <span className="ml-1 text-muted-foreground/70 italic inline-flex items-center gap-1.5">
                                            <Spinner className="size-3 animate-spin text-primary inline" />
                                            (Menghitung total pagination...)
                                        </span>
                                    ) : materialTotalPages > 0 ? (
                                        <>
                                            {' '}dari {materialTotalPages} ({materialTotalItems} total material)
                                        </>
                                    ) : null}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs sm:text-sm"
                                        disabled={materialPage <= 1 || materialLoading}
                                        onClick={() => setMaterialPage((p) => Math.max(1, p - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs sm:text-sm"
                                        disabled={
                                            materialLoading ||
                                            (materialCountLoading
                                                ? displayedMaterials.length < materialPageSize
                                                : materialPage >= materialTotalPages || displayedMaterials.length === 0)
                                        }
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

            {/* ══ TOAST NOTIFIKASI KANAN ATAS DENGAN DURASI (TAILWIND CSS SEPERTI SWEETALERT) ════════ */}
            {toast && (
                <div className="fixed top-5 right-5 z-[9999] w-full max-w-sm sm:max-w-md animate-in slide-in-from-top-3 fade-in duration-300 pointer-events-auto">
                    <style>{`@keyframes toastProgress { from { width: 100%; } to { width: 0%; } }`}</style>
                    <div
                        className={`relative overflow-hidden rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-md ${
                            toast.type === 'error'
                                ? 'border-destructive/30 shadow-destructive/10'
                                : 'border-emerald-500/30 shadow-emerald-500/10'
                        }`}
                    >
                        <div className="flex items-start gap-3.5 pr-7">
                            <div
                                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                                    toast.type === 'error'
                                        ? 'bg-destructive/15 text-destructive'
                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                                {toast.type === 'error' ? (
                                    <AlertCircle className="size-5 stroke-[2.2]" />
                                ) : (
                                    <CheckCircle2 className="size-5 stroke-[2.2]" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <h4
                                    className={`text-sm font-bold leading-tight ${
                                        toast.type === 'error'
                                            ? 'text-destructive'
                                            : 'text-foreground'
                                    }`}
                                >
                                    {toast.title}
                                </h4>
                                <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto break-words leading-relaxed">
                                    {toast.message}
                                </div>
                                {toast.noPenawaran && (
                                    <div className="inline-block mt-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                        No. Dokumen: {toast.noPenawaran}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            className="absolute top-3 right-3 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Tutup"
                        >
                            <X className="size-4" />
                        </button>

                        <div className="absolute bottom-0 left-0 h-1 w-full bg-muted/40 overflow-hidden">
                            <div
                                className={`h-full ${
                                    toast.type === 'error' ? 'bg-destructive' : 'bg-emerald-500'
                                }`}
                                style={{
                                    animation: `toastProgress ${toast.duration || 5000}ms linear forwards`,
                                }}
                            />
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

QuotationCreate.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
