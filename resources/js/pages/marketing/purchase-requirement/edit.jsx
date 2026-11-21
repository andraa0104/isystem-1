import { MenuAction } from '@/components/menu-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ClipboardList,
    CreditCard,
    FileText,
    Layers,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Edit PR', href: '/marketing/purchase-requirement' },
];

const toDate = (str) => {
    if (!str) return null;
    const parts = str.split(/[-/.]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

const getRowUrgency = (item) => {
    if (!item.delivery_date) return 'normal';
    const deliveryDateObj = toDate(item.delivery_date);
    if (!deliveryDateObj) return 'normal';

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() + 5);

    if (deliveryDateObj.getTime() <= now.getTime()) {
        return 'overdue';
    } else if (deliveryDateObj.getTime() <= limitDate.getTime()) {
        return 'soon';
    }
    return 'normal';
};

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

const formatToDdmmyyyy = (dateStr) => {
    if (!dateStr) {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}${mm}${yyyy}`;
    }
    const parts = String(dateStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}${month.padStart(2, '0')}${year}`;
    }
    const dmyParts = String(dateStr).split('.');
    if (dmyParts.length === 3 && dmyParts[2].length === 4) {
        const [day, month, year] = dmyParts;
        return `${day.padStart(2, '0')}${month.padStart(2, '0')}${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}${mm}${yyyy}`;
    }
    return '';
};

const fetchNextRefPo = async (jenisPr, dateStr, excludeNoPr = '') => {
    if (!jenisPr) return '';
    try {
        const response = await axios.get('/marketing/purchase-requirement/generate-ref-po', {
            params: {
                jenis_pr: jenisPr,
                date: dateStr,
                exclude_no_pr: excludeNoPr,
            },
        });
        if (response.data && response.data.ref_po) {
            return response.data.ref_po;
        }
    } catch (e) {
        console.error('Failed to generate ref PO:', e);
    }
    return `${jenisPr} ${formatToDdmmyyyy(dateStr)}-1`;
};

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const number = parseNumber(value);
    return `${number.toFixed(2)}%`;
};

const calculateMargin = (priceInPo, priceEstimate) => {
    const po = parseNumber(priceInPo);
    const estimate = parseNumber(priceEstimate);
    if (po <= 0 || estimate <= 0) return '';
    const margin = ((po - estimate) / po) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qty, priceEstimate) => {
    const total = parseNumber(qty) * parseNumber(priceEstimate);
    return total ? Math.round(total).toString() : '';
};

const calculateTotalStock = (item) =>
    parseNumber(item?.stokG1 ?? item?.stok_g1) +
    parseNumber(item?.stokG2 ?? item?.stok_g2) +
    parseNumber(item?.stokG3 ?? item?.stok_g3) +
    parseNumber(item?.stokG4 ?? item?.stok_g4) +
    parseNumber(item?.mis) +
    parseNumber(item?.mib) +
    parseNumber(item?.mibs) +
    parseNumber(item?.pr_outstanding) +
    parseNumber(item?.po_outstanding) -
    parseNumber(item?.do_outstanding);

const calculateCurrentRemainingOrderIn = (item) => {
    const qtyDelta =
        parseNumber(item?.qtyDetail) - parseNumber(item?.originalQtyDetail);

    return Math.max(0, parseNumber(item?.sisaQtyPoIn) - qtyDelta);
};

const calculateMaxQtyDetail = (item) =>
    parseNumber(item?.originalQtyDetail) + parseNumber(item?.sisaQtyPoIn);

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

    const dbPrefix = (tenant?.database ?? '')
        .toLowerCase()
        .replace(/^db/, '')
        .toUpperCase();
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
            mis: parseNumber(item.mis),
            mib: parseNumber(item.mib),
            mibs: parseNumber(item.mibs),
            pr_outstanding: parseNumber(item.pr_outstanding),
            po_outstanding: parseNumber(item.po_outstanding),
            do_outstanding: parseNumber(item.do_outstanding),
            qty: item.sisa_pr ?? item.qty ?? '', // Sisa PR
            qtyDetail: item.qty ?? 0, // tb_detailpr.qty
            originalQtyDetail: parseNumber(item.qty),
            originalSisaPr: parseNumber(item.sisa_pr ?? item.qty),
            satuan: item.unit ?? '',
            priceEstimate: item.unit_price ?? '',
            totalPrice: item.total_price ?? '',
            priceInPo: item.price_po ?? '',
            margin: (() => {
                const calculated = calculateMargin(item.price_po, item.unit_price);
                if (calculated !== '') return calculated;
                if (item.margin && item.margin !== '0%' && item.margin !== '0.00%') {
                    return item.margin;
                }
                return '';
            })(),
            remark: item.renmark ?? '',
            qtyPo: parseNumber(item.qty_po),
            qtyPoIn: parseNumber(item.qty_po_in),
            sisaQtyPoIn: parseNumber(item.sisa_qty_po),
            refPo: item.ref_po ?? purchaseRequirement?.ref_po ?? '',
            forCustomer:
                item.for_customer ?? purchaseRequirement?.for_customer ?? '',
            noteDoc: item.note_doc ?? '',
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
        return Array.from(map.entries()).map(([ref_po, customer]) => ({
            ref_po,
            customer,
        }));
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

                fetch(
                    `/marketing/purchase-requirement/${noPr}/remove-po/${refPo}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'X-CSRF-TOKEN': document.head.querySelector(
                                'meta[name="csrf-token"]',
                            )?.content,
                            Accept: 'application/json',
                        },
                    },
                )
                    .then((response) =>
                        response.json().then((data) => ({
                            status: response.status,
                            data,
                        })),
                    )
                    .then(({ status, data }) => {
                        if (status >= 400)
                            throw new Error(
                                data.message ||
                                'Gagal menghapus Customer dari PR',
                            );
                        Swal.fire(
                            'Terhapus!',
                            'Customer/PO berhasil dihapus dari PR.',
                            'success',
                        );

                        // Reload the edit page to fetch the remaining records cleanly from backend state
                        window.location.reload();
                    })
                    .catch((error) => {
                        Swal.fire('Gagal!', error.message, 'error');
                    });
            }
        });
    };

    // PO In Selection Modal States
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [debouncedCustomerSearchTerm, setDebouncedCustomerSearchTerm] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
    const [customerList, setCustomerList] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [poinMaterialLoading, setPoinMaterialLoading] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedCustomerSearchTerm(customerSearchTerm);
        }, 250);
        return () => clearTimeout(handler);
    }, [customerSearchTerm]);

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

    const loadCustomers = useCallback(async () => {
        setCustomerLoading(true);
        setCustomerError('');
        try {
            const params = new URLSearchParams();
            params.set(
                'per_page',
                customerPageSize === Infinity
                    ? 'all'
                    : String(customerPageSize),
            );
            params.set('page', String(customerCurrentPage));
            if (debouncedCustomerSearchTerm.trim()) {
                params.set('search', debouncedCustomerSearchTerm.trim());
            }

            const response = await fetch(
                `/marketing/purchase-requirement/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) throw new Error('Request failed');
            const data = await response.json();
            setCustomerList(Array.isArray(data?.customers) ? data.customers : []);
            setCustomerTotal(Number(data?.total ?? 0));
        } catch {
            setCustomerError('Gagal memuat data PO In.');
        } finally {
            setCustomerLoading(false);
        }
    }, [customerCurrentPage, customerPageSize, debouncedCustomerSearchTerm]);

    useEffect(() => {
        if (isCustomerModalOpen) {
            loadCustomers();
        }
    }, [isCustomerModalOpen, loadCustomers]);

    const handleSelectJenisPr = async (jenisLabel) => {
        const isCurrentlySelected = formData.jenisPr === jenisLabel;
        const nextJenis = isCurrentlySelected ? '' : jenisLabel;

        if (nextJenis) {
            setSelectedPoIns([]);
            setMaterialItems([]);
            const fallbackRefPo = `${nextJenis} ${formatToDdmmyyyy(formData.date)}-1`;
            setFormData((prev) => ({
                ...prev,
                jenisPr: nextJenis,
                refPo: fallbackRefPo,
                forCustomer: forValue,
            }));

            try {
                let nextRefPo = '';
                if (
                    purchaseRequirement?.jenis_pr === nextJenis &&
                    purchaseRequirement?.ref_po &&
                    purchaseRequirement.ref_po !== forValue
                ) {
                    nextRefPo = purchaseRequirement.ref_po;
                } else {
                    nextRefPo = await fetchNextRefPo(
                        nextJenis,
                        formData.date,
                        purchaseRequirement?.no_pr,
                    );
                }
                if (nextRefPo) {
                    setFormData((prev) => ({
                        ...prev,
                        refPo: nextRefPo,
                    }));
                }
            } catch {
                // Keep fallback
            }
        } else {
            setFormData((prev) => ({
                ...prev,
                jenisPr: '',
                refPo: '',
                forCustomer: '',
            }));
        }
    };

    const handleSelectPoIn = async (item) => {
        setPoinMaterialLoading(true);
        try {
            const params = new URLSearchParams({ kode_poin: item.kode_poin });
            const response = await fetch(
                `/marketing/purchase-requirement/poin-details?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) throw new Error('Failed to fetch PO In details');
            const data = await response.json();
            const rawItems = Array.isArray(data?.items) ? data.items : [];
            const noPoin = item.no_poin ?? '';
            const customerName = item.customer_name ?? '';
            const noteDoc = item.note_doc ?? '';

            // Update header Ref PO & For Customer if empty or single
            setFormData((prev) => ({
                ...prev,
                refPo: prev.refPo ? prev.refPo : noPoin,
                forCustomer: prev.forCustomer ? prev.forCustomer : customerName,
            }));

            // Map and add items from PO In to materialItems
            const existingKeys = new Set(
                materialItems.map(
                    (m) =>
                        `${String(m.kd_material).toLowerCase()}||${String(m.refPo || '')}`,
                ),
            );

            const newItems = [];
            rawItems.forEach((m) => {
                const key = `${String(m.kd_material).toLowerCase()}||${String(noPoin)}`;
                if (!existingKeys.has(key)) {
                    const hargaModal = Number(m.harga_modal || 0);
                    const qtyPoIn = Number(m.qty_po_in || 0);
                    const sisaQtyPoIn = Number(m.sisa_qtypr || 0);
                    const qtyVal =
                        sisaQtyPoIn > 0
                            ? sisaQtyPoIn
                            : qtyPoIn > 0
                                ? qtyPoIn
                                : 1;
                    const pricePoIn = Number(m.harga_po_in || 0);

                    newItems.push({
                        no: null, // item baru yang ditambahkan di edit
                        kd_material: m.kd_material,
                        material: m.material,
                        qty: qtyVal,
                        unit: m.satuan || '',
                        stok: Number(m.stok || 0),
                        stok_g1: Number(m.stok_g1 || 0),
                        stok_g2: Number(m.stok_g2 || 0),
                        stok_g3: Number(m.stok_g3 || 0),
                        stok_g4: Number(m.stok_g4 || 0),
                        unitPrice: hargaModal.toString(),
                        pricePo: pricePoIn.toString(),
                        totalPrice: Math.round(qtyVal * hargaModal).toString(),
                        margin: calculateMargin(pricePoIn, hargaModal),
                        remark: m.remark || '',
                        qtyPo: 0,
                        qtyPoIn: qtyPoIn,
                        sisaQtyPoIn: sisaQtyPoIn,
                        refPo: noPoin,
                        forCustomer: customerName,
                        noteDoc: noteDoc,
                    });
                }
            });

            if (newItems.length > 0) {
                setMaterialItems((prev) => [...prev, ...newItems]);
                setActivePoTab(noPoin);
                Swal.fire({
                    icon: 'success',
                    title: 'PO In Berhasil Dipilih',
                    text: `${newItems.length} material dari PO In ${noPoin} ditambahkan ke daftar.`,
                    timer: 2000,
                    showConfirmButton: false,
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'PO In Terpilih',
                    text: `Seluruh material dari PO In ${noPoin} sudah ada di daftar PR ini.`,
                });
            }

            setIsCustomerModalOpen(false);
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat PO In',
                text: err.message || 'Terjadi kesalahan saat memuat material PO In.',
            });
        } finally {
            setPoinMaterialLoading(false);
        }
    };

    // Material Selection Modal States
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [debouncedMaterialSearchTerm, setDebouncedMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState(null);
    const [activePoTab, setActivePoTab] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedMaterialSearchTerm(materialSearchTerm);
        }, 250);
        return () => clearTimeout(handler);
    }, [materialSearchTerm]);

    const materialTotalPages =
        materialPageSize === Infinity
            ? 1
            : Math.ceil(materialTotal / materialPageSize);

    const loadMaterials = useCallback(async () => {
        setMaterialLoading(true);
        setMaterialError(null);
        try {
            const params = new URLSearchParams({
                search: debouncedMaterialSearchTerm,
                per_page:
                    materialPageSize === Infinity ? 'all' : materialPageSize,
                page: materialCurrentPage,
                ref_po:
                    activePoTab && activePoTab !== 'Tanpa PO In'
                        ? activePoTab
                        : formData.refPo,
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
    }, [
        activePoTab,
        formData.refPo,
        materialCurrentPage,
        materialPageSize,
        debouncedMaterialSearchTerm,
        purchaseRequirement?.no_pr,
    ]);

    useEffect(() => {
        if (isMaterialModalOpen) {
            loadMaterials();
        }
    }, [isMaterialModalOpen, loadMaterials]);

    // List-level search & pagination (Step 2 existing items)
    const [listSearch, setListSearch] = useState('');
    const [listPageSize, setListPageSize] = useState(5);
    const [listCurrentPage, setListCurrentPage] = useState(1);
    const poTabs = useMemo(() => {
        const groups = new Map();
        materialItems.forEach((item) => {
            const refPo = item.refPo || 'Tanpa PO In';
            if (!groups.has(refPo)) {
                groups.set(refPo, {
                    refPo,
                    customer: item.forCustomer || '',
                    noteDoc: item.noteDoc || '',
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
            detailNo: item.detailNo ?? null,
            kodeMaterial: item.kodeMaterial ?? '',
            namaMaterial: item.namaMaterial ?? '',
            stok: item.stok ?? '',
            stokG1: item.stokG1 ?? 0,
            stokG2: item.stokG2 ?? 0,
            stokG3: item.stokG3 ?? 0,
            stokG4: item.stokG4 ?? 0,
            mis: item.mis ?? 0,
            mib: item.mib ?? 0,
            mibs: item.mibs ?? 0,
            pr_outstanding: item.pr_outstanding ?? 0,
            po_outstanding: item.po_outstanding ?? 0,
            do_outstanding: item.do_outstanding ?? 0,
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

        const nextQty = parseNumber(source.qtyDetail);
        const qtyPo = parseNumber(source.qtyPo);
        const maxQty = calculateMaxQtyDetail(source);
        const isNewDetail =
            source.detailNo === null || source.detailNo === undefined;

        if (formData.jenisPr || isNewDetail) {
            return nextQty > 0 ? '' : 'Qty PR harus lebih dari 0.';
        }

        if (nextQty < qtyPo) {
            return `Qty hanya boleh dikurangi sampai Sisa PR = 0. Minimal qty adalah ${formatNumber(qtyPo)}.`;
        }

        if (nextQty > maxQty) {
            return `Qty PR tidak boleh melebihi qty awal + sisa qty PO In. Maksimal qty adalah ${formatNumber(maxQty)}.`;
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

            // When Qty changes → auto-recalc Sisa PR = max(0, qty - stok)
            if (field === 'qtyDetail') {
                const requestedQty = parseFloat(value) || 0;
                const qtyPo = parseFloat(next.qtyPo) || 0;
                const isNewDetail =
                    next.detailNo === null || next.detailNo === undefined;
                const maxQty = calculateMaxQtyDetail(next);
                const qty =
                    formData.jenisPr || isNewDetail
                        ? requestedQty
                        : Math.min(requestedQty, maxQty);
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
                    ref_po: formData.jenisPr ? formData.refPo : (item.refPo || formData.refPo),
                    for_customer: formData.jenisPr ? formData.forCustomer : (item.forCustomer || formData.forCustomer),
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
                onError: (errors) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errors)[0];
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        timer: 3000,
                        showConfirmButton: false,
                        icon: 'error',
                        title: firstError || 'Gagal menyimpan perubahan.',
                    });
                },
                onSuccess: (page) => {
                    if (page?.props?.flash?.error) {
                        setIsSubmitting(false);
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            timer: 3000,
                            showConfirmButton: false,
                            icon: 'error',
                            title: page.props.flash.error,
                        });
                    } else if (page?.props?.flash?.success) {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            timer: 3000,
                            showConfirmButton: false,
                            icon: 'success',
                            title: page.props.flash.success,
                        });
                    }
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
                className="w-full min-w-0 space-y-5 p-4 sm:p-6 text-foreground"
                style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif" }}
                onSubmit={handleSubmit}
            >
                {/* Modern Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <ClipboardList className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                Edit Purchase Requirement
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Perbarui data pengajuan kebutuhan pembelian barang (PR)
                            </p>
                        </div>
                    </div>

                    {/* Step Navigator Pills */}
                    <div className="flex items-center gap-2 self-start sm:self-auto p-1 rounded-xl bg-muted/50 border border-border">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className={cn(
                                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                step === 1
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                        >
                            <span className={cn(
                                'flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold',
                                step === 1 ? 'bg-white/20 text-white' : 'bg-muted-foreground/20 text-muted-foreground'
                            )}>
                                1
                            </span>
                            Data PO Masuk
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep(2)}
                            className={cn(
                                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                step === 2
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                        >
                            <span className={cn(
                                'flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold',
                                step === 2 ? 'bg-white/20 text-white' : 'bg-muted-foreground/20 text-muted-foreground'
                            )}>
                                2
                            </span>
                            Data Material
                            {materialItems.length > 0 && (
                                <span className={cn(
                                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums',
                                    step === 2 ? 'bg-white text-emerald-700' : 'bg-muted-foreground/20 text-foreground'
                                )}>
                                    {materialItems.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* STEP 1: DATA PO MASUK */}
                {step === 1 && (
                    <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                        <CardHeader className="border-b border-border bg-muted/20 px-4 py-3.5 sm:px-6 sm:py-4">
                            <div className="flex items-center gap-2.5">
                                <FileText className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                                        Data PO Masuk & Pengaturan PR
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Perbarui jenis pengajuan PR atau referensi PO Masuk Customer
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-6">
                            {/* Option Cards: Jenis PR */}
                            {(!formData.refPo ||
                                formData.refPo === forValue ||
                                formData.jenisPr ||
                                uniqueCustomerPOs.length === 0) && (
                                    <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                                        <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                            Pilih Jenis PR (Internal / Non-Customer):
                                        </Label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {[
                                                {
                                                    label: 'PR For Stock',
                                                    desc: 'Permintaan pembelian barang untuk menambah stok persediaan gudang.',
                                                },
                                                {
                                                    label: 'PR For Capital Expenditure (CapEx)',
                                                    desc: 'Pembelian aset/inventaris bernilai tinggi dan berumur panjang.',
                                                },
                                                {
                                                    label: 'PR For Operational Expenditure (OpEx)',
                                                    desc: 'Pembelian kebutuhan operasional rutin atau barang habis pakai.',
                                                },
                                            ].map((jenisObj) => {
                                                const isSelected = formData.jenisPr === jenisObj.label;
                                                return (
                                                    <div
                                                        key={jenisObj.label}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => handleSelectJenisPr(jenisObj.label)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                handleSelectJenisPr(jenisObj.label);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all text-left',
                                                            isSelected
                                                                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs'
                                                                : 'border-border bg-card hover:border-border/80 hover:bg-muted/40'
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                'flex size-5 shrink-0 items-center justify-center rounded-md border transition-all mt-0.5',
                                                                isSelected
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                                                    : 'border-input bg-background'
                                                            )}
                                                        >
                                                            {isSelected && <Check className="size-3.5 stroke-[3]" />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="text-xs sm:text-sm font-bold text-foreground block">
                                                                {jenisObj.label}
                                                            </span>
                                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                                {jenisObj.desc}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                        {/* Form Input Fields Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                                            {/* Tanggal PR (Diperkecil lebarnya) */}
                                            <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
                                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                    <Calendar className="size-3.5 text-muted-foreground" />
                                                    Tanggal PR
                                                </Label>
                                                <Input
                                                    type="date"
                                                    className="h-10 rounded-lg text-sm font-medium"
                                                    value={formData.date}
                                                    onChange={async (event) => {
                                                        const newDate = event.target.value;
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            date: newDate,
                                                        }));
                                                        if (formData.jenisPr) {
                                                            const nextRefPo = await fetchNextRefPo(
                                                                formData.jenisPr,
                                                                newDate,
                                                                purchaseRequirement?.no_pr,
                                                            );
                                                            if (nextRefPo) {
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    refPo: nextRefPo,
                                                                }));
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {/* Multi-customer PO In or Single PO In */}
                                            {uniqueCustomerPOs.length > 1 ? (
                                                <div className="space-y-2 sm:col-span-2 lg:col-span-8">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                                            PO In Terpilih ({uniqueCustomerPOs.length}):
                                                        </Label>
                                                        <MenuAction
                                                            action="update"
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 rounded-lg text-xs font-semibold"
                                                            onClick={() => {
                                                                setIsCustomerModalOpen(true);
                                                                setCustomerCurrentPage(1);
                                                                setCustomerSearchTerm('');
                                                            }}
                                                        >
                                                            <Plus className="mr-1 size-3.5" /> Tambah PO In
                                                        </MenuAction>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {uniqueCustomerPOs.map((po) => (
                                                            <div
                                                                key={po.ref_po}
                                                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3 hover:border-emerald-500/30 transition-colors"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                                                                        {po.ref_po}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground uppercase truncate">
                                                                        {po.customer}
                                                                    </div>
                                                                </div>
                                                                <MenuAction
                                                                    action="delete"
                                                                    as="button"
                                                                    type="button"
                                                                    className="size-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                                                                    title="Hapus Customer/PO"
                                                                    onClick={() => handleRemoveCustomerPo(po.ref_po)}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </MenuAction>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="space-y-1.5 sm:col-span-1 lg:col-span-4">
                                                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                            <FileText className="size-3.5 text-muted-foreground" />
                                                            Ref PO
                                                        </Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={formData.refPo}
                                                                readOnly={!formData.jenisPr}
                                                                className="h-10 rounded-lg text-sm font-medium flex-1"
                                                                onChange={(event) =>
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        refPo: event.target.value,
                                                                    }))
                                                                }
                                                            />
                                                            {!formData.jenisPr && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="h-10 px-4 rounded-lg font-semibold shrink-0"
                                                                    onClick={() => {
                                                                        setIsCustomerModalOpen(true);
                                                                        setCustomerCurrentPage(1);
                                                                        setCustomerSearchTerm('');
                                                                    }}
                                                                >
                                                                    Pilih PO In
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 sm:col-span-1 lg:col-span-4">
                                                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                            <Building2 className="size-3.5 text-muted-foreground" />
                                                            For Customer
                                                        </Label>
                                                        <Input
                                                            className="h-10 rounded-lg text-sm font-medium bg-muted/40"
                                                            value={formData.forCustomer}
                                                            disabled
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* Payment Method (Diperkecil lebarnya) */}
                                            <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
                                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                    <CreditCard className="size-3.5 text-muted-foreground" />
                                                    Metode Pembayaran
                                                </Label>
                                                <select
                                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                    value={formData.payment}
                                                    onChange={(event) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            payment: event.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="Cash Trans">Cash Trans</option>
                                                    <option value="Cash Tunai">Cash Tunai</option>
                                                    <option value="Credit">Credit</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Action Bar Bottom of Step 1 */}
                                        <div className="flex justify-end pt-4 border-t border-border">
                                            <Button
                                                type="button"
                                                onClick={() => setStep(2)}
                                                className="h-10 px-6 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                            >
                                                Lanjut ke Data Material
                                                <ArrowLeft className="size-4 ml-2 rotate-180" />
                                            </Button>
                                        </div>
                                    </CardContent>
                    </Card>
                )}

                {/* STEP 2: DATA MATERIAL */}
                {step === 2 && (
                    <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                        <CardHeader className="border-b border-border bg-muted/20 px-4 py-3.5 sm:px-6 sm:py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <Layers className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                            Data Material PR
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                {materialItems.length} Material
                                            </span>
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Kelola detail kebutuhan dan estimasi harga barang
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-9 rounded-lg text-xs font-semibold"
                                        onClick={() => {
                                            setIsCustomerModalOpen(true);
                                            setCustomerCurrentPage(1);
                                            setCustomerSearchTerm('');
                                        }}
                                    >
                                        <Search className="mr-1.5 size-3.5" /> Pilih PO In
                                    </Button>
                                    <MenuAction
                                        action="update"
                                        type="button"
                                        size="sm"
                                        className="h-9 rounded-lg text-xs font-bold bg-[#059669] hover:bg-[#047857] text-[#ffffff] text-white shadow-sm"
                                        style={{ backgroundColor: '#059669', color: '#ffffff' }}
                                        onClick={() => setIsMaterialModalOpen(true)}
                                    >
                                        <Plus className="mr-1.5 size-3.5" /> Tambah Material
                                    </MenuAction>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-6">
                            {/* Horizontal Tabs for Multi-PO In */}
                            {poTabs.length > 1 && (
                                <div className="overflow-x-auto border-b border-border pb-1">
                                    <div className="flex min-w-max gap-2">
                                        {poTabs.map((tab) => (
                                            <button
                                                key={tab.refPo}
                                                type="button"
                                                className={cn(
                                                    'px-3.5 py-2 rounded-xl text-left text-xs font-semibold transition-all border',
                                                    activePoTab === tab.refPo
                                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-xs'
                                                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                                )}
                                                onClick={() => {
                                                    closeEditCard();
                                                    setActivePoTab(tab.refPo);
                                                }}
                                            >
                                                <span className="block font-bold">{tab.refPo}</span>
                                                <span className="block max-w-44 truncate text-[10px] font-normal text-muted-foreground">
                                                    {tab.customer || 'Tanpa customer'} · {tab.count} material
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Document Note */}
                            {activePoTab && activePoTab !== 'Tanpa PO In' && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                                    <p className="font-bold flex items-center gap-1.5">
                                        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                                        Catatan Dokumen PO:
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap pl-5 text-muted-foreground">
                                        {poTabs.find((tab) => tab.refPo === activePoTab)?.noteDoc || '-'}
                                    </p>
                                </div>
                            )}

                            {/* Search & Page Size Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <label className="flex items-center gap-2">
                                    <span>Tampilkan:</span>
                                    <select
                                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                                        value={listPageSize === Infinity ? 'all' : listPageSize}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setListPageSize(v === 'all' ? Infinity : Number(v));
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </label>
                                <div className="relative max-w-sm flex-1">
                                    <Search className="absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
                                    <Input
                                        className="h-9 pl-9 rounded-lg text-xs"
                                        placeholder="Cari kode atau nama material..."
                                        value={listSearch}
                                        onChange={(e) => setListSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Empty State */}
                            {paginatedItems.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border text-center">
                                    <div className="p-3 rounded-full bg-muted/50 mb-3 text-muted-foreground">
                                        <Search className="size-6" />
                                    </div>
                                    <p className="text-sm font-bold text-foreground uppercase tracking-wider">
                                        {materialItems.length === 0 ? 'Belum Ada Material' : 'Tidak Ada Material Yang Cocok'}
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                        {materialItems.length === 0
                                            ? 'Tambahkan material baru dengan klik tombol Tambah Material atau Pilih PO In.'
                                            : 'Coba ubah kata kunci pencarian Anda.'}
                                    </p>
                                </div>
                            )}

                            {/* Material Cards List (Safe for 720px width & all screens) */}
                            <div className="space-y-4">
                                {paginatedItems.map((item, index) => {
                                    const globalIndex = filteredItems.indexOf(item);
                                    const isEditing = editingId === item.id;
                                    const source = isEditing && editingDraft ? editingDraft : item;
                                    const computedMargin = isEditing
                                        ? calculateMargin(source.priceInPo, source.priceEstimate)
                                        : (source.margin !== '' && source.margin !== null && source.margin !== undefined && source.margin !== '0%' && source.margin !== '0.00%'
                                            ? source.margin
                                            : calculateMargin(source.priceInPo, source.priceEstimate));

                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4 transition-all',
                                                isEditing
                                                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
                                                    : 'border-border hover:border-emerald-500/30'
                                            )}
                                        >
                                            {/* Item Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1.5 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground tabular-nums">
                                                            #{globalIndex + 1}
                                                        </span>
                                                        <h4 className="font-bold text-sm sm:text-base text-foreground break-words">
                                                            {renderValue(item.namaMaterial)}
                                                        </h4>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                        <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                                                            {renderValue(item.kodeMaterial)}
                                                        </span>
                                                        {item.refPo && (
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                                                                PO: {item.refPo}
                                                            </span>
                                                        )}
                                                        {item.forCustomer && (
                                                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                                                {item.forCustomer}
                                                            </span>
                                                        )}
                                                        {item.satuan && (
                                                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium uppercase">
                                                                {item.satuan}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Header Action Buttons */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <MenuAction
                                                        action="update"
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 rounded-lg text-foreground hover:bg-muted"
                                                        title="Edit material"
                                                        onClick={() => openEditCard(item)}
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </MenuAction>
                                                    {shouldShowClearSisaPrButton(item) && (
                                                        <MenuAction
                                                            action="update"
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-50"
                                                            title="Update Sisa PR menjadi 0"
                                                            disabled={item.detailNo && clearingSisaPrId === item.detailNo}
                                                            onClick={() => handleClearSisaPr(item)}
                                                        >
                                                            {item.detailNo && clearingSisaPrId === item.detailNo ? (
                                                                <Spinner className="size-3.5" />
                                                            ) : (
                                                                <CheckCircle2 className="size-3.5" />
                                                            )}
                                                        </MenuAction>
                                                    )}
                                                    {item.qtyPo <= 0 && (
                                                        <MenuAction
                                                            action="delete"
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                                                            title="Hapus material"
                                                            disabled={item.detailNo && deletingMaterialId === item.detailNo}
                                                            onClick={() => handleDeleteMaterial(item)}
                                                        >
                                                            {item.detailNo && deletingMaterialId === item.detailNo ? (
                                                                <Spinner className="size-3.5" />
                                                            ) : (
                                                                <Trash2 className="size-3.5" />
                                                            )}
                                                        </MenuAction>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stock Breakdown Chips Container */}
                                            <div className="flex flex-wrap items-center gap-2 pt-1.5">
                                                {[
                                                    ['G1', item.stokG1],
                                                    ['G2', item.stokG2],
                                                    ['G3', item.stokG3],
                                                    ['G4', item.stokG4],
                                                    ['MIS', item.mis ?? 0],
                                                    ['MIB', item.mib ?? 0],
                                                    ['MIBS', item.mibs ?? 0],
                                                    ['QTY PR OUT', item.pr_outstanding ?? 0],
                                                    ['QTY PO OUT', item.po_outstanding ?? 0],
                                                ].map(([label, value]) => (
                                                    <span
                                                        key={label}
                                                        className="inline-flex items-center rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-2xs"
                                                    >
                                                        {label}:{' '}
                                                        <strong className="ml-1 text-foreground tabular-nums text-xs sm:text-sm font-bold">
                                                            {formatInteger(value)}
                                                        </strong>
                                                    </span>
                                                ))}
                                                <span className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-2xs">
                                                    DO BELUM DIBUAT:{' '}
                                                    <strong className="ml-1 tabular-nums text-xs sm:text-sm font-extrabold">
                                                        {formatInteger(item.do_outstanding ?? 0)}
                                                    </strong>
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                                                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    {calculateTotalStock(item) < 0 ? 'KREDIT DO:' : 'TOTAL / SELISIH:'}{' '}
                                                    <strong className="tabular-nums text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                                                        {formatInteger(calculateTotalStock(item))}
                                                    </strong>
                                                </span>
                                            </div>

                                            {/* Responsive Form Grid (Clean on 720px width & all screens) */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                                                {/* Qty PR */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        INPUT QTY PR <span className="text-destructive">*</span>
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max={
                                                            formData.jenisPr || source.detailNo === null || source.detailNo === undefined
                                                                ? undefined
                                                                : calculateMaxQtyDetail(source)
                                                        }
                                                        className={cn(
                                                            'h-10 text-right font-bold text-base sm:text-lg tabular-nums',
                                                            isEditing ? 'bg-background' : 'bg-muted/40 cursor-not-allowed'
                                                        )}
                                                        value={(isEditing ? source.qtyDetail : item.qtyDetail) ?? ''}
                                                        readOnly={!isEditing}
                                                        onChange={(event) => updateDraft('qtyDetail', event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                if (isEditing) {
                                                                    saveEditCard(item);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                {/* Satuan */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        Satuan
                                                    </Label>
                                                    <Input
                                                        className={cn(
                                                            'h-10 text-center text-xs sm:text-sm font-bold uppercase',
                                                            isEditing ? 'bg-background' : 'bg-muted/40 cursor-not-allowed'
                                                        )}
                                                        value={source.satuan}
                                                        readOnly={!isEditing}
                                                        onChange={(event) => updateDraft('satuan', event.target.value)}
                                                    />
                                                </div>

                                                {/* Harga PO In */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        Harga PO In
                                                    </Label>
                                                    <Input
                                                        className="h-10 text-right font-bold text-xs sm:text-sm bg-muted/40 tabular-nums cursor-not-allowed"
                                                        value={renderValue(source.priceInPo)}
                                                        readOnly
                                                    />
                                                </div>

                                                {/* Harga Modal */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        HARGA MODAL EST.
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        className={cn(
                                                            'h-10 text-right font-bold text-base sm:text-lg tabular-nums',
                                                            isEditing ? 'bg-background' : 'bg-muted/40 cursor-not-allowed'
                                                        )}
                                                        value={source.priceEstimate ?? ''}
                                                        readOnly={!isEditing}
                                                        onChange={(event) => updateDraft('priceEstimate', event.target.value)}
                                                    />
                                                </div>

                                                {/* Sisa PR (Sisa Last) */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        SISA LAST
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        className="h-10 text-right font-bold text-xs sm:text-sm bg-muted/40 tabular-nums cursor-not-allowed"
                                                        value={source.qty ?? ''}
                                                        disabled
                                                    />
                                                </div>

                                                {/* Total Price Modal */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                        TOTAL MODAL
                                                    </Label>
                                                    <Input
                                                        className="h-10 text-right font-bold text-xs sm:text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 tabular-nums cursor-not-allowed"
                                                        value={calculateTotalPrice(source.qtyDetail, source.priceEstimate)}
                                                        readOnly
                                                    />
                                                </div>

                                                {/* Metrics Mini-Row: Sisa Last, Sisa Now, Margin */}
                                                <div className="col-span-2 sm:col-span-3 lg:col-span-6 grid grid-cols-3 gap-2.5 pt-1">
                                                    <div className="p-2 rounded-lg border border-border bg-muted/20 text-xs">
                                                        <span className="text-[10px] font-bold text-muted-foreground block uppercase">Sisa Last:</span>
                                                        <strong className="text-foreground tabular-nums text-xs sm:text-sm font-bold">{renderValue(source.sisaQtyPoIn)}</strong>
                                                    </div>
                                                    <div className="p-2 rounded-lg border border-border bg-muted/20 text-xs">
                                                        <span className="text-[10px] font-bold text-muted-foreground block uppercase">Sisa Now:</span>
                                                        <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums text-xs sm:text-sm font-extrabold">{formatNumber(calculateCurrentRemainingOrderIn(source))}</strong>
                                                    </div>
                                                    <div className="p-2 rounded-lg border border-border bg-muted/20 text-xs">
                                                        <span className="text-[10px] font-bold text-muted-foreground block uppercase">Margin (%):</span>
                                                        <strong className={cn(
                                                            'tabular-nums font-semibold',
                                                            parseNumber(computedMargin) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                                                        )}>
                                                            {formatPercent(computedMargin)}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {/* Remark Field */}
                                                <div className="col-span-2 sm:col-span-3 lg:col-span-6 space-y-1 pt-1">
                                                    <Label className="text-[11px] font-semibold text-muted-foreground">
                                                        Remark / Catatan Material
                                                    </Label>
                                                    <Input
                                                        className={cn(
                                                            'h-9 text-xs',
                                                            isEditing ? 'bg-background' : 'bg-muted/40 cursor-not-allowed'
                                                        )}
                                                        placeholder="Catatan material..."
                                                        value={source.remark}
                                                        readOnly={!isEditing}
                                                        onChange={(event) => updateDraft('remark', event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                if (isEditing) {
                                                                    saveEditCard(item);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Edit Action Bar for this item */}
                                            {isEditing && (
                                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-lg text-xs"
                                                        onClick={closeEditCard}
                                                    >
                                                        Batal
                                                    </Button>
                                                    <MenuAction
                                                        action="update"
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        disabled={item.detailNo && savingMaterialId === item.detailNo}
                                                        onClick={() => handleSaveCard(item)}
                                                    >
                                                        {item.detailNo && savingMaterialId === item.detailNo && (
                                                            <Spinner className="mr-1.5 size-3.5" />
                                                        )}
                                                        Simpan Perubahan Item
                                                    </MenuAction>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination Controls */}
                            {listPageSize !== Infinity && filteredItems.length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                                    <span>
                                        Menampilkan {Math.min((listCurrentPage - 1) * listPageSize + 1, filteredItems.length)} –{' '}
                                        {Math.min(listCurrentPage * listPageSize, filteredItems.length)} dari {filteredItems.length} material
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={listCurrentPage === 1}
                                            onClick={() => setListCurrentPage((p) => Math.max(1, p - 1))}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="font-semibold text-foreground">
                                            {listCurrentPage} / {listTotalPages || 1}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={listCurrentPage >= (listTotalPages || 1)}
                                            onClick={() => setListCurrentPage((p) => Math.min(listTotalPages || p, p + 1))}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        {/* Footer Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 border-t border-border bg-muted/10">
                            <Button
                                variant="outline"
                                type="button"
                                className="h-10 px-5 rounded-lg text-xs font-semibold"
                                onClick={() => setStep(1)}
                            >
                                <ArrowLeft className="mr-1.5 size-4" />
                                Langkah 1
                            </Button>
                            <div className="flex items-center gap-2">
                                <MenuAction
                                    action="update"
                                    type="submit"
                                    className="h-10 px-6 rounded-lg font-bold bg-[#059669] hover:bg-[#047857] text-[#ffffff] text-white shadow-sm"
                                    style={{ backgroundColor: '#059669', color: '#ffffff' }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Spinner className="mr-2 size-4" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-1.5 size-4" />
                                            Simpan Perubahan PR
                                        </>
                                    )}
                                </MenuAction>
                                <Button variant="outline" asChild className="h-10 px-4 rounded-lg text-xs">
                                    <Link href="/marketing/purchase-requirement">Batal</Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* MODAL PILIH MATERIAL INVENTORY */}
                <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
                    <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[1400px] max-h-[92vh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl">
                        <DialogHeader className="border-b border-border pb-3">
                            <DialogTitle className="text-lg font-bold text-foreground">
                                Pilih Material Inventory
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Pilih material dari master data inventori untuk ditambahkan ke PR ini
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <label className="flex items-center gap-2">
                                    <span>Per Page:</span>
                                    <select
                                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                                        value={materialPageSize === Infinity ? 'all' : materialPageSize}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setMaterialPageSize(value === 'all' ? Infinity : Number(value));
                                            setMaterialCurrentPage(1);
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </label>
                                <div className="relative max-w-sm flex-1">
                                    <Search className="absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
                                    <Input
                                        className="h-9 pl-9 rounded-lg text-xs"
                                        placeholder="Cari kode atau nama material..."
                                        value={materialSearchTerm}
                                        onChange={(event) => {
                                            setMaterialSearchTerm(event.target.value);
                                            setMaterialCurrentPage(1);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-border">
                                <Table className="text-xs">
                                    <TableHeader className="bg-muted/40 font-semibold uppercase text-muted-foreground">
                                        <TableRow>
                                            <TableHead className="py-2.5">Kode Material</TableHead>
                                            <TableHead className="py-2.5">Nama Material</TableHead>
                                            <TableHead className="py-2.5 text-center">Unit</TableHead>
                                            <TableHead className="py-2.5 text-right">Stok</TableHead>
                                            <TableHead className="py-2.5 text-center w-20">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-border">
                                        {materialList.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                                                    {materialLoading ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Spinner className="size-4" /> Memuat data material...
                                                        </div>
                                                    ) : (
                                                        materialError || 'Tidak ada data material.'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            materialList.map((m) => (
                                                <TableRow key={m.kd_material} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="py-2.5 font-medium text-foreground">
                                                        {m.kd_material}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 font-semibold text-foreground">
                                                        {m.material}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-center uppercase font-medium text-muted-foreground">
                                                        {m.unit}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-right font-bold tabular-nums">
                                                        {m.stok}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-center">
                                                        <Button
                                                            size="sm"
                                                            className="h-8 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            onClick={async () => {
                                                                let hargaModalTerakhir = Number(m.harga_modal ?? 0);
                                                                if (hargaModalTerakhir <= 0) {
                                                                    try {
                                                                        const priceRes = await axios.get(
                                                                            '/marketing/purchase-requirement/get-last-price',
                                                                            { params: { kd_mat: m.kd_material } },
                                                                        );
                                                                        if (priceRes.data && priceRes.data.success) {
                                                                            hargaModalTerakhir =
                                                                                Math.round(
                                                                                    Number(
                                                                                        priceRes.data.harga ||
                                                                                        priceRes.data.last_price,
                                                                                    ),
                                                                                ) || 0;
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Gagal autofill harga modal di edit.jsx:', error);
                                                                        hargaModalTerakhir = Number(m.harga) || 0;
                                                                    }
                                                                }

                                                                const newItem = {
                                                                    id: `manual-${Date.now()}`,
                                                                    detailNo: null,
                                                                    kodeMaterial: m.kd_material ?? '',
                                                                    namaMaterial: m.material ?? '',
                                                                    stok: Math.round(Number(m.stok)) || 0,
                                                                    stokG1: Math.round(Number(m.stok_g1)) || 0,
                                                                    stokG2: Math.round(Number(m.stok_g2)) || 0,
                                                                    stokG3: Math.round(Number(m.stok_g3)) || 0,
                                                                    stokG4: Math.round(Number(m.stok_g4)) || 0,
                                                                    mis: Number(m.mis) || 0,
                                                                    mib: Number(m.mib) || 0,
                                                                    mibs: Number(m.mibs) || 0,
                                                                    pr_outstanding: Number(m.pr_outstanding) || 0,
                                                                    po_outstanding: Number(m.po_outstanding) || 0,
                                                                    do_outstanding: Number(m.do_outstanding) || 0,
                                                                    qty: (Number(m.sisa_qtypr) > 0 ? Number(m.sisa_qtypr) : 1).toString(),
                                                                    qtyDetail: Number(m.sisa_qtypr) > 0 ? Number(m.sisa_qtypr) : 1,
                                                                    originalQtyDetail: 0,
                                                                    originalSisaPr: Number(m.sisa_qtypr) > 0 ? Number(m.sisa_qtypr) : 1,
                                                                    satuan: m.unit ?? '',
                                                                    priceEstimate: hargaModalTerakhir,
                                                                    priceInPo: Number(m.harga) || 0,
                                                                    totalPrice: Math.round(
                                                                        (Number(m.sisa_qtypr) > 0 ? Number(m.sisa_qtypr) : 1) * hargaModalTerakhir,
                                                                    ).toString(),
                                                                    margin: calculateMargin(m.harga, hargaModalTerakhir),
                                                                    remark: '',
                                                                    qtyPo: 0,
                                                                    qtyPoIn: Number(m.qty_po_in) || 0,
                                                                    sisaQtyPoIn: Number(m.sisa_qtypr) || 0,
                                                                    refPo:
                                                                        activePoTab && activePoTab !== 'Tanpa PO In'
                                                                            ? activePoTab
                                                                            : formData.refPo,
                                                                    forCustomer:
                                                                        poTabs.find((tab) => tab.refPo === activePoTab)?.customer ||
                                                                        formData.forCustomer,
                                                                };

                                                                newItem.stok = calculateTotalStock(newItem);

                                                                setMaterialItems((current) => [...current, newItem]);
                                                                setIsMaterialModalOpen(false);

                                                                openEditCardDirect(newItem);

                                                                setTimeout(() => {
                                                                    Swal.fire({
                                                                        icon: 'success',
                                                                        title: 'Material Ditambahkan',
                                                                        text: `${newItem.namaMaterial} berhasil ditambahkan ke daftar. Silakan periksa estimasi harga & qty.`,
                                                                        timer: 2000,
                                                                        showConfirmButton: false,
                                                                    });
                                                                }, 300);
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

                            {/* Pagination */}
                            {materialPageSize !== Infinity && materialTotal > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                                    <span>
                                        Menampilkan {Math.min((materialCurrentPage - 1) * materialPageSize + 1, materialTotal)} -{' '}
                                        {Math.min(materialCurrentPage * materialPageSize, materialTotal)} dari {materialTotal} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            onClick={() => setMaterialCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={materialCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="font-medium text-foreground">
                                            {materialCurrentPage} / {materialTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            onClick={() => setMaterialCurrentPage((p) => Math.min(materialTotalPages, p + 1))}
                                            disabled={materialCurrentPage >= materialTotalPages}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* MODAL PILIH PO IN */}
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
                    <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[1400px] max-h-[92vh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl">
                        <DialogHeader className="border-b border-border pb-3">
                            <DialogTitle className="text-lg font-bold text-foreground">
                                Pilih PO In Customer
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Pilih PO In untuk menambahkan material dari PO In ke PR ini
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <label className="flex items-center gap-2">
                                    <span>Tampilkan:</span>
                                    <select
                                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                                        value={customerPageSize === Infinity ? 'all' : customerPageSize}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setCustomerPageSize(value === 'all' ? Infinity : Number(value));
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
                                <div className="flex items-center gap-2 flex-1 max-w-sm">
                                    <Input
                                        type="search"
                                        className="h-9 rounded-lg text-xs"
                                        placeholder="Cari kode PO In, no PO In, customer..."
                                        value={customerSearchTerm}
                                        onChange={(event) => {
                                            setCustomerSearchTerm(event.target.value);
                                            setCustomerCurrentPage(1);
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9 rounded-lg text-xs shrink-0"
                                        onClick={loadCustomers}
                                    >
                                        <RefreshCw className="size-3.5 mr-1" />
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-border">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/40 font-semibold uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-3.5 py-2.5 text-left">Kode PO In</th>
                                            <th className="px-3.5 py-2.5 text-left">No PO In</th>
                                            <th className="px-3.5 py-2.5 text-left">Tanggal</th>
                                            <th className="px-3.5 py-2.5 text-left">Customer</th>
                                            <th className="px-3.5 py-2.5 text-center w-20">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {customerList.length === 0 && (
                                            <tr>
                                                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                                                    {customerLoading ? 'Memuat data PO In...' : customerError || 'Tidak ada data PO In.'}
                                                </td>
                                            </tr>
                                        )}
                                        {customerList.map((item) => {
                                            const urgency = getRowUrgency(item);
                                            return (
                                                <tr
                                                    key={`${item.kode_poin}-${item.no_poin}`}
                                                    className={cn(
                                                        'hover:bg-muted/30 transition-colors',
                                                        urgency === 'overdue'
                                                            ? 'bg-red-500/5'
                                                            : urgency === 'soon'
                                                                ? 'bg-yellow-500/5'
                                                                : ''
                                                    )}
                                                >
                                                    <td className="px-3.5 py-2.5 font-medium text-foreground">
                                                        {renderValue(item.kode_poin)}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-semibold text-foreground">
                                                        {renderValue(item.no_poin)}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-muted-foreground">
                                                        {renderValue(item.date_poin)}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-medium text-foreground">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span>{renderValue(item.customer_name)}</span>
                                                            {urgency !== 'normal' && (
                                                                <span
                                                                    className={cn(
                                                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                                                        urgency === 'overdue'
                                                                            ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                                                            : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                                                                    )}
                                                                >
                                                                    <span className={cn('size-1.5 rounded-full', urgency === 'overdue' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500')} />
                                                                    SEGERA DIKIRIM
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 rounded-lg text-xs"
                                                            onClick={() => handleSelectPoIn(item)}
                                                        >
                                                            Pilih
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {customerPageSize !== Infinity && customerTotal > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
                                    <span>
                                        Menampilkan {Math.min((customerCurrentPage - 1) * customerPageSize + 1, customerTotal)} -{' '}
                                        {Math.min(customerCurrentPage * customerPageSize, customerTotal)} dari {customerTotal} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={customerCurrentPage === 1}
                                            onClick={() => setCustomerCurrentPage((p) => Math.max(1, p - 1))}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="font-medium text-foreground">
                                            {customerCurrentPage} / {customerTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={customerCurrentPage >= customerTotalPages}
                                            onClick={() => setCustomerCurrentPage((p) => Math.min(customerTotalPages, p + 1))}
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
