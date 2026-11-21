import { MenuAction } from '@/components/menu-action';
import OverdueInvoiceWarningDialog from '@/components/OverdueInvoiceWarningDialog';
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
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Calendar,
    Check,
    ClipboardList,
    CreditCard,
    FileText,
    Layers,
    Plus,
    RefreshCw,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Tambah PR', href: '/marketing/purchase-requirement/create' },
];

const todayValue = () => {
    const date = new Date();
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

const fetchNextRefPo = async (jenisPr, dateStr) => {
    if (!jenisPr) return '';
    try {
        const response = await axios.get('/marketing/purchase-requirement/generate-ref-po', {
            params: {
                jenis_pr: jenisPr,
                date: dateStr,
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

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value).replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatMargin = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const numeric = parseNumber(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
};

const formatRupiah = (value) => {
    const numeric = parseNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }

    return `Rp ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(numeric))}`;
};

const parseRupiahInput = (value) => {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
    return digitsOnly;
};

const calculateMargin = (hargaPoIn, hargaModal) => {
    const poIn = parseNumber(hargaPoIn);
    const modal = parseNumber(hargaModal);

    if (modal <= 0) {
        return '';
    }

    const margin = ((poIn - modal) / modal) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qtyPr, hargaModal) => {
    const qty = parseNumber(qtyPr);
    const modal = parseNumber(hargaModal);
    if (qty <= 0 || modal <= 0) {
        return '';
    }
    return (qty * modal).toFixed(2);
};

const calculateTotalStock = (item) => {
    const total =
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
    return total;
};

// Removing these rows also updates the saved PO In quantity.
const clearsSavedPoInQuantity = (item) =>
    item &&
    !String(item.id).startsWith('manual-') &&
    parseNumber(item.qtyPr) === 0 &&
    calculateTotalStock(item) >= 0;

const toDate = (dateString) => {
    if (!dateString || String(dateString).trim() === '') return null;
    const str = String(dateString).trim();
    const dmyMatch = str.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
    if (dmyMatch) {
        return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00`);
    }
    const ymdMatch = str.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/);
    if (ymdMatch) {
        return new Date(`${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}T00:00:00`);
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

export default function PurchaseRequirementCreate() {
    const { tenant } = usePage().props;
    const dbPrefix = (tenant?.database ?? '')
        .toLowerCase()
        .replace(/^db/, '')
        .toUpperCase();
    const forValue = dbPrefix ? `FOR ${dbPrefix}` : 'FOR';

    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const [poinMaterialError, setPoinMaterialError] = useState('');
    const [matchingPoIns, setMatchingPoIns] = useState([]);
    const [selectedMatchingPoIns, setSelectedMatchingPoIns] = useState([]);
    const [isMatchingPoModalOpen, setIsMatchingPoModalOpen] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [overdueWarningOpen, setOverdueWarningOpen] = useState(false);
    const [overdueWarningData, setOverdueWarningData] = useState(null);
    const [hasConfirmedOverdue, setHasConfirmedOverdue] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState(null);
    const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPo: '',
        forCustomer: '',
        payment: 'Cash Trans',
        jenisPr: '',
    });
    const [selectedPoIns, setSelectedPoIns] = useState([]);

    const [materialItems, setMaterialItems] = useState([]);
    const [stockFulfilledDetailIds, setStockFulfilledDetailIds] = useState([]);
    const [activeMaterialGroupIndex, setActiveMaterialGroupIndex] = useState(0);
    const qtyPrInputRef = useRef(null);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialList, setMaterialList] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [materialError, setMaterialError] = useState('');

    const [materialForm, setMaterialForm] = useState({
        kodeMaterial: '',
        namaMaterial: '',
        satuan: '',
        quantity: '',
        stokG1: 0,
        stokG2: 0,
        stokG3: 0,
        stokG4: 0,
        mis: 0,
        lastStock: 0,
        priceEstimate: '',
        totalPrice: 0,
        remark: '',
    });

    const materialGroups = useMemo(() => {
        const groups = selectedPoIns
            .map((po) => ({
                key: po.kode_poin,
                refPo: po.no_poin,
                customer: po.customer_name,
                noteDoc: po.note_doc,
                items: materialItems.filter(
                    (material) => material.refPo === po.no_poin,
                ),
            }))
            .filter((group) => group.items.length > 0);
        const manualItems = materialItems.filter((material) => !material.refPo);
        if (manualItems.length > 0) {
            groups.push({
                key: 'manual',
                refPo: 'Material Manual',
                customer: '',
                items: manualItems,
            });
        }
        return groups;
    }, [materialItems, selectedPoIns]);

    useEffect(() => {
        setActiveMaterialGroupIndex((current) =>
            Math.min(current, Math.max(0, materialGroups.length - 1)),
        );
    }, [materialGroups.length]);

    const visibleMaterialItems =
        materialGroups.length > 1
            ? (materialGroups[activeMaterialGroupIndex]?.items ?? [])
            : materialItems;
    const activeMaterialGroup =
        materialGroups[activeMaterialGroupIndex] ?? materialGroups[0];

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedCustomerSearchTerm(customerSearchTerm);
        }, 250);
        return () => clearTimeout(handler);
    }, [customerSearchTerm]);

    const loadCustomers = async () => {
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

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            const fetchedCustomers = Array.isArray(data?.customers)
                ? data.customers
                : [];

            setCustomerList(fetchedCustomers);
            setCustomerTotal(Number(data?.total ?? 0));
        } catch {
            setCustomerError('Gagal memuat data PO In.');
        } finally {
            setCustomerLoading(false);
        }
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
                `/marketing/purchase-requirement/materials?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            setMaterialList(Array.isArray(data?.materials) ? data.materials : []);
            setMaterialTotal(Number(data?.total ?? 0));
        } catch {
            setMaterialError('Gagal memuat data material.');
        } finally {
            setMaterialLoading(false);
        }
    };

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(materialTotal / materialPageSize));
    }, [materialTotal, materialPageSize]);

    useEffect(() => {
        if (isMaterialModalOpen) {
            loadMaterials();
        }
    }, [
        isMaterialModalOpen,
        materialCurrentPage,
        materialPageSize,
        materialSearchTerm,
    ]);

    useEffect(() => {
        if (isCustomerModalOpen) {
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isCustomerModalOpen,
        customerCurrentPage,
        customerPageSize,
        debouncedCustomerSearchTerm,
    ]);

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
                const nextRefPo = await fetchNextRefPo(nextJenis, formData.date);
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

    const loadPoInMaterials = async (kodePoin) => {
        if (!kodePoin) {
            setMaterialItems([]);
            return;
        }

        setPoinMaterialLoading(true);
        setPoinMaterialError('');

        try {
            const params = new URLSearchParams();
            params.set('kode_poin', kodePoin);

            const response = await fetch(
                `/marketing/purchase-requirement/poin-details?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            const rawItems = Array.isArray(data?.items) ? data.items : [];
            const selectedPoNumber = data?.selected_po_in?.no_poin ?? '';
            const selectedCustomer = data?.selected_po_in?.customer_name ?? '';

            const filteredItems = rawItems.filter(
                (item) => Number(item.sisa_qtypr ?? 0) > 0,
            );

            // --- PROSES MAPPING DATA MATERIAL DENGAN HARGA MODAL & STOK DARI BACKEND ---
            const itemsWithAutofilledPrice = filteredItems.map((item, index) => {
                const hargaModalTerakhir = item.harga_modal ?? '';

                const stockBreakdown = {
                    stokG1: item.stok_g1 ?? 0,
                    stokG2: item.stok_g2 ?? 0,
                    stokG3: item.stok_g3 ?? 0,
                    stokG4: item.stok_g4 ?? 0,
                    mis: item.mis ?? 0,
                    mib: item.mib ?? 0,
                    mibs: item.mibs ?? 0,
                    pr_outstanding: item.pr_outstanding ?? 0,
                    po_outstanding: item.po_outstanding ?? 0,
                    do_outstanding: item.do_outstanding ?? 0,
                };
                const totalStock = calculateTotalStock(stockBreakdown);
                const remainingQtyPr = parseNumber(item.sisa_qtypr);
                const orderInQty = parseNumber(item.qty_po_in);

                return {
                    id: item.id ?? `${Date.now()}-${index}`,
                    no: index + 1,
                    kodeMaterial: item.kd_material ?? '',
                    namaMaterial: item.material ?? '',
                    ...stockBreakdown,
                    stok: totalStock,
                    qtyPoIn: orderInQty,
                    maxQtyPr: remainingQtyPr,
                    qtyPr:
                        totalStock < 0
                            ? Math.min(remainingQtyPr, Math.abs(totalStock))
                            : 0,
                    satuan: item.satuan ?? '',
                    hargaPoIn: item.harga_po_in ?? 0,
                    // Diisi langsung dari query batch backend (tb_detailpo & tb_invin)
                    hargaModal: hargaModalTerakhir,
                    margin:
                        item.margin ??
                        calculateMargin(
                            item.harga_po_in ?? 0,
                            hargaModalTerakhir,
                        ),
                    remark: item.remark ?? '',
                    refPo: selectedPoNumber,
                    forCustomer: selectedCustomer,
                };
            });
            // --------------------------------------------------------

            setMaterialItems(itemsWithAutofilledPrice);
            setStockFulfilledDetailIds([]);
            const matches = Array.isArray(data?.matching_po_ins)
                ? data.matching_po_ins
                : [];
            setMatchingPoIns(matches);
            setSelectedMatchingPoIns(matches.map((item) => item.kode_poin));
            setIsMatchingPoModalOpen(matches.length > 0);
        } catch {
            setMaterialItems([]);
            setPoinMaterialError('Gagal memuat material dari PO In terpilih.');
        } finally {
            setPoinMaterialLoading(false);
        }
    };

    const addSelectedMatchingPoIns = () => {
        const selected = matchingPoIns.filter((po) =>
            selectedMatchingPoIns.includes(po.kode_poin),
        );
        setMaterialItems((current) => {
            const templateByMaterial = new Map(
                current.map((item) => [item.kodeMaterial.toLowerCase(), item]),
            );
            const additions = selected.flatMap((po) =>
                (po.materials ?? []).map((material, index) => {
                    const template = templateByMaterial.get(
                        String(material.kd_material ?? '').toLowerCase(),
                    );
                    return {
                        ...(template ?? {}),
                        id: material.id,
                        no: current.length + index + 1,
                        kodeMaterial: material.kd_material ?? '',
                        namaMaterial: material.material ?? '',
                        qtyPoIn: parseNumber(material.qty),
                        maxQtyPr: parseNumber(material.sisa_qtypr),
                        qtyPr:
                            calculateTotalStock(template) < 0
                                ? Math.min(
                                    parseNumber(material.sisa_qtypr),
                                    Math.abs(calculateTotalStock(template)),
                                )
                                : 0,
                        satuan: material.satuan ?? '',
                        hargaPoIn: material.harga_po_in ?? 0,
                        margin: calculateMargin(
                            material.harga_po_in ?? 0,
                            template?.hargaModal ?? '',
                        ),
                        refPo: po.no_poin,
                        forCustomer: po.customer_name,
                    };
                }),
            );
            return [...current, ...additions].map((item, index) => ({
                ...item,
                no: index + 1,
            }));
        });
        const poNumbers = selected.map((po) => po.no_poin).filter(Boolean);
        const customers = selected
            .map((po) => po.customer_name)
            .filter(Boolean);
        setSelectedPoIns((current) => [
            ...current,
            ...selected
                .filter(
                    (po) =>
                        !current.some(
                            (existing) => existing.kode_poin === po.kode_poin,
                        ),
                )
                .map((po) => ({
                    kode_poin: po.kode_poin,
                    no_poin: po.no_poin,
                    customer_name: po.customer_name,
                    note_doc: po.note_doc,
                })),
        ]);
        if (poNumbers.length > 0) {
            setFormData((current) => ({
                ...current,
                refPo: [current.refPo, ...poNumbers].filter(Boolean).join(', '),
                forCustomer: [
                    ...new Set(
                        [current.forCustomer, ...customers].filter(Boolean),
                    ),
                ].join(', '),
            }));
        }
        setIsMatchingPoModalOpen(false);
    };

    const removeSelectedPoIn = (po) => {
        const remaining = selectedPoIns.filter(
            (item) => item.kode_poin !== po.kode_poin,
        );
        setSelectedPoIns(remaining);
        setMaterialItems((current) =>
            current
                .filter((item) => item.refPo !== po.no_poin)
                .map((item, index) => ({ ...item, no: index + 1 })),
        );
        setFormData((current) => ({
            ...current,
            refPo: remaining.map((item) => item.no_poin).join(', '),
            forCustomer: [
                ...new Set(
                    remaining.map((item) => item.customer_name).filter(Boolean),
                ),
            ].join(', '),
        }));
    };

    const handleAddManualMaterial = () => {
        // --- LOGIKA VALIDASI QUANTITY BARU ---
        // Jika quantity kosong, undefined, hanya spasi, atau bernilai 0
        if (
            !materialForm.quantity ||
            String(materialForm.quantity).trim() === '' ||
            parseNumber(materialForm.quantity) <= 0
        ) {
            setSubmitError('Field quantity wajib diisi!');
            return; // Menolak material baru masuk ke dalam tambah ke daftar
        }
        // -------------------------------------

        if (!materialForm.kodeMaterial) {
            setSubmitError('Pilih material terlebih dahulu.');
            return;
        }

        const newItem = {
            id: `manual-${Date.now()}`,
            no: materialItems.length + 1,
            kodeMaterial: materialForm.kodeMaterial,
            namaMaterial: materialForm.namaMaterial,
            stokG1: materialForm.stokG1,
            stokG2: materialForm.stokG2,
            stokG3: materialForm.stokG3,
            stokG4: materialForm.stokG4,
            mis: materialForm.mis ?? 0,
            mib: materialForm.mib ?? 0,
            mibs: materialForm.mibs ?? 0,
            pr_outstanding: materialForm.pr_outstanding ?? 0,
            po_outstanding: materialForm.po_outstanding ?? 0,
            do_outstanding: materialForm.do_outstanding ?? 0,
            stok: calculateTotalStock(materialForm),
            qtyPoIn: 0,
            qtyPr: materialForm.quantity,
            satuan: materialForm.satuan,
            hargaPoIn: 0,
            hargaModal: materialForm.priceEstimate,
            totalPrice: materialForm.totalPrice,
            margin: '',
            remark: materialForm.remark,
            refPo: formData.refPo,
            forCustomer: formData.forCustomer,
        };

        setMaterialItems((prev) => [...prev, newItem]);
        setMaterialForm({
            kodeMaterial: '',
            namaMaterial: '',
            satuan: '',
            quantity: '',
            stokG1: 0,
            stokG2: 0,
            stokG3: 0,
            stokG4: 0,
            mis: 0,
            mib: 0,
            mibs: 0,
            pr_outstanding: 0,
            po_outstanding: 0,
            do_outstanding: 0,
            lastStock: 0,
            priceEstimate: '',
            totalPrice: 0,
            remark: '',
        });
        setSubmitError('');
    };

    const updateMaterialForm = (field, value) => {
        setMaterialForm((prev) => {
            const updated = { ...prev, [field]: value };
            if (field === 'quantity' || field === 'priceEstimate') {
                updated.totalPrice =
                    parseNumber(updated.quantity) *
                    parseNumber(updated.priceEstimate);
            }
            return updated;
        });
    };

    const handleQtyPrChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                const qtyPr = value;
                return {
                    ...item,
                    qtyPr,
                };
            }),
        );
    };

    const handleHargaModalChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }

                const hargaModal = value;
                return {
                    ...item,
                    hargaModal,
                    margin: calculateMargin(item.hargaPoIn, hargaModal),
                };
            }),
        );
    };

    const handleRemarkChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        remark: value,
                    }
                    : item,
            ),
        );
    };

    const handleRemoveMaterial = (id) => {
        const material = materialItems.find((item) => item.id === id);
        const isFulfilledByStock = clearsSavedPoInQuantity(material);

        if (isFulfilledByStock) {
            setMaterialToDelete(material);
            setIsDeleteConfirmOpen(true);
            return;
        }

        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
    };

    const confirmDeleteMaterial = async () => {
        if (!materialToDelete) return;

        setIsDeletingMaterial(true);
        try {
            await axios.put(
                `/marketing/purchase-requirement/poin-detail/${materialToDelete.id}/clear-sisa`,
            );

            setStockFulfilledDetailIds((current) => [
                ...new Set([...current, Number(materialToDelete.id)]),
            ]);
            setMaterialItems((prev) =>
                prev.filter((item) => item.id !== materialToDelete.id),
            );
            setIsDeleteConfirmOpen(false);
            setMaterialToDelete(null);
        } catch (error) {
            console.error('Failed to clear PO In qty:', error);
            alert('Gagal mereset data PO In. Silakan coba lagi.');
        } finally {
            setIsDeletingMaterial(false);
        }
    };

    const validateSubmit = () => {
        if (materialItems.length === 0) {
            return 'Belum ada material dari PO In yang dipilih.';
        }

        const hasInvalidRow = materialItems.some((item) => {
            const requiredQtyPr =
                calculateTotalStock(item) < 0
                    ? Math.min(
                        parseNumber(item.maxQtyPr),
                        Math.abs(calculateTotalStock(item)),
                    )
                    : 0;

            if (formData.jenisPr) {
                return (
                    parseNumber(item.hargaModal) <= 0 ||
                    parseNumber(item.qtyPr) <= 0
                );
            }

            return (
                parseNumber(item.hargaModal) <= 0 ||
                parseNumber(item.qtyPr) <= 0 ||
                (item.maxQtyPr !== undefined &&
                    parseNumber(item.qtyPr) > requiredQtyPr)
            );
        });
        if (hasInvalidRow) {
            if (formData.jenisPr) {
                return 'Harga modal wajib diisi dan Qty PR tidak boleh 0.';
            }
            return 'Harga modal wajib diisi, Qty PR tidak boleh 0, dan tidak boleh melebihi batas maksimal (Qty Sisa PR).';
        }

        return '';
    };

    const buildSubmitPayload = () => {
        return {
            date: formData.date,
            payment: formData.payment,
            for_customer: formData.forCustomer,
            ref_po: formData.refPo,
            jenis_pr:
                selectedPoIns.length > 0 ? 'PR For Customer' : formData.jenisPr,
            stock_fulfilled_detail_ids: stockFulfilledDetailIds,
            materials: materialItems.map((item, index) => ({
                no: index + 1,
                detail_id: String(item.id).startsWith('manual-')
                    ? null
                    : item.id,
                ref_po: formData.jenisPr ? formData.refPo : (item.refPo || formData.refPo),
                for_customer: formData.jenisPr ? formData.forCustomer : (item.forCustomer || formData.forCustomer),
                kd_material: item.kodeMaterial,
                material: item.namaMaterial,
                qty: item.qtyPr,
                sisa_pr: item.qtyPr,
                poin_consumed_qty:
                    parseNumber(item.maxQtyPr) -
                    Math.max(
                        0,
                        (calculateTotalStock(item) < 0
                            ? Math.min(
                                parseNumber(item.maxQtyPr),
                                Math.abs(calculateTotalStock(item)),
                            )
                            : 0) - parseNumber(item.qtyPr),
                    ),
                unit: item.satuan,
                stok: calculateTotalStock(item),
                stok_g1: item.stokG1,
                stok_g2: item.stokG2,
                stok_g3: item.stokG3,
                stok_g4: item.stokG4,
                unit_price: item.hargaModal,
                total_price: calculateTotalPrice(item.qtyPr, item.hargaModal),
                price_po: formData.jenisPr ? item.hargaModal : item.hargaPoIn,
                margin: formData.jenisPr ? 0 : item.margin,
                renmark: item.remark,
            })),
        };
    };

    const submitPurchaseRequirement = () => {
        router.post('/marketing/purchase-requirement', buildSubmitPayload(), {
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
                    title: firstError || 'Gagal menyimpan data.',
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
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitError('');

        const validationError = validateSubmit();
        if (validationError) {
            setSubmitError(validationError);
            return;
        }

        if (hasConfirmedOverdue) {
            submitPurchaseRequirement();
            return;
        }

        setIsSubmitting(true);
        try {
            const customers = selectedPoIns.length
                ? [
                    ...new Set(
                        selectedPoIns
                            .map((po) => po.customer_name)
                            .filter(Boolean),
                    ),
                ]
                : [formData.forCustomer];
            const responses = await Promise.all(
                customers.map((customer) =>
                    axios.get(
                        '/marketing/purchase-requirement/overdue-invoices',
                        { params: { customer } },
                    ),
                ),
            );
            const overdueResponses = responses.filter(
                (response) =>
                    Array.isArray(response.data?.invoices) &&
                    response.data.invoices.length > 0,
            );

            if (overdueResponses.length > 0) {
                setOverdueWarningData({
                    ...overdueResponses[0].data,
                    invoices: overdueResponses.flatMap(
                        (response) => response.data.invoices,
                    ),
                });
                setOverdueWarningOpen(true);
                setIsSubmitting(false);
                return;
            }

            submitPurchaseRequirement();
        } catch {
            setSubmitError('Gagal memeriksa tunggakan customer.');
            setIsSubmitting(false);
        }
    };

        return (
        <>
            <Head title="Tambah PR" />
            <form
                className="w-full min-w-0 space-y-5 px-0 py-4 text-foreground"
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
                                Tambah Purchase Requirement
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Buat pengajuan kebutuhan pembelian barang (PR) baru
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
                                        Pilih jenis pengajuan PR atau tarik dari referensi PO Masuk Customer
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-6">
                            {/* Option Cards: Jenis PR */}
                            {(!formData.refPo ||
                                formData.refPo === forValue ||
                                formData.jenisPr) && (
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
                                                const nextRefPo = await fetchNextRefPo(formData.jenisPr, newDate);
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

                                {/* Ref PO Input */}
                                <div className="space-y-1.5 sm:col-span-1 lg:col-span-4">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <FileText className="size-3.5 text-muted-foreground" />
                                        Nomor Ref PO
                                    </Label>
                                    <Input
                                        className={cn(
                                            'h-10 rounded-lg text-sm font-semibold',
                                            !formData.jenisPr && 'bg-muted/40'
                                        )}
                                        value={formData.refPo || (selectedPoIns.length > 0 ? selectedPoIns.map((p) => p.no_poin).join(', ') : '')}
                                        placeholder="Pilih PO In atau ketik Ref PO..."
                                        readOnly={!formData.jenisPr}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                refPo: value,
                                            }));
                                        }}
                                    />
                                </div>

                                {/* Customer / Cari PO In */}
                                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Building2 className="size-3.5 text-muted-foreground" />
                                        {formData.jenisPr ? 'For Customer' : 'Customer PO In'}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            className="h-10 rounded-lg text-sm font-semibold bg-muted/40"
                                            value={formData.forCustomer || (selectedPoIns.length > 0 ? selectedPoIns.map((p) => p.customer_name).join(', ') : '')}
                                            placeholder={formData.jenisPr ? 'FOR...' : 'Belum ada customer dipilih...'}
                                            readOnly
                                        />
                                        {!formData.jenisPr && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-10 px-4 rounded-lg font-semibold whitespace-nowrap shrink-0"
                                                onClick={() => {
                                                    setIsCustomerModalOpen(true);
                                                    setCustomerCurrentPage(1);
                                                    setCustomerSearchTerm('');
                                                    setCustomerList([]);
                                                    setCustomerTotal(0);
                                                }}
                                            >
                                                <Search className="size-3.5 mr-2" />
                                                {selectedPoIns.length > 0 ? 'Ganti' : 'Cari PO In'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

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

                            {/* PO In Terpilih List */}
                            {!formData.jenisPr && selectedPoIns.length > 0 && (
                                <div className="space-y-2.5 pt-2 border-t border-border">
                                    <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        PO In Terpilih ({selectedPoIns.length}):
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {selectedPoIns.map((po) => (
                                            <div
                                                key={po.kode_poin}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3 hover:border-emerald-500/30 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                                                        {po.no_poin}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {po.customer_name}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                                                    title="Hapus PO In"
                                                    onClick={() => removeSelectedPoIn(po)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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

                {/* STEP 2: DATA MATERIAL & SUMMARY */}
                {step === 2 && (
                    <div className="w-full space-y-6 animate-in fade-in-50 duration-300">
                        {/* Daftar Material PR (Full Width) */}
                        <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                            <CardHeader className="border-b border-border bg-muted/20 px-4 py-3.5 sm:px-6 sm:py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <Layers className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                                        <div>
                                            <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                                Daftar Material PR
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                    {materialItems.length} Item
                                                </span>
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Kebutuhan barang yang akan diajukan pembelian
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                            Total Estimasi:
                                        </span>
                                        <span className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(
                                                materialItems.reduce(
                                                    (acc, item) =>
                                                        acc + parseNumber(calculateTotalPrice(item.qtyPr, item.hargaModal)),
                                                    0,
                                                ),
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </CardHeader>
                                    <CardContent className="p-4 sm:p-6 space-y-6">
                                        {/* Document Note if available */}
                                        {activeMaterialGroup &&
                                            activeMaterialGroup.refPo !== 'Material Manual' && (
                                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                                                    <p className="font-bold flex items-center gap-1.5">
                                                        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                                                        Catatan Dokumen PO:
                                                    </p>
                                                    <p className="mt-1 whitespace-pre-wrap pl-5 text-muted-foreground">
                                                        {activeMaterialGroup.noteDoc || '-'}
                                                    </p>
                                                </div>
                                            )}

                                        {/* Paginator / Stepper for Multiple PO Groups */}
                                        {materialGroups.length > 1 && (
                                            <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-xs"
                                                        disabled={activeMaterialGroupIndex === 0}
                                                        onClick={() =>
                                                            setActiveMaterialGroupIndex((current) =>
                                                                Math.max(0, current - 1),
                                                            )
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <div className="text-center">
                                                        <p className="text-xs sm:text-sm font-bold text-foreground">
                                                            {materialGroups[activeMaterialGroupIndex]?.refPo}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {materialGroups[activeMaterialGroupIndex]?.customer ||
                                                                'Material tanpa PO In'}
                                                        </p>
                                                        <p className="mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                            PO In {activeMaterialGroupIndex + 1} dari{' '}
                                                            {materialGroups.length}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-xs"
                                                        disabled={
                                                            activeMaterialGroupIndex >=
                                                            materialGroups.length - 1
                                                        }
                                                        onClick={() =>
                                                            setActiveMaterialGroupIndex((current) =>
                                                                Math.min(
                                                                    materialGroups.length - 1,
                                                                    current + 1,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Material Items List */}
                                        {materialItems.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border text-center">
                                                <div className="p-3 rounded-full bg-muted/50 mb-3 text-muted-foreground">
                                                    <Search className="size-6" />
                                                </div>
                                                <p className="text-sm font-bold text-foreground uppercase tracking-wider">
                                                    Belum Ada Item Material
                                                </p>
                                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                                    Silakan pilih PO In pada Langkah 1 atau input material baru secara manual di bawah.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {visibleMaterialItems.map((item, idx) => (
                                                    <div
                                                        key={item.id}
                                                        className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 hover:border-emerald-500/30 transition-colors"
                                                    >
                                                        {/* Item Header */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1.5 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground tabular-nums">
                                                                        #{idx + 1}
                                                                    </span>
                                                                    <h4 className="font-bold text-sm sm:text-base text-foreground break-words">
                                                                        {item.namaMaterial}
                                                                    </h4>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                                    <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                                                                        {item.kodeMaterial}
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
                                                            <MenuAction
                                                                action={clearsSavedPoInQuantity(item) ? 'update' : 'create'}
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                                                                onClick={() => handleRemoveMaterial(item.id)}
                                                                title="Hapus Material"
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </MenuAction>
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
                                                                        {value ?? 0}
                                                                    </strong>
                                                                </span>
                                                            ))}
                                                            <span className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-2xs">
                                                                DO BELUM DIBUAT:{' '}
                                                                <strong className="ml-1 tabular-nums text-xs sm:text-sm font-extrabold">
                                                                    {item.do_outstanding ?? 0}
                                                                </strong>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                                                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                                                {(item.stok ?? 0) < 0 ? 'KREDIT DO:' : 'TOTAL / SELISIH:'}{' '}
                                                                <strong className="tabular-nums text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                                                                    {item.stok ?? 0}
                                                                </strong>
                                                            </span>
                                                        </div>

                                                        {/* Input Controls Grid: Quantity & Pricing (Safe for 720px) */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                                            {/* Quantity Block */}
                                                            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                                                                    <span className="font-extrabold text-foreground uppercase tracking-wider">
                                                                        Quantity
                                                                    </span>
                                                                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                                                                        <span>ORDER IN: <strong className="text-foreground tabular-nums text-sm sm:text-base font-extrabold">{item.qtyPoIn ?? 0}</strong></span>
                                                                        {item.maxQtyPr !== undefined && (
                                                                            <>
                                                                                <span>SISA LAST: <strong className="text-foreground tabular-nums text-sm sm:text-base font-extrabold">{item.maxQtyPr}</strong></span>
                                                                                <span>SISA NOW: <strong className={cn('tabular-nums text-sm sm:text-base font-extrabold', (parseNumber(item.maxQtyPr) - parseNumber(item.qtyPr)) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>{parseNumber(item.maxQtyPr) - parseNumber(item.qtyPr)}</strong></span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                                        INPUT QTY PR <span className="text-destructive">*</span>
                                                                    </Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max={
                                                                            formData.jenisPr
                                                                                ? undefined
                                                                                : calculateTotalStock(item) < 0
                                                                                ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item)))
                                                                                : 0
                                                                        }
                                                                        className={cn(
                                                                            'h-11 text-right text-base sm:text-lg font-bold tabular-nums',
                                                                            !formData.jenisPr &&
                                                                                item.maxQtyPr !== undefined &&
                                                                                parseNumber(item.qtyPr) > (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0)
                                                                                ? 'border-destructive focus-visible:ring-destructive'
                                                                                : 'border-input'
                                                                        )}
                                                                        value={item.qtyPr}
                                                                        onChange={(e) => handleQtyPrChange(item.id, e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                {/* Quantity Validation hints */}
                                                                {!formData.jenisPr &&
                                                                    item.maxQtyPr !== undefined &&
                                                                    parseNumber(item.qtyPr) > (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0) && (
                                                                        <p className="text-right text-xs font-semibold text-destructive leading-tight">
                                                                            Qty PR tidak boleh melebihi Qty Sisa PR ({renderValue(calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0)}).
                                                                        </p>
                                                                    )}
                                                                {parseNumber(item.qtyPr) === 0 && (
                                                                    <p className="text-right text-xs font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                                                                        PR input tidak boleh 0.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Price Block */}
                                                            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                                                                    <span className="font-extrabold text-foreground uppercase tracking-wider">
                                                                        Harga & Modal (IDR)
                                                                    </span>
                                                                    <span className="text-xs sm:text-sm text-muted-foreground">
                                                                        PO IN: <strong className="text-foreground tabular-nums text-sm sm:text-base font-bold">{formatRupiah(item.hargaPoIn)}</strong>
                                                                    </span>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                                        HARGA MODAL EST.
                                                                    </Label>
                                                                    <Input
                                                                        type="text"
                                                                        className="h-11 text-right text-base sm:text-lg font-bold tabular-nums"
                                                                        value={formatRupiah(item.hargaModal)}
                                                                        onChange={(e) => handleHargaModalChange(item.id, parseRupiahInput(e.target.value))}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Total & Profit Margin Bar */}
                                                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                                    Estimasi Total Nilai
                                                                </span>
                                                                <p className="text-lg sm:text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                                    {formatRupiah(calculateTotalPrice(item.qtyPr, item.hargaModal))}
                                                                </p>
                                                            </div>
                                                            {item.margin !== '' && (
                                                                <div className="text-right">
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                                                        Margin
                                                                    </span>
                                                                    <Badge
                                                                        variant={parseNumber(item.margin) < 0 ? 'destructive' : 'outline'}
                                                                        className={cn(
                                                                            'font-semibold tabular-nums text-xs sm:text-sm px-2.5 py-0.5',
                                                                            parseNumber(item.margin) >= 0
                                                                                ? 'bg-emerald-600 text-white border-transparent'
                                                                                : 'bg-destructive text-white border-transparent'
                                                                        )}
                                                                    >
                                                                        {formatMargin(item.margin)} %
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Remark Field */}
                                                        <div className="space-y-1 pt-1">
                                                            <Input
                                                                type="text"
                                                                placeholder="Tulis catatan atau instruksi khusus untuk barang ini (opsional)..."
                                                                className="h-9 text-xs"
                                                                value={item.remark}
                                                                onChange={(e) => handleRemarkChange(item.id, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Input Material Baru (When Jenis PR is Active) */}
                                        {formData.jenisPr && (
                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Plus className="size-4 text-emerald-600 dark:text-emerald-400" />
                                                    <h3 className="text-xs sm:text-sm font-bold tracking-wider text-emerald-700 dark:text-emerald-300 uppercase">
                                                        Input Material Baru Manual
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <Label className="text-xs sm:text-sm font-bold text-foreground">Pilih Material</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                placeholder="Klik tombol cari material..."
                                                                className="h-11 text-sm sm:text-base font-semibold bg-background"
                                                                value={materialForm.namaMaterial}
                                                                readOnly
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-11 px-4 rounded-lg shrink-0 font-semibold"
                                                                onClick={() => setIsMaterialModalOpen(true)}
                                                            >
                                                                <Search className="size-4" />
                                                            </Button>
                                                        </div>
                                                        {materialForm.kodeMaterial && (
                                                            <p className="text-xs font-semibold text-muted-foreground">
                                                                Kode: {materialForm.kodeMaterial}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs sm:text-sm font-bold text-foreground">
                                                            {parseFloat(materialForm.lastStock) < 0 ? 'Kredit DO:' : 'Total / Selisih:'}
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            className="h-11 text-sm sm:text-base font-bold bg-muted/40 tabular-nums"
                                                            value={materialForm.lastStock}
                                                            readOnly
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs sm:text-sm font-bold text-foreground">Input Qty PR</Label>
                                                        <Input
                                                            ref={qtyPrInputRef}
                                                            type="number"
                                                            className="h-11 text-sm sm:text-base font-bold tabular-nums"
                                                            placeholder="0"
                                                            value={materialForm.quantity}
                                                            onChange={(e) => updateMaterialForm('quantity', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddManualMaterial();
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <Label className="text-xs sm:text-sm font-bold text-foreground">Harga Modal Est. (IDR)</Label>
                                                        <Input
                                                            type="text"
                                                            className="h-11 text-sm sm:text-base font-bold tabular-nums"
                                                            placeholder="Rp 0"
                                                            value={formatRupiah(materialForm.priceEstimate)}
                                                            onChange={(e) => updateMaterialForm('priceEstimate', parseRupiahInput(e.target.value))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddManualMaterial();
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <Label className="text-xs font-semibold">Remark / Catatan</Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10 text-sm"
                                                            placeholder="Catatan untuk material ini..."
                                                            value={materialForm.remark}
                                                            onChange={(e) => updateMaterialForm('remark', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddManualMaterial();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-500/10">
                                                    <div>
                                                        <span className="text-xs text-muted-foreground">Total Item: </span>
                                                        <span className="text-base sm:text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                            {formatRupiah(materialForm.totalPrice)}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={handleAddManualMaterial}
                                                        disabled={!materialForm.kodeMaterial}
                                                        className="h-10 px-5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                    >
                                                        <Plus className="mr-2 size-4" />
                                                        Tambah Ke Daftar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Redesigned Ringkasan Dokumen PR & Action Bar (Full Width, Tanpa Ref PO, Customer, Metode Bayar, Total Item) */}
                                <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                                    <div className="h-1.5 bg-emerald-600" />
                                    <CardContent className="p-4 sm:p-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                                            <div className="flex items-center gap-3.5">
                                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <CreditCard className="size-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                                        Total Estimasi Kebutuhan PR
                                                    </p>
                                                    <h3 className="text-2xl sm:text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                        {formatRupiah(
                                                            materialItems.reduce(
                                                                (acc, item) =>
                                                                    acc + parseNumber(calculateTotalPrice(item.qtyPr, item.hargaModal)),
                                                                0,
                                                            ),
                                                        )}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    className="h-11 px-5 rounded-xl font-semibold text-xs sm:text-sm"
                                                    onClick={() => setStep(1)}
                                                >
                                                    <ArrowLeft className="mr-2 size-4" />
                                                    Kembali ke Langkah 1
                                                </Button>
                                                <MenuAction
                                                    action="create"
                                                    type="submit"
                                                    className="h-11 px-6 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs sm:text-sm"
                                                    disabled={isSubmitting || materialItems.length === 0}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Spinner className="mr-2 size-4" />
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="mr-2 size-4" />
                                                            Simpan PR
                                                        </>
                                                    )}
                                                </MenuAction>
                                            </div>
                                        </div>

                                        {submitError && (
                                            <div className="mt-4 p-3 rounded-xl bg-destructive/10 text-center text-xs font-semibold text-destructive">
                                                {submitError}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                )}

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
                                Pilih PO In untuk mengisi Ref PO, customer, dan detail material
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
                                                            className="h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                                            onClick={() => {
                                                                setHasConfirmedOverdue(false);
                                                                setOverdueWarningData(null);
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    refPo: prev.jenisPr ? forValue : (item.no_poin ?? ''),
                                                                    forCustomer: prev.jenisPr ? forValue : (item.customer_name ?? ''),
                                                                }));
                                                                setSelectedPoIns([
                                                                    {
                                                                        kode_poin: item.kode_poin,
                                                                        no_poin: item.no_poin,
                                                                        customer_name: item.customer_name,
                                                                        note_doc: item.note_doc,
                                                                    },
                                                                ]);
                                                                setIsCustomerModalOpen(false);
                                                                loadPoInMaterials(item.kode_poin ?? '');
                                                            }}
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

                {/* MODAL MATCHING PO IN */}
                <Dialog open={isMatchingPoModalOpen} onOpenChange={setIsMatchingPoModalOpen}>
                    <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[92vw] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl">
                        <DialogHeader className="border-b border-border pb-3">
                            <DialogTitle className="text-lg font-bold text-foreground">
                                PO In dengan material yang sama
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Pilih PO In tambahan. Quantity setiap PO In akan disimpan pada baris terpisah.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 pt-2">
                            {matchingPoIns.map((po) => (
                                <label
                                    key={po.kode_poin}
                                    className="block cursor-pointer rounded-xl border border-border p-3.5 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="mb-2.5 flex items-center gap-3">
                                        <Checkbox
                                            checked={selectedMatchingPoIns.includes(po.kode_poin)}
                                            onCheckedChange={(checked) =>
                                                setSelectedMatchingPoIns((current) =>
                                                    checked
                                                        ? [...new Set([...current, po.kode_poin])]
                                                        : current.filter((value) => value !== po.kode_poin),
                                                )
                                            }
                                        />
                                        <span className="text-xs sm:text-sm font-bold text-foreground">
                                            {renderValue(po.no_poin)} — {renderValue(po.customer_name)}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-border">
                                        <Table className="text-xs">
                                            <TableHeader className="bg-muted/30">
                                                <TableRow>
                                                    <TableHead className="py-2">Material</TableHead>
                                                    <TableHead className="py-2 text-right">Qty</TableHead>
                                                    <TableHead className="py-2 text-right">Sisa Qty PR</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(po.materials ?? []).map((material) => (
                                                    <TableRow key={material.id}>
                                                        <TableCell className="py-2 font-medium">{renderValue(material.material)}</TableCell>
                                                        <TableCell className="py-2 text-right tabular-nums">{renderValue(material.qty)}</TableCell>
                                                        <TableCell className="py-2 text-right tabular-nums font-semibold">{renderValue(material.sisa_qtypr)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-lg text-xs"
                                onClick={() => setIsMatchingPoModalOpen(false)}
                            >
                                Lewati
                            </Button>
                            <Button
                                type="button"
                                className="h-9 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={selectedMatchingPoIns.length === 0}
                                onClick={addSelectedMatchingPoIns}
                            >
                                Tambahkan PO In
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* MODAL PILIH MATERIAL INVENTORY */}
                <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
                    <DialogContent
                        onCloseAutoFocus={(e) => {
                            e.preventDefault();
                            qtyPrInputRef.current?.focus();
                            qtyPrInputRef.current?.select?.();
                        }}
                        className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[1400px] max-h-[92vh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl"
                    >
                        <DialogHeader className="border-b border-border pb-3">
                            <DialogTitle className="text-lg font-bold text-foreground">
                                Pilih Material Inventory
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Pilih material dari master data inventori untuk item PR ini
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
                                                                let priceEstimate = m.harga || 0;
                                                                try {
                                                                    const priceRes = await axios.get(
                                                                        '/marketing/purchase-requirement/get-last-price',
                                                                        { params: { kd_mat: m.kd_material } },
                                                                    );
                                                                    const latestPrice = parseNumber(priceRes.data?.harga);
                                                                    if (priceRes.data?.success && latestPrice > 0) {
                                                                        priceEstimate = latestPrice;
                                                                    }
                                                                } catch {
                                                                    priceEstimate = m.harga || 0;
                                                                }

                                                                setMaterialForm((prev) => {
                                                                    const stockBreakdown = {
                                                                        stokG1: m.stok_g1 ?? 0,
                                                                        stokG2: m.stok_g2 ?? 0,
                                                                        stokG3: m.stok_g3 ?? 0,
                                                                        stokG4: m.stok_g4 ?? 0,
                                                                        mis: m.mis ?? 0,
                                                                        mib: m.mib ?? 0,
                                                                        mibs: m.mibs ?? 0,
                                                                        pr_outstanding: m.pr_outstanding ?? 0,
                                                                        po_outstanding: m.po_outstanding ?? 0,
                                                                        do_outstanding: m.do_outstanding ?? 0,
                                                                    };
                                                                    return {
                                                                        ...prev,
                                                                        kodeMaterial: m.kd_material,
                                                                        namaMaterial: m.material,
                                                                        satuan: m.unit,
                                                                        ...stockBreakdown,
                                                                        lastStock: calculateTotalStock(stockBreakdown),
                                                                        priceEstimate,
                                                                        totalPrice: parseNumber(prev.quantity) * parseNumber(priceEstimate),
                                                                    };
                                                                });
                                                                setIsMaterialModalOpen(false);
                                                                setTimeout(() => {
                                                                    qtyPrInputRef.current?.focus();
                                                                    qtyPrInputRef.current?.select?.();
                                                                }, 120);
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
            </form>

            {/* DIALOG KONFIRMASI PENGHAPUSAN MATERIAL */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-foreground">
                            Konfirmasi Penghapusan
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
                            Stok sudah memenuhi kebutuhan material ini. Apakah Anda yakin ingin menghapus material? Sisa Qty PO Masuk akan diubah menjadi 0 saat PR disimpan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg text-xs"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            disabled={isDeletingMaterial}
                        >
                            Batal
                        </Button>
                        <MenuAction
                            action="update"
                            type="button"
                            variant="destructive"
                            className="h-9 rounded-lg text-xs font-bold"
                            onClick={confirmDeleteMaterial}
                            disabled={isDeletingMaterial}
                        >
                            {isDeletingMaterial ? 'Menghapus...' : 'Ya, Hapus'}
                        </MenuAction>
                    </div>
                </DialogContent>
            </Dialog>

            {/* OVERDUE INVOICE WARNING DIALOG */}
            <OverdueInvoiceWarningDialog
                open={overdueWarningOpen}
                onOpenChange={setOverdueWarningOpen}
                data={overdueWarningData}
                isSubmitting={isSubmitting}
                onConfirm={() => {
                    setHasConfirmedOverdue(true);
                    setOverdueWarningOpen(false);
                    submitPurchaseRequirement();
                }}
            />
        </>
    );
}

PurchaseRequirementCreate.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
