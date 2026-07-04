import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { CheckCircle2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Edit PR', href: '/marketing/purchase-requirement' },
];

const toDateInputValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const match = trimmed.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
        if (match) {
            const [, day, month, year] = match;
            return `${year}-${month}-${day}`;
        }
        if (trimmed.length >= 10) {
            return trimmed.slice(0, 10);
        }
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
        return String(value);
    }
    return `${number.toFixed(2)}%`;
};

const calculateMargin = (priceInPo, priceEstimate) => {
    const estimate = parseNumber(priceEstimate);
    const po = parseNumber(priceInPo);
    if (!estimate) return '';
    const margin = ((po - estimate) / estimate) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qty, priceEstimate) => {
    const total = parseNumber(qty) * parseNumber(priceEstimate);
    return total ? Math.round(total).toString() : '';
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(
        parseNumber(value),
    );

const formatInteger = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.round(parseNumber(value)),
    );

export default function PurchaseRequirementEdit({
    purchaseRequirement,
    purchaseRequirementDetails = [],
}) {
    const { tenant } = usePage().props;
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(null);
    const [savingMaterialId, setSavingMaterialId] = useState('');
    const [deletingMaterialId, setDeletingMaterialId] = useState('');
    const [clearingSisaPrId, setClearingSisaPrId] = useState('');

    const detailDateSource = purchaseRequirementDetails?.[0]?.date;

    const dbPrefix = (tenant?.database ?? '').toLowerCase().replace(/^db/, '').toUpperCase();
    const forValue = dbPrefix ? `FOR ${dbPrefix}` : 'FOR';

    const [formData, setFormData] = useState({
        date: toDateInputValue(detailDateSource),
        refPo: purchaseRequirement?.ref_po ?? '',
        forCustomer: purchaseRequirement?.for_customer ?? '',
        payment: purchaseRequirement?.payment ?? 'Cash Trans',
        jenisPr: purchaseRequirement?.jenis_pr ?? '',
    });

    useEffect(() => {
        const detailDate = purchaseRequirementDetails?.[0]?.date;
        setFormData({
            date: toDateInputValue(detailDate),
            refPo: purchaseRequirement?.ref_po ?? '',
            forCustomer: purchaseRequirement?.for_customer ?? '',
            payment: purchaseRequirement?.payment ?? 'Cash Trans',
            jenisPr: purchaseRequirement?.jenis_pr ?? '',
        });
    }, [purchaseRequirement, purchaseRequirementDetails]);

    const [materialItems, setMaterialItems] = useState(
        (purchaseRequirementDetails ?? []).map((item, index) => ({
            id: item.no ?? `${Date.now()}-${index}`,
            detailNo: item.no ?? null,
            kodeMaterial: item.kd_material ?? '',
            namaMaterial: item.material ?? '',
            stok: Math.round(parseNumber(item.stok)),
            stokG1: Math.round(parseNumber(item.stok_g1)),
            stokG2: Math.round(parseNumber(item.stok_g2)),
            stokG3: Math.round(parseNumber(item.stok_g3)),
            stokG4: Math.round(parseNumber(item.stok_g4)),
            qty: item.sisa_pr ?? item.qty ?? '', // Sisa PR
            qtyDetail: item.qty ?? 0, // tb_detailpr.qty
            originalQtyDetail: parseNumber(item.qty),
            originalSisaPr: parseNumber(item.sisa_pr ?? item.qty),
            satuan: item.unit ?? '',
            priceEstimate: item.unit_price ?? '',
            totalPrice: item.total_price ?? '',
            priceInPo: item.price_po ?? '',
            margin: item.margin ?? '',
            remark: item.renmark ?? '',
            qtyPo: parseNumber(item.qty_po),
            qtyPoIn: parseNumber(item.qty_po_in),
            sisaQtyPoIn: parseNumber(item.sisa_qty_po),
            refPo: item.ref_po ?? purchaseRequirement?.ref_po ?? '',
            forCustomer:
                item.for_customer ?? purchaseRequirement?.for_customer ?? '',
        })),
    );

    const uniqueCustomerPOs = useMemo(() => {
        if (!materialItems || materialItems.length === 0) return [];
        const map = new Map();
        materialItems.forEach((d) => {
            if (d.refPo && !map.has(d.refPo)) {
                map.set(d.refPo, d.forCustomer);
            }
        });
        return Array.from(map.entries()).map(([ref_po, customer]) => ({ ref_po, customer }));
    }, [materialItems]);

    const handleRemoveCustomerPo = (refPo) => {
        const noPr = purchaseRequirement?.no_pr;
        if (!noPr) return;

        Swal.fire({
            title: 'Hapus Customer / PO?',
            text: `Yakin ingin menghapus ${refPo} dari PR ini? Proses ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Memproses...',
                    text: 'Sedang menghapus data dari PR...',
                    didOpen: () => Swal.showLoading(),
                });

                fetch(`/marketing/purchase-requirement/${noPr}/remove-po/${refPo}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content,
                        Accept: 'application/json',
                    },
                })
                    .then((response) => response.json().then((data) => ({ status: response.status, data })))
                    .then(({ status, data }) => {
                        if (status >= 400) throw new Error(data.message || 'Gagal menghapus Customer dari PR');
                        Swal.fire('Terhapus!', 'Customer/PO berhasil dihapus dari PR.', 'success');

                        // Reload the edit page to fetch the remaining records cleanly from backend state
                        window.location.reload();
                    })
                    .catch((error) => {
                        Swal.fire('Gagal!', error.message, 'error');
                    });
            }
        });
    };

    // Material Selection Modal States
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState(null);

    const materialTotalPages =
        materialPageSize === Infinity
            ? 1
            : Math.ceil(materialTotal / materialPageSize);

    const loadMaterials = useCallback(async () => {
        setMaterialLoading(true);
        setMaterialError(null);
        try {
            const params = new URLSearchParams({
                search: materialSearchTerm,
                per_page:
                    materialPageSize === Infinity ? 'all' : materialPageSize,
                page: materialCurrentPage,
                ref_po: formData.refPo,
                no_pr: purchaseRequirement?.no_pr ?? '',
            });
            const response = await fetch(
                `/marketing/purchase-requirement/materials?${params}`,
            );
            if (!response.ok) throw new Error('Failed to fetch materials');
            const data = await response.json();
            setMaterialList(data.materials || []);
            setMaterialTotal(data.total || 0);
        } catch (error) {
            setMaterialError(error.message);
        } finally {
            setMaterialLoading(false);
        }
    }, [materialSearchTerm, materialPageSize, materialCurrentPage]);

    useEffect(() => {
        if (isMaterialModalOpen) {
            loadMaterials();
        }
    }, [isMaterialModalOpen, loadMaterials]);

    // List-level search & pagination (Step 2 existing items)
    const [listSearch, setListSearch] = useState('');
    const [listPageSize, setListPageSize] = useState(5);
    const [listCurrentPage, setListCurrentPage] = useState(1);
    const [activePoTab, setActivePoTab] = useState('');

    const poTabs = useMemo(() => {
        const groups = new Map();
        materialItems.forEach((item) => {
            const refPo = item.refPo || 'Tanpa PO In';
            if (!groups.has(refPo)) {
                groups.set(refPo, {
                    refPo,
                    customer: item.forCustomer || '',
                    count: 0,
                });
            }
            groups.get(refPo).count += 1;
        });
        return Array.from(groups.values());
    }, [materialItems]);

    useEffect(() => {
        if (
            poTabs.length > 0 &&
            !poTabs.some((tab) => tab.refPo === activePoTab)
        ) {
            setActivePoTab(poTabs[0].refPo);
        }
    }, [activePoTab, poTabs]);

    const filteredItems = materialItems.filter((item) => {
        const q = listSearch.toLowerCase();
        return (
            (!activePoTab || (item.refPo || 'Tanpa PO In') === activePoTab) &&
            (!q ||
                item.kodeMaterial.toLowerCase().includes(q) ||
                item.namaMaterial.toLowerCase().includes(q))
        );
    });

    const listTotalPages =
        listPageSize === Infinity
            ? 1
            : Math.ceil(filteredItems.length / listPageSize);

    const paginatedItems =
        listPageSize === Infinity
            ? filteredItems
            : filteredItems.slice(
                (listCurrentPage - 1) * listPageSize,
                listCurrentPage * listPageSize,
            );

    // Reset page when search changes
    useEffect(() => {
        setListCurrentPage(1);
    }, [listSearch, listPageSize, activePoTab]);

    const openEditCardDirect = (item) => {
        setEditingId(item.id);
        const totalPrice = calculateTotalPrice(
            item.qtyDetail ?? 0,
            item.priceEstimate ?? 0,
        );
        setEditingDraft({
            kodeMaterial: item.kodeMaterial ?? '',
            namaMaterial: item.namaMaterial ?? '',
            stok: item.stok ?? '',
            qtyDetail: item.qtyDetail ?? 0, // tb_detailpr.qty (derived)
            originalQtyDetail: item.originalQtyDetail ?? item.qtyDetail ?? 0, // fixed reference
            qty: item.qty ?? '', // sisa_pr (editable)
            originalSisaPr: item.originalSisaPr ?? parseFloat(item.qty ?? 0), // fixed reference for delta
            qtyPo: item.qtyPo ?? 0,
            qtyPoIn: item.qtyPoIn ?? 0,
            sisaQtyPoIn: item.sisaQtyPoIn ?? 0,
            satuan: item.satuan ?? '',
            priceEstimate: item.priceEstimate ?? '',
            totalPrice: totalPrice,
            priceInPo: item.priceInPo ?? '',
            margin: item.margin ?? '',
            remark: item.remark ?? '',
        });
    };

    const openEditCard = (item) => {
        openEditCardDirect(item);
    };

    const getQtyValidationMessage = (source) => {
        if (!source) return '';
        if (source.detailNo === null) return '';

        const nextQty = parseNumber(source.qtyDetail);
        const originalQty = parseNumber(
            source.originalQtyDetail ?? source.qtyDetail,
        );
        const maxQtyByPoIn = originalQty + parseNumber(source.sisaQtyPoIn);
        const qtyPo = parseNumber(source.qtyPo);
        const stok = parseNumber(source.stok);
        const qtyPoIn = parseNumber(source.qtyPoIn);
        const minimumQtyByStock = Math.max(0, stok - qtyPoIn);

        if (nextQty < minimumQtyByStock) {
            return `Qty tidak boleh kurang dari Total Stok - Qty PO In. Minimal qty adalah ${formatNumber(minimumQtyByStock)}.`;
        }

        if (nextQty < qtyPo) {
            return `Qty hanya boleh dikurangi sampai Sisa PR = 0. Minimal qty adalah ${formatNumber(qtyPo)}.`;
        }

        return '';
    };

    const closeEditCard = () => {
        setEditingId(null);
        setEditingDraft(null);
    };

    const updateDraft = (field, value) => {
        setEditingDraft((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [field]: value };

            // --- LOGIKA SINKRONISASI MANUAl: HARGA PO IN MENGIKUTI HARGA MODAL ---
            if (field === 'priceEstimate') {
                next.priceInPo = value; // Pastikan isi Harga PO In selalu sama persis dengan Harga Modal
            }
            // --------------------------------------------------------------------

            // When Qty changes → auto-recalc Sisa PR = max(0, qty - stok)
            if (field === 'qtyDetail') {
                const requestedQty = parseFloat(value) || 0;
                const originalQty = parseFloat(next.originalQtyDetail) || 0;
                const sisaQtyPoIn = parseFloat(next.sisaQtyPoIn) || 0;
                const maxQty = originalQty + sisaQtyPoIn;
                const qty =
                    maxQty > 0 ? Math.min(requestedQty, maxQty) : requestedQty;
                const qtyPo = parseFloat(next.qtyPo) || 0;
                next.qtyDetail = String(qty);
                next.qty = String(Math.max(0, qty - qtyPo));
            }
            // When Sisa PR changes → Qty = originalQty + (newSisaPR - originalSisaPR)
            if (field === 'qty') {
                const newSisaPr = parseFloat(value) || 0;
                const origSisaPr = parseFloat(next.originalSisaPr) || 0;
                const origQty = parseFloat(next.originalQtyDetail) || 0;
                const delta = newSisaPr - origSisaPr;
                next.qtyDetail = String(Math.max(0, origQty + delta));
            }
            // When Harga Modal atau Harga PO In berubah → hitung margin (otomatis 0.00)
            if (field === 'priceEstimate' || field === 'priceInPo') {
                next.margin = calculateMargin(
                    next.priceInPo,
                    next.priceEstimate,
                );
            }
            // Always recalc total price
            next.totalPrice = calculateTotalPrice(
                next.qtyDetail,
                next.priceEstimate,
            );
            return next;
        });
    };

    const handleDeleteMaterial = (item) => {
        if (materialItems.length <= 1) {
            Swal.fire({
                title: 'Gagal',
                text: 'Data PR minimal harus memiliki 1 material.',
                icon: 'error',
            });
            return;
        }

        Swal.fire({
            title: 'Hapus material?',
            text: 'Apakah yakin data ini dihapus?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;

            if (!purchaseRequirement?.no_pr || !item.detailNo) {
                setMaterialItems((prev) =>
                    prev.filter((it) => it.id !== item.id),
                );
                return;
            }

            router.delete(
                `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onStart: () => setDeletingMaterialId(item.detailNo || ''),
                    onError: () => setDeletingMaterialId(''),
                    onSuccess: () => {
                        setDeletingMaterialId('');
                        setMaterialItems((prev) =>
                            prev.filter((it) => it.id !== item.id),
                        );
                        if (editingId === item.id) {
                            closeEditCard();
                        }
                    },
                },
            );
        });
    };

    const shouldShowClearSisaPrButton = (item) => {
        const sisaPr = parseNumber(item.qty);
        const qty = parseNumber(item.qtyDetail);

        return sisaPr !== 0;
    };

    const handleClearSisaPr = (item) => {
        if (!purchaseRequirement?.no_pr || !item.detailNo) {
            setMaterialItems((prev) =>
                prev.map((it) =>
                    it.id === item.id
                        ? { ...it, qty: 0, originalSisaPr: 0 }
                        : it,
                ),
            );
            return;
        }

        Swal.fire({
            title: 'Update Sisa PR?',
            text: 'Sisa PR material ini akan dikembalikan ke PO In, lalu Sisa PR di PR ini diubah menjadi 0.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.put(
                `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}/clear-sisa-pr`,
                {},
                {
                    preserveScroll: true,
                    preserveState: true,
                    onStart: () => setClearingSisaPrId(item.detailNo || ''),
                    onError: () => setClearingSisaPrId(''),
                    onSuccess: () => {
                        setClearingSisaPrId('');
                        setMaterialItems((prev) =>
                            prev.map((it) =>
                                it.id === item.id
                                    ? {
                                        ...it,
                                        qtyDetail: Math.max(
                                            0,
                                            parseNumber(it.qtyDetail) -
                                            parseNumber(it.qty),
                                        ),
                                        qty: 0,
                                        originalSisaPr: 0,
                                    }
                                    : it,
                            ),
                        );
                        if (editingId === item.id) {
                            setEditingDraft((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        qtyDetail: Math.max(
                                            0,
                                            parseNumber(prev.qtyDetail) -
                                            parseNumber(prev.qty),
                                        ),
                                        qty: 0,
                                        originalSisaPr: 0,
                                    }
                                    : prev,
                            );
                        }
                    },
                },
            );
        });
    };

    const handleSaveCard = (item) => {
        if (!purchaseRequirement?.no_pr || !editingDraft) {
            return;
        }

        // For newly added items (no detailNo), commit draft to local state then trigger full submit
        if (!item.detailNo) {
            const updatedItems = materialItems.map((it) =>
                it.id === item.id ? { ...it, ...editingDraft } : it,
            );
            setMaterialItems(updatedItems);
            // We pass the updated items directly to handleSubmit or use the state if we can trust it.
            // Since setMaterialItems is async, we should probably manually construct the payload or use a useEffect.
            // But a simpler way is to just call a helper that handles the router.put with the fresh array.
            submitFullUpdate(updatedItems);
            closeEditCard();
            return;
        }

        if (parseNumber(editingDraft.qty) < 0) {
            return;
        }

        const qtyValidationMessage = getQtyValidationMessage(editingDraft);
        if (qtyValidationMessage) {
            Swal.fire({
                title: 'Gagal',
                text: qtyValidationMessage,
                icon: 'error',
            });
            return;
        }

        const payload = {
            date: formData.date,
            payment: formData.payment,
            for_customer: item.forCustomer || formData.forCustomer,
            ref_po: item.refPo || formData.refPo,
            kd_material: editingDraft.kodeMaterial,
            material: editingDraft.namaMaterial,
            qty: editingDraft.qtyDetail, // tb_detailpr.qty (raw)
            unit: editingDraft.satuan,
            stok: editingDraft.stok,
            unit_price: editingDraft.priceEstimate,
            total_price: calculateTotalPrice(
                editingDraft.qtyDetail, // qty × harga modal
                editingDraft.priceEstimate,
            ),
            price_po: editingDraft.priceInPo,
            margin: editingDraft.margin,
            renmark: editingDraft.remark,
        };

        router.put(
            `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement.no_pr)}/detail/${item.detailNo}`,
            payload,
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSavingMaterialId(item.detailNo || ''),
                onError: () => setSavingMaterialId(''),
                onSuccess: () => {
                    setSavingMaterialId('');
                    setMaterialItems((prev) =>
                        prev.map((it) =>
                            it.id === item.id
                                ? {
                                    ...it,
                                    kodeMaterial: payload.kd_material,
                                    namaMaterial: payload.material,
                                    stok: payload.stok,
                                    qtyDetail: payload.qty, // raw qty stored in tb_detailpr.qty
                                    qty: editingDraft.qty, // sisa_pr (computed frontend)
                                    originalQtyDetail: payload.qty,
                                    originalSisaPr: editingDraft.qty,
                                    satuan: payload.unit,
                                    priceEstimate: payload.unit_price,
                                    totalPrice: payload.total_price,
                                    priceInPo: payload.price_po,
                                    margin: payload.margin,
                                    remark: payload.renmark,
                                }
                                : it,
                        ),
                    );
                    closeEditCard();
                },
            },
        );
    };

    const submitFullUpdate = (itemsToSubmit) => {
        const invalidMessage = itemsToSubmit
            .map((item) => getQtyValidationMessage(item))
            .find(Boolean);

        if (invalidMessage) {
            Swal.fire({
                title: 'Gagal',
                text: invalidMessage,
                icon: 'error',
            });
            return;
        }

        setIsSubmitting(true);
        router.put(
            `/marketing/purchase-requirement/${encodeURIComponent(purchaseRequirement?.no_pr ?? '')}`,
            {
                date: formData.date,
                payment: formData.payment,
                for_customer: formData.forCustomer,
                ref_po: formData.refPo,
                jenis_pr: formData.jenisPr,
                materials: itemsToSubmit.map((item, index) => ({
                    no: index + 1,
                    kd_material: item.kodeMaterial,
                    material: item.namaMaterial,
                    qty: item.qtyDetail, // Consistent with updateDetail
                    unit: item.satuan,
                    stok: item.stok,
                    unit_price: item.priceEstimate,
                    total_price: item.totalPrice,
                    price_po: item.priceInPo,
                    margin: item.margin,
                    renmark: item.remark,
                    ref_po: item.refPo || formData.refPo,
                    for_customer: item.forCustomer || formData.forCustomer,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onError: () => setIsSubmitting(false),
                onSuccess: (page) => {
                    setIsSubmitting(false);
                },
            },
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        submitFullUpdate(materialItems);
    };

    return (
        <>
            <Head title="Edit PR" />
            <form
                className="flex h-full flex-1 flex-col gap-4 p-4"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Edit PR</h1>
                        <p className="text-sm text-muted-foreground">
                            Perbarui data PR dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                        1. Data PO Masuk
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
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
                            {(!formData.refPo || formData.refPo === forValue) && (
                                <div className="mb-2 rounded-xl border border-primary/10 bg-primary/5 p-4 md:col-span-2">
                                    <Label className="mb-3 block text-sm font-bold text-gray-700">Pilih Jenis PR:</Label>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        {[
                                            {
                                                label: 'PR For Stock',
                                                desc: 'Permintaan pembelian barang untuk menambah stok barang yang ada di gudang.',
                                            },
                                            {
                                                label: 'PR For Capital Expenditure (CapEx)',
                                                desc: 'Permintaan pembelian untuk aset/inventaris yang bernilai tinggi dan umur panjang.',
                                            },
                                            {
                                                label: 'PR For Operational Expenditure (OpEx)',
                                                desc: 'Permintaan pembelian untuk kebutuhan operasional atau barang habis pakai.',
                                            },
                                        ].map((jenisObj) => (
                                            <div key={jenisObj.label} className="flex items-start space-x-3">
                                                <Checkbox
                                                    id={`jenis-${jenisObj.label}`}
                                                    className="h-5 w-5 mt-0.5"
                                                    checked={formData.jenisPr === jenisObj.label}
                                                    onCheckedChange={(checked) => {
                                                        const newJenis = checked ? jenisObj.label : '';
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            jenisPr: newJenis,
                                                            refPo: checked ? forValue : '',
                                                            forCustomer: checked ? forValue : '',
                                                        }));
                                                    }}
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <Label
                                                        htmlFor={`jenis-${jenisObj.label}`}
                                                        className="cursor-pointer text-sm font-bold"
                                                    >
                                                        {jenisObj.label}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {jenisObj.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Date
                                </span>
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
                            {uniqueCustomerPOs.length > 1 ? (
                                <div className="space-y-2 md:col-span-2">
                                    <Label>PO In Terpilih</Label>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {uniqueCustomerPOs.map((po) => (
                                            <div
                                                key={po.ref_po}
                                                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                                            >
                                                <div>
                                                    <div className="font-medium text-sm">
                                                        {po.ref_po}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground uppercase">
                                                        {po.customer}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-md p-2 transition-colors"
                                                    title="Hapus Customer/PO"
                                                    onClick={() => handleRemoveCustomerPo(po.ref_po)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <label className="space-y-2 text-sm">
                                        <span className="text-muted-foreground">
                                            Ref PO
                                        </span>
                                        <Input
                                            value={formData.refPo}
                                            disabled
                                            onChange={(event) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    refPo: event.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="space-y-2 text-sm">
                                        <span className="text-muted-foreground">
                                            For Customer
                                        </span>
                                        <Input
                                            value={formData.forCustomer}
                                            disabled
                                            onChange={(event) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    forCustomer: event.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                </>
                            )}
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Payment
                                </span>
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
                                    <option value="Cash Trans">
                                        Cash Trans
                                    </option>
                                    <option value="Cash Tunai">
                                        Cash Tunai
                                    </option>
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
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <CardTitle>Data Material</CardTitle>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsMaterialModalOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Tambah
                                Material
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {poTabs.length > 1 && (
                                <div className="overflow-x-auto border-b">
                                    <div className="flex min-w-max gap-1">
                                        {poTabs.map((tab) => (
                                            <button
                                                key={tab.refPo}
                                                type="button"
                                                className={`border-b-2 px-4 py-3 text-left text-sm transition-colors ${activePoTab === tab.refPo
                                                    ? 'border-primary font-semibold text-primary'
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                                    }`}
                                                onClick={() => {
                                                    closeEditCard();
                                                    setActivePoTab(tab.refPo);
                                                }}
                                            >
                                                <span className="block">
                                                    {tab.refPo}
                                                </span>
                                                <span className="block max-w-48 truncate text-[11px] font-normal text-muted-foreground">
                                                    {tab.customer ||
                                                        'Tanpa customer'}{' '}
                                                    · {tab.count} material
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Search & page-size controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>Tampilkan</span>
                                    <select
                                        className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={
                                            listPageSize === Infinity
                                                ? 'all'
                                                : listPageSize
                                        }
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setListPageSize(
                                                v === 'all'
                                                    ? Infinity
                                                    : Number(v),
                                            );
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </div>
                                <div className="relative max-w-xs flex-1">
                                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="h-9 pl-9"
                                        placeholder="Cari kode atau nama material..."
                                        value={listSearch}
                                        onChange={(e) =>
                                            setListSearch(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {paginatedItems.length === 0 && (
                                <div className="rounded-xl border border-sidebar-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                    {materialItems.length === 0
                                        ? 'Belum ada material.'
                                        : 'Tidak ada material yang cocok.'}
                                </div>
                            )}

                            {paginatedItems.map((item, index) => {
                                const globalIndex = filteredItems.indexOf(item);
                                const isEditing = editingId === item.id;
                                const source =
                                    isEditing && editingDraft
                                        ? editingDraft
                                        : item;
                                const computedMargin = isEditing
                                    ? calculateMargin(
                                        source.priceInPo,
                                        source.priceEstimate,
                                    )
                                    : source.margin;

                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-sidebar-border/70 bg-card p-4"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    No. {globalIndex + 1}
                                                </p>
                                                <p className="text-sm leading-snug font-semibold">
                                                    {renderValue(
                                                        item.namaMaterial,
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Kode:{' '}
                                                    {renderValue(
                                                        item.kodeMaterial,
                                                    )}
                                                </p>
                                                {item.refPo && (
                                                    <p className="text-xs font-medium text-primary">
                                                        PO In: {item.refPo}
                                                    </p>
                                                )}
                                                {item.forCustomer && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Customer:{' '}
                                                        {item.forCustomer}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                    {[
                                                        ['G1', item.stokG1],
                                                        ['G2', item.stokG2],
                                                        ['G3', item.stokG3],
                                                        ['G4', item.stokG4],
                                                    ].map(([label, value]) => (
                                                        <span
                                                            key={label}
                                                            className="rounded-full border border-blue-100 bg-blue-50 px-2 text-[10px] font-bold text-blue-600"
                                                        >
                                                            Stok {label}:{' '}
                                                            {formatInteger(
                                                                value,
                                                            )}
                                                        </span>
                                                    ))}
                                                    <span className="flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2 text-[10px] font-bold text-green-600">
                                                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                                        Total Stok:{' '}
                                                        {formatInteger(
                                                            item.stok,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit material"
                                                    onClick={() =>
                                                        openEditCard(item)
                                                    }
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {shouldShowClearSisaPrButton(
                                                    item,
                                                ) && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Update Sisa PR menjadi 0"
                                                            disabled={
                                                                item.detailNo &&
                                                                clearingSisaPrId ===
                                                                item.detailNo
                                                            }
                                                            onClick={() =>
                                                                handleClearSisaPr(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            {item.detailNo &&
                                                                clearingSisaPrId ===
                                                                item.detailNo ? (
                                                                <Spinner className="h-4 w-4" />
                                                            ) : (
                                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                            )}
                                                        </Button>
                                                    )}
                                                {item.qtyPo <= 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Hapus material"
                                                        disabled={
                                                            item.detailNo &&
                                                            deletingMaterialId ===
                                                            item.detailNo
                                                        }
                                                        onClick={() =>
                                                            handleDeleteMaterial(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        {item.detailNo &&
                                                            deletingMaterialId ===
                                                            item.detailNo ? (
                                                            <Spinner className="h-4 w-4" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                                            <div className="grid gap-2">
                                                <Label>Margin (%)</Label>
                                                <Input
                                                    value={formatPercent(
                                                        computedMargin,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Stok</Label>
                                                <Input
                                                    value={renderValue(
                                                        source.stok,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        (isEditing
                                                            ? source.qtyDetail
                                                            : item.qtyDetail) ??
                                                        ''
                                                    }
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'qtyDetail',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Sisa PR</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={source.qty ?? ''}
                                                    disabled
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Last Rem. In</Label>
                                                <Input
                                                    value={renderValue(
                                                        source.sisaQtyPoIn,
                                                    )}
                                                    readOnly
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Satuan</Label>
                                                <Input
                                                    value={source.satuan}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'satuan',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga PO In</Label>
                                                <Input
                                                    value={renderValue(
                                                        source.priceInPo,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga Modal</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={
                                                        source.priceEstimate ??
                                                        ''
                                                    }
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'priceEstimate',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Total Price Modal</Label>
                                                <Input
                                                    value={calculateTotalPrice(
                                                        source.qtyDetail,
                                                        source.priceEstimate,
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2 xl:col-span-3">
                                                <Label>Remark</Label>
                                                <Input
                                                    value={source.remark}
                                                    readOnly={!isEditing}
                                                    onChange={(event) =>
                                                        updateDraft(
                                                            'remark',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="mt-4 flex items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={closeEditCard}
                                                >
                                                    Batal
                                                </Button>
                                                <Button
                                                    type="button"
                                                    disabled={
                                                        item.detailNo &&
                                                        savingMaterialId ===
                                                        item.detailNo
                                                    }
                                                    onClick={() =>
                                                        handleSaveCard(item)
                                                    }
                                                >
                                                    {item.detailNo &&
                                                        savingMaterialId ===
                                                        item.detailNo && (
                                                            <Spinner className="mr-2" />
                                                        )}
                                                    Simpan
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Pagination controls */}
                            {listPageSize !== Infinity &&
                                filteredItems.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {Math.min(
                                                (listCurrentPage - 1) *
                                                listPageSize +
                                                1,
                                                filteredItems.length,
                                            )}
                                            {' – '}
                                            {Math.min(
                                                listCurrentPage * listPageSize,
                                                filteredItems.length,
                                            )}{' '}
                                            dari {filteredItems.length} material
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={listCurrentPage === 1}
                                                onClick={() =>
                                                    setListCurrentPage((p) =>
                                                        Math.max(1, p - 1),
                                                    )
                                                }
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="font-medium text-foreground">
                                                {listCurrentPage} /{' '}
                                                {listTotalPages || 1}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    listCurrentPage >=
                                                    (listTotalPages || 1)
                                                }
                                                onClick={() =>
                                                    setListCurrentPage((p) =>
                                                        Math.min(
                                                            listTotalPages || p,
                                                            p + 1,
                                                        ),
                                                    )
                                                }
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                )}
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && (
                                        <Spinner className="mr-2" />
                                    )}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/marketing/purchase-requirement">
                                        Batal
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                <Dialog
                    open={isMaterialModalOpen}
                    onOpenChange={setIsMaterialModalOpen}
                >
                    <DialogContent
                        aria-describedby={undefined}
                        className="!top-0 !left-0 flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-y-auto !rounded-none border-none p-0 shadow-2xl"
                    >
                        <DialogHeader className="border-b bg-muted/30 p-6">
                            <DialogTitle className="text-xl">
                                Pilih Material
                            </DialogTitle>
                        </DialogHeader>
                        <DialogDescription className="sr-only">
                            Pilih material dari database inventory untuk PR ini.
                        </DialogDescription>

                        <div className="flex-1 space-y-6 overflow-auto p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs font-bold tracking-tighter text-muted-foreground uppercase">
                                        Per Page
                                    </Label>
                                    <select
                                        className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
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
                                        <option value="all">Semua</option>
                                    </select>
                                </div>
                                <div className="relative max-w-md flex-1">
                                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="h-10 border-sidebar-border pl-9"
                                        placeholder="Cari kode atau nama material..."
                                        value={materialSearchTerm}
                                        onChange={(event) => {
                                            setMaterialSearchTerm(
                                                event.target.value,
                                            );
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
                                            <TableHead className="text-right whitespace-nowrap">
                                                Stok G1
                                            </TableHead>
                                            <TableHead className="text-right whitespace-nowrap">
                                                Stok G2
                                            </TableHead>
                                            <TableHead className="text-right whitespace-nowrap">
                                                Stok G3
                                            </TableHead>
                                            <TableHead className="text-right whitespace-nowrap">
                                                Stok G4
                                            </TableHead>
                                            <TableHead className="text-right whitespace-nowrap">
                                                Total Stok
                                            </TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialList.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={6}
                                                    className="h-32 text-center text-muted-foreground"
                                                >
                                                    {materialLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Spinner /> Memuat
                                                            data...
                                                        </div>
                                                    ) : (
                                                        materialError ||
                                                        'Tidak ada data material.'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            materialList.map((m) => (
                                                <TableRow key={m.kd_material}>
                                                    <TableCell className="font-medium">
                                                        {m.kd_material}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {m.material}
                                                    </TableCell>
                                                    <TableCell className="text-left font-medium text-muted-foreground uppercase">
                                                        {m.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-blue-600">
                                                        {formatInteger(
                                                            m.stok_g1,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-medium text-blue-600">
                                                        {formatInteger(
                                                            m.stok_g2,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-medium text-blue-600">
                                                        {formatInteger(
                                                            m.stok_g3,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-medium text-blue-600">
                                                        {formatInteger(
                                                            m.stok_g4,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-green-600">
                                                        {formatInteger(m.stok)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-8"
                                                            onClick={async () => {
                                                                // <-- Pastikan ada keyword 'async'
                                                                let hargaModalTerakhir = 0;

                                                                // --- AMBIL HARGA TERAKHIR DARI DATABASE via AXIOS ---
                                                                try {
                                                                    const priceRes =
                                                                        await axios.get(
                                                                            '/marketing/purchase-requirement/get-last-price',
                                                                            {
                                                                                params: {
                                                                                    kd_mat: m.kd_material,
                                                                                },
                                                                            },
                                                                        );

                                                                    if (
                                                                        priceRes.data &&
                                                                        priceRes
                                                                            .data
                                                                            .success
                                                                    ) {
                                                                        // Murni mengambil kolom 'harga' dari tb_invin sesuai response backend
                                                                        hargaModalTerakhir =
                                                                            Math.round(
                                                                                Number(
                                                                                    priceRes
                                                                                        .data
                                                                                        .harga,
                                                                                ),
                                                                            ) ||
                                                                            0;
                                                                    }
                                                                } catch (error) {
                                                                    console.error(
                                                                        'Gagal autofill harga modal di edit.jsx:',
                                                                        error,
                                                                    );
                                                                    hargaModalTerakhir =
                                                                        Number(
                                                                            m.harga,
                                                                        ) || 0; // Fallback ke harga master jika API terkendala
                                                                }
                                                                // ----------------------------------------------------

                                                                // Struktur item baru yang dimasukkan ke daftar materialItems
                                                                const newItem =
                                                                {
                                                                    id: `manual-${Date.now()}`,
                                                                    detailNo:
                                                                        null, // null menandakan barang baru yang ditambahkan saat edit
                                                                    kodeMaterial:
                                                                        m.kd_material ??
                                                                        '',
                                                                    namaMaterial:
                                                                        m.material ??
                                                                        '',
                                                                    stok:
                                                                        Math.round(
                                                                            Number(
                                                                                m.stok,
                                                                            ),
                                                                        ) ||
                                                                        0,
                                                                    stokG1:
                                                                        Math.round(
                                                                            Number(
                                                                                m.stok_g1,
                                                                            ),
                                                                        ) ||
                                                                        0,
                                                                    stokG2:
                                                                        Math.round(
                                                                            Number(
                                                                                m.stok_g2,
                                                                            ),
                                                                        ) ||
                                                                        0,
                                                                    stokG3:
                                                                        Math.round(
                                                                            Number(
                                                                                m.stok_g3,
                                                                            ),
                                                                        ) ||
                                                                        0,
                                                                    stokG4:
                                                                        Math.round(
                                                                            Number(
                                                                                m.stok_g4,
                                                                            ),
                                                                        ) ||
                                                                        0,
                                                                    qty: (Number(
                                                                        m.sisa_qtypr,
                                                                    ) > 0
                                                                        ? Number(
                                                                            m.sisa_qtypr,
                                                                        )
                                                                        : 1
                                                                    ).toString(),
                                                                    qtyDetail:
                                                                        Number(
                                                                            m.sisa_qtypr,
                                                                        ) >
                                                                            0
                                                                            ? Number(
                                                                                m.sisa_qtypr,
                                                                            )
                                                                            : 1,
                                                                    originalQtyDetail: 0,
                                                                    originalSisaPr:
                                                                        Number(
                                                                            m.sisa_qtypr,
                                                                        ) >
                                                                            0
                                                                            ? Number(
                                                                                m.sisa_qtypr,
                                                                            )
                                                                            : 1,
                                                                    satuan:
                                                                        m.unit ??
                                                                        '',

                                                                    // --- SINKRONISASI AUTOFILL & BALANCE ---
                                                                    priceEstimate:
                                                                        hargaModalTerakhir, // Mengisi field Harga Modal
                                                                    priceInPo:
                                                                        hargaModalTerakhir, // Mengisi field Harga PO In agar langsung balance
                                                                    // ---------------------------------------

                                                                    totalPrice:
                                                                        Math.round(
                                                                            (Number(
                                                                                m.sisa_qtypr,
                                                                            ) >
                                                                                0
                                                                                ? Number(
                                                                                    m.sisa_qtypr,
                                                                                )
                                                                                : 1) *
                                                                            hargaModalTerakhir,
                                                                        ).toString(),
                                                                    margin: '0.00',
                                                                    remark: '',
                                                                    qtyPo: 0,
                                                                    qtyPoIn:
                                                                        Number(
                                                                            m.qty_po_in,
                                                                        ) ||
                                                                        0,
                                                                    sisaQtyPoIn:
                                                                        Number(
                                                                            m.sisa_qtypr,
                                                                        ) ||
                                                                        0,
                                                                };

                                                                // Dorong ke list material paling akhir
                                                                setMaterialItems(
                                                                    (prev) => [
                                                                        ...prev,
                                                                        newItem,
                                                                    ],
                                                                );

                                                                // Tutup modal material
                                                                setIsMaterialModalOpen(
                                                                    false,
                                                                );
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

                            {materialPageSize !== Infinity &&
                                materialTotal > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {Math.min(
                                                (materialCurrentPage - 1) *
                                                materialPageSize +
                                                1,
                                                materialTotal,
                                            )}
                                            -
                                            {Math.min(
                                                materialCurrentPage *
                                                materialPageSize,
                                                materialTotal,
                                            )}{' '}
                                            dari {materialTotal} data
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setMaterialCurrentPage(
                                                        (p) =>
                                                            Math.max(1, p - 1),
                                                    )
                                                }
                                                disabled={
                                                    materialCurrentPage === 1
                                                }
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="text-sm font-medium text-foreground">
                                                {materialCurrentPage} /{' '}
                                                {materialTotalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setMaterialCurrentPage(
                                                        (p) =>
                                                            Math.min(
                                                                materialTotalPages ||
                                                                p,
                                                                p + 1,
                                                            ),
                                                    )
                                                }
                                                disabled={
                                                    materialCurrentPage >=
                                                    materialTotalPages
                                                }
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
        </>
    );
}

PurchaseRequirementEdit.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
