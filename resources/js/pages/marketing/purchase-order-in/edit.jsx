import { MenuAction } from '@/components/menu-action';
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
import {
    AlertCircle,
    CalendarDays,
    Check,
    Landmark,
    PackageSearch,
    Pencil,
    Plus,
    ReceiptText,
    Save,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
    { title: 'Edit PO In', href: '#' },
];

const toNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(toNumber(value))}`;
const formatInteger = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.trunc(toNumber(value)),
    );
const formatStock = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(
        toNumber(value),
    );
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

const toastSuccess = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: message,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
    });
};

const toastError = (message) => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: message,
        showConfirmButton: false,
        timer: 3600,
        timerProgressBar: true,
    });
};

export default function PurchaseOrderInEdit({
    purchaseOrderIn = null,
    purchaseOrderInItems = [],
    defaults = {},
}) {
    const datePickerRef = useRef(null);
    const deliveryDatePickerRef = useRef(null);
    const picInputRef = useRef(null);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState('');

    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
    const [customerList, setCustomerList] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingItem, setIsSavingItem] = useState(false);

    // PIC PO dropdown states
    const [picList, setPicList] = useState([]);
    const [picLoading, setPicLoading] = useState(false);
    const [picSearch, setPicSearch] = useState('');
    const [showPicDropdown, setShowPicDropdown] = useState(false);
    const picDropdownRef = useRef(null);

    const [form, setForm] = useState({
        noPoin: purchaseOrderIn?.no_poin ?? '',
        date: toDisplayDate(purchaseOrderIn?.date_poin ?? defaults.date),
        deliveryDate: toDisplayDate(
            purchaseOrderIn?.delivery_date ?? defaults.date,
        ),
        customerCode: purchaseOrderIn?.kode_customer ?? '',
        customerName: purchaseOrderIn?.customer_name ?? '',
        paymentTerm:
            purchaseOrderIn?.payment_term ?? defaults.payment_term ?? '30 Hari',
        ppnPercent:
            purchaseOrderIn?.ppn_input_percent !== undefined &&
                purchaseOrderIn?.ppn_input_percent !== null
                ? String(purchaseOrderIn.ppn_input_percent)
                : '',
        francoLoco: purchaseOrderIn?.franco_loco ?? '',
        senderName: purchaseOrderIn?.sender_name ?? '',
        note: purchaseOrderIn?.note_doc ?? '',
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
    const [items, setItems] = useState(
        Array.isArray(purchaseOrderInItems)
            ? purchaseOrderInItems.map((item, index) => ({
                id: `db-${item.id ?? index}`,
                dbId: item.id ?? null,
                kodeMaterial: item.kd_material ?? '',
                material: item.material ?? '',
                qty: String(item.qty ?? ''),
                unit: item.satuan ?? '',
                unitPrice: String(toNumber(item.price_po_in ?? 0)),
                totalPricePoIn: String(toNumber(item.total_price_po_in ?? 0)),
                note: item.remark ?? '',
                hasPr: !!(item.has_pr && toNumber(item.has_pr) > 0),
                originalQty: toNumber(item.qty ?? 0),
                sisaQtyPr: toNumber(item.sisa_qtypr ?? 0),
                sisaQtyDo: toNumber(item.sisa_qtydo ?? 0),
            }))
            : [],
    );
    const [editingItemId, setEditingItemId] = useState(null);
    const exhibitsPartialDo = useMemo(() => {
        return items.some((item) => {
            const sQtyDo = toNumber(item.sisaQtyDo ?? 0);
            const qtyVal = toNumber(item.qty ?? 0);
            return sQtyDo !== qtyVal;
        });
    }, [items]);

    const resetItemForm = () => {
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

    const getItemQtyValidationMessage = (item, nextQty) => {
        if (!item) {
            return '';
        }

        const originalQty = toNumber(item.originalQty ?? item.qty ?? 0);
        const sisaQtyDo = toNumber(item.sisaQtyDo ?? 0);
        const deliveredQty = originalQty - sisaQtyDo;
        const isPartialDoItem = sisaQtyDo !== 0 && sisaQtyDo !== originalQty;

        const sisaQtyPr = toNumber(item.sisaQtyPr ?? 0);
        const usedQtyPr = Math.max(0, originalQty - sisaQtyPr);

        if (isPartialDoItem) {
            if (nextQty < deliveredQty) {
                return `Qty tidak boleh kurang dari jumlah yang sudah terkirim (${formatInteger(deliveredQty)}).`;
            }
            if (nextQty < usedQtyPr) {
                return `Qty tidak boleh kurang dari qty yang sudah ada pada PR (${formatInteger(usedQtyPr)}).`;
            }
            return '';
        }

        if (sisaQtyPr === 0 && nextQty <= originalQty) {
            return `Sisa Qty PR sudah 0. Qty harus lebih dari qty awal (${formatInteger(originalQty)}).`;
        }

        if (sisaQtyPr !== 0 && nextQty < usedQtyPr) {
            return `Qty tidak boleh kurang dari qty yang sudah ada pada PR (${formatInteger(usedQtyPr)}).`;
        }

        return '';
    };

    // Load PICs when customerCode changes
    useEffect(() => {
        if (!form.customerCode) {
            setPicList([]);
            return;
        }
        const loadPics = async () => {
            setPicLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('kd_cs', form.customerCode);
                if (picSearch.trim()) params.set('search', picSearch.trim());
                params.set('_ts', String(Date.now()));
                const res = await fetch(
                    `/marketing/purchase-order-in/customer-pics?${params.toString()}`,
                    {
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                    },
                );
                if (res.ok) {
                    const data = await res.json();
                    const pics = Array.isArray(data?.pics) ? data.pics : [];
                    setPicList(pics);

                    // Autofill data terakhir input bila ada, atau fallback ke data PIC pertama
                    const candidatePic = data?.latest_pic || (pics.length > 0 ? pics[0] : '');
                    if (candidatePic && !exhibitsPartialDo) {
                        setForm((prev) => ({
                            ...prev,
                            senderName: candidatePic,
                        }));
                    }

                    // Langsung fokus ke field PIC dan tandai/blok semua teksnya agar user bisa langsung ganti isinya
                    if (!exhibitsPartialDo) {
                        setTimeout(() => {
                            if (picInputRef.current) {
                                picInputRef.current.focus();
                                picInputRef.current.select();
                            }
                        }, 50);
                    }
                }
            } catch {
                setPicList([]);
            } finally {
                setPicLoading(false);
            }
        };
        loadPics();
    }, [form.customerCode, picSearch]);

    // Close PIC dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                picDropdownRef.current &&
                !picDropdownRef.current.contains(e.target)
            ) {
                setShowPicDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddItem = async () => {
        if (!itemForm.material || !itemForm.qty) {
            return;
        }
        if (editingItemId) {
            const editingItem = items.find((item) => item.id === editingItemId);
            if (!editingItem) {
                return;
            }

            const qtyValidationMessage = getItemQtyValidationMessage(
                editingItem,
                toNumber(itemForm.qty),
            );
            if (qtyValidationMessage) {
                toastError(qtyValidationMessage);
                setValidationErrors((prev) => ({
                    ...prev,
                    materials: qtyValidationMessage,
                }));
                return;
            }

            if (editingItem.dbId) {
                setIsSavingItem(true);
                try {
                    const csrf = document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content');
                    const response = await fetch(
                        `/marketing/purchase-order-in/${encodeURIComponent(purchaseOrderIn?.kode_poin ?? '')}/detail/${encodeURIComponent(editingItem.dbId)}`,
                        {
                            method: 'PUT',
                            cache: 'no-store',
                            headers: {
                                'Content-Type': 'application/json',
                                Accept: 'application/json',
                                ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
                            },
                            body: JSON.stringify({
                                kd_material: itemForm.kodeMaterial,
                                material: itemForm.material,
                                qty: toNumber(itemForm.qty),
                                satuan: itemForm.unit,
                                price_po_in: toNumber(itemForm.unitPrice),
                                total_price_po_in:
                                    toNumber(itemForm.qty) *
                                    toNumber(itemForm.unitPrice),
                                remark: itemForm.note,
                            }),
                        },
                    );
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        const firstError = data?.errors
                            ? Object.values(data.errors)[0]?.[0]
                            : null;
                        throw new Error(
                            firstError ||
                            data?.message ||
                            'Gagal menyimpan perubahan material.',
                        );
                    }

                    setItems((prev) =>
                        prev.map((item) =>
                            item.id === editingItemId
                                ? (() => {
                                    const originalQty = toNumber(
                                        item.originalQty ?? item.qty ?? 0,
                                    );
                                    const sisaQtyDoBefore = toNumber(
                                        item.sisaQtyDo ?? 0,
                                    );
                                    const usedQtyPr = Math.max(
                                        0,
                                        originalQty -
                                        toNumber(item.sisaQtyPr ?? 0),
                                    );
                                    const newQty = toNumber(itemForm.qty);

                                    return {
                                        ...item,
                                        ...itemForm,
                                        originalQty: newQty,
                                        sisaQtyDo: Math.max(
                                            0,
                                            sisaQtyDoBefore +
                                            (newQty - originalQty),
                                        ),
                                        sisaQtyPr: Math.max(
                                            0,
                                            newQty - usedQtyPr,
                                        ),
                                    };
                                })()
                                : item,
                        ),
                    );
                    toastSuccess(
                        data?.message ||
                        'Perubahan material berhasil disimpan.',
                    );
                } catch (error) {
                    toastError(
                        error?.message || 'Gagal menyimpan perubahan material.',
                    );
                    setValidationErrors((prev) => ({
                        ...prev,
                        materials:
                            error?.message ||
                            'Gagal menyimpan perubahan material.',
                    }));
                    return;
                } finally {
                    setIsSavingItem(false);
                }
            } else {
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === editingItemId
                            ? (() => {
                                const originalQty = toNumber(
                                    item.originalQty ?? item.qty ?? 0,
                                );
                                const sisaQtyDoBefore = toNumber(
                                    item.sisaQtyDo ?? 0,
                                );
                                const usedQtyPr = Math.max(
                                    0,
                                    originalQty -
                                    toNumber(item.sisaQtyPr ?? 0),
                                );
                                const newQty = toNumber(itemForm.qty);

                                return {
                                    ...item,
                                    ...itemForm,
                                    originalQty: newQty,
                                    sisaQtyDo: Math.max(
                                        0,
                                        sisaQtyDoBefore +
                                        (newQty - originalQty),
                                    ),
                                    sisaQtyPr: Math.max(
                                        0,
                                        newQty - usedQtyPr,
                                    ),
                                };
                            })()
                            : item,
                    ),
                );
            }

            setEditingItemId(null);
        } else {
            setIsSavingItem(true);
            try {
                const csrf = document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content');
                const response = await fetch(
                    `/marketing/purchase-order-in/${encodeURIComponent(purchaseOrderIn?.kode_poin ?? '')}/detail`,
                    {
                        method: 'POST',
                        cache: 'no-store',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
                        },
                        body: JSON.stringify({
                            kd_material: itemForm.kodeMaterial,
                            material: itemForm.material,
                            qty: toNumber(itemForm.qty),
                            satuan: itemForm.unit,
                            price_po_in: toNumber(itemForm.unitPrice),
                            total_price_po_in:
                                toNumber(itemForm.qty) *
                                toNumber(itemForm.unitPrice),
                            remark: itemForm.note,
                        }),
                    },
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const firstError = data?.errors
                        ? Object.values(data.errors)[0]?.[0]
                        : null;
                    throw new Error(
                        firstError ||
                        data?.message ||
                        'Gagal menambahkan material.',
                    );
                }

                setItems((prev) => [
                    ...prev,
                    {
                        ...itemForm,
                        id: `db-${data?.detail?.id ?? Date.now()}`,
                        dbId: data?.detail?.id ?? null,
                        originalQty: toNumber(itemForm.qty),
                        sisaQtyPr: toNumber(data?.detail?.sisa_qtypr ?? 0),
                        sisaQtyDo: toNumber(data?.detail?.sisa_qtydo ?? 0),
                        hasPr: false,
                    },
                ]);
                toastSuccess(data?.message || 'Material berhasil ditambahkan.');
            } catch (error) {
                toastError(error?.message || 'Gagal menambahkan material.');
                setValidationErrors((prev) => ({
                    ...prev,
                    materials: error?.message || 'Gagal menambahkan material.',
                }));
                return;
            } finally {
                setIsSavingItem(false);
            }
        }
        setValidationErrors((prev) => ({ ...prev, materials: '' }));
        resetItemForm();
    };

    const validateHeaderBeforeSave = () => {
        const errors = {};
        if (!String(form.noPoin ?? '').trim()) {
            errors.noPoin = 'No PO Customer wajib diisi.';
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
        if (!String(form.senderName ?? '').trim()) {
            errors.senderName = 'PIC PO Customer wajib diisi.';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSavePoIn = () => {
        if (!validateHeaderBeforeSave()) {
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
            sender_name: form.senderName,
            note: form.note,
            total_price: totalPrice,
            dpp,
            ppn_value: ppn,
            grand_total: grandTotal,
        };

        let isSuccess = false;
        router.put(
            `/marketing/purchase-order-in/${encodeURIComponent(purchaseOrderIn?.kode_poin ?? '')}`,
            payload,
            {
                preserveScroll: true,
                headers: {
                    'X-Skip-Loading-Overlay': '1',
                },
                onStart: () => setIsSubmitting(true),
                onSuccess: (page) => {
                    isSuccess = true;
                    if (page?.props?.flash?.error) {
                        toastError(page.props.flash.error);
                        setIsSubmitting(false);
                        return;
                    }
                    if (page?.props?.flash?.success) {
                        toastSuccess(page.props.flash.success);
                    }
                },
                onError: (errors) => {
                    isSuccess = true;
                    setIsSubmitting(false);
                    const first = Object.values(errors ?? {})[0];
                    const msg = Array.isArray(first) ? first[0] : first;
                    toastError(msg || 'Gagal memperbarui PO In.');
                },
                onFinish: () => {
                    setIsSubmitting(false);
                    if (!isSuccess) {
                        toastError(
                            'Terjadi kesalahan pada server saat memperbarui PO In.',
                        );
                    }
                },
            },
        );
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

    const handleDeleteItem = async (id) => {
        const selectedItem = items.find((item) => item.id === id);
        if (!selectedItem) {
            toastError('Data material tidak ditemukan.');
            return;
        }

        if (items.length <= 1) {
            toastError('Gagal menghapus. Minimal harus ada 1 material.');
            return;
        }

        const result = await Swal.fire({
            title: 'Hapus material ini?',
            text: 'Material akan dihapus dari daftar edit.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        if (selectedItem.dbId) {
            try {
                const csrf = document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content');
                const response = await fetch(
                    `/marketing/purchase-order-in/${encodeURIComponent(purchaseOrderIn?.kode_poin ?? '')}/detail/${encodeURIComponent(selectedItem.dbId)}`,
                    {
                        method: 'DELETE',
                        cache: 'no-store',
                        headers: {
                            Accept: 'application/json',
                            ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
                        },
                    },
                );

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const firstError = data?.errors
                        ? Object.values(data.errors)[0]?.[0]
                        : null;
                    throw new Error(
                        firstError ||
                        data?.message ||
                        'Gagal menghapus material.',
                    );
                }

                toastSuccess(data?.message || 'Material berhasil dihapus.');
            } catch (error) {
                toastError(error?.message || 'Gagal menghapus material.');
                return;
            }
        } else {
            toastSuccess('Material berhasil dihapus.');
        }

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
            params.set('_ts', String(Date.now()));
            const response = await fetch(
                `/marketing/purchase-order-in/materials?${params.toString()}`,
                {
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                },
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
            params.set('_ts', String(Date.now()));
            const response = await fetch(
                `/marketing/purchase-order-in/customers?${params.toString()}`,
                {
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                },
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
            unitPrice: String(material.harga ?? material.price ?? '').replace(
                /[^\d]/g,
                '',
            ),
        }));
        setIsMaterialModalOpen(false);
    };

    return (
        <>
            <Head title="Edit PO In" />
            <div
                className="flex h-full min-w-0 flex-1 flex-col gap-5 px-0 py-4"
                style={{
                    fontFamily:
                        "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
                }}
            >
                {/* ── HEADER HALAMAN (Tanpa Tombol Atas Sesuai Request) ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-foreground">
                                Edit Purchase Order In
                            </h1>
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                                {form.noPoin || purchaseOrderIn?.kode_poin || 'PO In'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Perbarui data transaksi purchase order customer • Sesuaikan data dokumen dan rincian material
                        </p>
                    </div>
                </div>

                {/* ── PARTIAL DO WARNING ──────────────────────────────── */}
                {exhibitsPartialDo && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                        <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <span className="font-semibold">Perhatian: Surat Jalan (DO) Parsial Terbit</span>
                            <p className="text-xs opacity-90">
                                Sebagian material sudah diproses pengiriman DO. Beberapa data header dan material dikunci untuk menjaga integritas data.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── SECTION 1: INFORMASI DOKUMEN & CUSTOMER ──────────── */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-border pb-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Landmark className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-bold text-foreground">
                                Informasi Dokumen & Customer
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Nomor referensi PO, tanggal transaksi, termin pembayaran, dan data customer.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5">
                        {/* Baris 1: Dokumen */}
                        {/* No PO Customer */}
                        <div className="space-y-1.5 lg:col-span-4">
                            <Label htmlFor="no_poin" className="text-xs font-semibold whitespace-nowrap">
                                No PO Customer / Ref PO <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="no_poin"
                                disabled={exhibitsPartialDo}
                                className={`h-9 rounded-lg font-medium uppercase ${validationErrors.noPoin
                                    ? 'border-destructive focus-visible:ring-destructive'
                                    : ''
                                    } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                placeholder="Nomor PO dari Customer"
                                autoComplete="off"
                                value={form.noPoin}
                                onChange={(event) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        noPoin: event.target.value.toUpperCase(),
                                    }));
                                    setValidationErrors((prev) => ({
                                        ...prev,
                                        noPoin: '',
                                    }));
                                }}
                            />
                            {validationErrors.noPoin && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.noPoin}
                                </p>
                            )}
                        </div>

                        {/* Date PO In */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="tanggal" className="text-xs font-semibold whitespace-nowrap">
                                Date PO In <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative flex gap-1.5">
                                <Input
                                    id="tanggal"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg text-center ${validationErrors.date
                                        ? 'border-destructive focus-visible:ring-destructive'
                                        : ''
                                        } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                    value={form.date}
                                    placeholder="dd/mm/yyyy"
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            date: normalizeDateInput(event.target.value),
                                        }))
                                    }
                                    onBlur={(event) => {
                                        setForm((prev) => ({
                                            ...prev,
                                            date: clampDmyValue(event.target.value),
                                        }));
                                        setValidationErrors((prev) => ({
                                            ...prev,
                                            date: '',
                                        }));
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-2.5 rounded-lg shrink-0"
                                    disabled={exhibitsPartialDo}
                                    onClick={() => {
                                        if (datePickerRef.current?.showPicker) {
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
                                            date: toDisplayDate(event.target.value),
                                        }));
                                        setValidationErrors((prev) => ({
                                            ...prev,
                                            date: '',
                                        }));
                                    }}
                                />
                            </div>
                            {validationErrors.date && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.date}
                                </p>
                            )}
                        </div>

                        {/* Delivery Date */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="delivery_date" className="text-xs font-semibold whitespace-nowrap">
                                Delivery Date <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative flex gap-1.5">
                                <Input
                                    id="delivery_date"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg text-center ${validationErrors.deliveryDate
                                        ? 'border-destructive focus-visible:ring-destructive'
                                        : ''
                                        } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                    value={form.deliveryDate}
                                    placeholder="dd/mm/yyyy"
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            deliveryDate: normalizeDateInput(event.target.value),
                                        }))
                                    }
                                    onBlur={(event) => {
                                        setForm((prev) => ({
                                            ...prev,
                                            deliveryDate: clampDmyValue(event.target.value),
                                        }));
                                        setValidationErrors((prev) => ({
                                            ...prev,
                                            deliveryDate: '',
                                        }));
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-2.5 rounded-lg shrink-0"
                                    disabled={exhibitsPartialDo}
                                    onClick={() => {
                                        if (deliveryDatePickerRef.current?.showPicker) {
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
                                    value={toIsoDate(form.deliveryDate)}
                                    onChange={(event) => {
                                        setForm((prev) => ({
                                            ...prev,
                                            deliveryDate: toDisplayDate(event.target.value),
                                        }));
                                        setValidationErrors((prev) => ({
                                            ...prev,
                                            deliveryDate: '',
                                        }));
                                    }}
                                />
                            </div>
                            {validationErrors.deliveryDate && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.deliveryDate}
                                </p>
                            )}
                        </div>

                        {/* Payment Term */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="payment_term" className="text-xs font-semibold whitespace-nowrap">
                                Payment Term
                            </Label>
                            <Input
                                id="payment_term"
                                disabled={exhibitsPartialDo}
                                className={`h-9 rounded-lg ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                value={form.paymentTerm}
                                placeholder="Contoh: 30 Hari"
                                onFocus={(event) => event.target.select()}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        paymentTerm: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        {/* PPN (%) */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="ppn_percent" className="text-xs font-semibold whitespace-nowrap">
                                PPN (%) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="ppn_percent"
                                disabled={exhibitsPartialDo}
                                className={`h-9 rounded-lg text-center font-medium ${validationErrors.ppnPercent
                                    ? 'border-destructive focus-visible:ring-destructive'
                                    : ''
                                    } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                inputMode="decimal"
                                value={form.ppnPercent}
                                onChange={(event) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        ppnPercent: event.target.value.replace(/[^\d.]/g, ''),
                                    }));
                                    setValidationErrors((prev) => ({
                                        ...prev,
                                        ppnPercent: '',
                                    }));
                                }}
                            />
                            {validationErrors.ppnPercent && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.ppnPercent}
                                </p>
                            )}
                        </div>

                        {/* Baris 2: Customer (Nama Customer Diperlebar Penuh) */}
                        {/* Kode Customer */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="customer_code" className="text-xs font-semibold whitespace-nowrap">
                                Kode Customer
                            </Label>
                            <Input
                                id="customer_code"
                                value={form.customerCode}
                                readOnly
                                placeholder="Kode CS"
                                className="h-9 rounded-lg font-mono text-center bg-muted/40 cursor-not-allowed"
                            />
                        </div>

                        {/* Nama Customer (Diperlebar ke lg:col-span-10) */}
                        <div className="space-y-1.5 md:col-span-2 lg:col-span-10">
                            <Label htmlFor="customer_name" className="text-xs font-semibold whitespace-nowrap">
                                Nama Customer <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="customer_name"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg font-medium ${validationErrors.customerName
                                        ? 'border-destructive focus-visible:ring-destructive'
                                        : ''
                                        } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                    value={form.customerName}
                                    readOnly
                                    placeholder="Pilih customer dari database..."
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={exhibitsPartialDo}
                                    className="h-9 px-3.5 rounded-lg text-xs font-semibold shrink-0"
                                    onClick={() => {
                                        setCustomerSearchInput('');
                                        setCustomerSearchTerm('');
                                        setCustomerPageSize(5);
                                        setCustomerCurrentPage(1);
                                        setIsCustomerModalOpen(true);
                                    }}
                                >
                                    <Search className="mr-1.5 size-3.5" />
                                    Cari Customer
                                </Button>
                            </div>
                            {validationErrors.customerName && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.customerName}
                                </p>
                            )}
                        </div>

                        {/* Baris 3: PIC PO Customer & Franco/Loco (Ditaruh Dibawah) */}
                        {/* PIC PO Customer */}
                        <div
                            className="space-y-1.5 md:col-span-1 lg:col-span-6"
                            ref={picDropdownRef}
                        >
                            <Label htmlFor="sender_name" className="text-xs font-semibold whitespace-nowrap">
                                PIC PO Customer <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    ref={picInputRef}
                                    id="sender_name"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg ${validationErrors.senderName
                                        ? 'border-destructive focus-visible:ring-destructive'
                                        : ''
                                        } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                    value={form.senderName}
                                    placeholder={
                                        picLoading
                                            ? 'Memuat PIC...'
                                            : picList.length > 0
                                                ? 'Ketik atau pilih PIC...'
                                                : 'Ketik nama PIC'
                                    }
                                    autoComplete="off"
                                    onChange={(event) => {
                                        const val = event.target.value;
                                        setForm((prev) => ({
                                            ...prev,
                                            senderName: val,
                                        }));
                                        setPicSearch(val);
                                        setShowPicDropdown(true);
                                        setValidationErrors((prev) => ({
                                            ...prev,
                                            senderName: '',
                                        }));
                                    }}
                                    onFocus={() => {
                                        if (picList.length > 0 && !exhibitsPartialDo)
                                            setShowPicDropdown(true);
                                    }}
                                />
                                {showPicDropdown && !exhibitsPartialDo && picList.length > 0 && (
                                    <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover text-sm shadow-md">
                                        {picLoading ? (
                                            <li className="px-3 py-2 text-muted-foreground text-xs">
                                                Memuat...
                                            </li>
                                        ) : (
                                            picList.map((pic) => (
                                                <li
                                                    key={pic}
                                                    className="cursor-pointer px-3 py-2 text-xs hover:bg-muted font-medium transition-colors"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            senderName: pic,
                                                        }));
                                                        setPicSearch('');
                                                        setShowPicDropdown(false);
                                                        setValidationErrors((prev) => ({
                                                            ...prev,
                                                            senderName: '',
                                                        }));
                                                    }}
                                                >
                                                    {pic}
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </div>
                            {validationErrors.senderName && (
                                <p className="text-xs text-destructive">
                                    {validationErrors.senderName}
                                </p>
                            )}
                        </div>

                        {/* Franco/Loco */}
                        <div className="space-y-1.5 md:col-span-1 lg:col-span-6">
                            <Label htmlFor="franco_loco" className="text-xs font-semibold whitespace-nowrap">
                                Franco / Loco <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="franco_loco"
                                disabled={exhibitsPartialDo}
                                className={`h-9 rounded-lg ${validationErrors.francoLoco
                                    ? 'border-destructive focus-visible:ring-destructive'
                                    : ''
                                    } ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                                placeholder="Tempat serah terima / pengiriman"
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
                                <p className="text-xs text-destructive">
                                    {validationErrors.francoLoco}
                                </p>
                            )}
                        </div>

                        {/* Baris 4: Catatan Dokumen */}
                        <div className="space-y-1.5 col-span-1 md:col-span-2 lg:col-span-12">
                            <Label htmlFor="doc_note" className="text-xs font-semibold">
                                Catatan Dokumen
                            </Label>
                            <textarea
                                id="doc_note"
                                rows={2}
                                disabled={exhibitsPartialDo}
                                className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''
                                    }`}
                                value={form.note}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        note: event.target.value,
                                    }))
                                }
                                placeholder="Catatan internal untuk tim marketing / operasional..."
                            />
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: ITEM MATERIAL ────────────────────────── */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <PackageSearch className="size-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-bold text-foreground">
                                        Item Material
                                    </h2>
                                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
                                        {items.length} Material
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Rincian material yang dipesan customer pada purchase order ini.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form Input Item Material */}
                    <div className="rounded-xl border border-border bg-muted/20 p-3.5 sm:p-4 space-y-3">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {editingItemId ? 'Edit Material Terpilih' : 'Tambah Material Baru'}
                        </div>

                        {/* Baris 1 Input Material: Kode Material + Nama Material Diperlebar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                            {/* Kode Material */}
                            <div className="space-y-1 lg:col-span-2">
                                <Label htmlFor="kode_material" className="text-xs font-semibold whitespace-nowrap">
                                    Kode Material
                                </Label>
                                <Input
                                    id="kode_material"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg font-mono text-center text-xs ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="AUTO / KODE"
                                    value={itemForm.kodeMaterial}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            kodeMaterial: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            {/* Nama Material (Diperlebar ke lg:col-span-10) */}
                            <div className="space-y-1 sm:col-span-2 lg:col-span-10">
                                <Label htmlFor="material" className="text-xs font-semibold whitespace-nowrap">
                                    Nama Material <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="material"
                                        disabled={exhibitsPartialDo}
                                        className={`h-9 rounded-lg font-medium ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''
                                            }`}
                                        placeholder="Pilih atau ketik spesifikasi material..."
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
                                        disabled={exhibitsPartialDo}
                                        className="h-9 px-3.5 rounded-lg text-xs font-semibold shrink-0"
                                        onClick={() => {
                                            setIsMaterialModalOpen(true);
                                        }}
                                    >
                                        <Search className="mr-1.5 size-3.5" />
                                        Cari Material
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Baris 2 Input Material: Satuan & Qty (Ditaruh Dibawah & Diperkecil) + Harga Satuan + Total Price */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-[105px_85px_1fr_1fr] gap-3">
                            {/* Satuan (Ditaruh Dibawah & Diperkecil) */}
                            <div className="space-y-1 col-span-1">
                                <Label htmlFor="unit" className="text-xs font-semibold whitespace-nowrap">
                                    Satuan <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="unit"
                                    readOnly
                                    className="h-9 rounded-lg text-center text-xs sm:text-sm bg-muted/40 cursor-not-allowed text-muted-foreground font-medium"
                                    placeholder="Pcs/Btg"
                                    value={itemForm.unit}
                                />
                            </div>

                            {/* Qty (Ditaruh Dibawah & Diperkecil) */}
                            <div className="space-y-1 col-span-1">
                                <Label htmlFor="qty" className="text-xs font-semibold whitespace-nowrap">
                                    Qty <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="qty"
                                    type="number"
                                    disabled={exhibitsPartialDo && !editingItemId}
                                    className={`h-9 rounded-lg text-center font-medium text-xs sm:text-sm ${exhibitsPartialDo && !editingItemId ? 'bg-muted/40 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="0"
                                    value={itemForm.qty}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            qty: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            {/* Price PO In */}
                            <div className="space-y-1 col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-1">
                                <Label htmlFor="price" className="text-xs font-semibold whitespace-nowrap">
                                    Price PO In (Harga Satuan) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="price"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg tabular-nums text-sm font-medium ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="Rp 0"
                                    value={formatRupiahInput(itemForm.unitPrice)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleAddItem();
                                        }
                                    }}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            unitPrice: event.target.value.replace(/[^\d]/g, ''),
                                        }))
                                    }
                                />
                            </div>

                            {/* Total Price PO In */}
                            <div className="space-y-1 col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-1">
                                <Label htmlFor="total_price_po_in" className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
                                    Total Price PO In
                                </Label>
                                <Input
                                    id="total_price_po_in"
                                    className="h-9 rounded-lg tabular-nums text-sm font-semibold bg-muted/40 text-emerald-600 dark:text-emerald-400 cursor-not-allowed"
                                    value={formatRupiah(itemTotalPricePoIn)}
                                    readOnly
                                />
                            </div>
                        </div>

                        {/* Baris 3 Input Material: Remark (Ditaruh Dibawah) + Tombol Aksi */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                            {/* Remark (Ditaruh Dibawah) */}
                            <div className="space-y-1 lg:col-span-9">
                                <Label htmlFor="item_note" className="text-xs font-semibold whitespace-nowrap">
                                    Remark / Keterangan Material
                                </Label>
                                <Input
                                    id="item_note"
                                    disabled={exhibitsPartialDo}
                                    className={`h-9 rounded-lg text-sm ${exhibitsPartialDo ? 'bg-muted/40 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="Catatan spesifikasi/potongan (opsional)"
                                    value={itemForm.note}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleAddItem();
                                        }
                                    }}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            note: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            {/* Tombol Aksi Tambah / Batal */}
                            <div className="flex items-center gap-2 lg:col-span-3">
                                <MenuAction
                                    action="update"
                                    type="button"
                                    className="h-9 flex-1 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs sm:text-sm"
                                    onClick={handleAddItem}
                                    disabled={isSavingItem || (exhibitsPartialDo && !editingItemId)}
                                >
                                    {isSavingItem ? (
                                        'Menyimpan...'
                                    ) : editingItemId ? (
                                        <>
                                            <Check className="mr-1.5 size-4" />
                                            Simpan Perubahan
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-1.5 size-4" />
                                            Tambah Item
                                        </>
                                    )}
                                </MenuAction>
                                {editingItemId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 px-3 rounded-lg text-xs"
                                        onClick={handleCancelEditItem}
                                    >
                                        Batal
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabel Item Material */}
                    <div className="mt-3 grid gap-3 md:hidden">
                        {items.length === 0 && (
                            <div className="rounded-xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                Belum ada item material yang ditambahkan.
                            </div>
                        )}
                        {items.map((item, index) => (
                            <div
                                key={item.id}
                                className="rounded-xl border border-border bg-card p-3 text-sm shadow-xs space-y-2.5"
                            >
                                <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">
                                            #{index + 1} • {item.kodeMaterial || 'Non-Stock'}
                                        </p>
                                        <p className="font-semibold text-foreground break-words">
                                            {item.material}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {(!exhibitsPartialDo || toNumber(item.sisaQtyDo ?? 0) !== 0) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="size-8 p-0 rounded-lg"
                                                onClick={() => handleEditItem(item)}
                                                title="Edit Material"
                                            >
                                                <Pencil className="size-3.5" />
                                            </Button>
                                        )}
                                        {toNumber(item.sisaQtyPr ?? 0) === toNumber(item.qty ?? 0) &&
                                            toNumber(item.sisaQtyDo ?? 0) === toNumber(item.qty ?? 0) && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="size-8 p-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    title="Hapus Material"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-muted-foreground">Qty & Satuan</p>
                                        <p className="font-semibold text-foreground">
                                            {item.qty} {item.unit}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Harga Satuan</p>
                                        <p className="tabular-nums font-semibold text-foreground">
                                            {formatRupiah(item.unitPrice)}
                                        </p>
                                    </div>
                                    <div className="col-span-2 pt-1 border-t border-border/50">
                                        <p className="text-muted-foreground">Total Price</p>
                                        <p className="tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(
                                                toNumber(item.qty) * toNumber(item.unitPrice),
                                            )}
                                        </p>
                                    </div>
                                    {item.note && (
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground">Remark</p>
                                            <p className="break-words text-foreground">
                                                {item.note}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border md:block">
                        <table className="w-full min-w-[850px] text-sm">
                            <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3.5 py-3 text-center w-12">No</th>
                                    <th className="px-3.5 py-3 text-left w-28">Kode</th>
                                    <th className="px-3.5 py-3 text-left">Nama Material</th>
                                    <th className="px-3.5 py-3 text-center w-28">Qty</th>
                                    <th className="px-3.5 py-3 text-right w-36">Price PO In</th>
                                    <th className="px-3.5 py-3 text-right w-40">Total Price PO In</th>
                                    <th className="px-3.5 py-3 text-left">Remark</th>
                                    <th className="px-3.5 py-3 text-center w-24">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-4 py-8 text-center text-muted-foreground"
                                            colSpan={8}
                                        >
                                            Belum ada item material yang ditambahkan.
                                        </td>
                                    </tr>
                                )}
                                {items.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-muted/30 transition-colors"
                                    >
                                        <td className="px-3.5 py-3 text-center text-xs text-muted-foreground">
                                            {index + 1}
                                        </td>
                                        <td className="px-3.5 py-3 font-medium text-foreground">
                                            {item.kodeMaterial || '-'}
                                        </td>
                                        <td className="px-3.5 py-3 font-medium text-foreground">
                                            {item.material}
                                        </td>
                                        <td className="px-3.5 py-3 text-center font-semibold text-foreground">
                                            {item.qty} {item.unit}
                                        </td>
                                        <td className="px-3.5 py-3 text-right tabular-nums font-semibold text-foreground">
                                            {formatRupiah(item.unitPrice)}
                                        </td>
                                        <td className="px-3.5 py-3 text-right tabular-nums font-bold text-foreground">
                                            {formatRupiah(
                                                toNumber(item.qty) * toNumber(item.unitPrice),
                                            )}
                                        </td>
                                        <td className="px-3.5 py-3 text-xs text-muted-foreground">
                                            {item.note || '-'}
                                        </td>
                                        <td className="px-3.5 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {(!exhibitsPartialDo || toNumber(item.sisaQtyDo ?? 0) !== 0) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="size-8 p-0 rounded-lg"
                                                        onClick={() => handleEditItem(item)}
                                                        title="Edit Material"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </Button>
                                                )}
                                                {toNumber(item.sisaQtyPr ?? 0) === toNumber(item.qty ?? 0) &&
                                                    toNumber(item.sisaQtyDo ?? 0) === toNumber(item.qty ?? 0) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="size-8 p-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            title="Hapus Material"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {validationErrors.materials && (
                        <p className="mt-2 text-xs text-destructive font-medium">
                            {validationErrors.materials}
                        </p>
                    )}
                </div>

                {/* ── SECTION 3: RINGKASAN NILAI TRANSAKSI & AKSI ─────── */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-border pb-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <ReceiptText className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-bold text-foreground">
                                Ringkasan Nilai Transaksi
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Akumulasi total nilai pesanan, DPP, PPN, dan grand total transaksi.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                                Total Price
                            </span>
                            <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                                {formatRupiah(totalPrice)}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                                DPP
                            </span>
                            <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                                {formatRupiah(dpp)}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                                PPN ({form.ppnPercent || '0'}%)
                            </span>
                            <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                                {formatRupiah(ppn)}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Grand Total
                            </span>
                            <p className="text-lg sm:text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatRupiah(grandTotal)}
                            </p>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                        <MenuAction
                            action="update"
                            type="button"
                            onClick={handleSavePoIn}
                            disabled={isSubmitting}
                            className="h-10 px-6 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm w-full sm:w-auto"
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
                        </MenuAction>
                    </div>
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
                    }
                }}
            >
                <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[1280px] max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-4">
                    <DialogHeader>
                        <DialogTitle>Pilih Material</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2">
                            Tampilkan
                            <select
                                className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
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
                        <label className="grid gap-1 sm:ml-auto sm:w-full sm:max-w-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                            <span>Cari</span>
                            <input
                                type="search"
                                className="w-full rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm sm:py-1"
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
                        <table className="w-full min-w-[760px] table-auto text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th
                                        className="w-32 px-2 py-2 text-left"
                                        rowSpan={2}
                                    >
                                        Kode Material
                                    </th>
                                    <th
                                        className="px-2 py-2 text-left"
                                        rowSpan={2}
                                    >
                                        Nama Material
                                    </th>
                                    <th
                                        className="px-2 py-2 text-center"
                                        colSpan={5}
                                    >
                                        Stok
                                    </th>
                                    <th
                                        className="w-20 px-2 py-2 text-left"
                                        rowSpan={2}
                                    >
                                        Satuan
                                    </th>
                                    <th
                                        className="w-20 px-2 py-2 text-left"
                                        rowSpan={2}
                                    >
                                        Action
                                    </th>
                                </tr>
                                <tr>
                                    <th className="w-16 px-2 py-2 text-right">
                                        G1
                                    </th>
                                    <th className="w-16 px-2 py-2 text-right">
                                        G2
                                    </th>
                                    <th className="w-16 px-2 py-2 text-right">
                                        G3
                                    </th>
                                    <th className="w-16 px-2 py-2 text-right">
                                        G4
                                    </th>
                                    <th className="w-20 px-2 py-2 text-right">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedMaterials.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-muted-foreground"
                                            colSpan={9}
                                        >
                                            {materialLoading
                                                ? 'Memuat data material...'
                                                : materialError ||
                                                'Tidak ada data material.'}
                                        </td>
                                    </tr>
                                )}
                                {displayedMaterials.map((item) => (
                                    <tr
                                        key={item.kd_material}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            {item.kd_material ?? '-'}
                                        </td>
                                        <td className="px-2 py-2">
                                            {item.material ?? '-'}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatStock(item.stok_g1)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatStock(item.stok_g2)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatStock(item.stok_g3)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatStock(item.stok_g4)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatStock(item.stok)}
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            {item.unit ?? '-'}
                                        </td>
                                        <td className="px-2 py-2">
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
                            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                                <div className="grid grid-cols-2 items-center gap-2 sm:flex">
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
                                    <span className="col-span-2 text-center text-sm text-muted-foreground sm:col-span-1">
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
                <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[1280px] max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xl space-y-4">
                    <DialogHeader>
                        <DialogTitle>Pilih Customer</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2">
                            Tampilkan
                            <select
                                className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
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
                        <label className="grid gap-1 sm:ml-auto sm:w-full sm:max-w-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                            <span>Cari</span>
                            <input
                                type="search"
                                className="w-full rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm sm:py-1"
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
                        <table className="w-full min-w-[620px] table-auto text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="w-28 px-2 py-2 text-left">
                                        Kode CS
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Customer
                                    </th>
                                    <th className="w-20 px-2 py-2 text-left">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedCustomers.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-muted-foreground"
                                            colSpan={3}
                                        >
                                            {customerLoading
                                                ? 'Memuat data customer...'
                                                : customerError ||
                                                'Tidak ada data customer.'}
                                        </td>
                                    </tr>
                                )}
                                {displayedCustomers.map((item) => (
                                    <tr
                                        key={item.kd_cs}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            {item.kd_cs ?? '-'}
                                        </td>
                                        <td className="px-2 py-2">
                                            {item.nm_cs ?? '-'}
                                        </td>
                                        <td className="px-2 py-2">
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
                        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                            <div className="grid grid-cols-2 items-center gap-2 sm:flex">
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
                                <span className="col-span-2 text-center text-sm text-muted-foreground sm:col-span-1">
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
        </>
    );
}

PurchaseOrderInEdit.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
