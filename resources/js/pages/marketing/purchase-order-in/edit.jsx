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

    const [form, setForm] = useState({
        noPoin: purchaseOrderIn?.no_poin ?? '',
        date: toDisplayDate(purchaseOrderIn?.date_poin ?? defaults.date),
        deliveryDate: toDisplayDate(
            purchaseOrderIn?.delivery_date ?? defaults.date,
        ),
        customerCode: '',
        customerName: purchaseOrderIn?.customer_name ?? '',
        paymentTerm:
            purchaseOrderIn?.payment_term ?? defaults.payment_term ?? '30 Hari',
        ppnPercent:
            purchaseOrderIn?.ppn_input_percent !== undefined &&
            purchaseOrderIn?.ppn_input_percent !== null
                ? String(purchaseOrderIn.ppn_input_percent)
                : '',
        francoLoco: purchaseOrderIn?.franco_loco ?? '',
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
            note: form.note,
            total_price: totalPrice,
            dpp,
            ppn_value: ppn,
            grand_total: grandTotal,
        };

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
                    if (page?.props?.flash?.error) {
                        toastError(page.props.flash.error);
                        setIsSubmitting(false);
                    }
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    const first = Object.values(errors ?? {})[0];
                    const msg = Array.isArray(first) ? first[0] : first;
                    toastError(msg || 'Gagal memperbarui PO In.');
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
            <div className="flex h-full min-w-0 flex-1 flex-col gap-4 p-3 sm:gap-5 sm:p-4">
                {/* Header section with explicit hex background for maximum compatibility */}
                <section
                    className="rounded-xl border border-slate-700 bg-[#0f172a] p-4 text-white shadow-lg sm:rounded-2xl sm:p-5"
                    style={{ backgroundColor: '#0f172a' }}
                >
                    <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                        Edit Purchase Order In
                    </h1>
                </section>

                <div className="grid min-w-0 gap-5">
                    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(280px,1.3fr)]">
                        <article className="min-w-0 rounded-xl border border-sidebar-border/70 bg-background p-3 shadow-sm sm:rounded-2xl sm:p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <Landmark className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">
                                    Informasi Header
                                </h2>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="no_poin">
                                        No PO Customer/Ref PO
                                    </Label>
                                    <Input
                                        id="no_poin"
                                        disabled={exhibitsPartialDo}
                                        className={
                                            validationErrors.noPoin
                                                ? 'border-red-500 focus-visible:ring-red-500'
                                                : ''
                                        }
                                        placeholder="Auto / manual"
                                        autoComplete="off"
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
                                    <Label htmlFor="tanggal">Date PO In</Label>
                                    <div className="relative flex gap-2">
                                        <Input
                                            id="tanggal"
                                            disabled={exhibitsPartialDo}
                                            className={
                                                validationErrors.date
                                                    ? 'border-red-500 focus-visible:ring-red-500'
                                                    : ''
                                            }
                                            value={form.date}
                                            placeholder="dd/mm/yyyy"
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
                                                setValidationErrors((prev) => ({
                                                    ...prev,
                                                    date: '',
                                                }));
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0 px-3"
                                            disabled={exhibitsPartialDo}
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
                                                setValidationErrors((prev) => ({
                                                    ...prev,
                                                    date: '',
                                                }));
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
                                            disabled={exhibitsPartialDo}
                                            className={
                                                validationErrors.deliveryDate
                                                    ? 'border-red-500 focus-visible:ring-red-500'
                                                    : ''
                                            }
                                            value={form.deliveryDate}
                                            placeholder="dd/mm/yyyy"
                                            onChange={(event) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    deliveryDate:
                                                        normalizeDateInput(
                                                            event.target.value,
                                                        ),
                                                }))
                                            }
                                            onBlur={(event) => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    deliveryDate: clampDmyValue(
                                                        event.target.value,
                                                    ),
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
                                            className="shrink-0 px-3"
                                            disabled={exhibitsPartialDo}
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
                                            value={toIsoDate(form.deliveryDate)}
                                            onChange={(event) => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    deliveryDate: toDisplayDate(
                                                        event.target.value,
                                                    ),
                                                }));
                                                setValidationErrors((prev) => ({
                                                    ...prev,
                                                    deliveryDate: '',
                                                }));
                                            }}
                                        />
                                    </div>
                                    {validationErrors.deliveryDate && (
                                        <p className="text-xs text-red-500">
                                            {validationErrors.deliveryDate}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="customer_name">
                                        Nama Customer
                                    </Label>
                                    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
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
                                            className="w-full md:w-auto"
                                            disabled={exhibitsPartialDo}
                                            onClick={() => {
                                                setIsCustomerModalOpen(true);
                                                setCustomerSearchTerm('');
                                                setCustomerPageSize(5);
                                                setCustomerCurrentPage(1);
                                            }}
                                        >
                                            <span className="whitespace-nowrap">
                                                Cari Customer
                                            </span>
                                        </Button>
                                    </div>
                                    {validationErrors.customerName && (
                                        <p className="text-xs text-red-500">
                                            {validationErrors.customerName}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_term">
                                        Payment Term
                                    </Label>
                                    <Input
                                        id="payment_term"
                                        disabled={exhibitsPartialDo}
                                        value={form.paymentTerm}
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
                                        disabled={exhibitsPartialDo}
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
                                <div className="grid gap-2">
                                    <Label htmlFor="franco_loco">
                                        Franco/Loco
                                    </Label>
                                    <Input
                                        id="franco_loco"
                                        disabled={exhibitsPartialDo}
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
                                <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                                    <Label htmlFor="doc_note">
                                        Catatan Dokumen
                                    </Label>
                                    <textarea
                                        id="doc_note"
                                        disabled={exhibitsPartialDo}
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

                        <aside className="grid min-w-0 content-start gap-3 self-start">
                            <article className="rounded-xl border border-sidebar-border/70 bg-background p-3 shadow-sm sm:rounded-2xl sm:p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <ReceiptText className="size-4 text-muted-foreground" />
                                    <h2 className="text-base font-semibold">
                                        Ringkasan
                                    </h2>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start justify-between gap-3 border-t border-sidebar-border/70 pt-3">
                                        <span className="text-muted-foreground">
                                            Total Price
                                        </span>
                                        <span className="text-right font-semibold break-words">
                                            {formatRupiah(totalPrice)}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-muted-foreground">
                                            DPP
                                        </span>
                                        <span className="text-right font-semibold break-words">
                                            {formatRupiah(dpp)}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-muted-foreground">
                                            PPN ({form.ppnPercent || '0'}%)
                                        </span>
                                        <span className="text-right font-semibold break-words">
                                            {formatRupiah(ppn)}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 border-t border-sidebar-border/70 pt-3">
                                        <span className="text-muted-foreground">
                                            Grand Total
                                        </span>
                                        <span className="text-right text-base font-semibold break-words sm:text-lg">
                                            {formatRupiah(grandTotal)}
                                        </span>
                                    </div>
                                </div>
                            </article>

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                <Button
                                    className="w-full"
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
                                    className="w-full"
                                >
                                    <Link href="/marketing/purchase-order-in">
                                        Batal
                                    </Link>
                                </Button>
                            </div>
                        </aside>
                    </section>

                    <article className="min-w-0 rounded-xl border border-sidebar-border/70 bg-background p-3 shadow-sm sm:rounded-2xl sm:p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <PackageSearch className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">
                                Item Material
                            </h2>
                        </div>
                        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-8">
                            <div className="grid gap-2 lg:col-span-2 xl:col-span-1">
                                <Label htmlFor="kode_material">
                                    Kode Material
                                </Label>
                                <Input
                                    id="kode_material"
                                    disabled={exhibitsPartialDo}
                                    value={itemForm.kodeMaterial}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            kodeMaterial: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 sm:col-span-2 lg:col-span-6 xl:col-span-7">
                                <Label htmlFor="material">Material</Label>
                                <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                    <Input
                                        id="material"
                                        disabled={exhibitsPartialDo}
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
                                        className="w-full md:w-auto"
                                        disabled={exhibitsPartialDo}
                                        onClick={() => {
                                            setIsMaterialModalOpen(true);
                                        }}
                                    >
                                        <span className="whitespace-nowrap">
                                            Cari Material
                                        </span>
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2 lg:col-span-1">
                                <Label htmlFor="qty">Qty</Label>
                                <Input
                                    id="qty"
                                    type="number"
                                    disabled={
                                        exhibitsPartialDo && !editingItemId
                                    }
                                    value={itemForm.qty}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            qty: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 lg:col-span-1">
                                <Label htmlFor="unit">Satuan</Label>
                                <Input
                                    id="unit"
                                    disabled={exhibitsPartialDo}
                                    value={itemForm.unit}
                                    onChange={(event) =>
                                        setItemForm((prev) => ({
                                            ...prev,
                                            unit: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                                <Label htmlFor="price">Price PO In</Label>
                                <Input
                                    id="price"
                                    disabled={exhibitsPartialDo}
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
                            <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                                <Label htmlFor="total_price_po_in">
                                    Total Price PO In
                                </Label>
                                <Input
                                    id="total_price_po_in"
                                    value={formatRupiah(itemTotalPricePoIn)}
                                    readOnly
                                />
                            </div>
                            <div className="grid gap-2 sm:col-span-2 lg:col-span-8">
                                <Label htmlFor="item_note">Remark</Label>
                                <Input
                                    id="item_note"
                                    disabled={exhibitsPartialDo}
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
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={handleAddItem}
                                disabled={
                                    isSavingItem ||
                                    (exhibitsPartialDo && !editingItemId)
                                }
                            >
                                {isSavingItem
                                    ? 'Menyimpan...'
                                    : editingItemId
                                      ? 'Simpan Perubahan'
                                      : 'Tambah Item'}
                            </Button>
                            {editingItemId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={handleCancelEditItem}
                                >
                                    Batal Edit
                                </Button>
                            )}
                        </div>

                        <div className="mt-4 grid gap-3 md:hidden">
                            {items.length === 0 && (
                                <div className="rounded-xl border border-sidebar-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                                    Belum ada item material.
                                </div>
                            )}
                            {items.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="rounded-xl border border-sidebar-border/70 p-3 text-sm"
                                >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs text-muted-foreground">
                                                #{index + 1} -{' '}
                                                {item.kodeMaterial || '-'}
                                            </p>
                                            <p className="mt-1 font-semibold break-words">
                                                {item.material}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {(!exhibitsPartialDo ||
                                                toNumber(
                                                    item.sisaQtyDo ?? 0,
                                                ) !== 0) && (
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
                                            )}
                                            {!item.hasPr &&
                                                !exhibitsPartialDo && (
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
                                                )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Qty
                                            </p>
                                            <p className="font-medium">
                                                {item.qty} {item.unit}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Price
                                            </p>
                                            <p className="font-medium">
                                                {formatRupiah(item.unitPrice)}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">
                                                Total
                                            </p>
                                            <p className="font-semibold">
                                                {formatRupiah(
                                                    toNumber(item.qty) *
                                                        toNumber(
                                                            item.unitPrice,
                                                        ),
                                                )}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">
                                                Remark
                                            </p>
                                            <p className="break-words">
                                                {item.note || '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-sidebar-border/70 md:block">
                            <table className="w-full min-w-[900px] text-sm">
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
                                                    {(!exhibitsPartialDo ||
                                                        toNumber(
                                                            item.sisaQtyDo ?? 0,
                                                        ) !== 0) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleEditItem(
                                                                    item,
                                                                )
                                                            }
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                    )}
                                                    {!item.hasPr &&
                                                        !exhibitsPartialDo && (
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
                                                        )}
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
                    }
                }}
            >
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none p-3 sm:p-6">
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
                                            {formatInteger(item.stok_g1)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatInteger(item.stok_g2)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatInteger(item.stok_g3)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatInteger(item.stok_g4)}
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatInteger(item.stok)}
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
                <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none p-3 sm:p-6">
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
                                    <th className="w-40 px-2 py-2 text-left">
                                        Kota
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
                                            colSpan={4}
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
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            {item.kota_cs ?? '-'}
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
